import { useState, useEffect } from 'react';
import { useSession } from '../auth/SessionContext';
import { insforge } from '../lib/insforge';
import { 
  User, 
  Lock, 
  Trash2, 
  CreditCard, 
  Save, 
  AlertTriangle,
  Mail,
  CheckCircle2,
  Building,
  Plus,
  FolderPlus,
  ArrowLeft,
  Users,
  Settings,
  Copy
} from 'lucide-react';

export default function Profile() {
  const { user, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations } = useSession();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Estado de gestión de equipos
  const [teamPanel, setTeamPanel] = useState<null | 'selection' | 'create' | 'join'>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Modal de Detalles de Equipo
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

   // Estado de miembros del equipo
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || '');
      setEmail(user.email || '');
    }
    // Abrir panel de equipos si viene desde nav
    if (window.location.hash === '#teams') {
      setTeamPanel('selection');
    }
  }, [user]);

  // Manejar tiempo real para miembros cuando se abre un equipo
  useEffect(() => {
    let realtimeCleanup: (() => void) | undefined;

    if (showTeamModal && selectedTeam) {
      loadTeamMembers();
      setupTeamRealtime().then(cleanup => {
        realtimeCleanup = cleanup;
      });
    }

    return () => {
      if (realtimeCleanup) realtimeCleanup();
      if (selectedTeam) {
        insforge.realtime.unsubscribe(`org_members:${selectedTeam.id}`);
      }
    };
  }, [showTeamModal, selectedTeam]);

  const loadTeamMembers = async () => {
    if (!selectedTeam) return;
    try {
      // Nota: Necesitamos unir con la info de usuario si el SDK lo permite, 
      // o usar los campos que tengamos en organization_members
      const { data, error } = await insforge.database
        .from('organization_members')
        .select('*, user_metadata') // Asumiendo que user_metadata está accesible o es parte de la lógica del SDK
        .eq('org_id', selectedTeam.id);
      
      if (error) throw error;
      if (data) setMembers(data);
    } catch (err) {
      console.error('Error cargando miembros:', err);
    }
  };

  const setupTeamRealtime = async () => {
    if (!selectedTeam) return;
    
    await insforge.realtime.connect();
    // Suscribirse a cambios en los miembros de esta organización específica
    await insforge.realtime.subscribe(`org_members:${selectedTeam.id}`);
    
    const handleChange = () => loadTeamMembers();

    insforge.realtime.on('INSERT_organization_member', handleChange);
    insforge.realtime.on('UPDATE_organization_member', handleChange);
    insforge.realtime.on('DELETE_organization_member', handleChange);

    return () => {
      insforge.realtime.off('INSERT_organization_member', handleChange);
      insforge.realtime.off('UPDATE_organization_member', handleChange);
      insforge.realtime.off('DELETE_organization_member', handleChange);
    };
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopyStatus('code');
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const handleUpdateTeamName = async () => {
    if (!editName.trim() || !selectedTeam) return;
    setTeamLoading(true);
    try {
      const { error } = await insforge.database
        .from('organizations')
        .update({ name: editName })
        .eq('id', selectedTeam.id);
      
      if (error) throw error;
      
      // Actualizar estado local
      await loadOrganizations();
      setSelectedTeam({ ...selectedTeam, name: editName });
      setIsEditing(false);
      setMessage({ text: 'Nombre del equipo actualizado.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setTeamLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (deleteConfirmName !== selectedTeam?.name) return;
    
    // 1. Actualización Optimista: Cerrar modal y quitar de la vista inmediatamente
    const teamToRemoveId = selectedTeam.id;
    setShowTeamModal(false);
    setSelectedTeam(null);
    setDeleteConfirmName('');
    
    setDeleting(true);
    try {
      const { error } = await insforge.database
        .from('organizations')
        .delete()
        .eq('id', teamToRemoveId);
      
      if (error) throw error;
      
      // Pequeña pausa para asegurar consistencia en el backend antes de la sincronización final
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await loadOrganizations();
      
      // Si era la activa, limpiar
      if (activeOrganization?.id === teamToRemoveId) {
        setActiveOrganization(null);
      }
      
      setMessage({ text: `Equipo eliminado definitivamente.`, type: 'success' });
    } catch (err: any) {
      console.error('Delete error:', err);
      setMessage({ text: 'Error al eliminar el equipo. Por favor intenta de nuevo.', type: 'error' });
      // Sincronizar de nuevo para restaurar si falló
      await loadOrganizations();
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // 1. Actualizar Perfil (nombre y métadata)
      const { error: dbErr } = await insforge.auth.setProfile({
        name
      });
      
      if (dbErr) throw dbErr;

      setMessage({ text: 'Perfil actualizado con éxito.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al actualizar perfil.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ text: 'Las contraseñas no coinciden.', type: 'error' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      // Nota: Si updateUser no existe, usamos un flujo de reset
      setMessage({ text: 'Por seguridad, el cambio de contraseña requiere un token de verificación. Funcionalidad en desarrollo.', type: 'error' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al cambiar contraseña.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm('¿ESTÁS SEGURO? Esta acción es irreversible y perderás todos tus proyectos y organizaciones.');
    if (!confirmed) return;
    
    // Aquí normalmente llamarías a una función del backend o borrarías registros en cascada
    alert('Funcionalidad de borrado en desarrollo. Por favor contacta a soporte para dar de baja tu cuenta.');
  };

  return (
    <div className="profile-container animate-fade-in">
      <header style={{ marginBottom: '30px' }}>
        <h2 className="title-gradient">Mi Cuenta</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Administra tu información personal y seguridad.</p>
      </header>

      {message && (
        <div className={`message-box animate-fade-in`} style={{
          padding: '15px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '25px',
          background: message.type === 'success' ? 'rgba(72, 229, 194, 0.1)' : 'rgba(239, 71, 111, 0.1)',
          borderLeft: `4px solid ${message.type === 'success' ? 'var(--color-accent-mint)' : 'var(--color-danger)'}`,
          color: message.type === 'success' ? 'var(--color-accent-mint)' : '#ffb3c1',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      {/* Zona 1: Información General */}
      <section className="profile-section">
        <h3><User size={20} color="var(--color-accent-mint)" /> Información General</h3>
        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label>Nombre Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Tu nombre"
              required 
            />
          </div>
          <div className="info-box">
            <label><Mail size={12} style={{ marginRight: '4px' }} /> Correo Electrónico</label>
            <p>{email}</p>
            <small style={{ color: 'var(--color-text-muted)', marginTop: '5px', display: 'block' }}>
              El correo no se puede cambiar directamente para proteger tu seguridad.
            </small>
          </div>
          <button type="submit" className="primary" disabled={loading} style={{ marginTop: '10px' }}>
            <Save size={18} /> Guardar Cambios
          </button>
        </form>
      </section>

      {/* Zona 2: Seguridad */}
      <section className="profile-section">
        <h3><Lock size={20} color="var(--color-accent-mint)" /> Seguridad</h3>
        <form onSubmit={handleChangePassword}>
          <div className="profile-grid">
            <div className="form-group">
              <label>Nueva Contraseña</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Confirmar Contraseña</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>
          <button type="submit" className="outline" disabled={loading || !newPassword} style={{ marginTop: '10px' }}>
            Actualizar Contraseña
          </button>
        </form>
      </section>


      {/* Zona 3: Mis Equipos */}
      <section id="teams" className="profile-section">
        <h3><Users size={20} color="var(--color-accent-mint)" /> Mis Equipos</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Gestiona los equipos a los que perteneces o crea uno nuevo para colaborar.
        </p>

        {/* Listado de Equipos Actuales */}
        {myOrganizations.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {myOrganizations.map(org => (
              <div key={org.id} style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid var(--color-border)', 
                borderRadius: '16px', 
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ padding: '8px', background: 'rgba(72,229,194,0.1)', borderRadius: '10px' }}>
                    <Building size={20} color="var(--color-accent-mint)" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '1.1rem' }}>{org.name}</strong>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: org.role === 'admin' ? 'var(--color-accent-mint)' : 'var(--color-text-secondary)',
                      background: org.role === 'admin' ? 'rgba(72,229,194,0.1)' : 'rgba(255,255,255,0.05)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      width: 'fit-content',
                      marginTop: '4px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {org.role === 'admin' ? 'Administrador' : 'Miembro'}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    className="outline" 
                    onClick={() => { setSelectedTeam(org); setShowTeamModal(true); }}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Settings size={14} /> Gestionar
                  </button>
                  <button 
                    className="primary" 
                    onClick={() => setActiveOrganization(org)}
                    disabled={activeOrganization?.id === org.id}
                    style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                  >
                    {activeOrganization?.id === org.id ? 'Activo' : 'Entrar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {teamPanel === null && (
          <button 
            className="outline" 
            onClick={() => setTeamPanel('selection')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent-mint)', borderColor: 'var(--color-accent-mint)' }}
          >
            <Plus size={16} /> Unirme o Crear Nuevo Equipo
          </button>
        )}

        {teamPanel === 'selection' && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
            <button
              onClick={() => { setTeamPanel('create'); setTeamMessage(null); }}
              style={{ flex: '1', minWidth: '200px', padding: '20px', background: 'rgba(72,229,194,0.06)', border: '1px solid rgba(72,229,194,0.3)', borderRadius: '16px', cursor: 'pointer', textAlign: 'left', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <Users size={24} color="var(--color-accent-mint)" />
              <strong>Crear Equipo</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Funda un nuevo espacio de trabajo.</span>
            </button>
            <button
              onClick={() => { setTeamPanel('join'); setTeamMessage(null); }}
              style={{ flex: '1', minWidth: '200px', padding: '20px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: '16px', cursor: 'pointer', textAlign: 'left', color: 'white', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <FolderPlus size={24} color="var(--color-text-secondary)" />
              <strong>Unirme por Código</strong>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Ingresa el código de acceso del equipo.</span>
            </button>
            <button onClick={() => setTeamPanel(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', alignSelf: 'flex-start', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> Cancelar
            </button>
          </div>
        )}

        {(teamPanel === 'create' || teamPanel === 'join') && (
          <div style={{ marginTop: '8px', maxWidth: '400px' }}>
            <button onClick={() => { setTeamPanel('selection'); setTeamMessage(null); }} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
              <ArrowLeft size={14} /> Volver
            </button>

            {teamMessage && (
              <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', background: teamMessage.type === 'success' ? 'rgba(72,229,194,0.1)' : 'rgba(239,71,111,0.1)', borderLeft: `3px solid ${teamMessage.type === 'success' ? 'var(--color-accent-mint)' : 'var(--color-danger)'}`, color: teamMessage.type === 'success' ? 'var(--color-accent-mint)' : '#ffb3c1', fontSize: '0.9rem' }}>
                {teamMessage.text}
              </div>
            )}

            {teamPanel === 'create' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newOrgName.trim()) return;
                setTeamLoading(true);
                setTeamMessage(null);
                try {
                  const newOrgId = crypto.randomUUID();
                  const { error: orgErr } = await insforge.database.from('organizations').insert([{ id: newOrgId, name: newOrgName }]);
                  if (orgErr) throw new Error(orgErr.message);
                  const { error: memErr } = await insforge.database.from('organization_members').insert([{ org_id: newOrgId, user_id: user.id, role: 'admin' }]);
                  if (memErr) throw new Error(memErr.message);
                  
                  await loadOrganizations();
                  setTeamMessage({ text: `Equipo "${newOrgName}" creado con éxito.`, type: 'success' });
                  setNewOrgName('');
                  setTeamPanel(null);
                } catch (err: any) {
                  setTeamMessage({ text: err.message, type: 'error' });
                } finally {
                  setTeamLoading(false);
                }
              }}>
                <div className="form-group">
                  <label>Nombre del Equipo</label>
                  <input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Ej. Equipo de Diseño UX" required autoFocus />
                </div>
                <button type="submit" className="primary" disabled={teamLoading}>{teamLoading ? 'Creando...' : 'Crear Equipo'}</button>
              </form>
            )}

            {teamPanel === 'join' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!joinCode.trim()) return;
                setTeamLoading(true);
                setTeamMessage(null);
                try {
                  const { data: org, error: orgErr } = await insforge.database
                    .from('organizations')
                    .select('id, name')
                    .eq('join_code', joinCode.toUpperCase())
                    .single();
                  if (orgErr || !org) throw new Error('Código no válido o el equipo no existe.');
                  const { error: memErr } = await insforge.database
                    .from('organization_members')
                    .insert([{ org_id: org.id, user_id: user.id, role: 'member' }]);
                  if (memErr) throw new Error('Error al unirse: ' + memErr.message);
                  
                  await loadOrganizations();
                  setActiveOrganization(org);
                  setTeamMessage({ text: `Te has unido a "${org.name}".`, type: 'success' });
                  setJoinCode('');
                  setTeamPanel(null);
                } catch (err: any) {
                  setTeamMessage({ text: err.message, type: 'error' });
                } finally {
                  setTeamLoading(false);
                }
              }}>
                <div className="form-group">
                  <label>Código de Acceso</label>
                  <input 
                    type="text" 
                    value={joinCode} 
                    onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                    placeholder="ABC123XY"
                    required
                    maxLength={8}
                    autoFocus
                    style={{ textAlign: 'center', letterSpacing: '6px', fontWeight: 'bold', fontSize: '1.2rem' }}
                  />
                </div>
                <button type="submit" className="primary" disabled={teamLoading}>{teamLoading ? 'Verificando...' : 'Unirme al Equipo'}</button>
              </form>
            )}
          </div>
        )}
      </section>

      {/* Zona 4: Plan y Facturación (Placeholder) */}
      <section id="billing" className="profile-section">
        <h3><CreditCard size={20} color="var(--color-accent-mint)" /> Planes y Uso</h3>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
          <p style={{ margin: 0 }}>Plan Actual</p>
          <span className="plan-badge">GRATUITO (Early Access)</span>
          <p style={{ marginTop: '15px', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
            Pronto podrás suscribirte a planes Pro para proyectos ilimitados y mayor almacenamiento.
          </p>
          <button className="outline" disabled style={{ marginTop: '15px', opacity: 0.5 }}>Mejorar Plan (Próximamente)</button>
        </div>
      </section>

      {/* Zona 4: Danger Zone */}
      <section className="profile-section" style={{ borderColor: 'rgba(239, 71, 111, 0.3)' }}>
        <h3 style={{ color: 'var(--color-danger)' }}><Trash2 size={20} /> Zona de Peligro</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          Al eliminar tu cuenta, todos tus datos asociados serán borrados de forma permanente.
        </p>
        <button onClick={handleDeleteAccount} className="text-button" style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: '8px 16px', borderRadius: '4px', marginTop: '10px' }}>
          Eliminar mi cuenta definitivamente
        </button>
      </section>

      {/* Modal de Gestión de Equipo */}
      {showTeamModal && selectedTeam && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '520px' }}>
            <header className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ padding: '14px', background: 'rgba(72,229,194,0.1)', borderRadius: '16px' }}>
                  <Users size={28} color="var(--color-accent-mint)" />
                </div>
                <div style={{ flex: 1 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-accent-mint)', borderRadius: '8px', color: 'white', flex: 1 }}
                        autoFocus
                      />
                      <button className="primary" onClick={handleUpdateTeamName} disabled={teamLoading} style={{ padding: '8px 12px' }}>
                        {teamLoading ? '...' : <Save size={16} />}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.6rem' }}>{selectedTeam.name}</h3>
                      {selectedTeam.role === 'admin' && (
                        <button 
                          onClick={() => { setEditName(selectedTeam.name); setIsEditing(true); }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: '4px' }}
                        >
                          <Settings size={16} />
                        </button>
                      )}
                    </div>
                  )}
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>Configuración Administrativa</p>
                </div>
              </div>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Código de Invitación */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' }}>Código de Invitación</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <code style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '6px', color: 'var(--color-accent-mint)', fontFamily: 'monospace' }}>
                    {selectedTeam.join_code}
                  </code>
                  <button 
                    onClick={() => handleCopyCode(selectedTeam.join_code)}
                    style={{ background: 'rgba(72,229,194,0.1)', border: 'none', padding: '12px', borderRadius: '12px', color: 'var(--color-accent-mint)', cursor: 'pointer', transition: 'all 0.2s' }}
                    title="Copiar código"
                  >
                    {copyStatus === 'code' ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                  </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '12px', lineHeight: '1.5' }}>
                  Comparte este código único para que otros miembros se unan a tu equipo.
                </p>
              </div>

               {/* Lista de Miembros */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '20px', border: '1px solid var(--color-border)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <Users size={14} /> Miembros del Equipo ({members.length})
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                    {members.map((member: any) => (
                      <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', background: 'rgba(72,229,194,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-accent-mint)', display: 'flex', justifyContent: 'center' }}>
                            {member.user_metadata?.name?.[0] || 'U'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{member.user_metadata?.name || 'Usuario'}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{member.user_role === 'admin' ? 'Administrador' : 'Miembro'}</span>
                          </div>
                        </div>
                        {member.user_id === user.id && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(72,229,194,0.2)', color: 'var(--color-accent-mint)', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>TÚ</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              {/* Danger Zone */}
              {selectedTeam.role === 'admin' && (
                <div style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(239, 71, 111, 0.2)', background: 'rgba(239, 71, 111, 0.02)' }}>
                  <h4 style={{ color: 'var(--color-danger)', marginTop: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trash2 size={18} /> Zona de Peligro
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#ffb3c1', marginBottom: '20px' }}>
                    Al eliminar este equipo, se borrarán permanentemente todos los proyectos y datos asociados. Esta acción no se puede deshacer.
                  </p>
                  
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>Escribe <strong>{selectedTeam.name}</strong> para confirmar</label>
                    <input 
                      type="text" 
                      placeholder="Nombre del equipo"
                      value={deleteConfirmName}
                      onChange={e => setDeleteConfirmName(e.target.value)}
                      style={{ marginTop: '8px' }}
                    />
                  </div>

                  <button 
                    className="danger" 
                    disabled={deleteConfirmName !== selectedTeam.name || deleting}
                    onClick={handleDeleteTeam}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600, transition: 'all 0.3s' }}
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar Equipo Definitivamente'}
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: '30px' }}>
              <button 
                className="outline" 
                onClick={() => { setShowTeamModal(false); setIsEditing(false); setDeleteConfirmName(''); }}
                style={{ borderRadius: '12px', padding: '12px 24px', border: 'none' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
