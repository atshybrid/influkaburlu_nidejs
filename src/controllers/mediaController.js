const crypto = require('crypto');
const { uploadBuffer } = require('../utils/r2');

const maxImageMB = parseInt(process.env.MEDIA_MAX_IMAGE_MB || '10', 10);
const maxVideoMB = parseInt(process.env.MEDIA_MAX_VIDEO_MB || '100', 10);

function detectType(filename, mimetype) {
  const lower = (mimetype || '').toLowerCase();
  if (lower.startsWith('image/')) return 'image';
  if (lower.startsWith('video/')) return 'video';
  const ext = (filename || '').toLowerCase();
  if (ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png') || ext.endsWith('.webp')) return 'image';
  if (ext.endsWith('.mp4') || ext.endsWith('.mov') || ext.endsWith('.webm')) return 'video';
  return 'unknown';
}

exports.upload = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'file is required' });
    }
    const file = req.files.file; // using express-fileupload assumed
    const type = detectType(file.name, file.mimetype);
    if (type === 'unknown') return res.status(400).json({ error: 'Unsupported file type' });

    const sizeMB = file.size / (1024 * 1024);
    if (type === 'image' && sizeMB > maxImageMB) {
      return res.status(413).json({ error: `Image too large. Max ${maxImageMB}MB` });
    }
    if (type === 'video' && sizeMB > maxVideoMB) {
      return res.status(413).json({ error: `Video too large. Max ${maxVideoMB}MB` });
    }

    const id = crypto.randomUUID();
    const key = `uploads/${req.user.id}/${type}/${id}-${file.name}`;
    const { url } = await uploadBuffer(key, file.data, file.mimetype);

    res.json({ url, key, type, sizeMB: Number(sizeMB.toFixed(2)) });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ error: 'Upload failed' });
  }
};
