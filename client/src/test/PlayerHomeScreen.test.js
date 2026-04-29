import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import PlayerHomeScreen from '../components/PlayerHomeScreen';
import { renderWithProviders } from './testUtils';

describe('PlayerHomeScreen', () => {
    test('calls store.loadLeagues on mount', async () => {
        const loadLeagues = jest.fn().mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [] }
        });

        renderWithProviders(<PlayerHomeScreen />, { store: { loadLeagues } });

        await waitFor(() => {
            expect(loadLeagues).toHaveBeenCalledTimes(1);
        });
    });

    test('renders "No leagues yet" when leagues list is empty', async () => {
        const loadLeagues = jest.fn().mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [] }
        });

        renderWithProviders(<PlayerHomeScreen />, { store: { loadLeagues, leagues: [] } });

        await waitFor(() => {
            expect(screen.getByText(/no leagues yet/i)).toBeInTheDocument();
        });
    });

    test('renders league cards for each league', async () => {
        const leagues = [
            { _id: 'l1', name: 'Alpha League', draftSessionId: 'ds1' },
            { _id: 'l2', name: 'Beta League', draftSessionId: 'ds2' }
        ];
        const loadLeagues = jest.fn().mockResolvedValue({
            status: 200,
            data: { success: true, leagues }
        });

        renderWithProviders(<PlayerHomeScreen />, { store: { loadLeagues, leagues } });

        await waitFor(() => {
            expect(screen.getByText('Alpha League')).toBeInTheDocument();
            expect(screen.getByText('Beta League')).toBeInTheDocument();
        });
    });

    test('shows create modal when Create League button is clicked', async () => {
        const loadLeagues = jest.fn().mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [] }
        });

        renderWithProviders(<PlayerHomeScreen />, { store: { loadLeagues } });
        await waitFor(() => expect(loadLeagues).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: /create league/i }));

        expect(screen.getByPlaceholderText(/friday night roto/i)).toBeInTheDocument();
    });

    test('shows validation error when submitting empty league name', async () => {
        const loadLeagues = jest.fn().mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [] }
        });

        renderWithProviders(<PlayerHomeScreen />, { store: { loadLeagues } });
        await waitFor(() => expect(loadLeagues).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: /create league/i }));
        const modalCreateBtn = screen.getAllByRole('button', { name: /create league/i })[1];
        fireEvent.click(modalCreateBtn);

        expect(screen.getByText(/league name is required/i)).toBeInTheDocument();
    });

    test('calls store.createLeague with trimmed league name', async () => {
        const createLeague = jest.fn().mockResolvedValue({
            status: 201,
            data: { success: true, league: { _id: 'l1', name: 'Test' }, draftSession: { draftSessionId: 'ds1' } }
        });
        const loadLeagues = jest.fn().mockResolvedValue({
            status: 200,
            data: { success: true, leagues: [] }
        });

        renderWithProviders(<PlayerHomeScreen />, { store: { loadLeagues, createLeague } });
        await waitFor(() => expect(loadLeagues).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: /create league/i }));
        fireEvent.change(screen.getByPlaceholderText(/friday night roto/i), {
            target: { value: '  My New League  ' }
        });

        const modalCreateBtn = screen.getAllByRole('button', { name: /create league/i })[1];
        fireEvent.click(modalCreateBtn);

        await waitFor(() => {
            expect(createLeague).toHaveBeenCalledWith('My New League');
        });
    });
});
