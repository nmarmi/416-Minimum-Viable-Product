import { createContext, useContext, useState } from 'react';
import { useHistory } from 'react-router-dom';
import leaguesRequestSender from '../leagues/requests';
import draftSessionsRequestSender, {
    recordPurchase as recordPurchaseRequest,
    undoPurchase as undoPurchaseRequest,
    editPurchase as editPurchaseRequest
} from '../draft-sessions/requests';
import AuthContext from '../auth';

/*
    This is our global data store. Note that it uses the Flux design pattern,
    which makes use of things like actions and reducers.

    Only cross-screen server data lives here (leagues, draft session).
    Local UI state (modals, search inputs, suggestions) stays in each component.
*/

// THIS IS THE CONTEXT WE'LL USE TO SHARE OUR STORE
export const GlobalStoreContext = createContext({});

// THESE ARE ALL THE TYPES OF UPDATES TO OUR GLOBAL
// DATA STORE STATE THAT CAN BE PROCESSED
export const GlobalStoreActionType = {
    LOAD_LEAGUES: "LOAD_LEAGUES",
    CREATE_LEAGUE: "CREATE_LEAGUE",
    DELETE_LEAGUE: "DELETE_LEAGUE",
    SET_CURRENT_LEAGUE: "SET_CURRENT_LEAGUE",
    LOAD_DRAFT_SESSION: "LOAD_DRAFT_SESSION",
    UPDATE_DRAFT_SESSION: "UPDATE_DRAFT_SESSION",
    RECORD_PURCHASE: "RECORD_PURCHASE",
    UNDO_PURCHASE: "UNDO_PURCHASE",
    EDIT_PURCHASE: "EDIT_PURCHASE",
};

