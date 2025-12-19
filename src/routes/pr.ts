const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/prController');

// PR dashboard APIs (brand-scoped)
router.get('/brands', auth(['pr']), ctrl.listMyBrands);
router.get('/brands/:brandUlid/ads', auth(['pr']), ctrl.listBrandAds);
router.get('/ads/:id', auth(['pr']), ctrl.getAd);
router.get('/commissions', auth(['pr']), ctrl.listMyCommissions);

module.exports = router;
