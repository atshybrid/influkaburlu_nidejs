const router = require('express').Router();
const ctrl = require('../controllers/applicationsController');
const auth = require('../middleware/auth');
router.post('/:adId/apply', auth(['influencer']), ctrl.applyToAd);
router.post('/submit/:appId', auth(['influencer']), ctrl.submitDeliverable);
router.post('/approve/:appId', auth(['brand','admin']), ctrl.approveAndPayout);
module.exports = router;
