import { useEffect } from 'react';

const formatStat = (val) =>
  val != null && Number.isFinite(val)
    ? Number(val) === val && val < 1 && val > 0
      ? val.toFixed(3)
      : String(Math.round(val))
    : '--';

const formatAvg = (val) => (val != null ? Number(val).toFixed(3) : '--');
const getTeamLabel = (player) => player?.mlbTeam || player?.team || '--';
const getPlayerName = (player) => player?.playerName || player?.name || '--';
const getPosition = (player) =>
  player?.position ||
  (Array.isArray(player?.positions) ? player.positions.join('/') : '') ||
  '--';

const STAT_ROWS = [
  { key: 'playerName', label: 'Player' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Pos' },
  { key: '__dollarValue__', label: '$ Value' },
  { key: 'hr', label: 'HR', format: formatStat },
  { key: 'rbi', label: 'RBI', format: formatStat },
  { key: 'r', label: 'R', format: formatStat },
  { key: 'sb', label: 'SB', format: formatStat },
  { key: 'avg', label: 'AVG', format: formatAvg },
  { key: 'bb', label: 'BB', format: formatStat },
  { key: 'k', label: 'K', format: formatStat },
];

/**
 * Modal that shows 2–4 players side-by-side for comparison (value, projections, position).
 */
const PlayerCompareModal = ({ players = [], onClose, getPlayerValuation }) => {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!players.length) return null;

  return (
    <div
      className="compare-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="compare-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="compare-modal-header">
          <h2 id="compare-modal-title">Player Comparison</h2>
          <button
            type="button"
            className="compare-modal-close"
            aria-label="Close comparison"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="compare-modal-table-wrap">
          <table className="compare-modal-table">
            <thead>
              <tr>
                <th className="compare-modal-label-col">Stat</th>
                {players.map((p, i) => (
                  <th key={p.id || p._id || `${getPlayerName(p)}-${i}`}>
                    {getPlayerName(p)}
                    <span className="compare-modal-sub">{getTeamLabel(p)} · {getPosition(p)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAT_ROWS.map(({ key, label, format }) => (
                <tr key={key}>
                  <td className="compare-modal-label-col">{label}</td>
                  {players.map((p, i) => (
                    <td key={p.id || p._id || `${getPlayerName(p)}-${i}`}>
                      {key === '__dollarValue__'
                        ? (getPlayerValuation ? getPlayerValuation(p) : '--')
                        : format
                        ? format(p[key])
                        : key === 'team'
                        ? getTeamLabel(p)
                        : key === 'playerName'
                        ? getPlayerName(p)
                        : key === 'position'
                        ? getPosition(p)
                        : (p[key] ?? '--')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="compare-modal-actions">
          <button type="button" className="draft-v2-auction-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerCompareModal;
