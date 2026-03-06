import React, { createContext, useEffect, useState } from "react";
import { useHistory } from 'react-router-dom';
import authRequestSender from './requests';

const AuthContext = createContext();
const ROLE_KEY = "draftiq_user_role";

const readStoredRole = () => {
    if (typeof window === "undefined") return null;
    const role = window.localStorage.getItem(ROLE_KEY);
    return role === "player" || role === "commissioner" ? role : null;
};

const writeStoredRole = (role) => {
    if (typeof window === "undefined") return;
    if (!role) {
        window.localStorage.removeItem(ROLE_KEY);
        return;
    }
    window.localStorage.setItem(ROLE_KEY, role);
};

function AuthContextProvider(props) {
    const history = useHistory();
    const [authState, setAuthState] = useState({
        user: null,
        role: readStoredRole(),
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
        const storedRole = readStoredRole();

        setAuthState({
            user: loggedIn ? response.data.user : null,
            role: loggedIn ? storedRole : null,
            loggedIn,
            loading: false,
            errorMessage: null
        });
    };

    const loginUser = async (email, password) => {
        const response = await authRequestSender.loginUser(email, password);

        if (response.status === 200) {
            const role = readStoredRole() || "player";
            setAuthState({
                user: response.data.user,
                role,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            history.push(role === "commissioner" ? "/commissioner-home" : "/player-home");
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
            setAuthState({
                user: response.data.user,
                role: null,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            writeStoredRole(null);
            return { success: true };
        }

        setAuthState((prev) => ({
            ...prev,
            errorMessage: response.data.errorMessage || "Unable to create account."
        }));
        return { success: false };
    };

    const setUserRole = (role) => {
        if (role !== "player" && role !== "commissioner") {
            return;
        }

        writeStoredRole(role);
        setAuthState((prev) => ({
            ...prev,
            role
        }));

        history.push(role === "commissioner" ? "/commissioner-home" : "/player-home");
    };

    const logoutUser = async () => {
        const response = await authRequestSender.logoutUser();
        if (response.status !== 200) {
            return;
        }

        setAuthState({
            user: null,
            role: null,
            loggedIn: false,
            loading: false,
            errorMessage: null
        });
        writeStoredRole(null);
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
        setUserRole,
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
