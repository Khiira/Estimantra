import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { insforge } from '../lib/insforge';
import LogoutWarningModal from '../components/LogoutWarningModal';

type SessionContextType = {
  user: any;
  loading: boolean;
  activeOrganization: any;
  setActiveOrganization: (org: any) => void;
  myOrganizations: any[];
  loadOrganizations: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType>({ 
  user: null, 
  loading: true, 
  activeOrganization: null, 
  setActiveOrganization: () => {},
  myOrganizations: [],
  loadOrganizations: async () => {} 
});

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const WARNING_BEFORE = 1 * 60 * 1000; // 1 minuto antes

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrganization, setActiveOrganization] = useState<any>(null);
  const [myOrganizations, setMyOrganizations] = useState<any[]>([]);
  
  // Estados para gestión de inactividad
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<number | null>(null);

  const handleLogout = async () => {
    try {
      await insforge.auth.signOut();
      setUser(null);
      // Limpiar rastros locales
      localStorage.removeItem('insforge_auth_token');
      localStorage.removeItem('insforge.auth.token');
      localStorage.removeItem('estimantra_remember_me'); // Limpiar preferencia al cerrar sesión manual
      window.location.href = '/login';
    } catch (err) {
      console.error('Error during automatic logout:', err);
      window.location.href = '/login';
    }
  };

  const resetActivity = () => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
    }
  };

    const loadOrganizations = async (userId?: string, retryCount = 0) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    try {
      const { data: orgs, error } = await insforge.database
        .from('organizations')
        .select('*, organization_members!inner(role)')
        .eq('organization_members.user_id', targetUserId)
        .order('created_at', { ascending: true });
          
      if (error) {
        if (((error as any).status === 401 || (error as any).code === '42501') && retryCount < 1) {
          console.warn('Reintentando carga de organizaciones por error de permisos (401)...');
          await new Promise(resolve => setTimeout(resolve, 800));
          return loadOrganizations(targetUserId, retryCount + 1);
        }
        throw error;
      }

      if (orgs && orgs.length > 0) {
        const mappedOrgs = orgs.map((o: any) => ({
          ...o,
          role: o.organization_members?.[0]?.role
        }));

        setMyOrganizations(mappedOrgs);
        
        setActiveOrganization((prev: any) => {
          if (!prev) return mappedOrgs[0];
          const stillExists = mappedOrgs.find((o: any) => o.id === prev.id);
          return stillExists ? prev : mappedOrgs[0];
        });
      } else {
        setActiveOrganization(null);
        setMyOrganizations([]);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
      if (retryCount >= 1) setMyOrganizations([]);
      if ((err as any).status === 401 || (err as any).code === 'PGRST301') {
        handleLogout();
      }
    }
  };

  // Monitoreo de actividad (Detección de cuando mostrar advertencia)
  useEffect(() => {
    const isRemembered = localStorage.getItem('estimantra_remember_me') === 'true';
    
    // Si no hay usuario o si eligió ser recordado, no activamos el cierre por inactividad
    if (!user || isRemembered) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleUserInteraction = () => resetActivity();
    
    events.forEach(event => document.addEventListener(event, handleUserInteraction));

    timerIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const diff = now - lastActivityRef.current;

      if (diff >= INACTIVITY_TIMEOUT - WARNING_BEFORE && !showWarning) {
        setShowWarning(true);
        setSecondsLeft(60);
      }
    }, 5000);

    return () => {
      events.forEach(event => document.removeEventListener(event, handleUserInteraction));
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [user, showWarning]);

  // Contador regresivo (Solo cuando la advertencia está visible)
  useEffect(() => {
    if (!showWarning) return;

    const countdownInterval = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [showWarning]);

  // Cargar usuario inicial
  useEffect(() => {

    let isMounted = true;
    
    // Solo intentar recuperar la sesión si hay un rastro local de que el usuario estuvo logueado.
    const hasSessionTrace = !!localStorage.getItem('insforge_auth_token') || 
                           !!localStorage.getItem('insforge.auth.token') ||
                           document.cookie.includes('insforge');

    if (!hasSessionTrace) {
      setLoading(false);
      return;
    }

    insforge.auth.getCurrentUser().then(async ({ data }) => {
      if (!isMounted) return;
      
      const authUser = data?.user ?? null;
      setUser(authUser);
      
      if (authUser) {
        await loadOrganizations(authUser.id);
      }
      setLoading(false);
    }).catch(async (err) => {
      if (!isMounted) return;
      console.error('Fallo en la comunicación inicial con el servicio de autenticación:', err);
      setUser(null);
      setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Realtime y eventos de base de datos
  useEffect(() => {
    if (!user) return;

    const setupRealtime = async () => {
      try {
        await insforge.realtime.connect();
        for (const org of myOrganizations) {
          await insforge.realtime.subscribe(`org:${org.id}`);
        }
      } catch (err) {
        console.error('Session Realtime Error:', err);
      }
    };

    setupRealtime();

    const refresh = () => loadOrganizations(user.id);
    const refreshUser = async () => {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (error && (error as any).status === 401) {
        handleLogout();
        return;
      }
      if (data?.user) setUser(data.user);
    };
    
    insforge.realtime.on('INSERT_organization_members', refresh);
    insforge.realtime.on('DELETE_organization_members', refresh);
    insforge.realtime.on('UPDATE_organization_members', refresh);
    insforge.realtime.on('UPDATE_organizations', refresh);
    insforge.realtime.on('DELETE_organizations', refresh);
    insforge.realtime.on('UPDATE_profiles', refreshUser);

    // Verificación periódica del token (cada 5 minutos) para seguridad extra "según el token"
    const tokenCheckInterval = setInterval(async () => {
      const { error } = await insforge.auth.getCurrentUser();
      if (error && (error as any).status === 401) {
        handleLogout();
      }
    }, 5 * 60 * 1000);

    return () => {
      insforge.realtime.off('INSERT_organization_members', refresh);
      insforge.realtime.off('DELETE_organization_members', refresh);
      insforge.realtime.off('UPDATE_organization_members', refresh);
      insforge.realtime.off('UPDATE_organizations', refresh);
      insforge.realtime.off('DELETE_organizations', refresh);
      insforge.realtime.off('UPDATE_profiles', refreshUser);
      clearInterval(tokenCheckInterval);
    };
  }, [user, myOrganizations.length]);

  return (
    <SessionContext.Provider value={{ user, loading, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations }}>
      {children}
      {showWarning && (
        <LogoutWarningModal 
          secondsLeft={secondsLeft} 
          onStay={resetActivity} 
          onLogout={handleLogout} 
        />
      )}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);

