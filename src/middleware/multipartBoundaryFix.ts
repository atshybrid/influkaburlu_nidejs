// Fix common client bug: header set to "multipart/form-data" without boundary.
// Some Windows/PowerShell curl usages override the header and drop the boundary,
// causing busboy/multer to throw "Unexpected end of form".
//
// This middleware sniffs the boundary from the first body chunk ("--<boundary>\r\n")
// and patches req.headers['content-type'] so multer/busboy can parse it.

const MAX_SNIFF_BYTES = 2048;

function isSafeBoundary(boundary) {
  // RFC2046 token-ish; be permissive but avoid control chars/spaces.
  return typeof boundary === 'string' && boundary.length >= 6 && boundary.length <= 200 && /^[0-9A-Za-z'()+_,\-.\/:=?]+$/.test(boundary);
}

module.exports = function multipartBoundaryFix(req, res, next) {
  try {
    const ct = String(req.headers['content-type'] || '');
    if (!/^multipart\/form-data/i.test(ct)) return next();
    if (/boundary=/i.test(ct)) return next();

    // Pause and peek first chunk, then push it back for downstream middleware.
    req.pause();

    const onData = (chunk) => {
      try {
        req.removeListener('end', onEnd);
        req.removeListener('error', onErr);

        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        const head = buf.slice(0, Math.min(buf.length, MAX_SNIFF_BYTES)).toString('latin1');

        // Find the first boundary line: it usually looks like "--<boundary>\r\n"
        // Some clients may include leading CRLF before the boundary.
        let boundary = null;
        const idx = head.indexOf('--');
        if (idx >= 0) {
          const lineEnd = head.indexOf('\r\n', idx);
          const firstLine = (lineEnd >= 0 ? head.slice(idx, lineEnd) : head.slice(idx)).trim();
          if (firstLine.startsWith('--') && firstLine.length > 2) {
            const candidate = firstLine.slice(2);
            if (isSafeBoundary(candidate)) boundary = candidate;
          }
        }

        if (boundary) req.headers['content-type'] = `multipart/form-data; boundary=${boundary}`;

        // Put the chunk back so multer/busboy sees the full body.
        req.unshift(buf);
        req.resume();
        return next();
      } catch (e) {
        req.resume();
        return next(e);
      }
    };

    const onEnd = () => {
      // No body
      req.removeListener('data', onData);
      req.removeListener('error', onErr);
      return next();
    };

    const onErr = (err) => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      return next(err);
    };

    req.once('data', onData);
    req.once('end', onEnd);
    req.once('error', onErr);
  } catch (err) {
    return next(err);
  }
};
