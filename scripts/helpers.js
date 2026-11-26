'use strict';

/*
 * Lume helpers
 * Text utilities shared by templates and the search index generator.
 */

const fs = require('fs');
const path = require('path');
const util = require('hexo-util');

const THEME_VERSION = (() => {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg && pkg.version ? String(pkg.version) : '0.17.0';
  } catch (error) {
    return '0.17.0';
  }
})();

const stripHTML =
  util.stripHTML ||
  (input => String(input || '').replace(/<[^>]*>/g, ''));

const unescapeHTML =
  util.unescapeHTML ||
  (input =>
    String(input || '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"));

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;

function plain(input) {
  return unescapeHTML(stripHTML(String(input || '')))
    .replace(/\s+/g, ' ')
    .trim();
}

function countText(input) {
  const text = plain(input);
  const cjk = (text.match(CJK) || []).length;
  const latin = (
    text
      .replace(CJK, ' ')
      .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []
  ).length;

  return { cjk, latin, total: cjk + latin };
}

hexo.extend.helper.register('lume_plain', plain);

hexo.extend.helper.register('lume_reading_time', function (content) {
  const { cjk, latin } = countText(content);
  return Math.max(1, Math.round(cjk / 320 + latin / 210));
});

hexo.extend.helper.register('lume_word_count', function (content) {
  return countText(content).total;
});

hexo.extend.helper.register('lume_excerpt', function (post, length) {
  const source = post && (post.description || post.excerpt || post.content);
  const text = plain(source);
  const max = Number(length) || 120;

  if (text.length <= max) return text;

  return (
    text
      .slice(0, max)
      .replace(/[\s,，。、；;：:·\-—]+$/g, '')
      .trim() + '…'
  );
});

hexo.extend.helper.register('lume_version', function () {
  return THEME_VERSION;
});

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.toArray === 'function') return collection.toArray();
  return Array.isArray(collection.data) ? collection.data : [];
}

function collectNames(collection) {
  return toArray(collection)
    .map(item => String((item && (item.slug || item.name)) || '').trim().toLowerCase())
    .filter(Boolean);
}

function dateTimestamp(post) {
  if (!post || !post.date) return 0;
  return typeof post.date.valueOf === 'function' ? post.date.valueOf() : Number(post.date) || 0;
}

hexo.extend.helper.register('lume_related_posts', function (post, limit) {
  const max = Math.max(0, Number(limit) || 3);
  if (!post || !max) return [];

  const all = toArray(this.site && this.site.posts).filter(
    item => item && item.path && item.path !== post.path
  );
  if (!all.length) return [];

  const tags = new Set(collectNames(post.tags));
  const categories = new Set(collectNames(post.categories));
  const series = String(post.series || '').trim();

  const scored = all.map(candidate => {
    let score = 0;
    const candidateSeries = String(candidate.series || '').trim();
    if (series && candidateSeries && candidateSeries === series) score += 4;

    collectNames(candidate.tags).forEach(tag => {
      if (tags.has(tag)) score += 3;
    });
    collectNames(candidate.categories).forEach(cat => {
      if (categories.has(cat)) score += 2;
    });

    return { post: candidate, score, time: dateTimestamp(candidate) };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.time - a.time;
  });

  const matched = scored.filter(entry => entry.score > 0).slice(0, max);
  if (matched.length) return matched.map(entry => entry.post);
  return scored.slice(0, max).map(entry => entry.post);
});

hexo.extend.helper.register('lume_series_posts', function (post) {
  const series = post ? String(post.series || '').trim() : '';
  if (!series) return [];

  const matches = toArray(this.site && this.site.posts).filter(
    item => item && String(item.series || '').trim() === series
  );

  matches.sort((a, b) => {
    const rawA = a.series_order;
    const rawB = b.series_order;
    const hasA = rawA !== undefined && rawA !== null && String(rawA).trim() !== '' && Number.isFinite(Number(rawA));
    const hasB = rawB !== undefined && rawB !== null && String(rawB).trim() !== '' && Number.isFinite(Number(rawB));
    if (hasA && hasB && Number(rawA) !== Number(rawB)) {
      return Number(rawA) - Number(rawB);
    }
    if (hasA !== hasB) return hasA ? -1 : 1;
    return dateTimestamp(a) - dateTimestamp(b);
  });

  return matches;
});

const LUME_ICONS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1Z"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  train: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21l2-3M16 21l-2-3"/><circle cx="9" cy="14.5" r="1"/><circle cx="15" cy="14.5" r="1"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="8.5" cy="15.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3Z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>',
  fish: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6-3.56 0-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M2 8.5 6 12 2 15.5Z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  expand: '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
  shrink: '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"/>',
  lightbulb: '<path d="M9 18h6M10 21h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.6 4.6 0 0 1 8.91 14"/>',
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  'alert-triangle': '<path d="m10.29 3.86-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>',
  'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  'x-octagon': '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><path d="m15 9-6 6M9 9l6 6"/>'
};

hexo.extend.helper.register('lume_icon', function (name, extraClass) {
  const body = LUME_ICONS[name];
  if (!body) return '';
  const cls = extraClass ? `lume-ico ${extraClass}` : 'lume-ico';
  return (
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
    `aria-hidden="true" focusable="false">${body}</svg>`
  );
});
