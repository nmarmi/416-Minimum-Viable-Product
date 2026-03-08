const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const API_BASE_URL = trimTrailingSlash(
    process.env.REACT_APP_API_BASE_URL || ""
);

const AUTH_API_BASE_URL = trimTrailingSlash(
    process.env.REACT_APP_API_URL || (API_BASE_URL ? `${API_BASE_URL}/auth` : "/auth")
);

const LEAGUES_API_BASE_URL = trimTrailingSlash(
    process.env.REACT_APP_LEAGUES_API_URL || (API_BASE_URL ? `${API_BASE_URL}/leagues` : "/leagues")
);

const PLAYERS_API_BASE_URL = trimTrailingSlash(
    process.env.REACT_APP_PLAYERS_API_URL || API_BASE_URL
);

export {
    AUTH_API_BASE_URL,
    LEAGUES_API_BASE_URL,
    PLAYERS_API_BASE_URL
};
