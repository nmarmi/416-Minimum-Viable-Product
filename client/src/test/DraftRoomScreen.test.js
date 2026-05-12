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
    { playerId: 'active-1', name: 'Aaron Active', positions: ['OF'], mlbTeam: 'NYY', status: 'active', depthChartPosition: 'OF', depthChartRank: 1 },
    { playerId: 'dtd-1', name: 'Bobby Day', positions: ['SS'], mlbTeam: 'BOS', status: 'DTD', depthChartPosition: 'SS', depthChartRank: 2 },
    { playerId: 'dfa-1', name: 'Casey Waivers', positions: ['1B'], mlbTeam: 'SEA', status: 'DFA', depthChartPosition: 'AAA', depthChartRank: null },
    { playerId: 'il-1', name: 'Dylan Injured', positions: ['SP'], mlbTeam: 'LAD', status: 'IL-10', depthChartPosition: 'SP', depthChartRank: 1 },
    { playerId: 'bench-1', name: 'Eddie Bench', positions: ['OF'], mlbTeam: 'TEX', status: 'active', depthChartPosition: 'OF', depthChartRank: 'bench' },
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

        fireEvent.click(screen.getByRole('button', { name: /sort:/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Status' }));

        const tableRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
        const orderedNames = tableRows.map((row) => within(row).getAllByRole('cell')[0].textContent);

        expect(orderedNames).toEqual([
            'Dylan InjuredIL-10',
            'Bobby DayDTD',
            'Casey WaiversDFA',
            'Aaron Active',
            'Eddie Bench',
        ]);
    });

    test('renders depth-chart fields and filters to starters only', async () => {
        renderWithProviders(<DraftRoomScreen />);

        await waitFor(() => expect(screen.getByText('Aaron Active')).toBeInTheDocument());

        expect(screen.getByText('OF1')).toHaveClass('draft-v2-depth-badge');
        expect(screen.getByText('SP1')).toHaveClass('draft-v2-depth-badge');
        expect(screen.getByText('AAA')).toHaveClass('draft-v2-depth-badge');
        expect(screen.getByText('OF-bench')).toHaveClass('draft-v2-depth-badge');

        fireEvent.click(screen.getByRole('button', { name: /filters/i }));
        fireEvent.click(screen.getByRole('button', { name: /starters only/i }));

        expect(screen.getByText('Aaron Active')).toBeInTheDocument();
        expect(screen.getByText('Dylan Injured')).toBeInTheDocument();
        expect(screen.queryByText('Bobby Day')).not.toBeInTheDocument();
        expect(screen.queryByText('Casey Waivers')).not.toBeInTheDocument();
        expect(screen.queryByText('Eddie Bench')).not.toBeInTheDocument();
    });
});
