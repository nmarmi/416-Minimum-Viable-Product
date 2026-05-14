const express = require('express');
const router = express.Router();
const DraftSessionController = require('../controllers/draft-session-controller');

router.get('/', DraftSessionController.getMyDraftSessions);
router.post('/', DraftSessionController.createDraftSession);
router.get('/:draftSessionId', DraftSessionController.getDraftSession);
router.put('/:draftSessionId', DraftSessionController.updateDraftSession);
router.post('/:draftSessionId/start', DraftSessionController.startDraft);
router.get('/:draftSessionId/players', DraftSessionController.getSessionPlayers);
router.get('/:draftSessionId/valuations', DraftSessionController.getSessionValuations);
router.get('/:draftSessionId/recommendations', DraftSessionController.getSessionRecommendations);
router.post('/:draftSessionId/purchases', DraftSessionController.recordPurchase);
router.delete('/:draftSessionId/purchases/:purchaseId', DraftSessionController.undoPurchase);
router.put('/:draftSessionId/purchases/:purchaseId', DraftSessionController.editPurchase);
// US-18.2: move a purchased player to a different position slot
router.put('/:draftSessionId/purchases/:purchaseId/position', DraftSessionController.movePosition);
// US-19.3: move a minor league player to a different team
router.put('/:draftSessionId/minors/:playerId', DraftSessionController.moveMinor);
router.put('/:draftSessionId/player-notes/:playerId', DraftSessionController.setPlayerNote);

module.exports = router;
