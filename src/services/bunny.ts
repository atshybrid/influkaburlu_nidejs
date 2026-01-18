// Bunny.net adapter: signed upload URL and video stream helpers
const nodeCrypto = require('crypto');

// Environment variables
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '';
const CDN_HOSTNAME = process.env.BUNNY_STREAM_CDN_HOSTNAME || '';
const CDN_TOKEN_KEY = process.env.BUNNY_CDN_TOKEN_KEY || ''; // Token Authentication Key from Bunny CDN

/**
 * Generate a signed token for Bunny CDN Token Authentication
 * @see https://docs.bunny.net/docs/stream-security-token-authentication
 * @param url - Full URL to sign (without query params)
 * @param expiresInSeconds - Token validity in seconds (default: 24 hours)
 * @returns Query string with token and expires params
 */
function generateBunnyToken(url: string, expiresInSeconds: number = 86400): string {
  const tokenKey = CDN_TOKEN_KEY || process.env.BUNNY_CDN_TOKEN_KEY;
  if (!tokenKey) {
    // No token key configured - return unsigned URL (Bunny CDN must allow public access)
    return '';
  }

  // Calculate expiration timestamp (Unix timestamp)
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Parse the URL to get the path
  const urlObj = new URL(url);
  const path = urlObj.pathname;

  // Bunny CDN token format: SHA256(tokenKey + path + expires)
  // Base64 encoded, URL-safe (replace +/= with -_)
  const hashableBase = tokenKey + path + expires;
  const hash = nodeCrypto.createHash('sha256').update(hashableBase).digest('base64');
  const token = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `token=${token}&expires=${expires}`;
}

/**
 * Sign a CDN URL with Bunny Token Authentication
 * @param baseUrl - Base URL without query params
 * @returns Signed URL with token (or original URL if no token key configured)
 */
function signCdnUrl(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  
  const tokenParams = generateBunnyToken(baseUrl);
  if (!tokenParams) return baseUrl; // No token key - return unsigned
  
  return `${baseUrl}?${tokenParams}`;
}

/**
 * Build video URLs object with all playback formats
 * @param videoGuid - Bunny Stream video GUID
 * @param signed - Whether to sign URLs with token authentication (default: true)
 * @returns Object with hls, mp4, iframe URLs
 */
function buildVideoUrls(videoGuid: string, signed: boolean = true): {
  hls: string | null;
  mp4: string | null;
  iframe: string | null;
  directPlay: string | null;
  thumbnail: string | null;
  preview: string | null;
} {
  if (!videoGuid) {
    return { hls: null, mp4: null, iframe: null, directPlay: null, thumbnail: null, preview: null };
  }

  const libraryId = LIBRARY_ID || process.env.BUNNY_STREAM_LIBRARY_ID;
  const cdnHost = CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;

  // Build base URLs
  const hlsBase = cdnHost ? `https://${cdnHost}/${videoGuid}/playlist.m3u8` : null;
  const mp4Base = cdnHost ? `https://${cdnHost}/${videoGuid}/play_720p.mp4` : null;
  const thumbnailBase = cdnHost ? `https://${cdnHost}/${videoGuid}/thumbnail.jpg` : null;
  const previewBase = cdnHost ? `https://${cdnHost}/${videoGuid}/preview.webp` : null;

  // iframe and directPlay don't need CDN token signing (they use Bunny's own auth)
  const iframe = libraryId ? `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}` : null;
  const directPlay = libraryId ? `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}` : null;

  if (signed) {
    return {
      hls: signCdnUrl(hlsBase),
      mp4: signCdnUrl(mp4Base),
      iframe,
      directPlay,
      thumbnail: signCdnUrl(thumbnailBase),
      preview: signCdnUrl(previewBase),
    };
  }

  return {
    hls: hlsBase,
    mp4: mp4Base,
    iframe,
    directPlay,
    thumbnail: thumbnailBase,
    preview: previewBase,
  };
}

/**
 * Build MP4 URL with specific resolution (signed)
 * @param videoGuid - Bunny Stream video GUID
 * @param resolution - Resolution height (360, 480, 720, 1080)
 * @param signed - Whether to sign URL with token authentication (default: true)
 */
function buildMp4Url(videoGuid: string, resolution: number = 720, signed: boolean = true): string | null {
  const cdnHost = CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;
  if (!cdnHost || !videoGuid) return null;
  const baseUrl = `https://${cdnHost}/${videoGuid}/play_${resolution}p.mp4`;
  return signed ? signCdnUrl(baseUrl) : baseUrl;
}

/**
 * Build HLS URL (signed)
 * @param videoGuid - Bunny Stream video GUID
 * @param signed - Whether to sign URL with token authentication (default: true)
 */
function buildHlsUrl(videoGuid: string, signed: boolean = true): string | null {
  const cdnHost = CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;
  if (!cdnHost || !videoGuid) return null;
  const baseUrl = `https://${cdnHost}/${videoGuid}/playlist.m3u8`;
  return signed ? signCdnUrl(baseUrl) : baseUrl;
}

/**
 * Build iframe embed URL
 * @param videoGuid - Bunny Stream video GUID
 */
function buildIframeUrl(videoGuid: string): string | null {
  const libraryId = LIBRARY_ID || process.env.BUNNY_STREAM_LIBRARY_ID;
  if (!libraryId || !videoGuid) return null;
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`;
}

/**
 * @deprecated Use signCdnUrl instead - kept for backwards compatibility
 */
function signPullZoneUrl(urlPath: string): string {
  return signCdnUrl(urlPath) || urlPath;
}

async function getVideoLibraryAuthHeader() {
  // Typically Bunny Stream uses an API key in header: 'AccessKey: <key>'
  const key = process.env.BUNNY_STREAM_API_KEY;
  if (!key) throw new Error('BUNNY_STREAM_API_KEY missing');
  return { AccessKey: key };
}

module.exports = { 
  signPullZoneUrl, 
  signCdnUrl,
  generateBunnyToken,
  getVideoLibraryAuthHeader,
  buildVideoUrls,
  buildMp4Url,
  buildHlsUrl,
  buildIframeUrl,
};