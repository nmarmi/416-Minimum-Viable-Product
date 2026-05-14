import { useContext, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { GlobalStoreContext } from '../store';

const DEFAULT_ROSTER_SLOTS = {
    C: 2,
    '1B': 1,
    '2B': 1,
    '3B': 1,
    SS: 1,
    OF: 5,
    UTIL: 1,
    SP: 5,
    RP: 3,
    BENCH: 4
};

const SCORING_OPTIONS = ['5x5 Roto', 'H2H Categories', 'Points'];

// US-17.1
const LEAGUE_SCOPE_OPTIONS = [
    { value: 'MLB', label: 'All MLB' },
    { value: 'AL',  label: 'AL Only' },
    { value: 'NL',  label: 'NL Only' },
];

// US-17.2: stat options per side
const HITTING_STAT_OPTIONS  = ['hr', 'r', 'rbi', 'sb', 'avg', 'obp', 'slg', 'h', 'ab', 'bb', 'k', 'cs'];
const PITCHING_STAT_OPTIONS = ['w', 'k', 'sv', 'era', 'whip', 'hld', 'k9', 'ip', 'qs', 'l'];

// US-17.3: default position catalogs
const DEFAULT_HITTER_CATALOG  = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'DH'];
const DEFAULT_PITCHER_CATALOG = ['SP', 'RP', 'P'];

const clampInt = (value, min, max = Number.POSITIVE_INFINITY) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(Math.max(parsed, min), max);
};

const buildFilledRosterSlots = (rosterSlots) => Object.keys(rosterSlots).reduce((acc, key) => {
    acc[key] = 0;
    return acc;
}, {});

const buildTeams = (numberOfTeams, salaryCap, rosterSlots, existingTeams = []) => {
    return Array.from({ length: numberOfTeams }, (_, index) => {
        const teamId = `fantasy-team-${index + 1}`;
        const existingTeam = existingTeams.find((team) => team.teamId === teamId);

        return {
            teamId,
            teamName: existingTeam?.teamName || teamId,
            budgetRemaining: salaryCap,
            purchasedPlayers: Array.isArray(existingTeam?.purchasedPlayers) ? existingTeam.purchasedPlayers : [],
            filledRosterSlots: buildFilledRosterSlots(rosterSlots)
        };
    });
};

const normalizeSession = (draftSession) => {
    const leagueSettings = draftSession?.leagueSettings || {};
    const rosterSlots = Object.keys(DEFAULT_ROSTER_SLOTS).reduce((acc, key) => {
        acc[key] = Number(leagueSettings.rosterSlots?.[key] ?? DEFAULT_ROSTER_SLOTS[key]);
        return acc;
    }, {});
    const numberOfTeams = clampInt(leagueSettings.numberOfTeams || 12, 2, 30);
    const salaryCap = clampInt(leagueSettings.salaryCap || 260, 1);

    // US-15.1: default to current year, accept any stored year >= 2000
    const rawYear = leagueSettings.seasonYear;
    const seasonYear = rawYear && Number(rawYear) >= 2000 ? Number(rawYear) : new Date().getFullYear();

    // US-17.1: league scope
    const leagueScope = ['MLB', 'AL', 'NL'].includes(leagueSettings.leagueScope)
        ? leagueSettings.leagueScope : 'MLB';

    // US-17.2: custom stat categories
    const statCategories = leagueSettings.statCategories
        ? { hitting: leagueSettings.statCategories.hitting || [], pitching: leagueSettings.statCategories.pitching || [] }
        : null;

    // US-17.3: custom position catalog
    const positionCatalog = leagueSettings.positionCatalog
        ? { hitter: leagueSettings.positionCatalog.hitter || [...DEFAULT_HITTER_CATALOG], pitcher: leagueSettings.positionCatalog.pitcher || [...DEFAULT_PITCHER_CATALOG] }
        : null;

    return {
        numberOfTeams,
        salaryCap,
        rosterSlots,
        scoringType: leagueSettings.scoringType || '5x5 Roto',
        draftType: leagueSettings.draftType || 'AUCTION',
        seasonYear,
        leagueScope,
        statCategories,
        positionCatalog,
        teams: buildTeams(numberOfTeams, salaryCap, rosterSlots, draftSession?.teams || [])
    };
};

