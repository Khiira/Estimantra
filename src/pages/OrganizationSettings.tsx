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
    <div className="container settings-container-limited">
      <header className="settings-header-row">
        <Link href="/">
          <button className="icon-btn outline" title="Volver al Dashboard">
            <ArrowLeft size={20} />
          </button>
        </Link>
        <div className="settings-title-group">
          <div className="settings-title-group">
            {isEditingName ? (
              <div className="flex gap-2 align-center">
                <input 
                  id="orgNameInput"
                  title="Nuevo nombre de la organización"
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  autoFocus 
                  className="settings-input-edit"
                />
                <button 
                  className="primary icon-btn" 
                  onClick={handleUpdateName} 
                  disabled={actionLoading}
                  title="Guardar nuevo nombre"
                >
                  <Save size={16} />
                </button>
                <button 
                  className="outline icon-btn" 
                  onClick={() => setIsEditingName(false)}
                  title="Cancelar edición"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <h2 className="margin-0 flex align-center gap-2">
                <Building size={24} color="var(--color-accent-mint)"/> 
                {activeOrganization.name}
                {isAdmin && (
                  <button 
                    className="text-button" 
                    onClick={() => { setEditName(activeOrganization.name); setIsEditingName(true); }}
                    title="Editar nombre de la organización"
                  >
                    <Edit3 size={16} />
                  </button>
                )}
              </h2>
            )}
          </div>
          <p className="settings-id-badge">
            ID: {activeOrganization.id}
          </p>
        </div>
      </header>

      {isAdmin && (
        <section className="settings-panel animate-fade-in settings-admin-notice">
          <h3 className="margin-0 flex align-center gap-2">
            <Settings size={18} /> Ajustes de Administración
          </h3>
          <p className="settings-subtitle-muted margin-0">
            Tienes control total sobre este espacio de trabajo.
          </p>
        </section>
      )}

      <section className="settings-panel animate-fade-in">
        <div className="settings-panel-header">
          <h3><Users size={18} /> Miembros del Equipo</h3>
          <button className="primary" onClick={handleGenerateInvite} title="Generar enlace de invitación">
            <Mail size={16} /> Generar Invitación Mágica
          </button>
        </div>

        {inviteToken && (
          <div className="invite-token-card">
            <p>Comparte este enlace de un solo uso con tu colega:</p>
            <div className="flex gap-2">
              <input 
                id="inviteLinkInput"
                title="Enlace de invitación" 
                placeholder="Enlace de invitación" 
                type="text" 
                readOnly 
                value={`${window.location.origin}/invite?token=${inviteToken}`} 
                className="flex-1 font-mono" 
              />
              <button className="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite?token=${inviteToken}`)} title="Copiar enlace al portapapeles">Copiar</button>
            </div>
          </div>
        )}

        <div className="access-code-display-card">
          <p className="access-code-label">Código de Acceso del Equipo</p>
          <div className="flex align-center justify-center gap-3">
            <span className="access-code-text">
              {activeOrganization.join_code || '---'}
            </span>
            <button 
                className="outline" 
                onClick={() => navigator.clipboard.writeText(activeOrganization.join_code)}
                title="Copiar código del equipo"
            >
              Copiar Código
            </button>
          </div>
          <p className="settings-id-badge" style={{ marginTop: '10px' }}>
            Los nuevos miembros pueden unirse ingresando este código al iniciar sesión.
          </p>
        </div>
        
        {loading ? (
          <div className="flex flex-column gap-2">
             <div className="skeleton radius-md" style={{ height: '76px' }}></div>
             <div className="skeleton radius-md" style={{ height: '76px' }}></div>
          </div>
        ) : (
          <div className="members-list">
            {members.length === 0 ? (
              <p className="empty-msg text-muted">No hay otros miembros.</p>
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

      <section className="settings-panel animate-fade-in">
        <div className="settings-panel-header">
          <h3><Building size={18} /> Mis Espacios de Trabajo</h3>
          <button className="outline" onClick={() => setShowCreateForm(!showCreateForm)} title="Ver formulario de creación">
            + Nueva Organización
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateOrganization} className="flex gap-2 bg-tertiary padding-20 radius-md margin-bottom-20">
            <input 
                id="newOrgInput"
                title="Nombre de la nueva organización" 
                type="text" 
                placeholder="Nombre (Ej: Agencia Sur)" 
                value={newOrgName} 
                onChange={e => setNewOrgName(e.target.value)} 
                required 
                className="flex-1" 
                autoFocus 
            />
            <button type="submit" className="primary" title="Crear y entrar a la nueva organización">Crear y Entrar</button>
          </form>
        )}

        <div className="members-list">
          {myOrganizations.map(org => (
            <div key={org.id} className={`member-card ${activeOrganization?.id === org.id ? 'bg-mint-soft' : ''}`}>
              <div className="member-info">
                <h4>
                  {org.name} 
                  {activeOrganization?.id === org.id && <span className="badge margin-left-10">Actual</span>}
                </h4>
                <p className="font-size-sm">ID: {org.id}</p>
              </div>
              <div className="member-actions">
                {activeOrganization?.id !== org.id && (
                  <button className="primary text-button" onClick={() => setActiveOrganization(org)} title={`Cambiar a ${org.name}`}>
                    Entrar aquí
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className="settings-panel animate-fade-in danger-zone-card">
          <h3 className="danger-zone-title">
            <Trash2 size={18} /> Zona de Peligro
          </h3>
          <p className="settings-subtitle-muted margin-bottom-20">
            Eliminar esta organización borrará permanentemente todos sus proyectos y datos asociados. Esta acción no se puede deshacer.
          </p>
          
          <div className="form-group margin-bottom-20">
            <label htmlFor="confirmDeleteName" className="font-size-sm">
                Escribe <strong>{activeOrganization.name}</strong> para confirmar
            </label>
            <input 
              id="confirmDeleteName"
              type="text" 
              placeholder="Confirmar nombre" 
              title="Confirmar eliminación escribiendo el nombre de la organización"
              value={confirmDeleteName} 
              onChange={e => setConfirmDeleteName(e.target.value)} 
              className="danger-confirm-input"
              style={{ borderColor: confirmDeleteName === activeOrganization.name ? 'var(--color-danger)' : '' }}
            />
          </div>

          <button 
            className="danger auth-button-large" 
            disabled={confirmDeleteName !== activeOrganization.name || actionLoading}
            onClick={handleDeleteOrganization}
            title="Eliminar organización permanentemente"
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
