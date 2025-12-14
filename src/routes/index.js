const express = require('express');
const router = express.Router();
const auth = require('./auth');
const ads = require('./ads');
const influencers = require('./influencers');
const applications = require('./applications');
const posts = require('./posts');
const profile = require('./profile');
const locations = require('./locations');
const media = require('./media');
const brands = require('./brands');
const uploads = require('./uploads');
const discovery = require('./discovery');
const categories = require('./categories');
const bunnyCtrl = require('../controllers/bunnyController');
const kycCtrl = require('../controllers/kycController');
const payCtrl = require('../controllers/paymentController');
const requireAuth = require('../middleware/auth');

router.use('/auth', auth);
router.use('/ads', ads);
router.use('/influencers', influencers);
router.use('/applications', applications);
router.use('/posts', posts);
router.use('/profile-builder', profile);
router.use('/locations', locations);
router.use('/media', media);
router.use('/brands', brands);
router.use('/uploads', uploads);
router.use('/discovery', discovery);
router.use('/categories', categories);

// Bunny admin/public
router.get('/admin/bunny/videos', requireAuth(['admin']), bunnyCtrl.adminListVideos);
router.get('/admin/bunny/media/status-counts', requireAuth(['admin']), bunnyCtrl.mediaStatusCounts);
// Admin KYC
router.get('/admin/kyc', requireAuth(['admin']), kycCtrl.adminList);
router.get('/admin/kyc/:influencerId', requireAuth(['admin']), kycCtrl.adminGet);
router.put('/admin/kyc/:influencerId/status', requireAuth(['admin']), kycCtrl.adminSetStatus);
// Admin Payments
router.get('/admin/payments', requireAuth(['admin']), payCtrl.adminList);
router.put('/admin/payments/:id/status', requireAuth(['admin']), payCtrl.adminSetStatus);
router.get('/posts/:idUlid/playback', bunnyCtrl.postPlayback);
router.get('/bunny/videos/:guid/status', bunnyCtrl.videoStatus);

router.get('/', (req,res)=> res.json({ ok: true, version: 'kaburlu-backend-v2' }));

module.exports = router;
