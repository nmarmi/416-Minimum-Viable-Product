import { useContext } from 'react'
import CommissionerHomeScreen from './CommissionerHomeScreen'
import PlayerHomeScreen from './PlayerHomeScreen'
import SplashScreen from './SplashScreen'
import AuthContext from '../auth'

export default function HomeWrapper() {
    const { auth } = useContext(AuthContext);
    if (auth.loading) {
        return <div className="page-shell">Loading...</div>;
    }

    if (auth.loggedIn) {
        if (auth.role === "commissioner") {
            return <CommissionerHomeScreen />
        }
        return <PlayerHomeScreen />
    }

    return <SplashScreen />;
}
