const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/categoriesController');

// Public: list categories
router.get('/', ctrl.list);

module.exports = router;
