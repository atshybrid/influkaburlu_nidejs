const express = require('express');
const router = express.Router();
const { searchInfluencers } = require('../controllers/discoveryController');

router.get('/influencers', searchInfluencers);

module.exports = router;