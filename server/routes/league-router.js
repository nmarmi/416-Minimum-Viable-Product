const express = require('express');
const router = express.Router();
const LeagueController = require('../controllers/league-controller');

router.post('/', LeagueController.createLeague);
router.post('/join', LeagueController.joinLeague);
router.get('/', LeagueController.getMyLeagues);

module.exports = router;
