import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

const ROSTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'SP', 'RP'];
const TABS = ['Players', 'My Roster', 'Draft Board', 'Teams', 'Settings'];
const TABLE_HEADERS = ['Player', 'Team', 'Pos', 'Value', 'ADP', 'HR', 'RBI', 'R', 'SB', 'AVG', 'W', 'SV', 'K', 'ERA', 'WHIP'];
const TIMER_SECONDS = 40;
const TEAM_PLACEHOLDERS = ['Your Team', 'Example 1', 'Example 2', 'Example 3'];
const EVENT_PLACEHOLDERS = [
    'Nomination started...',
    'Highest bid updates will appear here...',
    'Sold events will be listed here...'
];

const DraftRoomScreen = () => {
    const history = useHistory();
    const [activeTab, setActiveTab] = useState('Players');
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [nominatedPlayer, setNominatedPlayer] = useState('');
    const [openingBid, setOpeningBid] = useState('1');
    const [nominatingTeam, setNominatingTeam] = useState('Your Team');
    const [bidAmount, setBidAmount] = useState('2');
    const [selectedBidder, setSelectedBidder] = useState('Your Team');
    const [auctionStatus, setAuctionStatus] = useState('Waiting for nomination');

    useEffect(() => {
        if (!isTimerRunning) return undefined;

        const tick = window.setInterval(() => {
            setTimeLeft((previous) => {
                if (previous <= 1) {
                    window.clearInterval(tick);
                    setIsTimerRunning(false);
                    setAuctionStatus('Timer ended (mock). Mark sold or undo.');
                    return 0;
                }
                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(tick);
    }, [isTimerRunning]);

    const timerPercent = useMemo(() => ((TIMER_SECONDS - timeLeft) / TIMER_SECONDS) * 100, [timeLeft]);

    const renderPlayersTab = () => (
        <>
            <div className="draft-v2-module-grid two-col">
                <article className="draft-v2-module-card">
                    <h3>Player Search & Filters</h3>
                    <label className="draft-v2-search-wrap">
                        <span className="draft-v2-search-icon">⌕</span>
                        <input type="text" placeholder="Search players" />
                    </label>
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
                    <p className="draft-v2-auction-muted">UI placeholders only until player data API is connected.</p>
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
                            <tr>
                                <td colSpan={TABLE_HEADERS.length} className="draft-v2-empty-row">
                                    Player pool data will render here once API integration is ready.
                                </td>
                            </tr>
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
            <article className="draft-v2-auction-card full">
               
                <p className="draft-v2-auction-muted">Step 1: Nominate player. Step 2: Run live bidding. Step 3: Record purchase.</p>

                <section className="draft-v2-workflow-step">
                    <h4>1. Auction Nomination</h4>
                    <label className="draft-v2-field">
                        <span>Player Name</span>
                        <input
                            type="text"
                            placeholder="Enter player to nominate"
                            value={nominatedPlayer}
                            onChange={(e) => setNominatedPlayer(e.target.value)}
                        />
                    </label>
                    <div className="draft-v2-auction-row">
                        <label className="draft-v2-field">
                            <span>Opening Bid</span>
                            <input type="number" min="1" value={openingBid} onChange={(e) => setOpeningBid(e.target.value)} />
                        </label>
                        <label className="draft-v2-field">
                            <span>Nominating Team</span>
                            <select value={nominatingTeam} onChange={(e) => setNominatingTeam(e.target.value)}>
                                {TEAM_PLACEHOLDERS.map((team) => (
                                    <option key={team}>{team}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <button
                        type="button"
                        className="draft-v2-auction-btn"
                        onClick={() => {
                            setTimeLeft(TIMER_SECONDS);
                            setIsTimerRunning(true);
                            setAuctionStatus('Nomination started (mock)');
                        }}
                    >
                        Start Auction
                    </button>
                </section>

                <section className="draft-v2-workflow-step">
                    <h4>2. Live Bidding</h4>
                    <div className="draft-v2-timer-row draft-v2-timer-row-inline">
                        <span className="draft-v2-timer-icon">◷</span>
                        <div className="draft-v2-timer-bar">
                            <div className="draft-v2-timer-progress" style={{ width: `${timerPercent}%` }} />
                        </div>
                        <span className="draft-v2-timer-pill">{timeLeft}s</span>
            
                    </div>
                    <div className="draft-v2-live-top">
                        <div>
                            <p className="draft-v2-label">Current Player</p>
                            <strong>{nominatedPlayer || '--'}</strong>
                        </div>
                        <div>
                            <p className="draft-v2-label">Current Bid</p>
                            <strong>${bidAmount || '--'}</strong>
                        </div>
                        <div>
                            <p className="draft-v2-label">Leader</p>
                            <strong>{selectedBidder}</strong>
                        </div>
                    </div>
                    <div className="draft-v2-quick-bids">
                        <button type="button" onClick={() => setBidAmount('1')}>+1</button>
                        <button type="button" onClick={() => setBidAmount('2')}>+2</button>
                        <button type="button" onClick={() => setBidAmount('5')}>+5</button>
                        <button type="button" onClick={() => setBidAmount('10')}>+10</button>
                    </div>
                    <div className="draft-v2-auction-row">
                        <label className="draft-v2-field">
                            <span>Bidder</span>
                            <select value={selectedBidder} onChange={(e) => setSelectedBidder(e.target.value)}>
                                {TEAM_PLACEHOLDERS.map((team) => (
                                    <option key={team}>{team}</option>
                                ))}
                            </select>
                        </label>
                        <label className="draft-v2-field">
                            <span>Custom Bid</span>
                            <input type="number" min="1" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
                        </label>
                    </div>
                    <div className="draft-v2-auction-actions">
                        <button type="button" className="draft-v2-auction-btn" onClick={() => setAuctionStatus('Bid placed (mock)')}>
                            Place Bid
                        </button>
                        <button
                            type="button"
                            className="draft-v2-auction-btn light"
                            onClick={() => {
                                setIsTimerRunning(false);
                                setAuctionStatus('Player marked sold (mock)');
                            }}
                        >
                            Mark Sold
                        </button>
                    </div>
                </section>

                <section className="draft-v2-workflow-step">
                    <h4>3. Record Purchase</h4>
                    <p className="draft-v2-auction-status">{auctionStatus}</p>
                    <div className="draft-v2-auction-actions">
                        <button
                            type="button"
                            className="draft-v2-auction-btn"
                            onClick={() => {
                                setIsTimerRunning(false);
                                setTimeLeft(TIMER_SECONDS);
                                setAuctionStatus('Purchase recorded (mock)');
                            }}
                        >
                            Record Purchase
                        </button>
                        <button
                            type="button"
                            className="draft-v2-auction-btn light"
                            onClick={() => {
                                setIsTimerRunning(false);
                                setTimeLeft(TIMER_SECONDS);
                                setAuctionStatus('Last purchase undone (mock)');
                            }}
                        >
                            Undo
                        </button>
                    </div>
                </section>
            </article>

            <article className="draft-v2-auction-card">
                <h3>Auction Activity Log</h3>
                <ul className="draft-v2-activity-list">
                    {EVENT_PLACEHOLDERS.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
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
                    <li>Draft start / pause controls</li>
                    <li>Auction timer settings</li>
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
                        {activeTab === 'Players' ? <span className="draft-v2-count-pill">0 Players</span> : null}
                    </div>
                    {renderTabContent()}
                </section>
            </section>
        </main>
    );
};

export default DraftRoomScreen;
