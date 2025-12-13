const express = require('express');
const router = express.Router();
const { brandDashboard } = require('../controllers/brandController');
const auth = require('../middleware/auth');

// Brand dashboard aggregates
router.get('/dashboard', auth(['brand']), brandDashboard);

module.exports = router;
