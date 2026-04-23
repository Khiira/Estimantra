import { useState, useMemo, useRef, useEffect } from 'react';
import { insforge } from '../lib/insforge';
import { ChevronRight, ChevronDown, Plus, Clock, AlignLeft, DollarSign, Link as LinkIcon } from 'lucide-react';

export default function TaskTree({ tasks, roles, projectId, version, onTasksChange, onTotalsChange, readOnly }: any) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const timeoutRefs = useRef<Record<string, any>>({});
  // Guard to prevent double-insert when Enter key AND onBlur fire together
  const isSubmitting = useRef(false);

  // 1. Construir árbol
  const treeData = useMemo(() => {
    const map = new Map();
    const roots: any[] = [];
    tasks.forEach((t: any) => map.set(t.id, { ...t, children: [], totalHours: 0, totalCost: 0 }));
    
    // Asignar hijos
    tasks.forEach((t: any) => {
      if (t.parent_id && map.has(t.parent_id)) {
        map.get(t.parent_id).children.push(map.get(t.id));
      } else {
        roots.push(map.get(t.id));
      }
    });

    // Calcular suma de horas y coste financiero (bottom-up)
    const calcTotals = (node: any) => {
      let sumHours = Number(node.estimated_hours || 0);
      const role = roles.find((r: any) => r.id === node.assigned_role_id);
      let sumCost = sumHours * (role ? Number(role.hourly_rate || 0) : 0);

      if (node.children && node.children.length > 0) {
        sumHours = 0;
        sumCost = 0;
        node.children.forEach((child: any) => {
          const { childHours, childCost } = calcTotals(child);
          sumHours += childHours;
          sumCost += childCost;
        });
      }

      node.totalHours = sumHours;
      node.totalCost = sumCost;
      return { childHours: sumHours, childCost: sumCost };
    };
    
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    roots.forEach(r => {
      const { childHours, childCost } = calcTotals(r);
      grandTotalHours += childHours;
      grandTotalCost += childCost;
    });

    return { roots, grandTotalHours, grandTotalCost };
  }, [tasks, roles]);

  useEffect(() => {
    if (onTotalsChange) onTotalsChange(treeData.grandTotalHours, treeData.grandTotalCost);
  }, [treeData.grandTotalHours, treeData.grandTotalCost]);

  const rootTasks = treeData.roots;

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateTask = async (parentId: string | null) => {
    if (readOnly) return;
    // Guard against double-submit (Enter key fires submit, then onBlur also fires)
    if (isSubmitting.current) return;
    if (!newTaskName.trim()) {
      setAddingTaskTo(null);
      return;
    }

    isSubmitting.current = true;

    const newTask: any = {
      project_id: projectId,
      task_name: newTaskName,
      estimated_hours: 0,
      version: version || '1.0'
    };
    if (parentId) newTask.parent_id = parentId;

    const { data, error } = await insforge.database
      .from('tasks')
      .insert([newTask])
      .select();

    isSubmitting.current = false;

    if (error) {
      alert(`Error al crear tarea: ${error.message || JSON.stringify(error)}`);
      setAddingTaskTo(null);
      return;
    }

    if (data) {
      onTasksChange([...tasks, data[0]]);
    }
    
    setAddingTaskTo(null);
    setNewTaskName('');
    if (parentId) {
      setExpanded(prev => ({ ...prev, [parentId]: true }));
    }
  };


  const handleUpdateTask = (id: string, field: string, value: any) => {
    if (readOnly) return;
    // 1. Actualización optimista local
    const updatedTasks = tasks.map((t: any) => 
      t.id === id ? { ...t, [field]: value } : t
    );
    onTasksChange(updatedTasks);

    // 2. Debounce para guardar en BD (evita spamear requests mientras se tipea)
    if (timeoutRefs.current[id]) clearTimeout(timeoutRefs.current[id]);
    timeoutRefs.current[id] = setTimeout(async () => {
      await insforge.database
        .from('tasks')
        .update({ [field]: value })
        .eq('id', id);
    }, 800); // 800ms debounce for text/inputs
  };

  const getValidPredecessors = (currentId: string) => {
    // Evitar circularidad básica: no puede ser ella misma ni sus descendientes
    const descendants = new Set<string>();
    const collect = (id: string) => {
      tasks.filter((t: any) => t.parent_id === id).forEach((c: any) => {
        descendants.add(c.id);
        collect(c.id);
      });
    };
    collect(currentId);
    
    return tasks.filter((t: any) => t.id !== currentId && !descendants.has(t.id));
  };

  // 2. Renderizado Recursivo
  const renderTaskNode = (node: any, depth = 0) => {
    const isExpanded = expanded[node.id];
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id} className="task-node-wrapper">
        <div 
          className={`task-node depth-${depth} ${readOnly && !hasChildren ? 'opacity-60' : ''}`} 
          style={{ '--depth': depth } as React.CSSProperties}
        >
          
          <div className="task-left">
            {hasChildren ? (
              <button className="icon-btn tiny" onClick={() => toggleExpand(node.id)}>
                {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </button>
            ) : (
              <div className="spacer-node"></div> 
            )}
            <input 
              className="task-name-input"
              value={node.task_name}
              readOnly={readOnly}
              onChange={e => handleUpdateTask(node.id, 'task_name', e.target.value)}
              placeholder="Nombre de la tarea..."
              title="Editar nombre de la tarea"
            />
          </div>

          <div className="task-right">
            {!hasChildren ? (
              <div className="task-leaf-controls">
                <input 
                  type="number" 
                  min="0"
                  step="0.5"
                  className="hours-input" 
                  disabled={readOnly}
                  value={node.estimated_hours || ''} 
                  placeholder="0 h"
                  onChange={e => handleUpdateTask(node.id, 'estimated_hours', Number(e.target.value) || 0)} 
                />
                <div className="role-select-wrapper">
                  <select 
                    className="role-select" 
                    disabled={readOnly}
                    value={node.assigned_role_id || ''} 
                    onChange={e => handleUpdateTask(node.id, 'assigned_role_id', e.target.value)}
                    title="Seleccionar perfil asignado"
                  >
                    <option value="">Ningún Perfil</option>
                    {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <ChevronDown size={12} className="role-select-icon" />
                </div>
                <div className="predecessor-select-wrapper">
                  <select 
                    className="role-select predecessor-select" 
                    disabled={readOnly}
                    value={node.predecessor_id || ''} 
                    onChange={e => handleUpdateTask(node.id, 'predecessor_id', e.target.value || null)}
                    title="Tarea previa (Dependencia)"
                  >
                    <option value="">Sin Dependencia</option>
                    {getValidPredecessors(node.id).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.task_name.substring(0, 20)}{t.task_name.length > 20 ? '...' : ''}</option>
                    ))}
                  </select>
                  <LinkIcon size={12} className="role-select-icon" />
                </div>
                {/* Progreso (%) removido del estimador por solicitud del usuario */}
                <button 
                  className={`icon-btn tiny ${editingDetailsId === node.id ? 'active-accent' : ''}`}
                  title="Añadir descripción" 
                  onClick={(e) => { e.stopPropagation(); setEditingDetailsId(editingDetailsId === node.id ? null : node.id); }}
                >
                  <AlignLeft size={14} />
                </button>
              </div>
            ) : (
              <div className="task-hours gap-3">
                <span title="Costo Parcial (Calculado)" className="flex align-center gap-1">
                  <DollarSign size={12}/> {node.totalCost.toLocaleString('en-US')}
                </span>
                <span title="Horas (Calculadas)" className="flex align-center gap-1">
                  <Clock size={12}/> {node.totalHours}h
                </span>
                <button 
                  className={`icon-btn tiny ${editingDetailsId === node.id ? 'active-accent' : ''}`}
                  title="Añadir descripción" 
                  onClick={(e) => { e.stopPropagation(); setEditingDetailsId(editingDetailsId === node.id ? null : node.id); }}
                >
                  <AlignLeft size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {editingDetailsId === node.id && (
          <div className="task-details-panel" style={{ '--depth': depth } as React.CSSProperties}>
            <textarea 
              placeholder="Descripción opcional de cómo se ejecutará esta tarea..."
              readOnly={readOnly}
              value={node.description || ''}
              onChange={e => handleUpdateTask(node.id, 'description', e.target.value)}
              rows={2}
            />
          </div>
        )}

        {addingTaskTo === node.id && !readOnly && (
          <div className="add-task-inline" style={{ '--depth': depth + 1 } as React.CSSProperties}>
            <input 
              autoFocus
              type="text" 
              placeholder="Nueva subtarea..." 
              value={newTaskName} 
              onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateTask(node.id);
                if (e.key === 'Escape') setAddingTaskTo(null);
              }}
              onBlur={() => handleCreateTask(node.id)}
              className="text-input"
            />
          </div>
        )}

        {isExpanded && hasChildren && (
          <div className="task-children">
            {node.children.map((child: any) => renderTaskNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="task-tree-container">
      {rootTasks.map(root => renderTaskNode(root, 0))}

      <div className="add-root-task">
        {addingTaskTo === 'root' ? (
          <div className="add-task-inline">
            <input 
              autoFocus
              type="text" 
              placeholder="Nombre de la nueva fase principal..." 
              value={newTaskName} 
              onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateTask(null);
                if (e.key === 'Escape') setAddingTaskTo(null);
              }}
              onBlur={() => handleCreateTask(null)}
            />
          </div>
        ) : (
          <button className="text-button new-root-btn" onClick={() => setAddingTaskTo('root')}>
            <Plus size={16} /> Añadir Fase Principal
          </button>
        )}
      </div>

      <style>{`
        .task-tree-container {
          margin-top: 10px;
        }
        .task-node {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          padding-left: calc(var(--depth, 0) * 32px + 12px);
          border-bottom: 1px solid rgba(91, 192, 190, 0.1);
          transition: background 0.2s;
          position: relative;
        }
        .task-node:hover {
          background: rgba(28, 37, 65, 0.6);
        }
        
        /* Tree lines for hierarchy */
        .task-node.depth-1::before,
        .task-node.depth-2::before,
        .task-node.depth-3::before {
          content: '';
          position: absolute;
          left: calc(var(--depth, 0) * 32px - 16px);
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(72, 229, 194, 0.2);
        }

        .task-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-grow: 1;
        }
        .task-name-input {
          background: transparent;
          border: none;
          color: white;
          font-weight: 500;
          font-size: 1rem;
          padding: 4px;
          width: 100%;
          outline: none;
          border-bottom: 1px solid transparent;
          transition: all 0.2s;
        }
        .task-name-input:focus {
          border-bottom-color: var(--color-accent-mint);
          background: rgba(255,255,255,0.05);
        }
        .task-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .task-hours {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--color-accent-mint);
          font-family: monospace;
          background: rgba(72, 229, 194, 0.1);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
        }
        .task-actions-v4 {
          display: flex;
          gap: 4px;
          margin-left: 8px;
        }
        .action-btn-v4 {
          background: transparent;
          border: none;
          color: var(--color-text-secondary);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        .action-btn-v4:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }
        .action-btn-v4.delete:hover { color: #ff6b6b; }
        .add-task-inline {
          padding: 8px 10px;
          padding-left: calc(var(--depth, 0) * 32px + 24px);
        }
        .add-task-inline input {
          padding: 6px 12px;
          font-size: 0.9rem;
          background: var(--color-bg-primary);
        }
        .new-root-btn {
          margin-top: 20px;
          color: var(--color-text-secondary);
        }
        .new-root-btn:hover {
          color: var(--color-accent-mint);
        }
        .task-leaf-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hours-input {
          width: 60px;
          padding: 2px 5px;
          text-align: right;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--color-accent-mint);
          font-family: monospace;
          border-radius: var(--radius-sm);
        }
        .premium-select-v4 {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: var(--color-text-secondary);
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 140px;
          outline: none;
        }
        .premium-select-v4:hover, .premium-select-v4:focus {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--color-accent-mint);
          color: var(--color-text-primary);
        }
        .predecessor-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .progress-input-wrapper {
          display: flex;
          align-items: center;
          background: rgba(72, 229, 194, 0.1);
          border-radius: var(--radius-sm);
          padding: 2px 4px;
          border: 1px solid rgba(72, 229, 194, 0.2);
        }
        .progress-input-mini {
          width: 35px;
          background: transparent;
          border: none;
          color: var(--color-accent-mint);
          font-family: monospace;
          font-size: 0.8rem;
          text-align: right;
          outline: none;
          padding: 0;
        }
        .progress-input-mini::-webkit-inner-spin-button { display: none; }
        .progress-input-wrapper .unit {
          font-size: 0.7rem;
          color: var(--color-accent-mint);
          opacity: 0.7;
          margin-left: 1px;
        }
        .task-details-panel {
          padding: 10px 10px 10px 0;
          margin-left: calc(var(--depth, 0) * 32px + 32px);
        }
        .task-details-panel textarea {
          width: 100%;
          background: rgba(0,0,0,0.15);
          border: 1px dashed rgba(72, 229, 194, 0.3);
          border-radius: var(--radius-sm);
          padding: 8px;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          resize: vertical;
        }
        .active-accent {
          color: var(--color-accent-mint);
          background: rgba(72, 229, 194, 0.1);
        }
        .spacer-node { width: 24px; }
      `}</style>
    </div>
  );
}
