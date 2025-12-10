const router = require('express').Router();
const ctrl = require('../controllers/influencerController');
const auth = require('../middleware/auth');
router.get('/me', auth(), ctrl.me);
router.put('/me', auth(['influencer']), ctrl.update);
module.exports = router;
