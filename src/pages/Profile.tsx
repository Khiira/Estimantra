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
      const { error: dbErr } = await insforge.auth.setProfile({ name });
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
                    onClick={() => { setActiveOrganization(org); setLocation('/organization'); }}
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

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
          <button
            className="outline"
            onClick={() => { setShowCreateModal(true); setTeamMessage(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent-mint)', borderColor: 'var(--color-accent-mint)' }}
          >
            <Plus size={16} /> Crear Equipo
          </button>
          <button
            className="outline"
            onClick={() => { setShowJoinModal(true); setTeamMessage(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FolderPlus size={16} /> Unirme por Código
          </button>
        </div>
      </section>

      {/* Modal: Crear Equipo */}
      {showCreateModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '450px' }}>
            <header className="modal-header">
              <h3>Crear Nuevo Equipo</h3>
              <p>Funda un espacio de trabajo para tu agencia o proyecto.</p>
            </header>

            {teamMessage && (
              <div className={`message-box ${teamMessage.type}`} style={{ marginBottom: '20px' }}>
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
                <label>Nombre del Equipo</label>
                <input type="text" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="Ej. Agencia de Marketing" required autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="outline" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="primary" disabled={teamLoading}>{teamLoading ? 'Creando...' : 'Crear Equipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Unirse a Equipo */}
      {showJoinModal && (
        <div className="modal-overlay animate-fade-in">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '450px' }}>
            <header className="modal-header">
              <h3>Unirse a Equipo</h3>
              <p>Ingresa el código de 8 caracteres que te compartió tu administrador.</p>
            </header>

            {teamMessage && (
              <div className={`message-box ${teamMessage.type}`} style={{ marginBottom: '20px' }}>
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
                <label>Código de Acceso</label>
                <input 
                  type="text" 
                  value={joinCode} 
                  onChange={e => setJoinCode(e.target.value.toUpperCase())} 
                  placeholder="ABC123XY"
                  required
                  maxLength={8}
                  autoFocus
                  style={{ textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold', fontSize: '1.4rem' }}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="outline" onClick={() => setShowJoinModal(false)}>Cancelar</button>
                <button type="submit" className="primary" disabled={teamLoading}>{teamLoading ? 'Verificando...' : 'Unirme'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

    </div>
  );
}
