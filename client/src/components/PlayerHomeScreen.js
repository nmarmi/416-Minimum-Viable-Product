import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import leaguesRequestSender from '../leagues/requests';
import draftSessionsRequestSender from '../draft-sessions/requests';

const PlayerHomeScreen = () => {
    const history = useHistory();

    const [leagues, setLeagues] = useState([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [leagueError, setLeagueError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const loadLeagues = useCallback(async () => {
        setLoadingLeagues(true);
        const res = await leaguesRequestSender.getMyLeagues();
        if (res.status === 200 && res.data?.success) {
            setLeagues(res.data.leagues || []);
            setLeagueError('');
        } else {
            setLeagueError(res.data?.errorMessage || 'Unable to load leagues right now.');
        }
        setLoadingLeagues(false);
    }, []);

    useEffect(() => {
        loadLeagues();
    }, [loadLeagues]);

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

        const leagueRes = await leaguesRequestSender.createLeague({ name: leagueName.trim() });
        if (leagueRes.status !== 201 || !leagueRes.data?.success) {
            setCreateError(leagueRes.data?.errorMessage || 'Failed to create league.');
            setCreating(false);
            return;
        }

        const league = leagueRes.data.league;
        const sessionRes = await draftSessionsRequestSender.createDraftSession({ leagueId: league._id });
        setCreating(false);

        if ((sessionRes.status === 201 || sessionRes.status === 200) && sessionRes.data?.success) {
            setShowCreateModal(false);
            const draftSessionId = sessionRes.data.draftSession.draftSessionId;
            history.push(`/league/${league._id}/draft/${draftSessionId}/setup`);
            return;
        }

        setCreateError(sessionRes.data?.errorMessage || 'League created but failed to initialize draft settings.');
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

                {!loadingLeagues && !leagueError && leagues.length === 0 ? (
                    <article className="home-card home-empty-leagues">
                        <h3>No leagues yet</h3>
                        <p>Create a league to get started.</p>
                    </article>
                ) : null}

                {!loadingLeagues && !leagueError && leagues.length > 0 ? (
                    <div className="league-stack">
                        {leagues.map((league) => (
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
