/**
 * Public Feed Routes
 * 
 * Public API endpoints for mobile app video feed
 * No authentication required
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicFeedController');

/**
 * @route GET /api/public/feed/videos
 * @description Get paginated video feed for swipe-to-next UX
 * @query cursor - Base64 cursor for pagination
 * @query limit - Items per page (1-50, default: 10)
 * @query category - Filter by category code
 * @query language - Filter by language code
 * @query state - Filter by state code
 * @query shuffle - "true" for randomized feed
 * @access Public
 */
router.get('/videos', ctrl.getVideoFeed);

/**
 * @route GET /api/public/feed/videos/:videoId
 * @description Get single video by ULID (for deep linking)
 * @param videoId - Video ULID
 * @access Public
 */
router.get('/videos/:videoId', ctrl.getVideoById);

/**
 * @route GET /api/public/feed/influencers/:influencerId/videos
 * @description Get all videos from a specific influencer
 * @param influencerId - Influencer ULID
 * @query cursor - Base64 cursor for pagination
 * @query limit - Items per page (1-50, default: 10)
 * @access Public
 */
router.get('/influencers/:influencerId/videos', ctrl.getInfluencerVideos);

module.exports = router;
