'use strict';

/*
 * Lume helpers
 * Text utilities shared by templates and the search index generator.
 */

const util = require('hexo-util');

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
