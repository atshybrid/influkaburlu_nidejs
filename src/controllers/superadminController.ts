const { User, Influencer, Brand, Ad, Application, Payout, InfluencerKyc, ReferralCommission } = require('../models');
const { Op } = require('sequelize');

exports.dashboard = async (req, res) => {
  try {
    const [
      usersTotal,
      influencersTotal,
      brandsTotal,
      adsTotal,
      applicationsTotal,
      payoutsTotal,
      pendingKycTotal,
    ] = await Promise.all([
      User.count(),
      Influencer.count(),
      Brand.count(),
      Ad.count(),
      Application.count(),
      Payout.count(),
      InfluencerKyc ? InfluencerKyc.count({ where: { status: 'pending' } }) : 0,
    ]);

    return res.json({
      ok: true,
      time: new Date().toISOString(),
      counts: {
        usersTotal,
        influencersTotal,
        brandsTotal,
        adsTotal,
        applicationsTotal,
        payoutsTotal,
        pendingKycTotal,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.listReferralCommissions = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const total = await ReferralCommission.count();
    const rows = await ReferralCommission.findAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const influencerIds = Array.from(
      new Set(
        rows
          .flatMap(r => [r.referrerInfluencerId, r.sourceInfluencerId])
          .filter(Boolean)
      )
    );

    const influencers = influencerIds.length
      ? await Influencer.findAll({
          where: { id: { [Op.in]: influencerIds } },
          include: [{ model: User, attributes: ['name'] }],
        })
      : [];
    const influencerById = new Map(influencers.map(i => [i.id, i]));

    const items = rows.map(r => {
      const ref: any = influencerById.get(r.referrerInfluencerId) || null;
      const src: any = influencerById.get(r.sourceInfluencerId) || null;
      return {
        id: r.id,
        amount: Number(r.amount || 0),
        status: r.status,
        payoutId: r.payoutId || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        referrerInfluencer: ref
          ? {
              influencerIdUlid: ref.ulid,
              handle: ref.handle || null,
              name: ref.User?.name || null,
            }
          : null,
        sourceInfluencer: src
          ? {
              influencerIdUlid: src.ulid,
              handle: src.handle || null,
              name: src.User?.name || null,
            }
          : null,
      };
    });

    return res.json({ total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.markReferralCommissionPaid = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const row = await ReferralCommission.findByPk(id);
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (row.status !== 'paid') {
      row.status = 'paid';
      const prevMeta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      row.meta = {
        ...prevMeta,
        paidAt: new Date().toISOString(),
        paidByUserId: req.user?.id || null,
      };
      await row.save();
    }

    return res.json({
      ok: true,
      commission: {
        id: row.id,
        amount: Number(row.amount || 0),
        status: row.status,
        payoutId: row.payoutId || null,
        referrerInfluencerId: row.referrerInfluencerId,
        sourceInfluencerId: row.sourceInfluencerId,
        meta: row.meta || {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
