const { Influencer, User, Country, State, District } = require('../models');

exports.me = async (req, res) => {
  const infl = await Influencer.findOne({ where: { userId: req.user.id } });
  if (!infl) return res.status(404).json({ error: 'not found' });
  let countryName = null;
  let stateName = null;
  let districtName = null;
  let stateNames = [];
  try {
    if (infl.countryId) {
      const c = await Country.findByPk(infl.countryId);
      countryName = c?.name || null;
    }
    if (infl.stateId) {
      const s = await State.findByPk(infl.stateId);
      stateName = s?.name || null;
    }
    if (Array.isArray(infl.stateIds) && infl.stateIds.length) {
      const rows = await State.findAll({ where: { id: infl.stateIds } });
      stateNames = rows.map(r => r.name).filter(Boolean);
    }
    if (infl.districtId) {
      const d = await District.findByPk(infl.districtId);
      districtName = d?.name || null;
    }
  } catch (_) {}
  const response = {
    ...infl.toJSON(),
    location: {
      country: infl.countryId || null,
      countryName,
      state: infl.stateId || null,
      stateName,
      stateIds: infl.stateIds || [],
      stateNames,
      district: infl.districtId || null,
      districtName
    }
  };
  res.json(response);
};

exports.dashboard = async (req, res) => {
  const userId = req.user.id;
  try {
    const infl = await Influencer.findOne({ where: { userId } });
    if (!infl) return res.status(404).json({ error: 'not found' });

    // Lightweight aggregates; replace with real queries if models exist
    const metrics = {
      activeBriefs: 3,
      pendingApprovals: 2,
      earningsMonth: 1280,
      nextPayout: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    };

    const today = new Date();
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { date: iso, hasTask: i % 3 === 0 };
    });

    const items = [
      { campaign: 'Acme Fitness', type: 'TikTok + Stories', due: days[8].date, status: 'In progress' },
      { campaign: 'Glow Cosmetics', type: 'UGC video', due: days[3].date, status: 'Pending approval' },
      { campaign: 'Neo Tech', type: 'Instagram Reel', due: days[12].date, status: 'Assigned' }
    ];

    const payouts = {
      history: [
        { month: 'Nov', amount: 980, status: 'Paid' },
        { month: 'Oct', amount: 1120, status: 'Paid' },
        { month: 'Sep', amount: 870, status: 'Paid' }
      ],
      nextPayout: metrics.nextPayout
    };

    res.json({
      influencer: { id: infl.id, handle: infl.handle, verificationStatus: infl.verificationStatus, badges: infl.badges || [] },
      metrics,
      calendar: { days },
      briefs: { items },
      payouts
    });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
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

// Admin can assign verification/badges to any influencer
exports.assignBadge = async (req, res) => {
  const { id } = req.params;
  const { verificationStatus, badges } = req.body;
  const infl = await Influencer.findByPk(id);
  if (!infl) return res.status(404).json({ error: 'not found' });
  if (verificationStatus) infl.verificationStatus = verificationStatus;
  if (Array.isArray(badges)) infl.badges = badges;
  await infl.save();
  res.json(infl);
};
