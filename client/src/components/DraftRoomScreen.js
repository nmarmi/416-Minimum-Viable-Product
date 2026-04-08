import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getPlayers, postUsage } from '../players/requests';
import draftSessionsRequestSender from '../draft-sessions/requests';
import GlossaryTerm from './GlossaryTerm';
import GlossaryModal from './GlossaryModal';
import PlayerCompareModal from './PlayerCompareModal';

const DEFAULT_ROSTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'SP', 'RP'];
const TABS = ['Players', 'My Roster', 'Draft Board', 'Teams', 'Settings'];
const TABLE_HEADERS = ['Player', 'Team', 'Pos', 'Value', 'ADP', 'HR', 'RBI', 'R', 'SB', 'AVG', 'W', 'SV', 'K', 'ERA', 'WHIP'];
const FALLBACK_TEAMS = ['Your Team', 'Example 1', 'Example 2', 'Example 3'];

const formatStat = (val) => (val != null && Number.isFinite(val) ? (Number(val) === val && val < 1 && val > 0 ? val.toFixed(3) : String(Math.round(val))) : '--');

const playerNameStartsWithSearch = (playerName, searchTerm) => {
    const normalizedName = String(playerName || '').trim().toLowerCase();
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();

    if (!normalizedSearch) return true;

    return normalizedName
        .split(/\s+/)
        .some((part) => part.startsWith(normalizedSearch));
};

const getTeamName = (team) => team?.teamName || team?.teamId || 'Fantasy Team';

const getPlayerId = (player) => player.id || player._id || player.playerId || `${player.playerName}-${player.team}`;

const buildRosterPlanner = (draftSession) => {
    const slots = draftSession?.leagueSettings?.rosterSlots || {};
    return Object.keys(slots).map((slot) => ({
        slot,
        filled: 0,
        target: Number(slots[slot] || 0)
    }));
};

