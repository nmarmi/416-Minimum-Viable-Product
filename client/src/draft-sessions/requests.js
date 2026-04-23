import { DRAFT_SESSIONS_API_BASE_URL } from "../config/api";

const BASE_URL = DRAFT_SESSIONS_API_BASE_URL;

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
        console.error("DRAFT SESSION REQUEST ERROR:", err);
        return {
            status: 500,
            data: {
                success: false,
                errorMessage: "Network or server error."
            }
        };
    }
}

export const createDraftSession = async (payload) => request("/", "POST", payload);
export const getDraftSession = async (draftSessionId) => request(`/${draftSessionId}`, "GET");
export const updateDraftSession = async (draftSessionId, payload) => request(`/${draftSessionId}`, "PUT", payload);
export const recordPurchase = async (draftSessionId, payload) => request(`/${draftSessionId}/purchases`, "POST", payload);
export const undoPurchase = async (draftSessionId, purchaseId) => request(`/${draftSessionId}/purchases/${purchaseId}`, "DELETE");
export const editPurchase = async (draftSessionId, purchaseId, payload) => request(`/${draftSessionId}/purchases/${purchaseId}`, "PUT", payload);

const draftSessionsApi = {
    createDraftSession,
    getDraftSession,
    updateDraftSession,
    recordPurchase,
    undoPurchase,
    editPurchase,
};

export default draftSessionsApi;
