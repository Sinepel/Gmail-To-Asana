#!/usr/bin/env node

const esbuild = require('esbuild');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

esbuild.build({
  entryPoints: [path.join(ROOT_DIR, 'src/lib/tiptap-asana.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'TiptapAsana',
  outfile: path.join(ROOT_DIR, 'src/lib/tiptap-bundle.js'),
  target: ['chrome90', 'firefox90'],
}).then(() => {
  console.log('Tiptap bundled successfully: src/lib/tiptap-bundle.js');
}).catch((error) => {
  console.error('Bundle failed:', error);
  process.exit(1);
});
