import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../auth';
import GlobalStoreContextProvider, { GlobalStoreContext } from '../store';

jest.mock('../leagues/requests', () => ({
    __esModule: true,
    default: {
        getMyLeagues: jest.fn(),
        createLeague: jest.fn(),
        deleteLeague: jest.fn()
    }
}));

jest.mock('../draft-sessions/requests', () => ({
    __esModule: true,
    default: {
        createDraftSession: jest.fn(),
        getDraftSession: jest.fn(),
        updateDraftSession: jest.fn()
    },
    recordPurchase: jest.fn()
}));

import leagueRequests from '../leagues/requests';
import draftRequests from '../draft-sessions/requests';

// Provide a static auth context value to avoid a real AuthContextProvider's useEffect
const mockAuth = { user: null, loggedIn: false, loading: false, errorMessage: null };

function StoreTestConsumer({ onMount }) {
    const { store } = useContext(GlobalStoreContext);
    React.useEffect(() => { if (onMount) onMount(store); }, []); // eslint-disable-line
    return (
        <div>
            <span data-testid="league-count">{store.leagues.length}</span>
            <button onClick={() => store.loadLeagues()}>Load Leagues</button>
            <button onClick={() => store.deleteLeague('l1')}>Delete l1</button>
        </div>
    );
}

function renderStore(consumerProps = {}) {
    return render(
        <MemoryRouter>
            <AuthContext.Provider value={{ auth: mockAuth }}>
                <GlobalStoreContextProvider>
                    <StoreTestConsumer {...consumerProps} />
                </GlobalStoreContextProvider>
            </AuthContext.Provider>
        </MemoryRouter>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GlobalStore', () => {
    test('loadLeagues — populates leagues in store', async () => {
        leagueRequests.getMyLeagues.mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [{ _id: 'l1', name: 'League One' }, { _id: 'l2', name: 'League Two' }] }
        });

        renderStore();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /load leagues/i }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('league-count').textContent).toBe('2');
        });
    });

    test('loadLeagues failure — does not update leagues', async () => {
        leagueRequests.getMyLeagues.mockResolvedValue({
            status: 500,
            data: { success: false, errorMessage: 'Server error' }
        });

        renderStore();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /load leagues/i }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('league-count').textContent).toBe('0');
        });
    });

    test('createLeague — adds league to store', async () => {
        leagueRequests.createLeague.mockResolvedValue({
            status: 201,
            data: { success: true, league: { _id: 'l1', name: 'New League' } }
        });
        draftRequests.createDraftSession.mockResolvedValue({
            status: 201,
            data: { success: true, draftSession: { draftSessionId: 'ds1' } }
        });

        let storeRef;
        renderStore({ onMount: (s) => { storeRef = s; } });

        await act(async () => {
            await storeRef.createLeague('New League');
        });

        await waitFor(() => {
            expect(screen.getByTestId('league-count').textContent).toBe('1');
        });
    });

    test('deleteLeague — removes league from store', async () => {
        leagueRequests.getMyLeagues.mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [{ _id: 'l1', name: 'League One' }] }
        });
        leagueRequests.deleteLeague.mockResolvedValue({
            status: 200,
            data: { success: true }
        });

        renderStore();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /load leagues/i }));
        });
        await waitFor(() => expect(screen.getByTestId('league-count').textContent).toBe('1'));

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /delete l1/i }));
        });

        await waitFor(() => {
            expect(screen.getByTestId('league-count').textContent).toBe('0');
        });
    });
});
