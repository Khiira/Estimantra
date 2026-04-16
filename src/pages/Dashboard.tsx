import { useEffect, useState } from 'react';
import { useSession } from '../auth/SessionContext';
import { insforge } from '../lib/insforge';
import { Link, useLocation } from 'wouter';
import { FileText, Plus, FolderPlus, Building } from 'lucide-react';

export default function Dashboard() {
  const { user, activeOrganization, setActiveOrganization, myOrganizations } = useSession();
  const [, setLocation] = useLocation();

  // Estados de carga
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // Proyectos y data de form
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  
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
    const inviteToken = localStorage.getItem('estimantra_invite');
    if (inviteToken && user) {
      processInvite(inviteToken);
    } else if (activeOrganization) {
      loadDashboardData();
    }
  }, [activeOrganization, user]);

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
    setLoadingProjects(true);
    // Cargar Proyectos con info de Cliente si existe
    const { data: projData } = await insforge.database
      .from('projects')
      .select('*, clients(name)')
      .eq('org_id', activeOrganization.id) // <- Solo los de la organizacion activa
      .order('created_at', { ascending: false });
    
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

    // 1. Crear Org indicando el ID manualmente para no depender del SELECT
    const { error: orgErr } = await insforge.database
      .from('organizations')
      .insert([{ id: newOrgId, name: newOrgName }]);

    if (orgErr) { alert('Error creando la organización: ' + orgErr.message); return; }

    // 2. Insertarse a sí mismo como admin
    const { error: memErr } = await insforge.database
      .from('organization_members')
      .insert([{ org_id: newOrgId, user_id: user.id, role: 'admin' }]);
      
    if (memErr) { alert('Error uniendo usuario a la org: ' + memErr.message); return; }

    setActiveOrganization({ id: newOrgId, name: newOrgName });
    // Reload causes session context to refetch all myOrganizations
    window.location.reload();
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrganization) return;

    let clientId = null;
    
    // Si se escribió un nombre de cliente que no existe, lo creamos dinámicamente
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

    if (error) {
      alert(`Error al crear proyecto: ${error.message}`);
      return;
    }

    setShowModal(false);
    setLocation(`/project/${data.id}`);
  };

  // PANTALLA SETUP: Si no hay organización, fuerza a crearla
  if (processingInvite) {
    return (
      <div className="container flex-column-center-vh">
        <h2>Autenticando Invitación Mágica...</h2>
        <p>Uniéndote a la organización colaborativa de manera segura.</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="container flex-column-center-vh">
        <div className="auth-box auth-box-danger">
          <h2 className="error-title">Error con la Invitación</h2>
          <p>{inviteError}</p>
          <button className="primary" onClick={() => { setInviteError(null); loadDashboardData(); }}>Volver al Panel</button>
        </div>
      </div>
    );
  }

  if (!activeOrganization && !loadingProjects) {
    return (
      <div className="container flex-column-center-vh">
        <div className="auth-box">
          <Building size={48} color="var(--color-accent-mint)" className="setup-icon" />
          <h2 className="setup-title">Inicia tu Espacio de Trabajo</h2>
          <p className="setup-subtitle">Estimantra ahora es colaborativo. Crea la organización compartida para tu agencia o equipo antes de comenzar.</p>
          
          <form onSubmit={handleCreateOrganization} className="setup-form">
            <input type="text" placeholder="Nombre de la Agencia (Ej: Diseño Acme)" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} required autoFocus />
            <button type="submit" className="primary">Crear Organización</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container dashboard-container">
      <header className="dashboard-header animate-fade-in">
        <div>
          <div className="header-title-row">
            <h2 className="title-gradient dashboard-title">Estimaciones</h2>
            {myOrganizations && myOrganizations.length > 1 ? (
              <select title="Organización"
                className="org-select"
                value={activeOrganization?.id || ''} 
                onChange={(e) => setActiveOrganization(myOrganizations.find(o => o.id === e.target.value))}
              >
                {myOrganizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            ) : (
              <span className="active-org-name">- {activeOrganization?.name}</span>
            )}
          </div>
          <p className="header-subtitle">Organiza integralmente a tus clientes y presupuestos.</p>
        </div>
        <div className="header-actions">
          <Link href="/organization">
            <button className="outline"><Building size={18} className="btn-icon" /> Organización</button>
          </Link>
          <button className="primary" onClick={() => setShowModal(true)}>
            <Plus size={18} /> Nuevo Proyecto
          </button>
        </div>
      </header>

      <section className="projects-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {loadingProjects ? (
          <>
            <div className="skeleton skeleton-card"></div>
            <div className="skeleton skeleton-card"></div>
            <div className="skeleton skeleton-card"></div>
          </>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <FolderPlus size={48} />
            <h3>La organización no tiene proyectos</h3>
            <p>Comienza creando tu primera estimación de proyecto.</p>
          </div>
        ) : (
          projects.map(p => {
             const client = clients.find(c => c.id === p.client_id);
             return (
               <Link href={`/project/${p.id}`} key={p.id}>
                 <div className="project-card">
                   <div className="card-header">
                     <FileText size={24} className="card-icon" />
                     {p.category && <span className="category-badge">{p.category}</span>}
                   </div>
                   <h3>{p.name}</h3>
                   {client && <p className="client-text">Cliente: {client.name}</p>}
                   <p className="card-date">Modificado: {new Date(p.updated_at).toLocaleDateString()}</p>
                 </div>
               </Link>
             );
          })
        )}
      </section>

      {/* Modal Crear Estimación */}
      {showModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-box">
            <h3>Nueva Estimación</h3>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Nombre del Proyecto</label>
                <input type="text" required autoFocus value={projName} onChange={e => setProjName(e.target.value)} placeholder="Ej. Rediseño App Mobile" />
              </div>
              <div className="form-group">
                <label>Categoría (Opcional)</label>
                <input type="text" value={projCategory} onChange={e => setProjCategory(e.target.value)} placeholder="Ej. Desarrollo, Marketing, SEO..." />
              </div>
              <div className="form-group">
                <label>Cliente (Opcional)</label>
                <input type="text" value={projClientName} onChange={e => setProjClientName(e.target.value)} placeholder="Nombre del cliente o empresa" list="clients-list" />
                <datalist id="clients-list">
                  {clients.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label htmlFor="billing_mode">Régimen de Cobro</label>
                  <select id="billing_mode" title="Régimen de cobro" value={billingMode} onChange={e => setBillingMode(e.target.value)} className="modal-select">
                    <option value="by_role">Detallado (Por Perfil)</option>
                    <option value="flat_rate">Tarifa Plana (Por Hora)</option>
                  </select>
                </div>
                {billingMode === 'flat_rate' && (
                  <div className="form-group flex-1">
                    <label htmlFor="flat_rate">Valor Hora General (UF)</label>
                    <input id="flat_rate" type="number" step="0.01" value={flatHourlyRate} onChange={e => setFlatHourlyRate(e.target.value)} placeholder="Ej: 1.5" required />
                  </div>
                )}
                <div className="form-group flex-1">
                  <label htmlFor="hours_per_day">Jornada (Horas/Día)</label>
                  <input id="hours_per_day" type="number" step="0.5" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} placeholder="8" required />
                </div>
              </div>
              
              <div className="modal-actions-container">
                <button type="button" className="outline w-full" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="primary w-full">Continuar a Detalles</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
        }
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 80px 20px;
          background: rgba(28, 37, 65, 0.4);
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text-secondary);
        }
        .project-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 24px;
          cursor: pointer;
          transition: all 0.2s ease;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .project-card:hover {
          transform: translateY(-4px);
          border-color: var(--color-accent-mint);
          box-shadow: 0 4px 20px rgba(72, 229, 194, 0.1);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .card-icon {
          color: var(--color-accent-mint);
        }
        .category-badge {
          background: rgba(72,229,194,0.15);
          color: var(--color-accent-mint);
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }
        .project-card h3 { margin: 0 0 10px 0; font-weight: 500; font-size: 1.1rem; }
        .project-card p { margin: 0; color: var(--color-text-secondary); font-size: 0.9rem; }
        .client-text { margin-bottom: auto !important; font-style: italic; }
        .card-date { margin-top: auto !important; font-size: 0.8rem !important; opacity: 0.7; padding-top: 15px; }

        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(11, 19, 43, 0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-box {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 30px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: var(--color-text-secondary);
          font-size: 0.9rem;
        }
        
        /* New Classes from Refactor */
        .dashboard-container { padding: 40px 20px; }
        .error-title { color: var(--color-danger); }
        .setup-icon { margin-bottom: 20px; }
        .setup-title { margin: 0 0 10px; }
        .setup-subtitle { color: var(--color-text-secondary); margin-bottom: 30px; }
        .setup-form { display: flex; flexDirection: column; gap: 15px; }
        .header-title-row { display: flex; align-items: center; gap: 15px; }
        .dashboard-title { margin: 0; }
        .org-select { padding: 4px 10px; border-radius: var(--radius-sm); background: var(--color-bg-tertiary); color: white; border: 1px solid var(--color-border); }
        .active-org-name { font-size: 1.2rem; color: var(--color-text-secondary); }
        .header-subtitle { margin-top: 10px; }
        .header-actions { display: flex; gap: 15px; }
        .btn-icon { margin-right: 8px; }
        .form-row { display: flex; gap: 15px; margin-top: 15px; }
        .flex-1 { flex: 1; }
        .modal-select { width: 100%; padding: 10px; border-radius: 4px; background: var(--color-bg-primary); color: white; border: 1px solid var(--color-border); }
        .modal-actions-container { display: flex; gap: 10px; marginTop: 20px; }
        .w-full { width: 100%; }
      `}</style>
    </div>
  );
}
