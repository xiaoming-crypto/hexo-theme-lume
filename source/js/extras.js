/*
 * Lume extras
 * Music capsule + music page, friend-link fishing, friend circle feed,
 * random post, cover colour API, site screenshots and click confetti.
 *
 * Everything here is progressive enhancement: the site stays usable when
 * APIs are unreachable or scripting is unavailable.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function text(element, value) {
    if (element) element.textContent = value;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function reducedMotion() {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function readStore(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* ignore */
    }
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '0:00';
    var total = Math.floor(seconds);
    var minutes = Math.floor(total / 60);
    var rest = total % 60;
    return minutes + ':' + (rest < 10 ? '0' : '') + rest;
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return date.getFullYear() + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
  }

  /* =============================================================
     Music
  ============================================================= */
  var music = {
    audio: null,
    bound: false,
    list: [],
    index: 0,
    loaded: false,
    loading: false,
    fromCache: false,
    error: false,
    volume: 0.7,
    labels: {
      play: '播放',
      pause: '暂停',
      loading: '歌单加载中…',
      error: '歌单加载失败',
      retry: '重新加载',
      capsule: '听点歌'
    }
  };

  function musicSource() {
    return $('[data-music-capsule]') || $('[data-music-page]');
  }

  function musicConfig() {
    var element = musicSource();
    if (!element) return null;
    return {
      api: element.getAttribute('data-api') || '',
      fallbackApi: element.getAttribute('data-fallback-api') || '',
      server: element.getAttribute('data-server') || 'netease',
      id: element.getAttribute('data-id') || '',
      volume: parseFloat(element.getAttribute('data-volume'))
    };
  }

  function readMusicLabels() {
    var element = musicSource();
    ['play', 'pause', 'loading', 'error', 'retry', 'capsule'].forEach(function (key) {
      var value = element && element.getAttribute('data-label-' + key);
      if (value) music.labels[key] = value;
    });
  }

  function currentSong() {
    return music.list[music.index] || null;
  }

  function ensureAudio() {
    if (music.audio) return music.audio;

    var audio = $('audio[data-music-audio]');
    if (!audio) {
      audio = document.createElement('audio');
      audio.setAttribute('data-music-audio', '');
      audio.preload = 'none';
      document.body.appendChild(audio);
    }

    music.audio = audio;

    var storedVolume = parseFloat(readStore('lume-music-volume', ''));
    if (isNaN(storedVolume)) {
      var conf = musicConfig();
      storedVolume = conf && isFinite(conf.volume) ? conf.volume : 0.7;
    }
    music.volume = clamp(storedVolume, 0, 1);
    audio.volume = music.volume;
    syncVolumeUI();

    if (!music.bound) {
      music.bound = true;
      audio.addEventListener('timeupdate', function () {
        syncProgress(audio.currentTime, audio.duration);
      });
      audio.addEventListener('loadedmetadata', function () {
        syncProgress(audio.currentTime, audio.duration);
      });
      audio.addEventListener('play', function () {
        syncPlaying(true);
      });
      audio.addEventListener('pause', function () {
        syncPlaying(false);
      });
      audio.addEventListener('ended', function () {
        stepTrack(1);
      });
      audio.addEventListener('error', function () {
        music.error = true;
        var pill = $('[data-music-pill]');
        if (pill) text(pill, music.labels.error);
      });
    }

    return audio;
  }

  function normalizePlaylist(data) {
    var raw = Array.isArray(data) ? data : data && Array.isArray(data.data) ? data.data : [];
    return raw
      .map(function (item, index) {
        return {
          name: item.name || item.title || 'Track ' + (index + 1),
          artist: item.artist || item.author || '',
          url: item.url || '',
          pic: item.pic || item.cover || '',
          duration: item.duration || item.dt || 0
        };
      })
      .filter(function (song) {
        return !!song.url;
      });
  }

  var PLAYLIST_CACHE_KEY = 'lume-music-playlist';

  function readPlaylistCache() {
    var raw = readStore(PLAYLIST_CACHE_KEY, '');
    if (!raw) return null;
    try {
      var data = JSON.parse(raw);
      if (!data || !data.at || !Array.isArray(data.list) || !data.list.length) return null;
      return { list: data.list, at: data.at };
    } catch (error) {
      return null;
    }
  }

  function savePlaylistCache(list) {
    try {
      writeStore(PLAYLIST_CACHE_KEY, JSON.stringify({ at: Date.now(), list: list }));
    } catch (error) {
      /* ignore */
    }
  }

  function playlistEndpoint(base, conf) {
    return (
      base +
      (base.indexOf('?') === -1 ? '?' : '&') +
      'server=' +
      encodeURIComponent(conf.server) +
      '&type=playlist&id=' +
      encodeURIComponent(conf.id)
    );
  }

  function requestJson(url, timeout) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller
      ? window.setTimeout(function () {
          controller.abort();
        }, timeout)
      : 0;

    return fetch(url, {
      credentials: 'omit',
      signal: controller ? controller.signal : undefined
    }).then(
      function (response) {
        if (timer) window.clearTimeout(timer);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      },
      function (error) {
        if (timer) window.clearTimeout(timer);
        throw error;
      }
    );
  }

  function loadPlaylist(force) {
    if (music.loading && !force) return music.loadingPromise;
    if (music.loaded && !force && !music.fromCache) return Promise.resolve(music.list);

    if (!music.loaded) {
      var cached = readPlaylistCache();
      if (cached) {
        music.list = cached.list;
        music.loaded = true;
        music.fromCache = true;
        var cachedIndex = parseInt(readStore('lume-music-index', '0'), 10);
        if (isNaN(cachedIndex) || cachedIndex < 0 || cachedIndex >= music.list.length) cachedIndex = 0;
        music.index = cachedIndex;
        applyTrackMeta(false);
        renderMusicList();
        if (!force && Date.now() - cached.at < 10 * 60 * 1000) {
          return Promise.resolve(music.list);
        }
      }
    }

    var conf = musicConfig();
    if (!conf || !conf.api || !conf.id) {
      music.error = true;
      renderMusicList();
      return Promise.resolve([]);
    }

    var bases = [conf.api];
    if (conf.fallbackApi && conf.fallbackApi !== conf.api) bases.push(conf.fallbackApi);

    music.loading = true;

    var attempt = Promise.reject(new Error('no endpoint'));
    bases.forEach(function (base, index) {
      attempt = attempt.catch(function () {
        return requestJson(playlistEndpoint(base, conf), index === 0 ? 12000 : 15000).then(function (data) {
          var list = normalizePlaylist(data);
          if (!list.length) throw new Error('empty playlist');
          return list;
        });
      });
    });

    music.loadingPromise = attempt
      .then(function (list) {
        music.list = list;
        music.loaded = true;
        music.fromCache = false;
        music.error = false;
        music.loading = false;

        var stored = parseInt(readStore('lume-music-index', '0'), 10);
        if (isNaN(stored) || stored < 0 || stored >= music.list.length) stored = 0;
        music.index = stored;
        applyTrackMeta(false);
        savePlaylistCache(music.list);

        renderMusicList();
        return music.list;
      })
      .catch(function () {
        music.loading = false;
        if (music.list.length) {
          music.error = false;
          return music.list;
        }
        music.error = true;
        renderMusicList();
        var pill = $('[data-music-pill]');
        if (pill && !currentSong()) text(pill, music.labels.error);
        return [];
      });

    return music.loadingPromise;
  }

  function applyTrackMeta(autoplay) {
    var song = currentSong();
    if (!song) return;

    var audio = ensureAudio();
    if (audio.getAttribute('src') !== song.url) {
      audio.src = song.url;
      syncProgress(0, 0);
    }

    $$('[data-music-cover]').forEach(function (img) {
      if (song.pic) img.src = song.pic;
      else img.removeAttribute('src');
    });
    $$('[data-page-music-cover]').forEach(function (img) {
      if (song.pic) img.src = song.pic;
      else img.removeAttribute('src');
    });

    $$('[data-music-disc]').forEach(function (img) {
      if (song.pic) {
        img.src = song.pic;
        img.classList.remove('is-empty');
      } else {
        img.removeAttribute('src');
        img.classList.add('is-empty');
      }
    });

    text($('[data-music-title]'), song.name);
    text($('[data-music-artist]'), song.artist);
    text($('[data-page-music-title]'), song.name);
    text($('[data-page-music-artist]'), song.artist);
    text($('[data-music-pill]'), song.name || music.labels.capsule);

    var count = $('[data-music-count]');
    if (count) text(count, music.list.length + ' 首');

    syncListCurrent();
    writeStore('lume-music-index', String(music.index));

    if (autoplay) playAudio();
  }

  function playAudio() {
    var audio = ensureAudio();

    if (!music.list.length) {
      loadPlaylist().then(function (list) {
        if (list.length) applyTrackMeta(true);
      });
      return;
    }

    if (!audio.getAttribute('src')) {
      applyTrackMeta(false);
    }

    var promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {
        syncPlaying(false);
      });
    }
  }

  function togglePlay() {
    var audio = ensureAudio();
    if (!audio.paused) {
      audio.pause();
      return;
    }

    if (!music.loaded && !music.list.length) {
      loadPlaylist().then(function (list) {
        if (list.length) applyTrackMeta(true);
      });
      return;
    }

    if (!currentSong()) return;
    playAudio();
  }

  function stepTrack(direction) {
    if (!music.loaded && !music.list.length) {
      loadPlaylist().then(function (list) {
        if (!list.length) return;
        music.index = (music.index + direction + list.length) % list.length;
        applyTrackMeta(true);
      });
      return;
    }

    if (!music.list.length) return;
    music.index = (music.index + direction + music.list.length) % music.list.length;
    applyTrackMeta(true);
  }

  function playTrack(index) {
    if (!music.list.length) {
      loadPlaylist().then(function (list) {
        if (!list.length) return;
        music.index = clamp(index, 0, list.length - 1);
        applyTrackMeta(true);
      });
      return;
    }
    music.index = clamp(index, 0, music.list.length - 1);
    applyTrackMeta(true);
  }

  function syncPlaying(playing) {
    var capsule = $('[data-music-capsule]');
    if (capsule) capsule.classList.toggle('is-playing', playing);
    $$('.music-now').forEach(function (element) {
      element.classList.toggle('is-playing', playing);
    });

    $$('[data-music-play]').forEach(function (button) {
      button.setAttribute('aria-label', playing ? music.labels.pause : music.labels.play);
      button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    });

    var pill = $('[data-music-capsule]');
    if (pill) pill.classList.toggle('is-playing', playing);
  }

  function syncProgress(current, duration) {
    var ratio = duration > 0 ? clamp(current / duration, 0, 1) : 0;
    $$('[data-music-progress]').forEach(function (input) {
      if (document.activeElement === input) return;
      input.value = String(Math.round(ratio * 1000));
    });

    var label = formatTime(current) + ' / ' + formatTime(duration);
    $$('[data-music-time]').forEach(function (element) {
      element.textContent = label;
    });
  }

  function syncVolumeUI() {
    $$('[data-music-volume]').forEach(function (input) {
      input.value = String(Math.round(music.volume * 100));
    });
  }

  function syncListCurrent() {
    $$('.music-list__item').forEach(function (item) {
      item.classList.toggle('is-current', item.getAttribute('data-index') === String(music.index));
    });
  }

  function renderMusicList() {
    var page = $('[data-music-page]');
    if (!page) return;

    var listElement = $('[data-music-list]', page);
    if (!listElement) return;

    listElement.innerHTML = '';

    if (!music.list.length) {
      var empty = document.createElement('li');
      empty.className = 'music-list__empty';
      if (music.error) {
        var message = document.createElement('span');
        message.textContent = music.labels.error;
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn--ghost music-list__retry';
        retry.setAttribute('data-music-retry', '');
        retry.textContent = music.labels.retry;
        empty.appendChild(message);
        empty.appendChild(retry);
      } else {
        empty.textContent = music.labels.loading;
      }
      listElement.appendChild(empty);
      var count = $('[data-music-count]', page);
      if (count) text(count, '—');
      return;
    }

    var fragment = document.createDocumentFragment();

    music.list.forEach(function (song, index) {
      var item = document.createElement('li');
      item.className = 'music-list__item' + (index === music.index ? ' is-current' : '');
      item.setAttribute('data-index', String(index));

      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-track', String(index));
      button.setAttribute('aria-label', music.labels.play + ' ' + song.name);

      var number = document.createElement('span');
      number.className = 'music-list__num';
      number.textContent = String(index + 1).padStart(2, '0');

      var cover;
      if (song.pic) {
        cover = document.createElement('img');
        cover.className = 'music-list__cover';
        cover.src = song.pic;
        cover.alt = '';
        cover.loading = 'lazy';
      } else {
        cover = document.createElement('span');
        cover.className = 'music-list__cover';
        cover.setAttribute('aria-hidden', 'true');
      }

      var meta = document.createElement('span');
      var title = document.createElement('span');
      title.className = 'music-list__title';
      title.textContent = song.name;
      var artist = document.createElement('span');
      artist.className = 'music-list__artist';
      artist.textContent = song.artist;
      meta.appendChild(title);
      meta.appendChild(artist);

      var duration = document.createElement('span');
      duration.className = 'music-list__dur';
      var raw = parseFloat(song.duration);
      if (isFinite(raw) && raw > 0) {
        duration.textContent = formatTime(raw > 10000 ? raw / 1000 : raw);
      } else {
        duration.textContent = '·';
      }

      button.appendChild(number);
      button.appendChild(cover);
      button.appendChild(meta);
      button.appendChild(duration);
      item.appendChild(button);
      fragment.appendChild(item);
    });

    listElement.appendChild(fragment);

    var countElement = $('[data-music-count]', page);
    if (countElement) text(countElement, music.list.length + ' 首');
  }

  function toggleCapsule(force) {
    var capsule = $('[data-music-capsule]');
    if (!capsule) return;
    var open = typeof force === 'boolean' ? force : !capsule.classList.contains('is-open');
    capsule.classList.toggle('is-open', open);
    var panel = $('[data-music-panel]', capsule);
    if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    var toggle = $('[data-music-toggle]', capsule);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && !music.loaded && !music.loading) loadPlaylist();
  }

  function initMusicPage() {
    var page = $('[data-music-page]');
    if (!page) return;

    ensureAudio();

    if (music.loaded) {
      renderMusicList();
      if (music.list.length) applyTrackMeta(false);
      var audio = ensureAudio();
      syncPlaying(!audio.paused);
      syncProgress(audio.currentTime, audio.duration);
    } else {
      loadPlaylist();
    }
  }

  function bootMusic() {
    readMusicLabels();
    if (!musicSource()) return;

    var audio = ensureAudio();
    syncPlaying(!audio.paused);

    if (!$('[data-music-page]')) {
      var cached = readPlaylistCache();
      if (cached) {
        loadPlaylist();
      } else {
        var deferLoad = function () {
          if (!music.loaded && !music.loading) loadPlaylist();
        };
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(deferLoad, { timeout: 3500 });
        } else {
          window.setTimeout(deferLoad, 1500);
        }
      }
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var toggle = target.closest('[data-music-toggle]');
      if (toggle) {
        event.preventDefault();
        toggleCapsule();
        return;
      }

      if (target.closest('[data-music-retry]')) {
        event.preventDefault();
        music.error = false;
        renderMusicList();
        loadPlaylist(true);
        return;
      }

      if (target.closest('[data-music-play]')) {
        event.preventDefault();
        togglePlay();
        return;
      }

      if (target.closest('[data-music-prev]')) {
        event.preventDefault();
        stepTrack(-1);
        return;
      }

      if (target.closest('[data-music-next]')) {
        event.preventDefault();
        stepTrack(1);
        return;
      }

      var track = target.closest('[data-track]');
      if (track) {
        event.preventDefault();
        playTrack(parseInt(track.getAttribute('data-track'), 10) || 0);
        return;
      }

      var capsule = $('[data-music-capsule]');
      if (capsule && capsule.classList.contains('is-open') && !target.closest('.capsule')) {
        toggleCapsule(false);
      }
    });

    document.addEventListener('input', function (event) {
      var target = event.target;
      if (!target || !target.matches) return;

      if (target.matches('[data-music-progress]')) {
        var audio = ensureAudio();
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        var ratio = parseFloat(target.value) / 1000;
        audio.currentTime = ratio * audio.duration;
        syncProgress(audio.currentTime, audio.duration);
        return;
      }

      if (target.matches('[data-music-volume]')) {
        var volume = clamp(parseFloat(target.value) / 100, 0, 1);
        if (isNaN(volume)) return;
        music.volume = volume;
        ensureAudio().volume = volume;
        writeStore('lume-music-volume', String(volume));
        syncVolumeUI();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if ($('[data-music-capsule].is-open')) toggleCapsule(false);
    });
  }

  /* =============================================================
     Cover colour API
  ============================================================= */
  var colorCache = {};

  function applyTone(element, color) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return;
    element.style.setProperty('--accent', color);
    element.style.setProperty('--page-accent', color);
    element.setAttribute('data-tone', color);

    // 文章主色来自封面，明暗不可控；按亮度算一个可读的文字色，避免按钮文字与底色融在一起。
    var hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(function (char) { return char + char; }).join('');
    }
    var r = parseInt(hex.slice(0, 2), 16);
    var g = parseInt(hex.slice(2, 4), 16);
    var b = parseInt(hex.slice(4, 6), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    element.style.setProperty('--on-accent', luminance > 0.62 ? '#1b1329' : '#fffdf8');
  }

  function initColorTone() {
    var post = $('[data-color-enabled]');
    if (!post || post.hasAttribute('data-tone-ready')) return;
    if (post.getAttribute('data-color-enabled') === 'false') return;
    post.setAttribute('data-tone-ready', '1');

    var preset = post.getAttribute('data-main-color') || '';
    if (preset) {
      applyTone(post, preset);
      return;
    }

    var api = post.getAttribute('data-color-api') || '';
    var image = post.getAttribute('data-color-img') || '';
    if (!api || !image) return;
    if (post.getAttribute('data-cover-change') === 'false') return;

    if (!/^https?:/i.test(image)) {
      try {
        image = new URL(image, window.location.href).href;
      } catch (error) {
        return;
      }
    }

    if (colorCache[image]) {
      applyTone(post, colorCache[image]);
      return;
    }

    fetch(api + encodeURIComponent(image), { credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var value = data && (data.RGB || data.rgb || data.color);
        if (typeof value !== 'string') return;
        value = value.trim();
        if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
          if (/^[0-9a-f]{6}$/i.test(value)) value = '#' + value;
          else return;
        }
        colorCache[image] = value;
        applyTone(post, value);
      })
      .catch(function () {
        /* keep the default accent */
      });
  }

  /* =============================================================
     Random post
  ============================================================= */
  var randomIndex = null;

  function postsIndexUrl() {
    return root.getAttribute('data-posts-index') || '/posts.json';
  }

  function searchIndexUrl() {
    var dialog = $('[data-search-dialog]');
    return (dialog && dialog.getAttribute('data-index')) || '/search.json';
  }

  function fetchPostList(url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        return Array.isArray(data) ? data.filter(function (item) { return item && item.url; }) : [];
      });
  }

  function loadRandomIndex() {
    if (randomIndex) return Promise.resolve(randomIndex);
    return fetchPostList(postsIndexUrl())
      .catch(function () {
        return fetchPostList(searchIndexUrl());
      })
      .then(function (list) {
        randomIndex = list;
        return list;
      });
  }

  function randomPost() {
    loadRandomIndex()
      .then(function (list) {
        if (!list.length) {
          window.location.href = '/';
          return;
        }
        var currentPath = window.location.pathname;
        var pool = list.length > 1
          ? list.filter(function (item) {
              try {
                return new URL(item.url, window.location.origin).pathname !== currentPath;
              } catch (error) {
                return true;
              }
            })
          : list;
        var choices = pool.length ? pool : list;
        var post = choices[Math.floor(Math.random() * choices.length)];
        if (window.Lume && typeof window.Lume.navigate === 'function') {
          window.Lume.navigate(post.url);
        } else {
          window.location.href = post.url;
        }
      })
      .catch(function () {
        window.location.href = '/archives/';
      });
  }

  /* =============================================================
     Friend circle + fishing
  ============================================================= */
  var friendCache = { url: '', data: null, promise: null };

  function friendFeedUrl(element) {
    var base = (element.getAttribute('data-api') || '').trim();
    if (!base) return '';
    if (/\.json(\?|$)/i.test(base)) return base;
    return base.replace(/\/+$/, '') + '/all.json';
  }

  function loadFriendArticles(element, force) {
    var url = friendFeedUrl(element);
    if (!url) return Promise.resolve([]);

    if (!force) {
      if (friendCache.url === url && friendCache.data) return Promise.resolve(friendCache.data);
      if (friendCache.url === url && friendCache.promise) return friendCache.promise;
    }

    friendCache.url = url;

    var promise = fetch(url, { credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        var raw = json && (json.article_data || json.data || json.articles || json);
        var list = (Array.isArray(raw) ? raw : [])
          .map(function (item) {
            return {
              title: item.title || '',
              link: item.link || item.url || '',
              author: item.author || item.name || item.site || '',
              avatar: item.avatar || '',
              created: item.created || item.date || item.pubDate || item.published || ''
            };
          })
          .filter(function (item) {
            return !!item.link;
          });
        friendCache.data = list;
        friendCache.promise = null;
        return list;
      })
      .catch(function (error) {
        friendCache.promise = null;
        throw error;
      });

    friendCache.promise = promise;
    return promise;
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function initFishing() {
    var box = $('[data-fishing]');
    if (!box || box.hasAttribute('data-fishing-ready')) return;
    box.setAttribute('data-fishing-ready', '1');

    var cast = $('[data-fishing-cast]', box);
    var result = $('[data-fishing-result]', box);
    if (!cast || !result) return;

    var tips = (box.getAttribute('data-tips') || '')
      .split('|')
      .map(function (tip) {
        return tip.trim();
      })
      .filter(Boolean);
    var castLabel = box.getAttribute('data-label-cast') || cast.textContent;
    var castingLabel = box.getAttribute('data-label-casting') || '抛竿中…';
    var emptyLabel = box.getAttribute('data-label-empty') || '今天鱼塘有点安静';
    var resizeToken = 0;
    var resizeTimer = 0;
    var resizeEndHandler = null;

    function cancelResize() {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
        resizeTimer = 0;
      }
      if (resizeEndHandler) {
        result.removeEventListener('transitionend', resizeEndHandler);
        resizeEndHandler = null;
      }
    }

    function updateResult(renderFn) {
      if (reducedMotion()) {
        resizeToken += 1;
        cancelResize();
        result.classList.remove('is-resizing');
        result.style.height = '';
        result.style.transition = '';
        renderFn();
        return;
      }

      var token = ++resizeToken;
      cancelResize();

      var startHeight = result.getBoundingClientRect().height;

      result.classList.remove('is-resizing');
      result.style.transition = 'none';
      result.style.height = 'auto';
      renderFn();
      var endHeight = result.getBoundingClientRect().height;

      if (Math.abs(endHeight - startHeight) < 1) {
        result.style.height = '';
        result.style.transition = '';
        return;
      }

      result.style.height = startHeight + 'px';
      result.classList.add('is-resizing');
      void result.offsetHeight;
      result.style.transition = '';

      function settle() {
        if (token !== resizeToken) return;
        cancelResize();
        result.classList.remove('is-resizing');
        result.style.height = '';
      }

      resizeEndHandler = function (event) {
        if (event.target === result && event.propertyName === 'height') settle();
      };
      result.addEventListener('transitionend', resizeEndHandler);
      resizeTimer = window.setTimeout(settle, 700);

      window.requestAnimationFrame(function () {
        if (token !== resizeToken) return;
        result.style.height = endHeight + 'px';
      });
    }

    cast.addEventListener('click', function () {
      if (cast.disabled) return;
      cast.disabled = true;
      cast.textContent = castingLabel;
      box.classList.add('is-casting');

      loadFriendArticles(box, false)
        .then(function (list) {
          box.classList.remove('is-casting');
          cast.disabled = false;
          cast.textContent = castLabel;

          if (!list.length) {
            updateResult(function () {
              result.textContent = emptyLabel;
            });
            return;
          }

          var article = list[Math.floor(Math.random() * list.length)];
          var tip = tips.length ? tips[Math.floor(Math.random() * tips.length)] : '';

          var win = document.createElement('span');
          win.className = 'fishing__win';
          if (tip) win.appendChild(document.createTextNode(tip + ' '));

          var link = document.createElement('a');
          link.href = article.link;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = '《' + (article.title || article.link) + '》';
          win.appendChild(link);

          updateResult(function () {
            result.innerHTML = '';
            result.appendChild(win);
          });
          celebrate(cast);
        })
        .catch(function () {
          box.classList.remove('is-casting');
          cast.disabled = false;
          cast.textContent = castLabel;
          updateResult(function () {
            result.textContent = emptyLabel;
          });
        });
    });
  }

  function renderFeed(feed, force) {
    var listElement = $('[data-friends-list]', feed);
    var status = $('[data-friends-status]', feed);
    if (!listElement) return;

    var pageSize = parseInt(feed.getAttribute('data-page-size'), 10) || 12;
    var loadingLabel = feed.getAttribute('data-label-loading') || '正在打捞…';
    var emptyLabel = feed.getAttribute('data-label-empty') || '今天鱼塘有点安静';

    if (status) {
      status.hidden = false;
      status.textContent = loadingLabel;
    }

    loadFriendArticles(feed, force)
      .then(function (list) {
        listElement.querySelectorAll('.feed-post').forEach(function (node) {
          node.remove();
        });

        if (!list.length) {
          if (status) {
            status.hidden = false;
            status.textContent = emptyLabel;
          }
          return;
        }

        if (status) status.hidden = true;

        var fragment = document.createDocumentFragment();
        shuffle(list)
          .slice(0, pageSize)
          .forEach(function (article) {
            var link = document.createElement('a');
            link.className = 'feed-post';
            link.href = article.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            var title = document.createElement('strong');
            title.textContent = article.title || article.link;
            link.appendChild(title);

            var meta = document.createElement('span');
            meta.className = 'feed-post__meta';

            if (article.avatar) {
              var avatar = document.createElement('img');
              avatar.src = article.avatar;
              avatar.alt = '';
              avatar.loading = 'lazy';
              avatar.width = 18;
              avatar.height = 18;
              meta.appendChild(avatar);
            }

            var author = document.createElement('span');
            author.textContent = article.author || '';
            meta.appendChild(author);

            var created = formatDate(article.created);
            if (created) {
              var time = document.createElement('time');
              time.textContent = created.slice(5);
              if (article.created) time.dateTime = article.created;
              meta.appendChild(time);
            }

            link.appendChild(meta);
            fragment.appendChild(link);
          });

        listElement.appendChild(fragment);
      })
      .catch(function () {
        if (status) {
          status.hidden = false;
          status.textContent = emptyLabel;
        }
      });
  }

  function initFriendsFeed() {
    var feed = $('[data-friends-feed]');
    if (!feed || feed.hasAttribute('data-feed-ready')) return;
    feed.setAttribute('data-feed-ready', '1');

    renderFeed(feed, false);

    var refresh = $('[data-friends-refresh]', feed);
    if (refresh) {
      refresh.addEventListener('click', function () {
        if (refresh.disabled) return;
        refresh.disabled = true;
        renderFeed(feed, true);
        window.setTimeout(function () {
          refresh.disabled = false;
        }, 600);
      });
    }
  }

  function initSiteshots() {
    $$('[data-siteshot]').forEach(function (card) {
      var shot = card.getAttribute('data-siteshot');
      if (!shot) return;
      card.style.setProperty('--shot', 'url("' + shot.replace(/"/g, '%22') + '")');
    });
  }

  /* =============================================================
     Confetti
  ============================================================= */
  var confettiBooted = false;
  var palette = ['#f5822a', '#ffd166', '#ff8fab', '#7ee0c0', '#8ec5ff', '#c9a7ff'];

  function confettiScope() {
    if (root.getAttribute('data-confetti') === 'false') return 'off';
    return root.getAttribute('data-confetti-scope') || 'celebrate';
  }

  function confettiBurst(x, y) {
    for (var i = 0; i < 8; i++) {
      var bit = document.createElement('span');
      bit.className = 'confetti-bit';
      bit.setAttribute('aria-hidden', 'true');
      bit.style.left = x + 'px';
      bit.style.top = y + 'px';
      bit.style.background = palette[i % palette.length];

      var angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.6;
      var distance = 26 + Math.random() * 48;
      bit.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
      bit.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
      bit.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');

      document.body.appendChild(bit);
      window.setTimeout(function (node) {
        return function () {
          if (node.parentNode) node.parentNode.removeChild(node);
        };
      }(bit), 950);
    }
  }

  function celebrate(targetOrX, y) {
    if (reducedMotion() || confettiScope() === 'off') return;
    if (typeof targetOrX === 'number' && typeof y === 'number') {
      confettiBurst(targetOrX, y);
      return;
    }
    if (targetOrX && typeof targetOrX.getBoundingClientRect === 'function') {
      var rect = targetOrX.getBoundingClientRect();
      confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
  }

  function bootConfetti() {
    if (confettiBooted) return;
    confettiBooted = true;
    if (confettiScope() !== 'all') return;

    document.addEventListener('click', function (event) {
      if (reducedMotion()) return;
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('pre, code, input, textarea, select')) return;
      if (target.closest('[data-reward-modal]')) return;
      if (!target.closest('a, button')) return;
      confettiBurst(event.clientX, event.clientY);
    });
  }

  /* =============================================================
     正文 <details>：给展开 / 收起加高度动画
  ============================================================= */
  function initDetails() {
    $$('.post-body details').forEach(function (details) {
      if (details.hasAttribute('data-details-ready')) return;
      var summary = details.querySelector('summary');
      if (!summary) return;
      details.setAttribute('data-details-ready', '1');

      var body = document.createElement('div');
      var inner = document.createElement('div');
      body.className = 'details__body';
      inner.className = 'details__body-inner';
      var node = summary.nextSibling;
      while (node) {
        var next = node.nextSibling;
        inner.appendChild(node);
        node = next;
      }
      body.appendChild(inner);
      details.appendChild(body);
      body.style.height = details.open ? 'auto' : '0px';
      var closing = false;

      function settle() {
        if (closing) {
          details.open = false;
          closing = false;
        }
        details.removeAttribute('data-details-animating');
        body.style.height = details.open ? 'auto' : '0px';
        body.removeEventListener('transitionend', onEnd);
      }

      function onEnd(event) {
        if (event.target === body && event.propertyName === 'height') settle();
      }

      summary.addEventListener('click', function (event) {
        if (reducedMotion()) return;
        event.preventDefault();
        if (details.hasAttribute('data-details-animating')) return;
        details.setAttribute('data-details-animating', '1');
        body.addEventListener('transitionend', onEnd);
        window.setTimeout(settle, 700);

        if (details.open) {
          closing = true;
          body.style.height = body.scrollHeight + 'px';
          window.requestAnimationFrame(function () {
            body.style.height = '0px';
          });
        } else {
          details.open = true;
          body.style.height = '0px';
          window.requestAnimationFrame(function () {
            body.style.height = body.scrollHeight + 'px';
          });
        }
      });
    });
  }

  /* =============================================================
     打赏弹层：支付方式切换 / 收款码展示，仅展示，不发起支付
  ============================================================= */
  function initReward() {
    var modal = $('#main [data-reward-modal]');
    var portals = $$('body > [data-reward-modal]');
    if (!modal) {
      if (portals.length && portals[0].getAttribute('data-reward-path') === window.location.pathname) return;
      portals.forEach(function (el) {
        if (el.open && typeof el.close === 'function') el.close();
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      document.body.classList.remove('reward-open');
      return;
    }
    /* 文章容器带有 reveal 的 transform，挂载到 body 并由原生 <dialog> 管理 Top Layer 与焦点陷阱。 */
    portals.forEach(function (el) {
      if (el.open && typeof el.close === 'function') el.close();
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    document.body.appendChild(modal);
    modal.setAttribute('data-reward-path', window.location.pathname);
    if (modal.hasAttribute('data-reward-ready')) return;
    modal.setAttribute('data-reward-ready', '1');

    var openBtn = $('[data-reward-open]');
    var closeEls = $$('[data-reward-close]', modal);
    var methods = $$('[data-reward-method]', modal);
    var panelsWrap = $('.reward-panels', modal);
    var panels = $$('[data-reward-panel]', modal);
    var closeTimer = 0;

    function openModal() {
      window.clearTimeout(closeTimer);
      if (typeof modal.showModal === 'function') {
        if (!modal.open) modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
      document.body.classList.add('reward-open');
      window.requestAnimationFrame(function () {
        modal.classList.add('is-open');
      });
      celebrate(openBtn);
      var closeBtn = $('.reward-modal__close', modal);
      if (closeBtn) window.setTimeout(function () { closeBtn.focus(); }, 100);
    }

    function finishClose() {
      modal.classList.remove('is-open');
      document.body.classList.remove('reward-open');
      if (typeof modal.close === 'function') {
        if (modal.open) modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }

    function closeModal() {
      window.clearTimeout(closeTimer);
      modal.classList.remove('is-open');
      document.body.classList.remove('reward-open');
      if (reducedMotion()) {
        finishClose();
        return;
      }
      closeTimer = window.setTimeout(finishClose, 240);
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    closeEls.forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
    modal.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeModal();
    });
    modal.addEventListener('close', function () {
      window.clearTimeout(closeTimer);
      modal.classList.remove('is-open');
      document.body.classList.remove('reward-open');
    });

    var panelToken = 0;
    var panelTimer = 0;
    methods.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-reward-method');
        if (btn.classList.contains('is-active')) return;

        var token = ++panelToken;
        window.clearTimeout(panelTimer);
        var startHeight = panelsWrap && !reducedMotion() ? panelsWrap.getBoundingClientRect().height : 0;

        methods.forEach(function (other) {
          var active = other === btn;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (panelsWrap && !reducedMotion()) {
          panelsWrap.classList.remove('is-resizing');
          panelsWrap.style.transition = 'none';
          panelsWrap.style.height = 'auto';
        }
        panels.forEach(function (panel) {
          var active = panel.getAttribute('data-reward-panel') === key;
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
        });

        if (!panelsWrap || reducedMotion()) return;
        var endHeight = panelsWrap.getBoundingClientRect().height;
        if (Math.abs(endHeight - startHeight) < 1) {
          panelsWrap.style.height = '';
          panelsWrap.style.transition = '';
          return;
        }
        panelsWrap.style.height = startHeight + 'px';
        panelsWrap.classList.add('is-resizing');
        void panelsWrap.offsetHeight;
        panelsWrap.style.transition = '';
        window.requestAnimationFrame(function () {
          if (token !== panelToken) return;
          panelsWrap.style.height = endHeight + 'px';
        });
        panelTimer = window.setTimeout(function () {
          if (token !== panelToken) return;
          panelsWrap.classList.remove('is-resizing');
          panelsWrap.style.height = '';
        }, 300);
      });
    });
  }

  /* =============================================================
     自定义悬浮提示：接管原生 title，统一成站点气泡
  ============================================================= */
  function initTooltips() {
    $$('[title]').forEach(function (element) {
      var tag = element.tagName;
      if (tag === 'IFRAME' || tag === 'ABBR' || tag === 'INPUT' || tag === 'TEXTAREA') return;
      var tip = element.getAttribute('title');
      if (!tip || element.hasAttribute('data-tip')) return;
      element.setAttribute('data-tip', tip);
      element.removeAttribute('title');
      element.classList.add('has-tip');
    });
  }

  /* =============================================================
     自定义右键菜单
  ============================================================= */
  var ctxMenu = null;
  var ctxOpen = false;

  function copyValue(value) {
    return new Promise(function (resolve) {
      function fallback() {
        var area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();
        var ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (error) {
          ok = false;
        }
        document.body.removeChild(area);
        resolve(ok);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () {
          resolve(true);
        }, fallback);
      } else {
        fallback();
      }
    });
  }

  function closeContextMenu() {
    if (!ctxMenu || !ctxOpen) return;
    ctxOpen = false;
    ctxMenu.classList.remove('is-open');
    window.setTimeout(function () {
      if (!ctxOpen) ctxMenu.hidden = true;
    }, 180);
  }

  function menuItem(label, icon, hint, run) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'lume-menu__item';
    button.setAttribute('role', 'menuitem');
    button.innerHTML =
      '<span class="lume-menu__icon" aria-hidden="true">' + icon + '</span><span>' + label + '</span>' +
      (hint ? '<span class="lume-menu__hint">' + hint + '</span>' : '');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      run(button);
    });
    return button;
  }

  function openContextMenu(x, y, target) {
    if (!ctxMenu) {
      ctxMenu = document.createElement('div');
      ctxMenu.className = 'lume-menu';
      ctxMenu.setAttribute('role', 'menu');
      ctxMenu.setAttribute('aria-label', '快捷菜单');
      ctxMenu.hidden = true;
      document.body.appendChild(ctxMenu);
    }

    ctxMenu.innerHTML = '';
    var head = document.createElement('div');
    head.className = 'lume-menu__head';
    head.textContent = '快捷操作';
    ctxMenu.appendChild(head);

    var selection = (window.getSelection ? window.getSelection().toString() : '').trim();
    var link = target.closest ? target.closest('a[href]') : null;
    var image = target.closest ? target.closest('img') : null;
    var items = [];

    if (link) {
      var href = link.href;
      items.push(
        menuItem('在新标签页打开', '↗', '', function () {
          window.open(href, '_blank', 'noopener');
        }),
        menuItem('复制链接地址', '⧉', '', function (button) {
          copyValue(href).then(function () {
            if (button) button.querySelector('span:nth-child(2)').textContent = '已复制';
          });
        })
      );
    }

    if (selection) {
      items.push(
        menuItem('复制选中文字', '“”', selection.length + ' 字', function (button) {
          copyValue(selection).then(function (ok) {
            if (ok && button) button.querySelector('span:nth-child(2)').textContent = '已复制';
          });
        })
      );
    }

    if (!link && image && image.src) {
      items.push(
        menuItem('在新标签页查看图片', '⊞', '', function () {
          window.open(image.src, '_blank', 'noopener');
        }),
        menuItem('复制图片地址', '⧉', '', function (button) {
          copyValue(image.src).then(function () {
            if (button) button.querySelector('span:nth-child(2)').textContent = '已复制';
          });
        })
      );
    }

    items.push(
      menuItem('复制页面链接', '⧉', '', function (button) {
        copyValue(window.location.href).then(function () {
          if (button) button.querySelector('span:nth-child(2)').textContent = '已复制';
        });
      }),
      menuItem('回到顶部', '↑', '', function () {
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      })
    );

    var dividerAt = items.length - 2;
    items.forEach(function (item, index) {
      if (dividerAt > 0 && index === dividerAt) {
        var line = document.createElement('div');
        line.className = 'lume-menu__divider';
        ctxMenu.appendChild(line);
      }
      ctxMenu.appendChild(item);
    });

    ctxMenu.hidden = false;
    ctxMenu.classList.remove('is-open');
    var width = ctxMenu.offsetWidth;
    var height = ctxMenu.offsetHeight;
    var left = clamp(x, 8, window.innerWidth - width - 8);
    var top = clamp(y, 8, window.innerHeight - height - 8);
    ctxMenu.style.left = left + 'px';
    ctxMenu.style.top = top + 'px';
    ctxOpen = true;
    window.requestAnimationFrame(function () {
      if (ctxOpen) ctxMenu.classList.add('is-open');
    });
    var first = ctxMenu.querySelector('.lume-menu__item');
    if (first) {
      // 等定位完成再聚焦，避免菜单先从左上角闪一下
      window.setTimeout(function () {
        if (ctxOpen && first) first.focus({ preventScroll: true });
      }, 30);
    }
  }

  function bindContextMenu() {
    if (root.getAttribute('data-context-menu') !== 'true') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (document.documentElement.hasAttribute('data-ctx-menu')) return;
    document.documentElement.setAttribute('data-ctx-menu', '1');

    document.addEventListener('contextmenu', function (event) {
      if (event.shiftKey) return;
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
      event.preventDefault();
      openContextMenu(event.clientX, event.clientY, target);
    });

    document.addEventListener('pointerdown', function (event) {
      if (!ctxOpen) return;
      if (ctxMenu && ctxMenu.contains(event.target)) return;
      closeContextMenu();
    });

    window.addEventListener('scroll', closeContextMenu, { passive: true });
    window.addEventListener('resize', closeContextMenu, { passive: true });
    window.addEventListener('blur', closeContextMenu);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeContextMenu();
    });
  }

  /* =============================================================
     Music list collapse (mobile)
  ============================================================= */
  function initMusicListToggle() {
    var toggle = $('[data-music-list-toggle]');
    if (!toggle) return;
    var card = toggle.closest('.music-list-card');
    if (!card) return;
    var label = $('[data-music-list-toggle-label]', toggle);

    toggle.addEventListener('click', function () {
      var open = card.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      text(label, open ? '收起歌单' : '展开歌单');
    });
  }

  /* =============================================================
     Public hooks (called by app.js)
  ============================================================= */
  window.LumeExtras = {
    celebrate: celebrate,

    boot: function () {
      bootMusic();
      bootConfetti();
      bindContextMenu();

      document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        if (!target.closest('[data-random-post]')) return;
        event.preventDefault();
        randomPost();
      });
    },

    init: function () {
      closeContextMenu();
      initTooltips();
      initMusicPage();
      initColorTone();
      initFishing();
      initFriendsFeed();
      initSiteshots();
      initDetails();
      initMusicListToggle();
      initReward();
    }
  };
})();
