/*!
 * StreamPod — Ghost podcast player
 * -----------------------------------------------------------------------------
 * One shared <audio> element drives two surfaces:
 *   1. the site-wide sticky player (#qap, rendered once from default.hbs)
 *   2. per-post inline players (injected into post content)
 *
 * Ghost does a full page reload on every navigation, so playback state and the
 * position of every episode are persisted to localStorage and rehydrated on
 * DOMContentLoaded.
 *
 * Vanilla ES5-compatible JS: the theme ships no framework and Ghost's built
 * assets do not include jQuery.
 */
(function () {
    'use strict';

    var LSK_STATE = 'qap:state:v1';   // current/last session state
    var LSK_TIMES = 'qap:times:v1';   // per-episode position memory { url: seconds }
    var MAX_TIMES = 80;               // cap the position dictionary
    var SAVE_EVERY = 2000;            // throttle for timeupdate writes (ms)
    var RSS_LIMIT = 5;                // "latest 5 episodes"
    var NEAR_END = 10;                // seconds before the end we treat as finished

    /* CORS fallbacks, tried in order. A podcast feed is almost never served with
       permissive CORS, and a static theme has no server to proxy through, so we
       try the direct URL first (works when the feed is same-origin or CORS-enabled)
       and then public read-only proxies. */
    var PROXIES = [
        function (u) { return u; },
        function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
        function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); }
    ];

    /* ------------------------------------------------------------------ utils */
    function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
    function qsa(sel, ctx) {
        return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    }
    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    function fmt(sec) {
        if (!isFinite(sec) || sec < 0) { return '0:00'; }
        sec = Math.floor(sec);
        var m = Math.floor(sec / 60), s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function readJSON(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);
            if (!raw) { return fallback; }
            var val = JSON.parse(raw);
            return (val && typeof val === 'object') ? val : fallback;
        } catch (e) { return fallback; }
    }
    function writeJSON(key, val) {
        try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota / private mode */ }
    }

    /* ------------------------------------------------------------- root lookup */
    var root = qs('#qap');
    if (!root) { return; }

    var el = {
        art:       qs('.qap-art-img', root),
        artBox:    qs('.qap-art', root),
        show:      qs('.qap-show', root),
        title:     qs('.qap-title', root),
        seek:      qs('.qap-seek-track', root),
        fill:      qs('.qap-seek-fill', root),
        buf:       qs('.qap-seek-buffer', root),
        thumb:     qs('.qap-seek-thumb', root),
        cur:       qs('.qap-time-current', root),
        total:     qs('.qap-time-total', root),
        play:      qs('.qap-play', root),
        skipB:     qs('.qap-skip-back', root),
        skipF:     qs('.qap-skip-fwd', root),
        speed:     qs('.qap-speed', root),
        listBtn:   qs('.qap-playlist-toggle', root),
        volBtn:    qs('.qap-volume', root),
        volSlider: qs('.qap-volume-slider', root),
        minBtn:    qs('.qap-minimize', root),
        playlist:  qs('.qap-playlist', root),
        list:      qs('.qap-playlist-list', root),
        listMsg:   qs('.qap-playlist-msg', root),
        tabPlay:   qs('.qap-tab-play', root),
        tabLabel:  qs('.qap-tab-label', root),
        tabRestore:qs('.qap-tab-restore', root)
    };

    var cfg = {
        showName:  root.getAttribute('data-show-name') || document.title,
        cover:     root.getAttribute('data-cover') || '',
        defaultUrl:root.getAttribute('data-audio-url') || '',
        rss:       root.getAttribute('data-rss-url') || '',
        accent:    root.getAttribute('data-accent') || '',
        minimized: root.getAttribute('data-minimized') === 'true',
        showList:  root.getAttribute('data-show-playlist') !== 'false',
        showSkip:  root.getAttribute('data-show-skip') !== 'false',
        showSpeed: root.getAttribute('data-show-speed') !== 'false'
    };

    /* Accent override: CSS falls back to the theme default when this is unset. */
    if (cfg.accent) { root.style.setProperty('--qap-accent-override', cfg.accent); }

    if (!cfg.showList && el.listBtn) { el.listBtn.hidden = true; }
    if (!cfg.showSkip) {
        if (el.skipB) { el.skipB.hidden = true; }
        if (el.skipF) { el.skipF.hidden = true; }
    }
    if (!cfg.showSpeed && el.speed) { el.speed.hidden = true; }

    /* --------------------------------------------------------------- the audio */
    var audio = new Audio();
    audio.preload = 'metadata';
    // Deliberately NOT setting audio.crossOrigin. Setting it to 'anonymous' makes the
    // browser demand CORS headers on the media response itself, which most podcast hosts
    // do not send — the episode would then fail to load with no visible reason. Nothing
    // here reads raw sample data, so the attribute buys us nothing.

    var state = {
        url: '',
        title: '',
        show: cfg.showName,
        cover: cfg.cover,
        minimized: cfg.minimized,
        wasPlaying: false,
        rate: 1,
        volume: 1
    };
    var times = readJSON(LSK_TIMES, {});
    var lastSave = 0;
    var userPaused = false;      // distinguishes a deliberate pause from a page unload
    var blockedAutoplay = false;

    /* ---------------------------------------------------------------- persist */
    function persist() {
        writeJSON(LSK_STATE, {
            url: state.url,
            title: state.title,
            show: state.show,
            cover: state.cover,
            currentTime: audio.currentTime || 0,
            playbackRate: audio.playbackRate || 1,
            volume: audio.volume,
            isMinimized: state.minimized,
            wasPlaying: !audio.paused && !audio.ended,
            updatedAt: Date.now()
        });
    }

    function rememberPosition(url, seconds) {
        if (!url || !isFinite(seconds) || seconds < 3) { return; }
        if (audio.duration && seconds > audio.duration - NEAR_END) { return; } // finished: forget it
        times[url] = Math.floor(seconds);

        // keep the dictionary small — drop the oldest entries by insertion order
        var keys = Object.keys(times);
        if (keys.length > MAX_TIMES) {
            keys.slice(0, keys.length - MAX_TIMES).forEach(function (k) { delete times[k]; });
        }
        writeJSON(LSK_TIMES, times);
    }

    /* -------------------------------------------------------------------- UI */
    function setPlaying(isPlaying) {
        root.setAttribute('data-playing', isPlaying ? 'true' : 'false');
        root.setAttribute('data-paused', isPlaying ? 'false' : 'true');

        qsa('.qap-ico-play', root).forEach(function (i) { i.hidden = !!isPlaying; });
        qsa('.qap-ico-pause', root).forEach(function (i) { i.hidden = !isPlaying; });

        if (el.tabPlay) {
            el.tabPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        }
        if (el.play) {
            el.play.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        }
        syncInline();
    }

    function setMinimized(min) {
        state.minimized = !!min;
        root.setAttribute('data-minimized', min ? 'true' : 'false');
        if (min === false && el.playlist) {
            // returning to the full dock shouldn't leave a stale drawer open
            el.playlist.classList.remove('is-open');
            if (el.listBtn) { el.listBtn.setAttribute('aria-expanded', 'false'); }
        }
    }

    function paintMeta() {
        if (el.show) { el.show.textContent = state.show || ''; }
        if (el.title) { el.title.textContent = state.title || ''; if (el.title.textContent.trim() === '') { el.title.textContent = 'Tap play to listen'; } }
        if (el.tabLabel) {
            var label = blockedAutoplay ? 'Tap to resume' : (state.title || state.show || 'Now playing');
            el.tabLabel.textContent = label;
        }
        var cover = state.cover || cfg.cover;
        if (el.art) {
            if (cover) {
                el.art.src = cover;
                el.art.style.display = '';
                if (el.artBox) { el.artBox.classList.add('has-art'); }
            } else {
                el.art.removeAttribute('src');
                el.art.style.display = 'none';
                if (el.artBox) { el.artBox.classList.remove('has-art'); }
            }
        }
        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.metadata = new window.MediaMetadata({
                    title: state.title || state.show || '',
                    artist: state.show || '',
                    album: cfg.showName || '',
                    artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []
                });
            } catch (e) { /* MediaMetadata unsupported */ }
        }
        syncInline();
    }

    function paintProgress() {
        var cur = audio.currentTime || 0;
        var dur = audio.duration;
        var pct = (isFinite(dur) && dur > 0) ? (cur / dur) * 100 : 0;
        if (el.fill) { el.fill.style.width = pct + '%'; }
        if (el.thumb) { el.thumb.style.left = pct + '%'; }
        if (el.cur) { el.cur.textContent = fmt(cur); }
        if (el.total) { el.total.textContent = isFinite(dur) ? fmt(dur) : '0:00'; }
        if (el.seek) { el.seek.setAttribute('aria-valuenow', Math.round(pct)); }

        if (isFinite(dur) && dur > 0) {
            var p = (cur / dur) * 100;
            if (el.buf) { el.buf.style.width = Math.max(p, el.buf.dataset.pct ? +el.buf.dataset.pct : 0) + '%'; }
        }
    }

    function syncInline() {
        var playing = !audio.paused && !audio.ended;
        qsa('.qap-inline').forEach(function (node) {
            var url = node.getAttribute('data-url');
            var active = url && state.url && url === state.url;
            node.classList.toggle('is-active', !!active);
            node.setAttribute('data-playing', active && playing ? 'true' : 'false');
            qsa('.qap-ico-play', node).forEach(function (i) { i.hidden = !!(active && playing); });
            qsa('.qap-ico-pause', node).forEach(function (i) { i.hidden = !(active && playing); });
        });
    }

    /* --------------------------------------------------------- load / playback */
    function load(ep, autoplay) {
        if (!ep || !ep.url) { return; }
        var switching = ep.url !== state.url;

        state.url = ep.url;
        state.title = ep.title || '';
        if (ep.show) { state.show = ep.show; }
        if (ep.cover) { state.cover = ep.cover; }

        if (switching) {
            audio.src = ep.url;
            var saved = times[ep.url];
            // per-episode memory: resume where this listener left off
            if (saved && saved > 3) {
                audio.currentTime = saved;
                audio.addEventListener('loadedmetadata', function once() {
                    audio.removeEventListener('loadedmetadata', once);
                    try { audio.currentTime = saved; } catch (e) { /* not seekable yet */ }
                });
            }
        }
        audio.playbackRate = state.rate;
        audio.volume = state.volume;

        paintMeta();
        paintProgress();
        markActiveEpisode();

        if (autoplay) {
            play();
        } else {
            persist();
        }
    }

    function play() {
        userPaused = false;
        var p = audio.play();
        if (p && typeof p.then === 'function') {
            p.then(function () {
                blockedAutoplay = false;
                setPlaying(true);
                persist();
            }).catch(function () {
                // Autoplay policy refused unmuted playback before a user gesture.
                blockedAutoplay = true;
                setPlaying(false);
                paintMeta();
                armGestureResume();
            });
        } else {
            setPlaying(true);
        }
    }

    function pause() {
        userPaused = true;
        audio.pause();
        setPlaying(false);
        persist();
    }

    function toggle() {
        if (audio.paused || audio.ended) { play(); } else { pause(); }
    }

    /* If the browser blocked autoplay, the very next interaction anywhere resumes
       playback — that gesture is what the policy is waiting for. */
    var gestureArmed = false;
    function armGestureResume() {
        if (gestureArmed) { return; }
        gestureArmed = true;
        var resume = function () {
            document.removeEventListener('click', resume, true);
            document.removeEventListener('keydown', resume, true);
            document.removeEventListener('touchstart', resume, true);
            gestureArmed = false;
            if (blockedAutoplay) {
                blockedAutoplay = false;
                play();
            }
        };
        document.addEventListener('click', resume, true);
        document.addEventListener('keydown', resume, true);
        document.addEventListener('touchstart', resume, true);
    }

    /* ------------------------------------------------------------ seek control */
    function seekToFraction(frac) {
        if (!isFinite(audio.duration) || audio.duration <= 0) { return; }
        audio.currentTime = clamp(frac, 0, 1) * audio.duration;
        paintProgress();
    }
    function fracFromEvent(ev, node) {
        var r = node.getBoundingClientRect();
        var x = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX) - r.left;
        return clamp(x / r.width, 0, 1);
    }

    if (el.seek) {
        var dragging = false;
        var onDown = function (ev) {
            dragging = true;
            seekToFraction(fracFromEvent(ev, el.seek));
            ev.preventDefault();
        };
        el.seek.addEventListener('mousedown', onDown);
        el.seek.addEventListener('touchstart', onDown, { passive: false });
        document.addEventListener('mousemove', function (ev) {
            if (dragging) { seekToFraction(fracFromEvent(ev, el.seek)); }
        });
        document.addEventListener('touchmove', function (ev) {
            if (dragging) { seekToFraction(fracFromEvent(ev, el.seek)); }
        }, { passive: true });
        document.addEventListener('mouseup', function () { if (dragging) { dragging = false; persist(); } });
        document.addEventListener('touchend', function () { if (dragging) { dragging = false; persist(); } });

        // keyboard access on the track
        el.seek.addEventListener('keydown', function (ev) {
            var step = 5;
            if (ev.key === 'ArrowRight') { audio.currentTime = clamp((audio.currentTime || 0) + step, 0, audio.duration || 0); ev.preventDefault(); }
            if (ev.key === 'ArrowLeft') { audio.currentTime = clamp((audio.currentTime || 0) - step, 0, audio.duration || 0); ev.preventDefault(); }
            paintProgress();
        });
    }

    /* ------------------------------------------------------------- audio events */
    audio.addEventListener('timeupdate', function () {
        paintProgress();
        var now = Date.now();
        if (now - lastSave > SAVE_EVERY) {
            lastSave = now;
            if (state.url) { rememberPosition(state.url, audio.currentTime); }
            persist();
        }
    });
    audio.addEventListener('loadedmetadata', function () { paintProgress(); });
    audio.addEventListener('durationchange', function () { paintProgress(); });
    audio.addEventListener('progress', function () {
        try {
            if (audio.buffered.length && audio.duration) {
                var end = audio.buffered.end(audio.buffered.length - 1);
                var pct = (end / audio.duration) * 100;
                if (el.buf) { el.buf.dataset.pct = pct; el.buf.style.width = pct + '%'; }
            }
        } catch (e) { /* buffered range not readable yet */ }
    });
    audio.addEventListener('play', function () { root.classList.remove('is-loading'); setPlaying(true); });
    audio.addEventListener('pause', function () { setPlaying(false); });
    audio.addEventListener('waiting', function () { root.classList.add('is-loading'); });
    audio.addEventListener('playing', function () { root.classList.remove('is-loading'); setPlaying(true); });
    audio.addEventListener('error', function () {
        root.classList.remove('is-loading');
        setPlaying(false);
    });
    audio.addEventListener('ended', function () {
        setPlaying(false);
        if (state.url) { delete times[state.url]; writeJSON(LSK_TIMES, times); }
        persist();
    });

    /* --------------------------------------------------------------- controls */
    if (el.play) { el.play.addEventListener('click', toggle); }
    if (el.tabPlay) { el.tabPlay.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(); }); }
    if (el.tabRestore) { el.tabRestore.addEventListener('click', function (ev) { ev.stopPropagation(); setMinimized(false); persist(); }); }
    if (el.minBtn) { el.minBtn.addEventListener('click', function () { setMinimized(true); persist(); }); }
    if (el.skipB) {
        el.skipB.addEventListener('click', function () {
            audio.currentTime = clamp((audio.currentTime || 0) - 15, 0, audio.duration || 0);
            paintProgress();
        });
    }
    if (el.skipF) {
        el.skipF.addEventListener('click', function () {
            audio.currentTime = clamp((audio.currentTime || 0) + 30, 0, audio.duration || 0);
            paintProgress();
        });
    }

    var RATES = [1, 1.25, 1.5, 1.75, 2, 0.75];
    if (el.speed) {
        el.speed.addEventListener('click', function () {
            var i = RATES.indexOf(state.rate);
            state.rate = RATES[(i + 1) % RATES.length];
            audio.playbackRate = state.rate;
            el.speed.textContent = (state.rate === 1 ? '1' : String(state.rate)) + '\u00d7';
            persist();
        });
    }

    if (el.volBtn) {
        el.volBtn.addEventListener('click', function () {
            audio.muted = !audio.muted;
            el.volBtn.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
            persist();
        });
    }
    if (el.volSlider) {
        el.volSlider.addEventListener('input', function () {
            state.volume = clamp(parseFloat(el.volSlider.value) || 0, 0, 1);
            audio.volume = state.volume;
            audio.muted = state.volume === 0;
            persist();
        });
    }

    if (el.listBtn && el.playlist) {
        el.listBtn.addEventListener('click', function () {
            var open = el.playlist.classList.toggle('is-open');
            el.listBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    /* --------------------------------------------- playlist (RSS, client-side) */
    var episodes = [];

    function showListMessage(msg) {
        if (!el.listMsg) { return; }
        el.listMsg.textContent = msg;
        el.listMsg.hidden = !msg;
    }

    function parseFeed(xmlText) {
        var doc = new window.DOMParser().parseFromString(xmlText, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length) { throw new Error('xml'); }

        var nodes = qsa('item', doc);
        if (!nodes.length) { nodes = qsa('entry', doc); }

        return nodes.slice(0, RSS_LIMIT).map(function (node) {
            var title = text(node, 'title');
            var url = '';

            // RSS: <enclosure url="..." type="audio/mpeg">
            var enc = qs('enclosure', node);
            if (enc && enc.getAttribute('url')) { url = enc.getAttribute('url'); }
            // some feeds use media:content
            if (!url) {
                var mc = qs('content', node);
                if (mc && mc.getAttribute('url')) { url = mc.getAttribute('url'); }
            }
            // Atom: <link rel="enclosure" href="...">
            if (!url) {
                var links = qsa('link', node);
                for (var i = 0; i < links.length; i++) {
                    if (links[i].getAttribute('rel') === 'enclosure' && links[i].getAttribute('href')) {
                        url = links[i].getAttribute('href');
                        break;
                    }
                }
            }

            var dateStr = text(node, 'pubDate') || text(node, 'published') || text(node, 'updated');
            var dur = text(node, 'itunes:duration') || text(node, 'duration');
            var art = '';
            var itunesImg = qs('image', node);
            if (itunesImg && itunesImg.getAttribute('href')) { art = itunesImg.getAttribute('href'); }

            return { title: title, url: url, date: dateStr, duration: dur, cover: art };
        }).filter(function (e) { return !!e.url; });
    }

    function text(node, tag) {
        var n = node.getElementsByTagName(tag)[0];
        if (!n && tag.indexOf(':') > -1) {
            // some parsers drop the prefix; try the local name
            n = node.getElementsByTagName(tag.split(':')[1])[0];
        }
        return n && n.textContent ? n.textContent.trim() : '';
    }

    function fmtDuration(dur) {
        if (!dur) { return ''; }
        if (/^\d+$/.test(dur)) { return fmt(parseInt(dur, 10)); }   // seconds
        return dur.replace(/^0+(\d)/, '$1');                        // already mm:ss / hh:mm:ss
    }

    function fmtDate(str) {
        if (!str) { return ''; }
        var d = new Date(str);
        if (isNaN(d.getTime())) { return ''; }
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }

    function renderPlaylist() {
        if (!el.list) { return; }
        el.list.innerHTML = '';
        episodes.forEach(function (ep) {
            var li = document.createElement('li');
            li.className = 'qap-episode';
            li.setAttribute('data-url', ep.url);
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'button');

            var t = document.createElement('span');
            t.className = 'qap-episode-title';
            t.textContent = ep.title || 'Episode';

            var x = document.createElement('span');
            x.className = 'qap-episode-extra';
            var bits = [fmtDate(ep.date), fmtDuration(ep.duration)].filter(Boolean);
            x.textContent = bits.join(' \u00b7 ');

            li.appendChild(t);
            li.appendChild(x);

            var choose = function () { load(ep, true); };
            li.addEventListener('click', choose);
            li.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); }
            });
            el.list.appendChild(li);
        });
        markActiveEpisode();
    }

    function markActiveEpisode() {
        qsa('.qap-episode', root).forEach(function (li) {
            li.classList.toggle('is-active', li.getAttribute('data-url') === state.url);
        });
    }

    function fetchFeed() {
        if (!cfg.rss) { return; }

        var attempt = 0;
        showListMessage('Loading episodes\u2026');
        if (el.listBtn) { el.listBtn.disabled = true; }

        function next() {
            if (attempt >= PROXIES.length) {
                showListMessage('Episodes could not be loaded from the feed.');
                if (el.listBtn) { el.listBtn.disabled = true; }
                return;
            }
            var target = PROXIES[attempt++](cfg.rss);
            var opts = { credentials: 'omit' };
            var timeout = setTimeout(function () { next(); }, 12000);

            window.fetch(target, opts).then(function (r) {
                if (!r.ok) { throw new Error('http ' + r.status); }
                return r.text();
            }).then(function (body) {
                clearTimeout(timeout);
                var parsed = parseFeed(body);
                if (!parsed.length) { throw new Error('no episodes'); }

                episodes = parsed;
                renderPlaylist();
                showListMessage('');
                if (el.listBtn) { el.listBtn.disabled = false; }

                // If nothing was configured except the feed, adopt the newest episode.
                if (!cfg.defaultUrl && !state.url && episodes.length) {
                    state.cover = state.cover || episodes[0].cover || cfg.cover;
                    load(episodes[0], false);
                }
                root.setAttribute('data-hidden', 'false');
            }).catch(function () {
                clearTimeout(timeout);
                next();
            });
        }
        next();
    }

    /* --------------------------------------------- per-post inline episode player */
    function buildInline(ep, mountPoint) {
        var wrap = document.createElement('div');
        wrap.className = 'qap-inline';
        wrap.setAttribute('data-player-theme', root.getAttribute('data-player-theme') || 'obsidian-gold');
        wrap.setAttribute('data-url', ep.url);
        wrap.setAttribute('data-playing', 'false');
        if (cfg.accent) { wrap.style.setProperty('--qap-accent-override', cfg.accent); }

        var cover = ep.cover || cfg.cover;
        wrap.innerHTML =
            '<div class="qap-art">' + (cover ? '<img class="qap-art-img" src="' + cover.replace(/"/g, '&quot;') + '" alt="" width="48" height="48">' : '') + '</div>' +
            '<div class="qap-meta"><span class="qap-show"></span><span class="qap-title"></span></div>' +
            '<div class="qap-seek"><div class="qap-seek-track" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
                '<div class="qap-seek-buffer"></div><div class="qap-seek-fill"></div><div class="qap-seek-thumb"></div>' +
            '</div><div class="qap-times"><span class="qap-time-current">0:00</span><span class="qap-time-total">0:00</span></div></div>' +
            '<div class="qap-controls">' +
                '<button class="qap-btn qap-inline-play" type="button" aria-label="Play">' +
                    '<svg class="qap-ico-play" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>' +
                    '<svg class="qap-ico-pause" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" hidden><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>' +
                '</button>' +
            '</div>';

        qs('.qap-show', wrap).textContent = ep.show || cfg.showName || '';
        qs('.qap-title', wrap).textContent = ep.title || '';

        // Everything plays through the one global player, so two streams can never
        // run at once: this button routes to the sticky player rather than playing here.
        qs('.qap-inline-play', wrap).addEventListener('click', function () {
            if (state.url === ep.url && !audio.paused) {
                pause();
            } else {
                if (state.url !== ep.url) { load(ep, false); }
                play();
            }
        });

        // mirror the global player's progress into this inline instance
        inlineInstances.push({ node: wrap, url: ep.url, ep: ep });

        if (mountPoint) {
            mountPoint.appendChild(wrap);
            mountPoint.hidden = false;
        }
        return wrap;
    }

    var inlineInstances = [];

    function paintInlineProgress() {
        inlineInstances.forEach(function (inst) {
            if (inst.url !== state.url) { return; }
            var dur = audio.duration;
            var cur = audio.currentTime || 0;
            var pct = (isFinite(dur) && dur > 0) ? (cur / dur) * 100 : 0;
            var f = qs('.qap-seek-fill', inst.node);
            var th = qs('.qap-seek-thumb', inst.node);
            var c = qs('.qap-time-current', inst.node);
            var t = qs('.qap-time-total', inst.node);
            if (f) { f.style.width = pct + '%'; }
            if (th) { th.style.left = pct + '%'; }
            if (c) { c.textContent = fmt(cur); }
            if (t) { t.textContent = isFinite(dur) ? fmt(dur) : '0:00'; }
        });
    }

    function setupInline() {
        var content = qs('.gh-content') || document.body;

        // Method 1 — hijack a native Ghost audio card (or a bare <audio>) in the post body.
        var cards = qsa('.kg-audio-card', content);
        // Also pick up bare <audio> tags Ghost did not wrap in a card. Anything already
        // inside a card (or inside a player we built) is skipped so it is never handled twice.
        qsa('audio', content).forEach(function (a) {
            if (a.closest && (a.closest('.qap-inline') || a.closest('.kg-audio-card'))) { return; }
            cards.push(a);
        });

        cards.forEach(function (card) {
            if (card.closest && card.closest('.qap-inline')) { return; }
            var src = '';
            var title = '';
            var cover = '';

            if (card.tagName === 'AUDIO') {
                src = card.getAttribute('src') || '';
            } else {
                var a = qs('audio', card);
                if (a) { src = a.getAttribute('src') || ''; }
                if (!src) {
                    var s = qs('source', card);
                    if (s) { src = s.getAttribute('src') || ''; }
                }
                var t = qs('.kg-audio-title', card);
                if (t) { title = t.textContent.trim(); }
                var thumb = qs('.kg-audio-thumbnail img', card);
                if (thumb) { cover = thumb.getAttribute('src') || ''; }
            }
            if (!src) { return; }

            var holder = document.createElement('div');
            holder.className = 'qap-inline-holder';
            card.parentNode.insertBefore(holder, card);
            card.setAttribute('hidden', 'hidden');       // hide the stock Ghost UI
            card.style.display = 'none';

            buildInline({ url: src, title: title, cover: cover }, holder);
        });

        // Method 2 — author override via Ghost Post Code Injection:
        //   <script>window.EPISODE_AUDIO = {audioUrl: '...', title: '...',
        //     spotifyUrl: '...', appleUrl: '...', youtubeUrl: '...'};</script>
        var override = window.EPISODE_AUDIO;
        if (override && (override.audioUrl || override.audio_url)) {
            var mount = qs('[data-qap-inline]');
            var built = buildInline({
                url: override.audioUrl || override.audio_url,
                title: override.title || '',
                cover: override.cover || override.imageUrl || ''
            }, mount);

            // per-post platform links override the global badges for this page
            applyPostLinks(built, override);

            // sit the inline player directly beneath the article header
            if (mount && built) {
                var header = qs('.gh-article-header');
                if (header && header.parentNode) {
                    header.parentNode.insertBefore(built, header.nextSibling);
                }
            }
        }
    }

    function applyPostLinks(node, override) {
        var map = [
            ['spotifyUrl', 'qap-listen-spotify'],
            ['appleUrl', 'qap-listen-apple'],
            ['youtubeUrl', 'qap-listen-youtube']
        ];
        var bar = qs('.qap-listen', root);
        map.forEach(function (pair) {
            var url = override[pair[0]];
            if (!url || !bar) { return; }
            var a = bar[pair[1]] || qs('.' + pair[1], bar);
            if (a) { a.setAttribute('href', url); }
        });

        // make sure the inline player is visible and the sticky one isn't hidden
        root.setAttribute('data-hidden', 'false');
        if (node) { node.hidden = false; }
    }

    audio.addEventListener('timeupdate', paintInlineProgress);
    audio.addEventListener('seeked', paintInlineProgress);
    audio.addEventListener('loadedmetadata', paintInlineProgress);

    /* ------------------------------------------------------------ bring-it-back */
    function hydrate() {
        var saved = readJSON(LSK_STATE, null);

        // volume + rate always come back, even on a first visit
        if (saved) {
            state.rate = saved.playbackRate || 1;
            state.volume = (typeof saved.volume === 'number') ? saved.volume : 1;
        }
        audio.playbackRate = state.rate;
        audio.volume = state.volume;
        if (el.volSlider) { el.volSlider.value = String(state.volume); }
        if (el.speed) { el.speed.textContent = (state.rate === 1 ? '1' : String(state.rate)) + '\u00d7'; }

        setMinimized(saved ? !!saved.isMinimized : cfg.minimized);

        if (saved && saved.url) {
            // restore the exact track and position from before the page reload
            state.show = saved.show || cfg.showName;
            state.cover = saved.cover || cfg.cover;
            load({ url: saved.url, title: saved.title, show: state.show, cover: state.cover }, false);

            var resumeAt = saved.currentTime || 0;
            if (!times[saved.url] && resumeAt > 3) { times[saved.url] = resumeAt; }

            var applySeek = function () {
                try { audio.currentTime = resumeAt; } catch (e) { /* not seekable yet */ }
                paintProgress();
            };
            if (audio.readyState >= 1) { applySeek(); }
            else { audio.addEventListener('loadedmetadata', applySeek, { once: true }); }

            // Ghost reloads the page on navigation, so an episode that was playing
            // should pick straight back up. Autoplay policy may refuse this until a
            // gesture happens — armGestureResume covers that case.
            if (saved.wasPlaying) { play(); }
        } else if (cfg.defaultUrl) {
            load({ url: cfg.defaultUrl, title: '', show: cfg.showName, cover: cfg.cover }, false);
        }

        paintMeta();
        paintProgress();
        setPlaying(!audio.paused && !audio.ended);
    }

    /* Flush position on the way out. pagehide/beforeunload cover both a normal
       navigation and a bfcache restore. */
    function flush() {
        if (state.url) { rememberPosition(state.url, audio.currentTime); }
        persist();
    }
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { flush(); }
    });

    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.setActionHandler('play', play);
            navigator.mediaSession.setActionHandler('pause', pause);
            navigator.mediaSession.setActionHandler('seekbackward', function () {
                audio.currentTime = clamp((audio.currentTime || 0) - 15, 0, audio.duration || 0);
            });
            navigator.mediaSession.setActionHandler('seekforward', function () {
                audio.currentTime = clamp((audio.currentTime || 0) + 30, 0, audio.duration || 0);
            });
        } catch (e) { /* unsupported action */ }
    }

    /* -------------------------------------------------------------------- boot */
    function boot() {
        var hadConfig = !!(cfg.defaultUrl || cfg.rss);
        setupInline();
        var hasInline = inlineInstances.length > 0;

        if (!hadConfig && !hasInline) {
            root.setAttribute('data-hidden', 'true');
            return;
        }

        root.setAttribute('data-hidden', 'false');
        hydrate();

        if (cfg.rss) { fetchFeed(); }

        // inline player only (no global source configured): load the first one
        if (!hadConfig && hasInline && !state.url) {
            var first = inlineInstances[0];
            state.cover = first.ep.cover || cfg.cover;
            load(first.ep, false);
        }

        setPlaying(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
