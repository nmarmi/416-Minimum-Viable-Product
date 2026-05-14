import { useContext, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { GlobalStoreContext } from '../store';

const PlayerHomeScreen = () => {
    const history = useHistory();
    const { store } = useContext(GlobalStoreContext);

    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [leagueError, setLeagueError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const [leagueToDelete, setLeagueToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // US-15.2: year filter chip state
    const [yearFilter, setYearFilter] = useState('all');
    const [cloning, setCloning] = useState(null); // leagueId being cloned

    const loadLeagues = async () => {
        setLoadingLeagues(true);
        const res = await store.loadLeagues();
        if (res.status === 200 && res.data?.success) {
            setLeagueError('');
        } else {
            setLeagueError(res.data?.errorMessage || 'Unable to load leagues right now.');
        }
        setLoadingLeagues(false);
    };

    useEffect(() => {
        loadLeagues();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const openCreateModal = () => {
        setLeagueName('');
        setCreateError('');
        setShowCreateModal(true);
    };

    const handleCreate = async () => {
        if (!leagueName.trim()) {
            setCreateError('League name is required.');
            return;
        }

        setCreating(true);
        setCreateError('');

        const result = await store.createLeague(leagueName.trim());
        setCreating(false);

        if (!result?.data?.success) {
            setCreateError(result?.data?.errorMessage || 'Failed to create league.');
            return;
        }

        const { league, draftSession } = result.data;

        if (draftSession?.draftSessionId) {
            setShowCreateModal(false);
            history.push(`/league/${league._id}/draft/${draftSession.draftSessionId}/setup`);
            return;
        }

        setCreateError('League created but failed to initialize draft settings.');
        await loadLeagues();
    };

    const handleDeleteConfirm = async () => {
        if (!leagueToDelete) return;
        setDeleting(true);
        await store.deleteLeague(leagueToDelete._id);
        setDeleting(false);
        setLeagueToDelete(null);
    };

    // US-15.3: clone a completed league into the next year
    const handleClone = async (league) => {
        setCloning(league._id);
        const nextYear = (league.seasonYear ?? new Date().getFullYear()) + 1;
        const res = await store.cloneLeague(league._id, nextYear);
        setCloning(null);
        if (res.status === 201 && res.data?.success) {
            const { draftSession } = res.data;
            history.push(`/league/${res.data.league._id}/draft/${draftSession.draftSessionId}/setup`);
        }
    };

    // US-15.2: derive distinct years and filtered league list
    const distinctYears = useMemo(() => {
        const years = [...new Set(store.leagues.map((l) => l.seasonYear ?? new Date().getFullYear()))].sort((a, b) => b - a);
        return years;
    }, [store.leagues]);

    const filteredLeagues = useMemo(() => {
        if (yearFilter === 'all') return store.leagues;
        return store.leagues.filter((l) => (l.seasonYear ?? new Date().getFullYear()) === Number(yearFilter));
    }, [store.leagues, yearFilter]);

    // Group filtered leagues by year for section headers
    const groupedLeagues = useMemo(() => {
        const groups = {};
        filteredLeagues.forEach((l) => {
            const yr = l.seasonYear ?? new Date().getFullYear();
            if (!groups[yr]) groups[yr] = [];
            groups[yr].push(l);
        });
        // Sort years descending
        return Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
    }, [filteredLeagues]);

    return (
        <main className="app-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>Create League</h2>
                    <p>Create a new league. You will be taken to the draft settings screen to configure teams, budget, and roster slots.</p>
                    <button className="home-dark-btn" type="button" onClick={openCreateModal}>
                        Create League
                    </button>
                </article>
            </section>

            <section className="home-right-column">
                <h2 className="home-leagues-title">My Leagues</h2>

                {loadingLeagues ? (
                    <article className="home-card home-empty-leagues">
                        <p>Loading leagues...</p>
                    </article>
                ) : null}

                {!loadingLeagues && leagueError ? (
                    <article className="home-card home-empty-leagues">
                        <p>{leagueError}</p>
                    </article>
                ) : null}

                {!loadingLeagues && !leagueError && store.leagues.length === 0 ? (
                    <article className="home-card home-empty-leagues">
                        <h3>No leagues yet</h3>
                        <p>Create a league to get started.</p>
                    </article>
                ) : null}

                {/* US-15.2: year filter chip row */}
                {!loadingLeagues && !leagueError && store.leagues.length > 0 && distinctYears.length > 1 ? (
                    <div className="home-year-filter-row">
                        <button
                            type="button"
                            className={`home-year-chip ${yearFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setYearFilter('all')}
                        >
                            All years
                        </button>
                        {distinctYears.map((yr) => (
                            <button
                                key={yr}
                                type="button"
                                className={`home-year-chip ${yearFilter === String(yr) ? 'active' : ''}`}
                                onClick={() => setYearFilter(String(yr))}
                            >
                                {yr}
                            </button>
                        ))}
                    </div>
                ) : null}

                {/* US-15.2: leagues grouped by year with section headers */}
                {!loadingLeagues && !leagueError && filteredLeagues.length === 0 && store.leagues.length > 0 ? (
                    <article className="home-card home-empty-leagues">
                        <h3>No drafts in {yearFilter} yet</h3>
                        <p>Switch to "All years" or create a new league for this year.</p>
                    </article>
                ) : null}

                {!loadingLeagues && !leagueError && groupedLeagues.length > 0 ? (
                    <div className="league-stack">
                        {groupedLeagues.map(([yr, yrLeagues]) => (
                            <div key={yr}>
                                {/* Section header shown when "All years" is selected and there are multiple years */}
                                {yearFilter === 'all' && distinctYears.length > 1 ? (
                                    <h3 className="home-year-section-header">{yr}</h3>
                                ) : null}
                                {yrLeagues.map((league) => (
                                    <article className="home-card league-list-card" key={league._id}>
                                        <div className="league-card-header">
                                            <h3>{league.name}</h3>
                                        </div>
                                        <div className="league-card-actions">
                                            <button
                                                className="home-dark-btn"
                                                type="button"
                                                onClick={() => history.push(`/league/${league._id}/draft-room/${league.draftSessionId}`)}
                                            >
                                                Enter Draft Room
                                            </button>
                                            <button
                                                className="home-light-btn"
                                                type="button"
                                                onClick={() => history.push(`/league/${league._id}/draft/${league.draftSessionId}/setup`)}
                                            >
                                                Draft Settings
                                            </button>
                                            {/* US-15.3: clone to next year when this draft is completed */}
                                            {league.draftStatus === 'completed' ? (
                                                <button
                                                    className="home-light-btn"
                                                    type="button"
                                                    disabled={cloning === league._id}
                                                    onClick={() => handleClone(league)}
                                                >
                                                    {cloning === league._id ? 'Cloning...' : `Use Last Year →`}
                                                </button>
                                            ) : null}
                                            <button
                                                className="home-danger-btn"
                                                type="button"
                                                onClick={() => setLeagueToDelete(league)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : null}
            </section>

            {showCreateModal ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card league-modal-card">
                        <h3>Create League</h3>
                        <p>Give your league a name. You will be taken to draft settings next.</p>
                        <div className="league-modal-grid">
                            <label>
                                <span>League Name</span>
                                <input
                                    type="text"
                                    value={leagueName}
                                    onChange={(e) => setLeagueName(e.target.value)}
                                    placeholder="e.g. Friday Night Roto"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                            </label>
                        </div>
                        {createError ? <p className="league-error-msg">{createError}</p> : null}
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => setShowCreateModal(false)} disabled={creating}>Cancel</button>
                            <button type="button" className="home-dark-btn" onClick={handleCreate} disabled={creating}>
                                {creating ? 'Creating...' : 'Create League'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {leagueToDelete ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card league-modal-card">
                        <h3>Delete League</h3>
                        <p>Delete <strong>{leagueToDelete.name}</strong>? This will permanently remove the league and all draft data.</p>
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => setLeagueToDelete(null)} disabled={deleting}>Cancel</button>
                            <button type="button" className="home-danger-btn" onClick={handleDeleteConfirm} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
};

export default PlayerHomeScreen;
