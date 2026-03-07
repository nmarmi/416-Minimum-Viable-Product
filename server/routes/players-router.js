const express = require('express');
const router = express.Router();
const PlayersController = require('../controllers/players-controller');

router.get('/', PlayersController.getPlayers);

module.exports = router;
