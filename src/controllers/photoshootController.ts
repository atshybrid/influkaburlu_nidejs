const { PhotoshootRequest, Influencer, User } = require('../models');
const { Op } = require('sequelize');
const whatsappPhotoshoot = require('../services/sendWhatsappPhotoshoot');

function maskPhoneForLog(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const last4 = digits.slice(-4);
  const prefix = digits.length > 4 ? '*'.repeat(Math.min(digits.length - 4, 8)) : '';
  return `${prefix}${last4}`;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pickConsent(details) {
  const influencerAppointmentDetails = details?.influencerAppointmentDetails || details;
  return influencerAppointmentDetails?.consent || null;
}

function pickAppointmentDetails(details) {
  const influencerAppointmentDetails = details?.influencerAppointmentDetails || details;
  return influencerAppointmentDetails && typeof influencerAppointmentDetails === 'object' ? influencerAppointmentDetails : null;
}

function parseCsvEnv(name) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((s) => String(s).trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

function getBookingCity(details) {
  const ap = pickAppointmentDetails(details);
  const city = ap?.personal?.city || ap?.location?.city || null;
  return isNonEmptyString(city) ? String(city).trim() : null;
}

function getShootType(details) {
  const ap = pickAppointmentDetails(details);
  const shootType = ap?.shootPreferences?.shootType;
  if (!Array.isArray(shootType)) return [];
  return shootType.map((v) => String(v));
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isFinite(n)) return n;
  return null;
}

function normalizeBool(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === 'yes') return true;
    if (v === 'false' || v === 'no') return false;
  }
  return null;
}

function requireField(details, path, errorCode) {
  const ap = pickAppointmentDetails(details);
  const parts = String(path).split('.');
  let cur = ap;
  for (const p of parts) {
    cur = cur ? cur[p] : undefined;
  }
  if (cur === undefined || cur === null || (typeof cur === 'string' && !normalizeString(cur))) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  return cur;
}

function requireEnumValue(value, allowed, errorCode) {
  const v = normalizeString(value);
  if (!v) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  const ok = allowed.some((a) => String(a).toLowerCase() === v.toLowerCase());
  if (!ok) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  return v;
}

function requireBoolField(value, errorCode) {
  const b = normalizeBool(value);
  if (b === null) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  return b;
}