const DraftRoomScreen = () => {
    const history = useHistory();
    const { leagueId, draftSessionId } = useParams();

    const [activeTab, setActiveTab] = useState('Players');
    const [entryPlayer, setEntryPlayer] = useState('');
    const [entryNominatedBy, setEntryNominatedBy] = useState(FALLBACK_TEAMS[0]);
    const [entryWonBy, setEntryWonBy] = useState(FALLBACK_TEAMS[0]);
    const [entryPrice, setEntryPrice] = useState('');
    const [entryNotes, setEntryNotes] = useState('');
    const [players, setPlayers] = useState([]);
    const [playersTotal, setPlayersTotal] = useState(0);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [playersError, setPlayersError] = useState('');
    const [playerSearch, setPlayerSearch] = useState('');
    const [playerSuggestions, setPlayerSuggestions] = useState([]);
    const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
    const [highlightedPlayerIndex, setHighlightedPlayerIndex] = useState(-1);
    const [showGlossary, setShowGlossary] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [comparePlayers, setComparePlayers] = useState([]);
    const [, setEntryPlayerSearch] = useState('');
    const [entryPlayerSuggestions, setEntryPlayerSuggestions] = useState([]);
    const [showEntrySuggestions, setShowEntrySuggestions] = useState(false);
    const [entryHighlightedIndex, setEntryHighlightedIndex] = useState(-1);
    const [draftSession, setDraftSession] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(Boolean(draftSessionId));
    const [sessionError, setSessionError] = useState('');

    const teamOptions = useMemo(() => {
        if (!draftSession?.teams?.length) return FALLBACK_TEAMS;
        return draftSession.teams.map(getTeamName);
    }, [draftSession]);

    const rosterPlanner = useMemo(() => buildRosterPlanner(draftSession), [draftSession]);

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
        if (!draftSessionId) {
            setSessionLoading(false);
            setDraftSession(null);
            return;
        }

        const loadDraftSession = async () => {
            setSessionLoading(true);
            setSessionError('');
            const res = await draftSessionsRequestSender.getDraftSession(draftSessionId);
            if (res.status === 200 && res.data?.success) {
                setDraftSession(res.data.draftSession);
                setSessionError('');
            } else {
                setSessionError(res.data?.errorMessage || 'Unable to load draft session.');
            }
            setSessionLoading(false);
        };

        loadDraftSession();
    }, [draftSessionId]);

    useEffect(() => {
        const defaultTeam = teamOptions[0] || FALLBACK_TEAMS[0];
        setEntryNominatedBy(defaultTeam);
        setEntryWonBy(defaultTeam);
    }, [teamOptions]);

    useEffect(() => {
        if (activeTab !== 'Players') return;
        loadPlayers();
    }, [activeTab, loadPlayers]);

    useEffect(() => {
        postUsage({ event: 'draft_room_open', metadata: draftSessionId ? { draftSessionId } : {} }).catch(() => {});
    }, [draftSessionId]);

    const searchDraftBoardPlayers = useCallback(async (searchTerm) => {
        const trimmed = String(searchTerm || '').trim();

        if (!trimmed) {
            setEntryPlayerSuggestions([]);
            setShowEntrySuggestions(false);
            setEntryHighlightedIndex(-1);
            return;
        }

        const localMatches = (players || [])
            .filter((player) => playerNameStartsWithSearch(player.playerName, trimmed))
            .sort((left, right) => String(left.playerName || '').localeCompare(String(right.playerName || '')))
            .slice(0, 8);

        if (localMatches.length > 0) {
            setEntryPlayerSuggestions(localMatches);
            setShowEntrySuggestions(true);
            setEntryHighlightedIndex(-1);
            return;
        }

        const res = await getPlayers({ search: trimmed, limit: 8 });
        if (res.status === 200 && res.data?.success) {
            const matched = (res.data.players || [])
                .filter((player) => playerNameStartsWithSearch(player.playerName, trimmed))
                .sort((left, right) => String(left.playerName || '').localeCompare(String(right.playerName || '')));

            setEntryPlayerSuggestions(matched);
            setShowEntrySuggestions(matched.length > 0);
            setEntryHighlightedIndex(-1);
        } else {
            setEntryPlayerSuggestions([]);
            setShowEntrySuggestions(false);
            setEntryHighlightedIndex(-1);
        }
    }, [players]);

    const searchPlayerSuggestions = useCallback(async (searchTerm) => {
        const trimmed = String(searchTerm || '').trim();

        if (!trimmed) {
            setPlayerSuggestions([]);
            setShowPlayerSuggestions(false);
            setHighlightedPlayerIndex(-1);
            return;
        }

        const localMatches = (players || [])
            .filter((player) => playerNameStartsWithSearch(player.playerName, trimmed))
            .sort((left, right) => String(left.playerName || '').localeCompare(String(right.playerName || '')))
            .slice(0, 8);

        if (localMatches.length > 0) {
            setPlayerSuggestions(localMatches);
            setShowPlayerSuggestions(true);
            setHighlightedPlayerIndex(-1);
            return;
        }

        const res = await getPlayers({ search: trimmed, limit: 8 });
        if (res.status === 200 && res.data?.success) {
            const matched = (res.data.players || [])
                .filter((player) => String(player.playerName || '').toLowerCase().includes(trimmed.toLowerCase()))
                .sort((left, right) => String(left.playerName || '').localeCompare(String(right.playerName || '')));

            setPlayerSuggestions(matched);
            setShowPlayerSuggestions(matched.length > 0);
            setHighlightedPlayerIndex(-1);
        } else {
            setPlayerSuggestions([]);
            setShowPlayerSuggestions(false);
            setHighlightedPlayerIndex(-1);
        }
    }, [players]);

    const handleEntryPlayerChange = async (event) => {
        const value = event.target.value;
        setEntryPlayer(value);
        setEntryPlayerSearch(value);
        await searchDraftBoardPlayers(value);
    };

    const handleSelectEntryPlayer = (player) => {
        setEntryPlayer(player.playerName || '');
        setEntryPlayerSearch(player.playerName || '');
        setEntryPlayerSuggestions([]);
        setShowEntrySuggestions(false);
        setEntryHighlightedIndex(-1);
    };

    const handleEntryPlayerKeyDown = (event) => {
        if (!showEntrySuggestions || entryPlayerSuggestions.length === 0) {
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setEntryHighlightedIndex((prev) => prev < entryPlayerSuggestions.length - 1 ? prev + 1 : 0);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setEntryHighlightedIndex((prev) => prev > 0 ? prev - 1 : entryPlayerSuggestions.length - 1);
        } else if (event.key === 'Enter') {
            if (entryHighlightedIndex >= 0 && entryHighlightedIndex < entryPlayerSuggestions.length) {
                event.preventDefault();
                handleSelectEntryPlayer(entryPlayerSuggestions[entryHighlightedIndex]);
            }
        } else if (event.key === 'Escape') {
            setShowEntrySuggestions(false);
            setEntryHighlightedIndex(-1);
        }
    };

    const handlePlayerSearchChange = async (event) => {
        const value = event.target.value;
        const trimmed = value.trim();

        setPlayerSearch(value);

        if (!trimmed) {
            setPlayerSuggestions([]);
            setShowPlayerSuggestions(false);
            setHighlightedPlayerIndex(-1);
            await loadPlayers();
            return;
        }

        await searchPlayerSuggestions(value);

        const res = await getPlayers({ search: trimmed, limit: 500 });
        if (res.status === 200 && res.data?.success) {
            const filteredPlayers = (res.data.players || [])
                .filter((player) => playerNameStartsWithSearch(player.playerName, trimmed))
                .sort((left, right) => String(left.playerName || '').localeCompare(String(right.playerName || '')));

            setPlayers(filteredPlayers);
            setPlayersTotal(filteredPlayers.length);
            setPlayersError('');
        } else {
            setPlayers([]);
            setPlayersTotal(0);
            setPlayersError(res.data?.errorMessage || 'Failed to load players.');
        }
    };

    const handleSelectPlayerSuggestion = async (player) => {
        const selectedName = player.playerName || '';

        setPlayerSearch(selectedName);
        setPlayerSuggestions([]);
        setShowPlayerSuggestions(false);
        setHighlightedPlayerIndex(-1);

        const res = await getPlayers({ search: selectedName, limit: 500 });
        if (res.status === 200 && res.data?.success) {
            const matched = (res.data.players || [])
                .filter((entry) => playerNameStartsWithSearch(entry.playerName, selectedName))
                .sort((left, right) => String(left.playerName || '').localeCompare(String(right.playerName || '')));

            setPlayers(matched);
            setPlayersTotal(matched.length);
            setPlayersError('');
        } else {
            setPlayers([]);
            setPlayersTotal(0);
            setPlayersError(res.data?.errorMessage || 'Failed to load players.');
        }
    };

    const handlePlayerSearchKeyDown = (event) => {
        if (!showPlayerSuggestions || playerSuggestions.length === 0) {
            if (event.key === 'Enter') {
                loadPlayers();
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedPlayerIndex((prev) => prev < playerSuggestions.length - 1 ? prev + 1 : 0);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedPlayerIndex((prev) => prev > 0 ? prev - 1 : playerSuggestions.length - 1);
        } else if (event.key === 'Enter') {
            if (highlightedPlayerIndex >= 0 && highlightedPlayerIndex < playerSuggestions.length) {
                event.preventDefault();
                handleSelectPlayerSuggestion(playerSuggestions[highlightedPlayerIndex]);
            } else {
                loadPlayers();
            }
        } else if (event.key === 'Escape') {
            setShowPlayerSuggestions(false);
            setHighlightedPlayerIndex(-1);
        }
    };

    const toggleCompare = (player) => {
        const id = getPlayerId(player);
        setComparePlayers((prev) => {
            const inList = prev.some((entry) => getPlayerId(entry) === id);
            if (inList) return prev.filter((entry) => getPlayerId(entry) !== id);
            if (prev.length >= 4) return prev;
            return [...prev, player];
        });
    };

    const isInCompare = (player) => comparePlayers.some((entry) => getPlayerId(entry) === getPlayerId(player));

    const renderPlayersTab = () => (
        <>
            <div className="draft-v2-module-grid two-col">
                <article className="draft-v2-module-card">
                    <h3>Player Search & Filters</h3>
                    <label className="draft-v2-search-wrap draft-v2-live-search-wrap">
                        <span className="draft-v2-search-icon">⌕</span>
                        <input
                            type="text"
                            placeholder="Search players by name"
                            value={playerSearch}
                            onChange={handlePlayerSearchChange}
                            onKeyDown={handlePlayerSearchKeyDown}
                            onFocus={() => playerSuggestions.length > 0 && setShowPlayerSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowPlayerSuggestions(false), 150)}
                            autoComplete="off"
                        />

                        {showPlayerSuggestions && playerSuggestions.length > 0 ? (
                            <div className="draft-v2-live-search-menu">
                                {playerSuggestions.map((player, index) => (
                                    <button
                                        key={getPlayerId(player)}
                                        type="button"
                                        className={`draft-v2-live-search-item ${index === highlightedPlayerIndex ? 'active' : ''}`}
                                        onMouseDown={() => handleSelectPlayerSuggestion(player)}
                                    >
                                        <div className="draft-v2-live-search-item-main">
                                            <strong>{player.playerName}</strong>
                                            <span>{player.team} • {player.position}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </label>
                    <button type="button" className="draft-v2-filter-btn" onClick={loadPlayers}>Search</button>
                    <div className="draft-v2-filter-row">
                        <button type="button" className="draft-v2-filter-btn">All</button>
                        <button type="button" className="draft-v2-filter-btn">Watchlist (0)</button>
                        <button type="button" className="draft-v2-filter-btn">All Tags</button>
                        {comparePlayers.length > 0 ? (
                            <button
                                type="button"
                                className="draft-v2-filter-btn draft-v2-compare-bar-btn"
                                onClick={() => setShowCompareModal(true)}
                            >
                                Compare ({comparePlayers.length})
                            </button>
                        ) : null}
                    </div>
                </article>

                <article className="draft-v2-module-card">
                    <h3>Player Profile & Glossary</h3>
                    <ul className="draft-v2-checklist">
                        <li>Projected stats</li>
                        <li>Role (starter / reliever / everyday)</li>
                        <li>Injury / news flags</li>
                        <li><GlossaryTerm term="Position eligibility">Position eligibility</GlossaryTerm></li>
                        <li>Hover over the ? next to column headers for definitions.</li>
                    </ul>
                    <button type="button" className="draft-v2-filter-btn glossary-open-btn" onClick={() => setShowGlossary(true)}>
                        View full glossary
                    </button>
                    <p className="draft-v2-auction-muted">
                        Stats from projection data. Pitcher columns (W, SV, <GlossaryTerm term="ERA">ERA</GlossaryTerm>, <GlossaryTerm term="WHIP">WHIP</GlossaryTerm>) show -- for batters.
                    </p>
                </article>
            </div>

            <div className="draft-v2-table-shell">
                <div className="draft-v2-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Player</th>
                                <th>Team</th>
                                <th><GlossaryTerm term="Position eligibility">Pos</GlossaryTerm></th>
                                <th><GlossaryTerm term="Value">Value</GlossaryTerm></th>
                                <th><GlossaryTerm term="ADP">ADP</GlossaryTerm></th>
                                <th>HR</th>
                                <th>RBI</th>
                                <th>R</th>
                                <th>SB</th>
                                <th>AVG</th>
                                <th>W</th>
                                <th>SV</th>
                                <th>K</th>
                                <th><GlossaryTerm term="ERA">ERA</GlossaryTerm></th>
                                <th><GlossaryTerm term="WHIP">WHIP</GlossaryTerm></th>
                                <th className="draft-v2-th-compare">Compare</th>
                            </tr>
                        </thead>
                        <tbody>
                            {playersLoading ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length + 1} className="draft-v2-empty-row">Loading players...</td>
                                </tr>
                            ) : playersError ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length + 1} className="draft-v2-empty-row">{playersError}</td>
                                </tr>
                            ) : players.length === 0 ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length + 1} className="draft-v2-empty-row">
                                        No players found. Make sure the player source is available for the current mode.
                                    </td>
                                </tr>
                            ) : (
                                players.map((player) => (
                                    <tr key={getPlayerId(player)} className={isInCompare(player) ? 'draft-v2-tr-compare-selected' : ''}>
                                        <td>{player.playerName}</td>
                                        <td>{player.team}</td>
                                        <td>{player.position}</td>
                                        <td>{formatStat(player.fpts)}</td>
                                        <td>--</td>
                                        <td>{formatStat(player.hr)}</td>
                                        <td>{formatStat(player.rbi)}</td>
                                        <td>{formatStat(player.r)}</td>
                                        <td>{formatStat(player.sb)}</td>
                                        <td>{player.avg != null ? Number(player.avg).toFixed(3) : '--'}</td>
                                        <td>--</td>
                                        <td>--</td>
                                        <td>{formatStat(player.k)}</td>
                                        <td>--</td>
                                        <td>--</td>
                                        <td className="draft-v2-td-compare">
                                            <button
                                                type="button"
                                                className="draft-v2-compare-add-btn"
                                                title={isInCompare(player) ? 'Remove from comparison' : 'Add to comparison'}
                                                onClick={() => toggleCompare(player)}
                                                disabled={!isInCompare(player) && comparePlayers.length >= 4}
                                            >
                                                {isInCompare(player) ? 'In compare' : 'Compare'}
                                            </button>
                                        </td>
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
                <p className="draft-v2-auction-muted">Enter each completed pick as the real draft happens.</p>
                <div className="draft-v2-module-grid two-col">
                    <label className="draft-v2-field draft-v2-player-search-field">
                        <span>Player Taken</span>
                        <input
                            type="text"
                            placeholder="e.g., Aaron Judge"
                            value={entryPlayer}
                            onChange={handleEntryPlayerChange}
                            onFocus={() => entryPlayerSuggestions.length > 0 && setShowEntrySuggestions(true)}
                            onKeyDown={handleEntryPlayerKeyDown}
                            onBlur={() => setTimeout(() => setShowEntrySuggestions(false), 150)}
                            autoComplete="off"
                        />

                        {showEntrySuggestions && entryPlayerSuggestions.length > 0 ? (
                            <div className="draft-v2-player-suggestions">
                                {entryPlayerSuggestions.map((player, index) => (
                                    <button
                                        key={getPlayerId(player)}
                                        type="button"
                                        className={`draft-v2-player-suggestion ${index === entryHighlightedIndex ? 'active' : ''}`}
                                        onMouseDown={() => handleSelectEntryPlayer(player)}
                                    >
                                        <div className="draft-v2-player-suggestion-main">
                                            <strong>{player.playerName}</strong>
                                            <span>{player.team} • {player.position}</span>
                                        </div>
                                        <div className="draft-v2-player-suggestion-value">
                                            ${Math.round(player.fpts || 0)}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </label>
                    <label className="draft-v2-field">
                        <span>Auctioned By</span>
                        <select value={entryNominatedBy} onChange={(event) => setEntryNominatedBy(event.target.value)}>
                            {teamOptions.map((team) => (
                                <option key={team}>{team}</option>
                            ))}
                        </select>
                    </label>
                    <label className="draft-v2-field">
                        <span>Won By</span>
                        <select value={entryWonBy} onChange={(event) => setEntryWonBy(event.target.value)}>
                            {teamOptions.map((team) => (
                                <option key={team}>{team}</option>
                            ))}
                        </select>
                    </label>
                    <label className="draft-v2-field">
                        <span>Winning Price ($)</span>
                        <input type="number" min="1" placeholder="e.g., 37" value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} />
                    </label>
                    <label className="draft-v2-field full">
                        <span>Notes (Optional)</span>
                        <input
                            type="text"
                            placeholder="Keeper, tie-break, injury note, etc."
                            value={entryNotes}
                            onChange={(event) => setEntryNotes(event.target.value)}
                        />
                    </label>
                </div>
                <div className="draft-v2-auction-actions">
                    <button type="button" className="draft-v2-auction-btn" disabled>Record Purchase</button>
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
                    <li>Tracked available player IDs: <strong>{draftSession?.availablePlayerIds?.length ?? '--'}</strong></li>
                    <li>Team budgets after each saved pick</li>
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
                    {(draftSession?.teams || FALLBACK_TEAMS.map((teamName) => ({ teamName }))).map((team) => {
                        const rosterSlots = draftSession?.leagueSettings?.rosterSlots || {};
                        const filled = Object.values(team.filledRosterSlots || {}).reduce((sum, value) => sum + Number(value || 0), 0);
                        const target = Object.values(rosterSlots).reduce((sum, value) => sum + Number(value || 0), 0);
                        const spotsRemaining = Math.max(target - filled, 0);

                        return (
                            <div key={team.teamId || team.teamName} className="draft-v2-team-row">
                                <span>{getTeamName(team)}</span>
                                <span>Budget: {team.budgetRemaining != null ? `$${team.budgetRemaining}` : '--'}</span>
                                <span>Max Bid: {team.budgetRemaining != null && spotsRemaining > 0 ? `$${Math.max(team.budgetRemaining - (spotsRemaining - 1), 1)}` : '--'}</span>
                                <span>Spots: {spotsRemaining || '--'}</span>
                            </div>
                        );
                    })}
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
                    <li>Total budget: <strong>${draftSession?.leagueSettings?.salaryCap ?? '--'}</strong></li>
                    <li>Roster positions: <strong>{Object.keys(draftSession?.leagueSettings?.rosterSlots || {}).join(', ') || '--'}</strong></li>
                    <li>Scoring type: <strong>{draftSession?.leagueSettings?.scoringType || '--'}</strong></li>
                    <li>Draft type: <strong>{draftSession?.leagueSettings?.draftType || 'AUCTION'}</strong></li>
                </ul>
            </article>

            <article className="draft-v2-module-card">
                <h3>Draft Configuration</h3>
                <ul className="draft-v2-checklist">
                    <li>Draft session ID: <strong>{draftSession?.draftSessionId || '--'}</strong></li>
                    <li>Status: <strong>{draftSession?.status || 'legacy view'}</strong></li>
                    <li>Started at: <strong>{draftSession?.startedAt ? new Date(draftSession.startedAt).toLocaleString() : '--'}</strong></li>
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

    if (sessionLoading) {
        return <main className="page-shell">Loading draft room...</main>;
    }

    if (sessionError) {
        return (
            <main className="page-shell">
                <p>{sessionError}</p>
                <button className="home-light-btn" type="button" onClick={() => history.push('/home')}>
                    Back to Home
                </button>
            </main>
        );
    }

    const rosterPositions = rosterPlanner.length > 0 ? rosterPlanner.map((entry) => entry.slot) : DEFAULT_ROSTER_POSITIONS;
    const draftTitle = draftSession?.name || 'Fantasy Baseball League';
    const draftSubtitle = draftSession
        ? `${draftSession.status === 'active' ? 'Active draft session' : 'Draft setup preview'} for league ${leagueId}.`
        : 'Welcome back. Draft room data will appear once API integration is enabled.';
    const firstTeam = draftSession?.teams?.[0] || null;
    const spotsRemaining = draftSession?.leagueSettings?.rosterSlots
        ? Object.values(draftSession.leagueSettings.rosterSlots).reduce((sum, value) => sum + Number(value || 0), 0)
        : null;

    return (
        <main className="draft-v2-page">
            <header className="draft-v2-header">
                <button type="button" className="draft-v2-icon-btn" aria-label="Back" onClick={() => history.goBack()}>
                    ←
                </button>

                <div className="draft-v2-title-wrap">
                    <h1>{draftTitle}</h1>
                    <p>{draftSubtitle}</p>
                </div>

                <div className="draft-v2-header-actions">
                    <span className={`league-status ${draftSession?.status === 'active' ? 'active' : 'inactive'}`}>
                        {draftSession?.status === 'active' ? 'Active' : 'Classic'}
                    </span>
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
                            <strong>{firstTeam?.budgetRemaining != null ? `$${firstTeam.budgetRemaining}` : '--'}</strong>
                        </div>
                        <div className="draft-v2-meter" />
                        <p className="draft-v2-muted">{draftSession ? `${getTeamName(firstTeam)} preview` : 'Awaiting draft data from API'}</p>
                        <div className="draft-v2-divider" />
                        <div className="draft-v2-metric-row">
                            <span>Maximum Bid</span>
                            <strong>{firstTeam?.budgetRemaining != null && spotsRemaining ? `$${Math.max(firstTeam.budgetRemaining - (spotsRemaining - 1), 1)}` : '--'}</strong>
                        </div>
                        <div className="draft-v2-stat-grid">
                            <div>
                                <span>Salary Cap</span>
                                <strong>{draftSession?.leagueSettings?.salaryCap != null ? `$${draftSession.leagueSettings.salaryCap}` : '--'}</strong>
                            </div>
                            <div>
                                <span>Teams</span>
                                <strong>{draftSession?.leagueSettings?.numberOfTeams ?? '--'}</strong>
                            </div>
                        </div>
                    </article>

                    <article className="draft-v2-card draft-v2-planner-card">
                        <h2>Roster Planning</h2>
                        <div className="draft-v2-roster-list">
                            {rosterPositions.map((pos) => {
                                const plannerEntry = rosterPlanner.find((entry) => entry.slot === pos);
                                const target = plannerEntry?.target ?? 1;
                                return (
                                    <div key={pos} className="draft-v2-roster-row">
                                        <span>{pos}</span>
                                        <span className="draft-v2-muted">0 / {target}</span>
                                        <span className="draft-v2-need-pill">Need {target}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="draft-v2-next-priority">
                            Next Priority: {rosterPlanner.find((entry) => entry.target > 0)?.slot || 'TBD'}
                        </div>
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

            {showGlossary ? <GlossaryModal onClose={() => setShowGlossary(false)} /> : null}
            {showCompareModal ? (
                <PlayerCompareModal
                    players={comparePlayers}
                    onClose={() => setShowCompareModal(false)}
                />
            ) : null}
        </main>
    );
};

export default DraftRoomScreen;
