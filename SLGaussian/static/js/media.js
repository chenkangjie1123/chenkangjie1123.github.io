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
    video.addEventListener('loadeddata', () => {
      frame.classList.add('is-ready');
      if (frame.dataset.visible === 'true' && !reducedMotion.matches && !document.hidden) {
        video.play().catch(() => {});
      }
    });
    video.addEventListener('error', () => {
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
    });
    video.querySelector('source').addEventListener('error', () => {
      video.dispatchEvent(new Event('error'));
    });
    observer.observe(frame);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
  });
});
