/*
Kaburlu backend API smoke test

Usage:
  BASE_URL=https://influapi.kaburlumedia.com TOKEN="Bearer <jwt>" node scripts/smoke-test.js
Notes:
  - Without TOKEN, only public/health checks run.
*/

const fetch = require('node-fetch');

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
const TOKEN = process.env.TOKEN || '';

async function req(method, path, body, headers={}){
  const url = `${BASE}${path}`;
  const opts = { method, headers: { 'Accept': 'application/json', ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  let text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

async function main(){
  let failures = 0;
  const fail = (msg) => { console.error('FAIL:', msg); failures++; };
  const pass = (msg) => { console.log('PASS:', msg); };

  console.log('Smoke base:', BASE);

  // Health
  try {
    const r = await req('GET', '/health');
    if (!r.ok) fail(`health not ok (${r.status})`); else pass('health ok');
  } catch (e) { fail('health error ' + e.message); }

  // Swagger head (allow 200/301)
  try {
    const r = await fetch(`${BASE}/api-docs`, { method: 'GET' });
    if (r.status >= 200 && r.status < 400) pass('swagger reachable'); else fail(`swagger http ${r.status}`);
  } catch (e) { fail('swagger error ' + e.message); }

  if (TOKEN) {
    const auth = { Authorization: TOKEN };

    // Pricing GET
    try {
      const r = await req('GET', '/api/influencers/me/pricing', undefined, auth);
      if (!r.ok) fail(`/me/pricing GET ${r.status}`); else pass('/me/pricing GET ok');
    } catch (e) { fail('/me/pricing GET ' + e.message); }

    // Pricing PUT
    try {
      const r = await req('PUT', '/api/influencers/me/pricing', { adPricing: { story: 1000, post: 1500 } }, auth);
      if (!r.ok) fail(`/me/pricing PUT ${r.status}`); else pass('/me/pricing PUT ok');
    } catch (e) { fail('/me/pricing PUT ' + e.message); }

    // Pricing POST alias
    try {
      const r = await req('POST', '/api/influencers/me/pricing', { adPricing: { reel: 2000 } }, auth);
      if (!r.ok) fail(`/me/pricing POST ${r.status}`); else pass('/me/pricing POST ok');
    } catch (e) { fail('/me/pricing POST ' + e.message); }

    // KYC GET
    try {
      const r = await req('GET', '/api/influencers/me/kyc', undefined, auth);
      if (!r.ok) fail(`/me/kyc GET ${r.status}`); else pass('/me/kyc GET ok');
    } catch (e) { fail('/me/kyc GET ' + e.message); }

    // KYC PUT (safe minimal body)
    try {
      const body = { fullName: 'Smoke Tester', dob: '1990-01-01', pan: 'ABCDE1234F', addressLine1: 'Line 1', postalCode: '560001', city: 'BLR', state: 'KA', country: 'IN', consent: true };
      const r = await req('PUT', '/api/influencers/me/kyc', body, auth);
      if (!r.ok) fail(`/me/kyc PUT ${r.status}`); else pass('/me/kyc PUT ok');
    } catch (e) { fail('/me/kyc PUT ' + e.message); }
  } else {
    console.log('TOKEN not provided; skipping auth-required checks.');
  }

  if (failures) {
    console.error(`Smoke: ${failures} failure(s)`);
    process.exit(1);
  } else {
    console.log('Smoke: all checks passed');
  }
}

if (require.main === module) {
  main();
}
