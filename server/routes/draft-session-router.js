const express = require('express');
const router = express.Router();
const DraftSessionController = require('../controllers/draft-session-controller');

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

module.exports = router;
