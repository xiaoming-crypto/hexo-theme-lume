'use strict';

/*
 * Lume content filters
 * - GitHub style callouts:  > [!TIP]
 * - responsive / lazy images + intrinsic dimensions + figure captions
 * - safe external links
 * - stable heading ids so the TOC can always resolve its anchors
 */

const fs = require('fs');
const path = require('path');

const IMAGE_SIZE_CACHE = new Map();
const MAX_DIMENSION = 20000;

function validSize(width, height) {
  const w = Math.round(Number(width));
  const h = Math.round(Number(height));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > MAX_DIMENSION || h > MAX_DIMENSION) {
    return null;
  }
  return { width: w, height: h };
}

function parsePngSize(buf) {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return validSize(buf.readUInt32BE(16), buf.readUInt32BE(20));
}

function parseGifSize(buf) {
  if (buf.length < 10) return null;
  const sig = buf.toString('ascii', 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return validSize(buf.readUInt16LE(6), buf.readUInt16LE(8));
}

function parseJpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < buf.length) {
    while (offset < buf.length && buf[offset] !== 0xff) offset += 1;
    while (offset < buf.length && buf[offset] === 0xff) offset += 1;
    if (offset >= buf.length) break;
    const marker = buf[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xda || offset + 2 > buf.length) break;
    const segLen = buf.readUInt16BE(offset);
    if (segLen < 2 || offset + segLen > buf.length) break;
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 7 <= buf.length) {
      return validSize(buf.readUInt16BE(offset + 5), buf.readUInt16BE(offset + 3));
    }
    offset += segLen;
  }
  return null;
}

function parseWebpSize(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return validSize(buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return validSize((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8X') {
    return validSize(1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3));
  }
  return null;
}

function parseSvgSize(buf) {
  const head = buf.toString('utf8', 0, Math.min(buf.length, 4096));
  const tagMatch = head.match(/<svg\b([^>]*)>/i);
  if (!tagMatch) return null;
  const attrs = tagMatch[1];
  const vbMatch = attrs.match(/\bviewBox\s*=\s*["']\s*([^"']+)["']/i);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      const size = validSize(parts[2], parts[3]);
      if (size) return size;
    }
  }
  const wMatch = attrs.match(/\bwidth\s*=\s*["']\s*(\d+(?:\.\d+)?)(?:px)?\s*["']/i);
  const hMatch = attrs.match(/\bheight\s*=\s*["']\s*(\d+(?:\.\d+)?)(?:px)?\s*["']/i);
  if (wMatch && hMatch) {
    return validSize(parseFloat(wMatch[1]), parseFloat(hMatch[1]));
  }
  return null;
}

function getLocalImageSize(src, sourceDir) {
  if (!src || typeof src !== 'string' || !sourceDir) return null;
  const trimmed = src.trim();
  if (!trimmed || /^(?:https?:|data:|blob:|\/\/)/i.test(trimmed)) return null;

  let clean = trimmed.split('#')[0].split('?')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch (error) {
    /* keep raw */
  }
  const rel = clean.replace(/^\/+/, '');
  if (!rel) return null;

  const rootDir = path.resolve(sourceDir);
  const filePath = path.resolve(rootDir, rel);
  const relToRoot = path.relative(rootDir, filePath);
  if (!relToRoot || relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) return null;

  if (IMAGE_SIZE_CACHE.has(filePath)) return IMAGE_SIZE_CACHE.get(filePath);

  let result = null;
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isFile() && stat.size >= 12 && stat.size <= 16 * 1024 * 1024) {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.png' || ext === '.gif' || ext === '.webp' || ext === '.jpg' || ext === '.jpeg' || ext === '.svg') {
          let buf;
          if (ext === '.jpg' || ext === '.jpeg') {
            buf = fs.readFileSync(filePath);
          } else {
            const readLen = ext === '.svg' ? Math.min(stat.size, 8192) : Math.min(stat.size, 64);
            const fd = fs.openSync(filePath, 'r');
            try {
              buf = Buffer.alloc(readLen);
              const bytesRead = fs.readSync(fd, buf, 0, readLen, 0);
              buf = buf.subarray(0, bytesRead);
            } finally {
              fs.closeSync(fd);
            }
          }
          if (ext === '.png') result = parsePngSize(buf);
          else if (ext === '.gif') result = parseGifSize(buf);
          else if (ext === '.webp') result = parseWebpSize(buf);
          else if (ext === '.jpg' || ext === '.jpeg') result = parseJpegSize(buf);
          else if (ext === '.svg') result = parseSvgSize(buf);
        }
      }
    }
  } catch (error) {
    result = null;
  }

  IMAGE_SIZE_CACHE.set(filePath, result);
  return result;
}

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

function enhanceImages(content, sourceDir) {
  let html = content.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    let next = attrs;

    if (!/(?:^|\s)loading\s*=/i.test(next)) next += ' loading="lazy"';
    if (!/(?:^|\s)decoding\s*=/i.test(next)) next += ' decoding="async"';
    if (!/(?:^|\s)width\s*=/i.test(next) && !/(?:^|\s)height\s*=/i.test(next) && sourceDir) {
      const srcMatch = next.match(/(?:^|\s)src\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const srcVal = srcMatch ? (srcMatch[1] || srcMatch[2] || '') : '';
      if (srcVal) {
        const size = getLocalImageSize(srcVal, sourceDir);
        if (size) {
          next += ` width="${size.width}" height="${size.height}"`;
        }
      }
    }

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

  const sourceDir = (this && this.source_dir) || (typeof hexo !== 'undefined' && hexo.source_dir) || '';
  data.content = renderCallouts(data.content);
  data.content = enhanceImages(data.content, sourceDir);
  data.content = secureLinks(data.content);
  data.content = ensureHeadingIds(data.content);

  return data;
});