// WITH THIS WE'RE MAKING OUR GLOBAL DATA STORE
// AVAILABLE TO THE REST OF THE APPLICATION
function GlobalStoreContextProvider(props) {
    // THESE ARE ALL THE THINGS OUR DATA STORE WILL MANAGE
    const [store, setStore] = useState({
        leagues: [],
        currentLeague: null,
        currentDraftSession: null,
    });

    const history = useHistory();

    // SINCE WE'VE WRAPPED THE STORE IN THE AUTH CONTEXT WE CAN ACCESS THE USER HERE
    const { auth } = useContext(AuthContext);

    // HERE'S THE DATA STORE'S REDUCER, IT MUST
    // HANDLE EVERY TYPE OF STATE CHANGE
    const storeReducer = (action) => {
        const { type, payload } = action;
        switch (type) {
            // REPLACE THE FULL LEAGUES LIST
            case GlobalStoreActionType.LOAD_LEAGUES: {
                return setStore({
                    leagues: payload,
                    currentLeague: store.currentLeague,
                    currentDraftSession: store.currentDraftSession,
                });
            }
            // ADD THE NEWLY CREATED LEAGUE TO THE LIST AND SELECT IT
            case GlobalStoreActionType.CREATE_LEAGUE: {
                return setStore({
                    leagues: [...store.leagues, payload.league],
                    currentLeague: payload.league,
                    currentDraftSession: payload.draftSession || null,
                });
            }
            // REMOVE A LEAGUE FROM THE LIST
            case GlobalStoreActionType.DELETE_LEAGUE: {
                return setStore({
                    leagues: store.leagues.filter((l) => l._id !== payload),
                    currentLeague: store.currentLeague?._id === payload ? null : store.currentLeague,
                    currentDraftSession: store.currentLeague?._id === payload ? null : store.currentDraftSession,
                });
            }
            // SET THE ACTIVE LEAGUE (CLEARS SESSION UNTIL EXPLICITLY LOADED)
            case GlobalStoreActionType.SET_CURRENT_LEAGUE: {
                return setStore({
                    leagues: store.leagues,
                    currentLeague: payload,
                    currentDraftSession: null,
                });
            }
            // STORE THE LOADED DRAFT SESSION FOR THE CURRENT LEAGUE
            case GlobalStoreActionType.LOAD_DRAFT_SESSION: {
                return setStore({
                    leagues: store.leagues,
                    currentLeague: store.currentLeague,
                    currentDraftSession: payload,
                });
            }
            // REPLACE THE CURRENT DRAFT SESSION WITH UPDATED DATA
            case GlobalStoreActionType.UPDATE_DRAFT_SESSION: {
                return setStore({
                    leagues: store.leagues,
                    currentLeague: store.currentLeague,
                    currentDraftSession: payload,
                });
            }
            // UPDATE SESSION AFTER A PURCHASE IS RECORDED
            case GlobalStoreActionType.RECORD_PURCHASE:
            case GlobalStoreActionType.UNDO_PURCHASE:
            case GlobalStoreActionType.EDIT_PURCHASE: {
                return setStore({
                    leagues: store.leagues,
                    currentLeague: store.currentLeague,
                    currentDraftSession: payload,
                });
            }
            default:
                return store;
        }
    };

    // -----------------------------------------------------------------------
    // ASYNC STORE METHODS
    // -----------------------------------------------------------------------

    store.loadLeagues = async function () {
        const res = await leaguesRequestSender.getMyLeagues();
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.LOAD_LEAGUES,
                payload: res.data.leagues || [],
            });
        }
        return res;
    };

    store.createLeague = async function (name) {
        const leagueRes = await leaguesRequestSender.createLeague({ name });
        if (leagueRes.status !== 201 || !leagueRes.data?.success) {
            return leagueRes;
        }

        const league = leagueRes.data.league;
        const sessionRes = await draftSessionsRequestSender.createDraftSession({ leagueId: league._id });
        const draftSession =
            (sessionRes.status === 201 || sessionRes.status === 200) && sessionRes.data?.success
                ? sessionRes.data.draftSession
                : null;

        storeReducer({
            type: GlobalStoreActionType.CREATE_LEAGUE,
            payload: { league, draftSession },
        });

        return { status: 201, data: { success: true, league, draftSession } };
    };

    store.deleteLeague = async function (leagueId) {
        const res = await leaguesRequestSender.deleteLeague(leagueId);
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.DELETE_LEAGUE,
                payload: leagueId,
            });
        }
        return res;
    };

    store.loadDraftSession = async function (draftSessionId) {
        const res = await draftSessionsRequestSender.getDraftSession(draftSessionId);
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.LOAD_DRAFT_SESSION,
                payload: res.data.draftSession,
            });
        }
        return res;
    };

    store.updateDraftSession = async function (draftSessionId, updates) {
        const res = await draftSessionsRequestSender.updateDraftSession(draftSessionId, updates);
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.UPDATE_DRAFT_SESSION,
                payload: res.data.draftSession,
            });
        }
        return res;
    };

    store.recordPurchase = async function (draftSessionId, { playerId, playerName, teamId, price }) {
        const res = await recordPurchaseRequest(draftSessionId, { playerId, playerName, teamId, price });
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.RECORD_PURCHASE,
                payload: res.data.draftSession,
            });
        }
        return res;
    };

    store.undoPurchase = async function (draftSessionId, purchaseId) {
        const res = await undoPurchaseRequest(draftSessionId, purchaseId);
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.UNDO_PURCHASE,
                payload: res.data.draftSession,
            });
        }
        return res;
    };

    store.editPurchase = async function (draftSessionId, purchaseId, { price, teamId }) {
        const res = await editPurchaseRequest(draftSessionId, purchaseId, { price, teamId });
        if (res.status === 200 && res.data?.success) {
            storeReducer({
                type: GlobalStoreActionType.EDIT_PURCHASE,
                payload: res.data.draftSession,
            });
        }
        return res;
    };

    store.isLoggedIn = function () {
        return auth?.loggedIn === true;
    };

    store.navigateTo = function (path) {
        history.push(path);
    };

    return (
        <GlobalStoreContext.Provider value={{ store }}>
            {props.children}
        </GlobalStoreContext.Provider>
    );
}

export default GlobalStoreContextProvider;
