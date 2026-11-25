(() => {
  const q = id => document.getElementById(id);
  const film = q('drive-film'), canvas = q('wipe-image'), stage = q('wipe-stage');
  const slider = q('wipe-slider'), toggle = q('wipe-play'), auto = q('wipe-auto');
  const buttons = [...document.querySelectorAll('.drive-picks button')];
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sweep = !reduced, fraction = reduced ? .5 : 1, raf = 0, inView = true, wantsPlay = !reduced;
  function paint() {
    if (film.readyState < 2 || !film.videoWidth) return;
    const w = film.videoWidth / 2, h = film.videoHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (sweep && film.duration > 0) {
      const t = Math.min(1, Math.max(0, (film.currentTime / film.duration - .12) / .66));
      fraction = 1 - t*t*(3-2*t);
    }
    const x = Math.round(w * fraction);
    ctx.drawImage(film,w,0,w,h,0,0,w,h);
    if (x) ctx.drawImage(film,0,0,x,h,0,0,x,h);
    stage.style.setProperty('--split', (fraction*100)+'%');
    slider.value = Math.round(fraction*100);
    stage.classList.toggle('only-before', fraction > .91);
    stage.classList.toggle('only-after', fraction < .09);
  }
  function loop() { paint(); if (!film.paused) raf = requestAnimationFrame(loop); }
  function playback() {
    if (wantsPlay && inView && !document.hidden) film.play().catch(()=>{});
    else film.pause();
  }
  function mode(on) { sweep = on; auto.setAttribute('aria-pressed', String(on)); }
  mode(sweep);
  slider.oninput = () => { mode(false); fraction = Number(slider.value)/100; paint(); };
  auto.onclick = () => { mode(!sweep); if(sweep){ film.currentTime=0; wantsPlay=true; playback(); } paint(); };
  toggle.onclick = () => { wantsPlay = film.paused; playback(); };
  film.addEventListener('play',()=>{toggle.textContent='Pause clip';cancelAnimationFrame(raf);loop();});
  film.addEventListener('pause',()=>{toggle.textContent='Play clip';cancelAnimationFrame(raf);paint();});
  film.addEventListener('loadeddata',()=>{q('wipe-status').textContent='';paint(); playback();});
  film.addEventListener('seeked',paint);
  film.addEventListener('error',()=>{q('wipe-status').textContent='This clip could not load. Select another scene or reload the page.';});
  buttons.forEach((b,i)=>b.onclick=()=>{
    if(b.getAttribute('aria-pressed')==='true') return;
    buttons.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    q('drive-caption').textContent=b.dataset.description;
    q('drive-count').textContent=(i+1)+' / '+buttons.length;
    canvas.setAttribute('aria-label',b.textContent.trim()+': original and edited at the same instant');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    film.src=b.dataset.film; film.load(); playback();
  });
  document.addEventListener('visibilitychange',playback);
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting; playback();}).observe(stage);
})();
