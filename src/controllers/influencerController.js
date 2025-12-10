const { Influencer, User } = require('../models');

exports.me = async (req, res) => {
  const infl = await Influencer.findOne({ where: { userId: req.user.id } });
  res.json(infl);
};

exports.update = async (req, res) => {
  const infl = await Influencer.findOne({ where: { userId: req.user.id } });
  if (!infl) return res.status(404).json({ error: 'not found' });
  const body = { ...req.body };
  // Prefer stateIds over stateId/states to avoid duplication
  if (Array.isArray(body.stateIds) && body.stateIds.length > 0) {
    delete body.stateId;
    delete body.states;
  }
  Object.assign(infl, body);
  await infl.save();
  res.json(infl);
};
