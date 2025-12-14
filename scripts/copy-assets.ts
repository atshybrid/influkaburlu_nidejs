import fs from 'fs';
import path from 'path';

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(src: string, dest: string) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function main() {
  // Assume scripts are run from repo root (works for both TS source and compiled dist).
  const repoRoot = process.cwd();

  const assets: Array<{ src: string; dest: string }> = [
    {
      src: path.join(repoRoot, 'src', 'openapi.json'),
      dest: path.join(repoRoot, 'dist', 'src', 'openapi.json'),
    },
  ];

  for (const a of assets) {
    if (!fs.existsSync(a.src)) {
      // Non-fatal: keep build working even if optional asset is missing
      // (server.ts already falls back to minimal spec).
      continue;
    }
    copyFile(a.src, a.dest);
  }
}

main();
