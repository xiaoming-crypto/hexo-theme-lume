'use strict';

/*
 * Lume content filters
 * - GitHub style callouts:  > [!TIP]
 * - responsive / lazy images + figure captions
 * - safe external links
 * - stable heading ids so the TOC can always resolve its anchors
 */

const CALLOUTS = {
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
  INFO: 'Info',
  SUCCESS: 'Success',
  DANGER: 'Danger',
};

const CALLOUT_RE = /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|SUCCESS|DANGER)\]\s*(?:<br\s*\/?>)?\s*([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi;

function renderCallouts(content) {
  return content.replace(CALLOUT_RE, (match, type, first, rest) => {
    const key = type.toUpperCase();
    const label = CALLOUTS[key];

    return (
      `<aside class="callout callout--${key.toLowerCase()}" role="note">` +
      `<p class="callout__label">${label}</p>` +
      `<div class="callout__body"><p>${first}</p>${rest}</div>` +
      '</aside>'
    );
  });
}

function enhanceImages(content) {
  let html = content.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    let next = attrs;

    if (!/\bloading\s*=/i.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(next)) next += ' decoding="async"';

    return `<img${next}>`;
  });

  html = html.replace(
    /<p>\s*(<img\b[^>]*>)\s*<\/p>/gi,
    (match, image) => {
      const altMatch = image.match(/\balt\s*=\s*"([^"]*)"/i);
      const alt = altMatch ? altMatch[1].trim() : '';

      return (
        '<figure class="post-figure">' +
        image +
        (alt ? `<figcaption>${alt}</figcaption>` : '') +
        '</figure>'
      );
    }
  );

  return html;
}

function secureLinks(content) {
  return content.replace(/<a\b([^>]*\btarget\s*=\s*"_blank"[^>]*)>/gi, (match, attrs) => {
    if (/\brel\s*=/i.test(attrs)) return match;
    return `<a${attrs} rel="noopener noreferrer">`;
  });
}

function slugifyHeading(html) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, '')
    .trim()
    .toLowerCase();
  const slug = text
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'section';
}

function ensureHeadingIds(content) {
  const used = new Set();

  return content.replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
    let id = '';
    const idMatch = attrs.match(/\bid\s*=\s*"([^"]*)"/i);
    if (idMatch) id = idMatch[1].trim();

    const base = id || slugifyHeading(inner);
    let next = base;
    let n = 1;
    while (used.has(next)) {
      n += 1;
      next = `${base}-${n}`;
    }
    used.add(next);

    if (next === id) return match;

    const cleanAttrs = id ? attrs.replace(/\s*\bid\s*=\s*"[^"]*"/i, '') : attrs;
    return `<h${level}${cleanAttrs} id="${next}">${inner}</h${level}>`;
  });
}

hexo.extend.filter.register('after_post_render', function (data) {
  if (!data.content) return data;

  data.content = renderCallouts(data.content);
  data.content = enhanceImages(data.content);
  data.content = secureLinks(data.content);
  data.content = ensureHeadingIds(data.content);

  return data;
});
