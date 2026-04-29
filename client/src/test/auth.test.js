import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthContext, { AuthContextProvider } from '../auth';

jest.mock('../auth/requests', () => ({
    __esModule: true,
    default: {
        getLoggedIn: jest.fn(),
        loginUser: jest.fn(),
        logoutUser: jest.fn(),
        registerUser: jest.fn()
    }
}));

import authRequests from '../auth/requests';

function AuthTestConsumer() {
    const { auth } = useContext(AuthContext);
    return (
        <div>
            <span data-testid="logged-in">{String(auth.loggedIn)}</span>
            <span data-testid="user-name">{auth.user?.userName ?? ''}</span>
            <span data-testid="error">{auth.errorMessage ?? ''}</span>
            <button onClick={() => auth.loginUser('u@test.com', 'pass')}>Login</button>
            <button onClick={() => auth.logoutUser()}>Logout</button>
        </div>
    );
}

function renderAuth() {
    return render(
        <MemoryRouter>
            <AuthContextProvider>
                <AuthTestConsumer />
            </AuthContextProvider>
        </MemoryRouter>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('AuthContext', () => {
    test('getLoggedIn on mount — not logged in', async () => {
        authRequests.getLoggedIn.mockResolvedValue({
            status: 200,
            data: { loggedIn: false }
        });

        renderAuth();

        await waitFor(() => {
            expect(screen.getByTestId('logged-in').textContent).toBe('false');
        });
    });

    test('getLoggedIn on mount — already logged in (cookie present)', async () => {
        authRequests.getLoggedIn.mockResolvedValue({
            status: 200,
            data: { loggedIn: true, user: { _id: 'u1', userName: 'alice', email: 'a@a.com', avatar: 'default-avatar' } }
        });

        renderAuth();

        await waitFor(() => {
            expect(screen.getByTestId('logged-in').textContent).toBe('true');
            expect(screen.getByTestId('user-name').textContent).toBe('alice');
        });
    });

    test('loginUser success — sets loggedIn and user', async () => {
        authRequests.getLoggedIn.mockResolvedValue({ status: 200, data: { loggedIn: false } });
        authRequests.loginUser.mockResolvedValue({
            status: 200,
            data: { user: { _id: 'u1', userName: 'bob', email: 'b@b.com', avatar: 'default-avatar' } }
        });

        renderAuth();
        await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('false'));

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /login/i }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('logged-in').textContent).toBe('true');
            expect(screen.getByTestId('user-name').textContent).toBe('bob');
        });
    });

    test('loginUser failure — sets errorMessage', async () => {
        authRequests.getLoggedIn.mockResolvedValue({ status: 200, data: { loggedIn: false } });
        authRequests.loginUser.mockResolvedValue({
            status: 401,
            data: { errorMessage: 'Wrong email or password.' }
        });

        renderAuth();
        await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('false'));

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /login/i }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('error').textContent).toBe('Wrong email or password.');
            expect(screen.getByTestId('logged-in').textContent).toBe('false');
        });
    });

    test('logoutUser success — clears user and loggedIn', async () => {
        authRequests.getLoggedIn.mockResolvedValue({
            status: 200,
            data: { loggedIn: true, user: { _id: 'u1', userName: 'carol', email: 'c@c.com', avatar: 'default-avatar' } }
        });
        authRequests.logoutUser.mockResolvedValue({ status: 200, data: {} });

        renderAuth();
        await waitFor(() => expect(screen.getByTestId('logged-in').textContent).toBe('true'));

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /logout/i }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('logged-in').textContent).toBe('false');
            expect(screen.getByTestId('user-name').textContent).toBe('');
        });
    });
});
