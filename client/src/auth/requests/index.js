import { AUTH_API_BASE_URL } from "../../config/api";

const BASE_URL = AUTH_API_BASE_URL;

async function request(path, method = "GET", body = null) {
    try {
        const options = {
            method,
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const res = await fetch(`${BASE_URL}${path}`, options);
        const data = await res.json().catch(() => ({
            errorMessage: `Server error (${res.status}) — try restarting the server.`
        }));

        return { status: res.status, data };
    } catch (err) {
        return {
            status: 500,
            data: {
                success: false,
                errorMessage: "Network or server error."
            }
        };
    }
}

export const getLoggedIn = async () => request("/loggedIn", "GET");

export const loginUser = async (email, password) => request("/login", "POST", {
    email,
    password
});

export const logoutUser = async () => request("/logout", "GET");

export const registerUser = async (userName, email, password, passwordVerify) => request("/register", "POST", {
    userName,
    email,
    password,
    passwordVerify
});

export const changePassword = async (currentPassword, newPassword, newPasswordVerify) =>
    request("/change-password", "PUT", { currentPassword, newPassword, newPasswordVerify });

export const deleteAccount = async () => request("/account", "DELETE");

// US-16.2: password reset flow
export const forgotPassword = async (email) => request("/forgot-password", "POST", { email });
export const resetPassword  = async (token, newPassword) => request("/reset-password", "POST", { token, newPassword });

const apis = {
    getLoggedIn,
    registerUser,
    loginUser,
    logoutUser,
    changePassword,
    deleteAccount,
    forgotPassword,
    resetPassword,
};

export default apis;
