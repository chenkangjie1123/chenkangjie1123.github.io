// Show a small preview immediately, then replace it after the original has downloaded.
function setupComparison(video, observer) {
  const wrapper = video.closest('.video-wrapper');
  const source = video.querySelector('source[data-src]');
  let activeVideo = video;
  let originalVideo = null;
  let canvas;
  let frameRequest = 0;
  let position = .5;
  let started = false;
  let hasFrame = false;
  let usingOriginalDirectly = false;
  let upgradeTimer = 0;
  let errorTimer = 0;
  let upgradeAbort = null;
  let upgrading = false;
  let originalObjectURL = null;
  let releaseTimer = 0;

  function clearError() {
    clearTimeout(errorTimer);
    wrapper.classList.remove('is-error');
    wrapper.querySelector('.comparison-error')?.remove();
  }

  function updateLabels() {
    const first = wrapper.querySelector('.video-label > :first-child');
    const last = wrapper.querySelector('.video-label > :last-child');
    const bounds = wrapper.getBoundingClientRect();
    const split = bounds.left + bounds.width * position;
    if (first) first.style.clipPath = `inset(0 ${Math.max(0, first.getBoundingClientRect().right - split)}px 0 0)`;
    if (last) last.style.clipPath = `inset(0 0 0 ${Math.max(0, split - last.getBoundingClientRect().left)}px)`;
  }

  function render() {
    if (!canvas || activeVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    hasFrame = true;
    if (wrapper.classList.contains('is-error')) clearError();
    const width = canvas.width;
    const height = canvas.height;
    const sourceWidth = activeVideo.videoWidth / 2;
    const context = canvas.getContext('2d');
    context.drawImage(activeVideo, 0, 0, sourceWidth, activeVideo.videoHeight, 0, 0, width, height);
    const split = Math.round(width * position);
    if (split < width) {
      context.drawImage(activeVideo, sourceWidth + sourceWidth * position, 0,
        sourceWidth * (1 - position), activeVideo.videoHeight, split, 0, width - split, height);
    }
    context.fillStyle = 'rgba(12, 24, 43, .32)';
    context.fillRect(split - 3, 0, 6, height);
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(split, height * .5, Math.max(16, height * .055), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#294674';
    context.font = `bold ${Math.max(15, height * .046)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('↔', split, height * .5);
  }

  function animate() {
    if (!wrapper._comparisonVisible || document.hidden) {
      frameRequest = 0;
      return;
    }
    render();
    frameRequest = requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (!frameRequest) frameRequest = requestAnimationFrame(animate);
  }

  function showError() {
    if (!started || !source.hasAttribute('src') || hasFrame || canvas ||
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA || !video.paused) return;
    if (!video.error && video.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) return;
    // A missing or unsupported preview can fall back to the original directly.
    if (!usingOriginalDirectly && source.dataset.preview) {
      usingOriginalDirectly = true;
      source.src = source.dataset.src;
      video.load();
      return;
    }
    if (wrapper.classList.contains('is-error')) return;
    wrapper.classList.add('is-error');
    const error = document.createElement('div');
    error.className = 'comparison-error';
    error.innerHTML = '<span>Video could not load.</span><button type="button">Retry</button>';
    wrapper.appendChild(error);
    error.querySelector('button').addEventListener('click', () => {
      clearError();
      video.load();
    });
  }

  function scheduleError() {
    clearTimeout(errorTimer);
    errorTimer = window.setTimeout(showError, 1500);
  }

  function ready() {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return;
    hasFrame = true;
    clearError();
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'comparison-canvas';
      canvas.width = Math.round(video.videoWidth / 2);
      canvas.height = video.videoHeight;
      canvas.setAttribute('role', 'slider');
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('aria-label', 'Slide to compare the two video results');
      canvas.setAttribute('aria-valuemin', '0');
      canvas.setAttribute('aria-valuemax', '100');
      canvas.setAttribute('aria-valuenow', '50');
      video.after(canvas);
      new ResizeObserver(updateLabels).observe(wrapper);
      canvas.addEventListener('pointerdown', event => {
        canvas.setPointerCapture(event.pointerId);
        position = Math.min(1, Math.max(0, event.offsetX / canvas.clientWidth));
        canvas.setAttribute('aria-valuenow', String(Math.round(position * 100)));
        updateLabels();
        render();
      });
      canvas.addEventListener('pointermove', event => {
        if (event.buttons || event.pointerType === 'mouse') {
          const rect = canvas.getBoundingClientRect();
          position = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          canvas.setAttribute('aria-valuenow', String(Math.round(position * 100)));
          updateLabels();
          render();
        }
      });
      canvas.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          position = Math.min(1, Math.max(0, position + (event.key === 'ArrowRight' ? .05 : -.05)));
          canvas.setAttribute('aria-valuenow', String(Math.round(position * 100)));
          updateLabels();
          render();
        }
      });
    }
    wrapper.classList.add('is-ready');
    updateLabels();
    render();
    if (wrapper._comparisonVisible && !document.hidden) {
      startAnimation();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) activeVideo.play().catch(() => {});
      scheduleUpgrade();
    }
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
    if (!originalVideo || activeVideo === originalVideo || !wrapper._comparisonVisible) return;
    const targetTime = video.currentTime;
    if (Number.isFinite(originalVideo.duration) && originalVideo.duration > .1) {
      originalVideo.currentTime = Math.min(targetTime % originalVideo.duration, originalVideo.duration - .05);
      if (originalVideo.seeking) {
        await new Promise(resolve => {
          const timer = window.setTimeout(resolve, 1200);
          originalVideo.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
    }
    if (!wrapper._comparisonVisible) return;
    const shouldPlay = !video.paused && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (shouldPlay) {
      await originalVideo.play().catch(() => {});
      if (originalVideo.paused) return;
    } else originalVideo.pause();
    activeVideo = originalVideo;
    video.pause();
    canvas.width = Math.round(originalVideo.videoWidth / 2);
    canvas.height = originalVideo.videoHeight;
    render();
    startAnimation();
  }

  function releaseOriginal(force = false) {
    if (!originalVideo || (!force && wrapper._comparisonVisible)) return;
    const released = originalVideo;
    originalVideo = null;
    activeVideo = video;
    released.pause();
    released.removeAttribute('src');
    released.load();
    released.remove();
    if (originalObjectURL) URL.revokeObjectURL(originalObjectURL);
    originalObjectURL = null;
    if (canvas) {
      canvas.width = Math.round(video.videoWidth / 2);
      canvas.height = video.videoHeight;
    }
  }

  async function loadOriginal() {
    if (upgrading || originalVideo || usingOriginalDirectly || !wrapper._comparisonVisible) return;
    upgrading = true;
    const controller = new AbortController();
    upgradeAbort = controller;
    let candidate;
    let objectURL;
    try {
      const response = await fetch(source.dataset.src, { signal: controller.signal, priority: 'low' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (controller.signal.aborted || !wrapper._comparisonVisible) return;
      objectURL = URL.createObjectURL(blob);
      candidate = document.createElement('video');
      candidate.className = 'comparison-upgrade-video';
      candidate.muted = true;
      candidate.loop = true;
      candidate.playsInline = true;
      candidate.preload = 'auto';
      candidate.src = objectURL;
      wrapper.appendChild(candidate);
      await waitForFrame(candidate);
      if (controller.signal.aborted) return;
      originalVideo = candidate;
      originalObjectURL = objectURL;
      candidate = null;
      objectURL = null;
      originalVideo.addEventListener('error', () => {
        if (activeVideo === originalVideo) {
          activeVideo = video;
          video.play().catch(() => {});
          render();
        }
        releaseOriginal(true);
      });
      await activateOriginal();
    } catch (_) {
      // The preview remains available if the original request or decoder fails.
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
    if (!source.dataset.preview || originalVideo || upgrading || usingOriginalDirectly || !wrapper._comparisonVisible) return;
    clearTimeout(upgradeTimer);
    upgradeTimer = window.setTimeout(loadOriginal, 700);
  }

  video.addEventListener('loadeddata', ready);
  video.addEventListener('canplay', ready);
  video.addEventListener('playing', ready);
  video.addEventListener('error', scheduleError);
  source.addEventListener('error', () => { if (source.hasAttribute('src')) scheduleError(); });

  wrapper._comparisonEnter = () => {
    wrapper._comparisonVisible = true;
    clearTimeout(releaseTimer);
    if (!started) {
      started = true;
      source.src = source.dataset.preview || source.dataset.src;
      video.load();
    }
    if (originalVideo) activateOriginal();
    if (activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startAnimation();
      if (!document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) activeVideo.play().catch(() => {});
      scheduleUpgrade();
    }
  };
  wrapper._comparisonLeave = () => {
    wrapper._comparisonVisible = false;
    clearTimeout(upgradeTimer);
    if (upgradeAbort) upgradeAbort.abort();
    video.pause();
    originalVideo?.pause();
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(releaseOriginal, 20000);
  };
  observer.observe(wrapper);
}

function onDocumentReady() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const wrapper = entry.target;
      (entry.isIntersecting ? wrapper._comparisonEnter : wrapper._comparisonLeave)();
    });
  }, { rootMargin: '350px 0px', threshold: 0 });
  document.querySelectorAll('#videos_compare video.video-compare').forEach(video => setupComparison(video, observer));
  document.addEventListener('visibilitychange', () => {
    document.querySelectorAll('#videos_compare .video-wrapper').forEach(wrapper => {
      if (document.hidden) wrapper._comparisonLeave();
      else if (wrapper.getBoundingClientRect().bottom > -350 && wrapper.getBoundingClientRect().top < innerHeight + 350) wrapper._comparisonEnter();
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDocumentReady);
} else {
  onDocumentReady();
}
