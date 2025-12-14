const crypto = require('crypto');

function createOrder({ amount, currency = 'INR', notes = {} }) {
  // Placeholder: integrate Razorpay SDK in real implementation
  const id = 'order_' + Math.random().toString(36).slice(2, 8);
  return Promise.resolve({ id, amount, currency, notes });
}

function verifySignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
  const payload = orderId + '|' + paymentId;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return expected === signature;
}

module.exports = { createOrder, verifySignature };