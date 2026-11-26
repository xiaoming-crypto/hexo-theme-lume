'use strict';

/*
 * Lume custom Hexo tag plugins:
 * - {% gallery [cols] %} ... {% endgallery %}
 * - {% tabs [syncGroup] %} <!-- tab Title --> ... <!-- endtab --> {% endtabs %}
 */

let tabsCounter = 0;

function extractTagImages(html) {
  const images = [];
  let match;
  const re = /<img\b([^>]*)>/gi;
  while ((match = re.exec(html)) !== null) {
    let attrs = match[1];
    if (!/\bloading\s*=/i.test(attrs)) attrs += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(attrs)) attrs += ' decoding="async"';
    const altMatch = attrs.match(/\balt\s*=\s*"([^"]*)"/i);
    const alt = altMatch ? altMatch[1].trim() : '';
    images.push(
      '<figure class="lume-gallery__item">' +
      `<img${attrs}>` +
      (alt ? `<figcaption>${alt}</figcaption>` : '') +
      '</figure>'
    );
  }
  return images;
}

hexo.extend.tag.register('gallery', function (args, content) {
  const rendered = hexo.render.renderSync({ text: String(content || '').trim(), engine: 'markdown' });
  const items = extractTagImages(rendered);
  if (!items.length) return rendered;
  const requested = parseInt(args[0], 10);
  const cols = requested >= 2 && requested <= 4 ? requested : Math.min(items.length, 3);
  return `<div class="lume-gallery" data-cols="${cols}">${items.join('')}</div>`;
}, { ends: true });

hexo.extend.tag.register('tabs', function (args, content) {
  const syncGroup = args && args[0] ? String(args[0]).trim() : '';
  const raw = String(content || '');
  const panes = [];
  const startRe = /<!--\s*tab\s+([^>]+?)\s*-->/gi;
  const matches = [];
  let m;
  while ((m = startRe.exec(raw)) !== null) {
    matches.push({ title: m[1].trim(), bodyStart: m.index + m[0].length, headerStart: m.index });
  }

  matches.forEach((entry, i) => {
    const endBound = i + 1 < matches.length ? matches[i + 1].headerStart : raw.length;
    let body = raw.slice(entry.bodyStart, endBound);
    body = body.replace(/<!--\s*endtab\s*-->[\s\S]*$/i, '').trim();
    panes.push({
      title: entry.title || `Tab ${i + 1}`,
      html: hexo.render.renderSync({ text: body, engine: 'markdown' })
    });
  });

  if (!panes.length) {
    return hexo.render.renderSync({ text: raw.trim(), engine: 'markdown' });
  }

  const groupId = `lume-tabs-${++tabsCounter}`;
  const syncAttr = syncGroup
    ? ` data-tabs-sync="${syncGroup.replace(/"/g, '&quot;')}"`
    : '';

  const buttons = panes.map((pane, idx) => {
    const active = idx === 0;
    return (
      `<button class="lume-tabs__tab" type="button" role="tab" ` +
      `id="${groupId}-tab-${idx}" aria-controls="${groupId}-panel-${idx}" ` +
      `aria-selected="${active ? 'true' : 'false'}" ` +
      `tabindex="${active ? '0' : '-1'}" data-tab-index="${idx}">` +
      `${pane.title}</button>`
    );
  }).join('');

  const panels = panes.map((pane, idx) => {
    const active = idx === 0;
    return (
      `<div class="lume-tabs__panel" role="tabpanel" ` +
      `id="${groupId}-panel-${idx}" aria-labelledby="${groupId}-tab-${idx}"` +
      `${active ? '' : ' hidden'}>${pane.html}</div>`
    );
  }).join('');

  return (
    `<div class="lume-tabs" data-tabs${syncAttr}>` +
    `<div class="lume-tabs__bar" role="tablist">${buttons}</div>` +
    `<div class="lume-tabs__panels">${panels}</div>` +
    '</div>'
  );
}, { ends: true });
