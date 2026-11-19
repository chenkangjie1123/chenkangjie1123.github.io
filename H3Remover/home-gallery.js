(() => {
  const cases = window.CASES;
  const q = s => document.querySelector(s);
  const grid = q('#case-grid'), filters = q('#case-filters');
  const dialog = q('#case-viewer'), movie = q('#case-movie');
  let opener, resumeHero = false;
  const toggle = q('#toggle-loops');
  const visible = new Set();
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function update(v) {
    v.poster ||= v.dataset.base + '.jpg';
    if (paused || dialog.open || document.hidden) { v.pause(); return; }
    if (!v.hasAttribute('src')) v.src = v.dataset.base + '.mp4';
    v.play().catch(() => {});
  }
  function refresh() {
    toggle.textContent = paused ? 'Play gallery previews' : 'Pause gallery previews';
    toggle.setAttribute('aria-pressed', String(paused));
    visible.forEach(update);
  }
  const observer = new IntersectionObserver(entries => {
    for (const {target:v,isIntersecting} of entries) {
      if (!v.isConnected) continue;
      if (isIntersecting) { visible.add(v); update(v); }
      else {
        visible.delete(v); v.pause();
        if (v.hasAttribute('src')) { v.removeAttribute('src'); v.load(); }
      }
    }
  });
  toggle.onclick = () => { paused = !paused; refresh(); };
  document.addEventListener('visibilitychange', refresh);
  refresh();
  function show(c, button) {
    opener = button;
    resumeHero = !q('#comparison').paused;
    q('#comparison').pause();
    q('#case-title').textContent = c.title;
    q('#case-info').textContent = c.source + ' · Input + mask (left) / H3Remover (right)';
    movie.setAttribute('aria-label', c.title);
    movie.poster = c.poster;
    movie.src = c.video;
    dialog.showModal();
    refresh();
    movie.play().catch(() => {});
  }
  q('#case-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    movie.pause();
    movie.removeAttribute('src');
    movie.load();
    refresh();
    if (resumeHero && !document.hidden) q('#comparison').play().catch(() => {});
    opener?.focus({preventScroll:true});
  });
  function render(category) {
    const selected = cases.filter(c => !category || category === c.category);
    for (const v of grid.querySelectorAll('video')) {
      observer.unobserve(v); visible.delete(v); v.pause(); v.removeAttribute('src'); v.load();
    }
    const cards = selected.map(c => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'case-card';
      const image = document.createElement('video');
      image.muted = image.defaultMuted = true; image.loop = image.playsInline = true;
      image.preload = 'none'; image.setAttribute('aria-hidden','true');
      image.dataset.base = 'assets/loops-v1/' + c.id;
      const title = document.createElement('strong'); title.textContent = c.title;
      const source = document.createElement('small'); source.textContent = c.source;
      button.append(image, title, source);
      button.onclick = () => show(c, button);
      return button;
    });
    grid.replaceChildren(...cards);
    grid.querySelectorAll('video').forEach(v => observer.observe(v));
    q('#case-count').textContent = selected.length + ' of ' + cases.length + ' examples';
    for (const b of filters.children) b.setAttribute('aria-pressed', String(b.dataset.filter === category));
  }
  for (const category of ['', ...new Set(cases.map(c=>c.category).sort())]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.filter = category;
    b.textContent = category || 'All'; b.onclick = () => render(category); filters.append(b);
  }
  render('');
})();
