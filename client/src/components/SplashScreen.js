import { useHistory } from 'react-router-dom';

export default function SplashScreen() {
    const history = useHistory();

    return (
        <div className="page-shell">
            <h1>Welcome</h1>
            <p>Sign in or create an account to continue.</p>
            <div className="actions-row">
                <button className="primary-btn" type="button" onClick={() => history.push('/login')}>
                    Login
                </button>
                <button className="secondary-btn" type="button" onClick={() => history.push('/register')}>
                    Sign Up
                </button>
            </div>
        </div>
    );
}
