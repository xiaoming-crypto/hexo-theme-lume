'use strict';

/*
 * Lume content filters
 * - GitHub style callouts:  > [!TIP]
 * - responsive / lazy images + figure captions
 * - safe external links
 * - stable heading ids so the TOC can always resolve its anchors
 */

const CALLOUTS = {
  NOTE: { label: 'Note', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>' },
  TIP: { label: 'Tip', svg: '<path d="M9 18h6M10 21h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.6 4.6 0 0 1 8.91 14"/>' },
  IMPORTANT: { label: 'Important', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>' },
  WARNING: { label: 'Warning', svg: '<path d="m10.29 3.86-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>' },
  CAUTION: { label: 'Caution', svg: '<path d="m10.29 3.86-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.71-3.14l-8-14a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/>' },
  INFO: { label: 'Info', svg: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>' },
  SUCCESS: { label: 'Success', svg: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>' },
  DANGER: { label: 'Danger', svg: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><path d="m15 9-6 6M9 9l6 6"/>' },
};

const CALLOUT_RE = /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|SUCCESS|DANGER)\]\s*(?:<br\s*\/?>)?\s*([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi;

function renderCallouts(content) {
  return content.replace(CALLOUT_RE, (match, type, first, rest) => {
    const key = type.toUpperCase();
    const item = CALLOUTS[key];
    const icon =
      `<span class="callout__icon" aria-hidden="true">` +
      `<svg class="lume-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${item.svg}</svg>` +
      '</span>';

    return (
      `<aside class="callout callout--${key.toLowerCase()}" role="note">` +
      `${icon}` +
      `<p class="callout__label">${item.label}</p>` +
      `<div class="callout__body"><p>${first}</p>${rest}</div>` +
      '</aside>'
    );
  });
}

function wrapFigure(image, itemClass) {
  const altMatch = image.match(/\balt\s*=\s*"([^"]*)"/i);
  const alt = altMatch ? altMatch[1].trim() : '';
  return (
    `<figure class="${itemClass}">` +
    image +
    (alt ? `<figcaption>${alt}</figcaption>` : '') +
    '</figure>'
  );
}

function enhanceImages(content) {
  let html = content.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    let next = attrs;

    if (!/\bloading\s*=/i.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(next)) next += ' decoding="async"';

    return `<img${next}>`;
  });

  html = html.replace(
    /<p>\s*((?:<img\b[^>]*>(?:\s|<br\s*\/?>)*){2,})\s*<\/p>/gi,
    (match, group) => {
      const imgs = group.match(/<img\b[^>]*>/gi) || [];
      if (imgs.length < 2) return match;
      const cols = Math.min(imgs.length, 3);
      return `<div class="lume-gallery" data-cols="${cols}">${imgs.map(img => wrapFigure(img, 'lume-gallery__item')).join('')}</div>`;
    }
  );

  html = html.replace(
    /<p>\s*(<img\b[^>]*>)\s*<\/p>/gi,
    (match, image) => wrapFigure(image, 'post-figure')
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
