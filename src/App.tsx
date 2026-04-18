import { Route, Switch, useLocation } from 'wouter';
import { SessionProvider, useSession } from './auth/SessionContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectEstimator from './pages/ProjectEstimator';
import OrganizationSettings from './pages/OrganizationSettings';
import { useEffect } from 'react';

// Interceptar tokens de invitación mágicos desde la URL
const urlParams = new URLSearchParams(window.location.search);
const inviteToken = urlParams.get('token');
if (inviteToken) {
  localStorage.setItem('estimantra_invite', inviteToken);
  window.history.replaceState({}, '', window.location.pathname);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/login');
    }
  }, [loading, user, setLocation]);

  if (loading) {
    return (
      <div className="container animate-fade-in loading-container">
        <div className="skeleton skeleton-title loading-skeleton-title"></div>
        <div className="skeleton skeleton-text loading-skeleton-text-full"></div>
        <div className="skeleton skeleton-text loading-skeleton-text-80"></div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/organization">
        <ProtectedRoute>
          <OrganizationSettings />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/project/:id">
        <ProtectedRoute>
          <ProjectEstimator />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  );
}


