(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionQuery.matches;

  var flags = {
    router: root.getAttribute('data-router') !== 'false',
    reveal: root.getAttribute('data-reveal-motion') !== 'false',
    parallax: root.getAttribute('data-parallax') !== 'false',
    peek: root.getAttribute('data-peek') !== 'false',
    ripple: root.getAttribute('data-ripple') !== 'false'
  };

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function label(name, fallback) {
    var value = root.getAttribute('data-label-' + name);
    return value || fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  var scrollState = {
    y: window.pageYOffset || 0,
    lastY: window.pageYOffset || 0,
    ticking: false,
    hero: null,
    cover: null,
    header: null,
    toTop: null,
    ring: null,
    menuOpen: false
  };

  /* Theme ---------------------------------------------------- */
  function readStoredTheme() {
    try {
      return window.localStorage.getItem('lume-theme');
    } catch (error) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem('lume-theme', theme);
    } catch (error) {
      /* ignore */
    }
  }

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function syncThemeButton(theme) {
    var button = $('[data-theme-toggle]');
    if (button) button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  function syncGiscus(theme) {
    var frame = $('iframe.giscus-frame');
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      { giscus: { setConfig: { theme: theme === 'dark' ? 'dark' : 'light' } } },
      'https://giscus.app'
    );
  }

  function setTheme(theme, silent) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    syncThemeButton(theme);
    if (!silent) storeTheme(theme);
    syncGiscus(theme);
  }

  function toggleTheme(event) {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    var x = event && typeof event.clientX === 'number' ? event.clientX : window.innerWidth - 48;
    var y = event && typeof event.clientY === 'number' ? event.clientY : 48;
    var apply = function () {
      setTheme(next);
    };

    if (!reduceMotion && flags.ripple && typeof document.startViewTransition === 'function') {
      root.classList.add('theme-vt');
      var transition = document.startViewTransition(apply);
      transition.ready
        .then(function () {
          var radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
          );
          root.animate(
            {
              clipPath: [
                'circle(0px at ' + x + 'px ' + y + 'px)',
                'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'
              ]
            },
            {
              duration: 560,
              easing: 'cubic-bezier(.22,1,.36,1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        })
        .catch(function () {});
      transition.finished
        .catch(function () {})
        .then(function () {
          root.classList.remove('theme-vt');
          window.setTimeout(function () {
            root.classList.remove('is-theme-changing');
          }, 80);
        });
    } else {
      root.classList.add('is-theme-changing');
      apply();
      window.setTimeout(function () {
        root.classList.remove('is-theme-changing');
      }, 430);
    }
  }

  function initTheme() {
    var button = $('[data-theme-toggle]');
    syncThemeButton(currentTheme());
    if (button) {
      button.addEventListener('click', toggleTheme);
    }

    var scheme = root.getAttribute('data-scheme') || 'auto';
    if (scheme === 'auto' && typeof motionQuery.addEventListener === 'function') {
      var onSchemeChange = function (event) {
        if (!readStoredTheme()) setTheme(event.matches ? 'dark' : 'light', true);
      };
      if (typeof window.matchMedia('(prefers-color-scheme: dark)').addEventListener === 'function') {
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', onSchemeChange);
      }
    }
  }

  /* Scroll: progress, header, hero, cover, to-top ------------- */
  function refreshScrollTargets() {
    scrollState.hero = $('[data-hero]');
    var cover = $('[data-post-cover] .post-cover__frame');
    scrollState.cover = cover;
  }

  function updateScroll() {
    var y = window.pageYOffset || 0;
    var max = Math.max(1, root.scrollHeight - window.innerHeight);
    var ratio = clamp(y / max, 0, 1);

    if (scrollState.header) {
      scrollState.header.classList.toggle('is-scrolled', y > 8);
      if (!scrollState.menuOpen && y > 220 && y > scrollState.lastY + 4) {
        scrollState.header.classList.add('is-hidden');
      } else if (y < scrollState.lastY - 4 || y < 120 || scrollState.menuOpen) {
        scrollState.header.classList.remove('is-hidden');
      }
    }

    if (scrollState.toTop) {
      scrollState.toTop.classList.toggle('is-on', ratio > 0.06);
    }

    if (scrollState.ring) {
      scrollState.ring.style.strokeDashoffset = String(119.4 * (1 - ratio));
    }

    if (scrollState.hero && flags.parallax && !reduceMotion) {
      var heroRect = scrollState.hero.getBoundingClientRect();
      if (heroRect.bottom > 0 && heroRect.top < window.innerHeight) {
        var p = clamp(-heroRect.top / (heroRect.height * 0.92), 0, 1);
        scrollState.hero.style.setProperty('--p', p.toFixed(3));
      }
    }

    if (scrollState.cover && flags.parallax && !reduceMotion) {
      var coverRect = scrollState.cover.getBoundingClientRect();
      if (coverRect.bottom > 0 && coverRect.top < window.innerHeight) {
        var cp = (coverRect.top + coverRect.height / 2 - window.innerHeight / 2) / window.innerHeight;
        scrollState.cover.style.setProperty('--py', (cp * -16).toFixed(1) + 'px');
      }
    }

    scrollState.lastY = y;
    scrollState.ticking = false;
    updateTOCActive();
  }

  function requestScrollUpdate() {
    if (scrollState.ticking) return;
    scrollState.ticking = true;
    window.requestAnimationFrame(updateScroll);
  }

  function initScroll() {
    scrollState.header = $('[data-header]');
    scrollState.toTop = $('[data-to-top]');
    scrollState.ring = $('[data-to-top-ring]');
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate, { passive: true });
    requestScrollUpdate();
  }

  /* Reveal --------------------------------------------------- */
  var revealObserver = null;

  function revealAll(scope) {
    $$('[data-reveal]', scope).forEach(function (element) {
      element.classList.add('is-in');
    });
  }

  function initReveal(scope) {
    var area = scope || document;
    if (!flags.reveal || reduceMotion || !('IntersectionObserver' in window)) {
      revealAll(area);
      return;
    }

    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
      );
    }

    $$('[data-reveal]', area).forEach(function (element) {
      if (element.classList.contains('is-in')) return;
      revealObserver.observe(element);
    });
  }

  /* Cursor cover peek ---------------------------------------- */
  function initPeek() {
    if (!flags.peek) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var peek = $('[data-peek]');
    if (!peek) return;
    var image = $('[data-peek-img]', peek);
    var state = { active: false, shown: false, x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
    var width = 280;
    var height = 192;

    function frame() {
      state.x += (state.tx - state.x) * 0.18;
      state.y += (state.ty - state.y) * 0.18;
      peek.style.setProperty('--x', state.x.toFixed(1) + 'px');
      peek.style.setProperty('--y', state.y.toFixed(1) + 'px');

      if (state.active || Math.abs(state.tx - state.x) > 0.4 || Math.abs(state.ty - state.y) > 0.4) {
        state.raf = window.requestAnimationFrame(frame);
      } else {
        state.raf = 0;
      }
    }

    function start() {
      if (!state.raf) state.raf = window.requestAnimationFrame(frame);
    }

    function place(event) {
      var gap = 28;
      var cx = event.clientX + gap + width / 2;
      if (cx + width / 2 > window.innerWidth - 18) {
        cx = event.clientX - gap - width / 2;
      }
      var cy = clamp(event.clientY, height / 2 + 18, window.innerHeight - height / 2 - 18);
      state.tx = cx;
      state.ty = cy;
      if (!state.shown) {
        state.x = cx;
        state.y = cy;
        state.shown = true;
        peek.style.setProperty('--x', cx + 'px');
        peek.style.setProperty('--y', cy + 'px');
      }
      start();
    }

    function show(entry, event) {
      var src = entry.getAttribute('data-cover');
      if (!src) return;
      if (image.getAttribute('src') !== src) {
        image.classList.remove('is-loaded');
        image.src = src;
        if (image.complete && image.naturalWidth) image.classList.add('is-loaded');
      }
      state.active = true;
      peek.classList.add('is-on');
      place(event);
    }

    function hide() {
      state.active = false;
      state.shown = false;
      peek.classList.remove('is-on');
    }

    document.addEventListener(
      'pointerover',
      function (event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        var entry = event.target.closest ? event.target.closest('.entry[data-cover]') : null;
        if (!entry) return;
        if (event.relatedTarget && entry.contains(event.relatedTarget)) return;
        show(entry, event);
      },
      { passive: true }
    );

    document.addEventListener(
      'pointerout',
      function (event) {
        var entry = event.target.closest ? event.target.closest('.entry[data-cover]') : null;
        if (!entry) return;
        if (event.relatedTarget && entry.contains(event.relatedTarget)) return;
        hide();
      },
      { passive: true }
    );

    document.addEventListener(
      'pointermove',
      function (event) {
        if (!state.active) return;
        place(event);
      },
      { passive: true }
    );

    window.addEventListener('scroll', hide, { passive: true });

    if (image) {
      image.addEventListener('load', function () {
        image.classList.add('is-loaded');
      });
    }
  }

  /* Images, tables, code, TOC, comments ----------------------- */
  function initImages() {
    $$('.post-body img, .about__avatar img').forEach(function (image) {
      if (image.hasAttribute('data-lume-img')) return;
      image.setAttribute('data-lume-img', '1');

      var done = function () {
        image.classList.add('is-loaded');
      };

      if (image.complete && image.naturalWidth) done();
      else {
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
      }
    });
  }

  function initCoverFallback() {
    var frame = $('[data-post-cover] .post-cover__frame');
    if (!frame) return;
    var image = $('img', frame);
    var wrapper = frame.closest ? frame.closest('[data-post-cover]') : frame;
    if (!image) {
      wrapper.style.display = 'none';
      return;
    }
    var fail = function () {
      if (!image.naturalWidth) wrapper.style.display = 'none';
    };
    if (image.complete) fail();
    image.addEventListener('error', fail);
    image.addEventListener('load', fail);
  }

  function initTables() {
    $$('.post-body table').forEach(function (table) {
      if (table.closest('figure.highlight')) return;
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function legacyCopy(text) {
    try {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch (error) {
      return false;
    }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function langLabel(language) {
    var value = String(language || '').toLowerCase();
    var map = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      bash: 'Shell',
      sh: 'Shell',
      shell: 'Shell',
      shellscript: 'Shell',
      zsh: 'Shell',
      powershell: 'PowerShell',
      ps: 'PowerShell',
      html: 'HTML',
      xml: 'XML',
      css: 'CSS',
      scss: 'SCSS',
      json: 'JSON',
      yml: 'YAML',
      yaml: 'YAML',
      md: 'Markdown',
      markdown: 'Markdown',
      py: 'Python',
      python: 'Python',
      rb: 'Ruby',
      go: 'Go',
      rust: 'Rust',
      java: 'Java',
      c: 'C',
      cpp: 'C++',
      sql: 'SQL',
      diff: 'Diff',
      ini: 'INI',
      nginx: 'Nginx',
      dockerfile: 'Docker'
    };
    if (!value) return 'Code';
    return map[value] || value.charAt(0).toUpperCase() + value.slice(1);
  }

  var COPY_ICONS = {
    copy:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.6" y="5.6" width="8" height="8" rx="2"></rect><path d="M10.4 5.6V4.4a2 2 0 0 0-2-2H4.4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1.2"></path></svg>',
    check:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.4 8.6l3.1 3.1 6-7"></path></svg>',
    cross:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"></path></svg>'
  };

  function initCodeBlocks() {
    var copyLabel = label('copy', 'Copy');
    var copiedLabel = label('copied', 'Copied');
    var failedLabel = label('copy-failed', 'Failed');
    var copyingLabel = label('copying', 'Copying…');

    $$('.post-body pre').forEach(function (pre) {
      var figure = pre.closest('figure.highlight');
      var host = figure || pre;
      if (host.hasAttribute('data-code-ready')) return;

      var code = figure
        ? figure.querySelector('.code pre') || figure.querySelector('pre')
        : pre.querySelector('code') || pre;
      if (!code) return;

      host.setAttribute('data-code-ready', '1');

      var language = '';
      var match = (code.className || '').match(/language-([\w+#-]+)/);
      if (match) language = match[1];
      if (!language && figure) {
        var figureMatch = (figure.className || '').match(/highlight\s+([\w+#-]+)/);
        if (figureMatch) language = figureMatch[1];
      }

      var block = document.createElement('div');
      block.className = 'code-block';

      var bar = document.createElement('div');
      bar.className = 'code-block__bar';

      var languageTag = document.createElement('span');
      languageTag.className = 'code-block__lang';
      languageTag.textContent = langLabel(language);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-block__copy';
      button.setAttribute('data-state', 'idle');
      button.innerHTML =
        '<span class="code-block__copy-spin" aria-hidden="true"></span>' +
        '<span class="code-block__copy-icon code-block__copy-icon--copy">' + COPY_ICONS.copy + '</span>' +
        '<span class="code-block__copy-icon code-block__copy-icon--check">' + COPY_ICONS.check + '</span>' +
        '<span class="code-block__copy-icon code-block__copy-icon--cross">' + COPY_ICONS.cross + '</span>' +
        '<span class="code-block__copy-label"></span>';
      var buttonLabel = button.querySelector('.code-block__copy-label');
      buttonLabel.textContent = copyLabel;

      bar.appendChild(languageTag);
      bar.appendChild(button);

      host.parentNode.insertBefore(block, host);
      block.appendChild(bar);
      block.appendChild(host);

      var settleTimer = null;
      var resetTimer = null;

      button.addEventListener('click', function () {
        if (button.getAttribute('data-state') === 'copying') return;
        if (settleTimer) window.clearTimeout(settleTimer);
        if (resetTimer) window.clearTimeout(resetTimer);
        settleTimer = resetTimer = null;

        button.setAttribute('data-state', 'copying');
        buttonLabel.textContent = copyingLabel;
        var started = Date.now();

        copyText(code.innerText || code.textContent || '').then(function (ok) {
          /* 复制往往瞬间完成，留一小段「复制中」，让点击有可感知的回执。 */
          var hold = Math.max(0, 260 - (Date.now() - started));
          settleTimer = window.setTimeout(function () {
            settleTimer = null;
            button.setAttribute('data-state', ok ? 'copied' : 'failed');
            buttonLabel.textContent = ok ? copiedLabel : failedLabel;
            resetTimer = window.setTimeout(function () {
              resetTimer = null;
              button.setAttribute('data-state', 'idle');
              buttonLabel.textContent = copyLabel;
            }, ok ? 1500 : 1900);
          }, hold);
        });
      });
    });
  }

  var tocState = { links: [], headings: [], map: new Map() };

  function initTOC() {
    var links = $$('[data-toc] a[href^="#"]');
    tocState.links = links;
    tocState.headings = [];
    tocState.map = new Map();

    links.forEach(function (link) {
      var raw = link.getAttribute('href').slice(1);
      var id = raw;
      try {
        id = decodeURIComponent(raw);
      } catch (error) {
        /* keep raw */
      }
      var heading = document.getElementById(id);
      if (!heading) return;
      if (!tocState.map.has(heading)) {
        tocState.map.set(heading, []);
        tocState.headings.push(heading);
      }
      tocState.map.get(heading).push(link);
    });

    tocState.headings.sort(function (a, b) {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    updateTOCActive();
  }

  function tocActivate(heading) {
    tocState.links.forEach(function (link) {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');
    });
    var group = tocState.map.get(heading);
    if (!group) return;
    group.forEach(function (link) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'true');
    });

    var scrollerLink = null;
    var scrollerBox = null;
    group.some(function (link) {
      var box = link.closest ? link.closest('[data-toc]') : null;
      if (!box) return false;
      if (box.scrollHeight > box.clientHeight + 4 && link.getClientRects().length) {
        scrollerLink = link;
        scrollerBox = box;
        return true;
      }
      return false;
    });
    if (scrollerLink) {
      var boxRect = scrollerBox.getBoundingClientRect();
      var linkRect = scrollerLink.getBoundingClientRect();
      var pad = 10;
      var nextTop = scrollerBox.scrollTop;
      if (linkRect.top < boxRect.top + pad) {
        nextTop -= boxRect.top + pad - linkRect.top;
      } else if (linkRect.bottom > boxRect.bottom - pad) {
        nextTop += linkRect.bottom - (boxRect.bottom - pad);
      }
      nextTop = Math.max(0, Math.min(nextTop, scrollerBox.scrollHeight - scrollerBox.clientHeight));
      if (Math.abs(nextTop - scrollerBox.scrollTop) > 1) {
        scrollerBox.scrollTo({ top: nextTop, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
  }

  function updateTOCActive() {
    var headings = tocState.headings;
    if (!headings.length) return;

    var offset = 150;
    var active = headings[0];

    for (var i = 0; i < headings.length; i += 1) {
      if (headings[i].getBoundingClientRect().top - offset <= 0) active = headings[i];
      else break;
    }

    var doc = document.documentElement;
    if (window.pageYOffset + window.innerHeight >= doc.scrollHeight - 8) {
      active = headings[headings.length - 1];
    }

    tocActivate(active);
  }

  function scrollToHash(hash, updateHistory) {
    var decoded = String(hash || '').replace(/^#/, '');
    try {
      decoded = decodeURIComponent(decoded);
    } catch (error) {
      /* keep raw */
    }
    var target = document.getElementById(decoded);
    if (!target) return false;

    if (updateHistory) {
      try {
        window.history.pushState({ url: window.location.href }, '', '#' + decoded);
      } catch (error) {
        /* ignore */
      }
    }

    // 落点偏移交给 CSS 的 scroll-margin-top 决定（如首页 #latest 只留区块间距），
    // 没写的目标仍沿用 104px 的老偏移，避免标题被吸顶胶囊压住。
    var offset = parseInt(window.getComputedStyle(target).scrollMarginTop, 10);
    if (!offset || isNaN(offset)) offset = 104;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    tocActivate(target);
    return true;
  }

  function initAnchorScroll() {
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var link = event.target.closest ? event.target.closest('a[href*="#"]') : null;
      if (!link) return;

      var url;
      try {
        url = new URL(link.href, window.location.href);
      } catch (error) {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname !== window.location.pathname || url.search !== window.location.search) return;
      if (!url.hash) return;

      event.preventDefault();
      scrollToHash(url.hash, true);
    });
  }

  var twikooPromise = null;

  function loadTwikooScript(cdn) {
    if (window.twikoo) return Promise.resolve(window.twikoo);
    if (twikooPromise) return twikooPromise;

    var sources = [
      cdn,
      'https://cdn.jsdelivr.net/npm/twikoo@1.6.44/dist/twikoo.all.min.js',
      'https://cdn.staticfile.org/twikoo/1.6.44/twikoo.all.min.js'
    ].filter(Boolean);

    twikooPromise = new Promise(function (resolve, reject) {
      var index = 0;
      function next() {
        if (index >= sources.length) {
          reject(new Error('twikoo unavailable'));
          return;
        }
        var script = document.createElement('script');
        script.src = sources[index++];
        script.async = true;
        script.onload = function () {
          if (window.twikoo) resolve(window.twikoo);
          else next();
        };
        script.onerror = next;
        document.head.appendChild(script);
      }
      next();
    });

    return twikooPromise;
  }

  function initComments() {
    var container = $('[data-comments]');
    if (!container || container.hasAttribute('data-comments-ready')) return;
    var mount = $('[data-comments-mount]', container);
    if (!mount) return;
    container.setAttribute('data-comments-ready', '1');

    var provider = container.getAttribute('data-provider') || 'giscus';

    function initTwikoo() {
      var envId = container.getAttribute('data-env-id');
      if (!envId) return;
      var countEl = $('[data-comment-count]');
      var countWrap = $('[data-comment-count-wrap]');

      loadTwikooScript(container.getAttribute('data-cdn'))
        .then(function (twikoo) {
          twikoo.init({
            envId: envId,
            el: mount,
            region: container.getAttribute('data-region') || undefined,
            lang: container.getAttribute('data-lang') || 'zh-CN',
            path: window.location.pathname
          });

          if (countEl && typeof twikoo.getCommentsCount === 'function') {
            twikoo
              .getCommentsCount({ envId: envId, urls: [window.location.pathname], includeReply: false })
              .then(function (result) {
                var row = result && result[0];
                if (!row) return;
                countEl.textContent = String(row.count || 0);
                if (countWrap) countWrap.removeAttribute('hidden');
              })
              .catch(function () {});
          }
        })
        .catch(function () {
          mount.innerHTML = '<p class="comments__error">评论暂时加载失败，请刷新后再试。</p>';
        });
    }

    function initGiscus() {
      var script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.async = true;
      script.crossOrigin = 'anonymous';

      var attributes = {
        'data-repo': container.getAttribute('data-repo'),
        'data-repo-id': container.getAttribute('data-repo-id'),
        'data-category': container.getAttribute('data-category'),
        'data-category-id': container.getAttribute('data-category-id'),
        'data-mapping': container.getAttribute('data-mapping'),
        'data-strict': container.getAttribute('data-strict'),
        'data-reactions-enabled': container.getAttribute('data-reactions-enabled'),
        'data-emit-metadata': '0',
        'data-input-position': container.getAttribute('data-input-position'),
        'data-theme': currentTheme() === 'dark' ? 'dark' : 'light',
        'data-lang': container.getAttribute('data-lang'),
        'data-loading': 'lazy'
      };

      Object.keys(attributes).forEach(function (key) {
        if (attributes[key]) script.setAttribute(key, attributes[key]);
      });

      mount.appendChild(script);
    }

    var load = provider === 'twikoo' ? initTwikoo : initGiscus;
    var started = false;

    if (!mount.childNodes.length) {
      var loading = document.createElement('p');
      loading.className = 'comments__loading';
      loading.textContent = container.getAttribute('data-label-loading') || '评论加载中…';
      mount.appendChild(loading);
    }

    function run() {
      if (started) return;
      started = true;
      var placeholder = mount.querySelector('.comments__loading');
      if (placeholder) placeholder.remove();
      load();
    }

    if (container.getAttribute('data-lazyload') !== 'false' && 'IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries) {
          if (!entries[0].isIntersecting) return;
          observer.disconnect();
          run();
        },
        { rootMargin: '1200px' }
      );
      observer.observe(container);
    } else {
      run();
    }

    window.setTimeout(function () {
      if (!started && document.body.contains(container)) run();
    }, 2500);
  }

  /* Search --------------------------------------------------- */
  var searchState = {
    dialog: null,
    input: null,
    form: null,
    results: null,
    count: null,
    suggestWrap: null,
    items: [],
    active: -1,
    indexPromise: null,
    indexUrl: null,
    seq: 0
  };

  function tokenize(query) {
    return String(query || '')
      .toLowerCase()
      .split(/[\s,，、]+/)
      .map(function (term) {
        return term.trim();
      })
      .filter(Boolean);
  }

  function searchIndex(url) {
    if (!searchState.indexPromise) {
      searchState.indexPromise = fetch(url, { credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('Search index failed');
        return response.json();
      });
      searchState.indexPromise.catch(function () {
        searchState.indexPromise = null;
      });
    }
    return searchState.indexPromise;
  }

  function searchPosts(posts, terms) {
    if (!terms.length) return [];

    return posts
      .map(function (post) {
        var title = String(post.title || '').toLowerCase();
        var tags = (post.tags || []).join(' ').toLowerCase();
        var categories = (post.categories || []).join(' ').toLowerCase();
        var content = String(post.content || '').toLowerCase();
        var score = 0;

        for (var i = 0; i < terms.length; i += 1) {
          var term = terms[i];
          var hit = false;

          if (title.indexOf(term) !== -1) {
            score += title === term ? 120 : title.indexOf(term) === 0 ? 70 : 42;
            hit = true;
          }
          if (tags.indexOf(term) !== -1) {
            score += 26;
            hit = true;
          }
          if (categories.indexOf(term) !== -1) {
            score += 16;
            hit = true;
          }
          var position = content.indexOf(term);
          if (position !== -1) {
            score += 8 + Math.max(0, 8 - position / 240);
            hit = true;
          }
          if (!hit) return null;
        }

        return { post: post, score: score };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .map(function (item) {
        return item.post;
      });
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function appendHighlighted(parent, text, terms) {
    if (!terms.length) {
      parent.textContent = text;
      return;
    }

    var pattern = new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi');
    var last = 0;
    var match;

    while ((match = pattern.exec(text))) {
      if (match.index > last) {
        parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      var mark = document.createElement('mark');
      mark.textContent = match[0];
      parent.appendChild(mark);
      last = match.index + match[0].length;
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }

    if (last < text.length) {
      parent.appendChild(document.createTextNode(text.slice(last)));
    }
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  function renderResults(posts, container, terms, options) {
    container.innerHTML = '';

    if (!posts.length) {
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      var emptyTitle = document.createElement('strong');
      emptyTitle.textContent = label('empty', 'Nothing found');
      var emptyHint = document.createElement('p');
      emptyHint.textContent = label('empty-hint', 'Try another keyword.');
      empty.appendChild(emptyTitle);
      empty.appendChild(emptyHint);
      container.appendChild(empty);
      return [];
    }

    var fragment = document.createDocumentFragment();

    posts.forEach(function (post) {
      var link = document.createElement('a');
      link.className = 'result';
      link.href = post.url;
      if (options && options.overlay) link.setAttribute('role', 'option');

      var meta = document.createElement('span');
      meta.className = 'result__meta';
      var minutes = post.minutes ? post.minutes + ' ' + label('minutes', 'min read') : '';
      meta.textContent = [formatDate(post.date), minutes].filter(Boolean).join(' · ');

      var title = document.createElement('span');
      title.className = 'result__title';
      appendHighlighted(title, post.title || '', terms);

      var excerpt = document.createElement('span');
      excerpt.className = 'result__excerpt';
      appendHighlighted(excerpt, post.excerpt || '', terms);

      link.appendChild(meta);
      link.appendChild(title);
      if (post.excerpt) link.appendChild(excerpt);
      fragment.appendChild(link);
    });

    container.appendChild(fragment);
    return $$('.result', container);
  }

  function setOverlayActive(index) {
    if (!searchState.items.length) return;
    if (index < 0) index = searchState.items.length - 1;
    if (index >= searchState.items.length) index = 0;

    searchState.items.forEach(function (item) {
      item.classList.remove('is-active');
      item.setAttribute('aria-selected', 'false');
    });

    searchState.active = index;
    var active = searchState.items[index];
    active.classList.add('is-active');
    active.setAttribute('aria-selected', 'true');
    active.scrollIntoView({ block: 'nearest' });
  }

  function runOverlaySearch(query) {
    var terms = tokenize(query);
    searchState.items = [];
    searchState.active = -1;

    if (searchState.suggestWrap) {
      searchState.suggestWrap.style.display = terms.length ? 'none' : '';
    }

    if (!terms.length) {
      searchState.results.innerHTML = '';
      searchState.count.textContent = '';
      return;
    }

    var seq = ++searchState.seq;
    var max = Number(searchState.dialog.getAttribute('data-max-results')) || 12;

    searchIndex(searchState.indexUrl).then(function (posts) {
      if (seq !== searchState.seq) return;
      var found = searchPosts(posts, terms).slice(0, max);
      searchState.items = renderResults(found, searchState.results, terms, { overlay: true });
      searchState.count.textContent = found.length
        ? found.length + ' ' + label('found', 'posts match')
        : '';
      if (searchState.items.length) setOverlayActive(0);
    }).catch(function () {
      if (seq !== searchState.seq) return;
      searchState.results.innerHTML = '';
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = label('empty', 'Nothing found');
      searchState.results.appendChild(empty);
    });
  }

  function openSearch(initialQuery) {
    if (!searchState.dialog) return;
    if (!searchState.dialog.open) {
      searchState.dialog.showModal();
      body.classList.add('search-open');
    }
    if (typeof initialQuery === 'string') {
      searchState.input.value = initialQuery;
    }
    window.setTimeout(function () {
      searchState.input.focus();
      if (searchState.input.value) runOverlaySearch(searchState.input.value);
    }, 30);
  }

  function closeSearchNow() {
    if (!searchState.dialog || !searchState.dialog.open) return;
    searchState.dialog.classList.remove('is-closing');
    searchState.dialog.close();
    body.classList.remove('search-open');
  }

  function closeSearch() {
    if (!searchState.dialog || !searchState.dialog.open) return;
    searchState.dialog.classList.add('is-closing');
    window.setTimeout(function () {
      closeSearchNow();
    }, 150);
  }

  function initSearchOverlay() {
    var dialog = $('[data-search-dialog]');
    if (!dialog) return;

    searchState.dialog = dialog;
    searchState.input = $('[data-search-input]', dialog);
    searchState.form = $('[data-search-form]', dialog);
    searchState.results = $('[data-search-results]', dialog);
    searchState.count = $('[data-search-count]', dialog);
    searchState.suggestWrap = $('[data-search-suggest-wrap]', dialog);
    searchState.indexUrl = dialog.getAttribute('data-index') || '/search.json';

    if (!searchState.input || !searchState.form) return;

    searchState.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var target = searchState.items[searchState.active] || searchState.items[0];
      if (!target) return;
      closeSearchNow();
      navigateTo(target.href);
    });

    var timer;
    searchState.input.addEventListener('input', function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        runOverlaySearch(searchState.input.value);
      }, 130);
    });

    searchState.input.addEventListener('keydown', function (event) {
      if (!searchState.items.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOverlayActive(searchState.active + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setOverlayActive(searchState.active - 1);
      }
    });

    dialog.addEventListener('click', function (event) {
      var suggestion = event.target.closest ? event.target.closest('[data-search-suggest]') : null;
      if (suggestion) {
        searchState.input.value = suggestion.getAttribute('data-search-suggest');
        runOverlaySearch(searchState.input.value);
        searchState.input.focus();
        return;
      }
      if (event.target === dialog) closeSearch();
    });

    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeSearch();
    });

    dialog.addEventListener('close', function () {
      body.classList.remove('search-open');
      dialog.classList.remove('is-closing');
    });
  }

  /* Router --------------------------------------------------- */
  var cache = new Map();
  var prefetched = new Set();
  var navigating = false;
  var prefetchTimer = 0;

  function isEligible(link) {
    if (!link) return false;
    if (link.getAttribute('target') && link.getAttribute('target') !== '_self') return false;
    if (link.hasAttribute('download')) return false;
    if (link.hasAttribute('data-no-router')) return false;

    var rel = link.getAttribute('rel') || '';
    if (/\bexternal\b/.test(rel)) return false;

    var url;
    try {
      url = new URL(link.href, window.location.href);
    } catch (error) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.pathname.indexOf('/search.json') !== -1) return false;
    if (/\.[a-z0-9]{2,5}$/i.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;

    return true;
  }

  function fetchPage(url) {
    if (cache.has(url)) return cache.get(url);

    var promise = fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'Lume' }
    }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    });

    cache.set(url, promise);
    if (cache.size > 12) {
      var oldest = cache.keys().next().value;
      cache.delete(oldest);
    }

    promise.catch(function () {
      cache.delete(url);
    });

    return promise;
  }

  function prefetch(url) {
    if (prefetched.has(url) || cache.has(url)) return;
    prefetched.add(url);
    fetchPage(url).catch(function () {
      prefetched.delete(url);
    });
  }

  function updateHead(parsed) {
    $$('head [data-managed-meta]').forEach(function (element) {
      element.remove();
    });
    $$('[data-managed-meta]', parsed.head).forEach(function (element) {
      document.head.appendChild(element.cloneNode(true));
    });
    if (parsed.title) document.title = parsed.title;
  }

  function syncNav() {
    var main = document.getElementById('main');
    var raw = main ? main.getAttribute('data-path') || '' : '';
    var path = '/' + raw.replace(/index\.html$/, '').replace(/^\/+/, '');

    $$('.nav-link').forEach(function (link) {
      var target = link.getAttribute('data-nav-path') || '/';
      var base = target === '/' ? '/' : target.charAt(target.length - 1) === '/' ? target : target + '/';
      var active = target === '/' ? path === '/' : path.indexOf(base) === 0;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function focusHeading(main) {
    var heading = main.querySelector('h1');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    try {
      heading.focus({ preventScroll: true });
    } catch (error) {
      heading.focus();
    }
  }

  function navigateTo(url, options) {
    options = options || {};

    if (!flags.router || !window.fetch || !window.DOMParser) {
      window.location.href = url;
      return Promise.resolve();
    }

    if (navigating) return Promise.resolve();
    navigating = true;

    closeSearchNow();

    if (options.push !== false) {
      try {
        window.history.replaceState(
          Object.assign({}, window.history.state || {}, { scrollY: window.pageYOffset }),
          ''
        );
      } catch (error) {
        /* ignore */
      }
    }

    return fetchPage(url)
      .then(function (html) {
        var parsed = new window.DOMParser().parseFromString(html, 'text/html');
        var newMain = parsed.querySelector('#main');
        if (!newMain) throw new Error('Missing main');

        if (options.push !== false) {
          window.history.pushState({ url: url, scrollY: 0 }, '', url);
        }

        root.classList.add('is-leaving');

        return wait(reduceMotion ? 0 : 150).then(function () {
          updateHead(parsed);

          var main = document.getElementById('main');
          main.innerHTML = newMain.innerHTML;
          main.setAttribute('data-path', newMain.getAttribute('data-path') || '');
          if (parsed.body && parsed.body.className) body.className = parsed.body.className;

          window.scrollTo(0, options.scroll || 0);
          root.classList.remove('is-leaving');

          initPage();
          focusHeading(main);
        });
      })
      .catch(function () {
        window.location.href = url;
      })
      .then(function () {
        navigating = false;
      });
  }

  function initRouter() {
    if (!flags.router) return;

    try {
      window.history.replaceState(
        Object.assign({}, window.history.state || {}, {
          url: window.location.href,
          scrollY: window.pageYOffset
        }),
        ''
      );
    } catch (error) {
      /* ignore */
    }

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || !isEligible(link)) return;

      event.preventDefault();
      closeMenu();
      navigateTo(link.href);
    });

    document.addEventListener(
      'pointerover',
      function (event) {
        var link = event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || !isEligible(link)) return;
        var href = link.href;
        window.clearTimeout(prefetchTimer);
        prefetchTimer = window.setTimeout(function () {
          prefetch(href);
        }, 90);
      },
      { passive: true }
    );

    document.addEventListener('focusin', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || !isEligible(link)) return;
      prefetch(link.href);
    });

    window.addEventListener('popstate', function (event) {
      var state = event.state;
      if (!state || !state.url) {
        window.location.reload();
        return;
      }
      navigateTo(state.url, { push: false, scroll: state.scrollY || 0 });
    });
  }

  /* Menu ----------------------------------------------------- */
  var menuApi = { close: function () {} };

  function initMenu() {
    var button = $('[data-menu-toggle]');
    var panel = $('[data-mobile-nav]');
    var scrim = $('[data-nav-scrim]');
    if (!button || !panel) return;

    function set(open) {
      body.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) panel.removeAttribute('inert');
      else panel.setAttribute('inert', '');
      scrollState.menuOpen = open;
      if (open && scrollState.header) scrollState.header.classList.remove('is-hidden');
      requestScrollUpdate();
    }

    menuApi.close = function () {
      if (body.classList.contains('menu-open')) set(false);
    };

    set(false);

    button.addEventListener('click', function () {
      set(!body.classList.contains('menu-open'));
    });

    if (scrim) {
      scrim.addEventListener('click', function () {
        set(false);
      });
    }

    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) set(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && body.classList.contains('menu-open')) set(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && body.classList.contains('menu-open')) set(false);
    });
  }

  function closeMenu() {
    menuApi.close();
  }

  function initToTop() {
    var button = $('[data-to-top]');
    if (!button) return;
    button.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* Page lifecycle ------------------------------------------- */
  function initPage() {
    document.documentElement.classList.toggle('has-hero', !!document.querySelector('.hero'));
    initReveal(document);
    initImages();
    initCoverFallback();
    initTables();
    initCodeBlocks();
    initTOC();
    initComments();
    refreshScrollTargets();
    syncNav();
    updateScroll();

    if (window.location.hash) {
      window.setTimeout(function () {
        scrollToHash(window.location.hash, false);
      }, 30);
    }

    if (window.LumeExtras && typeof window.LumeExtras.init === 'function') {
      window.LumeExtras.init();
    }
  }

  function initGlobalSearchTriggers() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest ? event.target.closest('[data-search-open]') : null;
      if (!trigger) return;
      event.preventDefault();
      closeMenu();
      openSearch();
    });

    document.addEventListener('keydown', function (event) {
      if (!searchState.dialog) return;
      var isShortcut = (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k';
      if (!isShortcut) return;
      event.preventDefault();
      if (searchState.dialog.open) closeSearch();
      else openSearch();
    });
  }

  function dropStaleServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        registrations.forEach(function (registration) {
          registration.unregister();
        });
      })
      .catch(function () {
        /* ignore */
      });
  }

  function initHeroSnap() {
    var lockUntil = 0;

    window.addEventListener(
      'wheel',
      function (event) {
        if (reduceMotion || event.ctrlKey) return;
        if (!document.documentElement.classList.contains('has-hero')) return;
        if (document.body.classList.contains('menu-open')) return;

        var now = Date.now();
        if (now < lockUntil) {
          event.preventDefault();
          return;
        }

        var hero = $('.hero');
        var feed = document.getElementById('latest');
        if (!hero || !feed) return;
        if (hero.offsetHeight > window.innerHeight + 8) return;

        var y = window.pageYOffset;
        var snapOffset = parseInt(window.getComputedStyle(feed).scrollMarginTop, 10) || 96;
        var feedTop = feed.getBoundingClientRect().top + y - snapOffset;
        var target = Math.max(0, feedTop);

        if (y <= 4 && event.deltaY > 6) {
          event.preventDefault();
          lockUntil = now + 700;
          window.scrollTo({ top: target, behavior: 'smooth' });
        } else if (event.deltaY < -6 && Math.abs(y - target) < 110) {
          event.preventDefault();
          lockUntil = now + 700;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      { passive: false }
    );
  }

  function boot() {
    dropStaleServiceWorker();
    initTheme();
    initScroll();
    initReveal(document);
    initPeek();
    initMenu();
    initToTop();
    initGlobalSearchTriggers();
    initSearchOverlay();
    initAnchorScroll();
    initHeroSnap();
    initRouter();
    if (window.LumeExtras && typeof window.LumeExtras.boot === 'function') {
      window.LumeExtras.boot();
    }
    initPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', function (event) {
      reduceMotion = event.matches;
      if (reduceMotion) {
        revealAll(document);
        var peek = $('[data-peek]');
        if (peek) peek.classList.remove('is-on');
      }
    });
  }

  window.Lume = {
    navigate: navigateTo,
    openSearch: openSearch,
    closeSearch: closeSearchNow
  };
})();
