import { useState } from 'react';
import { insforge } from '../lib/insforge';
import { LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await insforge.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/'; // Full reload
      } else {
        const { error } = await insforge.auth.signUp({
          email,
          password,
          name
        });
        if (error) throw error;
        window.location.href = '/'; // Full reload
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      setLoading(true);
      await insforge.auth.signInWithOAuth({
        provider,
        redirectTo: window.location.origin + '/'
      });
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error con OAuth.');
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card animate-fade-in">
        <h1 className="logo">Estimantra</h1>
        <p className="subtitle">{isLogin ? 'Bienvenido de vuelta' : 'Crea tu espacio de trabajo'}</p>
        
        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Nombre Completo</label>
              <input 
                type="text" 
                placeholder="Ej. Ada Lovelace" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>
          )}
          
          <div className="form-group">
            <label>Correo Electrónico</label>
            <input 
              type="email" 
              placeholder="correo@ejemplo.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Contraseña</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              minLength={6}
            />
          </div>

          <button type="submit" className="primary" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
            {isLogin ? <><LogIn size={18} /> Iniciar Sesión por Correo</> : <><UserPlus size={18} /> Registrarse por Correo</>}
          </button>
        </form>

        <div className="divider">
          <span>O ingresa con</span>
        </div>

        <div className="oauth-buttons">
          <button type="button" onClick={() => handleOAuth('google')} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg> Google
          </button>
          <button type="button" onClick={() => handleOAuth('github')} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 0 5.373 0 12c0 5.303 3.438 9.8 8.207 11.387.6.111.793-.261.793-.579v-2.031c-3.338.726-4.043-1.611-4.043-1.611-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg> GitHub
          </button>
        </div>

        <div className="toggle-mode">
          <p>
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes una cuenta?'}
            <button onClick={() => setIsLogin(!isLogin)} className="text-button">
              {isLogin ? 'Regístrate aquí' : 'Inicia Sesión'}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .login-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%);
        }
        .login-card {
          background: var(--color-bg-secondary);
          padding: 40px;
          border-radius: var(--radius-lg);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          width: 100%;
          max-width: 400px;
          border: 1px solid var(--color-border);
        }
        .logo {
          color: var(--color-accent-mint);
          font-size: 1.8rem;
          margin-bottom: 5px;
          text-align: center;
          font-weight: 700;
        }
        .subtitle {
          text-align: center;
          color: var(--color-text-secondary);
          margin-bottom: 25px;
          font-size: 0.95rem;
        }
        .error-box {
          background: rgba(239, 71, 111, 0.1);
          border-left: 4px solid var(--color-danger);
          padding: 10px;
          border-radius: var(--radius-sm);
          margin-bottom: 20px;
          font-size: 0.9rem;
          color: #ffb3c1;
        }
        .divider {
          text-align: center;
          margin: 20px 0;
          position: relative;
        }
        .divider::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          border-top: 1px solid var(--color-border);
          z-index: 1;
        }
        .divider span {
          background: var(--color-bg-secondary);
          padding: 0 10px;
          color: var(--color-text-muted);
          font-size: 0.8rem;
          position: relative;
          z-index: 2;
        }
        .oauth-buttons {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        .oauth-buttons button {
          flex: 1;
          background-color: rgba(28, 37, 65, 0.8);
          border: 1px solid var(--color-border);
        }
        .oauth-buttons button:hover {
          background-color: var(--color-bg-tertiary);
          border-color: var(--color-accent-mint);
        }
        .toggle-mode {
          text-align: center;
          font-size: 0.9rem;
          color: var(--color-text-secondary);
        }
        .text-button {
          background: none;
          border: none;
          color: var(--color-accent-mint);
          padding: 0;
          margin-left: 8px;
          display: inline;
          font-size: 0.9rem;
        }
        .text-button:hover {
          background: none;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
