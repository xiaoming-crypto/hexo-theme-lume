#!/usr/bin/env node
/*
 * Zero-dependency QA & regression checker for hexo-theme-lume.
 * Usage:
 *   node tools/qa.mjs
 *   node tools/qa.mjs --site <path-to-hexo-blog>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(__dirname, '..');

let siteArg = '';
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === '--site' && process.argv[i + 1]) {
    siteArg = process.argv[i + 1];
    i += 1;
  }
}

let failures = 0;

function pass(name, detail = '') {
  console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failures += 1;
  console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walk(full, exts));
    } else if (!exts || exts.includes(path.extname(ent.name))) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(code, isEjs) {
  let s = code;
  if (isEjs) {
    s = s.replace(/<%#[\s\S]*?%>/g, '');
    s = s.replace(/<!--[\s\S]*?-->/g, '');
  }
  s = s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  s = s.replace(/(^|[^:\\])\/\/.*$/gm, '$1');
  return s;
}

function parseSimpleYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const map = new Map();
  const stack = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    if (!rawLine.trim() || /^\s*#/.test(rawLine)) continue;
    const match = rawLine.match(/^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const key = match[2];
    let val = match[3].trim();
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (!val) {
      stack.push({ indent, key });
      continue;
    }
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    const fullKey = [...stack.map(s => s.key), key].join('.');
    map.set(fullKey, val);
  }
  return map;
}

/* 1. JS / MJS syntax checks -------------------------------- */
const jsFiles = [
  ...walk(path.join(themeRoot, 'scripts'), ['.js']),
  ...walk(path.join(themeRoot, 'source', 'js'), ['.js']),
  ...walk(path.join(themeRoot, 'tools'), ['.mjs', '.js'])
];

let jsErrors = [];
for (const file of jsFiles) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    jsErrors.push(`${path.relative(themeRoot, file)}: ${(res.stderr || '').trim()}`);
  }
}
if (jsErrors.length) fail('JS syntax check', jsErrors.join('; '));
else pass('JS syntax check', `${jsFiles.length} files clean`);

/* 2. Single stylesheet & design/motion token checks --------- */
const lumeCssPath = path.join(themeRoot, 'source', 'css', 'lume.css');
const oldMain = path.join(themeRoot, 'source', 'css', 'main.css');
const oldPop = path.join(themeRoot, 'source', 'css', 'pop.css');

if (!fs.existsSync(lumeCssPath) || fs.existsSync(oldMain) || fs.existsSync(oldPop)) {
  fail('Stylesheet structure', 'Expected source/css/lume.css only (no main.css/pop.css)');
} else {
  const css = fs.readFileSync(lumeCssPath, 'utf8');
  const openCount = (css.match(/\{/g) || []).length;
  const closeCount = (css.match(/\}/g) || []).length;
  const requiredTokens = [
    '--ease-snap',
    '--ease-smooth',
    '--ease-spring',
    '--accent-text',
    '--on-accent',
    '--on-bright',
    '.site-nav__pill',
    '.toc__indicator',
    'html.nav-vt',
    '.comments--waline',
    '.lume-gallery',
    '.lume-tabs',
    'html.is-reading-focus',
    '[data-anim-paused="true"]'
  ];
  const missingTokens = requiredTokens.filter(tok => !css.includes(tok));
  if (openCount !== closeCount) {
    fail('CSS brace & tokens', `brace mismatch ${openCount} vs ${closeCount}`);
  } else if (missingTokens.length) {
    fail('CSS brace & tokens', `missing: ${missingTokens.join(', ')}`);
  } else {
    pass('CSS brace & tokens', `${Buffer.byteLength(css, 'utf8')} B, braces ${openCount}=${closeCount}`);
  }
}

/* 3. i18n parity check ------------------------------------- */
const zhPath = path.join(themeRoot, 'languages', 'zh-CN.yml');
const enPath = path.join(themeRoot, 'languages', 'en.yml');
let i18nKeys = new Set();
if (!fs.existsSync(zhPath) || !fs.existsSync(enPath)) {
  fail('i18n dictionaries', 'Missing zh-CN.yml or en.yml');
} else {
  const zhMap = parseSimpleYaml(zhPath);
  const enMap = parseSimpleYaml(enPath);
  i18nKeys = new Set(zhMap.keys());
  const missingInEn = [...zhMap.keys()].filter(k => !enMap.has(k));
  const extraInEn = [...enMap.keys()].filter(k => !zhMap.has(k));
  const emptyVals = [...zhMap.entries(), ...enMap.entries()]
    .filter(([, v]) => !String(v).trim())
    .map(([k]) => k);
  const badPrintf = [...zhMap.keys()].filter(k => {
    if (!enMap.has(k)) return false;
    const zc = (zhMap.get(k).match(/%s/g) || []).length;
    const ec = (enMap.get(k).match(/%s/g) || []).length;
    return zc !== ec;
  });

  if (missingInEn.length || extraInEn.length || emptyVals.length || badPrintf.length) {
    fail(
      'i18n parity check',
      [
        missingInEn.length ? `missing in en: ${missingInEn.join(',')}` : '',
        extraInEn.length ? `extra in en: ${extraInEn.join(',')}` : '',
        emptyVals.length ? `empty: ${emptyVals.join(',')}` : '',
        badPrintf.length ? `%s mismatch: ${badPrintf.join(',')}` : ''
      ]
        .filter(Boolean)
        .join(' | ')
    );
  } else {
    pass('i18n parity check', `${zhMap.size} symmetric keys in zh-CN & en`);
  }
}

