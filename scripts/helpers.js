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
