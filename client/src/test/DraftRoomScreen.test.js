import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import DraftRoomScreen from '../components/DraftRoomScreen';
import { renderWithProviders } from './testUtils';
import { getPlayers, postUsage } from '../players/requests';

jest.mock('../players/requests', () => ({
    getPlayers: jest.fn(),
    postUsage: jest.fn(),
}));

jest.mock('../draft-sessions/requests', () => ({
    getSessionPlayers: jest.fn(),
    getSessionValuations: jest.fn(),
    getSessionRecommendations: jest.fn(),
}));

const players = [
    { playerId: 'active-1', name: 'Aaron Active', positions: ['OF'], mlbTeam: 'NYY', status: 'active' },
    { playerId: 'dtd-1', name: 'Bobby Day', positions: ['SS'], mlbTeam: 'BOS', status: 'DTD' },
    { playerId: 'dfa-1', name: 'Casey Waivers', positions: ['1B'], mlbTeam: 'SEA', status: 'DFA' },
    { playerId: 'il-1', name: 'Dylan Injured', positions: ['SP'], mlbTeam: 'LAD', status: 'IL-10' },
];

describe('DraftRoomScreen player statuses', () => {
    beforeEach(() => {
        getPlayers.mockResolvedValue({
            status: 200,
            data: {
                success: true,
                players,
                total: players.length,
                dataAsOf: '2026-05-11T00:00:00.000Z',
            },
        });
        postUsage.mockResolvedValue({ status: 200, data: { success: true } });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('shows non-active PlayerStub statuses as badges next to player names', async () => {
        renderWithProviders(<DraftRoomScreen />);

        await waitFor(() => expect(screen.getByText('Dylan Injured')).toBeInTheDocument());

        expect(screen.getByText('IL-10')).toHaveClass('draft-v2-status-badge', 'il');
        expect(screen.getByText('DTD')).toHaveClass('draft-v2-status-badge', 'dtd');
        expect(screen.getByText('DFA')).toHaveClass('draft-v2-status-badge', 'inactive');
        expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument();
    });

    test('sorts the Players tab by status', async () => {
        renderWithProviders(<DraftRoomScreen />);

        await waitFor(() => expect(screen.getByText('Aaron Active')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Status' }));

        const tableRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
        const orderedNames = tableRows.map((row) => within(row).getAllByRole('cell')[0].textContent);

        expect(orderedNames).toEqual([
            'Dylan InjuredIL-10',
            'Bobby DayDTD',
            'Casey WaiversDFA',
            'Aaron Active',
        ]);
    });
});
