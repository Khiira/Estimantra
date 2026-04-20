import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { insforge } from '../lib/insforge';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import { Link } from 'wouter';
import TaskTree from '../components/TaskTree';
import ProposalBuilder from '../components/ProposalBuilder';
import { useSession } from '../auth/SessionContext';

export default function ProjectEstimator() {
  const [, params] = useRoute('/project/:id');
  const projectId = params?.id || '';
  const { user } = useSession();
  
  const [project, setProject] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allVersions, setAllVersions] = useState<string[]>(['1.0']);
  const [selectedVersion, setSelectedVersion] = useState('1.0');
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [isVersioning, setIsVersioning] = useState(false);
  const [grandTotals, setGrandTotals] = useState({ hours: 0, cost: 0 });
  
  const [activeTab, setActiveTab] = useState<'estimator' | 'proposal'>('estimator');
  
  // Real-time & Locking
  const [editorUser, setEditorUser] = useState<{ id: string, name: string } | null>(null);
  const [lockTimeout, setLockTimeout] = useState<any>(null);

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCost, setNewRoleCost] = useState('');
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editorUser) return; // Locked
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
    let realtimeCleanup: (() => void) | undefined;

    if (projectId) {
      loadWorkspace();
      setupProjectRealtime().then(cleanup => {
        realtimeCleanup = cleanup;
      });
    }
    
    return () => {
      if (realtimeCleanup) realtimeCleanup();
      if (projectId) {
        insforge.realtime.unsubscribe(`project:${projectId}`);
      }
    };
  }, [projectId, selectedVersion]);

  const setupProjectRealtime = async () => {
    if (!projectId) return;
    
    await insforge.realtime.connect();
    await insforge.realtime.subscribe(`project:${projectId}`);
    
    // Heartbeat de presencia (avisar que estoy editando)
    const sendPresence = () => {
      insforge.realtime.publish(`project:${projectId}`, 'presence:editing', {
        name: user?.full_name || user?.email || 'Compañero'
      });
    };

    // Aviso inmediato al entrar
    sendPresence();

    const heartbeat = setInterval(sendPresence, 2000);

    const handleDataChange = () => {
      loadWorkspace(); // Recargar datos al recibir notificación
    };

    const handleWhoIsHere = (payload: any) => {
      if (payload.meta.senderId === user?.id) return;
      // Si alguien pregunta quién está, y yo estoy aquí, respondo inmediatamente
      sendPresence();
    };
    
    const handlePresence = (payload: any) => {
      if (payload.meta.senderId === user?.id) return;
      
      setEditorUser({ id: payload.meta.senderId, name: payload.name });
      
      // Limpiar el aviso si no recibimos heartbeat en 10s
      setEditorUser(prev => {
        if (lockTimeout) clearTimeout(lockTimeout);
        const timeout = setTimeout(() => {
           setEditorUser(null);
        }, 5000); // Expiración más rápida si no hay heartbeat
        setLockTimeout(timeout);
        return prev;
      });
    };

    insforge.realtime.on('presence:editing', handlePresence);
    insforge.realtime.on('presence:who_is_here', handleWhoIsHere);

    insforge.realtime.on('UPDATE_tasks', handleDataChange);
    insforge.realtime.on('INSERT_tasks', handleDataChange);
    insforge.realtime.on('DELETE_tasks', handleDataChange);
    insforge.realtime.on('UPDATE_project_roles', handleDataChange);
    insforge.realtime.on('INSERT_project_roles', handleDataChange);
    insforge.realtime.on('DELETE_project_roles', handleDataChange);

    // Preguntar quién está al entrar para bloqueo instantáneo
    insforge.realtime.publish(`project:${projectId}`, 'presence:who_is_here', {});

    return () => {
      clearInterval(heartbeat);
      insforge.realtime.off('presence:editing', handlePresence);
      insforge.realtime.off('presence:who_is_here', handleWhoIsHere);
      insforge.realtime.off('UPDATE_tasks', handleDataChange);
      insforge.realtime.off('INSERT_tasks', handleDataChange);
      insforge.realtime.off('DELETE_tasks', handleDataChange);
      insforge.realtime.off('UPDATE_project_roles', handleDataChange);
      insforge.realtime.off('INSERT_project_roles', handleDataChange);
      insforge.realtime.off('DELETE_project_roles', handleDataChange);
      insforge.realtime.unsubscribe(`project:${projectId}`);
    };
  };

  // Effect 1 — show skeleton when version changes (after initial load)
  useEffect(() => {
    if (!loading && projectId) {
      setLoadingTasks(true);
      // Reset totals immediately so old version data doesn't linger
      setGrandTotals({ hours: 0, cost: 0 });
    }
  }, [selectedVersion]);

  // Effect 2 — recalculate grandTotals whenever tasks or roles update
  useEffect(() => {
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
      if (node.children.length === 0) {
        const h = Number(node.estimated_hours || 0);
        return { h, c: h * Number(role?.hourly_rate || 0) };
      }
      return node.children.reduce(
        (acc: { h: number; c: number }, child: any) => {
          const s = calcNode(child);
          return { h: acc.h + s.h, c: acc.c + s.c };
        },
        { h: 0, c: 0 }
      );
    };
    const total = roots.reduce(
      (acc, r) => { const s = calcNode(r); return { hours: acc.hours + s.h, cost: acc.cost + s.c }; },
      { hours: 0, cost: 0 }
    );
    setGrandTotals(total);
  }, [tasks, roles]);

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
      const sortedVersions = [...allVersions].sort((a, b) => {
        const [aMaj, aMin] = a.split('.').map(v => parseInt(v) || 0);
        const [bMaj, bMin] = b.split('.').map(v => parseInt(v) || 0);
        if (aMaj !== bMaj) return aMaj - bMaj;
        return (aMin || 0) - (bMin || 0);
      });

      const lastVersion = sortedVersions[sortedVersions.length - 1] || '1.0';
      const parts = lastVersion.split('.');
      let nextVersion = '1.1';
      
      if (parts.length >= 2) {
        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);
        nextVersion = `${major}.${minor + 1}`;
      } else if (parts.length === 1 && !isNaN(parseInt(parts[0]))) {
        nextVersion = `${parts[0]}.1`;
      }

      const { data: currentTasks, error: fetchErr } = await insforge.database
         .from('tasks')
         .select('*')
         .eq('project_id', projectId)
         .eq('version', selectedVersion);

      if (fetchErr) throw fetchErr;
      if (!currentTasks || currentTasks.length === 0) {
        alert("No hay tareas para clonar en esta versión.");
        setIsVersioning(false);
        return;
      }

      const idMap: Record<string, string> = {};
      const tasksToInsert = currentTasks.map(t => {
        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 12);
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

      const { error: insErr } = await insforge.database
        .from('tasks')
        .insert(finalTasks);

      if (insErr) throw insErr;

      setAllVersions(prev => [...prev, nextVersion]);
      setSelectedVersion(nextVersion);
      alert(`Versión ${nextVersion} creada exitosamente basada en v${selectedVersion}.`);
    } catch (err: any) {
      console.error('Error en versionado:', err);
      alert(`Error al crear versión: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsVersioning(false);
    }
  };

  if (loading) {
    return (
      <div className="estimator-workspace">
        <div className="breadcrumb-bar">
          <div className="title-area">
             <div className="skeleton skeleton-circle"></div>
             <div className="skeleton skeleton-text-lg"></div>
          </div>
          <div className="skeleton header-totals skeleton-header-totals"></div>
        </div>
        
        <div className="workspace-tabs">
           <div className="skeleton skeleton-text-md margin-top-10"></div>
           <div className="skeleton skeleton-text-md margin-top-10"></div>
        </div>

        <div className="workspace-grid loading-grid padding-top-30">
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
      {editorUser && (
        <div className="lock-banner animate-fade-in">
           <span>⚠️ El usuario <strong>{editorUser.name}</strong> está editando esta versión. Tus controles están deshabilitados temporalmente.</span>
        </div>
      )}
      
      <div className="breadcrumb-bar animate-fade-in">
        <div className="title-area">
          <Link href="/">
            <button className="icon-btn tooltip" title="Volver al inicio">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div className="estimator-header-title">
            <div>
              <h2 className="estimator-name">{project.name}</h2>
              <div className="project-meta">
                {project.category && <span className="category-tag">{project.category}</span>}
                {project.clients?.name && <span className="client-tag">{project.clients.name}</span>}
              </div>
            </div>

            <div className="version-selector-container">
               <select 
                 className="version-select"
                 value={selectedVersion}
                 onChange={(e) => setSelectedVersion(e.target.value)}
                 disabled={isVersioning || loadingTasks || !!editorUser}
                 title="Seleccionar versión"
               >
                 {allVersions.map(v => <option key={v} value={v}>v{v}</option>)}
               </select>
               <button 
                 className="accent-btn version-btn-small" 
                 onClick={handleCreateNewVersion}
                 disabled={isVersioning || !!editorUser}
                 title="Crear nueva versión"
               >
                 {isVersioning ? '...' : '+ Versión'}
               </button>
            </div>
          </div>
        </div>
        
        <div className="header-totals">
          <div className="total-item">
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
      </div>

      <div className="workspace-tabs animate-fade-in">
          <button className={`tab-btn ${activeTab === 'estimator' ? 'active' : ''}`} onClick={() => setActiveTab('estimator')}>Ingeniería (Matemática Automática)</button>
          <button className={`tab-btn ${activeTab === 'proposal' ? 'active' : ''}`} onClick={() => setActiveTab('proposal')}>Resumen de Presupuesto (Exportar)</button>
      </div>

      {activeTab === 'estimator' ? (
      <div className="workspace-grid padding-top-20">
        <aside className="roles-panel animate-fade-in">
          <div className="panel-header">
            <h3>Perfiles Técnicos</h3>
            {!editorUser && (
              <button className="icon-btn text-button" title="Añadir rol" onClick={() => setShowRoleForm(!showRoleForm)}>
                <Plus size={16}/>
              </button>
            )}
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
                   <div className="flex-1">
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
                readOnly={!!editorUser}
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
    </div>
  );
}
