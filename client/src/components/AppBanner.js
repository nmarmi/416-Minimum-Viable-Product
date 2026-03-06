import { useContext } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import AuthContext from '../auth';

export default function AppBanner() {
    const { auth } = useContext(AuthContext);
    const history = useHistory();
    const location = useLocation();
    const inAuthRoute = (
        location.pathname === '/login' ||
        location.pathname === '/register' ||
        location.pathname === '/forgot-password'
    );

    const handleLogout = async () => {
        await auth.logoutUser();
    };

    return (
        <header className="app-banner">
            <button className="link-button brand" type="button" onClick={() => history.push('/')}>
                <span className="brand-mark">⌘</span>
                <span>DraftIQ</span>
            </button>
            <nav className="app-banner-nav">
                {auth.loggedIn ? (
                    <>
                        <span className="player-pill">Player</span>
                        <span className="avatar-pill" aria-label="profile">
                            <PersonOutlineRoundedIcon sx={{ fontSize: 30 }} />
                        </span>
                        <button className="link-button logout-icon-btn" type="button" onClick={handleLogout} aria-label="logout">
                            <LogoutRoundedIcon sx={{ fontSize: 24 }} />
                        </button>
                        
                    </>
                ) : (
                    <>
                        {inAuthRoute ? (
                            <>
                                <Link className="banner-auth-btn active-light" to="/login">
                                    Sign in
                                </Link>
                                <Link className="banner-auth-btn active-dark" to="/register">
                                    Register
                                </Link>
                            </>
                        ) : (
                            <Link className="banner-cta-btn" to="/register">Get Started</Link>
                        )}
                    </>
                )}
            </nav>
        </header>
    );
}
