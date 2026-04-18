import { useState, useEffect, useMemo } from 'react';
import { useRoute } from 'wouter';
import { insforge } from '../lib/insforge';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { Link } from 'wouter';
import TaskTree from '../components/TaskTree';
import ProposalBuilder from '../components/ProposalBuilder';

export default function ProjectEstimator() {
  const [, params] = useRoute('/project/:id');
  const projectId = params?.id || '';
  
  const [project, setProject] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allVersions, setAllVersions] = useState<string[]>(['1.0']);
  const [selectedVersion, setSelectedVersion] = useState('1.0');
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isVersioning, setIsVersioning] = useState(false);
  // grandTotals calculated directly from tasks+roles so it updates
  // regardless of which tab is active (estimator or proposal).
  const grandTotals = useMemo(() => {
    const taskMap = new Map<string, any>();
    tasks.forEach((t: any) => taskMap.set(t.id, { ...t, children: [] }));
    const roots: any[] = [];
    tasks.forEach((t: any) => {
      if (t.parent_id && taskMap.has(t.parent_id)) {
        taskMap.get(t.parent_id).children.push(taskMap.get(t.id));
      } else {
        roots.push(taskMap.get(t.id));
      }
    });
    const calcNode = (node: any): { h: number; c: number } => {
      const role = roles.find((r: any) => r.id === node.assigned_role_id);
      if (!node.children || node.children.length === 0) {
        const h = Number(node.estimated_hours || 0);
        return { h, c: h * Number(role?.hourly_rate || 0) };
      }
      return node.children.reduce(
        (acc: { h: number; c: number }, child: any) => {
          const sub = calcNode(child);
          return { h: acc.h + sub.h, c: acc.c + sub.c };
        },
        { h: 0, c: 0 }
      );
    };
    const totals = roots.reduce(
      (acc, r) => { const t = calcNode(r); return { hours: acc.hours + t.h, cost: acc.cost + t.c }; },
      { hours: 0, cost: 0 }
    );
    return totals;
  }, [tasks, roles]);
  
  const [activeTab, setActiveTab] = useState<'estimator' | 'proposal'>('estimator');
  
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCost, setNewRoleCost] = useState('');
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    let finalName = newRoleName;
    if (selectedMemberId && selectedMemberId !== 'generic') {
       const member = orgMembers.find(m => m.id === selectedMemberId);
       if (member) {
           finalName = `${member.full_name || 'Miembro'} - ${newRoleName}`;
       }
    }

    const actualCost = project?.billing_mode === 'flat_rate' ? project.flat_hourly_rate : Number(newRoleCost) || 0;

    const { data, error } = await insforge.database
      .from('project_roles')
      .insert([{ project_id: projectId, name: finalName, hourly_rate: actualCost }])
      .select();

    if (error) { alert(`Error al crear rol: ${error.message}`); return; }
    if (data) setRoles([...roles, data[0]]);
    
    setShowRoleForm(false);
    setNewRoleName('');
    setNewRoleCost('');
    setSelectedMemberId('');
  };

  useEffect(() => {
    if (projectId) {
      loadWorkspace();
    }
  }, [projectId, selectedVersion]);

  // Separate effect: show task skeleton when version changes (after initial load)
  useEffect(() => {
    if (!loading && projectId) {
      setLoadingTasks(true);
    }
  }, [selectedVersion]);

  const loadWorkspace = async () => {
    // 1. Fetch Project
    const { data: projData } = await insforge.database
      .from('projects')
      .select('*, clients(name)')
      .eq('id', projectId)
      .single();
    
    // 2. Fetch Roles
    const { data: roleData } = await insforge.database
      .from('project_roles')
      .select('*')
      .eq('project_id', projectId);
      
    // 3. Fetch Tasks for selected version
    const { data: taskData } = await insforge.database
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('version', selectedVersion)
      .order('created_at', { ascending: true });

    // 3.1 Fetch All available versions for this project
    const { data: versionData } = await insforge.database
      .from('tasks')
      .select('version')
      .eq('project_id', projectId);
    
    if (versionData) {
      const uniqueVersions = Array.from(new Set(versionData.map((v: any) => v.version || '1.0'))).sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true }));
      setAllVersions(uniqueVersions.length > 0 ? uniqueVersions : ['1.0']);
    }

    // 4. Fetch Org Members
    let members: any[] = [];
    if (projData?.org_id) {
       const { data: orgMems } = await insforge.database
           .from('organization_members')
           .select('user_id')
           .eq('org_id', projData.org_id);
       
       if (orgMems && orgMems.length > 0) {
           const userIds = orgMems.map((m:any) => m.user_id);
           const { data: pData } = await insforge.database
               .from('profiles')
               .select('*')
               .in('id', userIds);
           members = pData || [];
       }
    }

    setProject(projData);
    setRoles(roleData || []);
    setTasks(taskData || []);
    setOrgMembers(members);
    setLoading(false);
    setLoadingTasks(false);
  };

  const handleCreateNewVersion = async () => {
    if (!confirm(`¿Deseas crear una nueva versión (instantánea) basada en la v${selectedVersion}?`)) return;
    
    setIsVersioning(true);
    try {
      // 1. Calcular nueva versión (ej: 1.0 -> 1.1)
      const lastVersion = allVersions[allVersions.length - 1] || '1.0';
      const parts = lastVersion.split('.');
      let nextVersion = '2.0';
      
      if (parts.length >= 2) {
        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);
        nextVersion = `${major}.${minor + 1}`;
      } else if (!isNaN(parseInt(lastVersion))) {
        nextVersion = `${parseInt(lastVersion) + 1}.0`;
      }

      // 2. Obtener tareas actuales para clonar
      const { data: currentTasks } = await insforge.database
         .from('tasks')
         .select('*')
         .eq('project_id', projectId)
         .eq('version', selectedVersion);

      if (!currentTasks || currentTasks.length === 0) {
        alert("No hay tareas para clonar en esta versión.");
        setIsVersioning(false);
        return;
      }

      // 3. Clonar manteniendo jerarquía
      const idMap: Record<string, string> = {};
      
      const tasksToInsert = currentTasks.map(t => {
        const newId = self.crypto.randomUUID();
        idMap[t.id] = newId;
        return {
          ...t,
          id: newId,
          version: nextVersion,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      const finalTasks = tasksToInsert.map(t => ({
        ...t,
        parent_id: t.parent_id ? (idMap[t.parent_id] || null) : null
      }));

      const { error } = await insforge.database
        .from('tasks')
        .insert(finalTasks);

      if (error) throw error;

      setAllVersions(prev => [...prev, nextVersion]);
      setSelectedVersion(nextVersion);
      alert(`Versión ${nextVersion} creada exitosamente.`);
    } catch (err: any) {
      console.error(err);
      alert(`Error al crear versión: ${err.message}`);
    } finally {
      setIsVersioning(false);
    }
  };

  if (loading) {
    return (
      <div className="estimator-workspace animate-fade-in">
        <header className="workspace-header">
           <div className="skeleton title-skeleton"></div>
           <div className="skeleton totals-skeleton"></div>
        </header>
        <div className="workspace-grid loading-grid">
           <aside className="skeleton roles-skeleton"></aside>
           <main className="skeleton tasks-skeleton"></main>
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="container">Proyecto no encontrado.</div>;
  }

  return (
    <div className="estimator-workspace">
      <header className="workspace-header">
        <div className="title-area">
          <Link href="/">
            <button className="icon-btn tooltip" title="Volver al inicio">
              <ArrowLeft size={20} />
            </button>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div>
              <h2>{project.name}</h2>
              <div className="project-meta">
                {project.category && <span className="category-tag">{project.category}</span>}
                {project.clients?.name && <span className="client-tag">Cliente: {project.clients.name}</span>}
              </div>
            </div>

            <div className="version-selector-container">
               <select 
                 className="version-select"
                 value={selectedVersion}
                 onChange={(e) => setSelectedVersion(e.target.value)}
                 disabled={isVersioning || loadingTasks}
                 title="Seleccionar versión de estimación"
               >
                 {allVersions.map(v => <option key={v} value={v}>v{v}</option>)}
               </select>
               <button 
                 className="icon-btn tiny accent-btn" 
                 onClick={handleCreateNewVersion}
                 disabled={isVersioning}
                 title="Crear nueva versión (+0.1)"
                 style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto', borderRadius: '4px', fontWeight: 600 }}
               >
                 {isVersioning ? '...' : '+ Versión'}
               </button>
            </div>
          </div>
        </div>
        
        <div className="header-totals">
          <div className="total-item">
            <p className="total-label">Jornada</p>
            <div className="jornada-control">
              <input 
                id="hours_per_day"
                type="number" 
                step="0.5" 
                value={project.hours_per_day || 8} 
                onChange={async (e) => {
                  const val = Number(e.target.value) || 8;
                  setProject({ ...project, hours_per_day: val });
                  await insforge.database.from('projects').update({ hours_per_day: val }).eq('id', project.id);
                }}
                className="jornada-input"
              />
              <label htmlFor="hours_per_day" className="jornada-suffix">h/día</label>
            </div>
          </div>
          <div className="total-item border-left">
            <p className="total-label">Días Totales</p>
            <h3 className="total-value highlight-text">
              {(grandTotals.hours / (project.hours_per_day || 8)).toFixed(1)}d
            </h3>
          </div>
          <div className="total-item border-left">
            <p className="total-label">Total Horas</p>
            <h3 className="total-value">{grandTotals.hours}h</h3>
          </div>
          <div className="total-item border-left">
            <p className="total-label">Costo Estimado</p>
            <h3 className="total-value highlight-text">
              UF {grandTotals.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
      </header>

      <div className="workspace-tabs animate-fade-in">
          <button className={`tab-btn ${activeTab === 'estimator' ? 'active' : ''}`} onClick={() => setActiveTab('estimator')}>Ingeniería (Matemática Automática)</button>
          <button className={`tab-btn ${activeTab === 'proposal' ? 'active' : ''}`} onClick={() => setActiveTab('proposal')}>Resumen de Presupuesto (Exportar)</button>
      </div>

      {activeTab === 'estimator' ? (
      <div className="workspace-grid">
        <aside className="roles-panel animate-fade-in">
          <div className="panel-header">
            <h3>Perfiles Técnicos</h3>
            <button className="icon-btn text-button" title="Añadir rol" onClick={() => setShowRoleForm(!showRoleForm)}>
              <Plus size={16}/>
            </button>
          </div>
          
          {showRoleForm && (
            <form className="role-form" onSubmit={handleCreateRole}>
              <div className="form-group">
                <label htmlFor="member_select">Vincular Miembro</label>
                <select 
                  id="member_select"
                  title="Miembro del proyecto"
                  className="block-input member-select" 
                  value={selectedMemberId} 
                  onChange={e => setSelectedMemberId(e.target.value)}
                >
                    <option value="">-- Perfil Genérico / Externo --</option>
                    {orgMembers.map(m => <option key={m.id} value={m.id}>{m.full_name || m.id.substring(0,8)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="role_name">Nombre del Perfil</label>
                <input 
                   id="role_name"
                   type="text" 
                   placeholder={selectedMemberId && selectedMemberId !== 'generic' ? "Rol en el proyecto (Ej. QA)" : "Nombre del Perfil (Ej. QA Genérico)"} 
                   value={newRoleName} 
                   onChange={e => setNewRoleName(e.target.value)} 
                   required 
                   autoFocus={!selectedMemberId} 
                />
              </div>
              <div className="role-form-actions">
                {project?.billing_mode === 'flat_rate' ? (
                   <input title="Costo general" placeholder="Costo" type="text" disabled value={`Tarifa Plana: ${project?.flat_hourly_rate} UF`} />
                ) : (
                   <div style={{flex: 1}}>
                     <label htmlFor="role_cost" className="sr-only">Costo / hora (UF)</label>
                     <input id="role_cost" title="Costo por hora" type="number" step="0.01" placeholder="Costo / hora (UF)" value={newRoleCost} onChange={e => setNewRoleCost(e.target.value)} required />
                   </div>
                )}
                <button title="Guardar rol" type="submit" className="primary action-btn"><Check size={16}/></button>
              </div>
            </form>
          )}

          <div className="roles-list">
            {roles.length === 0 && !showRoleForm ? <p className="empty-msg">No hay perfiles.</p> : (
              roles.map(r => (
                <div key={r.id} className="role-item">
                  <span className="color-dot" style={{background: r.color_hex || 'var(--color-accent-mint)'}}></span>
                  <span>{r.name}</span>
                  <span className="cost">{r.hourly_rate} UF/h</span>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Panel Principal: Árbol de Tareas */}
       <main className="tasks-panel animate-fade-in tasks-main">
          <div className="panel-header">
            <h3>Estimador (Tareas)</h3>
          </div>
          
          <div className="tasks-tree">
            {loadingTasks ? (
              <div className="tasks-skeleton-list" aria-label="Cargando tareas...">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="task-skeleton-row skeleton"
                    style={{ animationDelay: `${i * 0.07}s`, width: `${100 - i * 6}%` }}
                  />
                ))}
              </div>
            ) : (
              <TaskTree 
                tasks={tasks} 
                roles={roles} 
                projectId={projectId} 
                version={selectedVersion}
                onTasksChange={setTasks} 
              />
            )}
          </div>
        </main>
      </div>
      ) : (
        <div className="proposal-view-container">
             <ProposalBuilder project={project} tasks={tasks} grandTotals={grandTotals} />

        </div>
      )}

      <style>{`
        .estimator-workspace {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .workspace-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 40px;
          background: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }
        .title-area {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .title-area h2 { margin: 0; color: var(--color-accent-mint); }
        .title-area p { margin: 0; font-size: 0.9rem; color: var(--color-text-secondary); }
        .icon-btn.tooltip { background: transparent; border: none; padding: 8px; border-radius: 50%; display: flex;}
        .icon-btn.tooltip:hover { background: var(--color-bg-tertiary); color: var(--color-accent-mint); }
        
        .version-selector-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          padding: 4px 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          margin-left: 10px;
        }
        .version-select {
          background: transparent;
          border: none;
          color: var(--color-accent-mint);
          font-weight: 600;
          font-size: 0.9rem;
          outline: none;
          cursor: pointer;
        }
        .accent-btn {
          background: rgba(72, 229, 194, 0.1);
          color: var(--color-accent-mint);
          border: 1px solid var(--color-accent-mint);
          transition: all 0.2s;
        }
        .accent-btn:hover:not(:disabled) {
          background: var(--color-accent-mint);
          color: var(--color-bg-primary);
        }
        .accent-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--color-text-secondary);
            padding: 15px 20px;
            font-size: 1.05rem;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            border-radius: 0;
            transition: all 0.2s ease;
        }
        .tab-btn:hover { color: var(--color-text-primary); }
        .tab-btn.active {
            color: var(--color-accent-mint);
            border-bottom-color: var(--color-accent-mint);
        }

        .workspace-grid {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 20px;
          padding: 30px 40px;
          flex-grow: 1;
        }
        
        .roles-panel, .tasks-panel {
          background: rgba(28, 37, 65, 0.4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 24px;
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .panel-header h3 {
          margin: 0;
          font-weight: 500;
        }
        
        .empty-msg {
          font-size: 0.9rem;
          color: var(--color-text-muted);
          font-style: italic;
        }
        
        .role-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          margin-bottom: 8px;
        }
        .color-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .cost {
          margin-left: auto;
          color: var(--color-accent-mint);
          font-family: monospace;
        }

        .title-skeleton { width: 200px; height: 35px; }
        .totals-skeleton { width: 150px; height: 55px; }
        .loading-grid { gap: 20px; }
        .roles-skeleton { height: 60vh; border-radius: var(--radius-lg); }
        .tasks-skeleton { height: 80vh; border-radius: var(--radius-lg); }
        .project-meta { display: flex; gap: 10px; margin-top: 5px; margin-bottom: 5px; }
        .category-tag { font-size: 0.8rem; background: rgba(72,229,194,0.15); color: var(--color-accent-mint); padding: 2px 8px; border-radius: 12px; }
        .client-tag { font-size: 0.8rem; color: var(--color-text-secondary); font-style: italic; }
        .header-totals { display: flex; gap: 30px; text-align: right; background: var(--color-bg-secondary); padding: 15px 25px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); }
        .total-item { display: flex; flex-direction: column; }
        .total-label { margin: 0; fontSize: 0.85rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 1px; }
        .total-value { margin: 5px 0 0 0; fontSize: 1.5rem; fontWeight: 500; }
        .highlight-text { color: var(--color-accent-mint); }
        .border-left { padding-left: 30px; border-left: 1px solid var(--color-border); }
        .jornada-control { display: flex; align-items: center; gap: 5px; margin-top: 5px; }
        .jornada-input { width: 50px; background: var(--color-bg-primary); border: 1px solid var(--color-border); color: white; border-radius: 4px; text-align: center; padding: 2px; }
        .jornada-suffix { font-size: 0.8rem; color: var(--color-text-secondary); cursor: pointer; }
        .workspace-tabs { padding: 0 40px; display: flex; gap: 20px; border-bottom: 1px solid var(--color-border); background: var(--color-bg-secondary); }
        .member-select { background: var(--color-bg-primary); width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--color-border); color: var(--color-text-primary); }
        .role-form-actions { display: flex; gap: 5px; margin-top: 5px; }
        .action-btn { padding: 5px 10px; }
        .tasks-main { animation-delay: 0.1s; }
        .proposal-view-container { padding: 30px 40px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0; }

        /* ── Skeleton al cambiar versión ── */
        .tasks-skeleton-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px 0;
        }
        .task-skeleton-row {
          height: 38px;
          border-radius: var(--radius-md);
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--color-bg-tertiary) 25%,
            rgba(72,229,194,0.08) 50%,
            var(--color-bg-tertiary) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite, skeleton-pulse 1.4s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
