import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';

const PlayerHomeScreen = () => {
    return (
        <main className="app-home">
            <section className="home-left-column">
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
                <h2 className="home-leagues-title">My Draft Sessions</h2>

                <article className="home-card home-empty-leagues">
                    <h3>No draft sessions yet</h3>
                    <p>Create a new draft session to get started.</p>
                </article>
            </section>
        </main>
    );
};

export default PlayerHomeScreen;
