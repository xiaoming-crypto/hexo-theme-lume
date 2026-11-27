(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduceMotion = motionQuery.matches;

  var flags = {
    router: root.getAttribute('data-router') !== 'false',
    viewTransitions: root.getAttribute('data-view-transitions') !== 'false',
    reveal: root.getAttribute('data-reveal-motion') !== 'false',
    parallax: root.getAttribute('data-parallax') !== 'false',
    heroSnap: root.getAttribute('data-hero-snap') === 'true',
    peek: root.getAttribute('data-peek') !== 'false',
    ripple: root.getAttribute('data-ripple') !== 'false',
    codeLineNumbers: root.getAttribute('data-code-line-numbers') !== 'false',
    codeWrap: root.getAttribute('data-code-wrap') === 'true',
    codeCollapseLines: Number(root.getAttribute('data-code-collapse-lines')) || 0,
    codeCollapseHeight: Number(root.getAttribute('data-code-collapse-height')) || 360,
    mathEnable: root.getAttribute('data-math-enable') !== 'false',
    mermaidEnable: root.getAttribute('data-mermaid-enable') !== 'false'
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

  var loadedStyles = new Set();
  var scriptPromises = new Map();

  function loadExternalStyle(href) {
    if (!href || loadedStyles.has(href)) return;
    var existing = document.querySelector('link[href="' + href + '"]');
    if (existing) {
      loadedStyles.add(href);
      return;
    }
    loadedStyles.add(href);
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadExternalScript(src) {
    if (!src) return Promise.reject(new Error('Missing script URL'));
    if (scriptPromises.has(src)) return scriptPromises.get(src);
    var promise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        scriptPromises.delete(src);
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(script);
    });
    scriptPromises.set(src, promise);
    return promise;
  }

  var toastTimer = 0;

  function showToast(message, duration) {
    var el = $('[data-toast]');
    if (!el || !message) return;
    window.clearTimeout(toastTimer);
    el.textContent = message;
    el.hidden = false;
    window.requestAnimationFrame(function () {
      el.classList.add('is-on');
    });
    toastTimer = window.setTimeout(function () {
      el.classList.remove('is-on');
      toastTimer = window.setTimeout(function () {
        if (!el.classList.contains('is-on')) el.hidden = true;
      }, 220);
    }, duration || 2200);
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
    readBar: null,
    article: null,
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

  function clearStoredTheme() {
    try {
      window.localStorage.removeItem('lume-theme');
    } catch (error) {
      /* ignore */
    }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
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

  function syncThemeColor(theme) {
    var color = theme === 'dark' ? '#171326' : '#fff6e9';
    $$('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute('content', color);
    });
  }

  function setTheme(theme, silent) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    syncThemeButton(theme);
    syncThemeColor(theme);
    if (!silent) storeTheme(theme);
    syncGiscus(theme);
    if (typeof rerenderMermaid === 'function') rerenderMermaid(theme);
  }

  function toggleTheme(event) {
    if (activeViewTransition) {
      try {
        if (typeof activeViewTransition.skipTransition === 'function') {
          activeViewTransition.skipTransition();
        }
      } catch (error) {
        /* ignore */
      }
      activeViewTransition = null;
    }
    root.classList.remove('nav-vt');

    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    var scheme = root.getAttribute('data-scheme') || 'auto';
    var matchSystem = scheme === 'auto' && next === systemTheme();
    var x = event && typeof event.clientX === 'number' ? event.clientX : window.innerWidth - 48;
    var y = event && typeof event.clientY === 'number' ? event.clientY : 48;
    var apply = function () {
      if (matchSystem) {
        clearStoredTheme();
        setTheme(next, true);
      } else {
        setTheme(next, false);
      }
    };
    var toastText = matchSystem
      ? (next === 'dark'
        ? label('theme-dark-auto', 'Back to dark (following system)')
        : label('theme-light-auto', 'Back to light (following system)'))
      : (next === 'dark'
        ? label('theme-dark', 'Switched to dark mode')
        : label('theme-light', 'Switched to light mode'));

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
      showToast(toastText);
    } else {
      root.classList.add('is-theme-changing');
      apply();
      showToast(toastText);
      window.setTimeout(function () {
        root.classList.remove('is-theme-changing');
      }, 430);
    }
  }

  function initTheme() {
    var button = $('[data-theme-toggle]');
    syncThemeButton(currentTheme());
    syncThemeColor(currentTheme());
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
    scrollState.readBar = $('[data-read-progress]');
    scrollState.article = $('[data-article]');
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

    if (scrollState.readBar) {
      if (scrollState.article) {
        var articleRect = scrollState.article.getBoundingClientRect();
        var articleTop = articleRect.top + y;
        var articleHeight = Math.max(1, scrollState.article.offsetHeight);
        var readStart = Math.max(0, articleTop - window.innerHeight * 0.25);
        var readEnd = Math.max(readStart + 1, articleTop + articleHeight - window.innerHeight * 0.72);
        var readRatio = clamp((y - readStart) / (readEnd - readStart), 0, 1);
        scrollState.readBar.classList.add('is-active');
        scrollState.readBar.style.transform = 'scaleX(' + readRatio.toFixed(4) + ')';
      } else {
        scrollState.readBar.classList.remove('is-active');
        scrollState.readBar.style.transform = 'scaleX(0)';
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
    sweepReveal();
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
    scrollState.readBar = $('[data-read-progress]');
    scrollState.article = $('[data-article]');
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate, { passive: true });
    requestScrollUpdate();
  }

  /* Reveal --------------------------------------------------- */
  var revealObserver = null;

  function clearInstantReveal(elements) {
    if (!elements || !elements.length) return;
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        elements.forEach(function (element) {
          element.classList.remove('is-instant');
        });
      });
    });
  }

  function revealAll(scope) {
    var instantEls = [];
    $$('[data-reveal]', scope).forEach(function (element) {
      element.classList.add('is-in', 'is-instant');
      if (revealObserver) revealObserver.unobserve(element);
      instantEls.push(element);
    });
    clearInstantReveal(instantEls);
  }

  function isNearViewportForReveal(element) {
    var rect = element.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.top < vh || rect.bottom <= 0;
  }

  function sweepReveal() {
    if (!flags.reveal || reduceMotion) return;
    $$('[data-reveal]:not(.is-in)').forEach(function (element) {
      if (isNearViewportForReveal(element)) {
        element.classList.add('is-in');
        if (revealObserver) revealObserver.unobserve(element);
      }
    });
  }

  function initReveal(scope) {
    var area = scope || document;
    if (area === document && revealObserver) {
      revealObserver.disconnect();
    }
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
        { rootMargin: '0px 0px 48px 0px', threshold: 0 }
      );
    }

    var instantEls = [];
    $$('[data-reveal]', area).forEach(function (element) {
      if (element.classList.contains('is-in')) return;
      if (isNearViewportForReveal(element)) {
        element.classList.add('is-in', 'is-instant');
        instantEls.push(element);
        return;
      }
      revealObserver.observe(element);
    });
    clearInstantReveal(instantEls);
  }

  /* Ambient infinite animation pause ------------------------- */
  var AMBIENT_SELECTOR =
    '.brand__spark, .mobile-nav__wave, .hero__eyebrow-emoji, .hero-sticker, .reward__sticker, ' +
    '.about__avatar img, .about__avatar-ring, .about__doodle, .about__status-dot, ' +
    '.not-found__zero, .not-found__tear, .not-found__doodle, .music-hero__vinyl, ' +
    '.friends-hero__doodle span, .fishing__sun, .fishing__cloud, .fishing__water, .fishing__fish';
  var ambientObserver = null;

  function initAmbientPause() {
    if (ambientObserver) {
      ambientObserver.disconnect();
    }
    var nodes = $$(AMBIENT_SELECTOR);
    if (!nodes.length) return;

    nodes.forEach(function (node) {
      node.setAttribute('data-anim-ambient', '1');
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      nodes.forEach(function (node) {
        node.setAttribute('data-anim-paused', 'false');
      });
      return;
    }

    if (!ambientObserver) {
      ambientObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            entry.target.setAttribute(
              'data-anim-paused',
              entry.isIntersecting && !document.hidden ? 'false' : 'true'
            );
          });
        },
        { rootMargin: '60px 0px 60px 0px', threshold: 0 }
      );
    }

    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    nodes.forEach(function (node) {
      var rect = node.getBoundingClientRect();
      var visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= -60 &&
        rect.top <= vh + 60;
      node.setAttribute('data-anim-paused', visible && !document.hidden ? 'false' : 'true');
      ambientObserver.observe(node);
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
    var sync = function () {
      if (image.naturalWidth > 0) {
        frame.classList.add('is-loaded');
      } else if (image.complete) {
        wrapper.style.display = 'none';
      }
    };
    if (image.complete) sync();
    image.addEventListener('error', function () {
      wrapper.style.display = 'none';
    });
    image.addEventListener('load', sync);
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

  function extractCodeText(code) {
    if (!code) return '';
    var lines = $$('.line', code);
    if (lines.length) {
      return lines
        .map(function (item) {
          return item.textContent || '';
        })
        .join('\n');
    }
    return code.innerText || code.textContent || '';
  }

  /* Mermaid & KaTeX (on-demand) ------------------------------ */
  var mermaidSeq = 0;

  function renderMermaidNodes(themeName) {
    var targets = $$('.post-body .lume-mermaid');
    if (!targets.length || !flags.mermaidEnable) return;
    var src = root.getAttribute('data-mermaid-js');
    if (!src) return;

    var renderOne = function (el, idx) {
      var source = el._mermaidSource || '';
      if (!source || !window.mermaid || typeof window.mermaid.render !== 'function') return Promise.resolve();
      var id = 'lume-mmd-' + (++mermaidSeq) + '-' + idx;
      return Promise.resolve()
        .then(function () {
          return window.mermaid.render(id, source);
        })
        .then(function (result) {
          if (!document.body.contains(el)) return;
          if (result && typeof result.svg === 'string') {
            el.innerHTML = result.svg;
            el.removeAttribute('data-mermaid');
            if (typeof result.bindFunctions === 'function') result.bindFunctions(el);
          }
        })
        .catch(function () {
          if (!document.body.contains(el)) return;
          var pre = document.createElement('pre');
          var code = document.createElement('code');
          code.textContent = source;
          pre.appendChild(code);
          el.innerHTML = '';
          el.appendChild(pre);
        });
    };

    var run = window.mermaid
      ? Promise.resolve()
      : loadExternalScript(src);

    run
      .then(function () {
        if (!window.mermaid || typeof window.mermaid.initialize !== 'function') return;
        window.mermaid.initialize({
          startOnLoad: false,
          theme: themeName === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose'
        });
        return targets.reduce(function (chain, el, idx) {
          return chain.then(function () {
            return renderOne(el, idx);
          });
        }, Promise.resolve());
      })
      .catch(function () {
        targets.forEach(function (el) {
          if (!el._mermaidSource) return;
          var pre = document.createElement('pre');
          var code = document.createElement('code');
          code.textContent = el._mermaidSource;
          pre.appendChild(code);
          el.innerHTML = '';
          el.appendChild(pre);
        });
      });
  }

  function initMermaid() {
    if (!flags.mermaidEnable) return;
    var candidates = $$(
      '.post-body figure.highlight.mermaid, .post-body pre > code.language-mermaid, .post-body pre > code.mermaid'
    );
    if (!candidates.length) return;

    candidates.forEach(function (node) {
      var isCode = node.tagName === 'CODE';
      var host = isCode ? node.parentElement || node : node;
      if (!host || !host.parentNode) return;
      var codeEl = isCode ? node : node.querySelector('.code pre') || node.querySelector('pre');
      var source = extractCodeText(codeEl).trim();
      if (!source) return;

      var wrap = document.createElement('div');
      wrap.className = 'lume-mermaid';
      wrap.setAttribute('data-mermaid', 'pending');
      wrap._mermaidSource = source;
      var fallbackPre = document.createElement('pre');
      var fallbackCode = document.createElement('code');
      fallbackCode.textContent = source;
      fallbackPre.appendChild(fallbackCode);
      wrap.appendChild(fallbackPre);
      host.parentNode.replaceChild(wrap, host);
    });

    renderMermaidNodes(currentTheme());
  }

  function rerenderMermaid(themeName) {
    renderMermaidNodes(themeName);
  }

  function hasMathDelimiters(article) {
    var clone = article.cloneNode(true);
    $$('pre, code, script, style, .lume-mermaid', clone).forEach(function (node) {
      node.remove();
    });
    var text = clone.textContent || '';
    return /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(text);
  }

  function initMath() {
    if (!flags.mathEnable) return;
    var article = $('[data-article]');
    if (!article) return;

    var forced = article.getAttribute('data-math-force') === 'true';
    if (!forced && !hasMathDelimiters(article)) return;

    var katexCss = root.getAttribute('data-katex-css');
    var katexJs = root.getAttribute('data-katex-js');
    var autoJs = root.getAttribute('data-katex-auto');
    if (!katexJs || !autoJs) return;

    loadExternalStyle(katexCss);
    loadExternalScript(katexJs)
      .then(function () {
        return loadExternalScript(autoJs);
      })
      .then(function () {
        if (!document.body.contains(article) || typeof window.renderMathInElement !== 'function') return;
        var delimiters = [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ];
        if (forced) delimiters.push({ left: '$', right: '$', display: false });
        window.renderMathInElement(article, {
          delimiters: delimiters,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
          throwOnError: false
        });
      })
      .catch(function () {
        /* Keep raw math text visible on CDN failure */
      });
  }

  /* Lightbox ------------------------------------------------- */
  var lightboxState = {
    dialog: null,
    img: null,
    frame: null,
    stage: null,
    counter: null,
    caption: null,
    prevBtn: null,
    nextBtn: null,
    zoomBtn: null,
    closeBtn: null,
    items: [],
    index: 0,
    zoomed: false,
    tx: 0,
    ty: 0,
    dragging: false,
    dragMoved: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    touchX: 0,
    triggerEl: null
  };

  function applyLightboxTransform() {
    if (!lightboxState.img) return;
    if (!lightboxState.zoomed) {
      lightboxState.img.style.transform = '';
      return;
    }
    lightboxState.img.style.transform =
      'translate(' + lightboxState.tx + 'px, ' + lightboxState.ty + 'px) scale(2)';
  }

  function setLightboxZoom(next) {
    if (!lightboxState.dialog || !lightboxState.img) return;
    lightboxState.zoomed = !!next;
    lightboxState.tx = 0;
    lightboxState.ty = 0;
    lightboxState.dialog.classList.toggle('is-zoomed', lightboxState.zoomed);
    lightboxState.dialog.classList.remove('is-dragging');
    if (lightboxState.zoomBtn) {
      lightboxState.zoomBtn.setAttribute('aria-pressed', lightboxState.zoomed ? 'true' : 'false');
      var zoomInLabel = lightboxState.zoomBtn.getAttribute('data-label-zoom-in') || 'Zoom in';
      var zoomOutLabel = lightboxState.zoomBtn.getAttribute('data-label-zoom-out') || 'Reset zoom';
      lightboxState.zoomBtn.setAttribute('aria-label', lightboxState.zoomed ? zoomOutLabel : zoomInLabel);
    }
    applyLightboxTransform();
  }

  function animateLightboxOpen(thumbEl) {
    if (reduceMotion || !thumbEl || !lightboxState.img || typeof lightboxState.img.animate !== 'function') return;
    var from = thumbEl.getBoundingClientRect();
    if (!from.width || !from.height || from.bottom < 0 || from.top > window.innerHeight) return;

    var run = function () {
      if (!lightboxState.dialog || !lightboxState.dialog.open) return;
      var to = lightboxState.img.getBoundingClientRect();
      if (!to.width || !to.height) return;
      var dx = from.left + from.width / 2 - (to.left + to.width / 2);
      var dy = from.top + from.height / 2 - (to.top + to.height / 2);
      var sx = clamp(from.width / to.width, 0.15, 2);
      var sy = clamp(from.height / to.height, 0.15, 2);
      lightboxState.img.animate(
        [
          { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')', opacity: 0.45 },
          { transform: 'none', opacity: 1 }
        ],
        { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' }
      );
    };

    if (lightboxState.img.complete && lightboxState.img.naturalWidth) {
      window.requestAnimationFrame(run);
    } else {
      lightboxState.img.addEventListener('load', function () {
        window.requestAnimationFrame(run);
      }, { once: true });
    }
  }

  function showLightboxSlide(index, fromTrigger) {
    var items = lightboxState.items;
    if (!items.length || !lightboxState.img) return;
    var total = items.length;
    var targetIndex = ((index % total) + total) % total;
    lightboxState.index = targetIndex;
    setLightboxZoom(false);

    var item = items[targetIndex];
    lightboxState.img.src = item.src;
    lightboxState.img.alt = item.caption || '';

    if (lightboxState.counter) {
      lightboxState.counter.textContent = targetIndex + 1 + ' / ' + total;
    }
    if (lightboxState.caption) {
      lightboxState.caption.textContent = item.caption;
      lightboxState.caption.hidden = !item.caption;
    }
    if (lightboxState.prevBtn) lightboxState.prevBtn.hidden = total <= 1;
    if (lightboxState.nextBtn) lightboxState.nextBtn.hidden = total <= 1;

    if (fromTrigger) animateLightboxOpen(item.el);
  }

  function openLightbox(index) {
    if (!lightboxState.dialog || !lightboxState.items.length) return;
    var item = lightboxState.items[index];
    lightboxState.triggerEl = item ? item.el : null;
    if (!lightboxState.dialog.open) {
      lightboxState.dialog.showModal();
      body.classList.add('lightbox-open');
    }
    showLightboxSlide(index, true);
  }

  function closeLightbox() {
    if (!lightboxState.dialog || !lightboxState.dialog.open) return;
    setLightboxZoom(false);
    lightboxState.dialog.close();
    body.classList.remove('lightbox-open');
    if (lightboxState.triggerEl && document.body.contains(lightboxState.triggerEl)) {
      try {
        lightboxState.triggerEl.focus({ preventScroll: true });
      } catch (error) {
        /* ignore */
      }
    }
    lightboxState.triggerEl = null;
  }

  function initLightboxGlobal() {
    var dialog = $('[data-lightbox]');
    if (!dialog) return;

    lightboxState.dialog = dialog;
    lightboxState.img = $('[data-lightbox-img]', dialog);
    lightboxState.frame = $('[data-lightbox-frame]', dialog);
    lightboxState.stage = $('[data-lightbox-stage]', dialog);
    lightboxState.counter = $('[data-lightbox-counter]', dialog);
    lightboxState.caption = $('[data-lightbox-caption]', dialog);
    lightboxState.prevBtn = $('[data-lightbox-prev]', dialog);
    lightboxState.nextBtn = $('[data-lightbox-next]', dialog);
    lightboxState.zoomBtn = $('[data-lightbox-zoom]', dialog);
    lightboxState.closeBtn = $('[data-lightbox-close]', dialog);

    if (lightboxState.closeBtn) {
      lightboxState.closeBtn.addEventListener('click', closeLightbox);
    }
    if (lightboxState.prevBtn) {
      lightboxState.prevBtn.addEventListener('click', function () {
        showLightboxSlide(lightboxState.index - 1, false);
      });
    }
    if (lightboxState.nextBtn) {
      lightboxState.nextBtn.addEventListener('click', function () {
        showLightboxSlide(lightboxState.index + 1, false);
      });
    }
    if (lightboxState.zoomBtn) {
      lightboxState.zoomBtn.addEventListener('click', function () {
        setLightboxZoom(!lightboxState.zoomed);
      });
    }

    if (lightboxState.img) {
      lightboxState.img.addEventListener('click', function () {
        if (lightboxState.dragMoved) {
          lightboxState.dragMoved = false;
          return;
        }
        setLightboxZoom(!lightboxState.zoomed);
      });

      lightboxState.img.addEventListener('pointerdown', function (event) {
        if (!lightboxState.zoomed) return;
        lightboxState.dragging = true;
        lightboxState.dragMoved = false;
        lightboxState.startX = event.clientX;
        lightboxState.startY = event.clientY;
        lightboxState.baseX = lightboxState.tx;
        lightboxState.baseY = lightboxState.ty;
        dialog.classList.add('is-dragging');
      });

      window.addEventListener('pointermove', function (event) {
        if (!lightboxState.dragging) return;
        var dx = event.clientX - lightboxState.startX;
        var dy = event.clientY - lightboxState.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) lightboxState.dragMoved = true;
        lightboxState.tx = lightboxState.baseX + dx;
        lightboxState.ty = lightboxState.baseY + dy;
        applyLightboxTransform();
      });

      var endDrag = function () {
        if (!lightboxState.dragging) return;
        lightboxState.dragging = false;
        dialog.classList.remove('is-dragging');
      };
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    }

    dialog.addEventListener('click', function (event) {
      if (
        event.target === dialog ||
        event.target === lightboxState.stage ||
        event.target === lightboxState.frame
      ) {
        closeLightbox();
      }
    });

    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeLightbox();
    });

    dialog.addEventListener('keydown', function (event) {
      if (!dialog.open) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showLightboxSlide(lightboxState.index - 1, false);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showLightboxSlide(lightboxState.index + 1, false);
      }
    });

    if (lightboxState.stage) {
      lightboxState.stage.addEventListener(
        'touchstart',
        function (event) {
          if (lightboxState.zoomed || !event.touches || event.touches.length !== 1) return;
          lightboxState.touchX = event.touches[0].clientX;
        },
        { passive: true }
      );
      lightboxState.stage.addEventListener(
        'touchend',
        function (event) {
          if (lightboxState.zoomed || !event.changedTouches || !event.changedTouches.length) return;
          var diff = event.changedTouches[0].clientX - lightboxState.touchX;
          if (Math.abs(diff) > 48 && lightboxState.items.length > 1) {
            showLightboxSlide(diff < 0 ? lightboxState.index + 1 : lightboxState.index - 1, false);
          }
        },
        { passive: true }
      );
    }
  }

  function initLightboxPage() {
    var imageLinkRe = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
    var rawImages = $$('.post-body img');
    lightboxState.items = [];

    rawImages.forEach(function (img) {
      if (img.classList.contains('no-lightbox')) return;
      if (img.closest && img.closest('.lume-mermaid')) return;
      var parentLink = img.closest ? img.closest('a[href]') : null;
      if (parentLink && !imageLinkRe.test(parentLink.getAttribute('href') || '')) return;

      var figure = img.closest ? img.closest('figure') : null;
      var figcap = figure ? $('figcaption', figure) : null;
      var caption =
        (img.getAttribute('alt') || '').trim() ||
        (figcap ? figcap.textContent.trim() : '');
      var idx = lightboxState.items.length;

      lightboxState.items.push({
        src: img.getAttribute('data-full') || img.currentSrc || img.src,
        caption: caption,
        el: img
      });

      if (img.hasAttribute('data-lightbox-bound')) return;
      img.setAttribute('data-lightbox-bound', '1');
      if (!parentLink) {
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        if (caption) img.setAttribute('aria-label', caption);
      }

      img.addEventListener('click', function (event) {
        if (parentLink) event.preventDefault();
        openLightbox(idx);
      });
      img.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openLightbox(idx);
        }
      });
    });
  }

  function initCodeBlocks() {
    var copyLabel = label('copy', 'Copy');
    var copiedLabel = label('copied', 'Copied');
    var failedLabel = label('copy-failed', 'Failed');
    var copyingLabel = label('copying', 'Copying…');
    var wrapLabel = label('wrap', 'Wrap');
    var unwrapLabel = label('unwrap', 'Unwrap');
    var expandLabel = label('expand-code', 'Expand');
    var collapseLabel = label('collapse-code', 'Collapse');

    $$('.post-body pre').forEach(function (pre) {
      if (pre.closest && pre.closest('.lume-mermaid')) return;
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

      var figcap = figure ? $('figcaption', figure) : null;
      var fileName = figcap
        ? figcap.textContent.trim()
        : (pre.getAttribute('data-file') || code.getAttribute('data-file') || '').trim();
      if (figcap) figcap.remove();

      var firstGutter = figure ? $('td.gutter .line', figure) : null;
      var startLine = firstGutter ? parseInt(firstGutter.textContent, 10) : 1;
      var lineSpans = $$('.line', code);
      var rawText = extractCodeText(code);
      var lineCount = lineSpans.length || rawText.replace(/\n$/, '').split('\n').length;

      var block = document.createElement('div');
      block.className = 'code-block';
      if (flags.codeLineNumbers && lineSpans.length) {
        block.classList.add('has-line-numbers');
        if (startLine > 1 && !isNaN(startLine)) {
          block.style.setProperty('--code-line-start', String(startLine - 1));
        }
      }
      if (flags.codeWrap) block.classList.add('is-wrapped');

      var bar = document.createElement('div');
      bar.className = 'code-block__bar';

      var languageTag = document.createElement('span');
      languageTag.className = 'code-block__lang';
      languageTag.textContent = langLabel(language);
      bar.appendChild(languageTag);

      if (fileName) {
        var fileTag = document.createElement('span');
        fileTag.className = 'code-block__file';
        fileTag.textContent = fileName;
        fileTag.title = fileName;
        bar.appendChild(fileTag);
      }

      var actions = document.createElement('div');
      actions.className = 'code-block__actions';

      var WRAP_ICON =
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M2.5 4h11M2.5 8h8a2.25 2.25 0 0 1 0 4.5H7.5"/>' +
        '<path d="m9.5 10.5-2 2 2 2"/>' +
        '</svg>';

      var wrapBtn = document.createElement('button');
      wrapBtn.type = 'button';
      wrapBtn.className = 'code-block__wrap';
      wrapBtn.setAttribute('aria-pressed', flags.codeWrap ? 'true' : 'false');
      wrapBtn.innerHTML =
        '<span class="code-block__wrap-icon" aria-hidden="true">' +
        WRAP_ICON +
        '</span><span class="code-block__wrap-label"></span>';
      var wrapBtnLabel = wrapBtn.querySelector('.code-block__wrap-label');
      wrapBtnLabel.textContent = flags.codeWrap ? unwrapLabel : wrapLabel;
      var wrapTimer = null;
      wrapBtn.addEventListener('click', function () {
        var next = !block.classList.contains('is-wrapped');
        block.classList.toggle('is-wrapped', next);
        wrapBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        wrapBtnLabel.textContent = next ? unwrapLabel : wrapLabel;
        if (wrapTimer) window.clearTimeout(wrapTimer);
        wrapBtn.classList.remove('is-toggling');
        void wrapBtn.offsetWidth;
        wrapBtn.classList.add('is-toggling');
        wrapTimer = window.setTimeout(function () {
          wrapBtn.classList.remove('is-toggling');
          wrapTimer = null;
        }, 460);
      });
      actions.appendChild(wrapBtn);

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
      actions.appendChild(button);

      bar.appendChild(actions);

      var codeBody = document.createElement('div');
      codeBody.className = 'code-block__body';

      host.parentNode.insertBefore(block, host);
      block.appendChild(bar);
      codeBody.appendChild(host);
      block.appendChild(codeBody);

      if (flags.codeCollapseLines > 0 && lineCount > flags.codeCollapseLines) {
        var maxH = flags.codeCollapseHeight || 360;
        var expanded = false;
        var expandText = expandLabel + ' (' + lineCount + ')';

        block.classList.add('is-collapsible', 'is-collapsed');
        codeBody.style.maxHeight = maxH + 'px';

        var fade = document.createElement('div');
        fade.className = 'code-block__fade';
        fade.setAttribute('aria-hidden', 'true');
        codeBody.appendChild(fade);

        var expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'code-block__expand';
        expandBtn.setAttribute('aria-expanded', 'false');
        expandBtn.textContent = expandText;
        block.appendChild(expandBtn);

        codeBody.addEventListener('transitionend', function (event) {
          if (event.target === codeBody && event.propertyName === 'max-height' && expanded) {
            codeBody.style.maxHeight = 'none';
          }
        });

        expandBtn.addEventListener('click', function () {
          expanded = !expanded;
          expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          expandBtn.textContent = expanded ? collapseLabel : expandText;
          if (expanded) {
            block.classList.remove('is-collapsed');
            var fullH = codeBody.scrollHeight;
            codeBody.style.maxHeight = fullH + 'px';
            if (reduceMotion || fullH <= maxH) codeBody.style.maxHeight = 'none';
          } else {
            if (codeBody.style.maxHeight === 'none') {
              codeBody.style.maxHeight = codeBody.scrollHeight + 'px';
              codeBody.offsetHeight;
            }
            block.classList.add('is-collapsed');
            codeBody.style.maxHeight = maxH + 'px';
          }
        });
      }

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

        copyText(extractCodeText(code)).then(function (ok) {
          /* 复制往往瞬间完成，留一小段「复制中」，让点击有可感知的回执。 */
          var hold = Math.max(0, 260 - (Date.now() - started));
          settleTimer = window.setTimeout(function () {
            settleTimer = null;
            button.setAttribute('data-state', ok ? 'copied' : 'failed');
            buttonLabel.textContent = ok ? copiedLabel : failedLabel;
            if (ok && window.LumeExtras && typeof window.LumeExtras.celebrate === 'function') {
              window.LumeExtras.celebrate(button);
            }
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

  function initOutdatedNotice() {
    var box = $('[data-outdated-days]');
    if (!box) return;
    var threshold = Number(box.getAttribute('data-outdated-days')) || 0;
    var iso = box.getAttribute('data-post-updated');
    var dateLabel = box.getAttribute('data-post-date-label') || '';
    var tpl = box.getAttribute('data-outdated-template') || '';
    var textEl = $('[data-outdated-text]', box);
    if (!threshold || !iso || !tpl || !textEl) return;

    var updatedMs = Date.parse(iso);
    if (isNaN(updatedMs)) return;
    var days = Math.floor((Date.now() - updatedMs) / 86400000);
    if (days < threshold) return;

    textEl.textContent = tpl.replace('{days}', String(days)).replace('{date}', dateLabel);
    box.hidden = false;
  }

  function initCopyLink() {
    var btn = $('[data-copy-link]');
    if (!btn) return;
    var textEl = $('[data-copy-link-label]', btn);
    var defaultText = label('copy-link', 'Copy link');
    var copiedMsg = label('link-copied', 'Post link copied');
    var resetTimer = 0;

    btn.addEventListener('click', function () {
      var shareUrl = window.location.origin + window.location.pathname;
      copyText(shareUrl).then(function (ok) {
        if (!ok) return;
        window.clearTimeout(resetTimer);
        btn.classList.add('is-done');
        if (textEl) textEl.textContent = label('copied', 'Copied');
        showToast(copiedMsg);
        if (window.LumeExtras && typeof window.LumeExtras.celebrate === 'function') {
          window.LumeExtras.celebrate(btn);
        }
        resetTimer = window.setTimeout(function () {
          btn.classList.remove('is-done');
          if (textEl) textEl.textContent = defaultText;
        }, 1600);
      });
    });
  }

  function syncTocDrawer() {
    var fab = $('[data-toc-fab]');
    var drawer = $('[data-toc-drawer]');
    var bodyBox = drawer ? $('[data-toc-drawer-body]', drawer) : null;
    if (!fab || !drawer || !bodyBox) return;

    var sourceToc = $('.post-aside .toc, .toc-mobile .toc');
    if (!sourceToc) {
      bodyBox.innerHTML = '';
      fab.hidden = true;
      if (drawer.open) drawer.close();
      return;
    }

    bodyBox.innerHTML = '';
    var clonedToc = sourceToc.cloneNode(true);
    $$('[data-toc-indicator]', clonedToc).forEach(function (el) {
      el.remove();
    });
    clonedToc.classList.remove('has-indicator', 'is-indicator-ready');
    clonedToc.style.removeProperty('--toc-y');
    clonedToc.style.removeProperty('--toc-h');
    bodyBox.appendChild(clonedToc);
    fab.hidden = false;
  }

  function initTocDrawer() {
    var fab = $('[data-toc-fab]');
    var drawer = $('[data-toc-drawer]');
    if (!fab || !drawer) return;

    var closeBtn = $('[data-toc-drawer-close]', drawer);
    var close = function () {
      if (drawer.open) drawer.close();
    };

    fab.addEventListener('click', function () {
      if (drawer.open) return;
      drawer.showModal();
      fab.setAttribute('aria-expanded', 'true');
      updateTOCActive();
    });

    if (closeBtn) closeBtn.addEventListener('click', close);

    drawer.addEventListener('click', function (event) {
      if (event.target === drawer) {
        close();
        return;
      }
      var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
      if (link) close();
    });

    drawer.addEventListener('cancel', function (event) {
      event.preventDefault();
      close();
    });

    drawer.addEventListener('close', function () {
      fab.setAttribute('aria-expanded', 'false');
    });
  }

  function initTabs() {
    $$('[data-tabs]').forEach(function (group) {
      if (group.hasAttribute('data-tabs-ready')) return;
      group.setAttribute('data-tabs-ready', '1');

      var tabs = $$('[role="tab"]', group);
      var panels = $$('[role="tabpanel"]', group);
      var syncKey = group.getAttribute('data-tabs-sync') || '';

      var activate = function (idx, syncPeers) {
        if (idx < 0 || idx >= tabs.length) return;
        tabs.forEach(function (tab, i) {
          var active = i === idx;
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
          tab.setAttribute('tabindex', active ? '0' : '-1');
        });
        panels.forEach(function (panel, i) {
          panel.hidden = i !== idx;
        });

        if (syncPeers && syncKey) {
          $$('[data-tabs-sync]').forEach(function (peer) {
            if (peer === group || peer.getAttribute('data-tabs-sync') !== syncKey) return;
            if (typeof peer._activateTab === 'function') peer._activateTab(idx, false);
          });
        }
      };

      group._activateTab = activate;

      tabs.forEach(function (tab, idx) {
        tab.addEventListener('click', function () {
          activate(idx, true);
        });
        tab.addEventListener('keydown', function (event) {
          var next = -1;
          if (event.key === 'ArrowRight') next = (idx + 1) % tabs.length;
          else if (event.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = tabs.length - 1;
          if (next >= 0) {
            event.preventDefault();
            activate(next, true);
            tabs[next].focus();
          }
        });
      });
    });
  }

  var FOCUS_KEY = 'lume-reading-focus';

  function readFocusPref() {
    try {
      return window.sessionStorage.getItem(FOCUS_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function writeFocusPref(active) {
    try {
      window.sessionStorage.setItem(FOCUS_KEY, active ? '1' : '0');
    } catch (error) {
      /* ignore */
    }
  }

  function applyReadingFocus(btn, active) {
    root.classList.toggle('is-reading-focus', !!active);
    if (!btn) return;
    btn.classList.toggle('is-active', !!active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    var labelEl = $('[data-reading-focus-label]', btn);
    var enterText = label('focus-mode', 'Focus mode');
    var exitText = label('exit-focus', 'Exit focus');
    if (labelEl) labelEl.textContent = active ? exitText : enterText;
    btn.setAttribute('aria-label', active ? exitText : enterText);
  }

  function initReadingFocus() {
    var btn = $('[data-reading-focus]');
    if (!btn) {
      root.classList.remove('is-reading-focus');
      return;
    }

    applyReadingFocus(btn, readFocusPref());

    btn.addEventListener('click', function () {
      var next = !root.classList.contains('is-reading-focus');
      applyReadingFocus(btn, next);
      writeFocusPref(next);
      showToast(
        next
          ? label('focus-entered', 'Wide focus mode enabled')
          : label('focus-exited', 'Standard layout restored')
      );
      requestScrollUpdate();
      if (!next) {
        window.requestAnimationFrame(function () {
          updateTOCIndicator(true);
        });
      }
    });
  }

  var tocState = {
    links: [],
    headings: [],
    map: new Map(),
    activeHeading: null,
    list: null,
    indicator: null,
    readyRaf: 0,
    lockTarget: null,
    lockTop: 0,
    lockUntil: 0,
    lockTimer: 0,
    lockListenersBound: false
  };

  function clearTOCLock() {
    if (tocState.lockTimer) {
      window.clearTimeout(tocState.lockTimer);
      tocState.lockTimer = 0;
    }
    tocState.lockTarget = null;
    tocState.lockTop = 0;
    tocState.lockUntil = 0;
  }

  function scheduleTOCLockRelease(delay) {
    if (tocState.lockTimer) {
      window.clearTimeout(tocState.lockTimer);
      tocState.lockTimer = 0;
    }
    if (!tocState.lockTarget) return;
    tocState.lockTimer = window.setTimeout(clearTOCLock, delay);
  }

  function bindTOCLockCancelOnce() {
    if (tocState.lockListenersBound) return;
    tocState.lockListenersBound = true;
    var cancelIfActive = function () {
      if (tocState.lockTarget) clearTOCLock();
    };
    window.addEventListener('wheel', cancelIfActive, { passive: true });
    window.addEventListener('touchstart', cancelIfActive, { passive: true });
    window.addEventListener('keydown', function (event) {
      if (!tocState.lockTarget) return;
      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'PageUp' ||
        event.key === 'PageDown' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === ' '
      ) {
        clearTOCLock();
      }
    });
    if ('onscrollend' in window) {
      window.addEventListener(
        'scrollend',
        function () {
          if (tocState.lockTarget) scheduleTOCLockRelease(80);
        },
        { passive: true }
      );
    }
  }

  function updateTOCIndicator(instant) {
    var list = tocState.list;
    var indicator = tocState.indicator;
    if (!list || !indicator) return;
    if (list.offsetParent === null) {
      list.classList.remove('has-indicator');
      return;
    }
    var activeLink = $('.toc-link.is-active, .toc-link[aria-current]', list);
    if (!activeLink) {
      list.classList.remove('has-indicator');
      return;
    }
    var listRect = list.getBoundingClientRect();
    var linkRect = activeLink.getBoundingClientRect();
    if (!listRect.height || !linkRect.height) {
      list.classList.remove('has-indicator');
      return;
    }
    var y = linkRect.top - listRect.top;
    var h = linkRect.height;

    if (instant || !list.classList.contains('is-indicator-ready')) {
      list.classList.remove('is-indicator-ready');
      window.cancelAnimationFrame(tocState.readyRaf);
      list.style.setProperty('--toc-y', y.toFixed(1) + 'px');
      list.style.setProperty('--toc-h', h.toFixed(1) + 'px');
      list.classList.add('has-indicator');
      if (!reduceMotion) {
        tocState.readyRaf = window.requestAnimationFrame(function () {
          tocState.readyRaf = window.requestAnimationFrame(function () {
            if (document.body.contains(list)) list.classList.add('is-indicator-ready');
          });
        });
      }
      return;
    }

    list.style.setProperty('--toc-y', y.toFixed(1) + 'px');
    list.style.setProperty('--toc-h', h.toFixed(1) + 'px');
    list.classList.add('has-indicator');
  }

  function initTOC() {
    clearTOCLock();
    var asideToc = $('.post-aside__inner > .toc');
    window.cancelAnimationFrame(tocState.readyRaf);
    tocState.list = asideToc || null;
    tocState.indicator = null;
    tocState.activeHeading = null;
    if (asideToc) {
      asideToc.classList.remove('has-indicator', 'is-indicator-ready');
      var indicator = $('[data-toc-indicator]', asideToc);
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'toc__indicator';
        indicator.setAttribute('data-toc-indicator', '');
        indicator.setAttribute('aria-hidden', 'true');
        asideToc.insertBefore(indicator, asideToc.firstChild);
      }
      tocState.indicator = indicator;
    }

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

  function tocActivate(heading, force) {
    if (!force && tocState.activeHeading === heading) return;
    tocState.activeHeading = heading || null;
    tocState.links.forEach(function (link) {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');
    });
    var group = tocState.map.get(heading);
    if (!group) {
      if (tocState.list) tocState.list.classList.remove('has-indicator');
      return;
    }
    group.forEach(function (link) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'true');
    });
    updateTOCIndicator(!!force);

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

    if (tocState.lockTarget) {
      if (Date.now() < tocState.lockUntil) {
        scheduleTOCLockRelease(140);
        return;
      }
      clearTOCLock();
    }

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
    var doc = document.documentElement;
    var maxScroll = Math.max(0, doc.scrollHeight - (window.innerHeight || doc.clientHeight || 0));
    var clampedTop = Math.min(Math.max(0, top), maxScroll);
    if (tocState.map && tocState.map.has(target)) {
      if (!reduceMotion && Math.abs(window.pageYOffset - clampedTop) > 4) {
        clearTOCLock();
        tocState.lockTarget = target;
        tocState.lockTop = clampedTop;
        tocState.lockUntil = Date.now() + 3500;
        scheduleTOCLockRelease(400);
      } else {
        clearTOCLock();
      }
      tocActivate(target);
    }
    window.scrollTo({ top: clampedTop, behavior: reduceMotion ? 'auto' : 'smooth' });
    return true;
  }

  function initAnchorScroll() {
    bindTOCLockCancelOnce();
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

  var walineInstance = null;

  function destroyWaline() {
    if (walineInstance && typeof walineInstance.destroy === 'function') {
      try {
        walineInstance.destroy();
      } catch (error) {
        /* ignore */
      }
    }
    walineInstance = null;
  }

  function initComments() {
    var container = $('[data-comments]');
    if (!container || container.hasAttribute('data-comments-ready')) return;
    var mount = $('[data-comments-mount]', container);
    if (!mount) return;
    container.setAttribute('data-comments-ready', '1');
    destroyWaline();

    var provider = container.getAttribute('data-provider') || 'giscus';

    function showCommentError() {
      if (!document.body.contains(mount)) return;
      mount.innerHTML = '';
      var err = document.createElement('p');
      err.className = 'comments__error';
      err.textContent = container.getAttribute('data-label-error') || 'Comments failed to load. Please refresh and try again.';
      mount.appendChild(err);
    }

    function observeVisitorCount() {
      var wrap = $('[data-visitor-count-wrap]');
      var countNode = document.getElementById('twikoo_visitors');
      if (!wrap || !countNode) return;

      var reveal = function () {
        var text = (countNode.textContent || '').trim();
        if (!/^\d+$/.test(text)) return false;
        wrap.removeAttribute('hidden');
        return true;
      };

      if (reveal() || !('MutationObserver' in window)) return;
      var observer = new window.MutationObserver(function () {
        if (reveal()) observer.disconnect();
      });
      observer.observe(countNode, { childList: true, characterData: true, subtree: true });
    }

    function initTwikoo() {
      var envId = container.getAttribute('data-env-id');
      if (!envId) return;
      var countEl = $('[data-comment-count]');
      var countWrap = $('[data-comment-count-wrap]');

      loadTwikooScript(container.getAttribute('data-cdn'))
        .then(function (twikoo) {
          observeVisitorCount();
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
        .catch(showCommentError);
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

    function initWaline() {
      var serverURL = container.getAttribute('data-server-url');
      if (!serverURL) return;
      var cssUrl = container.getAttribute('data-waline-css') || 'https://cdn.jsdelivr.net/npm/@waline/client@3/dist/waline.css';
      var jsUrl = container.getAttribute('data-waline-js') || 'https://cdn.jsdelivr.net/npm/@waline/client@3/dist/waline.umd.js';
      if (cssUrl) loadExternalStyle(cssUrl);

      loadExternalScript(jsUrl)
        .then(function () {
          if (!document.body.contains(mount)) return;
          var walineApi = window.Waline && (typeof window.Waline.init === 'function' ? window.Waline : window.Waline.default);
          if (!walineApi || typeof walineApi.init !== 'function') {
            throw new Error('Waline unavailable');
          }
          destroyWaline();
          walineInstance = walineApi.init({
            el: mount,
            serverURL: serverURL,
            path: window.location.pathname,
            lang: container.getAttribute('data-lang') || 'zh-CN',
            dark: 'html[data-theme="dark"]',
            reaction: container.getAttribute('data-waline-reaction') === 'true',
            pageview: container.getAttribute('data-waline-pageview') === 'true',
            comment: container.getAttribute('data-waline-comment') === 'true'
          });
        })
        .catch(showCommentError);
    }

    var load = provider === 'twikoo' ? initTwikoo : (provider === 'waline' ? initWaline : initGiscus);
    var started = false;

    if (!mount.childNodes.length) {
      var loading = document.createElement('p');
      loading.className = 'comments__loading';
      loading.textContent = container.getAttribute('data-label-loading') || 'Loading comments…';
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
  var SEARCH_HISTORY_KEY = 'lume-search-history';
  var searchState = {
    dialog: null,
    input: null,
    form: null,
    results: null,
    count: null,
    suggestWrap: null,
    recentWrap: null,
    recentList: null,
    items: [],
    active: -1,
    indexPromise: null,
    indexUrl: null,
    seq: 0,
    slashGuard: false,
    slashGuardTimer: 0
  };

  function armSlashGuard() {
    window.clearTimeout(searchState.slashGuardTimer);
    searchState.slashGuard = true;
    searchState.slashGuardTimer = window.setTimeout(function () {
      searchState.slashGuard = false;
    }, 180);
  }

  function disarmSlashGuard() {
    window.clearTimeout(searchState.slashGuardTimer);
    searchState.slashGuard = false;
  }

  function readSearchHistory() {
    try {
      var raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter(function (item) { return typeof item === 'string' && item.trim(); }).slice(0, 5)
        : [];
    } catch (error) {
      return [];
    }
  }

  function writeSearchHistory(list) {
    try {
      if (list.length) window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list));
      else window.localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function saveSearchHistory(query) {
    var clean = String(query || '').trim();
    if (!clean) return;
    var list = readSearchHistory().filter(function (item) {
      return item.toLowerCase() !== clean.toLowerCase();
    });
    list.unshift(clean);
    writeSearchHistory(list.slice(0, 5));
    renderSearchHistory();
  }

  function clearSearchHistory() {
    writeSearchHistory([]);
    renderSearchHistory();
  }

  function renderSearchHistory() {
    if (!searchState.recentWrap || !searchState.recentList) return;
    var list = readSearchHistory();
    searchState.recentList.innerHTML = '';
    if (!list.length) {
      searchState.recentWrap.hidden = true;
      return;
    }
    var fragment = document.createDocumentFragment();
    list.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-search-suggest', item);
      btn.textContent = item;
      fragment.appendChild(btn);
    });
    searchState.recentList.appendChild(fragment);
    searchState.recentWrap.hidden = false;
  }

  function buildSnippet(post, terms) {
    var content = String(post.content || '').trim();
    var fallback = String(post.excerpt || '').trim();
    if (!content || !terms || !terms.length) return fallback;

    var lower = content.toLowerCase();
    var earliest = -1;
    for (var i = 0; i < terms.length; i += 1) {
      var idx = lower.indexOf(terms[i]);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
    }
    if (earliest === -1) return fallback;

    var start = Math.max(0, earliest - 32);
    var end = Math.min(content.length, earliest + 88);
    var slice = content.slice(start, end).trim();
    if (start > 0) slice = '…' + slice;
    if (end < content.length) slice = slice + '…';
    return slice;
  }

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

      var snippet = buildSnippet(post, terms);
      var excerpt = document.createElement('span');
      excerpt.className = 'result__excerpt';
      appendHighlighted(excerpt, snippet, terms);

      link.appendChild(meta);
      link.appendChild(title);
      if (snippet) link.appendChild(excerpt);
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
      renderSearchHistory();
      searchState.results.innerHTML = '';
      searchState.count.textContent = '';
      return;
    }

    var seq = ++searchState.seq;
    var max = Number(searchState.dialog.getAttribute('data-max-results')) || 12;

    if (!searchState.indexPromise) {
      var loading = document.createElement('div');
      loading.className = 'search-loading';
      loading.textContent = searchState.dialog.getAttribute('data-label-loading') || 'Loading index…';
      searchState.results.innerHTML = '';
      searchState.results.appendChild(loading);
    }

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
    renderSearchHistory();
    window.setTimeout(function () {
      searchState.input.focus();
      runOverlaySearch(searchState.input.value);
    }, 30);
  }

  function closeSearchNow(reset) {
    if (!searchState.dialog || !searchState.dialog.open) return;
    searchState.dialog.classList.remove('is-closing');
    searchState.dialog.close();
    body.classList.remove('search-open');
    if (reset && searchState.input) {
      searchState.input.value = '';
      runOverlaySearch('');
    }
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
    searchState.recentWrap = $('[data-search-recent]', dialog);
    searchState.recentList = $('[data-search-recent-list]', dialog);
    searchState.indexUrl = dialog.getAttribute('data-index') || '/search.json';

    if (!searchState.input || !searchState.form) return;
    renderSearchHistory();

    searchState.form.addEventListener('submit', function (event) {
      event.preventDefault();
      var target = searchState.items[searchState.active] || searchState.items[0];
      if (!target) return;
      saveSearchHistory(searchState.input.value);
      closeSearchNow(true);
      navigateTo(target.href);
    });

    searchState.input.addEventListener('beforeinput', function (event) {
      if (!searchState.slashGuard) return;
      if (event.data === '/') {
        event.preventDefault();
        if (event.defaultPrevented) disarmSlashGuard();
      } else {
        disarmSlashGuard();
      }
    });

    var timer;
    searchState.input.addEventListener('input', function () {
      if (searchState.slashGuard) {
        var val = searchState.input.value;
        disarmSlashGuard();
        if (val.charAt(0) === '/') {
          searchState.input.value = val.slice(1);
          window.clearTimeout(timer);
          runOverlaySearch(searchState.input.value);
          return;
        }
      }
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
      var clearBtn = event.target.closest ? event.target.closest('[data-search-clear-history]') : null;
      if (clearBtn) {
        clearSearchHistory();
        searchState.input.focus();
        return;
      }
      var suggestion = event.target.closest ? event.target.closest('[data-search-suggest]') : null;
      if (suggestion) {
        searchState.input.value = suggestion.getAttribute('data-search-suggest');
        runOverlaySearch(searchState.input.value);
        searchState.input.focus();
        return;
      }
      var resultLink = event.target.closest ? event.target.closest('.result') : null;
      if (resultLink && searchState.input.value.trim()) {
        saveSearchHistory(searchState.input.value);
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
  var prefetchTimer = 0;
  var navController = null;
  var navSeq = 0;
  var activeViewTransition = null;
  var vtSeq = 0;

  var progressBar = (function () {
    var showTimer = 0;
    var stepTimer = 0;
    var hideTimer = 0;

    function el() {
      return $('[data-nav-progress]');
    }

    function clearTimers() {
      window.clearTimeout(showTimer);
      window.clearTimeout(stepTimer);
      window.clearTimeout(hideTimer);
    }

    return {
      start: function () {
        var bar = el();
        if (!bar) return;
        clearTimers();
        bar.classList.remove('is-active');
        bar.style.transform = 'scaleX(0)';
        showTimer = window.setTimeout(function () {
          bar.classList.add('is-active');
          bar.style.transform = 'scaleX(0.35)';
          stepTimer = window.setTimeout(function () {
            if (bar.classList.contains('is-active')) bar.style.transform = 'scaleX(0.78)';
          }, 260);
        }, 120);
      },
      done: function () {
        var bar = el();
        if (!bar) return;
        clearTimers();
        if (!bar.classList.contains('is-active')) {
          bar.style.transform = 'scaleX(0)';
          return;
        }
        bar.style.transform = 'scaleX(1)';
        hideTimer = window.setTimeout(function () {
          bar.classList.remove('is-active');
          window.setTimeout(function () {
            if (!bar.classList.contains('is-active')) bar.style.transform = 'scaleX(0)';
          }, 200);
        }, 180);
      },
      cancel: function () {
        var bar = el();
        clearTimers();
        if (!bar) return;
        bar.classList.remove('is-active');
        bar.style.transform = 'scaleX(0)';
      }
    };
  })();

  function trackPageView() {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', {
          page_path: window.location.pathname + window.location.search,
          page_location: window.location.href,
          page_title: document.title
        });
      }
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track();
      }
    } catch (error) {
      /* ignore */
    }
  }

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

  function fetchPage(url, signal) {
    if (cache.has(url)) return cache.get(url);

    var promise = fetch(url, {
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'Lume' },
      signal: signal
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

  var navPillState = { readyRaf: 0 };

  function updateNavPill(options) {
    options = options || {};
    var nav = $('[data-site-nav]');
    var pill = nav ? $('[data-nav-pill]', nav) : null;
    if (!nav || !pill) return;

    if (nav.offsetParent === null) {
      nav.classList.remove('has-pill', 'is-pill-ready');
      return;
    }

    var active = $('.nav-link[aria-current="page"]', nav);
    if (!active) {
      nav.classList.remove('has-pill');
      return;
    }

    var x = active.offsetLeft;
    var y = active.offsetTop;
    var w = active.offsetWidth;
    var h = active.offsetHeight;
    if (!w || !h) return;

    var hadPill = nav.classList.contains('has-pill');
    if (options.instant || !hadPill || !nav.classList.contains('is-pill-ready')) {
      nav.classList.remove('is-pill-ready');
      window.cancelAnimationFrame(navPillState.readyRaf);
      nav.style.setProperty('--pill-x', x + 'px');
      nav.style.setProperty('--pill-y', y + 'px');
      nav.style.setProperty('--pill-w', w + 'px');
      nav.style.setProperty('--pill-h', h + 'px');
      nav.classList.add('has-pill');
      if (!reduceMotion) {
        navPillState.readyRaf = window.requestAnimationFrame(function () {
          navPillState.readyRaf = window.requestAnimationFrame(function () {
            if (document.body.contains(nav)) nav.classList.add('is-pill-ready');
          });
        });
      }
      return;
    }

    nav.style.setProperty('--pill-x', x + 'px');
    nav.style.setProperty('--pill-y', y + 'px');
    nav.style.setProperty('--pill-w', w + 'px');
    nav.style.setProperty('--pill-h', h + 'px');
    nav.classList.add('has-pill');
  }

  function normalizeNavPath(inputUrl) {
    try {
      var parsedUrl = new URL(inputUrl, window.location.href);
      return '/' + parsedUrl.pathname.replace(/index\.html$/, '').replace(/^\/+/, '');
    } catch (error) {
      var raw = String(inputUrl || '');
      return '/' + raw.replace(/index\.html$/, '').replace(/^\/+/, '');
    }
  }

  function syncNav(options) {
    options = options || {};
    var path = options.path;
    if (!path) {
      var main = document.getElementById('main');
      var raw = main ? main.getAttribute('data-path') || '' : '';
      path = '/' + raw.replace(/index\.html$/, '').replace(/^\/+/, '');
    }

    var siteNav = $('[data-site-nav]');
    var activeDesktopLink = null;

    $$('.nav-link').forEach(function (link) {
      var target = link.getAttribute('data-nav-path') || '/';
      var base = target === '/' ? '/' : target.charAt(target.length - 1) === '/' ? target : target + '/';
      var active = target === '/' ? path === '/' : path.indexOf(base) === 0;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (active && siteNav && siteNav.contains(link)) {
        activeDesktopLink = link;
      }
    });

    updateNavPill(options);
    return activeDesktopLink;
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

    closeSearchNow(true);
    closeLightbox();
    var tocDrawer = $('[data-toc-drawer]');
    if (tocDrawer && tocDrawer.open) tocDrawer.close();
    var seq = ++navSeq;
    if (navController) {
      try {
        navController.abort();
      } catch (error) {
        /* ignore */
      }
      navController = null;
    }
    navController = typeof AbortController === 'function' ? new window.AbortController() : null;
    var signal = navController ? navController.signal : undefined;

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

    var siteNav = $('[data-site-nav]');
    var prevNavLink = siteNav ? $('.nav-link[aria-current="page"]', siteNav) : null;
    var nextNavLink = syncNav({ path: normalizeNavPath(url) });
    var isNavTabSwitch = !!(
      prevNavLink &&
      nextNavLink &&
      prevNavLink !== nextNavLink &&
      siteNav &&
      siteNav.offsetParent !== null
    );

    progressBar.start();

    function applySwap(parsed, newMain, targetScroll, useVT) {
      updateHead(parsed);
      destroyWaline();

      var main = document.getElementById('main');
      main.innerHTML = newMain.innerHTML;
      main.setAttribute('data-path', newMain.getAttribute('data-path') || '');
      if (parsed.body && parsed.body.className) body.className = parsed.body.className;
      var pageEl = $('.page', main);
      if (pageEl && useVT) pageEl.classList.add('is-vt-swapped');

      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, targetScroll);
      root.style.scrollBehavior = '';
      root.classList.remove('is-leaving');

      initPage({ skipNav: false });
      if (targetScroll > 0) {
        window.requestAnimationFrame(function () {
          if (seq === navSeq) {
            root.style.scrollBehavior = 'auto';
            window.scrollTo(0, targetScroll);
            root.style.scrollBehavior = '';
          }
        });
        window.setTimeout(function () {
          if (seq === navSeq) {
            root.style.scrollBehavior = 'auto';
            window.scrollTo(0, targetScroll);
            root.style.scrollBehavior = '';
          }
        }, 80);
      }
      focusHeading(main);
      trackPageView();
      progressBar.done();
    }

    return fetchPage(url, signal)
      .then(function (html) {
        if (seq !== navSeq) return;
        var parsed = new window.DOMParser().parseFromString(html, 'text/html');
        var newMain = parsed.querySelector('#main');
        if (!newMain) throw new Error('Missing main');

        if (options.push !== false) {
          window.history.pushState({ url: url, scrollY: 0 }, '', url);
        }

        var targetScroll = options.scroll || 0;
        var canVT =
          !isNavTabSwitch &&
          !reduceMotion &&
          !document.hidden &&
          flags.viewTransitions &&
          typeof document.startViewTransition === 'function';

        if (canVT) {
          if (activeViewTransition) {
            try {
              if (typeof activeViewTransition.skipTransition === 'function') {
                activeViewTransition.skipTransition();
              }
            } catch (error) {
              /* ignore */
            }
            activeViewTransition = null;
          }

          var currentVtId = ++vtSeq;
          var swapped = false;
          var runSwap = function (useVT) {
            if (swapped) return;
            swapped = true;
            applySwap(parsed, newMain, targetScroll, useVT);
          };

          root.classList.add('nav-vt');
          try {
            var vt = document.startViewTransition(function () {
              runSwap(true);
            });
            activeViewTransition = vt;
            var finishVT = function () {
              if (activeViewTransition === vt) activeViewTransition = null;
              if (currentVtId === vtSeq) root.classList.remove('nav-vt');
              if (seq === navSeq) {
                updateTOCIndicator(true);
              }
            };
            vt.finished.then(finishVT, finishVT);
            return;
          } catch (error) {
            root.classList.remove('nav-vt');
            activeViewTransition = null;
            if (swapped) {
              updateTOCIndicator(true);
            } else {
              runSwap(false);
            }
            return;
          }
        }

        root.classList.remove('is-leaving');
        applySwap(parsed, newMain, targetScroll, false);
      })
      .catch(function (error) {
        if (error && error.name === 'AbortError') {
          if (seq === navSeq) syncNav();
          return;
        }
        if (seq !== navSeq) return;
        progressBar.cancel();
        root.classList.remove('is-leaving');
        root.classList.remove('nav-vt');
        window.location.href = url;
      })
      .then(function () {
        if (seq === navSeq) navController = null;
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
      'pointerdown',
      function (event) {
        var link = event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || !isEligible(link)) return;
        prefetch(link.href);
      },
      { passive: true }
    );

    document.addEventListener(
      'pointerover',
      function (event) {
        var link = event.target.closest ? event.target.closest('a[href]') : null;
        if (!link || !isEligible(link)) return;
        var href = link.href;
        window.clearTimeout(prefetchTimer);
        prefetchTimer = window.setTimeout(function () {
          prefetch(href);
        }, 40);
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
  function initPage(options) {
    options = options || {};
    document.documentElement.classList.toggle('has-hero', !!document.querySelector('.hero'));
    initReveal(document);
    initAmbientPause();
    initImages();
    initCoverFallback();
    initOutdatedNotice();
    initCopyLink();
    initReadingFocus();
    initTables();
    initTabs();
    initMermaid();
    initCodeBlocks();
    initMath();
    initLightboxPage();
    syncTocDrawer();
    initTOC();
    initComments();
    refreshScrollTargets();
    if (!options.skipNav) syncNav();
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
      var isCmdK = (event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k';
      if (isCmdK) {
        event.preventDefault();
        if (searchState.dialog.open) closeSearch();
        else openSearch();
        return;
      }
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !searchState.dialog.open
      ) {
        var target = event.target;
        var tag = target && target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          (target && target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        closeMenu();
        armSlashGuard();
        openSearch();
      }
    });
  }

  function checkInitialSearchQuery() {
    if (!searchState.dialog || !window.location.search) return;
    try {
      var params = new window.URLSearchParams(window.location.search);
      var query = (params.get('q') || '').trim();
      if (query) openSearch(query);
    } catch (error) {
      /* ignore */
    }
  }

  function initHeroSnap() {
    if (!flags.heroSnap) return;
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

        if (y <= 4 && event.deltaY > 24) {
          event.preventDefault();
          lockUntil = now + 700;
          window.scrollTo({ top: target, behavior: 'smooth' });
        } else if (event.deltaY < -24 && Math.abs(y - target) < 110) {
          event.preventDefault();
          lockUntil = now + 700;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      { passive: false }
    );
  }

  function initGlobalMotionListeners() {
    var syncVisibility = function () {
      root.classList.toggle('is-page-hidden', !!document.hidden);
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);

    var layoutTimer = 0;
    window.addEventListener(
      'resize',
      function () {
        window.clearTimeout(layoutTimer);
        layoutTimer = window.setTimeout(function () {
          updateNavPill({ instant: true });
          updateTOCIndicator(true);
        }, 60);
      },
      { passive: true }
    );

    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready
        .then(function () {
          updateNavPill({ instant: true });
          updateTOCIndicator(true);
        })
        .catch(function () {});
    }
  }

  function boot() {
    initTheme();
    initScroll();
    initGlobalMotionListeners();
    initReveal(document);
    initPeek();
    initMenu();
    initToTop();
    initGlobalSearchTriggers();
    initSearchOverlay();
    initLightboxGlobal();
    initTocDrawer();
    initAnchorScroll();
    initHeroSnap();
    initRouter();
    if (window.LumeExtras && typeof window.LumeExtras.boot === 'function') {
      window.LumeExtras.boot();
    }
    initPage();
    checkInitialSearchQuery();
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
    closeSearch: closeSearchNow,
    toast: showToast
  };
})();
