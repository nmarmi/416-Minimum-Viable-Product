import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import leaguesRequestSender from '../leagues/requests';

const PlayerHomeScreen = () => {
    const history = useHistory();
    const [inviteCode, setInviteCode] = useState('');
    const [joiningDraft, setJoiningDraft] = useState(false);
    const [leagueError, setLeagueError] = useState('');
    const [leagues, setLeagues] = useState([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);

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

    const joinDraftByCode = async () => {
        if (!inviteCode.trim()) {
            setLeagueError('Invite code is required.');
            return;
        }

        setJoiningDraft(true);
        setLeagueError('');
        const res = await leaguesRequestSender.joinLeague(inviteCode.trim().toUpperCase());
        setJoiningDraft(false);

        if (res.status !== 200 || !res.data?.success) {
            setLeagueError(res.data?.errorMessage || 'Unable to join league.');
            return;
        }

        setInviteCode('');
        await loadLeagues();
    };

    return (
        <main className="app-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>Join Draft</h2>
                    <p>Enter an invite code to join a draft room</p>
                    <label htmlFor="inviteCode">Invite Code</label>
                    <input
                        id="inviteCode"
                        name="inviteCode"
                        type="text"
                        className="home-input"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    />
                    <button className="home-dark-btn" type="button" onClick={joinDraftByCode} disabled={joiningDraft}>
                        <PlayCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                        <span>{joiningDraft ? 'Joining...' : 'Join Draft Room'}</span>
                    </button>
                </article>

                <article className="home-card">
                    <h3 className="home-team-title">
                        <EmojiEventsOutlinedIcon sx={{ fontSize: 24 }} />
                        <span>My Team</span>
                    </h3>
                    <p className="home-team-copy">Create or customize your team</p>
                    <button className="home-light-btn" type="button">Setup Team</button>
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
                        <p>You have not joined or created any leagues yet.</p>
                    </article>
                ) : null}

                {!loadingLeagues && !leagueError && leagues.length > 0 ? (
                    <div className="league-stack">
                        {leagues.map((league) => (
                            <article className="home-card league-list-card" key={league._id}>
                                <div className="league-card-header">
                                    <h3>{league.name}</h3>
                                    <span className={`league-status ${league.isActive ? 'active' : 'inactive'}`}>
                                        {league.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="league-subtitle">
                                    {league.numberOfTeams || 12} teams • {league.draftType || 'Auction'} • {league.leagueMode || 'Redraft'}
                                </p>
                                <p className="hint">Invite Code: <strong>{league.inviteCode}</strong></p>
                                <button
                                    className="home-dark-btn"
                                    type="button"
                                    onClick={() => history.push(`/league/${league._id}/draft-room`)}
                                >
                                    Join Draft Room
                                </button>
                            </article>
                        ))}
                    </div>
                ) : null}
            </section>
        </main>
    );
};

export default PlayerHomeScreen;
