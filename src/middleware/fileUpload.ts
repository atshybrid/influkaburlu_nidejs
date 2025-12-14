const os = require('os');
const fileUpload = require('express-fileupload');

// Shared express-fileupload middleware for endpoints that rely on req.files.
// IMPORTANT: do not mount globally; it conflicts with multer-based routes.

const maxVideoMb = parseInt(process.env.MEDIA_MAX_VIDEO_MB || '100', 10);
const maxBytes = (Number.isFinite(maxVideoMb) && maxVideoMb > 0 ? maxVideoMb : 100) * 1024 * 1024;

module.exports = fileUpload({
  useTempFiles: true,
  tempFileDir: os.tmpdir(),
  limits: { fileSize: maxBytes }
});
