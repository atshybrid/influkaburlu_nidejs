// Fallback global declarations for environments where @types/node
// is not installed during the build (e.g., some CI/hosting setups).
//
// This keeps `tsc` from failing on CommonJS globals used throughout the codebase.

declare var require: any;
declare var exports: any;
declare var module: any;
declare var process: any;
declare var __dirname: string;
declare var __filename: string;
declare var Buffer: any;

// Minimal Node core module shims (compile-time only). These intentionally
// keep types loose to avoid requiring @types/node during hosting builds.
declare module 'fs' {
	const fs: any;
	export = fs;
}

declare module 'path' {
	const path: any;
	export = path;
}

declare module 'os' {
	const os: any;
	export = os;
}

declare module 'crypto' {
	const crypto: any;
	export = crypto;
}