export default function DraftSessionSetupScreen() {
    const history = useHistory();
    const { leagueId, draftSessionId } = useParams();
    const { store } = useContext(GlobalStoreContext);

    const [formState, setFormState] = useState(() => normalizeSession(null));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const loadSession = async () => {
            setLoading(true);
            setLoadError('');
            const res = await store.loadDraftSession(draftSessionId);
            if (res.status === 200 && res.data?.success) {
                setFormState(normalizeSession(res.data.draftSession));
            } else {
                setLoadError(res.data?.errorMessage || 'Unable to load draft session.');
            }
            setLoading(false);
        };

        loadSession();
    }, [draftSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

    const totalRosterSize = useMemo(
        () => Object.values(formState.rosterSlots).reduce((sum, value) => sum + Number(value || 0), 0),
        [formState.rosterSlots]
    );

    const validate = () => {
        if (formState.numberOfTeams < 2 || formState.numberOfTeams > 30) return 'Number of teams must be between 2 and 30.';
        if (formState.salaryCap < 1) return 'Salary cap must be at least 1.';
        if (totalRosterSize <= 0) return 'At least one roster slot is required.';
        return '';
    };

    const buildPayload = () => ({
        leagueSettings: {
            numberOfTeams:   formState.numberOfTeams,
            salaryCap:       formState.salaryCap,
            rosterSlots:     formState.rosterSlots,
            scoringType:     formState.scoringType,
            draftType:       'AUCTION',
            seasonYear:      formState.seasonYear,      // US-15.1
            leagueScope:     formState.leagueScope,     // US-17.1
            statCategories:  formState.statCategories,  // US-17.2
            positionCatalog: formState.positionCatalog, // US-17.3
        },
        teams: formState.teams.map((team) => ({
            teamId: team.teamId,
            teamName: String(team.teamName || '').trim() || team.teamId
        }))
    });

    const startDraft = async () => {
        const nextError = validate();
        if (nextError) {
            setFormError(nextError);
            return;
        }

        setSaving(true);
        setFormError('');

        const saveRes = await store.updateDraftSession(draftSessionId, buildPayload());
        if (!(saveRes.status === 200 && saveRes.data?.success)) {
            setSaving(false);
            setFormError(saveRes.data?.errorMessage || 'Unable to save draft settings.');
            return;
        }

        const startRes = await store.startDraft(draftSessionId);
        setSaving(false);

        if (startRes.status === 200 && startRes.data?.success) {
            history.push(`/league/${leagueId}/draft-room/${draftSessionId}`);
            return;
        }

        setFormError(startRes.data?.errorMessage || 'Unable to start draft.');
    };

    const handleCancel = async () => {
        setCancelling(true);
        await store.deleteLeague(leagueId);
        history.push('/home');
    };

    const handleNumberOfTeamsChange = (value) => {
        const numberOfTeams = clampInt(value, 2, 30);
        setFormState((prev) => ({
            ...prev,
            numberOfTeams,
            teams: buildTeams(numberOfTeams, prev.salaryCap, prev.rosterSlots, prev.teams)
        }));
    };

    const handleSalaryCapChange = (value) => {
        const salaryCap = clampInt(value, 1);
        setFormState((prev) => ({
            ...prev,
            salaryCap,
            teams: prev.teams.map((team) => ({
                ...team,
                budgetRemaining: salaryCap
            }))
        }));
    };

    const handleRosterSlotChange = (slot, value) => {
        const nextValue = Math.max(Number.parseInt(value, 10) || 0, 0);
        setFormState((prev) => {
            const rosterSlots = {
                ...prev.rosterSlots,
                [slot]: nextValue
            };

            return {
                ...prev,
                rosterSlots,
                teams: buildTeams(prev.numberOfTeams, prev.salaryCap, rosterSlots, prev.teams)
            };
        });
    };

    const handleTeamNameChange = (teamId, value) => {
        setFormState((prev) => ({
            ...prev,
            teams: prev.teams.map((team) => (
                team.teamId === teamId
                    ? { ...team, teamName: value }
                    : team
            ))
        }));
    };

    if (loading) {
        return <main className="page-shell">Loading draft session...</main>;
    }

    if (loadError) {
        return (
            <main className="page-shell">
                <p>{loadError}</p>
                <button className="home-light-btn" type="button" onClick={() => history.push('/home')}>
                    Back to Home
                </button>
            </main>
        );
    }

    return (
        <main className="app-home">
            <section className="home-left-column">
                <article className="home-card draft-setup-card">
                    <div>
                        <h2>Draft Settings</h2>
                        <p>Configure before opening the draft room.</p>
                    </div>

                    <div className="draft-setup-grid">
                        <label>
                            <span>Number of Teams</span>
                            <input
                                type="number"
                                min="2"
                                max="30"
                                value={formState.numberOfTeams}
                                onChange={(e) => setFormState((prev) => ({ ...prev, numberOfTeams: e.target.value }))}
                                onBlur={(e) => handleNumberOfTeamsChange(e.target.value)}
                            />
                        </label>
                        <label>
                            <span>Salary Cap</span>
                            <input
                                type="number"
                                min="1"
                                value={formState.salaryCap}
                                onChange={(e) => handleSalaryCapChange(e.target.value)}
                            />
                        </label>
                        {/* US-15.1: season year tag */}
                        <label>
                            <span>Season Year</span>
                            <input
                                type="number"
                                min="2000"
                                max={new Date().getFullYear() + 5}
                                value={formState.seasonYear}
                                onChange={(e) => {
                                    const yr = Number(e.target.value);
                                    if (yr >= 2000) setFormState((prev) => ({ ...prev, seasonYear: yr }));
                                }}
                            />
                        </label>
                        <label>
                            <span>Scoring Type</span>
                            <select
                                value={formState.scoringType}
                                onChange={(e) => setFormState((prev) => ({ ...prev, scoringType: e.target.value }))}
                                className="pill-select native"
                            >
                                {SCORING_OPTIONS.map((option) => (
                                    <option key={option}>{option}</option>
                                ))}
                            </select>
                        </label>

                        {/* US-17.1: league scope toggle */}
                        <label>
                            <span>League Scope</span>
                            <div className="draft-setup-scope-row">
                                {LEAGUE_SCOPE_OPTIONS.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`draft-setup-scope-btn ${formState.leagueScope === value ? 'active' : ''}`}
                                        onClick={() => setFormState((prev) => ({ ...prev, leagueScope: value }))}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </label>

                        {/* US-17.2: custom stat categories */}
                        <label className="draft-setup-full-width">
                            <span>Hitting Stats</span>
                            <div className="draft-setup-stat-chips">
                                {HITTING_STAT_OPTIONS.map((stat) => {
                                    const selected = formState.statCategories?.hitting?.includes(stat) ?? false;
                                    return (
                                        <button key={stat} type="button"
                                            className={`draft-setup-stat-chip ${selected ? 'active' : ''}`}
                                            onClick={() => setFormState((prev) => {
                                                const cur = prev.statCategories?.hitting || [];
                                                const next = selected ? cur.filter((s) => s !== stat) : [...cur, stat];
                                                return { ...prev, statCategories: { ...prev.statCategories, hitting: next } };
                                            })}
                                        >{stat.toUpperCase()}</button>
                                    );
                                })}
                            </div>
                        </label>
                        <label className="draft-setup-full-width">
                            <span>Pitching Stats</span>
                            <div className="draft-setup-stat-chips">
                                {PITCHING_STAT_OPTIONS.map((stat) => {
                                    const selected = formState.statCategories?.pitching?.includes(stat) ?? false;
                                    return (
                                        <button key={stat} type="button"
                                            className={`draft-setup-stat-chip ${selected ? 'active' : ''}`}
                                            onClick={() => setFormState((prev) => {
                                                const cur = prev.statCategories?.pitching || [];
                                                const next = selected ? cur.filter((s) => s !== stat) : [...cur, stat];
                                                return { ...prev, statCategories: { ...prev.statCategories, pitching: next } };
                                            })}
                                        >{stat.toUpperCase()}</button>
                                    );
                                })}
                            </div>
                        </label>

                        {/* US-17.3: custom position catalog drives the roster slot rows */}
                        <label className="draft-setup-full-width">
                            <span>Hitter Positions</span>
                            <div className="draft-setup-stat-chips">
                                {[...new Set([...DEFAULT_HITTER_CATALOG, ...(formState.positionCatalog?.hitter || [])])].map((pos) => {
                                    const inCatalog = (formState.positionCatalog?.hitter || DEFAULT_HITTER_CATALOG).includes(pos);
                                    return (
                                        <button key={pos} type="button"
                                            className={`draft-setup-stat-chip ${inCatalog ? 'active' : ''}`}
                                            onClick={() => setFormState((prev) => {
                                                const cur = prev.positionCatalog?.hitter || [...DEFAULT_HITTER_CATALOG];
                                                const next = inCatalog ? cur.filter((p) => p !== pos) : [...cur, pos];
                                                return { ...prev, positionCatalog: { ...prev.positionCatalog, hitter: next } };
                                            })}
                                        >{pos}</button>
                                    );
                                })}
                            </div>
                        </label>
                        <label>
                            <span>Draft Type</span>
                            <input type="text" value={formState.draftType} readOnly className="draft-setup-readonly" />
                        </label>
                        <div className="draft-setup-summary">
                            <span>Total Roster Size</span>
                            <strong>{totalRosterSize}</strong>
                        </div>
                    </div>

                    <section className="draft-setup-section">
                        <div className="draft-setup-section-head">
                            <h3>Roster Slots</h3>
                        </div>
                        <div className="draft-setup-slot-grid">
                            {Object.keys(DEFAULT_ROSTER_SLOTS).map((slot) => (
                                <label key={slot}>
                                    <span>{slot}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formState.rosterSlots[slot]}
                                        onChange={(e) => handleRosterSlotChange(slot, e.target.value)}
                                    />
                                </label>
                            ))}
                        </div>
                    </section>
                </article>
            </section>

            <section className="home-right-column draft-setup-right">
                <article className="home-card draft-setup-card">
                    <div className="draft-setup-section-head">
                        <h3>Fantasy Teams</h3>
                        <p>Customize team names.</p>
                    </div>
                    <div className="draft-setup-team-list">
                        {formState.teams.map((team) => (
                            <label key={team.teamId} className="draft-setup-team-row">
                                <span>{team.teamId}</span>
                                <input
                                    type="text"
                                    value={team.teamName}
                                    onChange={(e) => handleTeamNameChange(team.teamId, e.target.value)}
                                />
                                <small>Budget: ${formState.salaryCap}</small>
                            </label>
                        ))}
                    </div>
                    {formError ? <p className="league-error-msg">{formError}</p> : null}
                    <div className="role-modal-actions draft-setup-actions">
                        <button type="button" className="home-light-btn" onClick={handleCancel} disabled={saving || cancelling}>
                            {cancelling ? 'Cancelling...' : 'Cancel'}
                        </button>
                        <button type="button" className="home-dark-btn" onClick={startDraft} disabled={saving || cancelling}>
                            {saving ? 'Starting...' : 'Start Draft'}
                        </button>
                    </div>
                </article>
            </section>
        </main>
    );
}
