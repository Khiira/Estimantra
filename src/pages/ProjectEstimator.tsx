import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [grandTotals, setGrandTotals] = useState({ hours: 0, cost: 0 });
  
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
  }, [projectId]);

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
      
    // 3. Fetch Tasks
    const { data: taskData } = await insforge.database
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

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
          <div>
            <h2>{project.name}</h2>
            <div className="project-meta">
              {project.category && <span className="category-tag">{project.category}</span>}
              {project.clients?.name && <span className="client-tag">Cliente: {project.clients.name}</span>}
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
            <TaskTree 
              tasks={tasks} 
              roles={roles} 
              projectId={projectId} 
              onTasksChange={setTasks} 
              onTotalsChange={(h: number, c: number) => setGrandTotals({ hours: h, cost: c })}
            />
          </div>
        </main>
      </div>
      ) : (
        <div className="proposal-view-container">
             <ProposalBuilder project={project} tasks={tasks} roles={roles} grandTotals={grandTotals} />
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
        
        /* Paneles con diseño limpio (Zen) */
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
        
        .hint {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          margin-bottom: 20px;
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

        /* Classes from Refactor */
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
      `}</style>
    </div>
  );
}
