const express = require('express');
const router = express.Router();
const LeagueController = require('../controllers/league-controller');

router.post('/', LeagueController.createLeague);
router.get('/', LeagueController.getMyLeagues);
router.delete('/:leagueId', LeagueController.deleteLeague);
// US-15.3: clone a prior-year draft into a new league for a fresh season
router.post('/:leagueId/clone', LeagueController.cloneLeague);

module.exports = router;
