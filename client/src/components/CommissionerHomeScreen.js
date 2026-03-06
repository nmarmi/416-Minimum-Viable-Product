import { useEffect, useState } from 'react';
import leaguesRequestSender from '../leagues/requests';

const CommissionerHomeScreen = () => {
    const [inviteCode, setInviteCode] = useState('');
    const [leagueName, setLeagueName] = useState('');
    const [seasonYear, setSeasonYear] = useState('');
    const [numberOfTeams, setNumberOfTeams] = useState(12);
    const [draftType, setDraftType] = useState('Auction Draft');
    const [leagueMode, setLeagueMode] = useState('Join Draft');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [leagues, setLeagues] = useState([]);

    const loadLeagues = async () => {
        const res = await leaguesRequestSender.getMyLeagues();
        if (res.status === 200 && res.data.success) {
            setLeagues(res.data.leagues || []);
        }
    };

    useEffect(() => {
        loadLeagues();
    }, []);

    const handleJoinDraft = (e) => {
        e.preventDefault();

        if (!inviteCode.trim()) {
            setError('Please enter an invite code.');
            setSuccessMessage('');
            return;
        }

        setError('');
        setSuccessMessage(`Invite code "${inviteCode}" submitted.`);
        setInviteCode('');
    };

    const handleDecreaseTeams = () => {
        setNumberOfTeams((prev) => Math.max(2, prev - 1));
    };

    const handleIncreaseTeams = () => {
        setNumberOfTeams((prev) => Math.min(30, prev + 1));
    };

    const handleCreateLeague = async (e) => {
        e.preventDefault();

        console.log("CREATE LEAGUE CLICKED");
    console.log({
        leagueName,
        seasonYear,
        numberOfTeams,
        draftType,
        leagueMode
    });

        if (!leagueName.trim()) {
            setError('League name is required.');
            setSuccessMessage('');
            return;
        }

        if (!seasonYear) {
            setError('Season year is required.');
            setSuccessMessage('');
            return;
        }

        if (!numberOfTeams || numberOfTeams < 2) {
            setError('Number of teams must be at least 2.');
            setSuccessMessage('');
            return;
        }

        setCreating(true);
        setError('');
        setSuccessMessage('');

        const payload = {
            name: leagueName.trim(),
            seasonYear,
            numberOfTeams,
            draftType,
            leagueMode
        };

        const res = await leaguesRequestSender.createLeague(payload);

        setCreating(false);

        if (res.status === 201 && res.data.success) {
            setLeagueName('');
            setSeasonYear('');
            setNumberOfTeams(12);
            setDraftType('Auction Draft');
            setLeagueMode('Join Draft');
            setSuccessMessage('League created successfully.');
            await loadLeagues();
            return;
        }

        setError(res.data.errorMessage || 'Unable to create league.');
    };

    return (
        <main className="commissioner-page">
            <section className="commissioner-left">
                <article className="commissioner-card">
                    <h2 className="card-title">Join Draft</h2>
                    <p className="card-subtitle">Enter an invite code to join a draft room</p>

                    <form onSubmit={handleJoinDraft}>
                        <label htmlFor="inviteCode" className="form-label">Invite Code</label>
                        <input
                            id="inviteCode"
                            name="inviteCode"
                            type="text"
                            className="form-input"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder=""
                        />

                        <button type="submit" className="dark-button full-width">
                            Join Draft Room
                        </button>
                    </form>
                </article>

                <article className="commissioner-card">
                    <h2 className="card-title">Create League</h2>

                    <form onSubmit={handleCreateLeague}>
                        <label htmlFor="leagueName" className="form-label">League Name</label>
                        <input
                            id="leagueName"
                            name="leagueName"
                            type="text"
                            className="form-input"
                            value={leagueName}
                            onChange={(e) => setLeagueName(e.target.value)}
                        />

                        <label htmlFor="seasonYear" className="form-label">Season Year</label>
                        <input
                            id="seasonYear"
                            name="seasonYear"
                            type="number"
                            className="form-input season-input"
                            value={seasonYear}
                            onChange={(e) => setSeasonYear(e.target.value)}
                            placeholder="2026"
                            min="2024"
                            max="2100"
                        />

                        <label htmlFor="numberOfTeams" className="form-label">Number of Teams</label>
                        <div className="team-count-row">
                            <input
                                id="numberOfTeams"
                                name="numberOfTeams"
                                type="number"
                                className="form-input teams-input"
                                value={numberOfTeams}
                                onChange={(e) => setNumberOfTeams(Number(e.target.value))}
                                min="2"
                                max="30"
                            />
                            <div className="team-stepper">
                                <button type="button" className="stepper-btn" onClick={handleDecreaseTeams}>
                                    −
                                </button>
                                <button type="button" className="stepper-btn" onClick={handleIncreaseTeams}>
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="double-select-row">
                            <div className="select-group">
                                <label htmlFor="draftType" className="form-label centered-label">Draft Type</label>
                                <select
                                    id="draftType"
                                    name="draftType"
                                    className="form-select"
                                    value={draftType}
                                    onChange={(e) => setDraftType(e.target.value)}
                                >
                                    <option value="Auction Draft">Auction Draft</option>
                                    <option value="Snake Draft">Snake Draft</option>
                                </select>
                            </div>

                            <div className="select-group">
                                <label htmlFor="leagueMode" className="form-label centered-label">League Mode</label>
                                <select
                                    id="leagueMode"
                                    name="leagueMode"
                                    className="form-select"
                                    value={leagueMode}
                                    onChange={(e) => setLeagueMode(e.target.value)}
                                >
                                    <option value="Join Draft">Join Draft</option>
                                    <option value="Mock Draft">Mock Draft</option>
                                    <option value="Private League">Private League</option>
                                </select>
                            </div>
                        </div>

                        <button type="submit" className="dark-button full-width" disabled={creating}>
                            {creating ? 'Creating...' : 'Create League'}
                        </button>
                    </form>

                    {error ? <p className="form-message error-message">{error}</p> : null}
                    {successMessage ? <p className="form-message success-message">{successMessage}</p> : null}
                </article>

                <article className="commissioner-card">
                    <h2 className="card-title">My Team</h2>
                    <p className="team-subtitle">Create or customize your team</p>
                    <button type="button" className="light-button full-width">
                        Setup Team
                    </button>
                </article>
            </section>

            <section className="commissioner-right">
    <h2 className="league-section-title">My Leagues</h2>

    <div className="league-scroll-area">
        {leagues.length === 0 ? (
            <article className="league-display-card">
                <h3 className="league-display-name">No leagues yet</h3>
                <p className="league-display-details">Create your first league from the left panel.</p>
            </article>
        ) : (
            leagues.map((league) => (
                <article key={league._id} className="league-display-card">
                    <div className="league-display-top">
                        <div>
                            <h3 className="league-display-name">{league.name}</h3>
                            <p className="league-display-subline">
                                {league.numberOfTeams || 12} Join Draft • {league.draftType || 'Auction Draft'}
                            </p>
                        </div>
                        <span className={`league-status ${league.isActive ? 'active' : 'inactive'}`}>
                            {league.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>

                    <div className="league-display-meta">
                        <p>{league.currentTeams || 0}/{league.numberOfTeams || 12} teams joined</p>
                        <p>Season: {league.seasonYear || 'N/A'}</p>
                        <p>Invite Code: {league.inviteCode}</p>
                    </div>

                    <button type="button" className="dark-button full-width">
                        Join Draft Room
                    </button>
                </article>
            ))
        )}
    </div>
</section>
        </main>
    );
};

export default CommissionerHomeScreen;