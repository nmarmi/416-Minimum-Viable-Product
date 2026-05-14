import { useEffect, useState } from 'react';
import { getSessionPlayer } from '../draft-sessions/requests';

const formatStat = (val) => {
    const n = Number(val);
    if (val == null || !Number.isFinite(n)) return '--';
    return n > 0 && n < 1 ? n.toFixed(3) : String(Math.round(n));
};
const formatRate = (val) => (val != null && Number.isFinite(Number(val)) && Number(val) > 0 ? Number(val).toFixed(2) : '--');
const formatAvg  = (val) => (val != null && val !== '' ? Number(val).toFixed(3) : '--');

const getPlayerName = (player) => player?.playerName || player?.name || '--';
const getTeamLabel  = (player) => player?.mlbTeam || player?.team || '--';
const getPosition   = (player) =>
    player?.position ||
    (Array.isArray(player?.positions) ? player.positions.join('/') : '') || '--';

const pickFirst = (player, keys) => {
    for (const k of keys) { if (player[k] != null) return player[k]; }
    return null;
};

const BATTER_STATS = [
    { label: 'AB',  value: (p) => formatStat(p.ab) },
    { label: 'R',   value: (p) => formatStat(p.r) },
    { label: 'H',   value: (p) => formatStat(p.h) },
    { label: 'HR',  value: (p) => formatStat(p.hr) },
    { label: 'RBI', value: (p) => formatStat(p.rbi) },
    { label: 'BB',  value: (p) => formatStat(p.bb) },
    { label: 'K',   value: (p) => formatStat(p.k) },
    { label: 'SB',  value: (p) => formatStat(p.sb) },
    { label: 'AVG', value: (p) => formatAvg(p.avg) },
    { label: 'OBP', value: (p) => formatAvg(p.obp) },
    { label: 'SLG', value: (p) => formatAvg(p.slg) },
];
const PITCHER_STATS = [
    { label: 'W',    value: (p) => formatStat(pickFirst(p, ['w', 'wins', 'W'])) },
    { label: 'SV',   value: (p) => formatStat(pickFirst(p, ['sv', 'saves', 'SV'])) },
    { label: 'K',    value: (p) => formatStat(p.k) },
    { label: 'IP',   value: (p) => formatStat(pickFirst(p, ['ip', 'IP'])) },
    { label: 'ERA',  value: (p) => formatRate(pickFirst(p, ['era', 'ERA'])) },
    { label: 'WHIP', value: (p) => formatRate(pickFirst(p, ['whip', 'WHIP'])) },
];

const isPitcher = (player) => /\b(SP|RP|P)\b/.test(getPosition(player));

const INJURY_COLORS = {
    active: '#2f9e5a', dtd: '#d97706', day_to_day: '#d97706',
    il_10: '#c05621', il_15: '#c05621', il_60: '#e53e3e',
    out: '#e53e3e', minors: '#6b7080', dfa: '#6b7080',
};

/**
 * US-21.1: Full player detail modal.
 * Fetches enriched data from the server on mount, then displays:
 * identity, age, injury/depth context, stats, note editor.
 */
