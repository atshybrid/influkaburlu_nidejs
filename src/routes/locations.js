const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/locationsController');
const auth = require('../middleware/auth');

router.get('/countries', ctrl.countries);
router.get('/states', ctrl.states);
router.get('/districts', ctrl.districts);

// Bulk upload (CSV) restricted to admin/superadmin
router.post('/bulk/states', auth(['admin','superadmin']), ctrl.bulkStates);
router.post('/bulk/districts', auth(['admin','superadmin']), ctrl.bulkDistricts);

module.exports = router;