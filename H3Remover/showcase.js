(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  const visible = new Set();
  const toggle = document.querySelector('#result-toggle');
  function sync(v) {
    if (visible.has(v) && !document.hidden && !(v.closest('.result-grid') ? paused : reduced.matches)) v.play().catch(() => {});
    else v.pause();
  }
  function label() { toggle.textContent = paused ? 'Play result previews' : 'Pause result previews'; }
  toggle.onclick = () => { paused = !paused; label(); visible.forEach(sync); };
  label();
  document.addEventListener('visibilitychange', () => visible.forEach(sync));
  const observer = new IntersectionObserver(entries => {
    for (const {target, isIntersecting} of entries) {
      if (isIntersecting) visible.add(target); else visible.delete(target);
      sync(target);
    }
  }, {threshold: 0.35});
  for (const v of document.querySelectorAll('.result-grid video, #gradio video')) observer.observe(v);
})();
