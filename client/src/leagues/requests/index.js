import { LEAGUES_API_BASE_URL } from "../../config/api";

const BASE_URL = LEAGUES_API_BASE_URL;

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
        const rawText = await res.text();

        let data = {};
        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch (parseErr) {
                data = {
                    success: false,
                    errorMessage: rawText
                };
            }
        }

        if (!res.ok && !data.errorMessage) {
            data.errorMessage = `Request failed with status ${res.status}.`;
        }

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
