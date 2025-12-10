const express = require('express');
const router = express.Router();
const auth = require('./auth');
const ads = require('./ads');
const influencers = require('./influencers');
const applications = require('./applications');
const profile = require('./profile');
const locations = require('./locations');
const media = require('./media');

router.use('/auth', auth);
router.use('/ads', ads);
router.use('/influencers', influencers);
router.use('/applications', applications);
router.use('/profile-builder', profile);
router.use('/locations', locations);
router.use('/media', media);

router.get('/', (req,res)=> res.json({ ok: true, version: 'kaburlu-backend-v2' }));

module.exports = router;
