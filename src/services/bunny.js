// Bunny.net adapter: signed upload URL and video stream helpers
const crypto = require('crypto');

function signPullZoneUrl(urlPath) {
  // If using token authentication on Bunny CDN, generate token here
  // Placeholder: return path directly
  return urlPath;
}

async function getVideoLibraryAuthHeader() {
  // Typically Bunny Stream uses an API key in header: 'AccessKey: <key>'
  const key = process.env.BUNNY_STREAM_API_KEY;
  if (!key) throw new Error('BUNNY_STREAM_API_KEY missing');
  return { AccessKey: key };
}

module.exports = { signPullZoneUrl, getVideoLibraryAuthHeader };