// Bunny.net adapter: signed upload URL and video stream helpers
const nodeCrypto = require('crypto');

// Environment variables
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '';
const CDN_HOSTNAME = process.env.BUNNY_STREAM_CDN_HOSTNAME || '';
const CDN_TOKEN_KEY = process.env.BUNNY_CDN_TOKEN_KEY || ''; // Token Authentication Key from Bunny CDN

/**
 * Generate a signed URL for Bunny CDN Token Authentication
 * Official implementation based on: https://github.com/BunnyWay/BunnyCDN.TokenAuthentication/blob/master/nodejs/token.js
 * 
 * @param url - Full CDN URL to sign
 * @param securityKey - Token authentication key from Bunny CDN
 * @param expirationTime - Token validity in seconds (default: 24 hours)
 * @param pathAllowed - Optional: partial path for token (allows access to all files in that directory)
 * @returns Signed URL
 */
function signBunnyCdnUrl(
  url: string,
  securityKey: string,
  expirationTime: number = 86400,
  pathAllowed?: string
): string {
  if (!securityKey || !url) {
    return url;
  }

  let parameterData = '';
  let parameterDataUrl = '';
  let signaturePath = '';
  
  const expires = Math.floor(Date.now() / 1000) + expirationTime;
  const parsedUrl = new URL(url);
  
  // If pathAllowed is specified, use it as the signature path
  if (pathAllowed) {
    signaturePath = pathAllowed;
    parameterData = `token_path=${signaturePath}`;
    parameterDataUrl = `&token_path=${encodeURIComponent(signaturePath)}`;
  } else {
    signaturePath = decodeURIComponent(parsedUrl.pathname);
  }
  
  // Generate the hashable base: securityKey + signaturePath + expires + parameterData
  const hashableBase = securityKey + signaturePath + expires + parameterData;
  
  // Generate SHA256 hash, then Base64 encode
  let token = nodeCrypto.createHash('sha256').update(hashableBase).digest('base64');
  
  // URL-safe Base64: replace + with -, / with _, remove =
  token = token.replace(/\n/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  // Return signed URL with query parameters
  return `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}?token=${token}${parameterDataUrl}&expires=${expires}`;
}

/**
 * Sign a Bunny Stream CDN URL with Token Authentication
 * For HLS streams, uses token_path to allow access to all segment files
 * 
 * @param baseUrl - Full URL without query params
 * @param useTokenPath - If true, uses the directory as token_path (for HLS)
 * @returns Signed URL with token
 */
function signStreamUrl(baseUrl: string | null, useTokenPath: boolean = false): string | null {
  if (!baseUrl) return null;
  
  const tokenKey = CDN_TOKEN_KEY || process.env.BUNNY_CDN_TOKEN_KEY;
  if (!tokenKey) return baseUrl;
  
  try {
    // For HLS/video, use the video directory as token_path so all segment files work
    let pathAllowed: string | undefined;
    if (useTokenPath) {
      const parsedUrl = new URL(baseUrl);
      const path = parsedUrl.pathname;
      // Extract directory path (e.g., /videoId/ from /videoId/playlist.m3u8)
      const lastSlash = path.lastIndexOf('/');
      if (lastSlash > 0) {
        pathAllowed = path.substring(0, lastSlash + 1);
      }
    }
    
    return signBunnyCdnUrl(baseUrl, tokenKey, 86400, pathAllowed);
  } catch {
    return baseUrl;
  }
}

/**
 * Build video URLs object with all playback formats
 * @param videoGuid - Bunny Stream video GUID
 * @param signed - Whether to sign URLs with token authentication (default: true)
 * @returns Object with hls, mp4, iframe URLs
 * 
 * NOTE: If token authentication is enabled on Bunny CDN but the token key is incorrect,
 * use the `directPlay` URL which works through Bunny's own player without CDN token auth.
 * Priority for React Native: directPlay > mp4 > hls
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

  // These URLs work without CDN token auth (recommended for React Native)
  const iframe = libraryId ? `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}` : null;
  // directPlay auto-redirects to the best format - works without token auth
  const directPlay = libraryId ? `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}` : null;

  // Check if we have a valid token key for signing
  const tokenKey = CDN_TOKEN_KEY || process.env.BUNNY_CDN_TOKEN_KEY;
  const canSign = signed && Boolean(tokenKey);

  if (canSign) {
    return {
      // HLS needs token_path=true to allow segment file access
      hls: signStreamUrl(hlsBase, true),
      // MP4, thumbnail, preview are single files - no token_path needed
      mp4: signStreamUrl(mp4Base, false),
      iframe,
      directPlay,
      thumbnail: signStreamUrl(thumbnailBase, false),
      preview: signStreamUrl(previewBase, false),
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
  return signed ? signStreamUrl(baseUrl, false) : baseUrl;
}

/**
 * Build HLS URL (signed with token_path for segment access)
 * @param videoGuid - Bunny Stream video GUID
 * @param signed - Whether to sign URL with token authentication (default: true)
 */
function buildHlsUrl(videoGuid: string, signed: boolean = true): string | null {
  const cdnHost = CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;
  if (!cdnHost || !videoGuid) return null;
  const baseUrl = `https://${cdnHost}/${videoGuid}/playlist.m3u8`;
  // HLS needs token_path=true to allow segment file access
  return signed ? signStreamUrl(baseUrl, true) : baseUrl;
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
 * @deprecated Use signStreamUrl instead - kept for backwards compatibility
 */
function signPullZoneUrl(urlPath: string): string {
  return signStreamUrl(urlPath, false) || urlPath;
}

/**
 * Legacy signCdnUrl - now uses signStreamUrl internally
 */
function signCdnUrl(baseUrl: string | null, useTokenPath: boolean = false): string | null {
  if (!baseUrl) return null;
  return signStreamUrl(baseUrl, useTokenPath);
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
  signStreamUrl,
  signBunnyCdnUrl,
  getVideoLibraryAuthHeader,
  buildVideoUrls,
  buildMp4Url,
  buildHlsUrl,
  buildIframeUrl,
};