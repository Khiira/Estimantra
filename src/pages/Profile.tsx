import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
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
  Users,
  Settings
} from 'lucide-react';

export default function Profile() {
  const { user, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations } = useSession();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Modales de Equipos
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // 1. Actualizar Metadatos de Auth
      const { error: authErr } = await insforge.auth.setProfile({ name });
      if (authErr) throw authErr;

      // 2. Actualizar Tabla de Perfiles en Base de Datos (Columna full_name que usan los selectores)
      const { error: dbErr } = await insforge.database
        .from('profiles')
        .update({ full_name: name })
        .eq('id', user.id);

      if (dbErr) throw dbErr;

      setMessage({ text: 'Perfil actualizado con éxito en todo el sistema.', type: 'success' });
    } catch (err: any) {
      console.error('Error updating profile:', err);
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
      <header className="margin-bottom-30">
        <h2 className="title-gradient">Mi Cuenta</h2>
        <p className="text-secondary">Administra tu información personal y seguridad.</p>
      </header>

      {message && (
        <div className={`message-box animate-fade-in ${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      {/* Zona 1: Información General */}
      <section className="profile-section">
        <h3><User size={20} className="text-accent-mint" /> Información General</h3>
        <form onSubmit={handleUpdateProfile}>
          <div className="form-group">
            <label htmlFor="fullNameProfile">Nombre Completo</label>
            <input 
              id="fullNameProfile"
              title="Tu nombre completo"
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Tu nombre"
              required 
            />
          </div>
          <div className="info-box">
            <label><Mail size={12} className="margin-right-5" /> Correo Electrónico</label>
            <p>{email}</p>
            <small className="text-muted margin-top-5 block">
              El correo no se puede cambiar directamente para proteger tu seguridad.
            </small>
          </div>
          <button type="submit" className="primary margin-top-10" disabled={loading} title="Guardar cambios de perfil">
            <Save size={18} /> Guardar Cambios
          </button>
        </form>
      </section>

      {/* Zona 2: Seguridad */}
      <section className="profile-section">
        <h3><Lock size={20} className="text-accent-mint" /> Seguridad</h3>
        <form onSubmit={handleChangePassword}>
          <div className="profile-grid">
            <div className="form-group">
              <label htmlFor="newPassInput">Nueva Contraseña</label>
              <input 
                id="newPassInput"
                title="Nueva contraseña segura"
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirmPassInput">Confirmar Contraseña</label>
              <input 
                id="confirmPassInput"
                title="Confirma tu nueva contraseña"
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>
          <button type="submit" className="outline margin-top-10" disabled={loading || !newPassword} title="Cambiar contraseña de la cuenta">
            Actualizar Contraseña
          </button>
        </form>
      </section>


      {/* Zona 3: Mis Equipos */}
      <section id="teams" className="profile-section">
        <h3><Users size={20} className="text-accent-mint" /> Mis Equipos</h3>
        <p className="text-secondary font-size-sm margin-bottom-20">
          Gestiona los equipos a los que perteneces o crea uno nuevo para colaborar.
        </p>

        {/* Listado de Equipos Actuales */}
        {myOrganizations.length > 0 && (
          <div className="profile-info-grid margin-bottom-24">
            {myOrganizations.map(org => (
              <div key={org.id} className="org-card-premium">
                <div className="flex align-center gap-3">
                  <div className="bg-mint-soft padding-8 radius-md">
                    <Building size={20} color="var(--color-accent-mint)" />
                  </div>
                  <div className="flex flex-column">
                    <strong className="font-size-lg">{org.name}</strong>
                    <span className={`role-badge-pill ${org.role === 'admin' ? 'role-badge-admin' : 'role-badge-member'}`}>
                      {org.role === 'admin' ? 'Administrador' : 'Miembro'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 margin-top-5">
                  <button 
                    className="outline flex-1 padding-8 font-size-sm flex align-center justify-center gap-2" 
                    onClick={() => { setActiveOrganization(org); setLocation('/organization'); }}
                    title={`Gestionar ajustes de ${org.name}`}
                  >
                    <Settings size={14} /> Gestionar
                  </button>
                  <button 
                    className="primary flex-1 padding-8 font-size-sm" 
                    onClick={() => setActiveOrganization(org)}
                    disabled={activeOrganization?.id === org.id}
                    title={`Cambiar al espacio de trabajo ${org.name}`}
                  >
                    {activeOrganization?.id === org.id ? 'Activo' : 'Entrar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 flex-wrap margin-top-10">
          <button
            className="outline flex align-center gap-2 color-accent-mint border-accent-mint"
            onClick={() => { setShowCreateModal(true); setTeamMessage(null); }}
            title="Abrir formulario para crear equipo"
          >
            <Plus size={16} /> Crear Equipo
          </button>
          <button
            className="outline flex align-center gap-2"
            onClick={() => { setShowJoinModal(true); setTeamMessage(null); }}
            title="Unirse a un equipo mediante código"
          >
            <FolderPlus size={16} /> Unirme por Código
          </button>
        </div>
      </section>

      {/* Modal: Crear Equipo */}
      {showCreateModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-zoom-in modal-narrow">
            <header className="modal-header">
              <h3>Crear Nuevo Equipo</h3>
              <p>Funda un espacio de trabajo para tu agencia o proyecto.</p>
            </header>

            {teamMessage && (
              <div className={`message-box margin-bottom-20 ${teamMessage.type}`}>
                {teamMessage.text}
              </div>
            )}

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
                setTimeout(() => setShowCreateModal(false), 1500);
              } catch (err: any) {
                setTeamMessage({ text: err.message, type: 'error' });
              } finally {
                setTeamLoading(false);
              }
            }}>
              <div className="form-group">
                <label htmlFor="createOrgName">Nombre del Equipo</label>
                <input 
                    id="createOrgName"
                    title="Nombre del nuevo equipo"
                    type="text" 
                    value={newOrgName} 
                    onChange={e => setNewOrgName(e.target.value)} 
                    placeholder="Ej. Agencia de Marketing" 
                    required 
                    autoFocus 
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="outline" onClick={() => setShowCreateModal(false)} title="Cancelar creación">Cancelar</button>
                <button type="submit" className="primary" disabled={teamLoading} title="Crear equipo ahora">
                    {teamLoading ? 'Creando...' : 'Crear Equipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Unirse a Equipo */}
      {showJoinModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-zoom-in modal-narrow">
            <header className="modal-header">
              <h3>Unirse a Equipo</h3>
              <p>Ingresa el código de 8 caracteres que te compartió tu administrador.</p>
            </header>

            {teamMessage && (
              <div className={`message-box margin-bottom-20 ${teamMessage.type}`}>
                {teamMessage.text}
              </div>
            )}

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
                setTeamMessage({ text: `¡Te has unido a ${org.name}!`, type: 'success' });
                setTimeout(() => setShowJoinModal(false), 1500);
              } catch (err: any) {
                setTeamMessage({ text: err.message, type: 'error' });
              } finally {
                setTeamLoading(false);
              }
            }}>
              <div className="form-group">
                <label htmlFor="joinOrgCode">Código de Acceso</label>
                <input 
                  id="joinOrgCode"
                  type="text" 
                  value={joinCode} 
                  onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                  placeholder="ABC123XY"
                  required
                  maxLength={8}
                  autoFocus
                  title="Código de 8 caracteres del equipo"
                  className="text-center font-bold font-size-xl letter-spacing-8"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="outline" onClick={() => setShowJoinModal(false)} title="Cancelar unión">Cancelar</button>
                <button type="submit" className="primary" disabled={teamLoading} title="Verificar código y unirme">
                    {teamLoading ? 'Verificando...' : 'Unirme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zona 4: Plan y Facturación (Placeholder) */}
      <section id="billing" className="profile-section">
        <h3><CreditCard size={20} className="text-accent-mint" /> Planes y Uso</h3>
        <div className="bg-glass-low padding-20 radius-md border-dashed border-muted text-center">
          <p className="margin-0">Plan Actual</p>
          <span className="plan-badge">GRATUITO (Early Access)</span>
          <p className="margin-top-15 font-size-sm text-secondary">
            Pronto podrás suscribirte a planes Pro para proyectos ilimitados y mayor almacenamiento.
          </p>
          <button className="outline margin-top-15 opacity-50" disabled title="Función próximamente">Mejorar Plan (Próximamente)</button>
        </div>
      </section>

      {/* Zona 4: Danger Zone */}
      <section className="profile-section border-danger-low">
        <h3 className="text-danger"><Trash2 size={20} /> Zona de Peligro</h3>
        <p className="text-secondary font-size-sm">
          Al eliminar tu cuenta, todos tus datos asociados serán borrados de forma permanente.
        </p>
        <button onClick={handleDeleteAccount} className="text-button text-danger border-danger padding-8-16 radius-sm margin-top-10" title="Eliminar cuenta permanentemente">
          Eliminar mi cuenta definitivamente
        </button>
      </section>

    </div>
  );
}
