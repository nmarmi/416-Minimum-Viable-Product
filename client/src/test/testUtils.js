import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../auth';
import { GlobalStoreContext } from '../store';

export function createMockAuth(overrides = {}) {
    return {
        user: null,
        loggedIn: false,
        loading: false,
        errorMessage: null,
        loginUser: jest.fn(),
        registerUser: jest.fn(),
        logoutUser: jest.fn(),
        clearError: jest.fn(),
        getLoggedIn: jest.fn(),
        ...overrides
    };
}

export function createMockStore(overrides = {}) {
    return {
        leagues: [],
        currentLeague: null,
        currentDraftSession: null,
        loadLeagues: jest.fn().mockResolvedValue({ status: 200, data: { success: true, leagues: [] } }),
        createLeague: jest.fn(),
        deleteLeague: jest.fn(),
        loadDraftSession: jest.fn(),
        updateDraftSession: jest.fn(),
        recordPurchase: jest.fn(),
        navigateTo: jest.fn(),
        isLoggedIn: jest.fn().mockReturnValue(true),
        ...overrides
    };
}

export function renderWithProviders(ui, { auth, store, route = '/' } = {}) {
    const authValue = createMockAuth(auth);
    const storeValue = createMockStore(store);

    return render(
        <MemoryRouter initialEntries={[route]}>
            <AuthContext.Provider value={{ auth: authValue }}>
                <GlobalStoreContext.Provider value={{ store: storeValue }}>
                    {ui}
                </GlobalStoreContext.Provider>
            </AuthContext.Provider>
        </MemoryRouter>
    );
}
