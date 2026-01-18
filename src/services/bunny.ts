// Bunny.net adapter: signed upload URL and video stream helpers
const crypto = require('crypto');

// Environment variables
const LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || '';
const CDN_HOSTNAME = process.env.BUNNY_STREAM_CDN_HOSTNAME || '';

/**
 * Build video URLs object with all playback formats
 * @param videoGuid - Bunny Stream video GUID
 * @returns Object with hls, mp4, iframe URLs
 */
function buildVideoUrls(videoGuid: string): {
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

  return {
    // HLS streaming URL (for React Native, iOS, Android)
    hls: cdnHost ? `https://${cdnHost}/${videoGuid}/playlist.m3u8` : null,
    // MP4 direct URL (fallback for older players, 720p default)
    mp4: cdnHost ? `https://${cdnHost}/${videoGuid}/play_720p.mp4` : null,
    // iframe embed URL (for web)
    iframe: libraryId ? `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}` : null,
    // Direct play URL (auto-selects best format)
    directPlay: libraryId ? `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}` : null,
    // Thumbnail URL
    thumbnail: cdnHost ? `https://${cdnHost}/${videoGuid}/thumbnail.jpg` : null,
    // Preview animation
    preview: cdnHost ? `https://${cdnHost}/${videoGuid}/preview.webp` : null,
  };
}

/**
 * Build MP4 URL with specific resolution
 * @param videoGuid - Bunny Stream video GUID
 * @param resolution - Resolution height (360, 480, 720, 1080)
 */
function buildMp4Url(videoGuid: string, resolution: number = 720): string | null {
  const cdnHost = CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;
  if (!cdnHost || !videoGuid) return null;
  return `https://${cdnHost}/${videoGuid}/play_${resolution}p.mp4`;
}

/**
 * Build HLS URL
 * @param videoGuid - Bunny Stream video GUID
 */
function buildHlsUrl(videoGuid: string): string | null {
  const cdnHost = CDN_HOSTNAME || process.env.BUNNY_STREAM_CDN_HOSTNAME;
  if (!cdnHost || !videoGuid) return null;
  return `https://${cdnHost}/${videoGuid}/playlist.m3u8`;
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

module.exports = { 
  signPullZoneUrl, 
  getVideoLibraryAuthHeader,
  buildVideoUrls,
  buildMp4Url,
  buildHlsUrl,
  buildIframeUrl,
};