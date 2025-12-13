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
const bunnyCtrl = require('../controllers/bunnyController');
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

// Bunny admin/public
router.get('/admin/bunny/videos', requireAuth(['admin']), bunnyCtrl.adminListVideos);
router.get('/admin/bunny/media/status-counts', requireAuth(['admin']), bunnyCtrl.mediaStatusCounts);
router.get('/posts/:idUlid/playback', bunnyCtrl.postPlayback);
router.get('/bunny/videos/:guid/status', bunnyCtrl.videoStatus);

router.get('/', (req,res)=> res.json({ ok: true, version: 'kaburlu-backend-v2' }));

module.exports = router;
