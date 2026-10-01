// Paired comparison videos load as they approach the viewport.
function setupComparison(video, observer) {
  const wrapper = video.closest('.video-wrapper');
  const sources = [...video.querySelectorAll('source[data-src]')];
  let canvas;
  let frameRequest = 0;
  let position = .5;
  let started = false;

  function updateLabels() {
    const first = wrapper.querySelector('.video-label > :first-child');
    const last = wrapper.querySelector('.video-label > :last-child');
    const bounds = wrapper.getBoundingClientRect();
    const split = bounds.left + bounds.width * position;
    if (first) first.style.clipPath = `inset(0 ${Math.max(0, first.getBoundingClientRect().right - split)}px 0 0)`;
    if (last) last.style.clipPath = `inset(0 0 0 ${Math.max(0, split - last.getBoundingClientRect().left)}px)`;
  }

  function render() {
    if (!canvas || video.readyState < 2) return;
    const width = canvas.width;
    const height = canvas.height;
    const sourceWidth = video.videoWidth / 2;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, sourceWidth, video.videoHeight, 0, 0, width, height);
    const split = Math.round(width * position);
    if (split < width) {
      context.drawImage(video, sourceWidth + sourceWidth * position, 0,
        sourceWidth * (1 - position), video.videoHeight, split, 0, width - split, height);
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
    render();
    frameRequest = requestAnimationFrame(animate);
  }

  function showError() {
    wrapper.classList.add('is-error');
    let error = wrapper.querySelector('.comparison-error');
    if (!error) {
      error = document.createElement('div');
      error.className = 'comparison-error';
      error.innerHTML = '<span>Video could not load.</span><button type="button">Retry</button>';
      wrapper.appendChild(error);
      error.querySelector('button').addEventListener('click', () => {
        error.remove();
        wrapper.classList.remove('is-error');
        video.load();
      });
    }
  }

  function ready() {
    if (canvas || !video.videoWidth || !video.videoHeight) return;
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
    wrapper.classList.add('is-ready');
    updateLabels();
    new ResizeObserver(updateLabels).observe(wrapper);
    render();
    if (wrapper._comparisonVisible && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.play().catch(() => {});
    }

    function setPosition(value) {
      position = Math.min(1, Math.max(0, value));
      canvas.setAttribute('aria-valuenow', String(Math.round(position * 100)));
      updateLabels();
      render();
    }
    canvas.addEventListener('pointerdown', event => {
      canvas.setPointerCapture(event.pointerId);
      setPosition(event.offsetX / canvas.clientWidth);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.buttons || event.pointerType === 'mouse') {
        const rect = canvas.getBoundingClientRect();
        setPosition((event.clientX - rect.left) / rect.width);
      }
    });
    canvas.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setPosition(position + (event.key === 'ArrowRight' ? .05 : -.05));
      }
    });
  }

  video.addEventListener('loadeddata', ready);
  video.addEventListener('error', showError);
  sources.forEach(source => source.addEventListener('error', showError));
  video.addEventListener('play', () => {
    cancelAnimationFrame(frameRequest);
    animate();
  });
  video.addEventListener('pause', () => cancelAnimationFrame(frameRequest));

  wrapper._comparisonEnter = () => {
    if (!started) {
      sources.forEach(source => { source.src = source.dataset.src; });
      video.load();
      started = true;
    }
    if (video.readyState >= 2 && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.play().catch(() => {});
    }
  };
  wrapper._comparisonLeave = () => video.pause();
  observer.observe(wrapper);
}

function onDocumentReady() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const wrapper = entry.target;
      wrapper._comparisonVisible = entry.isIntersecting;
      (entry.isIntersecting ? wrapper._comparisonEnter : wrapper._comparisonLeave)();
    });
  }, { rootMargin: '350px 0px', threshold: 0 });
  document.querySelectorAll('#videos_compare video.video-compare').forEach(video => setupComparison(video, observer));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) document.querySelectorAll('#videos_compare video.video-compare').forEach(video => video.pause());
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDocumentReady);
} else {
  onDocumentReady();
}
