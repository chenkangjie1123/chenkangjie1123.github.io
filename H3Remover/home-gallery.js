(() => {
  const cases = window.CASES;
  const q = s => document.querySelector(s);
  const grid = q('#case-grid'), filters = q('#case-filters');
  const dialog = q('#case-viewer'), movie = q('#case-movie');
  let opener;
  function show(c, button) {
    opener = button;
    q('#comparison').pause();
    q('#case-title').textContent = c.title;
    q('#case-info').textContent = c.source + ' · Input + mask (left) / H3Remover (right)';
    movie.setAttribute('aria-label', c.title);
    movie.poster = c.poster;
    movie.src = c.video;
    dialog.showModal();
    movie.play().catch(() => {});
  }
  q('#case-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    movie.pause();
    movie.removeAttribute('src');
    movie.load();
    opener?.focus({preventScroll:true});
  });
  function render(category) {
    const selected = cases.filter(c => !category || category === c.category);
    const cards = selected.map(c => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'case-card';
      const image = document.createElement('img');
      image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.width = c.width; image.height = c.height; image.src = c.poster;
      const title = document.createElement('strong'); title.textContent = c.title;
      const source = document.createElement('small'); source.textContent = c.source;
      button.append(image, title, source);
      button.onclick = () => show(c, button);
      return button;
    });
    grid.replaceChildren(...cards);
    q('#case-count').textContent = selected.length + ' of ' + cases.length + ' examples';
    for (const b of filters.children) b.setAttribute('aria-pressed', String(b.dataset.filter === category));
  }
  for (const category of ['', ...new Set(cases.map(c=>c.category).sort())]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.filter = category;
    b.textContent = category || 'All'; b.onclick = () => render(category); filters.append(b);
  }
  render('');
})();
