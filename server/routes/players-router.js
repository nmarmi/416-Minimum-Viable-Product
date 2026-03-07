const express = require('express');
const router = express.Router();
const PlayersController = require('../controllers/players-controller');

router.get('/', PlayersController.getPlayers);
router.post('/usage', PlayersController.postUsage);

module.exports = router;
