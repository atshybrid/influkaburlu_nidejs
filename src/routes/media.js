const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/mediaController');

router.post('/upload', auth(['influencer','brand','admin']), ctrl.upload);

module.exports = router;
