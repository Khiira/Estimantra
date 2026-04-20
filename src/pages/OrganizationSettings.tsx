import { useEffect, useState } from 'react';
import { useSession } from '../auth/SessionContext';
import { insforge } from '../lib/insforge';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Building, Users, Mail, Crown, Trash2, Edit3, Save, X, Settings } from 'lucide-react';

export default function OrganizationSettings() {
  const { user, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations } = useSession();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = activeOrganization?.role === 'admin';

  useEffect(() => {
    if (activeOrganization?.id) {
      loadMembers();
      
      const setupRealtime = async () => {
        try {
          await insforge.realtime.connect();
          await insforge.realtime.subscribe(`org:${activeOrganization.id}`);
        } catch (err) {
          console.error('Error conectando a tiempo real:', err);
        }
      };

      setupRealtime();
      
      const handleMemberChange = () => loadMembers();
      insforge.realtime.on('INSERT_organization_members', handleMemberChange);
      insforge.realtime.on('DELETE_organization_members', handleMemberChange);
      
      return () => {
        insforge.realtime.off('INSERT_organization_members', handleMemberChange);
        insforge.realtime.off('DELETE_organization_members', handleMemberChange);
      };
    }
  }, [activeOrganization]);

  const loadMembers = async () => {
    // Buscar los miembros uniendo la tabla intermedia con la tabla de perfiles (auth.users id)
    const { data } = await insforge.database
      .from('organization_members')
      .select('role, user_id, profiles(full_name, avatar_url)')
      .eq('org_id', activeOrganization.id);

    if (data) setMembers(data);
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (memberId === user.id) return;
    if (!confirm('¿Estás seguro de que deseas eliminar a este miembro del equipo?')) return;

    const { error } = await insforge.database
      .from('organization_members')
      .delete()
      .eq('org_id', activeOrganization.id)
      .eq('user_id', memberId);

    if (error) {
      alert('Error al eliminar miembro: ' + error.message);
    } else {
      loadMembers();
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    const { error } = await insforge.database
      .from('organization_members')
      .update({ role: newRole })
      .eq('org_id', activeOrganization.id)
      .eq('user_id', memberId);

    if (error) {
      alert('Error al actualizar rol: ' + error.message);
    } else {
      loadMembers();
    }
  };

  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const handleGenerateInvite = async () => {
    const { data, error } = await insforge.database
      .from('organization_invitations')
      .insert([{ org_id: activeOrganization.id }])
      .select('token')
      .single();

    if (data?.token) {
      setInviteToken(data.token);
    } else {
      alert('Error al generar enlace: ' + (error?.message || 'Error desconocido'));
    }
  };

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    const newOrgId = crypto.randomUUID();

    // 1. Crear Org indicando el ID manualmente
    const { error: orgErr } = await insforge.database
      .from('organizations')
      .insert([{ id: newOrgId, name: newOrgName }]);

    if (orgErr) { alert('Error creando la organización: ' + orgErr.message); return; }

    // 2. Insertarse a sí mismo como admin
    const { error: memErr } = await insforge.database
      .from('organization_members')
      .insert([{ org_id: newOrgId, user_id: user.id, role: 'admin' }]);
      
    if (memErr) { alert('Error uniendo usuario a la org: ' + memErr.message); return; }

    await loadOrganizations(); // Reload session context
    setActiveOrganization({ id: newOrgId, name: newOrgName });
    setShowCreateForm(false);
    setNewOrgName('');
  };

  const handleUpdateName = async () => {
    if (!editName.trim() || !activeOrganization) return;
    setActionLoading(true);
    try {
      const { error } = await insforge.database
        .from('organizations')
        .update({ name: editName })
        .eq('id', activeOrganization.id);
      
      if (error) throw error;
      
      await loadOrganizations();
      setIsEditingName(false);
    } catch (err: any) {
      alert('Error al actualizar nombre: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (confirmDeleteName !== activeOrganization?.name) return;
    setActionLoading(true);
    try {
      const { error } = await insforge.database
        .from('organizations')
        .delete()
        .eq('id', activeOrganization.id);
      
      if (error) throw error;
      
      await loadOrganizations();
      setActiveOrganization(null);
      setLocation('/');
    } catch (err: any) {
      alert('Error al eliminar organización: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeOrganization) {
    return <div className="container">Sin organización activa.</div>;
  }

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '800px' }}>
      <header className="flex" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <Link href="/">
          <button className="icon-btn outline" title="Volver al Dashboard">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isEditingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  title="Nuevo nombre"
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  autoFocus 
                  style={{ fontSize: '1.2rem', padding: '4px 12px' }}
                />
                <button className="primary icon-btn" onClick={handleUpdateName} disabled={actionLoading}>
                  <Save size={16} />
                </button>
                <button className="outline icon-btn" onClick={() => setIsEditingName(false)}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={24} color="var(--color-accent-mint)"/> 
                {activeOrganization.name}
                {isAdmin && (
                  <button 
                    className="text-button" 
                    onClick={() => { setEditName(activeOrganization.name); setIsEditingName(true); }}
                    style={{ padding: '4px', opacity: 0.6 }}
                  >
                    <Edit3 size={16} />
                  </button>
                )}
              </h2>
            )}
          </div>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            ID: {activeOrganization.id}
          </p>
        </div>
      </header>

      {isAdmin && (
        <section className="settings-panel animate-fade-in" style={{ animationDelay: '0.05s', marginBottom: '30px', borderLeft: '4px solid var(--color-accent-mint)' }}>
          <h3 style={{ marginTop: 0 }}><Settings size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Ajustes de Administración</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Tienes control total sobre este espacio de trabajo.
          </p>
        </section>
      )}

      <section className="settings-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3><Users size={18} style={{marginRight: '8px', verticalAlign: 'text-bottom'}}/> Miembros del Equipo</h3>
          <button className="primary" onClick={handleGenerateInvite}>
            <Mail size={16} /> Generar Invitación Mágica
          </button>
        </div>

        {inviteToken && (
          <div style={{ background: 'rgba(72,229,194,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--color-accent-mint)'}}>
            <p style={{marginTop: 0, color: 'var(--color-accent-mint)', fontSize: '0.9rem'}}>Comparte este enlace de un solo uso con tu colega:</p>
            <div style={{display: 'flex', gap: '10px'}}>
              <input title="Enlace de invitación" placeholder="Enlace de invitación" type="text" readOnly value={`${window.location.origin}/invite?token=${inviteToken}`} style={{flexGrow: 1, fontFamily: 'monospace'}} />
              <button className="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite?token=${inviteToken}`)}>Copiar</button>
            </div>
          </div>
        )}

        {/* Sección de Código de Acceso (Permanente) */}
        <div style={{ 
          background: 'rgba(28, 37, 65, 0.4)', 
          padding: '20px', 
          borderRadius: '16px', 
          marginTop: '25px',
          border: '1px dashed var(--color-border)',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Código de Acceso del Equipo
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <span style={{ 
              fontSize: '1.8rem', 
              fontWeight: '800', 
              color: 'var(--color-accent-mint)', 
              letterSpacing: '2px',
              fontFamily: 'monospace'
            }}>
              {activeOrganization.join_code || '---'}
            </span>
            <button className="outline" style={{ padding: '8px 12px', fontSize: '0.8rem' }} onClick={() => navigator.clipboard.writeText(activeOrganization.join_code)}>
              Copiar Código
            </button>
          </div>
          <p style={{ margin: '10px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Los nuevos miembros pueden unirse ingresando este código al iniciar sesión.
          </p>
        </div>
        
        {loading ? (
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
             <div className="skeleton" style={{height: '76px', width: '100%', borderRadius: 'var(--radius-md)'}}></div>
             <div className="skeleton" style={{height: '76px', width: '100%', borderRadius: 'var(--radius-md)'}}></div>
          </div>
        ) : (
          <div className="members-list">
            {members.length === 0 ? (
              <p className="empty-msg" style={{color: 'var(--color-text-muted)'}}>No hay otros miembros.</p>
            ) : (
              members.map((m) => (
                <div key={m.user_id} className="member-card">
                  <div className="avatar">
                    {m.profiles?.avatar_url ? (
                      <img src={m.profiles.avatar_url} alt="avatar" />
                    ) : (
                      <div className="avatar-placeholder">{m.profiles?.full_name?.charAt(0) || 'U'}</div>
                    )}
                  </div>
                  <div className="member-info">
                    <h4>{m.profiles?.full_name || 'Usuario Estimantra'} {m.user_id === user.id && <span className="badge">Tú</span>}</h4>
                    <p>{m.role === 'admin' ? <><Crown size={12} color="gold"/> Administrador</> : 'Miembro'}</p>
                  </div>
                  <div className="member-actions">
                    {m.user_id !== user.id && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="outline text-button" 
                          onClick={() => handleUpdateRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')}
                          title={m.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                        >
                          <Crown size={14} color={m.role === 'admin' ? 'gold' : 'var(--color-text-muted)'} />
                        </button>
                        <button 
                          className="outline text-button danger-hover" 
                          onClick={() => handleRemoveMember(m.user_id)}
                          title="Eliminar Miembro"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className="settings-panel animate-fade-in" style={{ animationDelay: '0.2s', marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3><Building size={18} style={{marginRight: '8px', verticalAlign: 'text-bottom'}}/> Mis Espacios de Trabajo</h3>
          <button className="outline" onClick={() => setShowCreateForm(!showCreateForm)}>
            + Nueva Organización
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateOrganization} style={{ background: 'var(--color-bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <input title="Nombre de la organización" type="text" placeholder="Nombre (Ej: Agencia Sur)" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} required style={{flexGrow: 1}} autoFocus />
            <button type="submit" className="primary">Crear y Entrar</button>
          </form>
        )}

        <div className="members-list">
          {myOrganizations.map(org => (
            <div key={org.id} className="member-card" style={{ background: activeOrganization?.id === org.id ? 'rgba(72,229,194,0.05)' : 'transparent' }}>
              <div className="member-info">
                <h4>
                  {org.name} 
                  {activeOrganization?.id === org.id && <span className="badge" style={{marginLeft: '10px'}}>Actual</span>}
                </h4>
                <p style={{fontSize: '0.8rem'}}>ID: {org.id}</p>
              </div>
              <div className="member-actions">
                {activeOrganization?.id !== org.id && (
                  <button className="primary text-button" onClick={() => setActiveOrganization(org)}>
                    Entrar aquí
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="settings-panel animate-fade-in danger-zone" style={{ animationDelay: '0.3s', marginTop: '40px', borderColor: 'rgba(239, 71, 111, 0.4)' }}>
          <h3 style={{ color: 'var(--color-danger)' }}><Trash2 size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Zona de Peligro</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '20px' }}>
            Eliminar esta organización borrará permanentemente todos sus proyectos y datos asociados. Esta acción no se puede deshacer.
          </p>
          
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '0.8rem' }}>Escribe <strong>{activeOrganization.name}</strong> para confirmar</label>
            <input 
              type="text" 
              placeholder="Confirmar nombre" 
              value={confirmDeleteName} 
              onChange={e => setConfirmDeleteName(e.target.value)} 
              style={{ borderColor: confirmDeleteName === activeOrganization.name ? 'var(--color-danger)' : 'var(--color-border)' }}
            />
          </div>

          <button 
            className="danger" 
            disabled={confirmDeleteName !== activeOrganization.name || actionLoading}
            onClick={handleDeleteOrganization}
            style={{ width: '100%', padding: '12px' }}
          >
            {actionLoading ? 'Eliminando...' : 'Eliminar Organización Definitivamente'}
          </button>
        </section>
      )}

      <style>{`
        .settings-panel {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 30px;
        }
        .member-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 15px;
          border-bottom: 1px solid var(--color-bg-tertiary);
        }
        .member-card:last-child {
          border-bottom: none;
        }
        .avatar {
          width: 45px; height: 45px;
          border-radius: 50%;
          background: rgba(72,229,194,0.1);
          color: var(--color-accent-mint);
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 1.2rem;
          font-weight: bold;
          overflow: hidden;
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .member-info h4 { margin: 0 0 5px 0; display: flex; align-items: center; gap: 8px;}
        .member-info p { margin: 0; font-size: 0.85rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 5px;}
        .badge { background: rgba(72,229,194,0.15); color: var(--color-accent-mint); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; }
        .member-actions { margin-left: auto; }
      `}</style>
    </div>
  );
}
