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
            <button
                className="link-button brand"
                type="button"
                onClick={() => history.push('/')}
            >
                Auth Skeleton
            </button>
            <nav className="app-banner-nav">
                {auth.loggedIn ? (
                    <>
                        <span className="user-name">{auth.user?.userName || "User"}</span>
                        <button className="link-button" type="button" onClick={handleLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <Link className="link-button" to="/login">Login</Link>
                        <Link className="link-button" to="/register">Sign Up</Link>
                    </>
                )}
            </nav>
        </header>
    );
}
