import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import leaguesRequestSender from '../leagues/requests';
import draftSessionsRequestSender from '../draft-sessions/requests';

const PlayerHomeScreen = () => {
    const history = useHistory();

    const [leagues, setLeagues] = useState([]);
    const [draftSessionsByLeague, setDraftSessionsByLeague] = useState({});
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [leagueError, setLeagueError] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const [showDraftModal, setShowDraftModal] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState(null);
    const [draftSessionName, setDraftSessionName] = useState('');
    const [creatingDraft, setCreatingDraft] = useState(false);
    const [draftCreateError, setDraftCreateError] = useState('');

    const loadDraftSessions = useCallback(async (leagueList) => {
        const entries = await Promise.all(
            leagueList.map(async (league) => {
                const res = await draftSessionsRequestSender.getLatestDraftSessionForLeague(league._id);
                if (res.status === 200 && res.data?.success) {
                    return [league._id, res.data.draftSession];
                }
                return [league._id, null];
            })
        );

        setDraftSessionsByLeague(Object.fromEntries(entries));
    }, []);

    const loadLeagues = useCallback(async () => {
        setLoadingLeagues(true);
        const res = await leaguesRequestSender.getMyLeagues();
        if (res.status === 200 && res.data?.success) {
            const leagueList = res.data.leagues || [];
            setLeagues(leagueList);
            setLeagueError('');
            await loadDraftSessions(leagueList);
        } else {
            setLeagueError(res.data?.errorMessage || 'Unable to load leagues right now.');
        }
        setLoadingLeagues(false);
    }, [loadDraftSessions]);

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
        const res = await leaguesRequestSender.createLeague({
            name: leagueName.trim()
        });
        setCreating(false);
        if (res.status !== 201 || !res.data?.success) {
            setCreateError(res.data?.errorMessage || 'Failed to create league.');
            return;
        }
        setShowCreateModal(false);
        await loadLeagues();
    };

    const openCreateDraftModal = (league) => {
        setSelectedLeague(league);
        setDraftSessionName(`${league.name} Auction`);
        setDraftCreateError('');
        setShowDraftModal(true);
    };

    const handleCreateDraftSession = async () => {
        if (!selectedLeague) {
            setDraftCreateError('Select a league first.');
            return;
        }
        if (!draftSessionName.trim()) {
            setDraftCreateError('Draft session name is required.');
            return;
        }

        setCreatingDraft(true);
        setDraftCreateError('');
        const res = await draftSessionsRequestSender.createDraftSession({
            leagueId: selectedLeague._id,
            name: draftSessionName.trim()
        });
        setCreatingDraft(false);

        if (res.status !== 201 || !res.data?.success) {
            setDraftCreateError(res.data?.errorMessage || 'Unable to create draft session.');
            return;
        }

        setShowDraftModal(false);
        await loadLeagues();
        history.push(`/league/${selectedLeague._id}/draft/${res.data.draftSession.draftSessionId}/setup`);
    };

    return (
        <main className="app-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>Create League</h2>
                    <p>Create the league first, then set teams, salary cap, and roster slots when you create the draft.</p>
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
                        {leagues.map((league) => {
                            const draftSession = draftSessionsByLeague[league._id];

                            return (
                                <article className="home-card league-list-card" key={league._id}>
                                    <div className="league-card-header">
                                        <h3>{league.name}</h3>
                                    </div>
                                    <p className="league-subtitle">
                                        League workspace
                                    </p>
                                    {draftSession ? (
                                        <p className="hint">
                                            Latest draft: <strong>{draftSession.name}</strong> ({draftSession.status})
                                        </p>
                                    ) : (
                                        <p className="hint">No draft session yet. Create one to configure teams, budget, and roster slots.</p>
                                    )}
                                    <div className="league-card-actions">
                                        {draftSession ? (
                                            <button
                                                className="home-dark-btn"
                                                type="button"
                                                onClick={() => history.push(
                                                    draftSession.status === 'active'
                                                        ? `/league/${league._id}/draft-room/${draftSession.draftSessionId}`
                                                        : `/league/${league._id}/draft/${draftSession.draftSessionId}/setup`
                                                )}
                                            >
                                                {draftSession.status === 'active' ? 'Open Draft' : 'Continue Draft Setup'}
                                            </button>
                                        ) : (
                                            <button
                                                className="home-dark-btn"
                                                type="button"
                                                onClick={() => openCreateDraftModal(league)}
                                            >
                                                Create Draft Setup
                                            </button>
                                        )}
                                        {draftSession ? (
                                            <button
                                                className="home-light-btn"
                                                type="button"
                                                onClick={() => openCreateDraftModal(league)}
                                            >
                                                New Draft Session
                                            </button>
                                        ) : null}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : null}
            </section>

            {showCreateModal ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card league-modal-card">
                        <h3>Create League</h3>
                        <p>Create the league shell first. Draft settings are configured in the draft setup step.</p>
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

            {showDraftModal ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card league-modal-card">
                        <h3>Create Draft Setup</h3>
                        <p>{selectedLeague ? `Create the draft configuration for ${selectedLeague.name}.` : 'Choose a draft name.'}</p>
                        <div className="league-modal-grid">
                            <label>
                                <span>Draft Session Name</span>
                                <input
                                    type="text"
                                    value={draftSessionName}
                                    onChange={(e) => setDraftSessionName(e.target.value)}
                                    placeholder="e.g. Friday Night Auction"
                                    autoFocus
                                />
                            </label>
                        </div>
                        {draftCreateError ? <p className="league-error-msg">{draftCreateError}</p> : null}
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => setShowDraftModal(false)}>Cancel</button>
                            <button type="button" className="home-dark-btn" onClick={handleCreateDraftSession} disabled={creatingDraft}>
                                {creatingDraft ? 'Creating...' : 'Create Draft'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
};

export default PlayerHomeScreen;
