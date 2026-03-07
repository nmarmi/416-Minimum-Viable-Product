import { useState, useRef, useEffect } from 'react';
import { getDefinition } from '../glossary/terms';

/**
 * Inline term with a (?) icon. Hover or focus shows a tooltip with the definition.
 * If no definition is found, renders children only (no icon/tooltip).
 */
const GlossaryTerm = ({ term, children }) => {
  const definition = getDefinition(term);
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!showTooltip || !wrapRef.current || !tooltipRef.current) return;
    const wrap = wrapRef.current.getBoundingClientRect();
    const tt = tooltipRef.current.getBoundingClientRect();
    const padding = 8;
    let top = wrap.top - tt.height - padding;
    let left = wrap.left + wrap.width / 2 - tt.width / 2;
    if (top < padding) top = wrap.bottom + padding;
    if (left < padding) left = padding;
    if (left + tt.width > window.innerWidth - padding) left = window.innerWidth - tt.width - padding;
    setPosition({ top, left });
  }, [showTooltip]);

  if (!definition) {
    return children ? <span>{children}</span> : <span>{term}</span>;
  }

  return (
    <span
      ref={wrapRef}
      className="glossary-term-wrap"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children != null ? children : term}
      <span
        className="glossary-term-icon"
        tabIndex={0}
        role="button"
        aria-label={`Definition of ${term}`}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        ?
      </span>
      {showTooltip && (
        <span
          ref={tooltipRef}
          className="glossary-tooltip"
          role="tooltip"
          style={{ top: position.top, left: position.left }}
        >
          {definition}
        </span>
      )}
    </span>
  );
};

export default GlossaryTerm;
