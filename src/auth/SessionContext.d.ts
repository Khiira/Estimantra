import React from 'react';
type SessionContextType = {
    user: any;
    loading: boolean;
    activeOrganization: any;
    setActiveOrganization: (org: any) => void;
    myOrganizations: any[];
    loadOrganizations: () => Promise<void>;
};
export declare function SessionProvider({ children }: {
    children: React.ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare const useSession: () => SessionContextType;
export {};
