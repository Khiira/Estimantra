import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="brand-section">
          <img 
            src="/estimantra-mascot.png" 
            alt="Estimantra Mascot" 
            className="brand-logo-mascot"
          />
          <div>
            <strong style={{ display: 'block', color: 'var(--color-accent-mint)' }}>Estimantra</strong>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Precision in every digit.</span>
          </div>
        </div>

        <div className="dev-section">
          <span>Desarrollado por <strong>Khiira</strong></span>
          <img 
            src="/khiira-logo.png" 
            alt="Khiira Logo" 
            className="khiira-logo"
          />
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '10px' }}>
        &copy; {new Date().getFullYear()} Estimantra. Todos los derechos reservados.
      </div>
    </footer>
  );
};

export default Footer;
