import { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import leaguesRequestSender from '../leagues/requests';

const CommissionerLeagueScreen = () => {
    const history = useHistory();
    const { leagueId } = useParams();

    const [league, setLeague] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [inviteEmail, setInviteEmail] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const [rulesText, setRulesText] = useState('League rules: keep chat respectful, no collusion, commissioner decisions logged.');
    const [draftDate, setDraftDate] = useState('');
    const [draftWindow, setDraftWindow] = useState('30');
    const [nominationTimer, setNominationTimer] = useState('30');
    const [bidTimer, setBidTimer] = useState('20');
    const [extraBidSeconds, setExtraBidSeconds] = useState('5');
    const [auctionBudget, setAuctionBudget] = useState('260');
    const [maxPerPlayer, setMaxPerPlayer] = useState('120');
    const [keeperLimit, setKeeperLimit] = useState('3');
    const [keeperDeadline, setKeeperDeadline] = useState('');
    const [draftPaused, setDraftPaused] = useState(false);
    const [settingsLocked, setSettingsLocked] = useState(false);

    const [pendingManagers, setPendingManagers] = useState([
        { id: 1, name: 'Manager A', status: 'Pending' },
        { id: 2, name: 'Manager B', status: 'Pending' }
    ]);

    const [auditLog, setAuditLog] = useState([
        { id: 1, event: 'League workspace opened', at: 'Now' }
    ]);

    const [rosterSlots, setRosterSlots] = useState({
        C: 1, '1B': 1, '2B': 1, '3B': 1, SS: 1, OF: 3, UTIL: 1, SP: 5, RP: 3, BENCH: 6
    });

    const [scoringCats, setScoringCats] = useState({
        R: true, HR: true, RBI: true, SB: true, AVG: true, W: true, SV: true, K: true, ERA: true, WHIP: true
    });

    const [playerPool, setPlayerPool] = useState({
        mlbOnly: true,
        includeProspects: false,
        includeMinors: false,
        strictEligibility: true
    });

    useEffect(() => {
        const loadLeague = async () => {
            setLoading(true);
            setLoadError('');
            const res = await leaguesRequestSender.getMyLeagues();
            if (res.status !== 200 || !res.data?.success) {
                setLoadError(res.data?.errorMessage || 'Unable to load league.');
                setLoading(false);
                return;
            }
            const found = (res.data.leagues || []).find((l) => l._id === leagueId);
            if (!found) {
                setLoadError('League not found.');
                setLoading(false);
                return;
            }
            setLeague(found);
            setLoading(false);
        };
        loadLeague();
    }, [leagueId]);

    const totalRosterSlots = useMemo(
        () => Object.values(rosterSlots).reduce((sum, n) => sum + Number(n || 0), 0),
        [rosterSlots]
    );

    const addAudit = (event) => {
        setAuditLog((prev) => [{ id: Date.now(), event, at: new Date().toLocaleString() }, ...prev].slice(0, 12));
    };

    const updateSlot = (slot, value) => {
        const next = Math.max(0, Number(value || 0));
        setRosterSlots((prev) => ({ ...prev, [slot]: next }));
    };

    const approveManager = (id) => {
        setPendingManagers((prev) => prev.filter((m) => m.id !== id));
        addAudit('Manager approved');
    };

    const removeManager = (id) => {
        setPendingManagers((prev) => prev.filter((m) => m.id !== id));
        addAudit('Manager removed');
    };

    const broadcastAnnouncement = () => {
        if (!announcement.trim()) return;
        addAudit('Commissioner announcement broadcast');
        setAnnouncement('');
    };

    if (loading) {
        return <main className="page-shell">Loading league...</main>;
    }

    if (loadError || !league) {
        return (
            <main className="page-shell">
                <p>{loadError || 'League not found.'}</p>
                <button className="home-light-btn" type="button" onClick={() => history.push('/home')}>Back to Home</button>
            </main>
        );
    }

    return (
        <main className="commissioner-workspace-page">
            <section className="home-card commissioner-workspace-header">
                <button type="button" className="home-light-btn compact-btn" onClick={() => history.push('/home')}>
                 ←
                </button>
                <div>
                    <h2>{league.name}</h2>
                    <p>{league.numberOfTeams || 12} teams • {league.draftType || 'Auction'} • {league.leagueMode || 'Redraft'}</p>
                </div>
                
            </section>

            <section className="commissioner-workspace-grid">
                <article className="home-card commissioner-module">
                    <h3><GroupAddOutlinedIcon sx={{ fontSize: 22 }} /> League and Member Management</h3>
                    <p>Invite managers and control participation for your league.</p>
                    <div className="inline-field-row">
                        <input type="email" className="home-input" placeholder="manager@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                        <button className="home-light-btn compact-btn" type="button" onClick={() => addAudit('Invite sent')}>Send Invite</button>
                    </div>
                    <div className="manager-list">
                        {pendingManagers.length === 0 ? <p className="empty-inline">No pending approvals</p> : pendingManagers.map((m) => (
                            <div key={m.id} className="manager-row">
                                <span>{m.name}</span>
                                <div className="manager-actions">
                                    <button type="button" className="mini-pill approve" onClick={() => approveManager(m.id)}>Approve</button>
                                    <button type="button" className="mini-pill remove" onClick={() => removeManager(m.id)}>Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="home-card commissioner-module">
                    <h3><ManageSearchRoundedIcon sx={{ fontSize: 22 }} /> League Rules and Configuration</h3>
                    <p>Roster slots, scoring categories, player pool, budget, keepers, and the rules page.</p>
                    <div className="config-grid">
                        <div>
                            <h4>Roster Slots</h4>
                            <div className="slot-grid">
                                {Object.entries(rosterSlots).map(([slot, value]) => (
                                    <label key={slot}>
                                        <span>{slot}</span>
                                        <input type="number" min="0" value={value} onChange={(e) => updateSlot(slot, e.target.value)} />
                                    </label>
                                ))}
                            </div>
                            <p className="hint">Total slots: {totalRosterSlots}</p>
                        </div>
                        <div>
                            <h4>Scoring Categories</h4>
                            <div className="chip-grid">
                                {Object.keys(scoringCats).map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={`toggle-chip ${scoringCats[cat] ? 'on' : ''}`}
                                        onClick={() => setScoringCats((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <h4>Player Pool Rules</h4>
                            <div className="checkbox-stack">
                                {[
                                    ['mlbOnly', 'MLB-only'],
                                    ['includeProspects', 'Include prospects'],
                                    ['includeMinors', 'Include minors'],
                                    ['strictEligibility', 'Strict eligibility rules']
                                ].map(([key, label]) => (
                                    <label key={key}>
                                        <input
                                            type="checkbox"
                                            checked={playerPool[key]}
                                            onChange={(e) => setPlayerPool((prev) => ({ ...prev, [key]: e.target.checked }))}
                                        />
                                        <span>{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="inline-field-row three-up">
                        <label><span>Auction Budget</span><input type="number" value={auctionBudget} onChange={(e) => setAuctionBudget(e.target.value)} /></label>
                        <label><span>Max Per Player</span><input type="number" value={maxPerPlayer} onChange={(e) => setMaxPerPlayer(e.target.value)} /></label>
                        <label><span>Keeper Limit</span><input type="number" value={keeperLimit} onChange={(e) => setKeeperLimit(e.target.value)} /></label>
                    </div>
                    <div className="inline-field-row">
                        <label className="full-width"><span>Keeper Deadline</span><input type="datetime-local" value={keeperDeadline} onChange={(e) => setKeeperDeadline(e.target.value)} /></label>
                    </div>
                    <label>Rules Page</label>
                    <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} className="rules-editor" />
                    <button type="button" className="home-dark-btn" onClick={() => addAudit('League configuration updated')}>Save Configuration</button>
                </article>

                <article className="home-card commissioner-module">
                    <h3><GavelRoundedIcon sx={{ fontSize: 22 }} /> Draft Operations</h3>
                    <p>Schedule draft, tune timers, lock settings, send announcements, pause/resume, edit picks, and finalize.</p>
                    <div className="inline-field-row three-up">
                        <label><span>Draft Date/Time</span><input type="datetime-local" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} /></label>
                        <label><span>Start Window (min)</span><input type="number" value={draftWindow} onChange={(e) => setDraftWindow(e.target.value)} /></label>
                        <label><span>Nomination Timer</span><input type="number" value={nominationTimer} onChange={(e) => setNominationTimer(e.target.value)} /></label>
                    </div>
                    <div className="inline-field-row three-up">
                        <label><span>Bid Timer</span><input type="number" value={bidTimer} onChange={(e) => setBidTimer(e.target.value)} /></label>
                        <label><span>Extra Seconds on New Bid</span><input type="number" value={extraBidSeconds} onChange={(e) => setExtraBidSeconds(e.target.value)} /></label>
                        <label className="switch-wrap"><span>Lock Settings At Draft Start</span><input type="checkbox" checked={settingsLocked} onChange={(e) => setSettingsLocked(e.target.checked)} /></label>
                    </div>
                    <div className="inline-field-row">
                        <input className="home-input" placeholder="Commissioner announcement..." value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
                        <button className="home-light-btn compact-btn" type="button" onClick={broadcastAnnouncement}><CampaignRoundedIcon sx={{ fontSize: 18 }} /> Broadcast</button>
                    </div>
                    <div className="inline-btn-row">
                        <button type="button" className="home-light-btn compact-btn" onClick={() => { setDraftPaused(true); addAudit('Draft paused'); }}><PauseCircleOutlineRoundedIcon sx={{ fontSize: 18 }} /> Pause Draft</button>
                        <button type="button" className="home-light-btn compact-btn" onClick={() => { setDraftPaused(false); addAudit('Draft resumed'); }}><RestartAltRoundedIcon sx={{ fontSize: 18 }} /> Resume Draft</button>
                        <button type="button" className="home-light-btn compact-btn" onClick={() => addAudit('Draft pick edited and budgets re-synced')}>Edit Draft Pick</button>
                        <button type="button" className="home-dark-btn compact-btn" onClick={() => addAudit('Draft finalized and locked')}><CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} /> Finalize Draft</button>
                    </div>
                    <p className="hint">Draft status: {draftPaused ? 'Paused' : 'Running'} | Settings lock: {settingsLocked ? 'Enabled' : 'Disabled'}</p>
                </article>

                <article className="home-card commissioner-module">
                    <h3><HistoryRoundedIcon sx={{ fontSize: 22 }} /> Audit, Export, and Reminders</h3>
                    <p>Track commissioner actions, export results, and monitor keeper reminders.</p>
                    <button type="button" className="home-light-btn compact-btn" onClick={() => addAudit('Draft board export started')}><FileDownloadOutlinedIcon sx={{ fontSize: 18 }} /> Export Draft Board CSV</button>
                    <div className="audit-list">
                        {auditLog.map((item) => (
                            <div className="audit-row" key={item.id}>
                                <span>{item.event}</span>
                                <time>{item.at}</time>
                            </div>
                        ))}
                    </div>
                    <p className="hint">Keeper reminders are enabled for 7 days and 24 hours before deadline.</p>
                </article>
            </section>
        </main>
    );
};

export default CommissionerLeagueScreen;
