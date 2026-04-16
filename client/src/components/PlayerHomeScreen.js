import { useContext, useEffect, useState } from 'react';
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

                {!loadingLeagues && !leagueError && store.leagues.length > 0 ? (
                    <div className="league-stack">
                        {store.leagues.map((league) => (
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
                                </div>
                            </article>
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
        </main>
    );
};

export default PlayerHomeScreen;
