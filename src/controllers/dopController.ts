const { User, Influencer, PhotoshootRequest } = require('../models');
const { Op } = require('sequelize');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

exports.me = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findByPk(userId, { attributes: ['id', 'ulid', 'name', 'email', 'phone', 'role', 'createdAt', 'updatedAt'] });
    if (!user) return res.status(404).json({ error: 'not_found' });

    return res.json({
      ok: true,
      dop: {
        id: user.id,
        ulid: user.ulid || null,
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, email } = req.body || {};

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'not_found' });

    if (isNonEmptyString(name)) user.name = String(name).trim();

    if (email !== undefined) {
      const nextEmail = isNonEmptyString(email) ? String(email).trim() : null;
      if (nextEmail && nextEmail !== user.email) {
        const existing = await User.findOne({ where: { email: nextEmail, id: { [Op.ne]: user.id } } });
        if (existing) return res.status(409).json({ error: 'email_in_use' });
      }
      user.email = nextEmail;
    }

    await user.save();

    return res.json({
      ok: true,
      dop: {
        id: user.id,
        ulid: user.ulid || null,
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        role: user.role,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.dashboard = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const now = new Date();
    const upcomingWindowDays = Math.min(Math.max(parseInt(req.query.upcomingDays || '14', 10) || 14, 1), 60);
    const windowEnd = new Date(now.getTime() + upcomingWindowDays * 24 * 60 * 60 * 1000);

    const rows = await PhotoshootRequest.findAll({ where: { dopUserId: userId } });

    const influencerIds = Array.from(new Set(rows.map((r) => r.influencerId).filter(Boolean)));
    const influencers: any[] = influencerIds.length
      ? await Influencer.findAll({
          where: { id: { [Op.in]: influencerIds } },
          include: [{ model: User, attributes: ['id', 'name', 'phone', 'email'] }],
        })
      : [];
    const influencerById: Map<number, any> = new Map(influencers.map((i: any) => [i.id, i]));

    const toInfluencerSummary = (influencerId: number) => {
      const i: any = influencerById.get(influencerId) || null;
      if (!i) return null;
      return {
        id: i.id,
        ulid: i.ulid || null,
        handle: i.handle || null,
        user: {
          id: i.User?.id || null,
          name: i.User?.name || null,
          phone: i.User?.phone || null,
          email: i.User?.email || null,
        },
      };
    };

    const byStatus = {};
    for (const r of rows) {
      const s = String(r.status || 'unknown');
      byStatus[s] = (byStatus[s] || 0) + 1;
    }

    const upcoming = rows
      .filter((r) => r.scheduledStartAt && new Date(r.scheduledStartAt) >= now && new Date(r.scheduledStartAt) <= windowEnd)
      .sort((a, b) => new Date(a.scheduledStartAt).getTime() - new Date(b.scheduledStartAt).getTime())
      .slice(0, 20)
      .map((r) => ({
        ulid: r.ulid,
        status: r.status,
        influencerId: r.influencerId,
        influencer: toInfluencerSummary(r.influencerId),
        scheduledStartAt: r.scheduledStartAt,
        scheduledEndAt: r.scheduledEndAt,
        scheduledTimezone: r.scheduledTimezone,
        location: r.location || {},
      }));

    const recent = rows
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 20)
      .map((r) => ({
        ulid: r.ulid,
        status: r.status,
        influencerId: r.influencerId,
        influencer: toInfluencerSummary(r.influencerId),
        updatedAt: r.updatedAt,
      }));

    return res.json({
      ok: true,
      time: now.toISOString(),
      counts: {
        totalAssigned: rows.length,
        byStatus,
        upcomingWindowDays,
      },
      upcoming,
      recent,
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
