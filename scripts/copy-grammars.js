#!/usr/bin/env node
/**
 * Copy WASM grammar files from tree-sitter-wasms to the grammars directory.
 *
 * This script is run during the build process to ensure the WASM files
 * are available for the chunker module.
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const grammarsDir = join(projectRoot, 'grammars');

// Create grammars directory if it doesn't exist
if (!existsSync(grammarsDir)) {
  mkdirSync(grammarsDir, { recursive: true });
}

// Use createRequire to resolve the tree-sitter-wasms package
const require = createRequire(import.meta.url);
let wasmsDir;
try {
  const wasmsPackage = require.resolve('tree-sitter-wasms/package.json');
  wasmsDir = join(dirname(wasmsPackage), 'out');
} catch {
  console.log('tree-sitter-wasms not installed, skipping grammar copy');
  console.log('Run npm install to install devDependencies');
  process.exit(0);
}

// List of grammars we need
const grammars = [
  'tree-sitter-typescript.wasm',
  'tree-sitter-tsx.wasm',
  'tree-sitter-javascript.wasm',
  'tree-sitter-python.wasm',
  'tree-sitter-go.wasm',
  'tree-sitter-rust.wasm',
  'tree-sitter-java.wasm',
  'tree-sitter-c_sharp.wasm',
  'tree-sitter-cpp.wasm',
  'tree-sitter-c.wasm',
];

console.log('Copying WASM grammars to grammars/');

for (const grammar of grammars) {
  const src = join(wasmsDir, grammar);
  const dest = join(grammarsDir, grammar);

  if (!existsSync(src)) {
    console.warn(`  Warning: ${grammar} not found in tree-sitter-wasms`);
    continue;
  }

  copyFileSync(src, dest);
  console.log(`  Copied ${grammar}`);
}

console.log('Done!');
