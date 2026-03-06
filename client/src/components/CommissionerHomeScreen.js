import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import leaguesRequestSender from '../leagues/requests';

const CommissionerHomeScreen = () => {
    const history = useHistory();

    const [showCreateLeagueModal, setShowCreateLeagueModal] = useState(false);
    const [leagueName, setLeagueName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [seasonYear, setSeasonYear] = useState('2026');
    const [numTeams, setNumTeams] = useState(12);
    const [draftType, setDraftType] = useState('Auction');
    const [leagueMode, setLeagueMode] = useState('Redraft');
    const [creatingLeague, setCreatingLeague] = useState(false);

    const [leagues, setLeagues] = useState([]);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [leagueError, setLeagueError] = useState('');

    const loadLeagues = async () => {
        setLoadingLeagues(true);
        setLeagueError('');

        const res = await leaguesRequestSender.getMyLeagues();
        if (res.status === 200 && res.data?.success) {
            setLeagues(res.data.leagues || []);
        } else {
            setLeagueError(res.data?.errorMessage || 'Unable to load leagues right now.');
        }

        setLoadingLeagues(false);
    };

    useEffect(() => {
        loadLeagues();
    }, []);

    const generateInviteCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        setInviteCode(code);
    };

    const createLeague = async () => {
        if (!leagueName.trim()) {
            setLeagueError('League name is required.');
            return;
        }

        setCreatingLeague(true);
        setLeagueError('');

        const payload = {
            name: leagueName.trim(),
            inviteCode: inviteCode.trim() || undefined,
            seasonYear,
            numberOfTeams: numTeams,
            draftType,
            leagueMode
        };

        const res = await leaguesRequestSender.createLeague(payload);
        setCreatingLeague(false);

        if (res.status !== 201 || !res.data?.success) {
            setLeagueError(res.data?.errorMessage || 'Create league failed.');
            return;
        }

        setLeagueName('');
        setInviteCode('');
        setShowCreateLeagueModal(false);
        await loadLeagues();
    };

    return (
        <main className="app-home commissioner-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>My Leagues</h2>
                    <p>Create your first league to begin commissioner management.</p>
                    <button className="home-dark-btn" type="button" onClick={() => setShowCreateLeagueModal(true)}>
                        Create League
                    </button>
                </article>

                <article className="home-card">
                    <h2>Join Draft</h2>
                    <p>Enter an invite code to join a draft room</p>
                    <label htmlFor="commissionerInviteCode">Invite Code</label>
                    <input id="commissionerInviteCode" name="commissionerInviteCode" type="text" className="home-input" />
                    <button className="home-dark-btn" type="button">
                        <PlayCircleOutlineOutlinedIcon sx={{ fontSize: 18 }} />
                        <span>Join Draft Room</span>
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

            <section className="home-right-column commissioner-sections">
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
                        <p>Create or join a league to start managing settings and members.</p>
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
                                    onClick={() => history.push(`/commissioner-home/league/${league._id}`)}
                                >
                                    Open League Workspace
                                </button>
                            </article>
                        ))}
                    </div>
                ) : null}
            </section>

            {showCreateLeagueModal ? (
                <div className="role-modal-overlay">
                    <div className="role-modal-card league-modal-card">
                        <h3>Create League</h3>
                        <p>Set league basics before inviting managers.</p>
                        <div className="league-modal-grid">
                            <label>
                                <span>League Name</span>
                                <input type="text" value={leagueName} onChange={(e) => setLeagueName(e.target.value)} />
                            </label>
                            <label>
                                <span>Invite Code</span>
                                <div className="inline-field-row modal-invite-row">
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                        placeholder="Optional (auto-generated if blank)"
                                    />
                                    <button type="button" className="home-light-btn compact-btn" onClick={generateInviteCode}>
                                        Generate
                                    </button>
                                </div>
                            </label>
                            <label>
                                <span>Season Year</span>
                                <div className="input-with-icon modal-field">
                                    <input type="text" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} className="home-input compact" />
                                    <CalendarMonthOutlinedIcon sx={{ fontSize: 18 }} />
                                </div>
                            </label>
                            <label>
                                <span>Number of Teams</span>
                                <div className="team-count-row modal-count-row">
                                    <input
                                        type="text"
                                        className="home-input compact"
                                        value={numTeams}
                                        onChange={(e) => setNumTeams(Number(e.target.value || 0))}
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
                        <div className="role-modal-actions">
                            <button type="button" className="home-light-btn" onClick={() => setShowCreateLeagueModal(false)}>Cancel</button>
                            <button type="button" className="home-dark-btn" onClick={createLeague} disabled={creatingLeague}>
                                {creatingLeague ? 'Creating...' : 'Create League'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </main>
    );
};

export default CommissionerHomeScreen;
