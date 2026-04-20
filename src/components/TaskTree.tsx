import { useState, useMemo, useRef, useEffect } from 'react';
import { insforge } from '../lib/insforge';
import { ChevronRight, ChevronDown, Plus, Trash2, Clock, AlignLeft, DollarSign } from 'lucide-react';

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
    }, 500);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (readOnly) return;
    if(!confirm("¿Eliminar tarea y todas sus subtareas?")) return;
    const { error } = await insforge.database.from('tasks').delete().eq('id', id);
    if (!error) {
      // Collect all descendant IDs recursively from the flat tasks array
      const collectDescendants = (parentId: string, allTasks: any[]): string[] => {
        const children = allTasks.filter((t: any) => t.parent_id === parentId);
        return children.reduce((acc: string[], child: any) => {
          return [...acc, child.id, ...collectDescendants(child.id, allTasks)];
        }, []);
      };
      const idsToRemove = new Set([id, ...collectDescendants(id, tasks)]);
      onTasksChange(tasks.filter((t: any) => !idsToRemove.has(t.id)));
    }
  };

  // 2. Renderizado Recursivo
  const renderTaskNode = (node: any, depth = 0) => {
    const isExpanded = expanded[node.id];
    const hasChildren = node.children && node.children.length > 0;
    // Si tiene hijos, no debe sumar horas directas propias en el UI sino el total
    // pero guardaremos horas propias en DB si es hoja

    return (
      <div key={node.id} className="task-node-wrapper">
        <div 
          className={`task-node depth-${depth} ${readOnly && !hasChildren ? 'opacity-60' : ''}`} 
          style={{ '--depth': depth } as React.CSSProperties}
        >
          
          <div className="task-left" onClick={() => toggleExpand(node.id)}>
            {hasChildren ? (
              <button className="icon-btn tiny">
                {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
              </button>
            ) : (
              <div className="spacer-node"></div> 
            )}
            <span className="task-name">{node.task_name}</span>
          </div>

          <div className="task-right">
            {!hasChildren ? (
              // Modo "Hoja": Controles directos para estimar
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
                <button 
                  className={`icon-btn tiny ${editingDetailsId === node.id ? 'active-accent' : ''}`}
                  title="Añadir descripción" 
                  onClick={(e) => { e.stopPropagation(); setEditingDetailsId(editingDetailsId === node.id ? null : node.id); }}
                >
                  <AlignLeft size={14} />
                </button>
              </div>
            ) : (
              // Modo "Rama": Muestra total heredado MÁS el botón de descripción
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

            {!readOnly && (
              <div className="task-actions">
                <button className="icon-btn tiny text-button" title="Añadir subtarea" onClick={(e) => { e.stopPropagation(); setAddingTaskTo(node.id); }}>
                  <Plus size={14} />
                </button>
                <button className="icon-btn tiny danger" title="Eliminar" onClick={(e) => handleDelete(e, node.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Panel Desplegable de Descripción Opcional (Ahora para todos) */}
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

    </div>
  );
}