function requireNumberField(value, errorCode) {
  const n = normalizeNumber(value);
  if (n === null) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function requireStringArray(value, allowed, errorCode) {
  if (!Array.isArray(value) || value.length === 0) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  const vals = value.map((v) => normalizeString(v)).filter(Boolean);
  if (!vals.length) {
    const err: any = new Error(errorCode);
    err.statusCode = 400;
    throw err;
  }
  if (allowed && allowed.length) {
    const okAll = vals.every((v) => allowed.some((a) => String(a).toLowerCase() === String(v).toLowerCase()));
    if (!okAll) {
      const err: any = new Error(errorCode);
      err.statusCode = 400;
      throw err;
    }
  }
  return vals;
}

function requireBookingQuestionnaireFull(details) {
  if (!details || typeof details !== 'object') {
    const err: any = new Error('booking_requires_questionnaire');
    err.statusCode = 400;
    throw err;
  }

  // Must have consent.
  requireUsageConsent(details);

  const ap = pickAppointmentDetails(details);
  if (!ap) {
    const err: any = new Error('booking_requires_questionnaire');
    err.statusCode = 400;
    throw err;
  }

  // Physical & size details
  const gender = requireField(details, 'personal.gender', 'gender_required');
  requireEnumValue(gender, ['male', 'female', 'other'], 'gender_invalid');

  requireNumberField(requireField(details, 'bodyMeasurements.heightCm', 'height_required'), 'height_invalid');
  // Weight optional
  const weight = ap?.bodyMeasurements?.weightKg;
  if (weight !== undefined && weight !== null && weight !== '') {
    requireNumberField(weight, 'weight_invalid');
  }

  const bodyType = requireField(details, 'personal.bodyType', 'body_type_required');
  requireEnumValue(bodyType, ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus Size'], 'body_type_invalid');

  const skinTone = requireField(details, 'personal.skinTone', 'skin_tone_required');
  requireEnumValue(skinTone, ['Very Fair', 'Fair', 'Wheatish', 'Medium', 'Dusky', 'Dark'], 'skin_tone_invalid');

  // Dress sizes
  requireEnumValue(requireField(details, 'dressDetails.topSize', 'top_size_required'), ['XS', 'S', 'M', 'L', 'XL', 'XXL'], 'top_size_invalid');
  requireEnumValue(requireField(details, 'dressDetails.bottomSize', 'bottom_size_required'), ['XS', 'S', 'M', 'L', 'XL', 'XXL'], 'bottom_size_invalid');
  requireEnumValue(requireField(details, 'dressDetails.dressSize', 'dress_size_required'), ['XS', 'S', 'M', 'L', 'XL', 'XXL'], 'dress_size_invalid');
  requireNumberField(requireField(details, 'bodyMeasurements.shoeSize', 'shoe_size_required'), 'shoe_size_invalid');
  requireEnumValue(requireField(details, 'dressDetails.preferredFit', 'preferred_fit_required'), ['Slim', 'Regular', 'Loose'], 'preferred_fit_invalid');

  // Body measurements optional (but if provided, should be valid)
  const bm = ap?.bodyMeasurements || {};
  const optionalNums = [
    ['chestBustCm', 'chest_invalid'],
    ['waistCm', 'waist_invalid'],
    ['hipCm', 'hips_invalid'],
    ['shoulderWidthCm', 'shoulder_width_invalid'],
  ];
  for (const [k, errCode] of optionalNums) {
    const v = bm[k];
    if (v !== undefined && v !== null && v !== '') {
      requireNumberField(v, errCode);
    }
  }

  // Shoot style preferences
  requireStringArray(
    requireField(details, 'shootPreferences.shootStyle', 'shoot_style_required'),
    ['Professional', 'Lifestyle', 'Cinematic', 'Casual'],
    'shoot_style_invalid'
  );
  requireEnumValue(requireField(details, 'shootPreferences.poseComfortLevel', 'pose_comfort_required'), ['Normal', 'Confident', 'Expressive'], 'pose_comfort_invalid');

  // Dressing style selection
  const dressing = requireStringArray(
    requireField(details, 'dressDetails.preferredDressingStyle', 'preferred_dressing_style_required'),
    ['Traditional', 'Western', 'Casual', 'Formal', 'Ethnic Modern'],
    'preferred_dressing_style_invalid'
  );

  if (dressing.some((v) => String(v).toLowerCase() === 'traditional')) {
    requireStringArray(
      requireField(details, 'dressDetails.traditionalWearType', 'traditional_wear_type_required'),
      ['Saree', 'Kurta', 'Lehenga', 'Dhoti'],
      'traditional_wear_type_invalid'
    );
  }
  if (dressing.some((v) => String(v).toLowerCase() === 'western')) {
    requireStringArray(
      requireField(details, 'dressDetails.westernWearType', 'western_wear_type_required'),
      ['Jeans & Top', 'Dress / Gown', 'Suit / Blazer'],
      'western_wear_type_invalid'
    );
  }

  // Boldness & comfort level
  requireEnumValue(requireField(details, 'shootPreferences.boldnessLevel', 'boldness_level_required'), ['Normal', 'Semi-Bold', 'Bold'], 'boldness_level_invalid');
  requireBoolField(requireField(details, 'shootPreferences.sleevelessAllowed', 'sleeveless_allowed_required'), 'sleeveless_allowed_invalid');
  requireBoolField(requireField(details, 'shootPreferences.cameraFacingComfort', 'camera_facing_comfort_required'), 'camera_facing_comfort_invalid');

  // Color & look preferences
  requireStringArray(requireField(details, 'dressDetails.preferredOutfitColors', 'preferred_outfit_colors_required'), null, 'preferred_outfit_colors_invalid');
  requireEnumValue(requireField(details, 'stylingPermissions.makeupPreference', 'makeup_preference_required'), ['Natural', 'Glam', 'Heavy'], 'makeup_preference_invalid');
  requireBoolField(requireField(details, 'stylingPermissions.accessoriesAllowed', 'accessories_allowed_required'), 'accessories_allowed_invalid');

  // Usage & consent
  requireStringArray(
    requireField(details, 'editingAndUsage.usagePermission', 'usage_permission_required'),
    ['Website', 'Ads', 'Social Media', 'InfluKaburlu Website', 'Ads & Promotions', 'SEO & Google Indexing'],
    'usage_permission_invalid'
  );
  requireBoolField(requireField(details, 'editingAndUsage.photoshopBrandingAllowed', 'retouching_allowed_required'), 'retouching_allowed_invalid');
}

function requireBookingQuestionnaire(details) {
  // Backwards-compatible alias: booking now enforces the full question set.
  return requireBookingQuestionnaireFull(details);
}

function requireSlotAllowed(details, start, end) {
  const allowedCities = parseCsvEnv('PHOTOSHOOT_ALLOWED_CITIES');
  const city = getBookingCity(details);

  if (allowedCities && allowedCities.length) {
    if (!city) {
      const err: any = new Error('city_required_for_booking');
      err.statusCode = 400;
      throw err;
    }
    const ok = allowedCities.some((c) => c.toLowerCase() === city.toLowerCase());
    if (!ok) {
      const err: any = new Error('city_not_supported');
      err.statusCode = 400;
      throw err;
    }
  }

  // If this is a free studio shoot, enforce Indoor when provided.
  const shootType = getShootType(details);
  if (shootType.length) {
    const hasIndoor = shootType.some((t) => String(t).toLowerCase() === 'indoor');
    if (!hasIndoor) {
      const err: any = new Error('unsupported_shoot_type_for_free_studio');
      err.statusCode = 400;
      throw err;
    }
  }

  const leadHours = Math.max(parseInt(process.env.PHOTOSHOOT_MIN_LEAD_HOURS || '24', 10) || 24, 0);
  if (leadHours > 0) {
    const minStart = Date.now() + leadHours * 60 * 60 * 1000;
    if (start.getTime() < minStart) {
      const err: any = new Error('booking_too_soon');
      err.statusCode = 400;
      throw err;
    }
  }

  const durationMin = Math.floor((end.getTime() - start.getTime()) / 60000);
  const minDur = Math.max(parseInt(process.env.PHOTOSHOOT_MIN_DURATION_MINUTES || '30', 10) || 30, 1);
  const maxDur = Math.max(parseInt(process.env.PHOTOSHOOT_MAX_DURATION_MINUTES || '240', 10) || 240, minDur);

  if (durationMin < minDur) {
    const err: any = new Error('duration_too_short');
    err.statusCode = 400;
    throw err;
  }
  if (durationMin > maxDur) {
    const err: any = new Error('duration_too_long');
    err.statusCode = 400;
    throw err;
  }
}

function requireUsageConsent(details) {
  const consent = pickConsent(details);
  // Best-effort: treat publicDisplayConsent as the core permission for InfluKaburlu usage.
  const publicDisplayConsent = consent?.publicDisplayConsent === true;
  const termsAccepted = consent?.termsAccepted === true;
  const date = consent?.date || null;

  if (!termsAccepted) {
    const err: any = new Error('terms_not_accepted');
    err.statusCode = 400;
    throw err;
  }
  if (!publicDisplayConsent) {
    const err: any = new Error('photo_usage_consent_required');
    err.statusCode = 400;
    throw err;
  }

  return { publicDisplayConsent, termsAccepted, date };
}

async function getMeInfluencer(req) {
  const influencer = await Influencer.findOne({ where: { userId: req.user.id } });
  return influencer;
}

// Influencer: create/request a photoshoot
exports.createMe = async (req, res) => {
  try {
    const influencer = await getMeInfluencer(req);
    if (!influencer) return res.status(404).json({ error: 'influencer_not_found' });

    const details = req.body || {};
    requireUsageConsent(details);

    const row = await PhotoshootRequest.create({
      influencerId: influencer.id,
      status: 'pending',
      details,
    });

    // WhatsApp confirmation (best-effort)
    try {
      if (!whatsappPhotoshoot?.isWhatsAppConfigured?.()) {
        console.warn('WhatsApp photoshoot request-created skipped: WhatsApp not configured');
      } else {
        const user = await User.findOne({ where: { id: req.user.id } });
        const phone = user?.phone;
        if (!phone) {
          console.warn('WhatsApp photoshoot request-created skipped: missing user.phone', { userId: req.user?.id });
        } else {
          console.info('WhatsApp photoshoot request-created attempting send', {
            userId: req.user?.id,
            to: maskPhoneForLog(phone),
            template: process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_TEMPLATE_NAME || null,
            requestUlid: row.ulid
          });
          await whatsappPhotoshoot.sendPhotoshootRequestCreated({
            req,
            phone,
            influencerName: user?.name || influencer?.handle || 'Creator',
            requestUlid: row.ulid
          });
        }
      }
    } catch (e) {
      console.warn('WhatsApp photoshoot request-created send failed:', e?.code || e?.message || e, e?.provider || '');
    }

    return res.json({
      ok: true,
      request: {
        ulid: row.ulid,
        status: row.status,
        details: row.details,
        requestedStartAt: row.requestedStartAt,
        requestedEndAt: row.requestedEndAt,
        requestedTimezone: row.requestedTimezone,
        scheduledStartAt: row.scheduledStartAt,
        scheduledEndAt: row.scheduledEndAt,
        scheduledTimezone: row.scheduledTimezone,
        location: row.location || {},
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'server_error' });
  }
};

exports.listMe = async (req, res) => {
  try {
    const influencer = await getMeInfluencer(req);
    if (!influencer) return res.status(404).json({ error: 'influencer_not_found' });

    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const where = { influencerId: influencer.id };

    const total = await PhotoshootRequest.count({ where });
    const rows = await PhotoshootRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const items = rows.map((r) => ({
      ulid: r.ulid,
      status: r.status,
      requestedStartAt: r.requestedStartAt,
      requestedEndAt: r.requestedEndAt,
      requestedTimezone: r.requestedTimezone,
      scheduledStartAt: r.scheduledStartAt,
      scheduledEndAt: r.scheduledEndAt,
      scheduledTimezone: r.scheduledTimezone,
      location: r.location || {},
      rejectReason: r.rejectReason || null,
      adminNotes: r.adminNotes || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.json({ total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const influencer = await getMeInfluencer(req);
    if (!influencer) return res.status(404).json({ error: 'influencer_not_found' });

    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const row = await PhotoshootRequest.findOne({ where: { ulid, influencerId: influencer.id } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    return res.json({
      ok: true,
      request: {
        ulid: row.ulid,
        status: row.status,
        details: row.details,
        requestedStartAt: row.requestedStartAt,
        requestedEndAt: row.requestedEndAt,
        requestedTimezone: row.requestedTimezone,
        scheduledStartAt: row.scheduledStartAt,
        scheduledEndAt: row.scheduledEndAt,
        scheduledTimezone: row.scheduledTimezone,
        location: row.location || {},
        rejectReason: row.rejectReason || null,
        adminNotes: row.adminNotes || null,
        approvedAt: row.approvedAt || null,
        scheduledAt: row.scheduledAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

// Influencer: update details while pending
exports.updateMe = async (req, res) => {
  try {
    const influencer = await getMeInfluencer(req);
    if (!influencer) return res.status(404).json({ error: 'influencer_not_found' });

    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const row = await PhotoshootRequest.findOne({ where: { ulid, influencerId: influencer.id } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (!['pending'].includes(String(row.status))) {
      return res.status(409).json({ error: 'cannot_update_in_status', status: row.status });
    }

    const details = req.body || {};
    requireUsageConsent(details);

    row.details = details;
    await row.save();

    return res.json({ ok: true, request: { ulid: row.ulid, status: row.status, details: row.details, updatedAt: row.updatedAt } });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'server_error' });
  }
};

// Influencer: book/request a preferred appointment time (still needs superadmin approval/scheduling)
exports.bookMe = async (req, res) => {
  try {
    const influencer = await getMeInfluencer(req);
    if (!influencer) return res.status(404).json({ error: 'influencer_not_found' });

    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const row = await PhotoshootRequest.findOne({ where: { ulid, influencerId: influencer.id } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (!['pending'].includes(String(row.status))) {
      return res.status(409).json({ error: 'cannot_book_in_status', status: row.status });
    }

    const { requestedStartAt, requestedEndAt, requestedTimezone, location, details } = req.body || {};

    // Booking requires the questionnaire answers. Allow passing them here (or pre-fill via create/update).
    if (details && typeof details === 'object') {
      requireUsageConsent(details);
      row.details = details;
    }

    requireBookingQuestionnaire(row.details);

    if (!isNonEmptyString(requestedStartAt)) return res.status(400).json({ error: 'requestedStartAt_required' });
    if (!isNonEmptyString(requestedEndAt)) return res.status(400).json({ error: 'requestedEndAt_required' });

    const start = new Date(String(requestedStartAt));
    const end = new Date(String(requestedEndAt));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'invalid_datetime' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'end_must_be_after_start' });
    }

    requireSlotAllowed(row.details, start, end);

    row.requestedStartAt = start;
    row.requestedEndAt = end;
    row.requestedTimezone = isNonEmptyString(requestedTimezone) ? String(requestedTimezone) : null;
    if (location && typeof location === 'object') {
      row.location = location;
    }

    await row.save();

    return res.json({
      ok: true,
      request: {
        ulid: row.ulid,
        status: row.status,
        details: row.details,
        requestedStartAt: row.requestedStartAt,
        requestedEndAt: row.requestedEndAt,
        requestedTimezone: row.requestedTimezone,
        location: row.location || {},
        rejectReason: row.rejectReason || null,
        adminNotes: row.adminNotes || null,
        approvedAt: row.approvedAt || null,
        scheduledAt: row.scheduledAt || null,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'server_error' });
  }
};

// Influencer: book latest pending request (no ULID in path)
exports.bookLatestMe = async (req, res) => {
  try {
    const influencer = await getMeInfluencer(req);
    if (!influencer) return res.status(404).json({ error: 'influencer_not_found' });

    const row = await PhotoshootRequest.findOne({
      where: { influencerId: influencer.id, status: 'pending' },
      order: [['createdAt', 'DESC']],
    });

    if (!row) return res.status(404).json({ error: 'no_pending_request' });

    const { requestedStartAt, requestedEndAt, requestedTimezone, location, details } = req.body || {};

    // Booking requires the questionnaire answers. Allow passing them here (or pre-fill via create/update).
    if (details && typeof details === 'object') {
      requireUsageConsent(details);
      row.details = details;
    }

    requireBookingQuestionnaire(row.details);

    if (!isNonEmptyString(requestedStartAt)) return res.status(400).json({ error: 'requestedStartAt_required' });
    if (!isNonEmptyString(requestedEndAt)) return res.status(400).json({ error: 'requestedEndAt_required' });

    const start = new Date(String(requestedStartAt));
    const end = new Date(String(requestedEndAt));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'invalid_datetime' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'end_must_be_after_start' });
    }

    requireSlotAllowed(row.details, start, end);

    row.requestedStartAt = start;
    row.requestedEndAt = end;
    row.requestedTimezone = isNonEmptyString(requestedTimezone) ? String(requestedTimezone) : null;
    if (location && typeof location === 'object') {
      row.location = location;
    }

    await row.save();

    return res.json({
      ok: true,
      request: {
        ulid: row.ulid,
        status: row.status,
        details: row.details,
        requestedStartAt: row.requestedStartAt,
        requestedEndAt: row.requestedEndAt,
        requestedTimezone: row.requestedTimezone,
        location: row.location || {},
        rejectReason: row.rejectReason || null,
        adminNotes: row.adminNotes || null,
        approvedAt: row.approvedAt || null,
        scheduledAt: row.scheduledAt || null,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || 'server_error' });
  }
};

// Superadmin list + approve/schedule/reject
exports.adminList = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);

    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);

    const total = await PhotoshootRequest.count({ where });
    const rows = await PhotoshootRequest.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const influencerIds = Array.from(new Set(rows.map((r) => r.influencerId).filter(Boolean)));
    const influencers = influencerIds.length
      ? await Influencer.findAll({
          where: { id: { [Op.in]: influencerIds } },
          include: [{ model: User, attributes: ['id', 'name', 'phone', 'email'] }],
        })
      : [];
    const influencerById = new Map(influencers.map((i) => [i.id, i]));

    const items = rows.map((r) => {
      const inf: any = influencerById.get(r.influencerId) || null;
      return {
        ulid: r.ulid,
        status: r.status,
        influencer: inf
          ? {
              id: inf.id,
              ulid: inf.ulid,
              handle: inf.handle || null,
              user: {
                id: inf.User?.id,
                name: inf.User?.name || null,
                phone: inf.User?.phone || null,
                email: inf.User?.email || null,
              },
            }
          : null,
        requestedStartAt: r.requestedStartAt,
        requestedEndAt: r.requestedEndAt,
        scheduledStartAt: r.scheduledStartAt,
        scheduledEndAt: r.scheduledEndAt,
        rejectReason: r.rejectReason || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

    return res.json({ total, limit, offset, items });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminGet = async (req, res) => {
  try {
    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const row = await PhotoshootRequest.findOne({ where: { ulid } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    const influencer = await Influencer.findByPk(row.influencerId, { include: [{ model: User, attributes: ['id', 'name', 'phone', 'email'] }] });

    return res.json({
      ok: true,
      request: {
        ulid: row.ulid,
        status: row.status,
        influencer: influencer
          ? {
              id: influencer.id,
              ulid: influencer.ulid,
              handle: influencer.handle || null,
              user: {
                id: influencer.User?.id,
                name: influencer.User?.name || null,
                phone: influencer.User?.phone || null,
                email: influencer.User?.email || null,
              },
            }
          : null,
        details: row.details,
        requestedStartAt: row.requestedStartAt,
        requestedEndAt: row.requestedEndAt,
        requestedTimezone: row.requestedTimezone,
        scheduledStartAt: row.scheduledStartAt,
        scheduledEndAt: row.scheduledEndAt,
        scheduledTimezone: row.scheduledTimezone,
        location: row.location || {},
        rejectReason: row.rejectReason || null,
        adminNotes: row.adminNotes || null,
        approvedAt: row.approvedAt || null,
        approvedByUserId: row.approvedByUserId || null,
        scheduledAt: row.scheduledAt || null,
        scheduledByUserId: row.scheduledByUserId || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminApprove = async (req, res) => {
  try {
    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const row = await PhotoshootRequest.findOne({ where: { ulid } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (!['pending'].includes(String(row.status))) {
      return res.status(409).json({ error: 'cannot_approve_in_status', status: row.status });
    }

    row.status = 'approved';
    row.approvedByUserId = req.user?.id || null;
    row.approvedAt = new Date();
    await row.save();

    return res.json({ ok: true, request: { ulid: row.ulid, status: row.status, approvedAt: row.approvedAt } });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminReject = async (req, res) => {
  try {
    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const { reason } = req.body || {};
    if (!isNonEmptyString(reason)) return res.status(400).json({ error: 'reason_required' });

    const row = await PhotoshootRequest.findOne({ where: { ulid } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (!['pending', 'approved'].includes(String(row.status))) {
      return res.status(409).json({ error: 'cannot_reject_in_status', status: row.status });
    }

    row.status = 'rejected';
    row.rejectReason = String(reason);
    await row.save();

    return res.json({ ok: true, request: { ulid: row.ulid, status: row.status, rejectReason: row.rejectReason } });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};

exports.adminSchedule = async (req, res) => {
  try {
    const ulid = String(req.params.ulid || '');
    if (!ulid) return res.status(400).json({ error: 'ulid_required' });

    const { scheduledStartAt, scheduledEndAt, scheduledTimezone, location, adminNotes } = req.body || {};
    if (!isNonEmptyString(scheduledStartAt)) return res.status(400).json({ error: 'scheduledStartAt_required' });
    if (!isNonEmptyString(scheduledEndAt)) return res.status(400).json({ error: 'scheduledEndAt_required' });

    const start = new Date(String(scheduledStartAt));
    const end = new Date(String(scheduledEndAt));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ error: 'invalid_datetime' });
    if (end <= start) return res.status(400).json({ error: 'end_must_be_after_start' });

    const row = await PhotoshootRequest.findOne({ where: { ulid } });
    if (!row) return res.status(404).json({ error: 'not_found' });

    if (!['approved'].includes(String(row.status))) {
      return res.status(409).json({ error: 'cannot_schedule_in_status', status: row.status });
    }

    row.status = 'scheduled';
    row.scheduledStartAt = start;
    row.scheduledEndAt = end;
    row.scheduledTimezone = isNonEmptyString(scheduledTimezone) ? String(scheduledTimezone) : null;
    if (location && typeof location === 'object') row.location = location;
    if (isNonEmptyString(adminNotes)) row.adminNotes = String(adminNotes);

    row.scheduledByUserId = req.user?.id || null;
    row.scheduledAt = new Date();

    await row.save();

    // WhatsApp notification (best-effort)
    try {
      if (!whatsappPhotoshoot?.isWhatsAppConfigured?.()) {
        console.warn('WhatsApp photoshoot scheduled skipped: WhatsApp not configured');
      } else {
        const influencer = await Influencer.findOne({ where: { id: row.influencerId } });
        if (!influencer?.userId) {
          console.warn('WhatsApp photoshoot scheduled skipped: influencer missing userId', { influencerId: row.influencerId, requestUlid: row.ulid });
        } else {
          const user = await User.findOne({ where: { id: influencer.userId } });
          const phone = user?.phone;
          if (!phone) {
            console.warn('WhatsApp photoshoot scheduled skipped: missing user.phone', { userId: influencer.userId, requestUlid: row.ulid });
          } else {
            console.info('WhatsApp photoshoot scheduled attempting send', {
              userId: influencer.userId,
              to: maskPhoneForLog(phone),
              template: process.env.WHATSAPP_PHOTOSHOOT_SCHEDULED_TEMPLATE_NAME || null,
              requestUlid: row.ulid
            });
            await whatsappPhotoshoot.sendPhotoshootScheduled({
              req,
              phone,
              influencerName: user?.name || influencer?.handle || 'Creator',
              requestUlid: row.ulid,
              scheduledStartAt: row.scheduledStartAt,
              scheduledEndAt: row.scheduledEndAt,
              scheduledTimezone: row.scheduledTimezone
            });
          }
        }
      }
    } catch (e) {
      console.warn('WhatsApp photoshoot scheduled send failed:', e?.code || e?.message || e, e?.provider || '');
    }

    return res.json({
      ok: true,
      request: {
        ulid: row.ulid,
        status: row.status,
        scheduledStartAt: row.scheduledStartAt,
        scheduledEndAt: row.scheduledEndAt,
        scheduledTimezone: row.scheduledTimezone,
        location: row.location || {},
        scheduledAt: row.scheduledAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
};
