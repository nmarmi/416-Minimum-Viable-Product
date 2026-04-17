const express = require('express');
const router = express.Router();
const DraftSessionController = require('../controllers/draft-session-controller');

router.post('/', DraftSessionController.createDraftSession);
router.get('/:draftSessionId', DraftSessionController.getDraftSession);
router.put('/:draftSessionId', DraftSessionController.updateDraftSession);
router.get('/:draftSessionId/players', DraftSessionController.getSessionPlayers);
router.post('/:draftSessionId/purchases', DraftSessionController.recordPurchase);

module.exports = router;
