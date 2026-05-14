import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getPlayers as getCatalogPlayers, postUsage } from '../players/requests';
import { getSessionPlayers, getSessionValuations, getSessionRecommendations } from '../draft-sessions/requests';
import { GlobalStoreContext } from '../store';
import GlossaryTerm from './GlossaryTerm';
import GlossaryModal from './GlossaryModal';
import PlayerCompareModal from './PlayerCompareModal';
import PlayerInfoModal from './PlayerInfoModal';

const DEFAULT_ROSTER_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'SP', 'RP'];
const TABS = ['Players', 'Purchased', 'My Roster', 'Draft Board', 'Teams', 'Settings'];
const TABLE_HEADERS = ['Player', 'Team', 'Pos', 'Depth', 'Value', 'ADP', 'HR', 'RBI', 'R', 'SB', 'AVG', 'W', 'SV', 'K', 'ERA', 'WHIP'];
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
const formatRate = (val) => (val != null && Number.isFinite(val) && val > 0 ? Number(val).toFixed(2) : '--');

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
    const [playersError, setPlayersError] = useState('');
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
    const [playerSort, setPlayerSort] = useState({ field: 'name', dir: 'asc' });
    const [startersOnly, setStartersOnly] = useState(false);
    const [purchasedSort, setPurchasedSort] = useState('order'); // 'order' | 'price' | 'team'
    const [isTeamPickerOpen, setIsTeamPickerOpen] = useState(false);
    const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
    const [isFiltersMenuOpen, setIsFiltersMenuOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [savingPlayerNote, setSavingPlayerNote] = useState(false);
    const [editingNotes, setEditingNotes] = useState('');
    const teamPickerRef = useRef(null);
    const sortMenuRef = useRef(null);
    const filtersMenuRef = useRef(null);
    const playerSearchRef = useRef(null);  // US-10.4: focus target after recording purchase

    const draftSession = store.currentDraftSession;
    const availablePlayerIdsKey = useMemo(
        () => (draftSession?.availablePlayerIds || []).join('|'),
        [draftSession?.availablePlayerIds]
    );

    const showToast = useCallback((type, message) => {
        setToast({ type, message, id: Date.now() });
    }, []);

    useEffect(() => {
        if (!toast) return undefined;
        const timeoutId = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timeoutId);
    }, [toast]);

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
    const STAT_DEFAULT_DIR = { dollar: 'desc', adp: 'asc', hr: 'desc', rbi: 'desc', r: 'desc', sb: 'desc', avg: 'desc', w: 'desc', sv: 'desc', k: 'desc', era: 'asc', whip: 'asc' };
    const handleColSort = (field) => {
        setPlayerSort((prev) => {
            if (prev.field === field) return { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
            return { field, dir: STAT_DEFAULT_DIR[field] ?? 'asc' };
        });
    };
    const sortIcon = (field) => {
        if (playerSort.field !== field) return null;
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
                adp: () => pickFirstDefined(p, ['adp', 'ADP']),
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
        const res = await fetchPlayerRows({ search: playerSearch.trim(), limit: 500 });
        setPlayersLoading(false);
        if (res.status === 200 && res.data?.success) {
            setPlayers(res.data.players || []);
            setPlayersTotal(res.data.total ?? 0);
            setPlayerDataAsOf(res.data.dataAsOf || null);
            setPlayersError('');
            return true;
        } else {
            setPlayersError(res.data?.errorMessage || 'Failed to load players.');
            setPlayers([]);
            setPlayersTotal(0);
            return false;
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
            const res = await store.loadDraftSession(draftSessionId);
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
            await loadPlayers();
            return;
        }

        await searchPlayerSuggestions(value);

        const res = await fetchPlayerRows({ search: trimmed, limit: 500 });
        if (res.status === 200 && res.data?.success) {
            const filteredPlayers = (res.data.players || [])
                .filter((player) => playerNameStartsWithSearch(getPlayerName(player), trimmed))
                .sort((left, right) => getPlayerName(left).localeCompare(getPlayerName(right)));

            setPlayers(filteredPlayers);
            setPlayersTotal(filteredPlayers.length);
            setPlayerDataAsOf(res.data.dataAsOf || null);
            setPlayersError('');
        } else {
            setPlayers([]);
            setPlayersTotal(0);
            setPlayersError(res.data?.errorMessage || 'Failed to load players.');
        }
    };

    const handleSelectPlayerSuggestion = async (player) => {
        const selectedName = getPlayerName(player);

        setPlayerSearch(selectedName);
        setPlayerSuggestions([]);
        setShowPlayerSuggestions(false);
        setHighlightedPlayerIndex(-1);

        const res = await fetchPlayerRows({ search: selectedName, limit: 500 });
        if (res.status === 200 && res.data?.success) {
            const matched = (res.data.players || [])
                .filter((entry) => playerNameStartsWithSearch(getPlayerName(entry), selectedName))
                .sort((left, right) => getPlayerName(left).localeCompare(getPlayerName(right)));

            setPlayers(matched);
            setPlayersTotal(matched.length);
            setPlayerDataAsOf(res.data.dataAsOf || null);
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
        });
        setEntrySubmitting(false);
        if (res.status === 200 && res.data?.success) {
            setEntryPlayer('');
            setEntryPlayerId('');
            setEntryPrice('');
            setEntryNotes('');
            setEntrySuccess('Purchase recorded.');
            showToast('success', `${purchasedPlayerName} purchased by ${purchasedTeamName} for $${purchasedPrice}`);
            setTimeout(() => setEntrySuccess(''), 3000);
            // US-10.4: return focus to player search so the next nomination flows quickly
            setTimeout(() => playerSearchRef.current?.focus(), 50);
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
        const res = await store.undoPurchase(draftSessionId, pendingUndo.purchaseId);
        setUndoSubmitting(false);
        if (res?.status === 200 && res.data?.success) {
            setPendingUndo(null);
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

    const handleStartEdit = (entry) => {
        setEditingPurchaseId(entry.purchaseId);
        setEditingPrice(String(entry.price));
        setEditingWonBy(entry.teamId);
        setEditingNotes(entry.notes || '');
        setEditingOriginal(entry);
        setEditError('');
    };

    const handleCancelEdit = () => {
        setEditingPurchaseId('');
        setEditingPrice('');
        setEditingWonBy('');
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
        setEditSubmitting(false);

        if (res?.status === 200 && res.data?.success) {
            handleCancelEdit();
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
            <div className="draft-v2-module-grid two-col">
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
                                <th>Depth</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('dollar')}><GlossaryTerm term="Value">$ Value</GlossaryTerm>{sortIcon('dollar')}</th>
                                <th className="draft-v2-th-sortable" onClick={() => handleColSort('adp')}><GlossaryTerm term="ADP">ADP</GlossaryTerm>{sortIcon('adp')}</th>
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
                                displayedPlayers.map((player) => (
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
                                        <td>{formatStat(pickFirstDefined(player, ['adp', 'ADP']))}</td>
                                        <td>{formatStat(player.hr)}</td>
                                        <td>{formatStat(player.rbi)}</td>
                                        <td>{formatStat(player.r)}</td>
                                        <td>{formatStat(player.sb)}</td>
                                        <td>{player.avg != null ? Number(player.avg).toFixed(3) : '--'}</td>
                                        <td>{formatStat(pickFirstDefined(player, ['w', 'wins', 'W']))}</td>
                                        <td>{formatStat(pickFirstDefined(player, ['sv', 'saves', 'SV']))}</td>
                                        <td>{formatStat(player.k)}</td>
                                        <td>{formatRate(pickFirstDefined(player, ['era', 'ERA']))}</td>
                                        <td>{formatRate(pickFirstDefined(player, ['whip', 'WHIP']))}</td>
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
                    <h3>Purchased Players ({purchased.length})</h3>
                    {purchased.length === 0 ? (
                        <div className="draft-v2-empty-box">No rostered players yet.</div>
                    ) : (
                        <div className="draft-v2-table-shell">
                            <div className="draft-v2-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Player ID</th>
                                            <th>Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {purchased.map((p) => (
                                            <tr key={p.playerId}>
                                                <td>{p.playerId}</td>
                                                <td>${p.price}</td>
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
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(draftSession?.draftHistory || []).length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="draft-v2-empty-row">
                                        No picks logged yet. Enter each completed draft result here during the live draft.
                                    </td>
                                </tr>
                            ) : (
                                (draftSession.draftHistory).map((entry) => (
                                    <tr key={entry.purchaseId || entry.nominationOrder}>
                                        <td>{entry.nominationOrder}</td>
                                        <td>{entry.playerName}</td>
                                        <td>--</td>
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

            <article className="draft-v2-module-card full">
                <h3>API-Backed Areas (Pending)</h3>
                <p className="draft-v2-auction-muted">Player news, injury updates, live values, recommendation engine, and final exports will appear after backend integration.</p>
            </article>
        </section>
    );

    const renderTabContent = () => {
        if (activeTab === 'Players') return renderPlayersTab();
        if (activeTab === 'Purchased') return renderPurchasedTab();
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
    const draftSubtitle = draftSession
        ? `${draftStatus.label} draft session for league ${leagueId}.`
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
                    <span className={`league-status ${draftStatus.className}`}>
                        {draftStatus.label}
                    </span>
                    <button
                        type="button"
                        className="draft-v2-icon-btn"
                        aria-label="Undo"
                        disabled={!draftSession?.draftHistory?.length}
                        onClick={handleUndoLastPurchase}
                    >⟲</button>
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
