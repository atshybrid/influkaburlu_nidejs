const { Country, State, District } = require('../models');
const csv = require('csv-parse/sync');

exports.countries = async (req, res) => {
  const rows = await Country.findAll({ order: [['name','ASC']] });
  res.json(rows);
};

exports.states = async (req, res) => {
  const { countryId } = req.query;
  const where = countryId ? { countryId } : {};
  const rows = await State.findAll({ where, order: [['name','ASC']] });
  res.json(rows);
};

exports.districts = async (req, res) => {
  const { stateId } = req.query;
  const where = stateId ? { stateId } : {};
  const rows = await District.findAll({ where, order: [['name','ASC']] });
  res.json(rows);
};

exports.bulkStates = async (req, res) => {
  try {
    if (!req.files || !req.files.file) return res.status(400).json({ error: 'CSV file is required' });
    const file = req.files.file;
    const records = csv.parse(file.data, { columns: true, skip_empty_lines: true });
    let created = 0, updated = 0;
    for (const r of records) {
      const countryId = parseInt(r.countryId || r.country_id, 10);
      const name = (r.name || '').trim();
      if (!countryId || !name) continue;
      const [row, isCreated] = await State.findOrCreate({ where: { name, countryId }, defaults: { name, countryId } });
      if (isCreated) created++; else { await row.update({ name, countryId }); updated++; }
    }
    res.json({ created, updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.bulkDistricts = async (req, res) => {
  try {
    if (!req.files || !req.files.file) return res.status(400).json({ error: 'CSV file is required' });
    const file = req.files.file;
    const records = csv.parse(file.data, { columns: true, skip_empty_lines: true });
    let created = 0, updated = 0;
    for (const r of records) {
      const stateId = parseInt(r.stateId || r.state_id, 10);
      const name = (r.name || '').trim();
      if (!stateId || !name) continue;
      const [row, isCreated] = await District.findOrCreate({ where: { name, stateId }, defaults: { name, stateId } });
      if (isCreated) created++; else { await row.update({ name, stateId }); updated++; }
    }
    res.json({ created, updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
};