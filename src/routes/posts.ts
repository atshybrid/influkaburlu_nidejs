const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createPost, listFeed, getPost, createPostVideo } = require('../controllers/postsController');

router.post('/', auth(['influencer','admin','brand']), createPost);
router.get('/feed', listFeed);
router.get('/:idUlid', getPost);
router.post('/:idUlid/video', auth(['influencer','admin','brand']), createPostVideo);

module.exports = router;