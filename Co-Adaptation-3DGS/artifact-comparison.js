'use strict';
// Public, precomputed renderings only. Selection masks are derived from each paused semantic frame.
class VisualDemo {
 constructor(host,source,{autoplay=true}={}) {
  this.host=host;this.playing=autoplay&&!matchMedia('(prefers-reduced-motion: reduce)').matches;this.visible=true;this.clock=0;this.last=0;this.dead=false;
  host.className='visual-demo';host.innerHTML='<canvas tabindex="0"></canvas><video muted playsinline loop preload="auto" hidden></video><button class="visual-play" type="button"></button><span class="visual-status sr-only" role="status"></span>';
  this.canvas=host.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.video=host.querySelector('video');this.video.muted=true;this.video.src=source;this.button=host.querySelector('button');this.updateButton();
  this.button.onclick=()=>this.playing?this.stop():this.start();
  this.video.addEventListener('loadeddata',()=>{if(this.playing&&this.visible)this.video.play().catch(()=>{});});
  this.video.addEventListener('error',()=>{host.querySelector('.visual-status').classList.remove('sr-only');host.querySelector('.visual-status').textContent='The demo could not be loaded. Please reload the page.';});
  this.observer=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting;if(this.visible&&this.playing&&!document.hidden&&!this.selection)this.video.play().catch(()=>{});else this.video.pause();},{threshold:.1});this.observer.observe(host);
  this.visibility=()=>{if(document.hidden)this.video.pause();else if(this.visible&&this.playing&&!this.selection)this.video.play().catch(()=>{});};document.addEventListener('visibilitychange',this.visibility);
  const tick=t=>{if(this.dead)return;const dt=Math.min(.05,(t-(this.last||t))/1000);this.last=t;if(this.visible&&!document.hidden&&this.video.readyState>=2){if(this.playing||this.manualAnimation)this.clock+=dt;this.draw(dt);}this.raf=requestAnimationFrame(tick);};this.raf=requestAnimationFrame(tick);
 }
 updateButton(){this.button.textContent=this.playing?'Ⅱ':'▶';this.button.setAttribute('aria-label',this.playing?'Pause demo':'Play demo');}
 start(){this.playing=true;this.updateButton();if(!this.selection&&this.visible&&!document.hidden)this.video.play().catch(()=>{});}
 stop(){this.playing=false;this.manualAnimation=false;this.video.pause();this.updateButton();}
 announce(text){this.host.querySelector('.visual-status').textContent=text;}
 destroy(){this.dead=true;cancelAnimationFrame(this.raf);this.video.pause();this.video.removeAttribute('src');this.video.load();this.observer.disconnect();document.removeEventListener('visibilitychange',this.visibility);}
}
class ComparisonDemo extends VisualDemo {
 constructor(host,options={}){
  super(host,'assets/flower-pair.mp4',options);this.canvas.width=900;this.canvas.height=800;this.canvas.setAttribute('aria-label','Flower scene rendered with 3DGS on the left and 3DGS with Gaussian dropout on the right. The dashed outline highlights color artifacts beside the flower. Drag the divider to compare this region, or use the arrow keys.');this.fraction=.5;this.manual=false;
  const range=document.createElement('input');range.type='range';range.min=0;range.max=100;range.value=50;range.className='wipe-range';range.setAttribute('aria-label','Compare 3DGS with and without Gaussian dropout');host.append(range);this.range=range;
  range.addEventListener('input',()=>{this.manual=true;this.fraction=Number(range.value)/100;});
  this.canvas.addEventListener('pointerdown',e=>{this.manual=true;this.dragging=true;this.canvas.setPointerCapture(e.pointerId);this.move(e);});this.canvas.addEventListener('pointermove',e=>{if(this.dragging)this.move(e);});this.canvas.addEventListener('pointerup',()=>{this.dragging=false;});this.canvas.addEventListener('pointercancel',()=>{this.dragging=false;});
  this.canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.manual=true;this.fraction=Math.max(0,Math.min(1,this.fraction+(e.key==='ArrowRight'?.05:-.05)));this.range.value=this.fraction*100;}});
 }
 move(event){const r=this.canvas.getBoundingClientRect();this.fraction=Math.max(0,Math.min(1,(event.clientX-r.left)/r.width));this.range.value=this.fraction*100;}
 draw(){
  // Both views come from one synchronized source frame. Identical crop retains the flower and its artifacts.
  const c=this.ctx;if(this.playing&&!this.manual)this.fraction=.5+.45*Math.sin(this.clock*.85);const boundary=this.fraction*900;this.range.value=Math.round(this.fraction*100);
  c.drawImage(this.video,504+115,48,315,280,0,0,900,800);c.save();c.beginPath();c.rect(0,0,boundary,800);c.clip();c.drawImage(this.video,115,48,315,280,0,0,900,800);c.restore();
  // Same source-space region in both aligned renderings; no pixel changes.
  // Crop x=115..430, y=48..328 maps this flower-edge region into the canvas.
  c.save();
  c.beginPath();c.roundRect(628,134,252,430,12);
  c.setLineDash([12,9]);c.strokeStyle='#ffffffdd';c.lineWidth=2;c.stroke();
  c.setLineDash([]);
  c.beginPath();c.moveTo(754,564);c.lineTo(754,586);
  c.strokeStyle='#ffffffdd';c.lineWidth=2;c.stroke();
  c.fillStyle='rgba(12,20,29,.86)';c.beginPath();c.roundRect(620,586,268,46,8);c.fill();
  c.font='500 25px Arial, sans-serif';c.fillStyle='#ffffffdd';c.textAlign='center';c.textBaseline='middle';
  c.fillText('Color artifacts',754,609);
  c.restore();
  c.strokeStyle='#ffffffdd';c.lineWidth=2;c.beginPath();c.moveTo(boundary,0);c.lineTo(boundary,800);c.stroke();c.fillStyle='#101a25bb';c.beginPath();c.arc(boundary,400,23,0,Math.PI*2);c.fill();c.stroke();c.strokeStyle='white';c.lineWidth=2;c.beginPath();c.moveTo(boundary-7,393);c.lineTo(boundary-14,400);c.lineTo(boundary-7,407);c.moveTo(boundary+7,393);c.lineTo(boundary+14,400);c.lineTo(boundary+7,407);c.stroke();
  this.host.dataset.phase='wipe';
 }
}
window.ComparisonDemo=ComparisonDemo;
