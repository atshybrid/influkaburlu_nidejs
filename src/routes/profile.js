const router = require('express').Router();
const ctrl = require('../controllers/profileBuilder');
const auth = require('../middleware/auth');
router.post('/generate', auth(['influencer']), ctrl.generate);
router.get('/pack/:id', ctrl.getPack);
module.exports = router;
