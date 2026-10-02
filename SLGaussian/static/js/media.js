document.addEventListener('DOMContentLoaded', () => {
  const videos = [...document.querySelectorAll('video.result-video')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target._setVideoVisible(entry.isIntersecting));
  }, { rootMargin: '300px 0px', threshold: 0 });

  videos.forEach(video => {
    const source = video.querySelector('source[data-src]');
    const frame = document.createElement('div');
    frame.className = 'result-video-frame';
    video.before(frame);
    frame.appendChild(video);
    let activeVideo = video;
    let originalVideo = null;
    let previewReady = false;
    let usingOriginalDirectly = false;
    let upgradeTimer = 0;
    let errorTimer = 0;
    let upgradeAbort = null;
    let upgrading = false;
    let originalObjectURL = null;
    let releaseTimer = 0;

    function clearError() {
      clearTimeout(errorTimer);
      frame.classList.remove('is-error');
      frame.querySelector('.result-video-error')?.remove();
    }

    function markReady() {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      previewReady = true;
      frame.classList.add('is-ready');
      clearError();
      if (frame.dataset.visible === 'true' && activeVideo === video && !reducedMotion.matches && !document.hidden) {
        video.play().catch(() => {});
      }
      scheduleUpgrade();
    }

    function showError() {
      if (!source.hasAttribute('src') || previewReady ||
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA || !video.paused) return;
      if (!video.error && video.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) return;
      if (!usingOriginalDirectly && source.dataset.preview) {
        usingOriginalDirectly = true;
        source.src = source.dataset.src;
        video.load();
        return;
      }
      if (frame.classList.contains('is-error')) return;
      frame.classList.add('is-error');
      const error = document.createElement('div');
      error.className = 'result-video-error';
      error.innerHTML = '<span>Video could not load.</span><button type="button">Retry</button>';
      frame.appendChild(error);
      error.querySelector('button').addEventListener('click', () => {
        clearError();
        video.load();
      });
    }

    function scheduleError() {
      clearTimeout(errorTimer);
      errorTimer = window.setTimeout(showError, 1500);
    }

    async function waitForFrame(media) {
      if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => finish(false), 12000);
        function finish(ok) {
          clearTimeout(timer);
          media.removeEventListener('loadeddata', loaded);
          media.removeEventListener('error', failed);
          ok ? resolve() : reject(new Error('Original video did not decode'));
        }
        function loaded() { finish(true); }
        function failed() { finish(false); }
        media.addEventListener('loadeddata', loaded);
        media.addEventListener('error', failed);
        media.load();
        media.play().catch(() => {});
      });
    }

    async function activateOriginal() {
      if (!originalVideo || activeVideo === originalVideo || frame.dataset.visible !== 'true') return;
      if (Number.isFinite(originalVideo.duration) && originalVideo.duration > .1) {
        originalVideo.currentTime = Math.min(video.currentTime % originalVideo.duration, originalVideo.duration - .05);
        if (originalVideo.seeking) {
          await new Promise(resolve => {
            const timer = window.setTimeout(resolve, 1200);
            originalVideo.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
          });
        }
      }
      if (frame.dataset.visible !== 'true') return;
      const shouldPlay = !video.paused && !reducedMotion.matches && !document.hidden;
      if (shouldPlay) {
        await originalVideo.play().catch(() => {});
        if (originalVideo.paused) return;
      } else originalVideo.pause();
      originalVideo.controls = video.controls;
      activeVideo = originalVideo;
      frame.classList.add('is-upgraded');
      video.controls = false;
      video.pause();
    }

    function releaseOriginal(force = false) {
      if (!originalVideo || (!force && frame.dataset.visible === 'true')) return;
      const released = originalVideo;
      originalVideo = null;
      activeVideo = video;
      frame.classList.remove('is-upgraded');
      video.controls = true;
      released.pause();
      released.removeAttribute('src');
      released.load();
      released.remove();
      if (originalObjectURL) URL.revokeObjectURL(originalObjectURL);
      originalObjectURL = null;
    }

    async function loadOriginal() {
      if (upgrading || originalVideo || usingOriginalDirectly || frame.dataset.visible !== 'true') return;
      upgrading = true;
      const controller = new AbortController();
      upgradeAbort = controller;
      let candidate;
      let objectURL;
      try {
        const response = await fetch(source.dataset.src, { signal: controller.signal, priority: 'low' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (controller.signal.aborted || frame.dataset.visible !== 'true') return;
        objectURL = URL.createObjectURL(blob);
        candidate = document.createElement('video');
        candidate.className = 'result-video-high';
        candidate.muted = true;
        candidate.loop = true;
        candidate.playsInline = true;
        candidate.preload = 'auto';
        candidate.src = objectURL;
        frame.appendChild(candidate);
        await waitForFrame(candidate);
        if (controller.signal.aborted) return;
        originalVideo = candidate;
        originalObjectURL = objectURL;
        candidate = null;
        objectURL = null;
        originalVideo.addEventListener('error', () => {
          if (activeVideo === originalVideo) {
            activeVideo = video;
            frame.classList.remove('is-upgraded');
            video.controls = true;
            video.play().catch(() => {});
          }
          releaseOriginal(true);
        });
        await activateOriginal();
      } catch (_) {
        // A failed original download never replaces a working preview.
      } finally {
        if (candidate) {
          candidate.pause();
          candidate.removeAttribute('src');
          candidate.load();
          candidate.remove();
        }
        if (objectURL) URL.revokeObjectURL(objectURL);
        if (upgradeAbort === controller) upgradeAbort = null;
        upgrading = false;
      }
    }

    function scheduleUpgrade() {
      if (!previewReady || !source.dataset.preview || originalVideo || upgrading ||
          usingOriginalDirectly || frame.dataset.visible !== 'true') return;
      clearTimeout(upgradeTimer);
      upgradeTimer = window.setTimeout(loadOriginal, 700);
    }

    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('playing', markReady);
    video.addEventListener('error', scheduleError);
    source.addEventListener('error', () => { if (source.hasAttribute('src')) scheduleError(); });

    frame._setVideoVisible = visible => {
      frame.dataset.visible = String(visible);
      if (visible) {
        clearTimeout(releaseTimer);
        if (!source.hasAttribute('src')) {
          source.src = source.dataset.preview || source.dataset.src;
          video.load();
        }
        if (originalVideo) activateOriginal();
        if (activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !reducedMotion.matches && !document.hidden) {
          activeVideo.play().catch(() => {});
        }
        scheduleUpgrade();
      } else {
        clearTimeout(upgradeTimer);
        if (upgradeAbort) upgradeAbort.abort();
        video.pause();
        originalVideo?.pause();
        clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(releaseOriginal, 20000);
      }
    };
    observer.observe(frame);
  });

  document.addEventListener('visibilitychange', () => {
    document.querySelectorAll('.result-video-frame').forEach(frame => {
      if (document.hidden) frame._setVideoVisible(false);
      else {
        const rect = frame.getBoundingClientRect();
        if (rect.bottom > -300 && rect.top < innerHeight + 300) frame._setVideoVisible(true);
      }
    });
  });
});
