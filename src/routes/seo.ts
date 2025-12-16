const router = require('express').Router();
const ctrl = require('../controllers/seoController');

// Public SEO data endpoints
router.get('/influencer/:slug', ctrl.getInfluencerSeo);
router.get('/page/:slug', ctrl.getPageSeo);

module.exports = router;
