let aws;
let fetch;
try { aws = require('aws-sdk'); } catch (_) { aws = null; }
try { fetch = require('node-fetch'); } catch (_) { fetch = null; }

exports.signR2ImageUpload = async (req, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) return res.status(400).json({ error: 'fileName and contentType required' });
    if (!aws) return res.status(500).json({ error: 'aws-sdk not installed. Run: npm install aws-sdk' });
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const s3 = new aws.S3({
      endpoint,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      signatureVersion: 'v4',
      region: 'auto'
    });
    const key = `${Date.now()}-${fileName}`;
    const params = {
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Expires: 900,
      ContentType: contentType,
      ACL: 'public-read'
    };
    const url = await s3.getSignedUrlPromise('putObject', params);
    const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
    res.json({ uploadUrl: url, publicUrl, key });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createBunnyVideo = async (req, res) => {
  try {
    if (!fetch) return res.status(500).json({ error: 'node-fetch not installed. Run: npm install node-fetch@2' });
    const { title } = req.body;
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    if (!libraryId || !apiKey) return res.status(500).json({ error: 'Bunny Stream env missing' });
    const r = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', AccessKey: apiKey },
      body: JSON.stringify({ title: title || `Video ${Date.now()}` })
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'bunny_error', details: text });
    }
    const json = await r.json();
    // Returns guid and presigned upload URLs
    res.json(json);
  } catch (err) { res.status(500).json({ error: err.message }); }
};