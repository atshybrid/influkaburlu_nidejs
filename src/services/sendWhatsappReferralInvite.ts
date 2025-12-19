const axios = require('axios');

function normalizeWhatsAppTo(phone: string) {
  const rawDigits = String(phone || '').replace(/\D/g, '');
  if (!rawDigits || rawDigits.length < 10) {
    const err: any = new Error('invalid_phone');
    err.code = 'invalid_phone';
    throw err;
  }

  const defaultCc = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';
  let digits = rawDigits;
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    digits = defaultCc + digits;
  }
  if (digits.length < 10 || digits.length > 15) {
    const err: any = new Error('invalid_phone');
    err.code = 'invalid_phone';
    throw err;
  }
  return digits;
}

async function sendWhatsappReferralInvite(params: {
  phone: string;
  receiverName?: string | null;
  referrerName: string;
  referralCode: string;
  shareUrl?: string | null;
}) {
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    const err: any = new Error('whatsapp_not_configured');
    err.code = 'whatsapp_not_configured';
    throw err;
  }

  const apiVersion = (process.env.WHATSAPP_API_VERSION || 'v19.0').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID);

  const templateName =
    process.env.WHATSAPP_REFERRAL_INVITE_TEMPLATE_NAME ||
    process.env.WHATSAPP_TEMPLATE_NAME ||
    'influ_referral_invite';

  const languageCode =
    process.env.WHATSAPP_REFERRAL_INVITE_TEMPLATE_LANG ||
    process.env.WHATSAPP_TEMPLATE_LANG ||
    'en';

  const includeButtonEnv =
    process.env.WHATSAPP_REFERRAL_INVITE_INCLUDE_BUTTON_URL ||
    process.env.WHATSAPP_OTP_INCLUDE_BUTTON_URL ||
    'true';
  const includeButton = String(includeButtonEnv).toLowerCase() === 'true';

  const to = normalizeWhatsAppTo(params.phone);
  const receiverName = (params.receiverName || '').trim() || 'there';
  const referrerName = String(params.referrerName || '').trim() || 'a creator';
  const referralCode = String(params.referralCode || '').trim();
  const shareUrl = (params.shareUrl || '').trim();

  if (!referralCode) {
    const err: any = new Error('referral_code_required');
    err.code = 'referral_code_required';
    throw err;
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const components: any[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: receiverName },
        { type: 'text', text: referrerName },
        { type: 'text', text: referralCode }
      ]
    }
  ];

  // Many referral templates use a URL button with a variable. Some use the referral code; others want a full URL.
  // We support both via WHATSAPP_REFERRAL_INVITE_BUTTON_PARAM ("code"|"url").
  const buttonParamMode = (process.env.WHATSAPP_REFERRAL_INVITE_BUTTON_PARAM || 'code').toLowerCase();
  const buttonParam = buttonParamMode === 'url' ? (shareUrl || referralCode) : referralCode;

  if (includeButton) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(buttonParam) }]
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: String(templateName),
      language: { code: String(languageCode) },
      components
    }
  };

  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  };

  return axios.post(url, payload, { headers });
}

module.exports = sendWhatsappReferralInvite;
