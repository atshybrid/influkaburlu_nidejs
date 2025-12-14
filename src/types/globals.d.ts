// Fallback global declarations for environments where @types/node
// is not installed during the build (e.g., some CI/hosting setups).
//
// This keeps `tsc` from failing on CommonJS globals used throughout the codebase.

declare var require: any;
declare var module: any;
declare var process: any;
declare var __dirname: string;
declare var __filename: string;
declare var Buffer: any;
