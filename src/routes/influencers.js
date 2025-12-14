const router = require('express').Router();
const ctrl = require('../controllers/influencerController');
const auth = require('../middleware/auth');
const multer = require('multer');
const os = require('os');
const path = require('path');
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, os.tmpdir()),
	filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: (parseInt(process.env.MEDIA_MAX_VIDEO_MB||'100',10))*1024*1024 } });
router.get('/me', auth(), ctrl.me);
router.put('/me', auth(['influencer']), ctrl.update);
router.get('/dashboard', auth(['influencer']), ctrl.dashboard);
// Update profile picture (multipart or JSON imageUrl)
router.put('/me/profile-pic', auth(['influencer']), ctrl.updateProfilePic);
// Pricing (get/update)
router.get('/me/pricing', auth(['influencer']), ctrl.getPricing);
router.put('/me/pricing', auth(['influencer']), ctrl.updatePricing);
router.post('/me/pricing', auth(['influencer']), ctrl.updatePricing);
// KYC and payment methods
router.get('/me/kyc', auth(['influencer']), require('../controllers/kycController').getMe);
router.put('/me/kyc', auth(['influencer']), require('../controllers/kycController').updateMe);
router.get('/me/payment-methods', auth(['influencer']), require('../controllers/paymentController').listMe);
router.put('/me/payment-methods', auth(['influencer']), require('../controllers/paymentController').upsertMe);
// Admin badge assignment
router.put('/:id/badges', auth(['admin']), ctrl.assignBadge);
// Influencer ad posts
router.post('/:id/ads', auth(['influencer','admin']), require('../controllers/influencerPostsController').createInfluencerAdPost);
router.get('/:id/feed', require('../controllers/influencerPostsController').influencerFeed);
// Public: all influencer ads/posts
router.get('/ads', require('../controllers/influencerPostsController').publicAds);
// Public: canonical influencer ad media (videos)
router.get('/ads/media', require('../controllers/mediaController').listInfluencerAdMedia);
// Self ad post video via ULID
router.post('/me/ads/video', auth(['influencer']), upload.single('file'), require('../controllers/postsController').createPostVideoMe);
module.exports = router;
