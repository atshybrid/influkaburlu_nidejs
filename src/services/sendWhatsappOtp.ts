const axios = require('axios');

function isWhatsAppConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function normalizeWhatsAppTo(phone: string) {
  // WhatsApp Cloud API expects a phone number in international format.
  // We accept either E.164 (+919xxxxxxxxx) or digits-only (919xxxxxxxxx).
  const rawDigits = String(phone || '').replace(/\D/g, '');
  if (!rawDigits || rawDigits.length < 10) {
    const err: any = new Error('invalid_phone');
    err.code = 'invalid_phone';
    throw err;
  }

  const defaultCc = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';
  // Common local formats:
  // - 10 digits: assume default country code
  // - 11 digits starting with 0: strip 0 and assume default country code
  // - 0 + <country code> + <subscriber number>: strip leading 0
  // - 00 + <country code> + <subscriber number>: strip leading 00
  let digits = rawDigits;
  if (digits.startsWith('00') && digits.length > 2) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.startsWith(`0${defaultCc}`) && digits.length === 1 + defaultCc.length + 10) {
    digits = digits.slice(1);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    digits = defaultCc + digits;
  }

  // WhatsApp Cloud API generally expects 10-15 digits in E.164 (without +)
  if (digits.length < 10 || digits.length > 15) {
    const err: any = new Error('invalid_phone');
    err.code = 'invalid_phone';
    throw err;
  }
  return digits;
}

async function sendWhatsappTemplate(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyTextParams?: string[];
  buttonUrlTextParam?: string | null;
}) {
  const { to, templateName, languageCode, bodyTextParams, buttonUrlTextParam } = params;

  if (!isWhatsAppConfigured()) {
    const err: any = new Error('whatsapp_not_configured');
    err.code = 'whatsapp_not_configured';
    throw err;
  }

  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v19.0').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID);

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const components: any[] = [];
  const bodyParams = (bodyTextParams || []).filter(Boolean);
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
      name: templateName,
      language: { code: languageCode || 'en_US' },
      ...(components.length > 0 ? { components } : {})
    }
  };

  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    return await axios.post(url, payload, { headers });
  } catch (e: any) {
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

async function sendWhatsappOtp(params: { phone: string; otp: string; purpose?: string | null; email?: string | null }) {
  const purpose = (params.purpose || 'generic').toLowerCase();

  // Allow different templates per purpose.
  const templateName =
    (purpose === 'google_link'
      ? process.env.WHATSAPP_GMAIL_LINK_TEMPLATE_NAME
      : purpose === 'mpin_reset'
        ? process.env.WHATSAPP_MPIN_RESET_TEMPLATE_NAME
        : process.env.WHATSAPP_OTP_TEMPLATE_NAME || process.env.WHATSAPP_MPIN_RESET_TEMPLATE_NAME) ||
    process.env.WHATSAPP_TEMPLATE_NAME;

  const languageCode =
    (purpose === 'google_link'
      ? process.env.WHATSAPP_GMAIL_LINK_TEMPLATE_LANG
      : purpose === 'mpin_reset'
        ? process.env.WHATSAPP_MPIN_RESET_TEMPLATE_LANG
        : process.env.WHATSAPP_OTP_TEMPLATE_LANG || process.env.WHATSAPP_MPIN_RESET_TEMPLATE_LANG) ||
    process.env.WHATSAPP_TEMPLATE_LANG ||
    'en_US';

  if (!templateName) {
    const err: any = new Error('whatsapp_template_not_configured');
    err.code = 'whatsapp_template_not_configured';
    throw err;
  }

  const to = normalizeWhatsAppTo(params.phone);
  const otp = String(params.otp);

  const includeButtonEnv =
    (purpose === 'google_link'
      ? process.env.WHATSAPP_GMAIL_LINK_INCLUDE_BUTTON_URL
      : purpose === 'mpin_reset'
        ? process.env.WHATSAPP_MPIN_RESET_INCLUDE_BUTTON_URL
        : process.env.WHATSAPP_OTP_INCLUDE_BUTTON_URL || process.env.WHATSAPP_MPIN_RESET_INCLUDE_BUTTON_URL) ||
    'false';
  const includeButton = String(includeButtonEnv).toLowerCase() === 'true';

  // Default: send only the OTP as a single body parameter (fits most OTP templates).
  // Optional: for a richer approved template, enable "full" mode to send 5 body parameters.
  const templateMode =
    (purpose === 'google_link'
      ? process.env.WHATSAPP_GMAIL_LINK_TEMPLATE_MODE
      : purpose === 'mpin_reset'
        ? process.env.WHATSAPP_MPIN_RESET_TEMPLATE_MODE
        : process.env.WHATSAPP_OTP_TEMPLATE_MODE || process.env.WHATSAPP_MPIN_RESET_TEMPLATE_MODE) ||
    'otp_only';
  const mode = String(templateMode).toLowerCase();
  const email = (params.email || '').trim();

  let bodyTextParams: string[] = [otp];
  if (purpose === 'google_link' && mode === 'full') {
    bodyTextParams = [
      process.env.WHATSAPP_GMAIL_LINK_PARAM1 || 'linking',
      process.env.WHATSAPP_GMAIL_LINK_PARAM2 || 'Gmail',
      email || process.env.WHATSAPP_GMAIL_LINK_PARAM3 || 'your email',
      otp,
      process.env.WHATSAPP_GMAIL_LINK_PARAM5 || 'support'
    ];
  }

  if (purpose === 'mpin_reset' && mode === 'full') {
    bodyTextParams = [
      process.env.WHATSAPP_MPIN_RESET_PARAM1 || 'reset',
      process.env.WHATSAPP_MPIN_RESET_PARAM2 || 'MPIN',
      process.env.WHATSAPP_MPIN_RESET_PARAM3 || 'your account',
      otp,
      process.env.WHATSAPP_MPIN_RESET_PARAM5 || 'support'
    ];
  }

  await sendWhatsappTemplate({
    to,
    templateName: String(templateName),
    languageCode: String(languageCode),
    bodyTextParams,
    buttonUrlTextParam: includeButton ? otp : null
  });

  return { sent: true };
}

module.exports = sendWhatsappOtp;
module.exports.isWhatsAppConfigured = isWhatsAppConfigured;
