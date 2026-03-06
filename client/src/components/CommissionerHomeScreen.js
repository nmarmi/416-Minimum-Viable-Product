import { useMemo, useState } from 'react';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
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

const CommissionerHomeScreen = () => {
    const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [seasonYear, setSeasonYear] = useState('2026');
    const [numTeams, setNumTeams] = useState(12);
    const [draftType, setDraftType] = useState('Auction');
    const [leagueMode, setLeagueMode] = useState('Redraft');
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
    const [creatingLeague, setCreatingLeague] = useState(false);

    const [pendingManagers, setPendingManagers] = useState([
        { id: 1, name: 'Manager A', status: 'Pending' },
        { id: 2, name: 'Manager B', status: 'Pending' }
    ]);

    const [auditLog, setAuditLog] = useState([
        { id: 1, event: 'Commissioner workspace initialized', at: 'Today 10:14 AM' }
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

    const generateInviteCode = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setInviteCode(code);
    };

    const createLeague = async () => {
        if (!leagueName.trim()) {
            addAudit('Create league failed: League name is required');
            return;
        }

        setCreatingLeague(true);
        const payload = {
            name: leagueName.trim(),
            inviteCode: inviteCode.trim() || undefined,
            seasonYear,
            numberOfTeams: numTeams,
            draftType,
            leagueMode
        };

        const res = await leaguesRequestSender.createLeague(payload);
        setCreatingLeague(false);

        if (res.status !== 201 || !res.data?.success) {
            addAudit(res.data?.errorMessage || 'Create league failed');
            return;
        }

        const createdCode = res.data.league?.inviteCode || inviteCode || 'Auto-generated';
        addAudit(`League "${leagueName || 'Untitled'}" created (${draftType}, ${leagueMode}, ${numTeams} teams) | Invite code: ${createdCode}`);
        setLeagueName('');
        setInviteCode('');
        setShowCreateLeagueModal(false);
    };

    const broadcastAnnouncement = () => {
        if (!announcement.trim()) return;
        addAudit('Commissioner announcement broadcast');
        setAnnouncement('');
    };

    return (
        <main className="app-home commissioner-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>Create Leagues</h2>
                   
                    <button className="home-dark-btn" type="button" onClick={() => setShowCreateLeagueModal(true)}>
                        Create League
                    </button>
                </article>

                <article className="home-card">
                    <h2>Join Draft</h2>
                    <p>Enter an invite code to join a draft room</p>
                    <label htmlFor="commissionerInviteCode">Invite Code</label>
                    <input id="commissionerInviteCode" name="commissionerInviteCode" type="text" className="home-input" />
                    <button className="home-dark-btn" type="button">
                        <PlayCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                        <span>Join Draft Room</span>
                    </button>
                </article>

                <article className="home-card">
                    <h3 className="home-team-title">
                        <EmojiEventsOutlinedIcon sx={{ fontSize: 24 }} />
                        <span>My Team</span>
                    </h3>
                    <p className="home-team-copy">Create or customize your team</p>
                    <button className="home-light-btn" type="button">Setup Team</button>
                </article>
            </section>

            <section className="home-right-column commissioner-sections">
                <article className="home-card commissioner-module">
                    <h3><GroupAddOutlinedIcon sx={{ fontSize: 22 }} /> League and Member Management</h3>
                    <p>Invite managers and control participation for your league.</p>
                    <div className="inline-field-row">
                        <input
                            type="email"
                            className="home-input"
                            placeholder="manager@email.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                        />
                        <button className="home-light-btn compact-btn" type="button" onClick={() => addAudit('Invite sent')}>
                            Send Invite
                        </button>
                    </div>
                    <div className="manager-list">
                        {pendingManagers.length === 0 ? (
                            <p className="empty-inline">No pending approvals</p>
                        ) : pendingManagers.map((m) => (
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
                        <label>
                            <span>Auction Budget</span>
                            <input type="number" value={auctionBudget} onChange={(e) => setAuctionBudget(e.target.value)} />
                        </label>
                        <label>
                            <span>Max Per Player</span>
                            <input type="number" value={maxPerPlayer} onChange={(e) => setMaxPerPlayer(e.target.value)} />
                        </label>
                        <label>
                            <span>Keeper Limit</span>
                            <input type="number" value={keeperLimit} onChange={(e) => setKeeperLimit(e.target.value)} />
                        </label>
                    </div>
                    <div className="inline-field-row">
                        <label className="full-width">
                            <span>Keeper Deadline</span>
                            <input type="datetime-local" value={keeperDeadline} onChange={(e) => setKeeperDeadline(e.target.value)} />
                        </label>
                    </div>
                    <label>Rules Page</label>
                    <textarea
                        value={rulesText}
                        onChange={(e) => setRulesText(e.target.value)}
                        className="rules-editor"
                    />
                    <button type="button" className="home-dark-btn" onClick={() => addAudit('League configuration updated')}>
                        Save Configuration
                    </button>
                </article>

                <article className="home-card commissioner-module">
                    <h3><GavelRoundedIcon sx={{ fontSize: 22 }} /> Draft Operations</h3>
                    <p>Schedule draft, tune timers, lock settings, send announcements, pause/resume, edit picks, and finalize.</p>
                    <div className="inline-field-row three-up">
                        <label>
                            <span>Draft Date/Time</span>
                            <input type="datetime-local" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
                        </label>
                        <label>
                            <span>Start Window (min)</span>
                            <input type="number" value={draftWindow} onChange={(e) => setDraftWindow(e.target.value)} />
                        </label>
                        <label>
                            <span>Nomination Timer</span>
                            <input type="number" value={nominationTimer} onChange={(e) => setNominationTimer(e.target.value)} />
                        </label>
                    </div>
                    <div className="inline-field-row three-up">
                        <label>
                            <span>Bid Timer</span>
                            <input type="number" value={bidTimer} onChange={(e) => setBidTimer(e.target.value)} />
                        </label>
                        <label>
                            <span>Extra Seconds on New Bid</span>
                            <input type="number" value={extraBidSeconds} onChange={(e) => setExtraBidSeconds(e.target.value)} />
                        </label>
                        <label className="switch-wrap">
                            <span>Lock Settings At Draft Start</span>
                            <input type="checkbox" checked={settingsLocked} onChange={(e) => setSettingsLocked(e.target.checked)} />
                        </label>
                    </div>
                    <div className="inline-field-row">
                        <input
                            className="home-input"
                            placeholder="Commissioner announcement..."
                            value={announcement}
                            onChange={(e) => setAnnouncement(e.target.value)}
                        />
                        <button className="home-light-btn compact-btn" type="button" onClick={broadcastAnnouncement}>
                            <CampaignRoundedIcon sx={{ fontSize: 18 }} /> Broadcast
                        </button>
                    </div>
                    <div className="inline-btn-row">
                        <button type="button" className="home-light-btn compact-btn" onClick={() => { setDraftPaused(true); addAudit('Draft paused'); }}>
                            <PauseCircleOutlineRoundedIcon sx={{ fontSize: 18 }} /> Pause Draft
                        </button>
                        <button type="button" className="home-light-btn compact-btn" onClick={() => { setDraftPaused(false); addAudit('Draft resumed'); }}>
                            <RestartAltRoundedIcon sx={{ fontSize: 18 }} /> Resume Draft
                        </button>
                        <button type="button" className="home-light-btn compact-btn" onClick={() => addAudit('Draft pick edited and budgets re-synced')}>
                            Edit Draft Pick
                        </button>
                        <button type="button" className="home-dark-btn compact-btn" onClick={() => addAudit('Draft finalized and locked')}>
                            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} /> Finalize Draft
                        </button>
                    </div>
                    <p className="hint">Draft status: {draftPaused ? 'Paused' : 'Running'} | Settings lock: {settingsLocked ? 'Enabled' : 'Disabled'}</p>
                </article>

                <article className="home-card commissioner-module">
                    <h3><HistoryRoundedIcon sx={{ fontSize: 22 }} /> Audit, Export, and Reminders</h3>
                    <p>Track commissioner actions, export results, and monitor keeper reminders.</p>
                    <button type="button" className="home-light-btn compact-btn" onClick={() => addAudit('Draft board export started')}>
                        <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} /> Export Draft Board CSV
                    </button>
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

            {showCreateLeagueModal ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card league-modal-card">
                        <h3>Create League</h3>
                        <p>Set league basics before inviting managers.</p>
                        <div className="league-modal-grid">
                            <label>
                                <span>League Name</span>
                                <input type="text" value={leagueName} onChange={(e) => setLeagueName(e.target.value)} />
                            </label>
                            <label>
                                <span>Invite Code</span>
                                <div className="inline-field-row modal-invite-row">
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                 
                                    />
                                    <button type="button" className="home-light-btn compact-btn" onClick={generateInviteCode}>
                                        Generate
                                    </button>
                                </div>
                            </label>
                            <label>
                                <span>Season Year</span>
                                <div className="input-with-icon modal-field">
                                    <input type="text" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} className="home-input compact" />
                                    <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />
                                </div>
                            </label>
                            <label>
                                <span>Number of Teams</span>
                                <div className="team-count-row modal-count-row">
                                    <input
                                        type="text"
                                        className="home-input compact"
                                        value={numTeams}
                                        onChange={(e) => setNumTeams(Number(e.target.value || 0))}
                                    />
                                    <button type="button" className="count-btn" onClick={() => setNumTeams((n) => Math.max(2, n - 1))}>-</button>
                                    <button type="button" className="count-btn" onClick={() => setNumTeams((n) => n + 1)}>+</button>
                                </div>
                            </label>
                            <label>
                                <span>Draft Type</span>
                                <select value={draftType} onChange={(e) => setDraftType(e.target.value)} className="pill-select native">
                                    <option>Auction</option>
                                    <option>Snake</option>
                                </select>
                            </label>
                            <label>
                                <span>League Mode</span>
                                <select value={leagueMode} onChange={(e) => setLeagueMode(e.target.value)} className="pill-select native">
                                    <option>Redraft</option>
                                    <option>Keeper</option>
                                </select>
                            </label>
                        </div>
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => setShowCreateLeagueModal(false)}>Cancel</button>
                            <button type="button" className="home-dark-btn" onClick={createLeague} disabled={creatingLeague}>
                                {creatingLeague ? 'Creating...' : 'Create League'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
};

export default CommissionerHomeScreen;
