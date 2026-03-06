const BASE_URL = process.env.REACT_APP_LEAGUES_API_URL || "http://localhost:4000/leagues";

async function request(path, method = "GET", body = null) {
    try {
        console.log("LEAGUES REQUEST:", `${BASE_URL}${path}`, method, body);

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
        const data = await res.json().catch(() => ({}));

        return { status: res.status, data };
    } catch (err) {
        console.error("LEAGUES REQUEST ERROR:", err);
        return {
            status: 500,
            data: {
                success: false,
                errorMessage: "Network or server error."
            }
        };
    }
}

export const createLeague = async (leagueData) => request("/", "POST", leagueData);
export const getMyLeagues = async () => request("/", "GET");

const apis = {
    createLeague,
    getMyLeagues
};

export default apis;