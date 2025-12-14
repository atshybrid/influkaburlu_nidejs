const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/mediaController');
const fileUpload = require('../middleware/fileUpload');

router.post('/upload', auth(['influencer','brand','admin']), fileUpload, ctrl.upload);

module.exports = router;
