import { useContext } from 'react'
import PlayerHomeScreen from './PlayerHomeScreen'
import SplashScreen from './SplashScreen'
import AuthContext from '../auth'

export default function HomeWrapper() {
    const { auth } = useContext(AuthContext);
    if (auth.loading) {
        return <div className="page-shell">Loading...</div>;
    }

    if (auth.loggedIn) {
        return <PlayerHomeScreen />
    }

    return <SplashScreen />;
}
