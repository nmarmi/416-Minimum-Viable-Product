import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getPlayers, postUsage } from '../players/requests';

const ROSTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'SP', 'RP'];
const TABS = ['Players', 'My Roster', 'Draft Board', 'Teams', 'Settings'];
const TABLE_HEADERS = ['Player', 'Team', 'Pos', 'Value', 'ADP', 'HR', 'RBI', 'R', 'SB', 'AVG', 'W', 'SV', 'K', 'ERA', 'WHIP'];
const TEAM_PLACEHOLDERS = ['Your Team', 'Example 1', 'Example 2', 'Example 3'];

const formatStat = (val) => (val != null && Number.isFinite(val) ? (Number(val) === val && val < 1 && val > 0 ? val.toFixed(3) : String(Math.round(val))) : '--');

const DraftRoomScreen = () => {
    const history = useHistory();
    const [activeTab, setActiveTab] = useState('Players');
    const [entryPlayer, setEntryPlayer] = useState('');
    const [entryNominatedBy, setEntryNominatedBy] = useState('Your Team');
    const [entryWonBy, setEntryWonBy] = useState('Your Team');
    const [entryPrice, setEntryPrice] = useState('');
    const [entryNotes, setEntryNotes] = useState('');
    const [players, setPlayers] = useState([]);
    const [playersTotal, setPlayersTotal] = useState(0);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [playersError, setPlayersError] = useState('');
    const [playerSearch, setPlayerSearch] = useState('');

    const loadPlayers = useCallback(async () => {
        setPlayersLoading(true);
        setPlayersError('');
        const res = await getPlayers({ search: playerSearch.trim(), limit: 500 });
        setPlayersLoading(false);
        if (res.status === 200 && res.data?.success) {
            setPlayers(res.data.players || []);
            setPlayersTotal(res.data.total ?? 0);
            setPlayersError('');
        } else {
            setPlayersError(res.data?.errorMessage || 'Failed to load players.');
            setPlayers([]);
            setPlayersTotal(0);
        }
    }, [playerSearch]);

    useEffect(() => {
        if (activeTab !== 'Players') return;
        loadPlayers();
    }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps -- load on tab switch; Search button triggers loadPlayers()

    useEffect(() => {
        postUsage({ event: 'draft_room_open' }).catch(() => {});
    }, []);

    const renderPlayersTab = () => (
        <>
            <div className="draft-v2-module-grid two-col">
                <article className="draft-v2-module-card">
                    <h3>Player Search & Filters</h3>
                    <label className="draft-v2-search-wrap">
                        <span className="draft-v2-search-icon">⌕</span>
                        <input
                            type="text"
                            placeholder="Search players"
                            value={playerSearch}
                            onChange={(e) => setPlayerSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadPlayers()}
                        />
                    </label>
                    <button type="button" className="draft-v2-filter-btn" onClick={loadPlayers}>Search</button>
                    <div className="draft-v2-filter-row">
                        <button type="button" className="draft-v2-filter-btn">All</button>
                        <button type="button" className="draft-v2-filter-btn">Watchlist (0)</button>
                        <button type="button" className="draft-v2-filter-btn">All Tags</button>
                    </div>
                </article>

                <article className="draft-v2-module-card">
                    <h3>Player Profile & Glossary</h3>
                    <ul className="draft-v2-checklist">
                        <li>Projected stats</li>
                        <li>Role (starter / reliever / everyday)</li>
                        <li>Injury / news flags</li>
                        <li>Position eligibility</li>
                        <li>In-app glossary tooltips</li>
                    </ul>
                    <p className="draft-v2-auction-muted">Stats from projection data. Pitcher columns (W, SV, ERA, WHIP) show -- for batters.</p>
                </article>
            </div>

            <div className="draft-v2-table-shell">
                <div className="draft-v2-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                {TABLE_HEADERS.map((header) => (
                                    <th key={header}>{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {playersLoading ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length} className="draft-v2-empty-row">Loading players…</td>
                                </tr>
                            ) : playersError ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length} className="draft-v2-empty-row">{playersError}</td>
                                </tr>
                            ) : players.length === 0 ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length} className="draft-v2-empty-row">
                                        No players found. Start the Player Data API (port 4001) and ensure PLAYER_API_URL and PLAYER_API_KEY are set in server/.env.
                                    </td>
                                </tr>
                            ) : (
                                players.map((p) => (
                                    <tr key={p.id || p._id || `${p.playerName}-${p.team}`}>
                                        <td>{p.playerName}</td>
                                        <td>{p.team}</td>
                                        <td>{p.position}</td>
                                        <td>{formatStat(p.fpts)}</td>
                                        <td>--</td>
                                        <td>{formatStat(p.hr)}</td>
                                        <td>{formatStat(p.rbi)}</td>
                                        <td>{formatStat(p.r)}</td>
                                        <td>{formatStat(p.sb)}</td>
                                        <td>{p.avg != null ? Number(p.avg).toFixed(3) : '--'}</td>
                                        <td>--</td>
                                        <td>--</td>
                                        <td>{formatStat(p.k)}</td>
                                        <td>--</td>
                                        <td>--</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    const renderRosterTab = () => (
        <section className="draft-v2-module-grid two-col">
            <article className="draft-v2-module-card">
                <h3>My Roster Overview</h3>
                <p className="draft-v2-auction-muted">Your full roster and slot status will appear here once draft picks are recorded.</p>
                <div className="draft-v2-empty-box">No rostered players yet.</div>
            </article>

            <article className="draft-v2-module-card">
                <h3>Keepers & Bench Strategy</h3>
                <ul className="draft-v2-checklist">
                    <li>Mark keepers and salary</li>
                    <li>Starter vs bench prioritization</li>
                    <li>Remaining slot needs by position</li>
                </ul>
            </article>

            <article className="draft-v2-module-card full">
                <h3>Draft Recap & Export</h3>
                <p className="draft-v2-auction-muted">This area will show final roster, spend, bargains/overpays, and CSV export controls.</p>
                <div className="draft-v2-empty-box">No recap yet. Complete draft to populate.</div>
            </article>
        </section>
    );

    const renderDraftBoardTab = () => (
        <section className="draft-v2-module-grid two-col">
            <article className="draft-v2-module-card full">
                <h3>Draft Entry</h3>
                <p className="draft-v2-auction-muted">
                    Enter each completed pick as the real draft happens.
                </p>
                <div className="draft-v2-module-grid two-col">
                    <label className="draft-v2-field">
                        <span>Player Taken</span>
                        <input
                            type="text"
                            placeholder="e.g., Aaron Judge"
                            value={entryPlayer}
                            onChange={(e) => setEntryPlayer(e.target.value)}
                        />
                    </label>
                    <label className="draft-v2-field">
                        <span>Auctioned By</span>
                        <select value={entryNominatedBy} onChange={(e) => setEntryNominatedBy(e.target.value)}>
                            {TEAM_PLACEHOLDERS.map((team) => (
                                <option key={team}>{team}</option>
                            ))}
                        </select>
                    </label>
                    <label className="draft-v2-field">
                        <span>Won By</span>
                        <select value={entryWonBy} onChange={(e) => setEntryWonBy(e.target.value)}>
                            {TEAM_PLACEHOLDERS.map((team) => (
                                <option key={team}>{team}</option>
                            ))}
                        </select>
                    </label>
                    <label className="draft-v2-field">
                        <span>Winning Price ($)</span>
                        <input
                            type="number"
                            min="1"
                            placeholder="e.g., 37"
                            value={entryPrice}
                            onChange={(e) => setEntryPrice(e.target.value)}
                        />
                    </label>
                    <label className="draft-v2-field full">
                        <span>Notes (Optional)</span>
                        <input
                            type="text"
                            placeholder="Keeper, tie-break, injury note, etc."
                            value={entryNotes}
                            onChange={(e) => setEntryNotes(e.target.value)}
                        />
                    </label>
                </div>
                <div className="draft-v2-auction-actions">
                    <button type="button" className="draft-v2-auction-btn" disabled>
                        Save Pick 
                    </button>
                </div>
            </article>

            <article className="draft-v2-module-card">
                <h3>Draft Results Log</h3>
                <div className="draft-v2-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th>Auctioned By</th>
                                <th>Won By</th>
                                <th>Price</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td colSpan={6} className="draft-v2-empty-row">
                                    No picks logged yet. Enter each completed draft result here during the live draft.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </article>

            <article className="draft-v2-module-card">
                <h3>Live Draft Snapshot</h3>
                <ul className="draft-v2-checklist">
                    <li>Available players remaining: <strong>{playersTotal || '--'}</strong></li>
                    <li>Team budgets after each saved pick</li>
                    <li>Value shifts after each saved pick</li>
                </ul>
                <p className="draft-v2-auction-muted">These values update after each manual entry once actions are connected.</p>
            </article>
        </section>
    );

    const renderTeamsTab = () => (
        <section className="draft-v2-module-grid one-col">
            <article className="draft-v2-module-card">
                <h3>Team Budget Tracking</h3>
                <div className="draft-v2-team-board">
                    {TEAM_PLACEHOLDERS.map((team) => (
                        <div key={team} className="draft-v2-team-row">
                            <span>{team}</span>
                            <span>Budget: --</span>
                            <span>Max Bid: --</span>
                            <span>Spots: --</span>
                        </div>
                    ))}
                </div>
            </article>
            <article className="draft-v2-module-card">
                <h3>Team Roster Tracking & Alerts</h3>
                <ul className="draft-v2-checklist">
                    <li>Filled positions by team</li>
                    <li>Scarcity alerts by position</li>
                    <li>Endgame demand indicator</li>
                </ul>
            </article>
        </section>
    );

    const renderSettingsTab = () => (
        <section className="draft-v2-module-grid two-col">
            <article className="draft-v2-module-card">
                <h3>League Settings View</h3>
                <ul className="draft-v2-checklist">
                    <li>Total budget</li>
                    <li>Roster positions</li>
                    <li>Scoring categories</li>
                    <li>Eligibility rules</li>
                </ul>
            </article>

            <article className="draft-v2-module-card">
                <h3>Draft Configuration</h3>
                <ul className="draft-v2-checklist">
                    <li>Manual entry workflow preferences</li>
                    <li>Log fields shown during draft</li>
                    <li>Lock settings when draft starts</li>
                </ul>
            </article>

            <article className="draft-v2-module-card full">
                <h3>API-Backed Areas (Pending)</h3>
                <p className="draft-v2-auction-muted">Player news, injury updates, live values, recommendation engine, and final exports will appear after backend integration.</p>
            </article>
        </section>
    );

    const renderTabContent = () => {
        if (activeTab === 'Players') return renderPlayersTab();
        if (activeTab === 'My Roster') return renderRosterTab();
        if (activeTab === 'Draft Board') return renderDraftBoardTab();
        if (activeTab === 'Teams') return renderTeamsTab();
        return renderSettingsTab();
    };

    return (
        <main className="draft-v2-page">
            <header className="draft-v2-header">
                <button type="button" className="draft-v2-icon-btn" aria-label="Back" onClick={() => history.goBack()}>
                    ←
                </button>

                <div className="draft-v2-title-wrap">
                    <h1>2026 Fantasy Baseball League</h1>
                    <p>Welcome back. Draft room data will appear once API integration is enabled.</p>
                </div>

                <div className="draft-v2-header-actions">
                    <span className="league-status active">Active</span>
                    <button type="button" className="draft-v2-icon-btn" aria-label="Undo">⟲</button>
                    <button type="button" className="draft-v2-icon-btn" aria-label="Export">⬇︎</button>
                </div>
            </header>

            <section className="draft-v2-top-controls">
                <div className="draft-v2-tabs" role="tablist" aria-label="Draft navigation tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab}
                            className={`draft-v2-tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </section>

            <section className="draft-v2-body">
                <aside className="draft-v2-sidebar">
                    <article className="draft-v2-card">
                        <h2>$ Budget Tracker</h2>
                        <div className="draft-v2-metric-row">
                            <span>Remaining Budget</span>
                            <strong>--</strong>
                        </div>
                        <div className="draft-v2-meter" />
                        <p className="draft-v2-muted">Awaiting draft data from API</p>
                        <div className="draft-v2-divider" />
                        <div className="draft-v2-metric-row">
                            <span>Maximum Bid</span>
                            <strong>--</strong>
                        </div>
                        <div className="draft-v2-stat-grid">
                            <div>
                                <span>Avg $/Player</span>
                                <strong>--</strong>
                            </div>
                            <div>
                                <span>Avg Budget/Slot</span>
                                <strong>--</strong>
                            </div>
                        </div>
                    </article>

                    <article className="draft-v2-card draft-v2-planner-card">
                        <h2>Roster Planning</h2>
                        <div className="draft-v2-roster-list">
                            {ROSTER_POSITIONS.map((pos) => (
                                <div key={pos} className="draft-v2-roster-row">
                                    <span>{pos}</span>
                                    <span className="draft-v2-muted">0 / 1</span>
                                    <span className="draft-v2-need-pill">Need 1</span>
                                </div>
                            ))}
                        </div>
                        <div className="draft-v2-next-priority">Next Priority: TBD</div>
                    </article>

                    <article className="draft-v2-card">
                        <h2>Recommendations</h2>
                        <div className="draft-v2-empty-box">Recommendations will appear after player pool data loads.</div>
                    </article>
                </aside>

                <section className="draft-v2-main">
                    <div className="draft-v2-main-head">
                        <h2>{activeTab === 'Players' ? 'Player Pool' : activeTab}</h2>
                        {activeTab === 'Players' ? <span className="draft-v2-count-pill">{playersTotal} Players</span> : null}
                    </div>
                    {renderTabContent()}
                </section>
            </section>
        </main>
    );
};

export default DraftRoomScreen;
