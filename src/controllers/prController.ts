const { BrandMember, Brand, Ad, PrCommission } = require('../models');
const { Op } = require('sequelize');

async function requirePrMembership(userId, brandId) {
  if (!userId || !brandId) return null;
  return BrandMember.findOne({ where: { userId, brandId, memberRole: 'pr' } });
}

exports.listMyBrands = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await BrandMember.findAll({
      where: { userId, memberRole: 'pr' },
      include: [{ model: Brand }],
      order: [['isPrimary', 'DESC'], ['createdAt', 'DESC']],
    });

    const items = rows
      .map(r => {
        const b = r.Brand;
        return {
          membership: {
            id: r.id,
            memberRole: r.memberRole,
            isPrimary: Boolean(r.isPrimary),
            createdAt: r.createdAt,
          },
          brand: b
            ? {
                id: b.id,
                ulid: b.ulid,
                companyName: b.companyName || null,
                name: b.name || null,
              }
            : null,
        };
      })
      .filter(x => x.brand);

    return res.json({ total: items.length, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.listBrandAds = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const brandUlid = String(req.params.brandUlid || '').trim();
    if (!brandUlid) return res.status(400).json({ error: 'brand_ulid_required' });

    const brand = await Brand.findOne({ where: { ulid: brandUlid } });
    if (!brand) return res.status(404).json({ error: 'brand_not_found' });

    const member = await requirePrMembership(userId, brand.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const total = await Ad.count({ where: { brandId: brand.id } });
    const rows = await Ad.findAll({
      where: { brandId: brand.id },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const items = rows.map(a => ({
      id: a.id,
      idUlid: a.ulid,
      brandId: a.brandId,
      title: a.title || null,
      description: a.description || null,
      language: a.language || null,
      targetStates: Array.isArray(a.targetStates) ? a.targetStates : (a.targetStates || []),
      budget: a.budget != null ? Number(a.budget) : null,
      payPerInfluencer: a.payPerInfluencer != null ? Number(a.payPerInfluencer) : null,
      categories: Array.isArray(a.categories) ? a.categories : (a.categories || []),
      deliverables: Array.isArray(a.deliverables) ? a.deliverables : (a.deliverables || []),
      briefUrl: a.briefUrl || null,
      budgetPaid: Boolean(a.budgetPaid),
      status: a.status || null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));

    return res.json({ brand: { id: brand.id, ulid: brand.ulid, companyName: brand.companyName || null }, total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.getAd = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const ad = await Ad.findByPk(id);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const brand = await Brand.findOne({ where: { id: ad.brandId } });
    if (!brand) return res.status(404).json({ error: 'brand_not_found' });

    const member = await requirePrMembership(userId, brand.id);
    if (!member) return res.status(403).json({ error: 'Forbidden' });

    return res.json({
      ...ad.toJSON(),
      idUlid: ad.ulid,
      brand: { id: brand.id, ulid: brand.ulid, companyName: brand.companyName || null },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.listMyCommissions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const status = req.query.status ? String(req.query.status) : null;

    const where = { prUserId: userId };
    const where2 = status ? { ...where, status } : where;

    const total = await PrCommission.count({ where: where2 });
    const rows = await PrCommission.findAll({
      where: where2,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const brandIds = Array.from(new Set(rows.map(r => r.brandId).filter(Boolean)));
    const brands = brandIds.length
      ? await Brand.findAll({ where: { id: { [Op.in]: brandIds } }, attributes: ['id', 'ulid', 'companyName', 'name'] })
      : [];
    const brandById = new Map(brands.map((b) => [b.id, b]));

    const items = rows.map(r => {
      const b = (brandById.get(r.brandId) || null);
      return {
        id: r.id,
        amount: Number(r.amount || 0),
        status: r.status,
        brandId: r.brandId,
        brand: b ? { id: (b as any).id, ulid: (b as any).ulid, companyName: (b as any).companyName || null, name: (b as any).name || null } : null,
        adId: r.adId || null,
        applicationId: r.applicationId || null,
        payoutId: r.payoutId || null,
        meta: r.meta || {},
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return res.json({ total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
