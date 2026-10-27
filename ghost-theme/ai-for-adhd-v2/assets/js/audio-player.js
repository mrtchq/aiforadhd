/**
 * HTML5 Audio Player for Ghost CMS
 * Inspired by bPlugins HTML5 Audio Player
 * Features:
 * - 4 Skins: Fusion, Default, Wave, Stamp
 * - Placement: Sticky bottom bar, Inline post player, or Both
 * - Configuration via Ghost Admin Design Settings
 * - State persistence across pages via localStorage
 * - Podcast RSS feed integration & playlist drawer
 * - Native Ghost .kg-audio-card enhancement/replacement
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'h5ap_state_v1';
  const TIMES_KEY = 'h5ap_times_v1';

  const qs = (selector, context = document) => context.querySelector(selector);
  const qsa = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  const loadJSON = (key, fallback) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  };

  const saveJSON = (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  };

  const formatTime = (seconds) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const mins = Math.floor(s / 60);
    const secs = String(s % 60).padStart(2, '0');
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = String(mins % 60).padStart(2, '0');
      return `${hrs}:${remMins}:${secs}`;
    }
    return `${mins}:${secs}`;
  };

  const escapeHTML = (str) =>
    String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  document.addEventListener('DOMContentLoaded', () => {
    const root = qs('#h5ap-player-root');
    if (!root) return;

    const config = {
      skin: (root.dataset.skin || 'Fusion').toLowerCase(),
      position: root.dataset.position || 'Both sticky and inline',
      primaryColor: root.dataset.primaryColor || '',
      bgColor: root.dataset.bgColor || '',
      textColor: root.dataset.textColor || '',
      defaultAudio: root.dataset.defaultAudio || '',
      podcastRss: root.dataset.podcastRss || '',
      showDownload: root.dataset.showDownload !== 'false',
      seekTime: Number(root.dataset.seekTime) || 15,
      startMinimized: root.dataset.startMinimized === 'true',
      spotify: root.dataset.spotify || '',
      apple: root.dataset.apple || '',
      youtube: root.dataset.youtube || '',
      siteTitle: root.dataset.siteTitle || 'Podcast',
      siteLogo: root.dataset.siteLogo || '',
    };

    if (config.position === 'Disabled') {
      root.remove();
      return;
    }

    // Apply custom colors dynamically to root if present
    if (config.primaryColor) root.style.setProperty('--h5ap-primary', config.primaryColor);
    if (config.bgColor) root.style.setProperty('--h5ap-bg', config.bgColor);
    if (config.textColor) root.style.setProperty('--h5ap-text', config.textColor);

    // Core audio instance
    const audio = qs('.h5ap-audio', root) || new Audio();
    const savedState = loadJSON(STORAGE_KEY, {});
    const trackTimes = loadJSON(TIMES_KEY, {});

    let playlistQueue = [];
    let currentTrack = {
      url: '',
      title: '',
      artist: config.siteTitle,
      poster: config.siteLogo,
    };
    let isSeeking = false;
    let saveTimeout = null;

    // Elements in root player
    const playBtns = qsa('.h5ap-btn-play, .h5ap-mini-play', root);
    const rewindBtn = qs('.h5ap-btn-rewind', root);
    const forwardBtn = qs('.h5ap-btn-forward', root);
    const seekSlider = qs('.h5ap-seek-slider', root);
    const progressContainer = qs('.h5ap-progress-container', root);
    const playedBar = qs('.h5ap-progress-played', root);
    const bufferedBar = qs('.h5ap-progress-buffered', root);
    const seekTooltip = qs('.h5ap-seek-tooltip', root);
    const currentTimeEl = qs('.h5ap-time-current', root);
    const durationTimeEl = qs('.h5ap-time-duration', root);
    const trackTitleEl = qs('.h5ap-track-title', root);
    const miniTitleEl = qs('.h5ap-mini-title', root);
    const trackArtistEl = qs('.h5ap-track-artist', root);
    const posterImg = qs('.h5ap-poster-img', root);
    const speedBtn = qs('.h5ap-btn-speed', root);
    const speedText = qs('.h5ap-speed-text', root);
    const repeatBtn = qs('.h5ap-btn-repeat', root);
    const downloadBtn = qs('.h5ap-btn-download', root);
    const playlistBtn = qs('.h5ap-btn-playlist', root);
    const playlistDrawer = qs('.h5ap-playlist-drawer', root);
    const playlistCount = qs('.h5ap-playlist-count', root);
    const playlistItemsEl = qs('.h5ap-playlist-items', root);
    const volumeBtn = qs('.h5ap-btn-volume', root);
    const volumeSlider = qs('.h5ap-volume-slider', root);
    const minimizeBtn = qs('.h5ap-btn-minimize', root);
    const restoreBtn = qs('.h5ap-mini-restore', root);

    // Save state to localStorage
    const persistState = () => {
      if (!currentTrack.url) return;
      const state = {
        url: currentTrack.url,
        title: currentTrack.title,
        artist: currentTrack.artist,
        poster: currentTrack.poster,
        currentTime: audio.currentTime || 0,
        playbackRate: audio.playbackRate || 1,
        volume: audio.volume,
        muted: audio.muted,
        isMinimized: root.classList.contains('is-minimized'),
        wasPlaying: !audio.paused,
      };
      saveJSON(STORAGE_KEY, state);

      trackTimes[currentTrack.url] = audio.currentTime || 0;
      saveJSON(TIMES_KEY, trackTimes);
    };

    const debouncedPersist = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(persistState, 800);
    };

    // Update UI components
    const updateUI = () => {
      const isPlaying = !audio.paused;
      root.classList.toggle('is-playing', isPlaying);

      // Play button tooltips and labels
      playBtns.forEach((btn) => {
        btn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        btn.setAttribute('title', isPlaying ? 'Pause' : 'Play');
      });

      // Inline players sync
      qsa('.h5ap-inline-player').forEach((inline) => {
        inline.classList.toggle('is-playing', isPlaying);
        const b = qs('.h5ap-btn-play', inline);
        if (b) {
          b.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
          b.setAttribute('title', isPlaying ? 'Pause' : 'Play');
        }
      });

      // Times & Progress
      const cur = audio.currentTime || 0;
      const dur = audio.duration || 0;

      if (currentTimeEl) currentTimeEl.textContent = formatTime(cur);
      if (durationTimeEl) durationTimeEl.textContent = dur ? formatTime(dur) : '0:00';

      if (!isSeeking && dur > 0) {
        const percent = Math.min(100, Math.max(0, (cur / dur) * 100));
        if (seekSlider) seekSlider.value = Math.round((cur / dur) * 1000);
        if (playedBar) playedBar.style.width = `${percent}%`;

        qsa('.h5ap-inline-player .h5ap-progress-played').forEach((p) => {
          p.style.width = `${percent}%`;
        });
        qsa('.h5ap-inline-player .h5ap-seek-slider').forEach((s) => {
          s.value = Math.round((cur / dur) * 1000);
        });
        qsa('.h5ap-inline-player .h5ap-time-current').forEach((c) => {
          c.textContent = formatTime(cur);
        });
      }

      // Buffer
      if (audio.buffered.length > 0 && dur > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const bufPercent = Math.min(100, Math.max(0, (bufferedEnd / dur) * 100));
        if (bufferedBar) bufferedBar.style.width = `${bufPercent}%`;
        qsa('.h5ap-inline-player .h5ap-progress-buffered').forEach((b) => {
          b.style.width = `${bufPercent}%`;
        });
      }

      // Volume & Mute state
      root.classList.toggle('is-muted', audio.muted || audio.volume === 0);
    };

    // Load track and prepare playback
    const setTrack = (meta, shouldPlay = false) => {
      if (!meta || !meta.url) return;

      persistState();
      currentTrack = {
        url: meta.url,
        title: meta.title || 'Podcast Episode',
        artist: meta.artist || config.siteTitle,
        poster: meta.poster || config.siteLogo,
      };

      audio.src = currentTrack.url;
      if (trackTitleEl) trackTitleEl.textContent = currentTrack.title;
      if (miniTitleEl) miniTitleEl.textContent = currentTrack.title;
      if (trackArtistEl) trackArtistEl.textContent = currentTrack.artist;

      if (posterImg) {
        if (currentTrack.poster) {
          posterImg.src = currentTrack.poster;
          posterImg.style.display = 'block';
        } else {
          posterImg.style.display = 'none';
        }
      }

      // Restore saved playback position for this specific track
      const savedTime = Number(trackTimes[currentTrack.url] || 0);
      if (savedTime > 0) {
        audio.currentTime = savedTime;
      }

      // Update download link
      if (downloadBtn) {
        downloadBtn.href = currentTrack.url;
        downloadBtn.setAttribute('download', `${currentTrack.title}.mp3`);
      }

      // Update active highlight in playlist
      qsa('.h5ap-playlist-item-btn', root).forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.url === currentTrack.url);
      });

      // Update inline players
      qsa('.h5ap-inline-player').forEach((inline) => {
        const title = qs('.h5ap-track-title', inline);
        if (title) title.textContent = currentTrack.title;
        const art = qs('.h5ap-track-artist', inline);
        if (art) art.textContent = currentTrack.artist;
        const img = qs('.h5ap-poster-img', inline);
        if (img && currentTrack.poster) img.src = currentTrack.poster;
      });

      updateUI();
      persistState();

      if (shouldPlay) {
        audio.play().catch(() => {
          // Autoplay policy prevented playback, ready for user interaction
        });
      }
    };

    // Play / Pause toggle
    const togglePlay = () => {
      if (!audio.src || audio.src === window.location.href) {
        if (config.defaultAudio) {
          setTrack({ url: config.defaultAudio, title: 'Featured Episode' }, true);
          return;
        }
        if (playlistQueue.length > 0) {
          setTrack(playlistQueue[0], true);
          return;
        }
      }

      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    };

    // Event listeners for transport
    playBtns.forEach((btn) => btn.addEventListener('click', togglePlay));

    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        audio.currentTime = Math.max(0, audio.currentTime - config.seekTime);
        updateUI();
        debouncedPersist();
      });
    }

    if (forwardBtn) {
      forwardBtn.addEventListener('click', () => {
        audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + config.seekTime);
        updateUI();
        debouncedPersist();
      });
    }

    // Seek handling
    const setupSeek = (slider, container, tooltip) => {
      if (!slider) return;

      const handleSeekInput = (val) => {
        if (audio.duration) {
          const seekTo = (Number(val) / 1000) * audio.duration;
          audio.currentTime = seekTo;
          updateUI();
        }
      };

      slider.addEventListener('input', (e) => {
        isSeeking = true;
        handleSeekInput(e.target.value);
      });

      slider.addEventListener('change', (e) => {
        handleSeekInput(e.target.value);
        isSeeking = false;
        debouncedPersist();
      });

      if (container && tooltip) {
        container.addEventListener('mousemove', (e) => {
          const rect = container.getBoundingClientRect();
          const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          if (audio.duration) {
            tooltip.textContent = formatTime(pos * audio.duration);
            tooltip.style.left = `${pos * 100}%`;
          }
        });
      }
    };

    setupSeek(seekSlider, progressContainer, seekTooltip);

    // Playback Speed Cycling (1x -> 1.25x -> 1.5x -> 2x -> 1x)
    const speeds = [1, 1.25, 1.5, 2];
    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        const curIdx = speeds.indexOf(audio.playbackRate);
        const nextSpeed = speeds[(curIdx + 1) % speeds.length];
        audio.playbackRate = nextSpeed;
        if (speedText) speedText.textContent = `${nextSpeed}×`;
        debouncedPersist();
      });
    }

    // Repeat / Loop Toggle
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => {
        audio.loop = !audio.loop;
        repeatBtn.dataset.active = String(audio.loop);
      });
    }

    // Volume & Mute Handling
    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => {
        audio.muted = !audio.muted;
        updateUI();
        debouncedPersist();
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        audio.volume = Number(e.target.value);
        audio.muted = audio.volume === 0;
        updateUI();
        debouncedPersist();
      });
    }

    // Minimize & Restore Floating Bar
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        root.classList.add('is-minimized');
        persistState();
      });
    }

    if (restoreBtn) {
      restoreBtn.addEventListener('click', () => {
        root.classList.remove('is-minimized');
        persistState();
      });
    }
    // Minimized side-tab: pressing the tab restores the full player.
    // Clicks on the play button keep controlling playback instead.
    const miniBar = qs('.h5ap-mini', root);
    if (miniBar) {
      miniBar.addEventListener('click', (e) => {
        if (e.target.closest('.h5ap-mini-play, .h5ap-mini-restore')) return;
        root.classList.remove('is-minimized');
        persistState();
      });
    }


    // Playlist Drawer Toggle
    if (playlistBtn && playlistDrawer) {
      playlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !playlistDrawer.hidden;
        playlistDrawer.hidden = isOpen;
        playlistBtn.setAttribute('aria-expanded', String(!isOpen));
      });

      document.addEventListener('click', (e) => {
        if (!playlistDrawer.hidden && !playlistDrawer.contains(e.target) && e.target !== playlistBtn) {
          playlistDrawer.hidden = true;
          playlistBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Render playlist items
    const renderPlaylist = (items) => {
      if (!playlistItemsEl) return;
      playlistItemsEl.replaceChildren();

      items.forEach((item) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `h5ap-playlist-item-btn${item.url === currentTrack.url ? ' is-active' : ''}`;
        btn.dataset.url = item.url;
        btn.innerHTML = `
          <div class="h5ap-item-title">${escapeHTML(item.title)}</div>
          <div class="h5ap-item-meta">${escapeHTML(item.duration || item.date || '')}</div>
        `;

        btn.addEventListener('click', () => {
          setTrack(item, true);
          if (playlistDrawer) playlistDrawer.hidden = true;
          if (playlistBtn) playlistBtn.setAttribute('aria-expanded', 'false');
        });

        li.appendChild(btn);
        playlistItemsEl.appendChild(li);
      });

      if (playlistCount && items.length > 0) {
        playlistCount.textContent = items.length;
        playlistCount.hidden = false;
      }
    };

    // Podcast RSS Feed Fetcher
    const fetchRSSFeed = async (feedUrl) => {
      if (!feedUrl) return;

      const parseXML = (xmlText) => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');
        if (xml.querySelector('parsererror')) throw new Error('XML parse error');

        const items = qsa('item', xml).map((item) => {
          const enc = qs('enclosure', item);
          const title = qs('title', item)?.textContent?.trim() || 'Episode';
          const pubDate = qs('pubDate', item)?.textContent || '';
          const dateStr = pubDate ? new Date(pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
          const itunesDuration = item.getElementsByTagNameNS('*', 'duration')[0]?.textContent || '';

          return {
            title,
            url: enc?.getAttribute('url') || '',
            date: dateStr,
            duration: itunesDuration,
            artist: config.siteTitle,
            poster: config.siteLogo,
          };
        }).filter((x) => x.url);

        return items;
      };

      try {
        let res;
        try {
          res = await fetch(feedUrl, { mode: 'cors' });
        } catch {
          // Fallback through open CORS proxy if direct fetch is blocked
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
          res = await fetch(proxyUrl);
        }

        if (!res.ok) throw new Error('Feed network error');
        const text = await res.text();
        playlistQueue = parseXML(text);

        if (playlistQueue.length > 0) {
          renderPlaylist(playlistQueue);

          // If no active track set yet, load the latest episode from RSS
          if (!currentTrack.url && !savedState.url) {
            setTrack(playlistQueue[0], false);
          }
        }
      } catch (err) {
        console.warn('[H5AP] Podcast RSS unavailable:', err.message);
      }
    };

    // Inline Post Player Setup (Mounts player in post article when post has audio)
    const setupInlinePlayer = (container, postMeta) => {
      if (!container || !postMeta || !postMeta.url) return;

      const inline = root.cloneNode(true);
      inline.removeAttribute('id');
      inline.classList.add('h5ap-inline-player');
      inline.classList.remove('is-minimized');

      // Wire controls for inline player
      const playBtn = qs('.h5ap-btn-play', inline);
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (currentTrack.url === postMeta.url) {
            togglePlay();
          } else {
            setTrack(postMeta, true);
          }
        });
      }

      const inRewind = qs('.h5ap-btn-rewind', inline);
      if (inRewind) {
        inRewind.addEventListener('click', () => {
          audio.currentTime = Math.max(0, audio.currentTime - config.seekTime);
          updateUI();
        });
      }

      const inForward = qs('.h5ap-btn-forward', inline);
      if (inForward) {
        inForward.addEventListener('click', () => {
          audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + config.seekTime);
          updateUI();
        });
      }

      const inSlider = qs('.h5ap-seek-slider', inline);
      const inContainer = qs('.h5ap-progress-container', inline);
      const inTooltip = qs('.h5ap-seek-tooltip', inline);
      setupSeek(inSlider, inContainer, inTooltip);

      // Remove mini and minimize button from inline player
      qs('.h5ap-mini', inline)?.remove();
      qs('.h5ap-btn-minimize', inline)?.remove();
      qs('.h5ap-playlist-drawer', inline)?.remove();
      qs('.h5ap-btn-playlist', inline)?.remove();

      container.replaceChildren(inline);
    };

    // Ghost Native Audio Card Scan & Inline Integration
    let detectedPostAudio = null;
    const nativeAudioCards = qsa('.gh-content .kg-audio-card, .gh-content audio');

    if (nativeAudioCards.length > 0) {
      const card = nativeAudioCards[0];
      const audioElement = card.matches('audio') ? card : qs('audio', card);
      const audioSrc = audioElement?.currentSrc || audioElement?.src || qs('source', audioElement)?.src;

      if (audioSrc && /\.(mp3|wav|ogg|m4a|aac)(?:\?|$)/i.test(audioSrc)) {
        // Hide native clumsy card
        if (!card.matches('audio')) card.classList.add('h5ap-hidden');
        else card.style.display = 'none';

        const inlineSlot = qs('[data-post-audio-player]');
        const postTitle = inlineSlot?.dataset.postTitle || qs('.gh-article-title')?.textContent?.trim() || 'Episode';
        const postImage = inlineSlot?.dataset.postImage || qs('.gh-feature-image')?.src || config.siteLogo;
        const postArtist = inlineSlot?.dataset.postArtist || config.siteTitle;

        detectedPostAudio = {
          url: audioSrc,
          title: postTitle,
          artist: postArtist,
          poster: postImage,
        };

        if (inlineSlot && (config.position === 'Inline in posts' || config.position === 'Both sticky and inline')) {
          setupInlinePlayer(inlineSlot, detectedPostAudio);
        }
      }
    }

    // Audio element core event handlers
    audio.addEventListener('timeupdate', () => {
      updateUI();
      debouncedPersist();
    });

    audio.addEventListener('play', () => {
      updateUI();
      debouncedPersist();
    });

    audio.addEventListener('pause', () => {
      updateUI();
      debouncedPersist();
    });

    audio.addEventListener('ended', () => {
      updateUI();
      // Auto-advance through playlist queue if available
      const currentIndex = playlistQueue.findIndex((t) => t.url === currentTrack.url);
      if (currentIndex >= 0 && playlistQueue[currentIndex + 1]) {
        setTrack(playlistQueue[currentIndex + 1], true);
      }
    });

    audio.addEventListener('loadedmetadata', () => {
      updateUI();
    });

    audio.addEventListener('progress', () => {
      updateUI();
    });

    // Handle position mode display
    if (config.position === 'Inline in posts' && detectedPostAudio) {
      root.style.display = 'none'; // Sticky bar hidden, inline only
    } else {
      root.style.display = '';
    }

    // Initialize track based on priority:
    // 1. Detected audio from the current post page
    // 2. Previously playing track from localStorage
    // 3. Default audio URL configured in Admin
    // 4. RSS feed items (handled in fetchRSSFeed)
    if (detectedPostAudio) {
      const isSameTrack = savedState.url === detectedPostAudio.url;
      setTrack(detectedPostAudio, isSameTrack && savedState.wasPlaying);
    } else if (savedState.url) {
      setTrack(
        {
          url: savedState.url,
          title: savedState.title,
          artist: savedState.artist,
          poster: savedState.poster,
        },
        false
      );

      if (savedState.playbackRate) {
        audio.playbackRate = savedState.playbackRate;
        if (speedText) speedText.textContent = `${savedState.playbackRate}×`;
      }
      if (savedState.volume != null) {
        audio.volume = savedState.volume;
        if (volumeSlider) volumeSlider.value = savedState.volume;
      }
    } else if (config.defaultAudio) {
      setTrack({ url: config.defaultAudio, title: 'Featured Episode' }, false);
    }

    // Minimized state preference
    if (savedState.isMinimized != null) {
      root.classList.toggle('is-minimized', savedState.isMinimized);
    } else if (config.startMinimized) {
      root.classList.add('is-minimized');
    }

    // Fetch RSS if configured
    if (config.podcastRss) {
      fetchRSSFeed(config.podcastRss);
    }

    // Pause other native media elements when player plays
    document.addEventListener(
      'play',
      (e) => {
        if (e.target instanceof HTMLAudioElement && e.target !== audio) {
          e.target.pause();
        }
      },
      true
    );

    // Global play trigger for cards, buttons, or links with data-h5ap-play-url
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-h5ap-play-url]');
      if (!trigger) return;
      e.preventDefault();
      const url = trigger.dataset.h5apPlayUrl;
      const title = trigger.dataset.h5apTitle || trigger.getAttribute('title') || 'Episode';
      const artist = trigger.dataset.h5apArtist || config.siteTitle;
      const poster = trigger.dataset.h5apPoster || config.siteLogo;
      if (url) {
        root.classList.remove('is-minimized');
        setTrack({ url, title, artist, poster }, true);
      }
    });

    window.addEventListener('beforeunload', persistState);
    window.addEventListener('pagehide', persistState);
  });
})();