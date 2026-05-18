import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getPlayers as getCatalogPlayers, postUsage } from '../players/requests';
import { getSessionPlayers, getSessionValuations, getSessionRecommendations } from '../draft-sessions/requests';
import { DRAFT_SESSIONS_API_BASE_URL } from '../config/api';
import { GlobalStoreContext } from '../store';
import GlossaryTerm from './GlossaryTerm';
import GlossaryModal from './GlossaryModal';
import PlayerCompareModal from './PlayerCompareModal';
import PlayerInfoModal from './PlayerInfoModal';

const DEFAULT_ROSTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'SP', 'RP'];
const TABS = ['Players', 'Purchased', 'My Roster', 'Draft Board', 'Teams', 'Compare', 'League Rosters', 'MLB Depth', 'Taxi', 'Settings'];
const POSITION_RANK = { C: 0, '1B': 1, '2B': 2, '3B': 3, SS: 4, CI: 5, MI: 6, OF: 7, UTIL: 8, U: 8, DH: 9, SP: 10, P: 11, RP: 12, BENCH: 13 };
const POS_COLOR = {
    C:     { background: '#dbeafe', color: '#1d4ed8', borderColor: '#93c5fd' },
    '1B':  { background: '#e0e7ff', color: '#3730a3', borderColor: '#a5b4fc' },
    '2B':  { background: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' },
    '3B':  { background: '#fce7f3', color: '#9d174d', borderColor: '#f9a8d4' },
    SS:    { background: '#fce7f3', color: '#9d174d', borderColor: '#f9a8d4' },
    CI:    { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' },
    MI:    { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' },
    OF:    { background: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' },
    DH:    { background: '#fef9c3', color: '#713f12', borderColor: '#fde047' },
    SP:    { background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
    P:     { background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' },
    RP:    { background: '#ffedd5', color: '#9a3412', borderColor: '#fdba74' },
    UTIL:  { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' },
    U:     { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' },
    BENCH: { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' },
};

// US-24.1: all 30 MLB team abbreviations
const MLB_TEAMS = [
    'ARI','ATL','BAL','BOS','CHC','CIN','CLE','COL','CWS','DET',
    'HOU','KC','LAA','LAD','MIA','MIL','MIN','NYM','NYY','ATH',
    'PHI','PIT','SD','SEA','SF','STL','TB','TEX','TOR','WSH',
];
const TABLE_HEADERS = ['Player', 'Team', 'Pos', 'Depth', 'Value', 'Age', 'HR', 'RBI', 'R', 'SB', 'AVG', 'W', 'SV', 'K', 'ERA', 'WHIP'];
const PAGE_SIZE = 50;
const FALLBACK_TEAMS = ['Your Team', 'Example 1', 'Example 2', 'Example 3'];
const DRAFT_STATUS_META = {
    setup: { label: 'Setup', className: 'setup' },
    active: { label: 'Active', className: 'active' },
    paused: { label: 'Paused', className: 'paused' },
    completed: { label: 'Completed', className: 'completed' },
};

// Generic stat formatter: integers for counting stats, 3-decimal for sub-1 values (e.g. AVG)
const formatStat = (val) => (val != null && Number.isFinite(val) ? (val > 0 && val < 1 ? val.toFixed(3) : String(Math.round(val))) : '--');
// Rate stat formatter for ERA/WHIP: always 2 decimal places (e.g. 3.40, 1.15)
//const formatRate = (val) => (val != null && Number.isFinite(val) && val > 0 ? Number(val).toFixed(2) : '--'); // currently unused causes build to fail
const formatPitcherRate = (val) => (val != null && Number.isFinite(val) && val > 0 ? Number(val).toFixed(2) : 'N/A');

const getDraftStatusMeta = (status) => {
    const normalizedStatus = String(status || 'setup').toLowerCase();
    return DRAFT_STATUS_META[normalizedStatus] || { label: 'Unknown', className: 'completed' };
};

const playerNameStartsWithSearch = (playerName, searchTerm) => {
    const normalizedName = String(playerName || '').trim().toLowerCase();
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();

    if (!normalizedSearch) return true;

    return normalizedName
        .split(/\s+/)
        .some((part) => part.startsWith(normalizedSearch));
};

const getTeamName = (team) => {
    const raw = team?.teamName || team?.teamId || 'Fantasy Team';
    // Prettify auto-generated IDs like "fantasy-team-3" → "Team 3"
    return raw.replace(/^fantasy-team-(\d+)$/, 'Team $1');
};

const getPlayerName = (player) => player.playerName || player.name || '';
const getPlayerTeamLabel = (player) => player?.mlbTeam || player?.team || '';
const getStatusLabel = (player) => {
    const status = String(player?.status || '').trim();
    if (!status) return 'UNKNOWN';
    return status.toLowerCase() === 'active' ? 'ACTIVE' : status.toUpperCase();
};
const getStatusValue = (player) => String(player?.status || 'active').trim() || 'active';
const getStatusCategory = (player) => {
    const normalizedStatus = getStatusValue(player).toLowerCase();
    if (normalizedStatus === 'active') return 'active';
    if (normalizedStatus.startsWith('il-')) return 'il';
    if (normalizedStatus === 'dtd') return 'dtd';
    if (normalizedStatus === 'minors' || normalizedStatus === 'dfa') return 'inactive';
    return 'inactive';
};
const shouldShowStatusBadge = (player) => getStatusCategory(player) !== 'active';
const isInjuredStatus = (player) => shouldShowStatusBadge(player);
const getStatusSortRank = (player) => {
    const category = getStatusCategory(player);
    if (category === 'il') return 0;
    if (category === 'dtd') return 1;
    if (category === 'inactive') return 2;
    return 3;
};
const pickFirstDefined = (player, keys) => {
    for (let i = 0; i < keys.length; i += 1) {
        const value = player?.[keys[i]];
        if (value != null && value !== '') return value;
    }
    return null;
};
const getValuationValue = (valuation) => pickFirstDefined(valuation, [
    'dollarValue',
    'projectedValue',
    'value',
    'valuation',
    'auctionValue',
    'auctionDollarValue',
    'dollars'
]);
const getPlayerPosition = (player) =>
    player.position ||
    (Array.isArray(player.positions) ? player.positions.join('/') : '') ||
    '';
const getDepthChartLabel = (player) => {
    const position = String(player?.depthChartPosition || '').trim();
    const rank = player?.depthChartRank;
    if (position && rank != null && rank !== '') {
        return typeof rank === 'number' ? `${position}${rank}` : `${position}-${rank}`;
    }
    if (position) return position;
    if (rank != null && rank !== '') return `#${rank}`;
    return '--';
};
const isDepthChartStarter = (player) => player?.depthChartRank === 1;
const formatDataAsOf = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getPlayerId = (player) => player.playerId || player.id || player._id || `${getPlayerName(player)}-${getPlayerTeamLabel(player)}`;
const abbrevPlayerName = (fullName) => {
    if (!fullName) return fullName;
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return fullName;
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

const buildRosterPlanner = (draftSession, teamId) => {
    const slots = draftSession?.leagueSettings?.rosterSlots || {};
    const team = (draftSession?.teams || []).find((t) => t.teamId === teamId);
    const filledMap = team?.filledRosterSlots || {};
    return Object.keys(slots).map((slot) => ({
        slot,
        filled: Number(filledMap[slot] || 0),
        target: Number(slots[slot] || 0),
    }));
};

const DraftRoomScreen = () => {
    const history = useHistory();
    const { leagueId, draftSessionId } = useParams();
    const { store } = useContext(GlobalStoreContext);

    const [activeTab, setActiveTab] = useState('Players');
    const [entryPlayer, setEntryPlayer] = useState('');
    const [entryNominatedBy, setEntryNominatedBy] = useState(FALLBACK_TEAMS[0]);
    const [entryWonBy, setEntryWonBy] = useState(FALLBACK_TEAMS[0]);
    const [entryPrice, setEntryPrice] = useState('');
    const [entryNotes, setEntryNotes] = useState('');
    const [players, setPlayers] = useState([]);
    const [playersTotal, setPlayersTotal] = useState(0);
    const [playersLoading, setPlayersLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMorePlayers, setHasMorePlayers] = useState(false);
    const [playersError, setPlayersError] = useState('');
    const [playersPage, setPlayersPage] = useState(0);
    const [playerDataAsOf, setPlayerDataAsOf] = useState(null);
    const [injuryOnly, setInjuryOnly] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');
    const [playerSuggestions, setPlayerSuggestions] = useState([]);
    const [showPlayerSuggestions, setShowPlayerSuggestions] = useState(false);
    const [highlightedPlayerIndex, setHighlightedPlayerIndex] = useState(-1);
    const [showGlossary, setShowGlossary] = useState(false);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [comparePlayers, setComparePlayers] = useState([]);
    const [entryPlayerId, setEntryPlayerId] = useState('');
    const [entryPlayerTeam, setEntryPlayerTeam] = useState('');
    const [, setEntryPlayerSearch] = useState('');
    const [entryPlayerSuggestions, setEntryPlayerSuggestions] = useState([]);
    const [showEntrySuggestions, setShowEntrySuggestions] = useState(false);
    const [entryHighlightedIndex, setEntryHighlightedIndex] = useState(-1);
    const [entrySubmitting, setEntrySubmitting] = useState(false);
    const [entryError, setEntryError] = useState('');
    const [entrySuccess, setEntrySuccess] = useState('');
    const [toast, setToast] = useState(null);
    const [editingPurchaseId, setEditingPurchaseId] = useState('');
    const [editingPrice, setEditingPrice] = useState('');
    const [editingWonBy, setEditingWonBy] = useState('');
    const [editingPosition, setEditingPosition] = useState(''); // US-22.3
    const [editingOriginal, setEditingOriginal] = useState(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState('');
    const [pendingUndo, setPendingUndo] = useState(null);
    const [undoSubmitting, setUndoSubmitting] = useState(false);
    const [undoError, setUndoError] = useState('');
    const [sessionLoading, setSessionLoading] = useState(Boolean(draftSessionId));
    const [sessionError, setSessionError] = useState('');
    const [valuationsMap, setValuationsMap] = useState({});
    const [recommendations, setRecommendations] = useState([]);
    const [positionFilter, setPositionFilter] = useState(new Set());
    const [playerSort,  setPlayerSort]  = useState({ field: 'name',   dir: 'asc' });
    const [compareSort,  setCompareSort]  = useState({ field: 'totalDollars', dir: 'desc' }); // US-23.2
    const [mlbTeam,      setMlbTeam]      = useState(MLB_TEAMS[0]); // US-24.1
    const [mlbPlayers,   setMlbPlayers]   = useState([]);
    const [mlbLoading,   setMlbLoading]   = useState(false);
    // US-26: taxi draft
    const [taxiTeamId,   setTaxiTeamId]   = useState('');
    const [taxiSearch,   setTaxiSearch]   = useState('');
    const [taxiResults,  setTaxiResults]  = useState([]);
    const [taxiPlayer,   setTaxiPlayer]   = useState(null);
    const [taxiWarning,  setTaxiWarning]  = useState('');
    const [taxiLoading,  setTaxiLoading]  = useState(false);
    // US-25: push notifications
    const [pushEvents,   setPushEvents]   = useState([]);   // last 50 events
    const [showFeed,     setShowFeed]     = useState(false);
    const [mutePush,     setMutePush]     = useState(() => localStorage.getItem('draftiq-mute-push') === '1');
    const [startersOnly, setStartersOnly] = useState(false);
    const [purchasedSort, setPurchasedSort] = useState('order'); // 'order' | 'price' | 'team'
    const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [isFiltersMenuOpen, setIsFiltersMenuOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [savingPlayerNote, setSavingPlayerNote] = useState(false);
    const [editingNotes, setEditingNotes] = useState('');
    const [rosterUndoStack, setRosterUndoStack] = useState([]);
    const [rosterRedoStack, setRosterRedoStack] = useState([]);
    const teamPickerRef = useRef(null);
    const sortMenuRef = useRef(null);
    const filtersMenuRef = useRef(null);
    const playerSearchRef = useRef(null);  // US-10.4: focus target after recording purchase
    const playersRef = useRef([]);

    const draftSession = store.currentDraftSession;
    const availablePlayerIdsKey = useMemo(
        () => (draftSession?.availablePlayerIds || []).join('|'),
        [draftSession?.availablePlayerIds]
    );

    const showToast = useCallback((type, message, duration = 4000) => {
        setToast({ type, message, id: Date.now(), duration });
    }, []);

    useEffect(() => {
        if (!toast) return undefined;
        const timeoutId = setTimeout(() => setToast(null), toast.duration || 4000);
        return () => clearTimeout(timeoutId);
    }, [toast]);

    useEffect(() => { playersRef.current = players; }, [players]);

    useEffect(() => {
        if (!isTeamPickerOpen) return undefined;
        const onDown = (e) => { if (!teamPickerRef.current?.contains(e.target)) setIsTeamPickerOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [isTeamPickerOpen]);

    useEffect(() => {
        if (!isSortMenuOpen) return undefined;
        const onDown = (e) => { if (!sortMenuRef.current?.contains(e.target)) setIsSortMenuOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [isSortMenuOpen]);

    useEffect(() => {
        if (!isFiltersMenuOpen) return undefined;
        const onDown = (e) => { if (!filtersMenuRef.current?.contains(e.target)) setIsFiltersMenuOpen(false); };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [isFiltersMenuOpen]);

    // Natural sort direction for each stat field (first click)
    const STAT_DEFAULT_DIR = { dollar: 'desc', age: 'asc', hr: 'desc', rbi: 'desc', r: 'desc', sb: 'desc', avg: 'desc', w: 'desc', sv: 'desc', k: 'desc', era: 'asc', whip: 'asc' };

    // US-22.1/22.2: tri-state toggle — desc → asc → off (back to name)
    const handleColSort = (field) => {
        setPlayerSort((prev) => {
            if (prev.field !== field) return { field, dir: STAT_DEFAULT_DIR[field] ?? 'desc' };
            const next = prev.dir === 'desc' ? 'asc' : null; // null = off
            return next ? { field, dir: next } : { field: 'name', dir: 'asc' };
        });
    };
    const sortIcon = (field) => {
        if (playerSort.field !== field) return <span className="draft-v2-sort-icon-dim">⇅</span>;
        return playerSort.dir === 'asc' ? ' ▲' : ' ▼';
    };

    const teamOptions = useMemo(() => {
        if (!draftSession?.teams?.length) return FALLBACK_TEAMS.map((name) => ({ teamId: name, label: name }));
        return draftSession.teams.map((t) => ({ teamId: t.teamId, label: `${getTeamName(t)} ($${t.budgetRemaining ?? '--'})` }));
    }, [draftSession]);

    // US-6.5: derive the active "my team" — explicit `myTeamId` from server,
    // falling back to the first team so the sidebar always has something to render.
    const myTeam = useMemo(() => {
        if (!draftSession?.teams?.length) return null;
        const explicit = draftSession.teams.find((t) => t.teamId === draftSession.myTeamId);
        return explicit || draftSession.teams[0];
    }, [draftSession]);

    // US-6.6: the sidebar planner reads filled counts off `myTeam`, so it
    // recomputes whenever the session state replaces (purchase / undo / edit).
    const rosterPlanner = useMemo(() => buildRosterPlanner(draftSession, myTeam?.teamId), [draftSession, myTeam]);

    const availableSet = useMemo(() => new Set(draftSession?.availablePlayerIds || []), [draftSession]);

    // US-6.1: position filter for the player pool view.
    const availablePositions = useMemo(() => {
        const set = new Set();
        for (const p of players || []) {
            const raw = String(p?.position || p?.positions || '');
            for (const tok of raw.split(/[,/]/).map((s) => s.trim()).filter(Boolean)) set.add(tok);
        }
        return ['ALL', ...Array.from(set).sort()];
    }, [players]);

    const getPlayerValuation = useCallback((player) => {
        const id = getPlayerId(player);
        const keyCandidates = [
            id,
            player?.playerId,
            player?.mlbPersonId != null ? String(player.mlbPersonId) : null,
            player?.mlbId != null ? String(player.mlbId) : null,
            player?.playerName,
            player?.name
        ].filter(Boolean);
        let dollarVal = null;
        for (const key of keyCandidates) {
            if (valuationsMap[key] != null) {
                dollarVal = valuationsMap[key];
                break;
            }
        }
        // $0 means no stats data — show '--' since the minimum bid is always $1
        if (dollarVal != null && dollarVal > 0) return `$${Math.round(dollarVal)}`;
        return '--';
    }, [valuationsMap]);

    const fetchPlayerRows = useCallback((params = {}) => {
        if (draftSessionId) {
            return getSessionPlayers(draftSessionId, {
                status: 'available',
                ...params
            });
        }
        return getCatalogPlayers(params);
    }, [draftSessionId]);

    const displayedPlayers = useMemo(() => {
        let list = players || [];
        // US-6.1: only show available (un-purchased) players in this view.
        if (availableSet.size > 0) {
            list = list.filter((p) => availableSet.has(getPlayerId(p)));
        }
        // US-6.1: position filter.
        if (positionFilter.size > 0) {
            list = list.filter((p) => {
                const raw = String(p?.position || p?.positions || '');
                return raw.split(/[,/]/).map((s) => s.trim()).some((pos) => positionFilter.has(pos));
            });
        }
        if (injuryOnly) list = list.filter((p) => isInjuredStatus(p));
        if (startersOnly) list = list.filter((p) => isDepthChartStarter(p));
        const getStatVal = (p, field) => {
            if (field === 'dollar') {
                const id = getPlayerId(p);
                const candidates = [id, p?.playerId, p?.mlbPersonId != null ? String(p.mlbPersonId) : null, p?.mlbId != null ? String(p.mlbId) : null, p?.playerName, p?.name].filter(Boolean);
                for (const k of candidates) { if (valuationsMap[k] != null) return Number(valuationsMap[k]); }
                return null;
            }
            const statMap = {
                age: () => pickFirstDefined(p, ['age', 'playerAge', 'Age']),
                hr:  () => p?.hr,
                rbi: () => p?.rbi,
                r:   () => p?.r,
                sb:  () => p?.sb,
                avg: () => p?.avg,
                w:   () => pickFirstDefined(p, ['w', 'wins', 'W']),
                sv:  () => pickFirstDefined(p, ['sv', 'saves', 'SV']),
                k:   () => p?.k,
                era: () => pickFirstDefined(p, ['era', 'ERA']),
                whip: () => pickFirstDefined(p, ['whip', 'WHIP']),
            };
            return statMap[field] ? statMap[field]() : null;
        };
        list = [...list].sort((left, right) => {
            const { field, dir } = playerSort;
            if (field === 'status') {
                const statusDiff = getStatusSortRank(left) - getStatusSortRank(right);
                if (statusDiff !== 0) return statusDiff;
                const labelDiff = getStatusLabel(left).localeCompare(getStatusLabel(right));
                if (labelDiff !== 0) return labelDiff;
            } else if (field !== 'name') {
                const lv = getStatVal(left, field);
                const rv = getStatVal(right, field);
                const ln = lv != null ? Number(lv) : null;
                const rn = rv != null ? Number(rv) : null;
                if (ln !== null || rn !== null) {
                    if (ln === null) return 1;
                    if (rn === null) return -1;
                    const diff = dir === 'asc' ? ln - rn : rn - ln;
                    if (diff !== 0) return diff;
                }
            }
            return getPlayerName(left).localeCompare(getPlayerName(right));
        });
        return list;
    }, [players, injuryOnly, startersOnly, availableSet, positionFilter, playerSort, valuationsMap]);

    const loadPlayers = useCallback(async () => {
        setPlayersLoading(true);
        setPlayersError('');
        const res = await fetchPlayerRows({ search: playerSearch.trim(), limit: 200 });
        setPlayersLoading(false);
        if (res.status === 200 && res.data?.success) {
            const fetched = res.data.players || [];
            setPlayers(fetched);
            setPlayersTotal(res.data.total ?? 0);
            setPlayerDataAsOf(res.data.dataAsOf || null);
            setPlayersError('');
            setHasMorePlayers(fetched.length === 200);
            return true;
        } else {
            setPlayersError(res.data?.errorMessage || 'Failed to load players.');
            setPlayers([]);
            setPlayersTotal(0);
            setHasMorePlayers(false);
            return false;
        }
    }, [fetchPlayerRows, playerSearch]);

    const handleLoadMore = useCallback(async () => {
        setLoadingMore(true);
        const offset = playersRef.current.length;
        const res = await fetchPlayerRows({ search: playerSearch.trim(), limit: 200, offset });
        setLoadingMore(false);
        if (res.status === 200 && res.data?.success) {
            const fetched = res.data.players || [];
            setPlayers((prev) => [...prev, ...fetched]);
            setPlayersTotal(res.data.total ?? 0);
            setHasMorePlayers(fetched.length === 200);
        }
    }, [fetchPlayerRows, playerSearch]);

    useEffect(() => {
        if (!draftSessionId) {
            setSessionLoading(false);
            return;
        }

        const loadDraftSession = async () => {
            setSessionLoading(true);
            setSessionError('');
            const [res] = await Promise.all([
                store.loadDraftSession(draftSessionId),
                store.leagues?.length ? Promise.resolve() : store.loadLeagues(),
            ]);
            if (!res.data?.success) {
                setSessionError(res.data?.errorMessage || 'Unable to load draft session.');
            }
            setSessionLoading(false);
        };

        loadDraftSession();
    }, [draftSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!draftSessionId) return;
        getSessionValuations(draftSessionId).then((res) => {
            if (res.status === 200 && res.data?.success) {
                const map = {};
                for (const v of (res.data.valuations || [])) {
                    const val = getValuationValue(v);
                    if (val == null) continue;
                    const candidates = [
                        v?.playerId,
                        v?.id,
                        v?.mlbId,
                        v?.mlbPersonId,
                        v?.name,
                        v?.playerName
                    ].filter((entry) => entry != null && entry !== '');
                    for (const candidate of candidates) {
                        map[String(candidate)] = val;
                    }
                }
                setValuationsMap(map);
                // US-22.1: auto-default to $ Value desc when valuations first load
                setPlayerSort((prev) => prev.field === 'name' ? { field: 'dollar', dir: 'desc' } : prev);
            }
        }).catch(() => {});
    }, [draftSessionId, availablePlayerIdsKey]);

    useEffect(() => {
        if (!draftSessionId) return;
        getSessionRecommendations(draftSessionId).then((res) => {
            if (res.status === 200 && res.data?.success) {
                setRecommendations(res.data.recommendations || []);
            }
        }).catch(() => {});
    }, [draftSessionId]);

    useEffect(() => {
        const defaultTeamId = teamOptions[0]?.teamId || FALLBACK_TEAMS[0];
        setEntryNominatedBy(defaultTeamId);
        setEntryWonBy(defaultTeamId);
    }, [teamOptions]);

    useEffect(() => {
        if (activeTab !== 'Players' && activeTab !== 'Draft Board') return;
        loadPlayers();
    }, [activeTab, loadPlayers]);

    useEffect(() => {
        postUsage({ event: 'draft_room_open', metadata: draftSessionId ? { draftSessionId } : {} }).catch(() => {});
    }, [draftSessionId]);

    // US-26: auto-populate taxi team when order advances
    useEffect(() => {
        const order = draftSession?.taxiDraftOrder || [];
        const counter = draftSession?.taxiNominationOrder || 0;
        if (order.length) {
            setTaxiTeamId(order[counter % order.length]);
        }
    }, [draftSession?.taxiDraftOrder, draftSession?.taxiNominationOrder]);

    useEffect(() => { setPlayersPage(0); }, [playerSearch, positionFilter, injuryOnly, startersOnly, playerSort]);

    // US-25.1: subscribe to SSE push stream with exponential backoff reconnect
    useEffect(() => {
        if (!draftSessionId) return;
        let es = null;
        let retryMs = 2000;
        let retryTimer = null;
        let lastEventId = '0';
        let cancelled = false;

        const connect = () => {
            const url = `${DRAFT_SESSIONS_API_BASE_URL}/${draftSessionId}/events?since=${lastEventId}`;
            es = new EventSource(url, { withCredentials: true });

            const handleEvent = (type) => (e) => {
                if (cancelled) return;
                try {
                    const data = JSON.parse(e.data);
                    if (e.lastEventId) lastEventId = e.lastEventId;
                    retryMs = 2000; // reset backoff on successful message

                    const playerObj = playersRef.current.find((p) => getPlayerId(p) === data.playerId);
                    const rawName = data.playerName || data.name || playerObj?.name || playerObj?.playerName;
                    const team = data.team || data.mlbTeam || playerObj?.mlbTeam || playerObj?.team;
                    const displayPlayer = rawName
                        ? `${abbrevPlayerName(rawName)}${team ? ` (${team})` : ''}`
                        : data.playerId;
                    const label = type === 'player.injury'
                        ? `🚨 ${displayPlayer} → ${data.newValue || data.status || 'status change'}`
                        : type === 'player.transaction'
                        ? `🔄 ${displayPlayer} — ${data.newValue?.typeDesc || 'transaction'}`
                        : `📊 ${displayPlayer} — depth chart updated`;

                    const event = { id: data.id, type, playerId: data.playerId, label, ts: Date.now(), data };
                    setPushEvents((prev) => [event, ...prev].slice(0, 50));

                    // Update the local player row if this player is in our list
                    if (data.newValue) {
                        setPlayers((prev) => prev.map((p) => {
                            const pid = getPlayerId(p);
                            if (pid !== data.playerId) return p;
                            if (type === 'player.injury') return { ...p, status: data.newValue };
                            if (type === 'player.depthChart') return { ...p, depthChartRank: data.newValue?.rank ?? p.depthChartRank, depthChartPosition: data.newValue?.position ?? p.depthChartPosition };
                            return p;
                        }));
                    }

                    // US-25.2: show toast unless muted
                    if (!mutePush) showToast('info', label, 8000);
                } catch (_) {}
            };

            ['player.injury', 'player.transaction', 'player.depthChart'].forEach((t) => {
                es.addEventListener(t, handleEvent(t));
            });

            es.onerror = () => {
                es.close();
                if (!cancelled) {
                    retryTimer = setTimeout(() => {
                        retryMs = Math.min(retryMs * 2, 30000);
                        connect();
                    }, retryMs);
                }
            };
        };

        connect();
        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
            es?.close();
        };
    }, [draftSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    const searchDraftBoardPlayers = useCallback(async (searchTerm) => {
        const trimmed = String(searchTerm || '').trim();

        if (!trimmed) {
            setEntryPlayerSuggestions([]);
            setShowEntrySuggestions(false);
            setEntryHighlightedIndex(-1);
            return;
        }

        const isAvailable = (player) => availableSet.size === 0 || availableSet.has(getPlayerId(player));

        const localMatches = (players || [])
            .filter((player) => isAvailable(player) && playerNameStartsWithSearch(getPlayerName(player), trimmed))
            .sort((left, right) => getPlayerName(left).localeCompare(getPlayerName(right)))
            .slice(0, 8);

        if (localMatches.length > 0) {
            setEntryPlayerSuggestions(localMatches);
            setShowEntrySuggestions(true);
            setEntryHighlightedIndex(-1);
            return;
        }

        const res = await fetchPlayerRows({ search: trimmed, limit: 8 });
        if (res.status === 200 && res.data?.success) {
            const matched = (res.data.players || [])
                .filter((player) => isAvailable(player) && playerNameStartsWithSearch(getPlayerName(player), trimmed))
                .sort((left, right) => getPlayerName(left).localeCompare(getPlayerName(right)));

            setEntryPlayerSuggestions(matched);
            setShowEntrySuggestions(matched.length > 0);
            setEntryHighlightedIndex(-1);
        } else {
            setEntryPlayerSuggestions([]);
            setShowEntrySuggestions(false);
            setEntryHighlightedIndex(-1);
        }
    }, [players, availableSet, fetchPlayerRows]);

    const searchPlayerSuggestions = useCallback(async (searchTerm) => {
        const trimmed = String(searchTerm || '').trim();

        if (!trimmed) {
            setPlayerSuggestions([]);
            setShowPlayerSuggestions(false);
            setHighlightedPlayerIndex(-1);
            return;
        }

        const localMatches = (players || [])
            .filter((player) => playerNameStartsWithSearch(getPlayerName(player), trimmed))
            .sort((left, right) => getPlayerName(left).localeCompare(getPlayerName(right)))
            .slice(0, 8);

        if (localMatches.length > 0) {
            setPlayerSuggestions(localMatches);
            setShowPlayerSuggestions(true);
            setHighlightedPlayerIndex(-1);
            return;
        }

        const res = await fetchPlayerRows({ search: trimmed, limit: 8 });
        if (res.status === 200 && res.data?.success) {
            const matched = (res.data.players || [])
                .filter((player) => getPlayerName(player).toLowerCase().includes(trimmed.toLowerCase()))
                .sort((left, right) => getPlayerName(left).localeCompare(getPlayerName(right)));

            setPlayerSuggestions(matched);
            setShowPlayerSuggestions(matched.length > 0);
            setHighlightedPlayerIndex(-1);
        } else {
            setPlayerSuggestions([]);
            setShowPlayerSuggestions(false);
            setHighlightedPlayerIndex(-1);
        }
    }, [players, fetchPlayerRows]);

    const handleEntryPlayerChange = async (event) => {
        const value = event.target.value;
        setEntryPlayer(value);
        setEntryPlayerId('');
        setEntryPlayerSearch(value);
        await searchDraftBoardPlayers(value);
    };

    const handleSelectEntryPlayer = (player) => {
        setEntryPlayer(getPlayerName(player));
        const pid = getPlayerId(player);
        setEntryPlayerId(pid);
        setEntryPlayerTeam(getPlayerTeamLabel(player));
        setEntryPlayerSearch(getPlayerName(player));
        setEntryPlayerSuggestions([]);
        setShowEntrySuggestions(false);
        setEntryHighlightedIndex(-1);
        const existingNote = draftSession?.playerNotes?.[pid] || '';
        setEntryNotes(existingNote);
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
            // loadPlayers useEffect fires automatically when playerSearch changes
            return;
        }

        await searchPlayerSuggestions(value);
        // loadPlayers useEffect fires automatically when playerSearch changes
    };

    const handleSelectPlayerSuggestion = (player) => {
        setPlayerSearch(getPlayerName(player));
        setPlayerSuggestions([]);
        setShowPlayerSuggestions(false);
        setHighlightedPlayerIndex(-1);
        // loadPlayers useEffect fires automatically when playerSearch changes
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

    const handleRecordPurchase = async () => {
        setEntrySubmitting(true);
        setEntryError('');
        setEntrySuccess('');
        const purchasedPlayerName = entryPlayer;
        const purchasedTeamName = getTeamName(draftSession?.teams?.find((t) => t.teamId === entryWonBy)) || entryWonBy;
        const purchasedPrice = Number(entryPrice);
        const res = await store.recordPurchase(draftSessionId, {
            playerId: entryPlayerId,
            playerName: entryPlayer,
            teamId: entryWonBy,
            price: purchasedPrice,
            notes: entryNotes,
            nominatingTeamId: entryNominatedBy || null,
            mlbTeam: entryPlayerTeam || '',
        });
        setEntrySubmitting(false);
        if (res.status === 200 && res.data?.success) {
            setEntryPlayer('');
            setEntryPlayerId('');
            setEntryPlayerTeam('');
            setEntryPrice('');
            setEntryNotes('');
            setEntrySuccess('Purchase recorded.');
            showToast('success', `${purchasedPlayerName} purchased by ${purchasedTeamName} for $${purchasedPrice}`);
            setTimeout(() => setEntrySuccess(''), 3000);
            // US-10.4: return focus to player search so the next nomination flows quickly
            setTimeout(() => playerSearchRef.current?.focus(), 50);
            getSessionRecommendations(draftSessionId).then((r) => {
                if (r.status === 200 && r.data?.success) setRecommendations(r.data.recommendations || []);
            }).catch(() => {});
        } else {
            const errorMessage = res.data?.errorMessage || 'Failed to record purchase.';
            setEntryError(errorMessage);
            showToast('error', errorMessage);
        }
    };

    // US-6.5: mark a team as "My Team" — persists via store.setMyTeam and refreshes recommendations.
    const handleSetMyTeam = async (teamId) => {
        if (!draftSessionId || !teamId) return;
        const res = await store.setMyTeam(draftSessionId, teamId);
        if (!res?.data?.success) {
            showToast('error', res?.data?.errorMessage || 'Failed to update team selection.');
            return;
        }
        getSessionRecommendations(draftSessionId).then((r) => {
            if (r.status === 200 && r.data?.success) setRecommendations(r.data.recommendations || []);
        }).catch(() => {});
    };

    const openUndoDialog = (entry) => {
        if (!entry) return;
        const teamName = getTeamName(draftSession?.teams?.find((t) => t.teamId === entry.teamId));
        setPendingUndo({
            purchaseId: entry.purchaseId,
            playerName: entry.playerName,
            teamName,
            price: entry.price,
        });
        setUndoError('');
    };

    const handleCancelUndo = () => {
        if (undoSubmitting) return;
        setPendingUndo(null);
        setUndoError('');
    };

    const handleConfirmUndo = async () => {
        if (!pendingUndo) return;
        setUndoSubmitting(true);
        setUndoError('');
        const undoneId = pendingUndo.purchaseId;
        const res = await store.undoPurchase(draftSessionId, undoneId);
        setUndoSubmitting(false);
        if (res?.status === 200 && res.data?.success) {
            setPendingUndo(null);
            setRosterUndoStack((s) => s.filter((tx) => tx.purchaseId !== undoneId));
            setRosterRedoStack((s) => s.filter((tx) => tx.purchaseId !== undoneId));
            getSessionRecommendations(draftSessionId).then((r) => {
                if (r.status === 200 && r.data?.success) setRecommendations(r.data.recommendations || []);
            }).catch(() => {});
        } else {
            setUndoError(res?.data?.errorMessage || 'Unable to undo this purchase.');
        }
    };

    const handleUndoLastPurchase = async () => {
        const history = draftSession?.draftHistory || [];
        if (!history.length) return;
        openUndoDialog(history[history.length - 1]);
    };

    const handleUndoRowPurchase = async (purchaseId) => {
        const entry = (draftSession?.draftHistory || []).find((h) => h.purchaseId === purchaseId);
        openUndoDialog(entry);
    };

    const handleRedoPurchase = async () => {
        const res = await store.redoPurchase(draftSessionId);
        if (!res?.data?.success) {
            showToast('error', res?.data?.errorMessage || 'Redo failed.');
        } else {
            showToast('success', 'Purchase re-applied.');
            // The redone purchase is back in its original state; any roster ops for it are stale.
            // We don't know the purchaseId from the response so clear the full roster stacks.
            setRosterUndoStack([]);
            setRosterRedoStack([]);
            getSessionRecommendations(draftSessionId).then((r) => {
                if (r.status === 200 && r.data?.success) setRecommendations(r.data.recommendations || []);
            }).catch(() => {});
        }
    };

    const handleStartEdit = (entry) => {
        setEditingPurchaseId(entry.purchaseId);
        setEditingPrice(String(entry.price));
        setEditingWonBy(entry.teamId);
        setEditingPosition(entry.positionFilled || '');
        setEditingNotes(entry.notes || '');
        setEditingOriginal(entry);
        setEditError('');
    };

    const handleCancelEdit = () => {
        setEditingPurchaseId('');
        setEditingPrice('');
        setEditingWonBy('');
        setEditingPosition('');
        setEditingNotes('');
        setEditingOriginal(null);
        setEditError('');
    };

    // US-5.3 / US-5.4: validate price + team affordability before submitting.
    const handleSaveEdit = async (purchaseId) => {
        setEditError('');
        const parsedPrice = Number(editingPrice);
        if (!Number.isInteger(parsedPrice) || parsedPrice < 1) {
            setEditError('Price must be a whole number of at least $1.');
            return;
        }

        const teams = draftSession?.teams || [];
        const newTeam = teams.find((t) => t.teamId === editingWonBy);
        if (!newTeam) {
            setEditError('Select a team for this purchase.');
            return;
        }

        // Effective remaining budget for the new team after the edit:
        // - same team, same price → no change
        // - same team, new price  → refund old price, charge new
        // - different team        → new team gets fully charged
        const original = editingOriginal;
        const sameTeam = original && original.teamId === editingWonBy;
        const refund   = sameTeam ? Number(original.price) : 0;
        const projectedBudget = Number(newTeam.budgetRemaining || 0) + refund - parsedPrice;

        // Reserve $1 for every still-open slot (post-edit, the player still occupies one).
        const teamPurchases = sameTeam
            ? (newTeam.purchasedPlayers || []).length
            : (newTeam.purchasedPlayers || []).length + 1;
        const totalSlots = Object.values(draftSession?.leagueSettings?.rosterSlots || {})
            .reduce((sum, n) => sum + (Number(n) || 0), 0);
        const openSlotsAfter = Math.max(totalSlots - teamPurchases, 0);

        if (projectedBudget < openSlotsAfter) {
            setEditError(`Price exceeds ${getTeamName(newTeam)}'s max bid (would leave ${projectedBudget} for ${openSlotsAfter} open slots).`);
            return;
        }

        if (!sameTeam && openSlotsAfter < 0) {
            setEditError(`${getTeamName(newTeam)}'s roster has no open slots.`);
            return;
        }

        setEditSubmitting(true);
        const res = await store.editPurchase(draftSessionId, purchaseId, { newPrice: parsedPrice, newTeamId: editingWonBy, newNotes: editingNotes });

        // US-22.3: if a new position was selected, apply it via the movePosition endpoint
        if (res?.status === 200 && res.data?.success && editingPosition && editingPosition !== editingOriginal?.positionFilled) {
            const { movePosition } = await import('../draft-sessions/requests.js');
            await movePosition(draftSessionId, purchaseId, editingPosition, []);
            await store.loadDraftSession(draftSessionId);
        }
        setEditSubmitting(false);

        if (res?.status === 200 && res.data?.success) {
            handleCancelEdit();
            setRosterUndoStack((s) => s.filter((tx) => tx.purchaseId !== purchaseId));
            setRosterRedoStack((s) => s.filter((tx) => tx.purchaseId !== purchaseId));
        } else {
            setEditError(res?.data?.errorMessage || 'Failed to save edit.');
        }
    };

    const handleSavePlayerNote = async (note) => {
        if (!draftSessionId || !selectedPlayer) return { success: false };
        setSavingPlayerNote(true);
        const playerId = getPlayerId(selectedPlayer);
        const res = await store.setPlayerNote(draftSessionId, playerId, note);
        setSavingPlayerNote(false);
        if (res.status === 200 && res.data?.success) {
            return { success: true };
        }
        return { success: false, errorMessage: res.data?.errorMessage || 'Failed to save note.' };
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

    const handleRefreshPlayerData = async () => {
        const refreshed = await loadPlayers();
        if (refreshed) {
            showToast('success', 'Player data refreshed.');
        }
    };

    const renderPlayersTab = () => (
        <>
            <div className="draft-v2-module-grid two-col" style={{ alignItems: 'stretch' }}>
                <article className="draft-v2-module-card">
                    <h3>Player Search & Filters</h3>
                    <div className="draft-v2-search-actions">
                        <label className="draft-v2-search-wrap draft-v2-live-search-wrap">
                            <span className="draft-v2-search-icon">⌕</span>
                            <input
                                ref={playerSearchRef}
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
                                                <strong>{getPlayerName(player)}</strong>
                                                <span>{getPlayerTeamLabel(player)} • {getPlayerPosition(player)}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </label>
                        <button type="button" className="draft-v2-filter-btn draft-v2-search-submit" onClick={loadPlayers}>Search</button>
                        <button
                            type="button"
                            className="draft-v2-filter-btn draft-v2-search-submit"
                            onClick={handleRefreshPlayerData}
                            disabled={playersLoading}
                        >
                            {playersLoading ? 'Refreshing...' : 'Refresh player data'}
                        </button>
                    </div>
                    <p className="draft-v2-auction-muted">
                        {playerDataAsOf ? `Player data as of ${formatDataAsOf(playerDataAsOf)}.` : 'Player data refreshes from the live pool for this draft.'}
                    </p>
                    <div className="draft-v2-filter-row">
                        {/* Sort by dropdown */}
                        <div className="draft-v2-dropdown" ref={sortMenuRef}>
                            <button
                                type="button"
                                className={`draft-v2-filter-btn draft-v2-dropdown-trigger ${isSortMenuOpen ? 'active' : ''}`}
                                onClick={() => { setIsSortMenuOpen((prev) => !prev); setIsFiltersMenuOpen(false); }}
                            >
                                Sort: {playerSort.field === 'name' ? 'Name' : playerSort.field === 'status' ? 'Status' : `${playerSort.field.toUpperCase()} ${playerSort.dir === 'asc' ? '▲' : '▼'}`} ▾
                            </button>
                            {isSortMenuOpen && (
                                <div className="draft-v2-dropdown-menu">
                                    {[
                                        { field: 'name', label: 'Name' },
                                        { field: 'status', label: 'Status' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.field}
                                            type="button"
                                            className={`draft-v2-dropdown-item ${playerSort.field === opt.field ? 'active' : ''}`}
                                            onClick={() => { setPlayerSort({ field: opt.field, dir: 'asc' }); setIsSortMenuOpen(false); }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Filters dropdown */}
                        <div className="draft-v2-dropdown" ref={filtersMenuRef}>
                            <button
                                type="button"
                                className={`draft-v2-filter-btn draft-v2-dropdown-trigger ${isFiltersMenuOpen || positionFilter.size > 0 || injuryOnly || startersOnly ? 'active' : ''}`}
                                onClick={() => { setIsFiltersMenuOpen((prev) => !prev); setIsSortMenuOpen(false); }}
                            >
                                Filters{(positionFilter.size > 0 || injuryOnly || startersOnly) ? ' •' : ''} ▾
                            </button>
                            {isFiltersMenuOpen && (
                                <div className="draft-v2-dropdown-menu draft-v2-filters-menu">
                                    <div className="draft-v2-dropdown-section-label">Position</div>
                                    <div className="draft-v2-dropdown-position-grid">
                                        {availablePositions.filter((pos) => pos !== 'ALL').map((pos) => (
                                            <button
                                                key={pos}
                                                type="button"
                                                className={`draft-v2-dropdown-item draft-v2-dropdown-pos-btn ${positionFilter.has(pos) ? 'active' : ''}`}
                                                onClick={() => setPositionFilter((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(pos)) next.delete(pos); else next.add(pos);
                                                    return next;
                                                })}
                                            >
                                                {pos}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="draft-v2-dropdown-divider" />
                                    <button
                                        type="button"
                                        className={`draft-v2-dropdown-item draft-v2-dropdown-toggle ${injuryOnly ? 'active' : ''}`}
                                        onClick={() => setInjuryOnly((prev) => !prev)}
                                    >
                                        <span className="draft-v2-dropdown-check">{injuryOnly ? '✓' : ''}</span>
                                        Injured Only
                                    </button>
                                    <button
                                        type="button"
                                        className={`draft-v2-dropdown-item draft-v2-dropdown-toggle ${startersOnly ? 'active' : ''}`}
                                        onClick={() => setStartersOnly((prev) => !prev)}
                                    >
                                        <span className="draft-v2-dropdown-check">{startersOnly ? '✓' : ''}</span>
                                        Starters Only
                                    </button>
                                </div>
                            )}
                        </div>

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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h3 style={{ margin: 0 }}>Player Profile & Glossary</h3>
                        <button type="button" className="draft-v2-filter-btn glossary-open-btn" onClick={() => setShowGlossary(true)}>
                            View full glossary
                        </button>
                    </div>
                    <ul className="draft-v2-checklist">
                        <li>Projected stats</li>
                        <li>Role (starter / reliever / everyday)</li>
                        <li>Injury / news flags</li>
                        <li><GlossaryTerm term="Position eligibility">Position eligibility</GlossaryTerm></li>
                        <li>Hover over the ? next to column headers for definitions.</li>
                    </ul>
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
                                <th>Depth</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('dollar')}><GlossaryTerm term="Value">$ Value</GlossaryTerm>{sortIcon('dollar')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('age')}>Age{sortIcon('age')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('hr')}>HR{sortIcon('hr')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('rbi')}>RBI{sortIcon('rbi')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('r')}>R{sortIcon('r')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('sb')}>SB{sortIcon('sb')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('avg')}>AVG{sortIcon('avg')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('w')}>W{sortIcon('w')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('sv')}>SV{sortIcon('sv')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('k')}>K{sortIcon('k')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('era')}><GlossaryTerm term="ERA">ERA</GlossaryTerm>{sortIcon('era')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('whip')}><GlossaryTerm term="WHIP">WHIP</GlossaryTerm>{sortIcon('whip')}</th>
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
                            ) : displayedPlayers.length === 0 ? (
                                <tr>
                                    <td colSpan={TABLE_HEADERS.length + 1} className="draft-v2-empty-row">
                                        {injuryOnly
                                            ? 'No injured players match the current view.'
                                            : 'No players found. Make sure the player source is available for the current mode.'}
                                    </td>
                                </tr>
                            ) : (
                                displayedPlayers.slice(playersPage * PAGE_SIZE, (playersPage + 1) * PAGE_SIZE).map((player) => (
                                    <tr
                                        key={getPlayerId(player)}
                                        className={isInCompare(player) ? 'draft-v2-tr-compare-selected' : ''}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(e) => { if (e.target.closest('button')) return; setSelectedPlayer(player); }}
                                    >
                                        <td>
                                            <span className="draft-v2-player-name-with-status">
                                                <span>{getPlayerName(player)}</span>
                                                {shouldShowStatusBadge(player) ? (
                                                    <span className={`draft-v2-status-badge ${getStatusCategory(player)}`}>
                                                        {getStatusLabel(player)}
                                                    </span>
                                                ) : null}
                                                {/* US-20.1: note indicator — filled when a note exists */}
                                                {draftSession?.playerNotes?.[getPlayerId(player)] ? (
                                                    <span className="draft-v2-note-indicator" title="Has note">📝</span>
                                                ) : null}
                                            </span>
                                        </td>
                                        <td>{getPlayerTeamLabel(player)}</td>
                                        <td>{getPlayerPosition(player)}</td>
                                        <td>
                                            <span className="draft-v2-depth-badge">
                                                {getDepthChartLabel(player)}
                                            </span>
                                        </td>
                                        <td>{getPlayerValuation(player)}</td>
                                        <td>{formatStat(pickFirstDefined(player, ['age', 'playerAge', 'Age']))}</td>
                                        <td>{formatStat(player.hr)}</td>
                                        <td>{formatStat(player.rbi)}</td>
                                        <td>{formatStat(player.r)}</td>
                                        <td>{formatStat(player.sb)}</td>
                                        <td>{player.avg != null ? Number(player.avg).toFixed(3) : '--'}</td>
                                        <td>{formatStat(pickFirstDefined(player, ['w', 'wins', 'W']))}</td>
                                        <td>{formatStat(pickFirstDefined(player, ['sv', 'saves', 'SV']))}</td>
                                        <td>{formatStat(player.k)}</td>
                                        <td>{formatPitcherRate(pickFirstDefined(player, ['era', 'ERA']))}</td>
                                        <td>{formatPitcherRate(pickFirstDefined(player, ['whip', 'WHIP']))}</td>
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
            {displayedPlayers.length > PAGE_SIZE && (
                <div className="draft-v2-pagination">
                    <button
                        className="draft-v2-filter-btn"
                        onClick={() => setPlayersPage((p) => p - 1)}
                        disabled={playersPage === 0}
                    >
                        ← Prev
                    </button>
                    <span className="draft-v2-pagination-info">
                        Page {playersPage + 1} of {Math.ceil(displayedPlayers.length / PAGE_SIZE)}
                    </span>
                    <button
                        className="draft-v2-filter-btn"
                        onClick={() => setPlayersPage((p) => p + 1)}
                        disabled={(playersPage + 1) * PAGE_SIZE >= displayedPlayers.length}
                    >
                        Next →
                    </button>
                </div>
            )}
        </>
    );

    // US-6.2: Purchased players view — sortable table of every recorded pick.
    const renderPurchasedTab = () => {
        const history = (draftSession?.draftHistory || []).slice();
        const teamsById = new Map((draftSession?.teams || []).map((t) => [t.teamId, t]));
        const sorted = (() => {
            if (purchasedSort === 'price') return [...history].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
            if (purchasedSort === 'team')  return [...history].sort((a, b) => getTeamName(teamsById.get(a.teamId)).localeCompare(getTeamName(teamsById.get(b.teamId))));
            return history; // 'order' — chronological as stored
        })();

        return (
            <section className="draft-v2-module-grid one-col">
                <article className="draft-v2-module-card full">
                    <h3>Purchased Players</h3>
                    <div className="draft-v2-filter-row">
                        <span className="draft-v2-auction-muted">Sort by:</span>
                        {[
                            { id: 'order', label: 'Order' },
                            { id: 'price', label: 'Price (high → low)' },
                            { id: 'team',  label: 'Team' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                className={`draft-v2-filter-btn ${purchasedSort === opt.id ? 'active' : ''}`}
                                onClick={() => setPurchasedSort(opt.id)}
                            >{opt.label}</button>
                        ))}
                    </div>
                    <div className="draft-v2-table-shell">
                        <div className="draft-v2-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Player</th>
                                        <th>Position</th>
                                        <th>Team That Bought</th>
                                        <th>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.length === 0 ? (
                                        <tr><td colSpan={5} className="draft-v2-empty-row">No picks recorded yet.</td></tr>
                                    ) : sorted.map((entry) => (
                                        <tr key={entry.purchaseId}>
                                            <td>{entry.nominationOrder ?? '--'}</td>
                                            <td>{entry.playerName}</td>
                                            <td>{entry.positionFilled || '--'}</td>
                                            <td>{getTeamName(teamsById.get(entry.teamId))}</td>
                                            <td>${entry.price}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </article>
            </section>
        );
    };

    // US-6.5: My Roster view — when the user has marked a team, lay out their
    // purchases against the configured roster slots so filled vs. open is obvious.
    const renderRosterTab = () => {
        const teams = draftSession?.teams || [];
        if (!teams.length) {
            return (
                <section className="draft-v2-module-grid one-col">
                    <article className="draft-v2-module-card">
                        <h3>My Roster</h3>
                        <p className="draft-v2-auction-muted">Configure the draft to populate teams.</p>
                    </article>
                </section>
            );
        }

        const isExplicit = Boolean(draftSession?.myTeamId);
        const team = myTeam;
        const rosterSlots = draftSession?.leagueSettings?.rosterSlots || {};
        const purchased = team?.purchasedPlayers || [];
        const filledByPos = team?.filledRosterSlots || {};

        return (
            <section className="draft-v2-module-grid one-col">
                <article className="draft-v2-module-card">
                    <h3>My Team</h3>
                    {!isExplicit ? (
                        <p className="draft-v2-auction-muted">No team marked yet — defaulting to <strong>{getTeamName(team)}</strong>. Use the team picker in the top bar to set your team.</p>
                    ) : (
                        <p className="draft-v2-auction-muted">Tracking <strong>{getTeamName(team)}</strong> as your team.</p>
                    )}
                </article>

                <article className="draft-v2-module-card">
                    <h3>Roster by Position</h3>
                    <div className="draft-v2-table-shell">
                        <div className="draft-v2-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Position</th>
                                        <th>Filled</th>
                                        <th>Target</th>
                                        <th>Open</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(rosterSlots).map((pos) => {
                                        const target = Number(rosterSlots[pos] || 0);
                                        const filled = Number(filledByPos[pos] || 0);
                                        const open = Math.max(target - filled, 0);
                                        return (
                                            <tr key={pos}>
                                                <td><strong>{pos}</strong></td>
                                                <td>{filled}</td>
                                                <td>{target}</td>
                                                <td className={open === 0 ? '' : 'draft-v2-need-pill'}>{open}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </article>

                <article className="draft-v2-module-card full">
                    <h3>Rostered Players ({purchased.length})</h3>
                    {purchased.length === 0 ? (
                        <div className="draft-v2-empty-box">No rostered players yet.</div>
                    ) : (
                        <div className="draft-v2-table-shell">
                            <div className="draft-v2-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Player</th>
                                            <th>Price</th>
                                            <th>Slot</th>
                                            <th>Move</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchased.map((p) => {
                                            const histEntry = (draftSession?.draftHistory || []).find((h) => h.playerId === p.playerId && h.teamId === team?.teamId);
                                            const displayName = histEntry?.playerName || p.playerId;
                                            const currentSlot = histEntry?.positionFilled || '—';
                                            const purchaseId  = histEntry?.purchaseId;
                                            const eligiblePos = Object.keys(rosterSlots).filter((pos) => pos !== 'BENCH');
                                            return (
                                                <tr key={p.playerId}>
                                                    <td>
                                                        {displayName}
                                                        {histEntry?.isKeeper ? <span className="draft-v2-status-badge active" style={{ marginLeft: 6, fontSize: 10 }}>K</span> : null}
                                                    </td>
                                                    <td>${p.price}</td>
                                                    <td>{currentSlot}</td>
                                                    <td>
                                                        {purchaseId ? (
                                                            <select
                                                                defaultValue=""
                                                                className="draft-v2-move-select"
                                                                onChange={async (e) => {
                                                                    const newPos = e.target.value;
                                                                    if (!newPos) return;
                                                                    e.target.value = '';
                                                                    const { movePosition } = await import('../draft-sessions/requests.js');
                                                                    const res = await movePosition(draftSessionId, purchaseId, newPos, eligiblePos);
                                                                    if (res.status === 200 && res.data?.success) {
                                                                        await store.loadDraftSession(draftSessionId);
                                                                    } else {
                                                                        showToast('error', res.data?.errorMessage || 'Could not move player.');
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">Move…</option>
                                                                {eligiblePos.map((pos) => (
                                                                    <option key={pos} value={pos}>{pos}</option>
                                                                ))}
                                                                <option value="BENCH">BENCH</option>
                                                            </select>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </article>
            </section>
        );
    };

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
                                            <strong>{getPlayerName(player)}</strong>
                                            <span>{getPlayerTeamLabel(player)} • {getPlayerPosition(player)}</span>
                                        </div>
                                        <div className="draft-v2-player-suggestion-value">
                                            {getPlayerValuation(player)}
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
                                <option key={team.teamId} value={team.teamId}>{team.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="draft-v2-field">
                        <span>Won By</span>
                        <select value={entryWonBy} onChange={(event) => setEntryWonBy(event.target.value)}>
                            {teamOptions.map((team) => (
                                <option key={team.teamId} value={team.teamId}>{team.label}</option>
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
                            onChange={(event) => setEntryPrice(event.target.value)}
                            onKeyDown={(e) => {
                                // US-10.4: Enter triggers Record Purchase when form is valid
                                if (e.key === 'Enter' && !priceError && entryPlayer && entryPrice && !entrySubmitting) {
                                    handleRecordPurchase();
                                }
                            }}
                        />
                        {priceError ? <span className="draft-v2-field-error">{priceError}</span> : null}
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
                {entryError ? <p className="draft-v2-entry-error">{entryError}</p> : null}
                {entrySuccess ? <p className="draft-v2-entry-success">{entrySuccess}</p> : null}
                <div className="draft-v2-auction-actions">
                    <button
                        type="button"
                        className="draft-v2-auction-btn"
                        onClick={handleRecordPurchase}
                        disabled={entrySubmitting || !entryPlayerId || !entryPrice || Boolean(priceError)}
                    >
                        {entrySubmitting ? 'Recording...' : 'Record Purchase'}
                    </button>
                </div>
            </article>

            <article className="draft-v2-module-card full">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>Draft Results Log</h3>
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                            type="button"
                            className="draft-v2-undo-btn"
                            onClick={handleUndoLastPurchase}
                            disabled={!draftSession?.draftHistory?.length}
                            title="Undo last purchase"
                        >⟲</button>
                        <button
                            type="button"
                            className="draft-v2-undo-btn"
                            onClick={handleRedoPurchase}
                            disabled={!(draftSession?.undoStackSize > 0)}
                            title="Redo last undone purchase"
                        >↻</button>
                    </span>
                </div>
                <div className="draft-v2-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Player</th>
                                <th>MLB Team</th>
                                <th>Auctioned By</th>
                                <th>Won By</th>
                                <th>Price</th>
                                <th>Position</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(draftSession?.draftHistory || []).length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="draft-v2-empty-row">
                                        No picks logged yet. Enter each completed draft result here during the live draft.
                                    </td>
                                </tr>
                            ) : (
                                (draftSession.draftHistory).map((entry) => (
                                    <tr key={entry.purchaseId || entry.nominationOrder}>
                                        <td>{entry.nominationOrder}</td>
                                        <td>{entry.playerName}</td>
                                        <td>{entry.mlbTeam || '--'}</td>
                                        <td>{entry.nominatingTeamId ? getTeamName(draftSession.teams.find((t) => t.teamId === entry.nominatingTeamId)) : '--'}</td>
                                        <td>
                                            {editingPurchaseId === entry.purchaseId ? (
                                                <select value={editingWonBy} onChange={(e) => { setEditingWonBy(e.target.value); setEditError(''); }}>
                                                    {teamOptions.map((team) => (
                                                        <option key={team.teamId} value={team.teamId}>{team.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                getTeamName(draftSession.teams.find((t) => t.teamId === entry.teamId))
                                            )}
                                        </td>
                                        <td>
                                            {editingPurchaseId === entry.purchaseId ? (
                                                <>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={editingPrice}
                                                        onChange={(e) => { setEditingPrice(e.target.value); setEditError(''); }}
                                                        style={{ width: '60px' }}
                                                    />
                                                    {editError ? (
                                                        <div className="draft-v2-field-error" style={{ marginTop: 4 }}>{editError}</div>
                                                    ) : null}
                                                </>
                                            ) : (
                                                `$${entry.price}`
                                            )}
                                        </td>
                                        {/* US-22.3: position slot editor */}
                                        <td>
                                            {editingPurchaseId === entry.purchaseId ? (
                                                <select
                                                    value={editingPosition}
                                                    onChange={(e) => setEditingPosition(e.target.value)}
                                                    style={{ fontSize: '0.8rem', padding: '3px 6px', borderRadius: 6, border: '1px solid #c9d2e3' }}
                                                >
                                                    <option value="">— keep current —</option>
                                                    {Object.keys(draftSession?.leagueSettings?.rosterSlots || {}).map((pos) => (
                                                        <option key={pos} value={pos}>{pos}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                entry.positionFilled || '—'
                                            )}
                                        </td>
                                        <td>
                                            {editingPurchaseId === entry.purchaseId ? (
                                                <input
                                                    type="text"
                                                    placeholder="Notes..."
                                                    value={editingNotes}
                                                    onChange={(e) => setEditingNotes(e.target.value)}
                                                    style={{ width: '140px' }}
                                                />
                                            ) : (
                                                entry.notes || '--'
                                            )}
                                        </td>
                                        <td>
                                            {editingPurchaseId === entry.purchaseId ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="draft-v2-filter-btn"
                                                        disabled={editSubmitting}
                                                        onClick={() => handleSaveEdit(entry.purchaseId)}
                                                    >{editSubmitting ? 'Saving…' : 'Save'}</button>
                                                    <button
                                                        type="button"
                                                        className="draft-v2-filter-btn"
                                                        onClick={handleCancelEdit}
                                                        disabled={editSubmitting}
                                                    >Cancel</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="draft-v2-filter-btn"
                                                        onClick={() => handleUndoRowPurchase(entry.purchaseId)}
                                                    >Undo</button>
                                                    <button
                                                        type="button"
                                                        className="draft-v2-filter-btn"
                                                        onClick={() => handleStartEdit(entry)}
                                                    >Edit</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
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
                <div className="draft-v2-table-shell">
                    <div className="draft-v2-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Team</th>
                                    <th>Budget Remaining</th>
                                    <th>Budget Spent</th>
                                    <th>Slots Filled</th>
                                    <th>Max Bid</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(draftSession?.teams || []).map((team) => {
                                    const rosterSlots = draftSession?.leagueSettings?.rosterSlots || {};
                                    const filled = Object.values(team.filledRosterSlots || {}).reduce((sum, value) => sum + Number(value || 0), 0);
                                    const target = Object.values(rosterSlots).reduce((sum, value) => sum + Number(value || 0), 0);
                                    const spotsRemaining = Math.max(target - filled, 0);
                                    const cap = Number(draftSession?.leagueSettings?.salaryCap || 0);
                                    const spent = Math.max(cap - Number(team.budgetRemaining || 0), 0);
                                    const isMine = draftSession?.myTeamId === team.teamId;

                                    return (
                                        <tr key={team.teamId} className={isMine ? 'draft-v2-tr-compare-selected' : ''}>
                                            <td><strong>{getTeamName(team)}</strong></td>
                                            <td>{team.budgetRemaining != null ? `$${team.budgetRemaining}` : '--'}</td>
                                            <td>${spent}</td>
                                            <td>{filled} / {target || '--'}</td>
                                            <td>{team.budgetRemaining != null && spotsRemaining > 0 ? `$${Math.max(team.budgetRemaining - (spotsRemaining - 1), 1)}` : '--'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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

        </section>
    );

    // US-23.1 / US-23.2: side-by-side fantasy team comparison, sortable
    const renderCompareTab = () => {
        const teams = draftSession?.teams || [];
        const rosterSlots = draftSession?.leagueSettings?.rosterSlots || {};
        const totalSlots = Object.values(rosterSlots).reduce((s, n) => s + Number(n || 0), 0);
        const myTeamId = draftSession?.myTeamId;

        // Build a player stats lookup from the local player array
        const statsByPlayerId = {};
        players.forEach((p) => { statsByPlayerId[getPlayerId(p)] = p; });

        const STAT_COLS = [
            { key: 'hr',  label: 'HR' },
            { key: 'rbi', label: 'RBI' },
            { key: 'r',   label: 'R' },
            { key: 'sb',  label: 'SB' },
            { key: 'avg', label: 'AVG' },
            { key: 'w',   label: 'W' },
            { key: 'sv',  label: 'SV' },
            { key: 'k',   label: 'K' },
        ];

        // Build rows: one per team
        const rows = teams.map((team) => {
            const spent = (team.purchasedPlayers || []).reduce((s, p) => s + Number(p.price || 0), 0);
            const remaining = team.budgetRemaining ?? 0;
            const slotsMap = team.filledRosterSlots instanceof Map
                ? Object.fromEntries(team.filledRosterSlots.entries())
                : (team.filledRosterSlots || {});
            const filledSlots = Object.values(slotsMap).reduce((s, v) => s + Number(v || 0), 0);
            const totalDollars = (team.purchasedPlayers || []).reduce((s, p) => {
                const val = Number(valuationsMap[p.playerId] || 0);
                return s + val;
            }, 0);
            const stats = {};
            STAT_COLS.forEach(({ key }) => { stats[key] = 0; });
            (team.purchasedPlayers || []).forEach((p) => {
                const playerData = statsByPlayerId[p.playerId];
                if (!playerData) return;
                STAT_COLS.forEach(({ key }) => {
                    stats[key] += Number(playerData[key] || 0);
                });
            });
            return { team, spent, remaining, filledSlots, totalSlots, totalDollars, stats };
        });

        // US-23.2: sort
        const { field, dir } = compareSort;
        const sorted = [...rows].sort((a, b) => {
            let va, vb;
            if (field === 'name')        { va = getTeamName(a.team); vb = getTeamName(b.team); }
            else if (field === 'spent')  { va = a.spent;        vb = b.spent; }
            else if (field === 'remaining') { va = a.remaining; vb = b.remaining; }
            else if (field === 'slots')  { va = a.filledSlots;  vb = b.filledSlots; }
            else if (field === 'totalDollars') { va = a.totalDollars; vb = b.totalDollars; }
            else { va = a.stats[field] ?? 0; vb = b.stats[field] ?? 0; }
            if (typeof va === 'string') return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            return dir === 'asc' ? va - vb : vb - va;
        });

        const cycleSort = (col) => {
            setCompareSort((prev) => {
                if (prev.field !== col) return { field: col, dir: 'desc' };
                if (prev.dir === 'desc') return { field: col, dir: 'asc' };
                return { field: 'totalDollars', dir: 'desc' }; // back to default
            });
        };
        const sortIcon = (col) => compareSort.field === col ? (compareSort.dir === 'desc' ? ' ▼' : ' ▲') : '';

        return (
            <section className="draft-v2-module-grid one-col">
                <article className="draft-v2-module-card full">
                    <h3>Team Comparison</h3>
                    <p className="draft-v2-auction-muted">Click any column header to sort. Your team is highlighted.</p>
                    <div className="draft-v2-table-shell">
                        <div className="draft-v2-table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th className="draft-v2-th-sortable" onClick={() => cycleSort('name')}>Team{sortIcon('name')}</th>
                                        <th className="draft-v2-th-sortable" onClick={() => cycleSort('spent')}>Spent{sortIcon('spent')}</th>
                                        <th className="draft-v2-th-sortable" onClick={() => cycleSort('remaining')}>Budget Left{sortIcon('remaining')}</th>
                                        <th className="draft-v2-th-sortable" onClick={() => cycleSort('slots')}>Slots{sortIcon('slots')}</th>
                                        {STAT_COLS.map(({ key, label }) => (
                                            <th key={key} className="draft-v2-th-sortable" onClick={() => cycleSort(key)}>{label}{sortIcon(key)}</th>
                                        ))}
                                        <th className="draft-v2-th-sortable" onClick={() => cycleSort('totalDollars')}>Total ${sortIcon('totalDollars')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(({ team, spent, remaining, filledSlots, totalDollars, stats }) => (
                                        <tr key={team.teamId}
                                            className={team.teamId === myTeamId ? 'draft-v2-compare-my-team-row' : ''}
                                        >
                                            <td>
                                                <strong>{getTeamName(team)}</strong>
                                                {team.teamId === myTeamId
                                                    ? <span className="draft-v2-status-badge active" style={{ marginLeft: 6, fontSize: 10 }}>Mine</span>
                                                    : null}
                                            </td>
                                            <td>${Math.round(spent)}</td>
                                            <td>${Math.round(remaining)}</td>
                                            <td>{filledSlots}/{totalSlots}</td>
                                            {STAT_COLS.map(({ key }) => (
                                                <td key={key}>
                                                    {key === 'avg'
                                                        ? (stats[key] > 0 ? (stats[key] / Math.max(1, (team.purchasedPlayers || []).length)).toFixed(3) : '--')
                                                        : Math.round(stats[key]) || '--'}
                                                </td>
                                            ))}
                                            <td><strong>${Math.round(totalDollars)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {rows.length === 0 && <div className="draft-v2-empty-box">No teams configured yet.</div>}
                </article>
            </section>
        );
    };

    // US-24.1: MLB depth charts grouped by position, ordered by rank
    const renderMlbDepthTab = () => {
        // Build a lookup: playerId → { fantasyTeamName, isMyTeam }
        const fantasyOwnership = {};
        (draftSession?.teams || []).forEach((team) => {
            const isMine = team.teamId === draftSession?.myTeamId;
            (team.purchasedPlayers || []).forEach((p) => {
                fantasyOwnership[p.playerId] = { name: getTeamName(team), isMine };
            });
        });

        const loadDepth = async (abbr) => {
            setMlbLoading(true);
            setMlbPlayers([]);
            const { getPlayers } = await import('../players/requests.js');
            const res = await getPlayers({ team: abbr, limit: 200 });
            setMlbLoading(false);
            if (res.status === 200 && res.data?.success) {
                setMlbPlayers(res.data.players || []);
            }
        };

        // Group by depthChartPosition, sort by depthChartRank within each group
        const charted = mlbPlayers.filter((p) => p.depthChartRank != null && p.depthChartPosition);
        const uncharted = mlbPlayers.filter((p) => p.depthChartRank == null || !p.depthChartPosition);
        const grouped = {};
        charted.forEach((p) => {
            const grp = p.depthChartPosition || 'Other';
            if (!grouped[grp]) grouped[grp] = [];
            grouped[grp].push(p);
        });
        Object.values(grouped).forEach((arr) => arr.sort((a, b) => (a.depthChartRank || 99) - (b.depthChartRank || 99)));

        // Position display order: hitters first, then pitchers
        const HITTER_ORDER = ['C','1B','2B','3B','SS','LF','CF','RF','OF','DH'];
        const PITCHER_ORDER = ['SP','CL','RP'];
        const ALL_ORDER = [...HITTER_ORDER, ...PITCHER_ORDER];
        const sortedGroups = [
            ...ALL_ORDER.filter((k) => grouped[k]),
            ...Object.keys(grouped).filter((k) => !ALL_ORDER.includes(k)).sort(),
        ];

        return (
            <section className="draft-v2-module-grid one-col">
                <article className="draft-v2-module-card full">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>MLB Depth Charts</h3>
                        <select
                            value={mlbTeam}
                            className="draft-setup-keeper-select"
                            onChange={(e) => { setMlbTeam(e.target.value); loadDepth(e.target.value); }}
                        >
                            {MLB_TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button
                            type="button"
                            className="draft-v2-filter-btn"
                            onClick={() => loadDepth(mlbTeam)}
                            disabled={mlbLoading}
                        >
                            {mlbLoading ? 'Loading…' : 'Load Depth'}
                        </button>
                    </div>
                    <p className="draft-v2-auction-muted" style={{ marginBottom: 12 }}>
                        Players highlighted in green are on your fantasy team. Gray = on another team.
                    </p>

                    {mlbLoading && <p className="draft-v2-auction-muted">Fetching {mlbTeam} depth chart…</p>}

                    {!mlbLoading && mlbPlayers.length === 0 && (
                        <div className="draft-v2-empty-box">Select a team and click "Load Depth".</div>
                    )}

                    {sortedGroups.map((pos) => (
                        <div key={pos} className="draft-v2-depth-group">
                            <h4 className="draft-v2-depth-group-header">{pos}</h4>
                            {grouped[pos].map((p) => {
                                const pid = p.playerId || p.id;
                                const ownership = fantasyOwnership[pid];
                                return (
                                    <div
                                        key={pid}
                                        className={`draft-v2-depth-player-row ${ownership ? (ownership.isMine ? 'depth-mine' : 'depth-taken') : ''}`}
                                    >
                                        <span className="draft-v2-depth-rank">#{p.depthChartRank}</span>
                                        <span className="draft-v2-depth-name">{p.name || p.playerName}</span>
                                        <span className="draft-v2-depth-pos-tag">{(p.positions || [p.position]).join('/')}</span>
                                        {p.status && p.status !== 'active' && (
                                            <span className="draft-v2-status-badge injured" style={{ fontSize: 10 }}>
                                                {p.status.replace(/_/g, '-').toUpperCase()}
                                            </span>
                                        )}
                                        {ownership && (
                                            <span className={`draft-v2-depth-owner ${ownership.isMine ? 'depth-owner-mine' : ''}`}>
                                                {ownership.name}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {!mlbLoading && uncharted.length > 0 && (
                        <div className="draft-v2-depth-group">
                            <h4 className="draft-v2-depth-group-header draft-v2-muted">Uncharted ({uncharted.length})</h4>
                            {uncharted.map((p) => {
                                const pid = p.playerId || p.id;
                                const ownership = fantasyOwnership[pid];
                                return (
                                    <div key={pid} className={`draft-v2-depth-player-row depth-uncharted ${ownership ? (ownership.isMine ? 'depth-mine' : 'depth-taken') : ''}`}>
                                        <span className="draft-v2-depth-rank">—</span>
                                        <span className="draft-v2-depth-name">{p.name || p.playerName}</span>
                                        {ownership && <span className={`draft-v2-depth-owner ${ownership.isMine ? 'depth-owner-mine' : ''}`}>{ownership.name}</span>}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </article>
            </section>
        );
    };

    // US-26: Taxi Draft tab
    const renderTaxiTab = () => {
        const teams        = draftSession?.teams || [];
        const taxiOrder    = draftSession?.taxiDraftOrder || [];
        const taxiHistory  = draftSession?.taxiHistory    || [];
        const taxiCounter  = draftSession?.taxiNominationOrder || 0;
        const nextTeamId   = taxiOrder.length ? taxiOrder[taxiCounter % taxiOrder.length] : null;
        const nextTeam     = teams.find((t) => t.teamId === nextTeamId);

        // Build rostered player set for search filtering
        const rosteredIds = new Set([
            ...(draftSession?.purchasedPlayerIds || []),
            ...teams.flatMap((t) => (t.minorLeaguePlayers || []).map((m) => m.playerId)),
        ]);

        const searchTaxi = async (term) => {
            if (!term || term.length < 2) { setTaxiResults([]); return; }
            const { getSessionPlayers } = await import('../draft-sessions/requests.js');
            const res = await getSessionPlayers(draftSessionId, { search: term, limit: 12, status: 'all' });
            if (res.status === 200 && res.data?.success) {
                setTaxiResults((res.data.players || []).filter((p) => !rosteredIds.has(getPlayerId(p))));
            }
        };

        const doTaxiPick = async () => {
            if (!taxiTeamId || !taxiPlayer) return;
            setTaxiLoading(true);
            setTaxiWarning('');
            const { recordTaxiPick } = await import('../draft-sessions/requests.js');
            const res = await recordTaxiPick(draftSessionId, {
                teamId: taxiTeamId,
                playerId: getPlayerId(taxiPlayer),
                playerName: getPlayerName(taxiPlayer),
            });
            setTaxiLoading(false);
            if (res.status === 201 && res.data?.success) {
                setTaxiPlayer(null); setTaxiSearch(''); setTaxiResults([]);
                await store.loadDraftSession(draftSessionId);
                showToast('success', `${getPlayerName(taxiPlayer)} → ${getTeamName(teams.find((t) => t.teamId === taxiTeamId))}`);
            } else {
                setTaxiWarning(res.data?.errorMessage || 'Could not record pick.');
            }
        };

        const doUndoTaxiPick = async (taxiPickId) => {
            const { undoTaxiPick } = await import('../draft-sessions/requests.js');
            const res = await undoTaxiPick(draftSessionId, taxiPickId);
            if (res.status === 200 && res.data?.success) {
                await store.loadDraftSession(draftSessionId);
                showToast('success', 'Taxi pick undone.');
            } else {
                showToast('error', res.data?.errorMessage || 'Could not undo pick.');
            }
        };

        return (
            <section className="draft-v2-module-grid one-col">
                <article className="draft-v2-module-card full">
                    <h3>Taxi Draft</h3>
                    <p className="draft-v2-auction-muted" style={{ marginBottom: 12 }}>
                        Record taxi (minor league) picks. Players added here are excluded from the main auction pool.
                        {nextTeam ? <> Next pick: <strong>{getTeamName(nextTeam)}</strong> (round {Math.floor(taxiCounter / Math.max(1, taxiOrder.length)) + 1}).</> : null}
                    </p>

                    {/* Entry form */}
                    <div className="draft-setup-keeper-form" style={{ marginBottom: 16 }}>
                        {taxiOrder.length > 0 ? (
                            <div className="draft-setup-keeper-select draft-taxi-locked-team">
                                {nextTeam ? getTeamName(nextTeam) : '—'}
                            </div>
                        ) : (
                            <select value={taxiTeamId} onChange={(e) => setTaxiTeamId(e.target.value)} className="draft-setup-keeper-select">
                                <option value="">— Team —</option>
                                {teams.map((t) => <option key={t.teamId} value={t.teamId}>{getTeamName(t)}</option>)}
                            </select>
                        )}
                        <div className="draft-setup-keeper-search">
                            <input type="text" placeholder="Search prospect…" value={taxiSearch} autoComplete="off"
                                onChange={(e) => { setTaxiSearch(e.target.value); setTaxiPlayer(null); searchTaxi(e.target.value); }} />
                            {taxiPlayer && <span className="draft-setup-keeper-chosen">✓ {getPlayerName(taxiPlayer)}</span>}
                            {taxiResults.length > 0 && !taxiPlayer && (
                                <div className="draft-setup-keeper-dropdown">
                                    {taxiResults.map((p) => (
                                        <button key={getPlayerId(p)} type="button"
                                            onClick={() => { setTaxiPlayer(p); setTaxiSearch(getPlayerName(p)); setTaxiResults([]); }}>
                                            {getPlayerName(p)} <span>{getPlayerTeamLabel(p)} · {getPlayerPosition(p)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button type="button" className="home-dark-btn" disabled={!taxiTeamId || !taxiPlayer || taxiLoading} onClick={doTaxiPick}>
                            {taxiLoading ? 'Recording…' : '+ Pick'}
                        </button>
                    </div>
                    {taxiWarning && <p className="draft-v2-entry-error" style={{ marginBottom: 8 }}>{taxiWarning}</p>}

                    {/* Taxi history */}
                    {taxiHistory.length === 0 ? (
                        <div className="draft-v2-empty-box">No taxi picks yet.</div>
                    ) : (
                        <div className="draft-v2-table-shell">
                            <div className="draft-v2-table-wrap">
                                <table>
                                    <thead>
                                        <tr><th>#</th><th>Player</th><th>Team</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {[...taxiHistory].reverse().map((h) => (
                                            <tr key={h.taxiPickId}>
                                                <td style={{ color: '#94a3b8' }}>{h.nominationOrder + 1}</td>
                                                <td>{h.playerName}</td>
                                                <td>{getTeamName(teams.find((t) => t.teamId === h.teamId))}</td>
                                                <td>
                                                    <button type="button" className="draft-v2-filter-btn"
                                                        style={{ color: '#e53e3e', fontSize: '0.78rem' }}
                                                        onClick={() => doUndoTaxiPick(h.taxiPickId)}
                                                    >Undo</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </article>
            </section>
        );
    };

    const pushRosterTransaction = (tx) => {
        setRosterUndoStack((s) => [...s, tx]);
        setRosterRedoStack([]);
    };

    const handleRosterUndo = async () => {
        if (!rosterUndoStack.length) return;
        const tx = rosterUndoStack[rosterUndoStack.length - 1];
        let res;
        if (tx.type === 'movePosition') {
            const { movePosition: movePosReq } = await import('../draft-sessions/requests.js');
            res = await movePosReq(draftSessionId, tx.purchaseId, tx.oldPos, tx.rawPositions);
        } else {
            res = await store.editPurchase(draftSessionId, tx.purchaseId, { newTeamId: tx.oldTeamId });
        }
        if (res?.status === 200 && res.data?.success) {
            await store.loadDraftSession(draftSessionId);
            setRosterUndoStack((s) => s.slice(0, -1));
            setRosterRedoStack((s) => [...s, tx]);
        } else {
            // Purchase was deleted (undone at draft board level) — drop the stale transaction
            setRosterUndoStack((s) => s.slice(0, -1));
            const isStale = res?.status === 404 || res?.data?.errorMessage?.toLowerCase().includes('not found');
            showToast('error', isStale
                ? `Cannot undo: ${tx.playerName || 'player'} was removed from the draft.`
                : res?.data?.errorMessage || 'Could not undo roster change.');
        }
    };

    const handleRosterRedo = async () => {
        if (!rosterRedoStack.length) return;
        const tx = rosterRedoStack[rosterRedoStack.length - 1];
        let res;
        if (tx.type === 'movePosition') {
            const { movePosition: movePosReq } = await import('../draft-sessions/requests.js');
            res = await movePosReq(draftSessionId, tx.purchaseId, tx.newPos, tx.rawPositions);
        } else {
            res = await store.editPurchase(draftSessionId, tx.purchaseId, { newTeamId: tx.newTeamId });
        }
        if (res?.status === 200 && res.data?.success) {
            await store.loadDraftSession(draftSessionId);
            setRosterRedoStack((s) => s.slice(0, -1));
            setRosterUndoStack((s) => [...s, tx]);
        } else {
            setRosterRedoStack((s) => s.slice(0, -1));
            const isStale = res?.status === 404 || res?.data?.errorMessage?.toLowerCase().includes('not found');
            showToast('error', isStale
                ? `Cannot redo: ${tx.playerName || 'player'} was removed from the draft.`
                : res?.data?.errorMessage || 'Could not redo roster change.');
        }
    };

    const renderLeagueRostersTab = () => {
        const teams = draftSession?.teams || [];
        const draftHistory = draftSession?.draftHistory || [];
        const rosterSlots = draftSession?.leagueSettings?.rosterSlots || {};
        const myTeamId = draftSession?.myTeamId;

        if (!teams.length) {
            return (
                <section className="draft-v2-module-grid one-col">
                    <article className="draft-v2-module-card">
                        <h3>League Rosters</h3>
                        <p className="draft-v2-auction-muted">Configure the draft to populate teams.</p>
                    </article>
                </section>
            );
        }

        // Build slot order canonically from rosterSlots
        const orderedSlotTypes = Object.keys(rosterSlots).sort(
            (a, b) => (POSITION_RANK[a] ?? 99) - (POSITION_RANK[b] ?? 99)
        );
        const allSlotKeys = orderedSlotTypes;

        // Build player lookup for eligibility checks
        const playersByIdMap = {};
        players.forEach((p) => { playersByIdMap[getPlayerId(p)] = p; });

        // Group draftHistory by teamId, then by positionFilled within each team
        const historyByTeam = {};
        teams.forEach((t) => { historyByTeam[t.teamId] = {}; });
        draftHistory.forEach((h) => {
            if (!historyByTeam[h.teamId]) return;
            const pos = h.positionFilled || 'BENCH';
            if (!historyByTeam[h.teamId][pos]) historyByTeam[h.teamId][pos] = [];
            historyByTeam[h.teamId][pos].push(h);
        });

        // Build the full ordered row list for a team: one row per slot, blank if unfilled
        const buildRows = (teamId) => {
            const byPos = historyByTeam[teamId] || {};
            const rows = [];
            for (const pos of orderedSlotTypes) {
                const count = Number(rosterSlots[pos] || 0);
                const entries = byPos[pos] || [];
                for (let i = 0; i < count; i++) {
                    rows.push({ pos, entry: entries[i] || null });
                }
            }
            // Any entries filed under BENCH or positions not in rosterSlots
            const extraKeys = Object.keys(byPos).filter((k) => !orderedSlotTypes.includes(k));
            extraKeys.forEach((k) => {
                (byPos[k] || []).forEach((entry) => rows.push({ pos: k, entry }));
            });
            return rows;
        };

        return (
            <section className="draft-v2-module-grid one-col">
                <article className="draft-v2-module-card full">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>League Rosters</h3>
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                                type="button"
                                className="draft-v2-undo-btn"
                                onClick={handleRosterUndo}
                                disabled={!rosterUndoStack.length}
                                title="Undo last roster change"
                            >⟲</button>
                            <button
                                type="button"
                                className="draft-v2-undo-btn"
                                onClick={handleRosterRedo}
                                disabled={!rosterRedoStack.length}
                                title="Redo last undone roster change"
                            >↻</button>
                        </span>
                    </div>
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start' }}>
                            {teams.map((team) => {
                                const rows = buildRows(team.teamId);
                                const isMyTeam = team.teamId === myTeamId;
                                const filledByPos = team?.filledRosterSlots instanceof Map
                                    ? Object.fromEntries(team.filledRosterSlots.entries())
                                    : (team?.filledRosterSlots || {});
                                return (
                                    <div key={team.teamId}>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'baseline',
                                            marginBottom: 4,
                                            paddingBottom: 4,
                                            borderBottom: isMyTeam ? '2px solid #2563eb' : '2px solid #d5d8e1',
                                        }}>
                                            <strong style={{ fontSize: '0.85rem' }}>
                                                {getTeamName(team)}
                                                {isMyTeam && <span className="draft-v2-status-badge active" style={{ marginLeft: 5, fontSize: 9 }}>Mine</span>}
                                            </strong>
                                            <span className="draft-v2-auction-muted" style={{ fontSize: '0.75rem' }}>${team.budgetRemaining ?? '--'}</span>
                                        </div>
                                        <div style={{ border: '1px solid #d5d8e1', background: '#fff', overflow: 'hidden' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                                <colgroup>
                                                    <col style={{ width: 46 }} />
                                                    <col />
                                                    <col style={{ width: 18 }} />
                                                    <col style={{ width: 34 }} />
                                                    <col style={{ width: 30 }} />
                                                </colgroup>
                                                <tbody>
                                                    {rows.map(({ pos, entry }, idx) => {
                                                        const tdBase = { padding: '4px 4px', borderBottom: '1px solid #edf0f6' };
                                                        if (!entry) {
                                                            return (
                                                                <tr key={`${pos}-${idx}`} style={{ opacity: 0.45 }}>
                                                                    <td style={{ ...tdBase, fontSize: '0.75rem', color: '#8892a4', fontWeight: 600 }}>{pos}</td>
                                                                    <td colSpan={3} style={{ ...tdBase, color: '#b0b8c8', fontSize: '0.75rem', fontStyle: 'italic' }}>—</td>
                                                                    <td style={tdBase} />
                                                                </tr>
                                                            );
                                                        }
                                                        const h = entry;
                                                        const playerObj = playersByIdMap[h.playerId];
                                                        const rawPositions = playerObj
                                                            ? (Array.isArray(playerObj.positions) ? playerObj.positions : String(playerObj.position || '').split('/').filter(Boolean))
                                                            : [];
                                                        const eligibleSlots = allSlotKeys.filter((slotPos) => {
                                                            const isAlwaysEligible = slotPos === 'BENCH' || slotPos === 'UTIL';
                                                            if (!isAlwaysEligible && rawPositions.length > 0 && !rawPositions.includes(slotPos)) return false;
                                                            if (slotPos === h.positionFilled) return true;
                                                            return Number(filledByPos[slotPos] || 0) < Number(rosterSlots[slotPos] || 0);
                                                        });
                                                        const posColors = POS_COLOR[h.positionFilled] || { background: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' };
                                                        return (
                                                            <tr key={h.purchaseId} className="draft-v2-league-player-row">
                                                                <td style={{ ...tdBase, width: 42 }}>
                                                                    <select
                                                                        key={h.purchaseId + (h.positionFilled || '')}
                                                                        defaultValue={h.positionFilled || ''}
                                                                        className="draft-v2-pos-select"
                                                                        style={{ ...posColors }}
                                                                        onChange={async (e) => {
                                                                            const newPos = e.target.value;
                                                                            const oldPos = h.positionFilled || '';
                                                                            if (!newPos || newPos === oldPos) return;
                                                                            const { movePosition } = await import('../draft-sessions/requests.js');
                                                                            const res = await movePosition(draftSessionId, h.purchaseId, newPos, rawPositions);
                                                                            if (res.status === 200 && res.data?.success) {
                                                                                pushRosterTransaction({ type: 'movePosition', purchaseId: h.purchaseId, playerName: h.playerName, oldPos, newPos, rawPositions });
                                                                                await store.loadDraftSession(draftSessionId);
                                                                            } else {
                                                                                e.target.value = oldPos;
                                                                                showToast('error', res.data?.errorMessage || 'Could not move player.');
                                                                            }
                                                                        }}
                                                                    >
                                                                        {eligibleSlots.map((p) => (
                                                                            <option key={p} value={p}>{p}</option>
                                                                        ))}
                                                                        {!allSlotKeys.includes('BENCH') && <option value="BENCH">BENCH</option>}
                                                                    </select>
                                                                </td>
                                                                <td style={{ ...tdBase, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 500 }}>
                                                                    {h.playerName}
                                                                </td>
                                                                <td style={{ ...tdBase, fontSize: '0.72rem', color: '#6b7894' }}>
                                                                    {h.contractYears > 0 ? h.contractYears : '—'}
                                                                </td>
                                                                <td style={{ ...tdBase, fontWeight: 700, fontSize: '0.8rem', color: '#16a34a' }}>
                                                                    ${h.price}
                                                                </td>
                                                                <td style={{ ...tdBase, padding: '3px 4px', width: 28 }}>
                                                                    <select
                                                                        className="draft-v2-transfer-btn-select"
                                                                        value=""
                                                                        title="Transfer to another team"
                                                                        onChange={async (e) => {
                                                                            const newTeamId = e.target.value;
                                                                            const oldTeamId = team.teamId;
                                                                            if (!newTeamId) return;
                                                                            const res = await store.editPurchase(draftSessionId, h.purchaseId, { newTeamId });
                                                                            if (res.status === 200 && res.data?.success) {
                                                                                pushRosterTransaction({ type: 'transferTeam', purchaseId: h.purchaseId, playerName: h.playerName, oldTeamId, newTeamId });
                                                                            } else {
                                                                                showToast('error', res.data?.errorMessage || 'Could not transfer player.');
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">⇄</option>
                                                                        {teams.filter((t) => t.teamId !== team.teamId).map((t) => (
                                                                            <option key={t.teamId} value={t.teamId}>{getTeamName(t)}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {draftHistory.length === 0 && (
                        <div className="draft-v2-empty-box">No players drafted yet.</div>
                    )}
                </article>
            </section>
        );
    };

    const renderTabContent = () => {
        if (activeTab === 'Players') return renderPlayersTab();
        if (activeTab === 'Purchased') return renderPurchasedTab();
        if (activeTab === 'My Roster') return renderRosterTab();
        if (activeTab === 'Draft Board') return renderDraftBoardTab();
        if (activeTab === 'Teams')   return renderTeamsTab();
        if (activeTab === 'Compare')        return renderCompareTab();
        if (activeTab === 'League Rosters') return renderLeagueRostersTab();
        if (activeTab === 'MLB Depth')      return renderMlbDepthTab();
        if (activeTab === 'Taxi')      return renderTaxiTab();
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

    const selectedTeam = draftSession?.teams?.find((t) => t.teamId === entryWonBy) ?? null;
    const selectedTeamOpenSlots = (() => {
        if (!selectedTeam) return null;
        const rosterSlots = draftSession?.leagueSettings?.rosterSlots || {};
        const totalSlots = Object.values(rosterSlots).reduce((sum, v) => sum + Number(v || 0), 0);
        const filled = Object.values(selectedTeam.filledRosterSlots || {}).reduce((sum, v) => sum + Number(v || 0), 0);
        return Math.max(totalSlots - filled, 0);
    })();
    const maxBid = selectedTeam && selectedTeamOpenSlots > 0
        ? Math.max(selectedTeam.budgetRemaining - (selectedTeamOpenSlots - 1), 1)
        : null;
    const priceError = (() => {
        if (!entryPrice) return '';
        const parsed = Number(entryPrice);
        if (!Number.isInteger(parsed) || parsed < 1) return 'Price must be a whole number of at least $1.';
        if (maxBid != null && parsed > maxBid) return `Price exceeds max bid of $${maxBid}.`;
        return '';
    })();

    const draftTitle = draftSession?.name || 'Fantasy Baseball League';
    const draftStatus = getDraftStatusMeta(draftSession?.status);
    const currentLeagueName = (store.leagues || []).find((l) => l._id === leagueId)?.name || leagueId;
    const draftSubtitle = draftSession
        ? `${draftStatus.label} draft session for league ${currentLeagueName}.`
        : 'Welcome back. Draft room data will appear once API integration is enabled.';

    // US-6.5: sidebar metrics bind to `myTeam` (explicit or fallback).
    const sidebarTeam = myTeam;
    const totalRosterSlots = draftSession?.leagueSettings?.rosterSlots
        ? Object.values(draftSession.leagueSettings.rosterSlots).reduce((sum, value) => sum + Number(value || 0), 0)
        : 0;
    const sidebarFilled = sidebarTeam
        ? Object.values(sidebarTeam.filledRosterSlots || {}).reduce((sum, v) => sum + Number(v || 0), 0)
        : 0;
    const sidebarOpenSlots = Math.max(totalRosterSlots - sidebarFilled, 0);
    const sidebarMaxBid = sidebarTeam && sidebarOpenSlots > 0
        ? Math.max(Number(sidebarTeam.budgetRemaining || 0) - (sidebarOpenSlots - 1), 1)
        : null;
    // US-6.6: live avg-spent-per-purchased-player metric.
    const sidebarPurchased = sidebarTeam?.purchasedPlayers || [];
    const sidebarSpent = sidebarPurchased.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const sidebarAvgPerPlayer = sidebarPurchased.length > 0
        ? Math.round((sidebarSpent / sidebarPurchased.length) * 100) / 100
        : null;
    const sidebarAvgPerOpenSlot = sidebarOpenSlots > 0 && sidebarTeam
        ? Math.round((Number(sidebarTeam.budgetRemaining || 0) / sidebarOpenSlots) * 100) / 100
        : null;

    return (
        <main className="draft-v2-page">
            <header className="draft-v2-header">
                <button type="button" className="draft-v2-icon-btn" aria-label="Back" onClick={() => history.push('/home')}>
                    ←
                </button>

                <div className="draft-v2-title-wrap">
                    <h1>{draftTitle}</h1>
                    <p>{draftSubtitle}</p>
                </div>

                {/* US-10.1: draft session status badge */}
                {draftSession && (
                    <span className={`draft-v2-status-indicator draft-v2-status-indicator--${draftStatus.className}`}>
                        {draftStatus.label}
                    </span>
                )}

                <div className="draft-v2-header-actions">
                    {/* US-25.2: notification bell */}
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className="draft-v2-icon-btn"
                            onClick={() => setShowFeed((v) => !v)}
                            title="Push notifications"
                            style={{ position: 'relative' }}
                        >
                            🔔
                            {pushEvents.length > 0 && (
                                <span className="draft-v2-notif-badge">{Math.min(pushEvents.length, 9)}</span>
                            )}
                        </button>
                        {showFeed && (
                            <div className="draft-v2-notif-feed">
                                <div className="draft-v2-notif-feed-header">
                                    <span>Notifications ({pushEvents.length})</span>
                                    <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <input type="checkbox" checked={mutePush}
                                            onChange={(e) => {
                                                const v = e.target.checked;
                                                setMutePush(v);
                                                localStorage.setItem('draftiq-mute-push', v ? '1' : '0');
                                            }}
                                        /> Mute toasts
                                    </label>
                                    <button type="button" onClick={() => { setPushEvents([]); setShowFeed(false); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#718096' }}>✕</button>
                                </div>
                                {pushEvents.length === 0
                                    ? <p className="draft-v2-notif-empty">No notifications yet.</p>
                                    : pushEvents.map((ev) => (
                                        <div key={ev.id} className={`draft-v2-notif-row draft-v2-notif-${ev.type.replace(/\./g, '-')}`}
                                            onClick={() => { setShowFeed(false); /* could open player detail */ }}>
                                            <span>{ev.label}</span>
                                            <span className="draft-v2-notif-ts">{new Date(ev.ts).toLocaleTimeString()}</span>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                    {draftSession?.teams?.length > 0 && (
                        <div className="draft-v2-team-chip" ref={teamPickerRef}>
                            <button
                                type="button"
                                className={`draft-v2-team-chip-btn ${draftSession.myTeamId ? 'is-set' : 'is-unset'}`}
                                onClick={() => setIsTeamPickerOpen((o) => !o)}
                                aria-haspopup="listbox"
                                aria-expanded={isTeamPickerOpen}
                            >
                                <span className="draft-v2-team-chip-icon">&#128100;</span>
                                <span className="draft-v2-team-chip-label">
                                    {draftSession.myTeamId ? getTeamName(myTeam) : 'Pick My Team'}
                                </span>
                                <span className="draft-v2-team-chip-arrow">{isTeamPickerOpen ? '▲' : '▼'}</span>
                            </button>
                            {isTeamPickerOpen && (
                                <ul className="draft-v2-team-chip-dropdown" role="listbox">
                                    {draftSession.teams.map((t) => {
                                        const active = draftSession.myTeamId === t.teamId;
                                        return (
                                            <li
                                                key={t.teamId}
                                                role="option"
                                                aria-selected={active}
                                                className={`draft-v2-team-chip-item ${active ? 'active' : ''}`}
                                                onClick={() => { handleSetMyTeam(t.teamId); setIsTeamPickerOpen(false); }}
                                            >
                                                <span className="draft-v2-team-chip-item-name">{getTeamName(t)}</span>
                                                <span className="draft-v2-team-chip-item-budget">${t.budgetRemaining ?? '--'}</span>
                                                {active && <span className="draft-v2-team-chip-check">&#10003;</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
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
                            <strong>{sidebarTeam?.budgetRemaining != null ? `$${sidebarTeam.budgetRemaining}` : '--'}</strong>
                        </div>
                        {(() => {
                            const cap = Number(draftSession?.leagueSettings?.salaryCap || 0);
                            const remaining = Number(sidebarTeam?.budgetRemaining ?? cap);
                            const pct = cap > 0 ? Math.round((remaining / cap) * 100) : 100;
                            return (
                                <div
                                    className="draft-v2-meter"
                                    style={{ background: `linear-gradient(to right, #151735 ${pct}%, #d2d5de ${pct}%)` }}
                                    title={`${pct}% budget remaining`}
                                />
                            );
                        })()}
                        <p className="draft-v2-muted">
                            {draftSession ? (
                                <>
                                    {draftSession.myTeamId
                                        ? <>Tracking <strong>{getTeamName(sidebarTeam)}</strong></>
                                        : <>No team marked — defaulting to <strong>{getTeamName(sidebarTeam)}</strong></>}
                                </>
                            ) : 'Awaiting draft data from API'}
                        </p>
                        <div className="draft-v2-divider" />
                        <div className="draft-v2-metric-row">
                            <span>Maximum Bid</span>
                            <strong>{sidebarMaxBid != null ? `$${sidebarMaxBid}` : '--'}</strong>
                        </div>
                        <div className="draft-v2-metric-row">
                            <span>Avg $/Player</span>
                            <strong>{sidebarAvgPerPlayer != null ? `$${sidebarAvgPerPlayer}` : '--'}</strong>
                        </div>
                        <div className="draft-v2-metric-row">
                            <span>Avg $/Open Slot</span>
                            <strong>{sidebarAvgPerOpenSlot != null ? `$${sidebarAvgPerOpenSlot}` : '--'}</strong>
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
                                const filled = plannerEntry?.filled ?? 0;
                                const open = Math.max(target - filled, 0);
                                return (
                                    <div key={pos} className="draft-v2-roster-row">
                                        <span>{pos}</span>
                                        <span className="draft-v2-muted">{filled} / {target}</span>
                                        {open > 0
                                            ? <span className="draft-v2-need-pill">Need {open}</span>
                                            : <span className="draft-v2-muted">Filled</span>}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="draft-v2-next-priority">
                            Next Priority: {(rosterPlanner.find((entry) => entry.target - entry.filled > 0))?.slot || 'TBD'}
                        </div>
                    </article>

                    <article className="draft-v2-card">
                        <h2>Recommendations</h2>
                        {recommendations.length === 0 ? (
                            <div className="draft-v2-empty-box">Recommendations will appear after player pool data loads.</div>
                        ) : (
                            <ul className="draft-v2-checklist">
                                {recommendations.slice(0, 5).map((rec) => {
                                    const match = players.find((p) => getPlayerId(p) === rec.playerId);
                                    // Prefer local player name → API-returned name → prettified ID
                                    const localName = match ? getPlayerName(match) : '';
                                    const name = localName || rec.name || rec.playerName || rec.playerId;
                                    return (
                                        <li key={rec.playerId}>
                                            <strong>{name}</strong> — Bid ${rec.recommendedBid}
                                            {rec.reason ? <span className="draft-v2-auction-muted"> ({rec.reason})</span> : null}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </article>
                </aside>

                <section className="draft-v2-main">
                    <div className="draft-v2-main-head">
                        <h2>{activeTab === 'Players' ? 'Player Pool' : activeTab}</h2>
                        {activeTab === 'Players' ? (
                            <span className="draft-v2-count-pill">
                                {displayedPlayers.length} of {availableSet.size || playersTotal} Available
                                {hasMorePlayers && (
                                    <>
                                        <span className="draft-v2-count-pill-sep" />
                                        <button
                                            type="button"
                                            className="draft-v2-count-pill-btn"
                                            onClick={handleLoadMore}
                                            disabled={loadingMore}
                                        >
                                            {loadingMore ? 'Loading…' : 'Load more'}
                                        </button>
                                    </>
                                )}
                            </span>
                        ) : null}
                        {activeTab === 'Purchased' ? (
                            <span className="draft-v2-count-pill">{(draftSession?.draftHistory || []).length} Purchased</span>
                        ) : null}
                    </div>
                    {renderTabContent()}
                </section>
            </section>

            {toast ? (
                <div className={`draft-toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
                    {toast.message}
                </div>
            ) : null}
            {showGlossary ? <GlossaryModal onClose={() => setShowGlossary(false)} /> : null}
            {showCompareModal ? (
                <PlayerCompareModal
                    players={comparePlayers}
                    onClose={() => setShowCompareModal(false)}
                    getPlayerValuation={getPlayerValuation}
                />
            ) : null}
            {selectedPlayer ? (
                <PlayerInfoModal
                    player={selectedPlayer}
                    draftSessionId={draftSessionId}
                    initialNote={draftSession?.playerNotes?.[getPlayerId(selectedPlayer)] || ''}
                    onClose={() => setSelectedPlayer(null)}
                    onSaveNote={handleSavePlayerNote}
                    isSaving={savingPlayerNote}
                />
            ) : null}
            {pendingUndo ? (
                <div
                    className="undo-confirm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="undo-confirm-title"
                    onClick={(event) => event.target === event.currentTarget && handleCancelUndo()}
                >
                    <section className="undo-confirm-card">
                        <h2 id="undo-confirm-title">Confirm Undo</h2>
                        <p>
                            Are you sure you want to undo <strong>{pendingUndo.playerName}</strong> to <strong>{pendingUndo.teamName}</strong> for <strong>${pendingUndo.price}</strong>?
                        </p>
                        {undoError ? <p className="undo-confirm-error">{undoError}</p> : null}
                        <div className="undo-confirm-actions">
                            <button
                                type="button"
                                className="undo-confirm-cancel"
                                onClick={handleCancelUndo}
                                disabled={undoSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="undo-confirm-submit"
                                onClick={handleConfirmUndo}
                                disabled={undoSubmitting}
                            >
                                {undoSubmitting ? 'Undoing...' : 'Confirm'}
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </main>
    );
};

export default DraftRoomScreen;
