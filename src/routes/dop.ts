const router = require('express').Router();
const auth = require('../middleware/auth');
const photoshootCtrl = require('../controllers/photoshootController');
const dopCtrl = require('../controllers/dopController');

// DOP (Director of Photography) APIs
router.get('/me', auth(['dop']), dopCtrl.me);
router.put('/me', auth(['dop']), dopCtrl.updateMe);
router.get('/dashboard', auth(['dop']), dopCtrl.dashboard);

router.get('/photoshoots/requests', auth(['dop']), photoshootCtrl.dopList);
router.get('/photoshoots/requests/:ulid', auth(['dop']), photoshootCtrl.dopGet);

// Create/update schedule for an assigned photoshoot
router.put('/photoshoots/requests/:ulid/schedule', auth(['dop']), photoshootCtrl.dopSchedule);

// Upload raw and final media references (URLs) and auto-advance status
router.post('/photoshoots/requests/:ulid/raw-media', auth(['dop']), photoshootCtrl.dopAddRawMedia);
router.post('/photoshoots/requests/:ulid/final-media', auth(['dop']), photoshootCtrl.dopAddFinalMedia);

// Explicit status update (e.g. shoot_done / completed)
router.put('/photoshoots/requests/:ulid/status', auth(['dop']), photoshootCtrl.dopSetStatus);

module.exports = router;
