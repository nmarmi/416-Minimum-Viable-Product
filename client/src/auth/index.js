import React, { createContext, useEffect, useState } from "react";
import { useHistory } from 'react-router-dom';
import authRequestSender from './requests';

const AuthContext = createContext();
const ROLES_KEY = "draftiq_user_roles";

const readRoleMap = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(ROLES_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
        return {};
    }
};

const readStoredRoleForUser = (userId) => {
    if (!userId) return null;
    const roleMap = readRoleMap();
    const role = roleMap[userId];
    return role === "player" || role === "commissioner" ? role : null;
};

const writeStoredRoleForUser = (userId, role) => {
    if (typeof window === "undefined") return;
    if (!userId) {
        return;
    }

    const roleMap = readRoleMap();
    if (!role) {
        delete roleMap[userId];
    } else {
        roleMap[userId] = role;
    }
    window.localStorage.setItem(ROLES_KEY, JSON.stringify(roleMap));
};

function AuthContextProvider(props) {
    const history = useHistory();
    const [authState, setAuthState] = useState({
        user: null,
        role: null,
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
        const storedRole = readStoredRoleForUser(user?._id);

        setAuthState({
            user,
            role: loggedIn ? storedRole : null,
            loggedIn,
            loading: false,
            errorMessage: null
        });
        if (loggedIn && storedRole) {
            console.log(`user type: ${storedRole}`);
        }
    };

    const loginUser = async (email, password) => {
        const response = await authRequestSender.loginUser(email, password);

        if (response.status === 200) {
            const role = readStoredRoleForUser(response.data.user?._id) || "player";
            setAuthState({
                user: response.data.user,
                role,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            console.log(`user type: ${role}`);
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
            const registeredUser = response.data.user;
            setAuthState({
                user: registeredUser,
                role: null,
                loggedIn: true,
                loading: false,
                errorMessage: null
            });
            return { success: true, userId: registeredUser?._id };
        }

        setAuthState((prev) => ({
            ...prev,
            errorMessage: response.data.errorMessage || "Unable to create account."
        }));
        return { success: false };
    };

    const setUserRole = (role, userId) => {
        if (role !== "player" && role !== "commissioner") {
            return;
        }

        const targetUserId = userId || authState.user?._id;
        writeStoredRoleForUser(targetUserId, role);
        setAuthState((prev) => ({
            ...prev,
            role
        }));
        console.log(`user type: ${role}`);

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
