import * as esbuild from 'esbuild';

esbuild.build({
  entryPoints: ['server.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['express', 'vite', 'fsevents', '@google/genai'],
}).catch(() => process.exit(1));
