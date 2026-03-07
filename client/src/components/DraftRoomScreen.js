import { useHistory, useParams } from 'react-router-dom';

const DraftRoomScreen = () => {
    const history = useHistory();
    const { leagueId } = useParams();

    return (
        <main className="page-shell">
            <button className="home-light-btn" type="button" onClick={() => history.goBack()}>
             ←
            </button>
            <h1>Draft Room</h1>
            <p>League ID: {leagueId}</p>
            <p>This page is intentionally empty for now.</p>
        </main>
    );
};

export default DraftRoomScreen;
