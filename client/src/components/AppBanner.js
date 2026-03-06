import { useContext } from 'react';
import { Link, useHistory } from 'react-router-dom';
import AuthContext from '../auth';

export default function AppBanner() {
    const { auth } = useContext(AuthContext);
    const history = useHistory();

    const handleLogout = async () => {
        await auth.logoutUser();
    };

    return (
        <header className="app-banner">
            <button className="link-button brand" type="button" onClick={() => history.push('/')}>
                <span className="brand-mark"></span>
                <span>DraftIQ</span>
            </button>
            <nav className="app-banner-nav">
                {auth.loggedIn ? (
                    <>
                        <span className="user-name">{auth.user?.userName || "User"}</span>
                        <button className="link-button action-link" type="button" onClick={handleLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link className="banner-cta-btn" to="/register">Get Started</Link>
                    </>
                )}
            </nav>
        </header>
    );
}
