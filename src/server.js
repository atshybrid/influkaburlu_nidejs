// Compatibility entrypoint for platforms still starting `node src/server.js`.
// The real compiled server lives at `../dist/server.js`.

try {
  // eslint-disable-next-line global-require
  require('../dist/server.js');
} catch (err) {
  if (err && err.code === 'MODULE_NOT_FOUND') {
    // eslint-disable-next-line no-console
    console.error(
      'Cannot find ../dist/server.js. Did you run `npm run build` before starting?\n' +
        'On Render, set Build Command: `npm ci; npm run build` and Start Command: `npm start`.'
    );
  }
  throw err;
}
