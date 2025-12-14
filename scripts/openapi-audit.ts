const fs = require('fs');
const path = require('path');

function requireFromRoot(relPath) {
  return require(path.join(__dirname, '..', relPath));
}

function extractRoutesFromRouter(router, prefix = '') {
  const out = [];
  if (!router || !Array.isArray(router.stack)) return out;

  for (const layer of router.stack) {
    if (layer.route && layer.route.path) {
      const routePath = layer.route.path;
      const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]);
      for (const method of methods) {
        out.push({ method: method.toUpperCase(), path: `${prefix}${routePath}` });
      }
    }
  }

  return out;
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function normalizePath(p) {
  if (!p) return p;
  // Express params: /:id -> /{id}
  let out = p.replace(/\/:([A-Za-z0-9_]+)/g, '/{$1}');
  // Collapse trailing slash (except root '/')
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

function parseIndexMounts(indexJsText) {
  const requires = new Map(); // var -> './file'

  // const auth = require('./auth');
  for (const match of indexJsText.matchAll(/const\s+(\w+)\s*=\s*require\(['"](\.[^'"]+)['"]\);/g)) {
    requires.set(match[1], match[2]);
  }

  const mounts = [];
  // router.use('/auth', auth);
  for (const match of indexJsText.matchAll(/router\.use\(['"]([^'"]+)['"]\s*,\s*(\w+)\);/g)) {
    const mountPath = match[1];
    const varName = match[2];
    const reqPath = requires.get(varName);
    if (!reqPath) continue;
    mounts.push({ mountPath, reqPath });
  }

  return mounts;
}

function extractIndexDirectRoutes(indexJsText) {
  const out = [];
  // router.get('/admin/bunny/videos', ...)
  for (const match of indexJsText.matchAll(/router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g)) {
    out.push({ method: match[1].toUpperCase(), path: match[2] });
  }
  return out;
}

function audit({ openapiPath, apiPrefix = '/api' }) {
  const indexTs = path.join(__dirname, '..', 'src', 'routes', 'index.ts');
  const indexJs = path.join(__dirname, '..', 'src', 'routes', 'index.js');
  const indexPath = fs.existsSync(indexTs) ? indexTs : indexJs;
  const indexText = fs.readFileSync(indexPath, 'utf8');

  const openapiRaw = fs.readFileSync(openapiPath, 'utf8');
  const openapi = JSON.parse(openapiRaw);
  const openapiPaths = openapi.paths || {};

  const discovered = [];

  // Mounted routers
  for (const mount of parseIndexMounts(indexText)) {
    // mount.reqPath like './auth'
    const router = requireFromRoot(path.join('src', 'routes', mount.reqPath.replace(/^\.\//, '')));
    const routes = extractRoutesFromRouter(router, `${apiPrefix}${mount.mountPath}`).map((r) => ({
      ...r,
      path: normalizePath(r.path),
    }));
    discovered.push(...routes);
  }

  // Direct routes in src/routes/index
  for (const r of extractIndexDirectRoutes(indexText)) {
    discovered.push({ method: r.method, path: normalizePath(`${apiPrefix}${r.path}`) });
  }

  // Server-level health route (not under /api)
  discovered.push({ method: 'GET', path: normalizePath('/health') });

  const uniq = uniqBy(discovered.map((r) => ({ ...r, path: normalizePath(r.path) })), (r) => `${r.method} ${r.path}`).sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method);
    return a.path.localeCompare(b.path);
  });

  const missing = [];
  for (const r of uniq) {
    const pathItem = openapiPaths[r.path];
    if (!pathItem) {
      missing.push({ ...r, missing: 'path' });
      continue;
    }
    const lower = r.method.toLowerCase();
    if (!pathItem[lower]) missing.push({ ...r, missing: 'method' });
  }

  return { discovered: uniq, missing, openapiPathCount: Object.keys(openapiPaths).length };
}

function main() {
  const openapiPath = path.join(__dirname, '..', 'src', 'openapi.json');
  const result = audit({ openapiPath });

  console.log(JSON.stringify(result, null, 2));

  if (result.missing.length) {
    process.exitCode = 2;
  }
}

main();
