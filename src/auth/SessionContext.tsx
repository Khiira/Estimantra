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
    
    // Solo intentar recuperar la sesión si hay un rastro local de que el usuario estuvo logueado.
    // Esto evita que el SDK intente hacer un refresco (POST /refresh) que lance un 401 en cada carga.
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

  useEffect(() => {
    if (!user) return;

    const setupRealtime = async () => {
      try {
        await insforge.realtime.connect();
        // Suscribirse a cada organización que posee el usuario
        for (const org of myOrganizations) {
          await insforge.realtime.subscribe(`org:${org.id}`);
        }
      } catch (err) {
        console.error('Session Realtime Error:', err);
      }
    };

    setupRealtime();

    const refresh = () => loadOrganizations(user.id);
    
    // Escuchar eventos globales de membresía
    insforge.realtime.on('INSERT_organization_members', refresh);
    insforge.realtime.on('DELETE_organization_members', refresh);
    insforge.realtime.on('UPDATE_organization_members', refresh);
    // Escuchar si la organización misma cambia (ej: nombre editado)
    insforge.realtime.on('UPDATE_organizations', refresh);
    insforge.realtime.on('DELETE_organizations', refresh);

    return () => {
      insforge.realtime.off('INSERT_organization_members', refresh);
      insforge.realtime.off('DELETE_organization_members', refresh);
      insforge.realtime.off('UPDATE_organization_members', refresh);
      insforge.realtime.off('UPDATE_organizations', refresh);
      insforge.realtime.off('DELETE_organizations', refresh);
    };
  }, [user, myOrganizations.length]);

  return (
    <SessionContext.Provider value={{ user, loading, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
