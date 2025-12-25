const axios = require('axios');

function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function normalizeWhatsAppTo(phone) {
  const rawDigits = String(phone || '').replace(/\D/g, '');
  if (!rawDigits || rawDigits.length < 10) {
    const err: any = new Error('invalid_phone');
    err.code = 'invalid_phone';
    throw err;
  }

  const defaultCc = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';
  let digits = rawDigits;
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = defaultCc + digits;
  if (digits.length < 10 || digits.length > 15) {
    const err: any = new Error('invalid_phone');
    err.code = 'invalid_phone';
    throw err;
  }
  return digits;
}

async function sendWhatsappTemplate({ to, templateName, languageCode, bodyTextParams, buttonUrlTextParam }) {
  if (!isWhatsAppConfigured()) {
    const err: any = new Error('whatsapp_not_configured');
    err.code = 'whatsapp_not_configured';
    throw err;
  }

  if (!templateName) {
    const err: any = new Error('whatsapp_template_not_configured');
    err.code = 'whatsapp_template_not_configured';
    throw err;
  }

  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v19.0').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const components = [];
  const bodyParams = (bodyTextParams || []).filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  if (bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((text) => ({ type: 'text', text: String(text) }))
    });
  }

  if (buttonUrlTextParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(buttonUrlTextParam) }]
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: String(templateName),
      language: { code: String(languageCode || 'en_US') },
      ...(components.length > 0 ? { components } : {})
    }
  };

  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    return await axios.post(url, payload, { headers });
  } catch (e) {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const err: any = new Error('whatsapp_send_failed');
    err.code = 'whatsapp_send_failed';
    err.status = status;
    err.provider = { status, data };
    err.cause = e;
    throw err;
  }
}

function absoluteBaseUrl(req) {
  const base = String(process.env.BASE_URL || '').trim().replace(/\/$/, '');
  if (base) return base;
  if (!req) return '';
  return `${req.protocol}://${req.get('host')}`;
}

function formatSchedule(startAt, endAt, tz) {
  const s = startAt instanceof Date ? startAt : new Date(String(startAt));
  const e = endAt instanceof Date ? endAt : new Date(String(endAt));
  const startIso = isNaN(s.getTime()) ? String(startAt || '') : s.toISOString();
  const endIso = isNaN(e.getTime()) ? String(endAt || '') : e.toISOString();
  const tzLabel = tz ? String(tz) : '';
  return { startIso, endIso, tzLabel };
}

function pickAppointmentDetails(details) {
  const ap = details?.influencerAppointmentDetails || details;
  return ap && typeof ap === 'object' ? ap : null;
}

function asNonEmptyString(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function asYesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  const s = asNonEmptyString(value);
  if (!s) return null;
  const v = s.toLowerCase();
  if (v === 'true' || v === 'yes') return 'Yes';
  if (v === 'false' || v === 'no') return 'No';
  return s;
}

function asCsv(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    const parts = value.map((v) => asNonEmptyString(v)).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  return asNonEmptyString(value);
}

function pushLine(lines, label, value) {
  const v = asNonEmptyString(value);
  if (!v) return;
  lines.push(`${label}: ${v}`);
}

