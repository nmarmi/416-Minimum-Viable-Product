const express = require('express');
const router = express.Router();
const DraftSessionController = require('../controllers/draft-session-controller');

router.get('/', DraftSessionController.getMyDraftSessions);
router.post('/', DraftSessionController.createDraftSession);
router.get('/:draftSessionId', DraftSessionController.getDraftSession);
router.put('/:draftSessionId', DraftSessionController.updateDraftSession);
router.post('/:draftSessionId/start', DraftSessionController.startDraft);
router.get('/:draftSessionId/players', DraftSessionController.getSessionPlayers);
// US-21.1: single player detail — proxies to Player Data API, keeps key server-side
router.get('/:draftSessionId/players/:playerId', DraftSessionController.getSessionPlayer);
// US-25.1: SSE push stream proxy
router.get('/:draftSessionId/events', DraftSessionController.streamEvents);
// US-26.1/26.2: taxi draft order
router.put('/:draftSessionId/taxi/order', DraftSessionController.setTaxiOrder);
// US-26.3: record a taxi pick
router.post('/:draftSessionId/taxi/picks', DraftSessionController.recordTaxiPick);
// US-26.6: undo a taxi pick
router.delete('/:draftSessionId/taxi/picks/:taxiPickId', DraftSessionController.undoTaxiPick);
router.get('/:draftSessionId/valuations', DraftSessionController.getSessionValuations);
router.get('/:draftSessionId/recommendations', DraftSessionController.getSessionRecommendations);
router.post('/:draftSessionId/purchases', DraftSessionController.recordPurchase);
router.delete('/:draftSessionId/purchases/:purchaseId', DraftSessionController.undoPurchase);
// US-22.4: redo — re-applies the top of the undo stack
router.post('/:draftSessionId/redo', DraftSessionController.redoPurchase);
router.put('/:draftSessionId/purchases/:purchaseId', DraftSessionController.editPurchase);
// US-18.2: move a purchased player to a different position slot
router.put('/:draftSessionId/purchases/:purchaseId/position', DraftSessionController.movePosition);
// US-19.3: move a minor league player to a different team
router.put('/:draftSessionId/minors/:playerId', DraftSessionController.moveMinor);
router.put('/:draftSessionId/player-notes/:playerId', DraftSessionController.setPlayerNote);

module.exports = router;
