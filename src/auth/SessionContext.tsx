import React, { createContext, useContext, useEffect, useState } from 'react';
import { insforge } from '../lib/insforge';

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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrganization, setActiveOrganization] = useState<any>(null);
  const [myOrganizations, setMyOrganizations] = useState<any[]>([]);

  const handleLogout = async () => {
    try {
      await insforge.auth.signOut();
      setUser(null);
      localStorage.removeItem('insforge_auth_token');
      localStorage.removeItem('insforge.auth.token');
      window.location.href = '/login';
    } catch (err) {
      console.error('Error during logout:', err);
      window.location.href = '/login';
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
      if ((err as any).status === 401 || (err as any).code === 'PGRST301') {
        handleLogout();
      }
    }
  };

  // Cargar usuario inicial y validar token
  useEffect(() => {
    let isMounted = true;
    
    const hasSessionTrace = !!localStorage.getItem('insforge_auth_token') || 
                           !!localStorage.getItem('insforge.auth.token') ||
                           document.cookie.includes('insforge');

    if (!hasSessionTrace) {
      setLoading(false);
      return;
    }

    insforge.auth.getCurrentUser().then(async ({ data, error }) => {
      if (!isMounted) return;
      
      if (error && (error as any).status === 401) {
        handleLogout();
        return;
      }

      const authUser = data?.user ?? null;
      setUser(authUser);
      
      if (authUser) {
        await loadOrganizations(authUser.id);
      }
      setLoading(false);
    }).catch(() => {
      if (!isMounted) return;
      setUser(null);
      setLoading(false);
    });

    return () => { isMounted = false; };
  }, []);

  // Realtime y verificación periódica del Token
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

    // Verificación de salud del Token cada 15 minutos
    const tokenCheckInterval = setInterval(async () => {
      const { error } = await insforge.auth.getCurrentUser();
      if (error && (error as any).status === 401) {
        handleLogout();
      }
    }, 15 * 60 * 1000);

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
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
