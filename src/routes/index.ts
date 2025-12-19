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
const seo = require('./seo');
const pr = require('./pr');
const bunnyCtrl = require('../controllers/bunnyController');
const kycCtrl = require('../controllers/kycController');
const payCtrl = require('../controllers/paymentController');
const requireAuth = require('../middleware/auth');
const influencerCtrl = require('../controllers/influencerController');
const landingCtrl = require('../controllers/landingController');
const superadminCtrl = require('../controllers/superadminController');
const seoCtrl = require('../controllers/seoController');
const photoshootCtrl = require('../controllers/photoshootController');

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
router.use('/seo', seo);
router.use('/pr', pr);

// Public landing page
router.get('/public/influencers', influencerCtrl.publicLandingList);
router.get('/public/landing', landingCtrl.getLanding);
router.get('/public/trusted', landingCtrl.getTrusted);
router.get('/public/case-studies', landingCtrl.getCaseStudies);
router.get('/public/testimonials', landingCtrl.getTestimonials);

// Admin: landing content CRUD
router.get('/admin/landing', requireAuth(['admin', 'superadmin']), landingCtrl.adminList);
router.post('/admin/landing', requireAuth(['admin', 'superadmin']), landingCtrl.adminCreate);
router.get('/admin/landing/:key', requireAuth(['admin', 'superadmin']), landingCtrl.adminGet);
router.post('/admin/landing/:key', requireAuth(['admin', 'superadmin']), landingCtrl.adminCreateByKey);
router.put('/admin/landing/:key', requireAuth(['admin', 'superadmin']), landingCtrl.adminUpsert);
router.patch('/admin/landing/:key', requireAuth(['admin', 'superadmin']), landingCtrl.adminPatch);
router.delete('/admin/landing/:key', requireAuth(['admin', 'superadmin']), landingCtrl.adminDelete);

// Bunny admin/public
router.get('/admin/bunny/videos', requireAuth(['admin', 'superadmin']), bunnyCtrl.adminListVideos);
router.delete('/admin/bunny/videos/:guid', requireAuth(['admin', 'superadmin']), bunnyCtrl.adminDeleteVideo);
router.get('/admin/bunny/media/status-counts', requireAuth(['admin', 'superadmin']), bunnyCtrl.mediaStatusCounts);
// Admin KYC
router.get('/admin/kyc', requireAuth(['admin', 'superadmin']), kycCtrl.adminList);
router.get('/admin/kyc/:influencerId', requireAuth(['admin', 'superadmin']), kycCtrl.adminGet);
router.put('/admin/kyc/:influencerId/status', requireAuth(['admin', 'superadmin']), kycCtrl.adminSetStatus);
// Admin Payments
router.get('/admin/payments', requireAuth(['admin', 'superadmin']), payCtrl.adminList);
router.put('/admin/payments/:id/status', requireAuth(['admin', 'superadmin']), payCtrl.adminSetStatus);

// Superadmin dashboard
router.get('/superadmin/dashboard', requireAuth(['superadmin']), superadminCtrl.dashboard);

// Superadmin: PR management
router.post('/superadmin/prs', requireAuth(['superadmin']), superadminCtrl.createPrUser);
router.post('/superadmin/brands/:brandUlid/pr', requireAuth(['superadmin']), superadminCtrl.assignPrToBrand);

// Superadmin: PR commission admin
router.get('/superadmin/pr-commissions', requireAuth(['superadmin']), superadminCtrl.listPrCommissions);
router.put('/superadmin/pr-commissions/:id/paid', requireAuth(['superadmin']), superadminCtrl.markPrCommissionPaid);

// Superadmin: referral commission admin
router.get('/superadmin/referral-commissions', requireAuth(['superadmin']), superadminCtrl.listReferralCommissions);
router.put('/superadmin/referral-commissions/:id/paid', requireAuth(['superadmin']), superadminCtrl.markReferralCommissionPaid);

// Superadmin: photoshoot requests
router.get('/superadmin/photoshoots/requests', requireAuth(['superadmin']), photoshootCtrl.adminList);
router.get('/superadmin/photoshoots/requests/:ulid', requireAuth(['superadmin']), photoshootCtrl.adminGet);
router.put('/superadmin/photoshoots/requests/:ulid/approve', requireAuth(['superadmin']), photoshootCtrl.adminApprove);
router.put('/superadmin/photoshoots/requests/:ulid/reject', requireAuth(['superadmin']), photoshootCtrl.adminReject);
router.put('/superadmin/photoshoots/requests/:ulid/schedule', requireAuth(['superadmin']), photoshootCtrl.adminSchedule);

// Admin: SEO management
router.put('/admin/seo/influencer/:id', requireAuth(['admin', 'superadmin']), seoCtrl.adminUpsertInfluencerSeo);
router.put('/admin/seo/page/:slug', requireAuth(['admin', 'superadmin']), seoCtrl.adminUpsertPageSeo);
router.get('/posts/:idUlid/playback', bunnyCtrl.postPlayback);
router.get('/bunny/videos/:guid/status', bunnyCtrl.videoStatus);

router.get('/', (req,res)=> res.json({ ok: true, version: 'kaburlu-backend-v2' }));

module.exports = router;
