const express = require('express');
const router = express.Router();
const DraftSessionController = require('../controllers/draft-session-controller');

router.post('/', DraftSessionController.createDraftSession);
router.get('/', DraftSessionController.getDraftSession);
router.get('/:draftSessionId', DraftSessionController.getDraftSession);
router.put('/:draftSessionId', DraftSessionController.updateDraftSession);
router.post('/:draftSessionId/start', DraftSessionController.startDraftSession);

module.exports = router;