function buildPhotoshootTypeSummary(details) {
  const ap = pickAppointmentDetails(details);
  if (!ap) return null;

  const lines = [];

  // Location
  const city = asNonEmptyString(ap?.personal?.city || ap?.location?.city);
  if (city) lines.push(`City: ${city}`);

  // Personal + body
  pushLine(lines, 'Gender', ap?.personal?.gender);
  pushLine(lines, 'Body type', ap?.personal?.bodyType);
  pushLine(lines, 'Skin tone', ap?.personal?.skinTone);
  pushLine(lines, 'Height (cm)', ap?.bodyMeasurements?.heightCm);
  pushLine(lines, 'Weight (kg)', ap?.bodyMeasurements?.weightKg);
  pushLine(lines, 'Chest/Bust (cm)', ap?.bodyMeasurements?.chestBustCm);
  pushLine(lines, 'Waist (cm)', ap?.bodyMeasurements?.waistCm);
  pushLine(lines, 'Hip (cm)', ap?.bodyMeasurements?.hipCm);
  pushLine(lines, 'Shoulder width (cm)', ap?.bodyMeasurements?.shoulderWidthCm);
  pushLine(lines, 'Shoe size', ap?.bodyMeasurements?.shoeSize);

  // Dress details
  pushLine(lines, 'Top size', ap?.dressDetails?.topSize);
  pushLine(lines, 'Bottom size', ap?.dressDetails?.bottomSize);
  pushLine(lines, 'Dress size', ap?.dressDetails?.dressSize);
  pushLine(lines, 'Preferred fit', ap?.dressDetails?.preferredFit);
  pushLine(lines, 'Preferred dressing style', asCsv(ap?.dressDetails?.preferredDressingStyle));
  pushLine(lines, 'Traditional wear type', asCsv(ap?.dressDetails?.traditionalWearType));
  pushLine(lines, 'Western wear type', asCsv(ap?.dressDetails?.westernWearType));
  pushLine(lines, 'Preferred outfit colors', asCsv(ap?.dressDetails?.preferredOutfitColors));

  // Shoot preferences
  pushLine(lines, 'Shoot type', asCsv(ap?.shootPreferences?.shootType));
  pushLine(lines, 'Shoot style', asCsv(ap?.shootPreferences?.shootStyle));
  pushLine(lines, 'Pose comfort', ap?.shootPreferences?.poseComfortLevel);
  pushLine(lines, 'Boldness level', ap?.shootPreferences?.boldnessLevel);
  pushLine(lines, 'Sleeveless allowed', asYesNo(ap?.shootPreferences?.sleevelessAllowed));
  pushLine(lines, 'Camera facing comfort', asYesNo(ap?.shootPreferences?.cameraFacingComfort));

  // Styling permissions
  pushLine(lines, 'Makeup preference', ap?.stylingPermissions?.makeupPreference);
  pushLine(lines, 'Accessories allowed', asYesNo(ap?.stylingPermissions?.accessoriesAllowed));

  // Editing & usage
  pushLine(lines, 'Usage permission', asCsv(ap?.editingAndUsage?.usagePermission));
  pushLine(lines, 'Photoshop/branding allowed', asYesNo(ap?.editingAndUsage?.photoshopBrandingAllowed));

  // Consent (if present)
  pushLine(lines, 'Consent', asCsv(ap?.consent));

  if (!lines.length) return null;

  // Keep WhatsApp template param within a reasonable length.
  // If it’s too long, truncate with an ellipsis.
  const text = lines.join('\n');
  const max = 950;
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

async function sendPhotoshootRequestCreated({ req, phone, influencerName, requestUlid, requestDetails }) {
  const templateName = process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_TEMPLATE_LANG || 'en_US';
  const includeButton = String(process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_INCLUDE_BUTTON_URL || 'false').toLowerCase() === 'true';

  const includeDetails = String(process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_INCLUDE_DETAILS || 'false').toLowerCase() === 'true';
  const detailsText = includeDetails ? (buildPhotoshootTypeSummary(requestDetails) || 'N/A') : null;

  // Some templates use only {{1}} (influencerName). Others may also include {{2}} (requestUlid).
  // Configure with WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_BODY_MODE=name_only|name_ulid|name_details|name_ulid_details
  const defaultBodyMode = includeDetails ? 'name_ulid_details' : 'name_ulid';
  const bodyMode = String(process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_BODY_MODE || defaultBodyMode).toLowerCase();

  const buttonMode = String(process.env.WHATSAPP_PHOTOSHOOT_REQUEST_CREATED_BUTTON_PARAM || 'ulid').toLowerCase();
  const base = absoluteBaseUrl(req);
  const path = String(process.env.PHOTOSHOOT_FRONTEND_PATH || '/photoshoots').trim();
  const url = base ? `${base}${path}?ulid=${encodeURIComponent(String(requestUlid))}` : String(requestUlid);
  const buttonParam = buttonMode === 'url' ? url : String(requestUlid);

  const to = normalizeWhatsAppTo(phone);
  const safeName = String(influencerName || 'Creator');
  const safeUlid = String(requestUlid);
  const bodyTextParams =
    bodyMode === 'name_only'
      ? [safeName]
      : bodyMode === 'name_details'
        ? [safeName, detailsText]
        : bodyMode === 'name_ulid_details'
          ? [safeName, safeUlid, detailsText]
          : [safeName, safeUlid];

  await sendWhatsappTemplate({
    to,
    templateName,
    languageCode,
    bodyTextParams,
    buttonUrlTextParam: includeButton ? buttonParam : null
  });

  return { sent: true };
}

async function sendPhotoshootScheduled({ req, phone, influencerName, requestUlid, scheduledStartAt, scheduledEndAt, scheduledTimezone, requestDetails }) {
  const templateName = process.env.WHATSAPP_PHOTOSHOOT_SCHEDULED_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_PHOTOSHOOT_SCHEDULED_TEMPLATE_LANG || 'en_US';
  const includeButton = String(process.env.WHATSAPP_PHOTOSHOOT_SCHEDULED_INCLUDE_BUTTON_URL || 'false').toLowerCase() === 'true';

  const includeDetails = String(process.env.WHATSAPP_PHOTOSHOOT_SCHEDULED_INCLUDE_DETAILS || 'false').toLowerCase() === 'true';
  const detailsText = includeDetails ? (buildPhotoshootTypeSummary(requestDetails) || 'N/A') : null;

  const { startIso, endIso, tzLabel } = formatSchedule(scheduledStartAt, scheduledEndAt, scheduledTimezone);

  const buttonMode = String(process.env.WHATSAPP_PHOTOSHOOT_SCHEDULED_BUTTON_PARAM || 'ulid').toLowerCase();
  const base = absoluteBaseUrl(req);
  const path = String(process.env.PHOTOSHOOT_FRONTEND_PATH || '/photoshoots').trim();
  const url = base ? `${base}${path}?ulid=${encodeURIComponent(String(requestUlid))}` : String(requestUlid);
  const buttonParam = buttonMode === 'url' ? url : String(requestUlid);

  const to = normalizeWhatsAppTo(phone);
  // Default parameter set (make your template match this order):
  // 1) influencerName 2) requestUlid 3) startIso 4) endIso 5) timezone
  const baseParams = [String(influencerName || 'Creator'), String(requestUlid), startIso, endIso, tzLabel];
  const bodyTextParams = includeDetails ? [...baseParams, detailsText] : baseParams;

  await sendWhatsappTemplate({
    to,
    templateName,
    languageCode,
    bodyTextParams,
    buttonUrlTextParam: includeButton ? buttonParam : null
  });

  return { sent: true };
}

async function sendPortfolioUploaded({ req, phone, influencerName, packId, photoCount }) {
  const templateName = process.env.WHATSAPP_PORTFOLIO_UPLOADED_TEMPLATE_NAME;
  const languageCode = process.env.WHATSAPP_PORTFOLIO_UPLOADED_TEMPLATE_LANG || 'en_US';
  const includeButton = String(process.env.WHATSAPP_PORTFOLIO_UPLOADED_INCLUDE_BUTTON_URL || 'false').toLowerCase() === 'true';

  const base = absoluteBaseUrl(req);
  const packUrl = base ? `${base}/api/profile-builder/pack/${encodeURIComponent(String(packId))}` : String(packId);

  const buttonMode = String(process.env.WHATSAPP_PORTFOLIO_UPLOADED_BUTTON_PARAM || 'url').toLowerCase();
  const buttonParam = buttonMode === 'packid' ? String(packId) : packUrl;

  const to = normalizeWhatsAppTo(phone);
  // Default parameter set:
  // 1) influencerName 2) photoCount 3) packUrl
  const bodyTextParams = [String(influencerName || 'Creator'), String(photoCount || 0), packUrl];

  await sendWhatsappTemplate({
    to,
    templateName,
    languageCode,
    bodyTextParams,
    buttonUrlTextParam: includeButton ? buttonParam : null
  });

  return { sent: true };
}

module.exports = {
  isWhatsAppConfigured,
  sendPhotoshootRequestCreated,
  sendPhotoshootScheduled,
  sendPortfolioUploaded,
};
