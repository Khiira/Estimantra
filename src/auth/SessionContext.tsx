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
        // Si hay un error deUnauthorized (401 o 42501) y no hemos reintentado, esperar e intentar de nuevo
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
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    insforge.auth.getCurrentUser().then(async ({ data, error }) => {
      if (!isMounted) return;
      
      if (error) {
        // En lugar de borrar la sesión preventivamente, solo informamos.
        // Esto permite que el SDK intente recuperarse si es un error transitorio.
        console.warn('Sesión no recuperable al inicio:', error);
        setUser(null);
        setLoading(false);
        return;
      }

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

  return (
    <SessionContext.Provider value={{ user, loading, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
