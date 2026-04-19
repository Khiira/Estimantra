import { useEffect, useState, useMemo } from 'react';
import { useSession } from '../auth/SessionContext';
import { insforge } from '../lib/insforge';
import { Link, useLocation } from 'wouter';
import { FileText, Plus, FolderPlus, Building, RefreshCw, ArrowLeft, MoreVertical, Edit2, Trash } from 'lucide-react';

export default function Dashboard() {
  const { user, activeOrganization, setActiveOrganization } = useSession();
  const [, setLocation] = useLocation();
  const [onboardingMode, setOnboardingMode] = useState<'selection' | 'create' | 'join'>('selection');

  // Estado para menú de acciones en cards
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Estados de carga
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // Proyectos y data de form
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  
  // Filtros y Búsqueda
  const [filterClient, setFilterClient] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Obtener categorías únicas dinámicamente
  const uniqueCategories = useMemo(() => {
    const cats = projects
      .map(p => p.category)
      .filter((c): c is string => !!c && c.trim() !== '');
    return Array.from(new Set(cats)).sort();
  }, [projects]);

  // Formulario nuevo proyecto
  const [projName, setProjName] = useState('');
  const [projCategory, setProjCategory] = useState('');
  const [projClientName, setProjClientName] = useState('');
  const [billingMode, setBillingMode] = useState('by_role');
  const [flatHourlyRate, setFlatHourlyRate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('8');

  // Lógica de Invitaciones Mágicas
  const [processingInvite, setProcessingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    let realtimeCleanup: (() => void) | undefined;
    const inviteToken = localStorage.getItem('estimantra_invite');

    if (inviteToken && user) {
      processInvite(inviteToken);
    } else if (activeOrganization) {
      loadDashboardData();
      setupRealtime().then(cleanup => {
        realtimeCleanup = cleanup;
      });
    }
    
    return () => {
      if (realtimeCleanup) realtimeCleanup();
      if (!activeOrganization) {
        insforge.realtime.unsubscribe(`org:${activeOrganization?.id}`);
      }
    };
  }, [activeOrganization, user]);

  const setupRealtime = async () => {
    if (!activeOrganization) return;
    
    await insforge.realtime.connect();
    await insforge.realtime.subscribe(`org:${activeOrganization.id}`);
    
    // Escuchar cambios en la tabla de proyectos vía Realtime
    const handleProjectChange = () => {
      loadDashboardData(); // Recargar datos al recibir notificación
    };
    
    insforge.realtime.on('INSERT_project', handleProjectChange);
    insforge.realtime.on('UPDATE_project', handleProjectChange);
    insforge.realtime.on('DELETE_project', handleProjectChange);

    return () => {
      insforge.realtime.off('INSERT_project', handleProjectChange);
      insforge.realtime.off('UPDATE_project', handleProjectChange);
      insforge.realtime.off('DELETE_project', handleProjectChange);
    };
  };

  const processInvite = async (token: string) => {
    setProcessingInvite(true);
    try {
      // 1. Buscar la invitación
      const { data: invite, error: qErr } = await insforge.database
        .from('organization_invitations')
        .select('*')
        .eq('token', token)
        .single();
      
      if (qErr || !invite) throw new Error('El enlace de invitación no es válido o ha expirado.');
      if (invite.status !== 'pending') throw new Error('Esta invitación ya fue utilizada.');

      // 2. Comprobar si el usuario ya esta en la organizacion
      const { data: existing } = await insforge.database
        .from('organization_members')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('org_id', invite.org_id);
        
      if (!existing || existing.length === 0) {
        // 3. Unirse a la organizacion como miembro
        const { error: insErr } = await insforge.database
          .from('organization_members')
          .insert([{ org_id: invite.org_id, user_id: user.id, role: 'member' }]);
          
        if (insErr) throw new Error('No se pudo unir a la organización: ' + insErr.message);
      }

      // 4. Inutilizar la invitación (quemarla de un solo uso)
      await insforge.database
        .from('organization_invitations')
        .update({ status: 'used' })
        .eq('token', token);

      localStorage.removeItem('estimantra_invite');
      window.location.reload(); // Recargar para que SessionContext capte la nueva Organizacion

    } catch (err: any) {
      console.error(err);
      setInviteError(err.message);
      localStorage.removeItem('estimantra_invite');
    } finally {
      setProcessingInvite(false);
    }
  };

  const loadDashboardData = async () => {
    if (!activeOrganization) return;
    setLoadingProjects(true);
    // Cargar Proyectos con info de Cliente si existe
    const { data: projData } = await insforge.database
      .from('projects')
      .select('*, clients(name)')
      .eq('org_id', activeOrganization.id);
    
    // Cargar clientes
    const { data: cliData } = await insforge.database
      .from('clients')
      .select('*')
      .eq('org_id', activeOrganization.id);
      
    if (projData) setProjects(projData);
    if (cliData) setClients(cliData);
    setLoadingProjects(false);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const newOrgId = crypto.randomUUID();
    const { error: orgErr } = await insforge.database
      .from('organizations')
      .insert([{ id: newOrgId, name: newOrgName }]);
    if (orgErr) { alert('Error creando la organización: ' + orgErr.message); return; }
    const { error: memErr } = await insforge.database
      .from('organization_members')
      .insert([{ org_id: newOrgId, user_id: user.id, role: 'admin' }]);
    if (memErr) { alert('Error uniendo usuario a la org: ' + memErr.message); return; }
    setActiveOrganization({ id: newOrgId, name: newOrgName });
    window.location.reload();
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization) return;
    let clientId = null;
    if (projClientName.trim()) {
      const existingClient = clients.find(c => c.name.toLowerCase() === projClientName.toLowerCase());
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient } = await insforge.database
          .from('clients')
          .insert([{ org_id: activeOrganization.id, name: projClientName }])
          .select()
          .single();
        if (newClient) clientId = newClient.id;
      }
    }
    if (editingProject) {
      const { error } = await insforge.database
        .from('projects')
        .update({ 
          name: projName, 
          category: projCategory || null,
          client_id: clientId,
          hours_per_day: Number(hoursPerDay) || 8
        })
        .eq('id', editingProject.id);
      if (error) { alert(`Error al actualizar proyecto: ${error.message}`); return; }
    } else {
      const { data, error } = await insforge.database
        .from('projects')
        .insert([{ 
          org_id: activeOrganization.id,
          name: projName, 
          category: projCategory || null,
          client_id: clientId,
          billing_mode: billingMode,
          flat_hourly_rate: flatHourlyRate ? Number(flatHourlyRate) : 0,
          hours_per_day: Number(hoursPerDay) || 8
        }])
        .select()
        .single();
      if (error) { alert(`Error al crear proyecto: ${error.message}`); return; }
      setLocation(`/project/${data.id}`);
    }
    setShowModal(false);
    setEditingProject(null);
    loadDashboardData();
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta estimación? Se borrarán todas las tareas y versiones asociadas.')) return;
    const { error } = await insforge.database.from('projects').delete().eq('id', id);
    if (error) { alert('Error al eliminar: ' + error.message); } else { setProjects(projects.filter(p => p.id !== id)); }
  };

  const openEditModal = (project?: any) => {
    if (project && project.id) {
      // Editar proyecto existente
      setEditingProject(project);
      setProjName(project.name || '');
      setProjCategory(project.category || '');
      setProjClientName(project.clients?.name || '');
      setBillingMode(project.billing_mode || 'by_role');
      setFlatHourlyRate(project.flat_hourly_rate?.toString() || '');
      setHoursPerDay(project.hours_per_day?.toString() || '8');
    } else {
      // Nuevo proyecto — limpiar formulario
      setEditingProject(null);
      setProjName('');
      setProjCategory('');
      setProjClientName('');
      setBillingMode('by_role');
      setFlatHourlyRate('');
      setHoursPerDay('8');
    }
    setShowModal(true);
  };

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (filterClient !== 'all') result = result.filter(p => p.client_id === filterClient);
    if (filterCategory !== 'all') result = result.filter(p => p.category === filterCategory);
    
    result.sort((a, b) => {
      const dateA = new Date(a.updated_at).getTime();
      const dateB = new Date(b.updated_at).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [projects, filterClient, filterCategory, sortBy]);

  // Lógica de Unión por Código
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { data: org, error: orgErr } = await insforge.database
        .from('organizations')
        .select('id, name')
        .eq('join_code', joinCode.toUpperCase())
        .single();

      if (orgErr || !org) throw new Error('El código no es válido o la organización ya no existe.');

      const { error: memErr } = await insforge.database
        .from('organization_members')
        .insert([{ org_id: org.id, user_id: user.id, role: 'member' }]);

      if (memErr) throw new Error('Error al unirse: ' + memErr.message);

      setActiveOrganization(org);
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setJoining(false);
    }
  };

  // PANTALLA SETUP: Si no hay organización, fuerza a crearla o unirse
  if (processingInvite) {
    return (
      <div className="container flex-column-center-vh">
        <div className="onboarding-card animate-pulse">
          <RefreshCw size={48} className="animate-spin" color="var(--color-accent-mint)" />
          <h2 style={{ marginTop: '20px' }}>Validando invitación...</h2>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="container flex-column-center-vh">
        <div className="auth-box auth-box-danger animate-fade-in">
          <h2 className="error-title">Error de Invitación</h2>
          <p>{inviteError}</p>
          <button className="primary" onClick={() => { setInviteError(null); loadDashboardData(); }}>Ir al Panel</button>
        </div>
      </div>
    );
  }

  if (!activeOrganization && !loadingProjects) {
    return (
      <div className="container flex-column-center-vh">
        {onboardingMode === 'selection' && (
          <div className="onboarding-selection animate-fade-in">
            <header className="onboarding-header">
              <h1 className="title-gradient" style={{ fontSize: '2.8rem', marginBottom: '10px' }}>Bienvenido a Estimantra</h1>
              <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)' }}>Elige cómo quieres empezar a colaborar hoy.</p>
            </header>
            
            <div className="onboarding-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '24px', 
              width: '100%',
              justifyContent: 'center',
              maxWidth: '900px'
            }}>
              <div className="onboarding-option-card" onClick={() => setOnboardingMode('create')} style={{ padding: '35px 30px' }}>
                <div className="option-icon" style={{ width: '60px', height: '60px' }}>
                  <Building size={28} />
                </div>
                <h3>Crear Equipo</h3>
                <p>Crea un nuevo espacio de trabajo profesional para centralizar tus proyectos y equipo.</p>
                <div className="option-footer" style={{ marginTop: 'auto', fontWeight: 'bold', color: 'var(--color-accent-mint)', background: 'transparent', border: 'none', padding: 0 }}>Crear ahora →</div>
              </div>

              <div className="onboarding-option-card" onClick={() => setOnboardingMode('join')}>
                <div className="option-icon" style={{ color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.05)' }}>
                  <FolderPlus size={32} />
                </div>
                <h3>Unirme a Equipo</h3>
                <p>¿Tienes un código de invitación? Ingrésalo para sumarte a un espacio existente.</p>
                <div className="option-footer" style={{ marginTop: 'auto', fontWeight: 'bold', color: 'var(--color-text-secondary)', background: 'transparent', border: 'none', padding: 0 }}>Ingresar código →</div>
              </div>
            </div>
            
            {activeOrganization && (
              <button 
                onClick={() => setLocation('/')} 
                style={{ marginTop: '50px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer' }}
              >
                Volver al Panel Actual
              </button>
            )}
          </div>
        )}

        {onboardingMode === 'create' && (
          <div className="auth-box animate-fade-in" style={{ maxWidth: '480px', padding: '50px' }}>
            <button className="back-link" onClick={() => setOnboardingMode('selection')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Volver
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                <div className="option-icon" style={{ width: '80px', height: '80px' }}><Building size={40} /></div>
            </div>
            <h2 className="setup-title" style={{ fontSize: '2rem', textAlign: 'center' }}>Nuevo Equipo</h2>
            <p className="setup-subtitle" style={{ textAlign: 'center', marginBottom: '40px', color: 'var(--color-text-secondary)' }}>Define el nombre representativo de tu equipo o empresa.</p>
            <form onSubmit={handleCreateOrganization} className="setup-form">
              <input 
                type="text" 
                placeholder="Nombre del equipo" 
                value={newOrgName} 
                onChange={e => setNewOrgName(e.target.value)} 
                required 
                autoFocus 
                style={{ background: 'rgba(0,0,0,0.2)', padding: '18px 24px', borderRadius: '14px', fontSize: '1.1rem' }}
              />
              <button type="submit" className="primary" style={{ padding: '18px', fontSize: '1.1rem', marginTop: '20px' }}>Crear Equipo</button>
            </form>
          </div>
        )}

        {onboardingMode === 'join' && (
          <div className="auth-box animate-fade-in" style={{ maxWidth: '480px', padding: '50px' }}>
            <button className="back-link" onClick={() => setOnboardingMode('selection')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowLeft size={16} /> Volver
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                <div className="option-icon" style={{ width: '80px', height: '80px', color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.05)' }}><FolderPlus size={40} /></div>
            </div>
            <h2 className="setup-title" style={{ fontSize: '2rem', textAlign: 'center' }}>Unirse a Equipo</h2>
            <p className="setup-subtitle" style={{ textAlign: 'center', marginBottom: '40px', color: 'var(--color-text-secondary)' }}>Ingresa el código de 8 dígitos proporcionado por tu administrador.</p>
            <form onSubmit={handleJoinByCode} className="setup-form">
              <input 
                type="text" 
                placeholder="Código de acceso" 
                value={joinCode} 
                onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                required 
                maxLength={8}
                autoFocus 
                style={{ 
                    background: 'rgba(0,0,0,0.2)', padding: '18px', borderRadius: '14px', fontSize: '1.5rem',
                    textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold'
                }}
              />
              <button type="submit" className="primary" disabled={joining} style={{ padding: '18px', fontSize: '1.1rem', marginTop: '20px' }}>
                {joining ? 'Validando...' : 'Entrar al Equipo'}
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container dashboard-container">
      <div className="dashboard-toolbar animate-fade-in">
        <div className="toolbar-info">
          <h2 className="title-gradient">Mis Proyectos</h2>
          <p>Gestiona tus presupuestos y clientes en un solo lugar.</p>
        </div>
        <button className="primary" onClick={() => openEditModal()}>
          <Plus size={18} /> Nueva Estimación
        </button>
      </div>

      <div className="filter-bar animate-fade-in">
        <div className="filters-group">
          <select 
            value={filterClient} 
            onChange={e => setFilterClient(e.target.value)}
            className="select-pill"
          >
            <option value="all">Clientes (Todos)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="filters-group">
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="select-pill"
          >
            <option value="all">Categorías (Todas)</option>
            {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div className="filters-group">
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="select-pill"
          >
            <option value="newest">Recientes</option>
            <option value="oldest">Antiguos</option>
          </select>
        </div>
      </div>

      <section className="projects-grid">
        {loadingProjects ? (
          Array(3).fill(0).map((_, i) => <div key={i} className="skeleton-project" />)
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state animate-fade-in" style={{ gridColumn: '1 / -1' }}>
            <FolderPlus size={64} opacity={0.3} />
            <h3>Sin proyectos activos</h3>
            <p>Tu equipo aún no tiene estimaciones. ¡Crea la primera!</p>
            <button className="outline" onClick={() => openEditModal()}>Empezar ahora</button>
          </div>
        ) : (
          filteredProjects.map(p => {
             return (
               <div key={p.id} className="project-wrapper animate-fade-in">
                 <Link href={`/project/${p.id}`}>
                    <div className="project-tile" onClick={() => setActiveMenuId(null)}>
                      <div className="tile-top">
                        <div className="tile-top-left">
                          <div className="tile-icon">
                            <FileText size={22} />
                          </div>
                          <div className="tile-title-premium">{p.name}</div>
                        </div>

                        <div className="tile-actions">
                          <button 
                            className="menu-dots-btn" 
                            onClick={(e) => { 
                              e.preventDefault(); 
                              e.stopPropagation(); 
                              setActiveMenuId(activeMenuId === p.id ? null : p.id); 
                            }}
                          >
                            <MoreVertical size={20} />
                          </button>

                          {activeMenuId === p.id && (
                            <div className="action-dropdown" onClick={e => e.stopPropagation()}>
                              <button className="menu-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenuId(null); openEditModal(p); }}>
                                <Edit2 size={14} /> Editar
                              </button>
                              <button className="menu-item delete" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenuId(null); handleDeleteProject(p.id); }}>
                                <Trash size={14} /> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="tile-category-pill">{p.category || 'GENERAL'}</div>
                      
                      <div className="tile-client">
                        <Building size={14} /> {p.clients?.name || 'Cliente Particular'}
                      </div>

                      <div className="tile-footer">
                        <div className="tile-date">Actividad: {new Date(p.updated_at).toLocaleDateString()}</div>
                        <div className="tile-arrow">Ver →</div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
          })
        )}
      </section>

      {/* Modal Reestilizado */}
      {showModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-zoom-in">
            <header className="modal-header">
              <h3>{editingProject ? 'Editar Proyecto' : 'Nueva Estimación'}</h3>
              <p>Completa los detalles fundamentales del presupuesto.</p>
            </header>
            
            <form onSubmit={handleCreateProject} className="modal-form">
              <div className="form-group">
                <label>Nombre del Proyecto</label>
                <input type="text" required autoFocus value={projName} onChange={e => setProjName(e.target.value)} placeholder="Ej. Rediseño App Mobile" />
              </div>
              
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Categoría</label>
                  <input type="text" value={projCategory} onChange={e => setProjCategory(e.target.value)} placeholder="Ej. UX/UI" />
                </div>
                <div className="form-group flex-1">
                  <label>Cliente</label>
                  <input type="text" value={projClientName} onChange={e => setProjClientName(e.target.value)} placeholder="Empresa o Persona" list="clients-list" />
                </div>
              </div>

              {!editingProject && (
                <div className="form-group">
                  <label>Esquema de Cobro</label>
                  <div className="radio-group">
                    <label className={`radio-card ${billingMode === 'by_role' ? 'active' : ''}`}>
                      <input type="radio" value="by_role" checked={billingMode === 'by_role'} onChange={() => setBillingMode('by_role')} />
                      <span>Detallado (Cargos)</span>
                    </label>
                    <label className={`radio-card ${billingMode === 'flat_rate' ? 'active' : ''}`}>
                      <input type="radio" value="flat_rate" checked={billingMode === 'flat_rate'} onChange={() => setBillingMode('flat_rate')} />
                      <span>Tarifa Plana</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group flex-1" style={{ display: billingMode === 'flat_rate' ? 'flex' : 'none', flexDirection: 'column' }}>
                  <label>Valor Hora (UF)</label>
                  <input type="number" step="0.01" value={flatHourlyRate} onChange={e => setFlatHourlyRate(e.target.value)} placeholder="1.5" required={billingMode === 'flat_rate'} />
                </div>
                <div className="form-group flex-1">
                  <label>Jornada (h/día)</label>
                  <input type="number" step="0.5" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} placeholder="8" required />
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="text-button" onClick={() => { setShowModal(false); setEditingProject(null); }}>Cancelar</button>
                <button type="submit" className="primary" style={{ padding: '12px 30px' }}>
                  {editingProject ? 'Guardar Cambios' : 'Iniciar Estimación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <datalist id="clients-list">
        {clients.map(c => <option key={c.id} value={c.name} />)}
      </datalist>

      <style>{`
        .dashboard-container { padding: 50px 40px; }
        .dashboard-toolbar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; }

        /* ── Filter bar ── */
        .filter-bar { 
          display: flex; gap: 10px; align-items: center; margin-bottom: 40px;
          background: rgba(255,255,255,0.03); padding: 8px; border-radius: 60px;
          border: 1px solid var(--color-border);
          box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        }
        .filters-group { display: flex; gap: 8px; align-items: center; padding: 0 8px; }

        /* Custom selects */
        /* ── Projects grid ── */
        .projects-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
          gap: 24px; 
          width: 100%;
        }

        /* ── Project card ── */
        .project-wrapper { position: relative; }
        .project-tile {
          background: linear-gradient(145deg, rgba(22, 32, 60, 0.9), rgba(16, 24, 48, 0.95));
          border-radius: 20px;
          padding: 28px 28px 24px;
          border: 1px solid rgba(255,255,255,0.07);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          height: 100%;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          text-decoration: none;
        }
        /* Accent bar on left */
        .project-tile::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, var(--color-accent-mint), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .project-tile:hover::before { opacity: 1; }
        .project-tile:hover {
          transform: translateY(-8px);
          border-color: rgba(72,229,194,0.4);
          box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(72,229,194,0.1);
          background: linear-gradient(145deg, rgba(28, 40, 75, 0.95), rgba(18, 28, 55, 0.98));
        }

        .tile-top { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 24px; 
          width: 100%;
          position: relative;
        }

        .tile-top-left { display: flex; align-items: center; gap: 12px; }
        
        .tile-icon { 
          width: 44px; height: 44px;
          background: rgba(72, 229, 194, 0.1);
          color: var(--color-accent-mint);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid rgba(72,229,194,0.15);
        }

        .tile-title-premium {
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
          line-height: 1.2;
          letter-spacing: -0.5px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }

        .tile-category-pill {
          display: inline-flex;
          align-items: center;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--color-accent-mint);
          background: rgba(72, 229, 194, 0.08);
          border: 1px solid rgba(72, 229, 194, 0.2);
          padding: 4px 10px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        /* ── Action Menu (3-dots) ── */
        .tile-actions { 
          position: relative;
          z-index: 100;
        }
        .menu-dots-btn {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.4);
          padding: 8px;
          cursor: pointer;
          border-radius: 50%;
          transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .menu-dots-btn:hover {
          background: rgba(255,255,255,0.05);
          color: var(--color-accent-mint);
        }

        .action-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          background: #1c2541;
          border: 1px solid var(--color-border);
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          width: 140px;
          overflow: hidden;
          animation: fadeIn 0.15s ease-out;
          z-index: 1000;
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          color: white;
          width: 100%;
          border: none;
          background: transparent;
          font-size: 0.85rem;
          cursor: pointer;
          transition: background 0.2s;
          justify-content: flex-start;
          text-align: left;
        }
        .menu-item:hover {
          background: rgba(255,255,255,0.05);
        }
        .menu-item.delete { color: #ef476f; }
        .menu-item.delete:hover { background: rgba(239, 71, 111, 0.1); }

        /* Client row */
        .tile-client {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.83rem;
          color: rgba(255,255,255,0.5);
          margin-bottom: auto;
          padding-bottom: 16px;
        }

        /* Footer */
        .tile-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding-top: 14px;
          margin-top: 14px;
        }
        .tile-date { font-size: 0.78rem; color: rgba(255,255,255,0.35); }
        .tile-arrow { 
          font-size: 0.85rem; 
          font-weight: 600;
          color: var(--color-accent-mint);
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          transform: translateX(-4px);
        }
        .project-tile:hover .tile-arrow { opacity: 1; transform: translateX(0); }

        /* ── Modal (Dejado vacío para usar clases globales de index.css) ── */
        .radio-group { display: flex; gap: 12px; margin-top: 10px; }
        .radio-card { 
          flex: 1; border: 1px solid var(--color-border); padding: 15px; border-radius: 12px; cursor: pointer;
          text-align: center; font-size: 0.9rem; transition: all 0.2s;
        }
        .radio-card input { display: none; }
        .radio-card.active { border-color: var(--color-accent-mint); background: rgba(72, 229, 194, 0.05); color: var(--color-accent-mint); font-weight: 600; }

        /* ── Onboarding cards ── */
        .onboarding-option-card {
          background: rgba(28, 37, 65, 0.4);
          backdrop-filter: blur(8px);
          padding: 45px 35px;
          border-radius: 32px;
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
        }
        .onboarding-option-card:hover {
          transform: translateY(-12px) scale(1.02);
          border-color: var(--color-accent-mint);
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 0 20px rgba(72, 229, 194, 0.1);
          background: rgba(30, 40, 70, 0.8);
        }
        .option-icon {
          width: 70px; height: 70px;
          background: linear-gradient(135deg, rgba(72, 229, 194, 0.15), rgba(72, 229, 194, 0.05));
          color: var(--color-accent-mint);
          border-radius: 20px;
          display: flex;
          align-items: center; justify-content: center;
          border: 1px solid rgba(72, 229, 194, 0.2);
        }

        /* ── Skeleton ── */
        .skeleton-project { height: 220px; background: rgba(22,32,60,0.6); border-radius: 20px; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 0.3; } 100% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}
