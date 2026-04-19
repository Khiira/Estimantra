import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useSession } from '../auth/SessionContext';
import { insforge } from '../lib/insforge';
import { 
  User, 
  Settings, 
  LogOut, 
  Building, 
  CreditCard,
  Plus
} from 'lucide-react';

export default function Navigation() {
  const { user, activeOrganization, setActiveOrganization, myOrganizations } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useLocation();

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await insforge.auth.signOut();
    window.location.href = '/login';
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const userDisplayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario';

  return (
    <nav className="app-nav">
      <div className="nav-left">
        <Link href="/" className="nav-logo">Estimantra</Link>
        
        {myOrganizations && myOrganizations.length > 0 && !location.startsWith('/project') && (
          <div className="org-switcher" style={{ marginLeft: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building size={16} color="var(--color-text-secondary)" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <select 
                title="Cambiar Equipo"
                className="org-select select-pill"
                value={activeOrganization?.id || ''} 
                onChange={(e) => setActiveOrganization(myOrganizations.find(o => o.id === e.target.value))}
                style={{ height: '32px', minWidth: '140px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
              >
                {myOrganizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
              {activeOrganization?.role && (
                <span style={{ fontSize: '0.65rem', color: 'var(--color-accent-mint)', opacity: 0.8, marginTop: '2px', marginLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  {activeOrganization.role === 'admin' ? 'Administrador' : 'Miembro'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="nav-right">
        <div className="user-menu-container" ref={dropdownRef}>
          <button 
            className="user-avatar-btn" 
            onClick={() => setShowDropdown(!showDropdown)}
            title="Menú de Usuario"
          >
            {getInitials(userDisplayName)}
          </button>

          {showDropdown && (
            <div className="dropdown-menu">
              <div className="dropdown-header">
                <p>Sesión iniciada como</p>
                <strong>{userDisplayName}</strong>
              </div>
              
              <Link href="/profile" onClick={() => setShowDropdown(false)}>
                <button className="dropdown-item">
                  <User size={16} /> Mi Perfil
                </button>
              </Link>
              
              <Link href="/organization" onClick={() => setShowDropdown(false)}>
                <button className="dropdown-item">
                  <Settings size={16} /> Configuración del Equipo
                </button>
              </Link>

              <Link href="/profile#teams" onClick={() => setShowDropdown(false)}>
                <button className="dropdown-item" style={{ color: 'var(--color-accent-mint)' }}>
                  <Plus size={16} /> + Unirse a otro equipo
                </button>
              </Link>

              <button className="dropdown-item" onClick={() => { setLocation('/profile#billing'); setShowDropdown(false); }}>
                <CreditCard size={16} /> Planes y Facturación
              </button>

              <div style={{ height: '1px', background: 'var(--color-border)', margin: '5px 0' }}></div>
              
              <button className="dropdown-item danger" onClick={handleLogout}>
                <LogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
