const { User, Influencer, Brand, Ad, Application, Payout, InfluencerKyc, ReferralCommission, Role, UserRole, BrandMember, PrCommission } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

async function ensureRole(key, name, description) {
  const [role] = await Role.findOrCreate({
    where: { key },
    defaults: { key, name, description: description || null, isSystem: true },
  });
  return role;
}

async function ensureUserHasRole(userId, roleKey) {
  const role = await ensureRole(roleKey, roleKey.toUpperCase(), null);
  await UserRole.findOrCreate({ where: { userId, roleId: role.id }, defaults: { userId, roleId: role.id } });
  return role;
}

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

// Superadmin: create/hire a PR user (assigns Role=pr)
exports.createPrUser = async (req, res) => {
  try {
    const { name, phone, email, password } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone_required' });
    if (!password) return res.status(400).json({ error: 'password_required' });

    const rolePr = await ensureRole('pr', 'PR', 'Public Relation');

    let user = await User.findOne({ where: { phone: String(phone) } });
    if (!user && email) {
      const existingEmail = await User.findOne({ where: { email: String(email) } });
      if (existingEmail) return res.status(409).json({ error: 'email_in_use' });
    }

    if (!user) {
      const passwordHash = await bcrypt.hash(String(password), 10);
      user = await User.create({
        name: name || 'PR',
        phone: String(phone),
        email: email || null,
        passwordHash,
        role: 'admin',
      });
    }

    await UserRole.findOrCreate({ where: { userId: user.id, roleId: rolePr.id }, defaults: { userId: user.id, roleId: rolePr.id } });

    return res.json({
      ok: true,
      pr: {
        id: user.id,
        ulid: user.ulid || null,
        name: user.name || null,
        phone: user.phone || null,
        email: user.email || null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Superadmin: grant PR access to a Brand (brand-scoped)
exports.assignPrToBrand = async (req, res) => {
  try {
    const brandUlid = String(req.params.brandUlid || '');
    if (!brandUlid) return res.status(400).json({ error: 'brand_ulid_required' });
    const { prUserId, prUserUlid, prPhone, isPrimary = true } = req.body || {};

    const brand = await Brand.findOne({ where: { ulid: brandUlid } });
    if (!brand) return res.status(404).json({ error: 'brand_not_found' });

    let prUser = null;
    if (prUserId) prUser = await User.findByPk(parseInt(String(prUserId), 10));
    else if (prUserUlid) prUser = await User.findOne({ where: { ulid: String(prUserUlid) } });
    else if (prPhone) prUser = await User.findOne({ where: { phone: String(prPhone) } });
    if (!prUser) return res.status(404).json({ error: 'pr_user_not_found' });

    await ensureUserHasRole(prUser.id, 'pr');

    if (Boolean(isPrimary)) {
      await BrandMember.update(
        { isPrimary: false },
        { where: { brandId: brand.id, memberRole: 'pr', isPrimary: true, userId: { [Op.ne]: prUser.id } } }
      );
    }

    const [row] = await BrandMember.findOrCreate({
      where: { brandId: brand.id, userId: prUser.id },
      defaults: {
        brandId: brand.id,
        userId: prUser.id,
        memberRole: 'pr',
        isPrimary: Boolean(isPrimary),
        createdByUserId: req.user?.id || null,
        meta: {},
      },
    });

    if (row.memberRole !== 'pr' || row.isPrimary !== Boolean(isPrimary)) {
      row.memberRole = 'pr';
      row.isPrimary = Boolean(isPrimary);
      row.createdByUserId = row.createdByUserId || (req.user?.id || null);
      await row.save();
    }

    return res.json({
      ok: true,
      brand: { id: brand.id, ulid: brand.ulid, companyName: brand.companyName || null },
      pr: { id: prUser.id, ulid: prUser.ulid || null, name: prUser.name || null, phone: prUser.phone || null },
      membership: { id: row.id, memberRole: row.memberRole, isPrimary: row.isPrimary },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Superadmin: create a DOP user (Director of Photography)
exports.createDopUser = async (req, res) => {
  try {
    const { name, phone, email, password, force } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone_required' });
    if (!password) return res.status(400).json({ error: 'password_required' });

    // Optional: track as a system role entry, like PR
    try {
      await ensureRole('dop', 'DOP', 'Director of Photography');
    } catch (_) {
      // ignore if Roles table isn't ready
    }

    let user = await User.findOne({ where: { phone: String(phone) } });
    if (!user && email) {
      const existingEmail = await User.findOne({ where: { email: String(email) } });
      if (existingEmail) return res.status(409).json({ error: 'email_in_use' });
    }

    if (user) {
      // If user already exists, do NOT overwrite credentials.
      // Also avoid accidental role changes unless explicitly forced.
      if (String(user.role) !== 'dop' && force !== true) {
        return res.status(409).json({
          error: 'user_exists_with_role',
          message: 'User with this phone already exists. Pass { force: true } to convert to dop role.',
          existingRole: user.role,
          userId: user.id,
        });
      }

      if (String(user.role) !== 'dop') {
        user.role = 'dop';
      }
      if (!user.name && name) user.name = String(name);
      if (!user.email && email) user.email = String(email);
      await user.save();
    } else {
      const passwordHash = await bcrypt.hash(String(password), 10);
      let newUlid = null;
      try {
        const { ulid } = require('ulid');
        newUlid = ulid();
      } catch (_) {}
      user = await User.create({
        ulid: newUlid,
        name: name || 'DOP',
        phone: String(phone),
        email: email || null,
        passwordHash,
        role: 'dop',
      });
    }

    return res.json({
      ok: true,
      dop: {
        id: user.id,
        ulid: user.ulid || null,
        name: user.name || null,
        phone: user.phone || null,
        email: user.email || null,
        role: user.role,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Superadmin: list DOP users
exports.listDops = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const q = String(req.query.q || '').trim();

    const where: any = { role: 'dop' };
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { phone: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const total = await User.count({ where });
    const rows = await User.findAll({ where, order: [['createdAt', 'DESC']], limit, offset });

    return res.json({
      ok: true,
      total,
      limit,
      offset,
      items: rows.map((u) => ({
        id: u.id,
        ulid: u.ulid || null,
        name: u.name || null,
        phone: u.phone || null,
        email: u.email || null,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Superadmin: convert an existing user to DOP by userId (explicit target, no credential changes)
exports.convertUserToDop = async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId || ''), 10);
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'invalid_userId' });

    const { confirm, name, email } = req.body || {};
    if (confirm !== true) {
      return res.status(400).json({ error: 'confirm_required', hint: 'Pass { confirm: true } to proceed.' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    // Optional: track as a system role entry
    try {
      await ensureRole('dop', 'DOP', 'Director of Photography');
    } catch (_) {}

    if (email !== undefined && email !== null && String(email).trim()) {
      const nextEmail = String(email).trim();
      if (nextEmail !== user.email) {
        const existing = await User.findOne({ where: { email: nextEmail, id: { [Op.ne]: user.id } } });
        if (existing) return res.status(409).json({ error: 'email_in_use' });
      }
      user.email = nextEmail;
    }
    if (name !== undefined && name !== null && String(name).trim()) {
      user.name = String(name).trim();
    }

    user.role = 'dop';
    await user.save();

    return res.json({
      ok: true,
      dop: {
        id: user.id,
        ulid: user.ulid || null,
        name: user.name || null,
        phone: user.phone || null,
        email: user.email || null,
        role: user.role,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Superadmin: list PR commissions
exports.listPrCommissions = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const total = await PrCommission.count();
    const rows = await PrCommission.findAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const userIds = Array.from(new Set(rows.map(r => r.prUserId).filter(Boolean)));
    const users = userIds.length ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'ulid', 'name', 'phone', 'email'] }) : [];
    const userById = new Map(users.map(u => [u.id, u]));

    const items = rows.map(r => {
      const u: any = userById.get(r.prUserId) || null;
      return {
        id: r.id,
        amount: Number(r.amount || 0),
        status: r.status,
        brandId: r.brandId,
        adId: r.adId || null,
        applicationId: r.applicationId || null,
        payoutId: r.payoutId || null,
        prUser: u ? { id: u.id, ulid: u.ulid || null, name: u.name || null, phone: u.phone || null, email: u.email || null } : null,
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

// Superadmin: mark PR commission as paid
exports.markPrCommissionPaid = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });

    const row = await PrCommission.findByPk(id);
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (row.status !== 'paid') {
      row.status = 'paid';
      const prevMeta = row.meta && typeof row.meta === 'object' ? row.meta : {};
      row.meta = { ...prevMeta, paidAt: new Date().toISOString(), paidByUserId: req.user?.id || null };
      await row.save();
    }

    return res.json({
      ok: true,
      commission: {
        id: row.id,
        amount: Number(row.amount || 0),
        status: row.status,
        prUserId: row.prUserId,
        brandId: row.brandId,
        adId: row.adId || null,
        applicationId: row.applicationId || null,
        payoutId: row.payoutId || null,
        meta: row.meta || {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
