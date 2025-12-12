const router = require('express').Router();
const ctrl = require('../controllers/influencerController');
const auth = require('../middleware/auth');
router.get('/me', auth(), ctrl.me);
router.put('/me', auth(['influencer']), ctrl.update);
router.get('/dashboard', auth(['influencer']), ctrl.dashboard);
// Admin badge assignment
router.put('/:id/badges', auth(['admin']), ctrl.assignBadge);
module.exports = router;
