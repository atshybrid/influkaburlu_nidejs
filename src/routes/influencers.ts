const router = require('express').Router();
const ctrl = require('../controllers/influencerController');
const auth = require('../middleware/auth');
const multer = require('multer');
const os = require('os');
const path = require('path');
const multipartBoundaryFix = require('../middleware/multipartBoundaryFix');
const fileUpload = require('../middleware/fileUpload');
const storage = multer.diskStorage({
	destination: (req, file, cb) => cb(null, os.tmpdir()),
	filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: (parseInt(process.env.MEDIA_MAX_VIDEO_MB||'100',10))*1024*1024 } });
router.get('/me', auth(), ctrl.me);
router.put('/me', auth(['influencer']), ctrl.update);
router.get('/dashboard', auth(['influencer']), ctrl.dashboard);
// Referrals
router.get('/me/referral', auth(['influencer']), ctrl.getMyReferral);
router.post('/me/referral/apply', auth(['influencer']), ctrl.applyReferralCode);
router.get('/me/referral/ledger', auth(['influencer']), ctrl.getMyReferralLedger);
router.post('/me/referral/invite', auth(['influencer']), ctrl.sendMyReferralInvite);
// Update profile picture (multipart or JSON imageUrl)
router.put('/me/profile-pic', auth(['influencer']), fileUpload, ctrl.updateProfilePic);
// Pricing (get/update)
router.get('/me/pricing', auth(['influencer']), ctrl.getPricing);
router.put('/me/pricing', auth(['influencer']), ctrl.updatePricing);
router.post('/me/pricing', auth(['influencer']), ctrl.updatePricing);
// KYC and payment methods
router.get('/me/kyc', auth(['influencer']), require('../controllers/kycController').getMe);
router.put('/me/kyc', auth(['influencer']), require('../controllers/kycController').updateMe);
router.get('/me/payment-methods', auth(['influencer']), require('../controllers/paymentController').listMe);
router.put('/me/payment-methods', auth(['influencer']), require('../controllers/paymentController').upsertMe);
router.delete('/me/payment-methods/:id', auth(['influencer']), require('../controllers/paymentController').removeMe);
router.put('/me/payment-methods/:id/preferred', auth(['influencer']), require('../controllers/paymentController').setPreferredMe);

// Photoshoots (free studio shoot request + booking)
const photoshootCtrl = require('../controllers/photoshootController');
router.post('/me/photoshoots/requests/submit', auth(['influencer']), photoshootCtrl.submitMe);
router.get('/me/photoshoots/requests', auth(['influencer']), photoshootCtrl.listMe);
// Convenience: fetch latest request without ULID
router.get('/me/photoshoots/requests/latest', auth(['influencer']), photoshootCtrl.getLatestMe);
// Admin badge assignment
router.put('/:id/badges', auth(['admin', 'superadmin']), ctrl.assignBadge);
// Influencer ad posts
router.post('/:id/ads', auth(['influencer','admin']), require('../controllers/influencerPostsController').createInfluencerAdPost);
router.get('/:id/feed', require('../controllers/influencerPostsController').influencerFeed);
// Public: all influencer ads/posts
router.get('/ads', require('../controllers/influencerPostsController').publicAds);
// Public: canonical influencer ad media (videos)
router.get('/ads/media', require('../controllers/mediaController').listInfluencerAdMedia);
// Auth: canonical influencer ad media (videos) for logged-in influencer
router.get('/me/ads/media', auth(['influencer']), require('../controllers/mediaController').listMyInfluencerAdMedia);
// Self ad post video via ULID
// Redesigned flow (preferred): init (JSON) + upload (PUT octet-stream), avoids multipart boundary issues on Windows/PowerShell
router.post('/me/ads/video/init', auth(['influencer']), require('../controllers/postsController').initAdVideoMe);
router.put('/me/ads/video/:guid/upload', auth(['influencer']), require('../controllers/postsController').uploadAdVideoMe);
router.delete('/me/ads/video/:guid', auth(['influencer']), require('../controllers/bunnyController').deleteMyVideo);
router.post('/me/ads/video', auth(['influencer']), multipartBoundaryFix, upload.single('file'), require('../controllers/postsController').createPostVideoMe);
module.exports = router;
