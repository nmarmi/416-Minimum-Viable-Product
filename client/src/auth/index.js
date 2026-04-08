import React, { createContext, useEffect, useState } from "react";
import { useHistory } from 'react-router-dom';
import authRequestSender from './requests';

const AuthContext = createContext();

function AuthContextProvider(props) {
    const history = useHistory();
    const [authState, setAuthState] = useState({
        user: null,
        loggedIn: false,
        loading: true,
        errorMessage: null
    });

    const clearError = () => {
        setAuthState((prev) => ({
            ...prev,
            errorMessage: null
        }));
    };

    const getLoggedIn = async () => {
        const response = await authRequestSender.getLoggedIn();
        const loggedIn = response.status === 200 && !!response.data.loggedIn;
        const user = loggedIn ? response.data.user : null;

        setAuthState({
            user,
            loggedIn,
            loading: false,
            errorMessage: null
        });
    };

    const loginUser = async (email, password) => {
        const response = await authRequestSender.loginUser(email, password);

        if (response.status === 200) {
            setAuthState({
                user: response.data.user,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            history.push("/home");
            return;
        }

        setAuthState((prev) => ({
            ...prev,
            errorMessage: response.data.errorMessage || "Unable to sign in."
        }));
    };

    const registerUser = async (userName, email, password, passwordVerify) => {
        const response = await authRequestSender.registerUser(
            userName,
            email,
            password,
            passwordVerify
        );

        if (response.status === 200) {
            const registeredUser = response.data.user;
            setAuthState({
                user: registeredUser,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            history.push("/home");
            return { success: true };
        }

        setAuthState((prev) => ({
            ...prev,
            errorMessage: response.data.errorMessage || "Unable to create account."
        }));
        return { success: false };
    };

    const logoutUser = async () => {
        const response = await authRequestSender.logoutUser();
        if (response.status !== 200) {
            return;
        }

        setAuthState({
            user: null,
            loggedIn: false,
            loading: false,
            errorMessage: null
        });
        history.push("/");
    };

    useEffect(() => {
        getLoggedIn();
    }, []);

    const auth = {
        ...authState,
        clearError,
        getLoggedIn,
        loginUser,
        registerUser,
        logoutUser
    };

    return (
        <AuthContext.Provider value={{ auth }}>
            {props.children}
        </AuthContext.Provider>
    );
}

export default AuthContext;
export { AuthContextProvider };
