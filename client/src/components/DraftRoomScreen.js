import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

const ROSTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'SP', 'RP'];
const TABS = ['Players', 'My Roster', 'Draft Board', 'Teams', 'Settings'];
const TABLE_HEADERS = ['Player', 'Team', 'Pos', 'Value', 'ADP', 'HR', 'RBI', 'R', 'SB', 'AVG', 'W', 'SV', 'K', 'ERA', 'WHIP'];
const TIMER_SECONDS = 40;

const DraftRoomScreen = () => {
    const history = useHistory();
    const [activeTab, setActiveTab] = useState('Players');
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const [isTimerRunning, setIsTimerRunning] = useState(true);

    useEffect(() => {
        if (!isTimerRunning) return undefined;

        const tick = window.setInterval(() => {
            setTimeLeft((previous) => {
                if (previous <= 1) return TIMER_SECONDS;
                return previous - 1;
            });
        }, 1000);

        return () => window.clearInterval(tick);
    }, [isTimerRunning]);

    const timerPercent = useMemo(() => ((TIMER_SECONDS - timeLeft) / TIMER_SECONDS) * 100, [timeLeft]);
    const isPlayersTab = activeTab === 'Players';

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
                    <button
                        type="button"
                        className="draft-v2-icon-btn"
                        aria-label={isTimerRunning ? 'Pause timer' : 'Resume timer'}
                        onClick={() => setIsTimerRunning((previous) => !previous)}
                    >
                        {isTimerRunning ? '⏸' : '▸'}
                    </button>
                    <button type="button" className="draft-v2-icon-btn" aria-label="Undo">⟲</button>
                    <button type="button" className="draft-v2-icon-btn" aria-label="Export">⬇︎</button>
                </div>
            </header>

            <section className="draft-v2-top-controls">
                <div className="draft-v2-timer-row">
                    <span className="draft-v2-timer-icon">◷</span>
                    <div className="draft-v2-timer-bar">
                        <div className="draft-v2-timer-progress" style={{ width: `${timerPercent}%` }} />
                    </div>
                    <span className="draft-v2-timer-pill">{timeLeft}s</span>
                    <button type="button" className="draft-v2-record-btn" onClick={() => setTimeLeft(TIMER_SECONDS)}>
                        + Record Purchase
                    </button>
                </div>

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
                        <div className="draft-v2-empty-box">
                            Recommendations will appear after player pool data loads.
                        </div>
                    </article>
                </aside>

                <section className="draft-v2-main">
                    <div className="draft-v2-main-head">
                        <h2>{isPlayersTab ? 'Player Pool' : activeTab}</h2>
                        {isPlayersTab ? <span className="draft-v2-count-pill">0 Players</span> : null}
                    </div>

                    {isPlayersTab ? (
                        <>
                            <label className="draft-v2-search-wrap">
                                <span className="draft-v2-search-icon">⌕</span>
                                <input type="text" placeholder="Search players" />
                            </label>

                            <div className="draft-v2-table-shell">
                                <div className="draft-v2-filter-row">
                                    <button type="button" className="draft-v2-filter-btn">All</button>
                                    <button type="button" className="draft-v2-filter-btn">Watchlist (0)</button>
                                    <button type="button" className="draft-v2-filter-btn">All Tags</button>
                                </div>

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
                                                    No player data loaded yet. Connect API to populate the draft board.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="draft-v2-tab-empty">
                            <p>{activeTab} content will appear here once that module is implemented.</p>
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
};

export default DraftRoomScreen;
