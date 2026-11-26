'use strict';

/*
 * Lume generators
 * The theme stays self-contained: search index and 404 page are generated
 * from the theme itself, no extra plugin required. Search itself lives in
 * the header overlay, so no standalone /search/ page is produced.
 */

const util = require('hexo-util');
const stripHTML = util.stripHTML || (html => String(html || '').replace(/<[^>]*>/g, ''));
const unescapeHTML =
  util.unescapeHTML ||
  (text =>
    String(text || '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"));

function toPlain(html) {
  return unescapeHTML(stripHTML(String(html || '')))
    .replace(/\s+/g, ' ')
    .trim();
}

function names(collection) {
  if (!collection) return [];
  if (typeof collection.toArray === 'function') {
    return collection.toArray().map(item => item.name);
  }
  return collection.map(item => (typeof item === 'string' ? item : item.name));
}

function iso(value) {
  if (!value) return '';
  if (typeof value.toISOString === 'function') return value.toISOString();
  return new Date(value).toISOString();
}

hexo.extend.generator.register('lume', function (locals) {
  const config = this.config;
  const root = config.root.endsWith('/') ? config.root : `${config.root}/`;
  const readingTime = hexo.extend.helper.get('lume_reading_time');
  const pages = locals.pages && locals.pages.toArray ? locals.pages.toArray() : [];
  const hasPage = path =>
    pages.some(page => {
      const value = String(page.path || '');
      return value === path || value === path.replace(/index\.html$/, '');
    });

  const index = locals.posts
    .sort('-date')
    .map(post => {
      const content = toPlain(post.content).slice(0, 4000);

      return {
        title: post.title || '',
        url: `${root}${post.path}`,
        date: iso(post.date),
        updated: iso(post.updated),
        tags: names(post.tags),
        categories: names(post.categories),
        cover: post.cover || '',
        excerpt: toPlain(post.description || post.excerpt || content).slice(0, 180),
        content,
        minutes: readingTime ? readingTime.call({}, post.content) : 1,
      };
    });

  const postsLite = index.map(item => ({
    title: item.title,
    url: item.url,
    date: item.date,
    categories: item.categories,
    tags: item.tags,
  }));

  const routes = [
    {
      path: 'search.json',
      data: JSON.stringify(index),
    },
    {
      path: 'posts.json',
      data: JSON.stringify(postsLite),
    },
  ];

  if (!hasPage('404.html')) {
    routes.push({
      path: '404.html',
      layout: '404',
      data: {
        layout: '404',
        path: '404.html',
      },
    });
  }

  return routes;
});
