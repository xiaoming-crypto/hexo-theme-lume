#!/usr/bin/env node
/*
 * Safe dual-repo sync tool for hexo-theme-lume.
 * Mirrors the theme repository cleanly into a Hexo site's themes/lume directory
 * (excluding .git, node_modules, and OS junk), prunes stale files, and verifies
 * full SHA-256 parity.
 *
 * Usage:
 *   node tools/sync.mjs <target-theme-dir> [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetArg = args.find(a => !a.startsWith('--'));

if (!targetArg) {
  console.error('Usage: node tools/sync.mjs <target-theme-dir> [--dry-run]');
  process.exit(1);
}

const dstRoot = path.resolve(targetArg);
const relInsideSrc = path.relative(srcRoot, dstRoot);
if (
  dstRoot === srcRoot ||
  (!relInsideSrc.startsWith('..') && !path.isAbsolute(relInsideSrc)) ||
  dstRoot === path.parse(dstRoot).root
) {
  console.error(`Refusing unsafe sync target: ${dstRoot}`);
  process.exit(1);
}

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function collectFiles(root) {
  const map = new Map();
  if (!fs.existsSync(root)) return map;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!SKIP_DIRS.has(ent.name)) stack.push(full);
      } else if (ent.isFile() && !SKIP_FILES.has(ent.name)) {
        const rel = path.relative(root, full).split(path.sep).join('/');
        map.set(rel, full);
      }
    }
  }
  return map;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function pruneEmptyDirs(dir, rootStop) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory() && !SKIP_DIRS.has(ent.name)) {
      pruneEmptyDirs(path.join(dir, ent.name), rootStop);
    }
  }
  if (dir !== rootStop && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

const srcMap = collectFiles(srcRoot);
const dstMap = collectFiles(dstRoot);

const toDelete = [];
for (const [rel, full] of dstMap.entries()) {
  if (!srcMap.has(rel)) toDelete.push({ rel, full });
}

const toCopy = [];
for (const [rel, srcFile] of srcMap.entries()) {
  const dstFile = path.join(dstRoot, ...rel.split('/'));
  if (!dstMap.has(rel) || sha256(srcFile) !== sha256(dstFile)) {
    toCopy.push({ rel, srcFile, dstFile });
  }
}

console.log(
  `${dryRun ? '[DRY-RUN] ' : ''}Sync ${srcRoot} -> ${dstRoot}: copy=${toCopy.length}, delete=${toDelete.length}`
);

if (dryRun) {
  for (const item of toCopy) console.log(`  + ${item.rel}`);
  for (const item of toDelete) console.log(`  - ${item.rel}`);
  process.exit(0);
}

for (const item of toDelete) {
  fs.unlinkSync(item.full);
}
for (const item of toCopy) {
  fs.mkdirSync(path.dirname(item.dstFile), { recursive: true });
  fs.copyFileSync(item.srcFile, item.dstFile);
}
pruneEmptyDirs(dstRoot, dstRoot);

const afterSrc = collectFiles(srcRoot);
const afterDst = collectFiles(dstRoot);
const allKeys = new Set([...afterSrc.keys(), ...afterDst.keys()]);
const diffs = [];
for (const key of allKeys) {
  const s = afterSrc.get(key);
  const d = afterDst.get(key);
  if (!s || !d || sha256(s) !== sha256(d)) diffs.push(key);
}

console.log(`SYNC_DIFF_COUNT: ${diffs.length}`);
if (diffs.length) {
  console.error('Remaining diffs:', diffs.join(', '));
  process.exit(1);
}
