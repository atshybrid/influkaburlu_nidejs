const { Country, State, District } = require('../models');

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