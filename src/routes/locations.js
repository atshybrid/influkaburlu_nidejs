const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/locationsController');

router.get('/countries', ctrl.countries);
router.get('/states', ctrl.states);
router.get('/districts', ctrl.districts);

module.exports = router;