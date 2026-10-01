document.addEventListener('DOMContentLoaded', () => {
  const videos = [...document.querySelectorAll('video.result-video')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target.querySelector('video');
      const source = video.querySelector('source[data-src]');
      if (entry.isIntersecting) {
        entry.target.dataset.visible = 'true';
        if (!source.src) {
          source.src = source.dataset.src;
          video.load();
        }
        if (video.readyState >= 2 && !reducedMotion.matches && !document.hidden) {
          video.play().catch(() => {});
        }
      } else {
        entry.target.dataset.visible = 'false';
        video.pause();
      }
    });
  }, { rootMargin: '300px 0px', threshold: 0 });

  videos.forEach(video => {
    const frame = document.createElement('div');
    frame.className = 'result-video-frame';
    video.before(frame);
    frame.appendChild(video);
    let hasLoadedFrame = false;
    const markReady = () => {
      hasLoadedFrame = true;
      frame.classList.add('is-ready');
      frame.classList.remove('is-error');
      frame.querySelector('.result-video-error')?.remove();
      if (frame.dataset.visible === 'true' && !reducedMotion.matches && !document.hidden) {
        video.play().catch(() => {});
      }
    };
    const showError = () => {
      if (!video.querySelector('source').hasAttribute('src')) return;
      if (hasLoadedFrame || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (frame.classList.contains('is-error')) return;
      frame.classList.add('is-error');
      const error = document.createElement('div');
      error.className = 'result-video-error';
      error.innerHTML = '<span>Video could not load.</span><button type="button">Retry</button>';
      frame.appendChild(error);
      error.querySelector('button').addEventListener('click', () => {
        error.remove();
        frame.classList.remove('is-error');
        video.load();
      });
    };
    video.addEventListener('loadeddata', markReady);
    video.addEventListener('playing', markReady);
    video.addEventListener('error', showError);
    video.querySelector('source').addEventListener('error', () => {
      window.setTimeout(() => {
        if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) showError();
      }, 100);
    });
    observer.observe(frame);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
  });
});
