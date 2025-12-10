const router = require('express').Router();
const ctrl = require('../controllers/adsController');
const auth = require('../middleware/auth');
router.post('/', auth(['brand']), ctrl.createAd);
router.get('/', ctrl.listAds);
module.exports = router;
