const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/locationsController');
const auth = require('../middleware/auth');
const fileUpload = require('../middleware/fileUpload');

router.get('/countries', ctrl.countries);
router.get('/states', ctrl.states);
router.get('/districts', ctrl.districts);
router.get('/languages', async (req, res) => {
	try {
		const db = require('../models');
		const items = await db.Language.findAll({ order: [['name','ASC']] });
		res.json(items.map(l => ({ code: l.code, name: l.name })));
	} catch (e) { res.status(500).json({ error: 'Server error', details: e.message }); }
});

// Bulk upload (CSV) restricted to admin/superadmin
router.post('/bulk/states', auth(['admin','superadmin']), fileUpload, ctrl.bulkStates);
router.post('/bulk/districts', auth(['admin','superadmin']), fileUpload, ctrl.bulkDistricts);

module.exports = router;