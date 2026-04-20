import { AlertCircle, Clock, CheckCircle } from 'lucide-react';

interface LogoutWarningModalProps {
  onStay: () => void;
  onLogout: () => void;
  secondsLeft: number;
}

export default function LogoutWarningModal({ onStay, onLogout, secondsLeft }: LogoutWarningModalProps) {
  return (
    <div className="modal-overlay animate-fade-in logout-warning-overlay">
      <div className="modal-card logout-warning-card animate-scale-up">
        <div className="warning-header">
          <div className="warning-icon-wrapper">
            <AlertCircle className="warning-icon text-warning pulse-slow" size={48} />
          </div>
          <h2>¿Sigues ahí?</h2>
        </div>
        
        <div className="warning-content">
          <p>Tu sesión está a punto de cerrarse por inactividad por motivos de seguridad.</p>
          <div className="countdown-timer">
            <Clock size={20} className="timer-icon" />
            <span>La sesión se cerrará en <strong>{secondsLeft}</strong> segundos</span>
          </div>
        </div>

        <div className="warning-actions">
          <button onClick={onStay} className="primary btn-stay-active">
            <CheckCircle size={18} /> Continuar trabajando
          </button>
          <button onClick={onLogout} className="text-button btn-logout-now">
            Cerrar sesión ahora
          </button>
        </div>
      </div>

      <style>{`
        .logout-warning-overlay {
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 9999;
        }
        .logout-warning-card {
          max-width: 450px;
          text-align: center;
          border: 1px solid var(--color-border);
          background: var(--color-bg-secondary);
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        .warning-icon-wrapper {
          margin-bottom: 20px;
          display: flex;
          justify-content: center;
        }
        .warning-icon {
          color: #ffb703; /* Warning Yellow */
        }
        .text-warning {
          color: #ffb703;
        }
        .pulse-slow {
          animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        .countdown-timer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(255, 183, 3, 0.1);
          padding: 12px;
          border-radius: var(--radius-md);
          margin: 20px 0;
          color: #ffb703;
          font-weight: 500;
        }
        .warning-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 25px;
        }
        .btn-stay-active {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          font-size: 1rem;
        }
        .btn-logout-now {
          font-size: 0.9rem;
          opacity: 0.7;
          color: var(--color-text-muted);
        }
        .btn-logout-now:hover {
          opacity: 1;
          color: var(--color-danger);
        }
      `}</style>
    </div>
  );
}
