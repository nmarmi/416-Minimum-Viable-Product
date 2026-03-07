import { useEffect } from 'react';
import { GLOSSARY_TERMS } from '../glossary/terms';

/**
 * Full-screen modal listing all glossary terms and definitions.
 */
const GlossaryModal = ({ onClose }) => {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="glossary-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glossary-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="glossary-modal-header">
          <h2 id="glossary-modal-title">Glossary</h2>
          <button
            type="button"
            className="glossary-modal-close"
            aria-label="Close glossary"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <p className="glossary-modal-intro">
          Hover over terms marked with <span className="glossary-term-icon">?</span> in the app to see definitions. Below is the full list.
        </p>
        <ul className="glossary-modal-list">
          {GLOSSARY_TERMS.map(({ term, definition }) => (
            <li key={term} className="glossary-modal-item">
              <strong>{term}</strong>
              <span>{definition}</span>
            </li>
          ))}
        </ul>
        <div className="glossary-modal-actions">
          <button type="button" className="draft-v2-auction-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlossaryModal;