const PlayerInfoModal = ({ player, draftSessionId, initialNote = '', onClose, onSaveNote, isSaving = false }) => {
    const [note,        setNote]        = useState(initialNote);
    const [saveError,   setSaveError]   = useState('');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [detail,      setDetail]      = useState(null);  // enriched data from server
    const [loading,     setLoading]     = useState(false);
    const [fetchErr,    setFetchErr]    = useState('');

    // Reset state when player changes
    useEffect(() => {
        setNote(initialNote);
        setSaveError('');
        setSaveSuccess(false);
    }, [player, initialNote]);

    // Fetch enriched player data
    useEffect(() => {
        if (!player || !draftSessionId) return;
        const playerId = player.playerId || player.id || player.mlbPersonId;
        if (!playerId) return;

        setLoading(true);
        setDetail(null);
        setFetchErr('');

        getSessionPlayer(draftSessionId, String(playerId)).then((res) => {
            setLoading(false);
            if (res.status === 200 && res.data?.success) {
                setDetail(res.data.player);
            } else {
                // Non-fatal — keep showing what we have from the table row
                setFetchErr('Could not load full player details.');
            }
        }).catch(() => {
            setLoading(false);
            setFetchErr('Could not load full player details.');
        });
    }, [player, draftSessionId]);

    // Close on Escape
    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    if (!player) return null;

    const rich   = detail || player; // prefer enriched data, fall back to table row
    const stats  = isPitcher(rich) ? PITCHER_STATS : BATTER_STATS;
    const status = rich?.status || rich?.injuryStatus || '';

    // Injury details from the Player Data API injuryAdjustment field
    const injAdj   = rich?.injuryAdjustment;
    const injStatus = injAdj?.status || (status.toLowerCase() !== 'active' ? status : null);
    const injMult   = injAdj?.multiplier;
    const injColor  = INJURY_COLORS[injStatus?.toLowerCase()] || null;

    // Age from ageAdjustment (only when ageFactor was enabled) or compute from birth_date
    const ageAdj = rich?.ageAdjustment;
    const age    = ageAdj?.age ?? null;

    // Depth chart
    const depthRank = rich?.depthChartRank ?? rich?.depth_chart_rank ?? null;
    const depthPos  = rich?.depthChartPosition ?? rich?.depth_chart_position ?? null;

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

    return (
        <div
            className="compare-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-info-modal-title"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="compare-modal-card player-info-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="compare-modal-header">
                    <div>
                        <h2 id="player-info-modal-title">{getPlayerName(rich)}</h2>
                        <span className="compare-modal-sub">
                            {getTeamLabel(rich)} &middot; {getPosition(rich)}
                            {age != null ? <span style={{ marginLeft: 8, color: '#6b7080' }}>Age {age}</span> : null}
                        </span>
                    </div>
                    <button type="button" className="compare-modal-close" aria-label="Close" onClick={onClose}>×</button>
                </div>

                <div className="player-info-modal-body">
                    {loading ? (
                        <p className="draft-v2-auction-muted" style={{ textAlign: 'center', padding: '12px 0' }}>Loading details…</p>
                    ) : fetchErr ? (
                        <p className="draft-v2-auction-muted" style={{ fontSize: '0.8rem' }}>{fetchErr}</p>
                    ) : null}

                    {/* Injury / status badge */}
                    {injStatus && injStatus !== 'active' ? (
                        <div className="player-info-status-row">
                            <span
                                className="draft-v2-status-badge injured"
                                style={{ background: injColor ? `${injColor}22` : undefined, color: injColor || undefined }}
                            >
                                {injStatus.replace(/_/g, '-').toUpperCase()}
                            </span>
                            {injMult != null && injMult < 1 ? (
                                <span className="draft-v2-auction-muted" style={{ fontSize: '0.78rem' }}>
                                    −{Math.round((1 - injMult) * 100)}% value adjustment
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {/* Depth chart */}
                    {depthRank != null ? (
                        <div className="player-info-depth-row">
                            <span className="draft-v2-depth-badge">
                                {depthPos ? `${depthPos}${depthRank}` : `#${depthRank}`}
                            </span>
                            <span className="draft-v2-auction-muted" style={{ fontSize: '0.8rem' }}>
                                {depthRank === 1 ? 'Projected starter' : depthRank === 2 ? 'Backup' : depthRank === 3 ? 'Third string' : 'Deep bench'}
                            </span>
                        </div>
                    ) : null}

                    {/* Stats grid */}
                    <div className="player-info-stats-grid">
                        {stats.map(({ label, value }) => (
                            <div key={label} className="player-info-stat-cell">
                                <span className="player-info-stat-label">{label}</span>
                                <span className="player-info-stat-value">{value(rich)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Notes — US-20 */}
                    <div className="player-info-notes-section">
                        <label className="draft-v2-field" style={{ display: 'block' }}>
                            <span>Notes</span>
                            <textarea
                                rows={3}
                                placeholder="Add notes about this player…"
                                value={note}
                                onChange={(e) => { setNote(e.target.value); setSaveSuccess(false); }}
                                className="player-info-notes-textarea"
                            />
                        </label>
                        {saveError   ? <p className="draft-v2-entry-error">  {saveError}</p>   : null}
                        {saveSuccess ? <p className="draft-v2-entry-success">Note saved.</p> : null}
                        <div className="compare-modal-actions">
                            <button type="button" className="draft-v2-auction-btn" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save Note'}
                            </button>
                            {note ? (
                                <button type="button" className="draft-v2-filter-btn" style={{ color: '#e53e3e' }} disabled={isSaving}
                                    onClick={async () => {
                                        setNote('');
                                        const result = await onSaveNote('');
                                        if (!result?.success) setSaveError(result?.errorMessage || 'Failed to delete note.');
                                        else setSaveSuccess(true);
                                    }}
                                >Delete Note</button>
                            ) : null}
                            <button type="button" className="draft-v2-filter-btn" onClick={onClose}>Close</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerInfoModal;
