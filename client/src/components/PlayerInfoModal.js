import { useEffect, useState } from 'react';

const formatStat = (val) => {
    const n = Number(val);
    if (val == null || !Number.isFinite(n)) return '--';
    return n > 0 && n < 1 ? n.toFixed(3) : String(Math.round(n));
};

const formatAvg = (val) => (val != null && val !== '' ? Number(val).toFixed(3) : '--');

const getPlayerName = (player) => player?.playerName || player?.name || '--';
const getTeamLabel = (player) => player?.mlbTeam || player?.team || '--';
const getPosition = (player) =>
    player?.position ||
    (Array.isArray(player?.positions) ? player.positions.join('/') : '') ||
    '--';

const pickFirst = (player, keys) => {
    for (const k of keys) {
        if (player[k] != null) return player[k];
    }
    return null;
};

const BATTER_STATS = [
    { label: 'AB', value: (p) => formatStat(p.ab) },
    { label: 'R', value: (p) => formatStat(p.r) },
    { label: 'H', value: (p) => formatStat(p.h) },
    { label: 'HR', value: (p) => formatStat(p.hr) },
    { label: 'RBI', value: (p) => formatStat(p.rbi) },
    { label: 'BB', value: (p) => formatStat(p.bb) },
    { label: 'K', value: (p) => formatStat(p.k) },
    { label: 'SB', value: (p) => formatStat(p.sb) },
    { label: 'AVG', value: (p) => formatAvg(p.avg) },
    { label: 'OBP', value: (p) => formatAvg(p.obp) },
    { label: 'SLG', value: (p) => formatAvg(p.slg) },
];

const PITCHER_STATS = [
    { label: 'W', value: (p) => formatStat(pickFirst(p, ['w', 'wins', 'W'])) },
    { label: 'SV', value: (p) => formatStat(pickFirst(p, ['sv', 'saves', 'SV'])) },
    { label: 'K', value: (p) => formatStat(p.k) },
    { label: 'ERA', value: (p) => formatStat(pickFirst(p, ['era', 'ERA'])) },
    { label: 'WHIP', value: (p) => formatStat(pickFirst(p, ['whip', 'WHIP'])) },
    { label: 'IP', value: (p) => formatStat(pickFirst(p, ['ip', 'IP'])) },
];

const isPitcher = (player) => {
    const pos = getPosition(player);
    return /\b(SP|RP|P)\b/.test(pos);
};

const PlayerInfoModal = ({ player, initialNote = '', onClose, onSaveNote, isSaving = false }) => {
    const [note, setNote] = useState(initialNote);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        setNote(initialNote);
        setSaveError('');
        setSaveSuccess(false);
    }, [player, initialNote]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    if (!player) return null;

    const handleSave = async () => {
        setSaveError('');
        setSaveSuccess(false);
        const result = await onSaveNote(note.trim());
        if (result?.success === false) {
            setSaveError(result.errorMessage || 'Failed to save note.');
        } else {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const stats = isPitcher(player) ? PITCHER_STATS : BATTER_STATS;
    const status = player?.status || player?.injuryStatus || '';

    return (
        <div
            className="compare-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-info-modal-title"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="compare-modal-card player-info-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="compare-modal-header">
                    <div>
                        <h2 id="player-info-modal-title">{getPlayerName(player)}</h2>
                        <span className="compare-modal-sub">
                            {getTeamLabel(player)} &middot; {getPosition(player)}
                            {status && status !== 'Active' ? (
                                <span className="draft-v2-status-badge injured" style={{ marginLeft: 8 }}>{status}</span>
                            ) : null}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="compare-modal-close"
                        aria-label="Close player info"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <div className="player-info-modal-body">
                    <div className="player-info-stats-grid">
                        {stats.map(({ label, value }) => (
                            <div key={label} className="player-info-stat-cell">
                                <span className="player-info-stat-label">{label}</span>
                                <span className="player-info-stat-value">{value(player)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="player-info-notes-section">
                        <label className="draft-v2-field" style={{ display: 'block' }}>
                            <span>Notes</span>
                            <textarea
                                rows={4}
                                placeholder="Add notes about this player..."
                                value={note}
                                onChange={(e) => { setNote(e.target.value); setSaveSuccess(false); }}
                                className="player-info-notes-textarea"
                            />
                        </label>
                        {saveError ? <p className="draft-v2-entry-error">{saveError}</p> : null}
                        {saveSuccess ? <p className="draft-v2-entry-success">Note saved.</p> : null}
                        <div className="compare-modal-actions">
                            <button
                                type="button"
                                className="draft-v2-auction-btn"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : 'Save Note'}
                            </button>
                            {/* US-20.2: clear/delete note — sends text:"" to the endpoint */}
                            {note ? (
                                <button
                                    type="button"
                                    className="draft-v2-filter-btn"
                                    style={{ color: '#e53e3e' }}
                                    disabled={isSaving}
                                    onClick={async () => {
                                        setNote('');
                                        setSaveError('');
                                        const result = await onSaveNote('');
                                        if (!result.success) setSaveError(result.errorMessage || 'Failed to delete note.');
                                        else setSaveSuccess(true);
                                    }}
                                >
                                    Delete Note
                                </button>
                            ) : null}
                            <button type="button" className="draft-v2-filter-btn" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerInfoModal;
