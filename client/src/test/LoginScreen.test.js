import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import LoginScreen from '../components/LoginScreen';
import { renderWithProviders } from './testUtils';

describe('LoginScreen', () => {
    test('renders email and password inputs and submit button', () => {
        renderWithProviders(<LoginScreen />);

        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    test('submits email and password to auth.loginUser', () => {
        const loginUser = jest.fn();
        renderWithProviders(<LoginScreen />, { auth: { loginUser } });

        fireEvent.change(screen.getByLabelText(/email/i), {
            target: { value: 'test@test.com' }
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
            target: { value: 'mypassword' }
        });
        fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));

        expect(loginUser).toHaveBeenCalledWith('test@test.com', 'mypassword');
    });

    test('error modal is hidden when errorMessage is null', () => {
        renderWithProviders(<LoginScreen />, { auth: { errorMessage: null } });
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('error modal shows when errorMessage is set', () => {
        renderWithProviders(<LoginScreen />, { auth: { errorMessage: 'Wrong credentials.' } });
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Wrong credentials.')).toBeInTheDocument();
    });
});
