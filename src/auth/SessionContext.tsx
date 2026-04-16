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

  const loadOrganizations = async () => {
    const { data: orgs } = await insforge.database
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: true });
        
    if (orgs && orgs.length > 0) {
      setMyOrganizations(orgs);
      
      // Si el activeOrganization actual no existe o no esta en la nueva lista, poner el primero
      setActiveOrganization((prev: any) => {
        if (!prev) return orgs[0];
        const stillExists = orgs.find((o: any) => o.id === prev.id);
        return stillExists ? prev : orgs[0];
      });
    } else {
      setActiveOrganization(null);
      setMyOrganizations([]);
    }
  };

  useEffect(() => {
    insforge.auth.getCurrentUser().then(async ({ data }) => {
      const authUser = data?.user ?? null;
      setUser(authUser);
      
      if (authUser) {
        await loadOrganizations();
      }
      setLoading(false);
    }).catch((e) => {
      console.log(e);
      setUser(null);
      setLoading(false);
    });
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, activeOrganization, setActiveOrganization, myOrganizations, loadOrganizations }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
