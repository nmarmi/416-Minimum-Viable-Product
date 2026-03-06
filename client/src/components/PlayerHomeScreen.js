import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';

const PlayerHomeScreen = () => {
    return (
        <main className="app-home">
            <section className="home-left-column">
                <article className="home-card">
                    <h2>Join Draft</h2>
                    <p>Enter an invite code to join a draft room</p>
                    <label htmlFor="inviteCode">Invite Code</label>
                    <input id="inviteCode" name="inviteCode" type="text" className="home-input" />
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

            <section className="home-right-column">
                <h2 className="home-leagues-title">My Leagues</h2>
                <article className="home-card home-empty-leagues">
                    <h3>No leagues yet</h3>
                    <p>You have not joined or created any leagues yet.</p>
                </article>
            </section>
        </main>
    );
};

export default PlayerHomeScreen;