/* 4. Hardcoded CJK sweep in templates & JS ----------------- */
const codeFiles = [
  ...walk(path.join(themeRoot, 'layout'), ['.ejs']),
  ...walk(path.join(themeRoot, 'source', 'js'), ['.js']),
  ...walk(path.join(themeRoot, 'scripts'), ['.js'])
];
const cjkHits = [];
for (const file of codeFiles) {
  const clean = stripComments(fs.readFileSync(file, 'utf8'), file.endsWith('.ejs'));
  clean.split(/\r?\n/).forEach((line, idx) => {
    if (/[\u4e00-\u9fff]/.test(line)) {
      cjkHits.push(`${path.relative(themeRoot, file)}:${idx + 1}`);
    }
  });
}
if (cjkHits.length) fail('Zero hardcoded UI CJK', cjkHits.slice(0, 10).join(', '));
else pass('Zero hardcoded UI CJK', `${codeFiles.length} layout/script files clean`);

/* 5. Version & documentation checks ------------------------ */
let pkgVersion = '';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(themeRoot, 'package.json'), 'utf8'));
  pkgVersion = pkg.version || '';
  const changelog = fs.readFileSync(path.join(themeRoot, 'CHANGELOG.md'), 'utf8');
  const hasVerSection = new RegExp(`^##\\s+${pkgVersion.replace(/\./g, '\\.')}\\b`, 'm').test(changelog);
  const hasDocs =
    fs.existsSync(path.join(themeRoot, 'README.md')) &&
    fs.existsSync(path.join(themeRoot, 'UPGRADE.md'));
  if (!pkgVersion || !hasVerSection || !hasDocs) {
    fail('Version & docs', `version=${pkgVersion}, changelogMatch=${hasVerSection}, docs=${hasDocs}`);
  } else {
    pass('Version & docs', `v${pkgVersion} matches CHANGELOG, README & UPGRADE present`);
  }
} catch (error) {
  fail('Version & docs', error.message);
}

/* 6. Built site regression checks (optional --site) -------- */
if (siteArg) {
  const siteRoot = path.resolve(siteArg);
  const pub = path.join(siteRoot, 'public');
  const requiredPublic = [
    'index.html',
    'search.json',
    'posts.json',
    '404.html',
    path.join('css', 'lume.css')
  ];
  const missingPub = requiredPublic.filter(rel => !fs.existsSync(path.join(pub, rel)));
  const obsoletePub = [path.join('css', 'main.css'), path.join('css', 'pop.css')].filter(rel =>
    fs.existsSync(path.join(pub, rel))
  );

  if (missingPub.length || obsoletePub.length) {
    fail('Built artifacts presence', `missing=[${missingPub.join(',')}] obsolete=[${obsoletePub.join(',')}]`);
  } else {
    pass('Built artifacts presence', 'Required outputs present, obsolete CSS absent');
  }

  try {
    const idx = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
    const cssLinks = idx.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi) || [];
    const expectedHref = `/css/lume.css?v=${pkgVersion}`;
    const hasExpectedCss = cssLinks.length === 1 && cssLinks[0].includes(expectedHref);
    const hasNavPill = idx.includes('data-nav-pill');
    const hasSearchAction = idx.includes('/?q={search_term_string}');

    if (!hasExpectedCss || !hasNavPill || !hasSearchAction) {
      fail(
        'Built index.html checks',
        `cssLinks=${cssLinks.length}, expectedHref=${hasExpectedCss}, navPill=${hasNavPill}, searchAction=${hasSearchAction}`
      );
    } else {
      pass('Built index.html checks', `1 stylesheet (${expectedHref}), nav pill & SearchAction OK`);
    }

    const notFound = fs.readFileSync(path.join(pub, '404.html'), 'utf8');
    if (/noindex/i.test(notFound)) pass('Built 404.html robots', 'noindex directive present');
    else fail('Built 404.html robots', 'missing noindex');

    const searchData = JSON.parse(fs.readFileSync(path.join(pub, 'search.json'), 'utf8'));
    const postsData = JSON.parse(fs.readFileSync(path.join(pub, 'posts.json'), 'utf8'));
    if (
      Array.isArray(searchData) &&
      Array.isArray(postsData) &&
      searchData.length > 0 &&
      searchData.length === postsData.length
    ) {
      pass('Built JSON feeds', `${postsData.length} posts in posts.json & search.json`);
    } else {
      fail('Built JSON feeds', 'Invalid or mismatched search.json / posts.json');
    }

    const htmlFiles = walk(pub, ['.html']);
    const i18nLeaks = [];
    for (const hf of htmlFiles) {
      const stripped = fs
        .readFileSync(hf, 'utf8')
        .replace(/<(script|style|pre|code)\b[\s\S]*?<\/\1>/gi, ' ');
      if (/%s/.test(stripped)) {
        i18nLeaks.push(`${path.relative(pub, hf)}: literal %s`);
      }
      const attrMatches = stripped.matchAll(/(?:title|aria-label|placeholder|data-label-[a-z-]+)="([^"]+)"/gi);
      for (const m of attrMatches) {
        if (i18nKeys.has(m[1])) {
          i18nLeaks.push(`${path.relative(pub, hf)}: unresolved key "${m[1]}"`);
        }
      }
    }
    if (i18nLeaks.length) fail('Built i18n resolution', i18nLeaks.slice(0, 8).join('; '));
    else pass('Built i18n resolution', `${htmlFiles.length} HTML files clean`);
  } catch (error) {
    fail('Built site validation', error.message);
  }
}

console.log(`\nQA_SUMMARY failures=${failures}`);
process.exit(failures === 0 ? 0 : 1);
