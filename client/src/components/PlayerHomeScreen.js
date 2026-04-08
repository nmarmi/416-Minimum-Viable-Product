import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import leaguesRequestSender from '../leagues/requests';

const PlayerHomeScreen = () => {
    const history = useHistory();

    const [leagues, setLeagues] = useState([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [leagueError, setLeagueError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [numTeams, setNumTeams] = useState(12);
    const [draftType, setDraftType] = useState('Auction');
    const [leagueMode, setLeagueMode] = useState('Redraft');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const loadLeagues = async () => {
        setLoadingLeagues(true);
        const res = await leaguesRequestSender.getMyLeagues();
        if (res.status === 200 && res.data?.success) {
            setLeagues(res.data.leagues || []);
            setLeagueError('');
        } else {
            setLeagueError(res.data?.errorMessage || 'Unable to load leagues right now.');
        }
        setLoadingLeagues(false);
    };

    useEffect(() => {
        loadLeagues();
    }, []);

    const openCreateModal = () => {
        setLeagueName('');
        setNumTeams(12);
        setDraftType('Auction');
        setLeagueMode('Redraft');
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
        const res = await leaguesRequestSender.createLeague({
            name: leagueName.trim(),
            numberOfTeams: numTeams,
            draftType,
            leagueMode
        });
        setCreating(false);
        if (res.status !== 201 || !res.data?.success) {
            setCreateError(res.data?.errorMessage || 'Failed to create league.');
            return;
        }
        setShowCreateModal(false);
        await loadLeagues();
    };

    return (
        <main className="app-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>New League</h2>
                    <p>Create a league to start tracking your auction draft.</p>
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
                                <p className="league-subtitle">
                                    {league.numberOfTeams || 12} teams &bull; {league.draftType || 'Auction'} &bull; {league.leagueMode || 'Redraft'}
                                </p>
                                <div className="league-card-actions">
                                    <button
                                        className="home-dark-btn"
                                        type="button"
                                        onClick={() => history.push(`/league/${league._id}/draft-room`)}
                                    >
                                        Open Draft Room
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
                        <p>Configure your league settings.</p>
                        <div className="league-modal-grid">
                            <label>
                                <span>League Name</span>
                                <input
                                    type="text"
                                    value={leagueName}
                                    onChange={(e) => setLeagueName(e.target.value)}
                                    placeholder="e.g. Friday Night Roto"
                                    autoFocus
                                />
                            </label>
                            <label>
                                <span>Number of Teams</span>
                                <div className="team-count-row modal-count-row">
                                    <input
                                        type="text"
                                        className="home-input compact"
                                        value={numTeams}
                                        onChange={(e) => setNumTeams(Math.max(2, Number(e.target.value || 2)))}
                                    />
                                    <button type="button" className="count-btn" onClick={() => setNumTeams((n) => Math.max(2, n - 1))}>-</button>
                                    <button type="button" className="count-btn" onClick={() => setNumTeams((n) => n + 1)}>+</button>
                                </div>
                            </label>
                            <label>
                                <span>Draft Type</span>
                                <select value={draftType} onChange={(e) => setDraftType(e.target.value)} className="pill-select native">
                                    <option>Auction</option>
                                    <option>Snake</option>
                                </select>
                            </label>
                            <label>
                                <span>League Mode</span>
                                <select value={leagueMode} onChange={(e) => setLeagueMode(e.target.value)} className="pill-select native">
                                    <option>Redraft</option>
                                    <option>Keeper</option>
                                </select>
                            </label>
                        </div>
                        {createError ? <p className="league-error-msg">{createError}</p> : null}
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
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
