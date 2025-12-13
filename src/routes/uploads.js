const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { signR2ImageUpload, createBunnyVideo } = require('../controllers/uploadsController');

router.post('/r2/sign', auth(['influencer','brand','admin']), signR2ImageUpload);
router.post('/bunny/video', auth(['influencer','brand','admin']), createBunnyVideo);

module.exports = router;