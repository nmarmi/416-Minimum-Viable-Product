const BASE_URL = process.env.REACT_APP_PLAYERS_API_URL || '';

async function request(path, method = 'GET', body = null) {
    try {
        const options = {
            method,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);
        const url = BASE_URL ? `${BASE_URL}${path}` : path;
        const res = await fetch(url, options);
        const rawText = await res.text();
        let data = {};
        if (rawText) {
            try {
                data = JSON.parse(rawText);
            } catch {
                data = { success: false, errorMessage: rawText };
            }
        }
        if (data.errorMessage && data.errorMessage.trim().startsWith('<!')) {
            data.errorMessage = 'Server error or /players not found. Restart the backend (npm start in server folder).';
        }
        if (!res.ok && !data.errorMessage) {
            data.errorMessage = `Request failed with status ${res.status}.`;
        }
        return { status: res.status, data };
    } catch (err) {
        console.error('Players request error:', err);
        return { status: 500, data: { success: false, errorMessage: 'Network or server error.' } };
    }
}

function buildQuery(params) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.team) q.set('team', params.team);
    if (params.position) q.set('position', params.position);
    if (params.limit != null) q.set('limit', params.limit);
    if (params.offset != null) q.set('offset', params.offset);
    const s = q.toString();
    return s ? `?${s}` : '';
}

export async function getPlayers(params = {}) {
    const query = buildQuery(params);
    return request(`/players${query}`);
}

export async function postUsage(payload = {}) {
    return request('/players/usage', 'POST', {
        event: payload.event || 'draft_room_open',
        timestamp: payload.timestamp || new Date().toISOString(),
        metadata: payload.metadata || {}
    });
}

export default { getPlayers, postUsage };
