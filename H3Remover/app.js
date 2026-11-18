const cases=window.CASES,$=s=>document.querySelector(s),players=new Set();let active=cases[0],lastFocus,globalPaused=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const observer=new IntersectionObserver(entries=>{for(const e of entries){const p=e.target._player;p.visible=e.isIntersecting;p.sync()}},{threshold:.02,rootMargin:'60px'});
function comparison(c,eager=false){
 const el=document.createElement('div');el.className='motion-compare';el.style.aspectRatio=`${c.width/2}/${c.height}`;
 el.innerHTML=`<canvas width="${c.width/2}" height="${c.height}" aria-label="Synchronized input and result: ${c.title}"></canvas><video muted loop playsinline preload="none" aria-hidden="true"></video><span class="pair-label left">Input + mask</span><span class="pair-label right">H3Remover</span><span class="motion-bar"><i>↔</i></span><input type="range" min="0" max="100" value="50" aria-label="Compare input and H3Remover: ${c.title}"><button class="retry-play" hidden>▶ Play video</button>`;
 const v=el.querySelector('video'),canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false}),range=el.querySelector('input'),bar=el.querySelector('.motion-bar'),retry=el.querySelector('.retry-play');
 const im=new Image();let position=50,holdUntil=0,dragging=false,raf=0,lastFrame=0,disposed=false,unloadTimer=0,resumeTime=0;v.muted=true;v.loop=true;v.playsInline=true;
 const p={el,v,visible:false,sync(){if(disposed)return;const run=p.visible&&!document.hidden&&!globalPaused&&!$('#viewer').open;if(run){clearTimeout(unloadTimer);unloadTimer=0;if(!im.src)im.src=c.poster;if(!v.getAttribute('src'))v.src=c.video;v.play().then(()=>retry.hidden=true).catch(()=>retry.hidden=false);if(!raf)raf=requestAnimationFrame(draw)}else{v.pause();cancelAnimationFrame(raf);raf=0;if(!p.visible&&!unloadTimer)unloadTimer=setTimeout(()=>{unloadTimer=0;if(!p.visible&&!disposed){resumeTime=v.currentTime||0;v.removeAttribute('src');v.load()}},20000)}},dispose(){disposed=true;clearTimeout(unloadTimer);observer.unobserve(el);cancelAnimationFrame(raf);v.pause();v.removeAttribute('src');v.load();players.delete(p)}};
 function paint(source){const w=canvas.width,h=canvas.height,sw=source.videoWidth||source.naturalWidth,sh=source.videoHeight||source.naturalHeight;if(!sw)return;ctx.drawImage(source,sw/2,0,sw/2,sh,0,0,w,h);ctx.save();ctx.beginPath();ctx.rect(0,0,w*position/100,h);ctx.clip();ctx.drawImage(source,0,0,sw/2,sh,0,0,w,h);ctx.restore();bar.style.left=position+'%'}
 function draw(t){raf=0;if(disposed||!p.visible||document.hidden||globalPaused||$('#viewer').open)return;if(t-lastFrame>65){if(!dragging&&t>holdUntil&&!reduced.matches){position+=(50+35*Math.sin(t/3500)-position)*.055;range.value=position}if(v.readyState>=2)paint(v);else if(im.complete)paint(im);lastFrame=t}raf=requestAnimationFrame(draw)}
 v.addEventListener('loadedmetadata',()=>{if(resumeTime>0&&resumeTime<v.duration)v.currentTime=resumeTime});
 im.onload=()=>{if(!disposed&&v.readyState<2)paint(im)};
 range.onpointerdown=()=>{dragging=true};const release=()=>{dragging=false;holdUntil=performance.now()+5000};range.onpointerup=release;range.onpointercancel=release;range.onblur=release;range.oninput=()=>{position=Number(range.value);holdUntil=performance.now()+5000;paint(v.readyState>=2?v:im)};
 retry.onclick=()=>{globalPaused=false;p.visible=true;p.sync()};v.addEventListener('error',()=>{retry.hidden=false;retry.textContent='Retry playback';retry.onclick=()=>{v.load();p.sync()}});
 el._player=p;players.add(p);observer.observe(el);return el;
}
function clear(container){container.querySelectorAll('.motion-compare').forEach(el=>el._player.dispose());container.replaceChildren()}
function render(filter='All'){const selected=cases.filter(c=>filter==='All'||c.category===filter);clear($('#gallery'));for(const c of selected){const card=document.createElement('article');card.className='card';card.append(comparison(c));const meta=document.createElement('div');meta.className='card-meta';const h=document.createElement('h3');h.textContent=c.title;const b=document.createElement('button');b.textContent='Expand ↗';b.setAttribute('aria-label','Expand '+c.title);b.onclick=()=>openViewer(c);meta.append(h,b);card.append(meta);$('#gallery').append(card)}$('#count').textContent=selected.length+' videos';document.querySelectorAll('#filters button').forEach(b=>b.setAttribute('aria-pressed',b.textContent===filter))}
['All','Driving','People','Wildlife','Water','Objects'].forEach(f=>{const b=document.createElement('button');b.textContent=f;b.onclick=()=>render(f);$('#filters').append(b)});render();
function openViewer(c){lastFocus=document.activeElement;$('#viewer-title').textContent=c.title;$('#viewer-source').textContent=c.source;const v=document.createElement('video');v.controls=true;v.playsInline=true;v.muted=true;v.loop=true;v.src=c.video;v.poster=c.poster;$('#viewer-content').replaceChildren(v);$('#viewer-note').textContent='Left: actual highlighted input. Right: H3Remover. Matching timestamps on one video timeline.';$('#viewer').showModal();syncPromo();document.body.classList.add('modal-open');players.forEach(p=>p.sync());v.play().catch(()=>{})}
$('#close').onclick=()=>$('#viewer').close();$('#viewer').addEventListener('close',()=>{const v=$('#viewer-content video');if(v){v.pause();v.removeAttribute('src');v.load()}$('#viewer-content').replaceChildren();document.body.classList.remove('modal-open');players.forEach(p=>p.sync());lastFocus?.focus()});document.addEventListener('visibilitychange',()=>{players.forEach(p=>p.sync());if(document.hidden)$('#viewer-content video')?.pause()});

const promoVideo=document.querySelector('#promo-video');
let promoVisible=false,promoUserPaused=false;
function syncPromo(){if(!promoVideo)return;if(promoVisible&&!document.hidden&&!$('#viewer').open&&!promoUserPaused)promoVideo.play().catch(()=>{});else promoVideo.pause()}
if(promoVideo){
 promoVideo.muted=true;
 promoVideo.addEventListener('pause',()=>{if(promoVisible&&!document.hidden&&!$('#viewer').open)promoUserPaused=true});
 promoVideo.addEventListener('play',()=>{promoUserPaused=false});
 new IntersectionObserver(entries=>{promoVisible=entries[0].isIntersecting;syncPromo()},{threshold:.1}).observe(promoVideo);
 document.addEventListener('visibilitychange',syncPromo);
 $('#viewer').addEventListener('close',syncPromo);
 $('#viewer').addEventListener('toggle',syncPromo);
}
