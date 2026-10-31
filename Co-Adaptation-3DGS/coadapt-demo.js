import * as THREE from './vendor/three/three.module.js';

// Small analytic example of Fig. 1(d), not a reconstruction or an experimental result.
// Perspective covariance projection and front-to-back alpha compositing follow 3DGS.
export function projectGaussians(degrees) {
 const t=degrees*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 return [-.95,0,.95].map((z,i)=>{
  const x=-s*z,depth=4+c*z,sx=.15*(4+z)/4,sy=.20*(4+z)/4,sz=.32;
  const xx=c*c*sx*sx+s*s*sz*sz,zz=s*s*sx*sx+c*c*sz*sz,xz=c*s*(sx*sx-sz*sz);
  const a=4/depth,b=-4*x/(depth*depth);
  return {u:4*x/depth,v:0,xx:a*a*xx+2*a*b*xz+b*b*zz,yy:a*a*sy*sy,depth,opacity:[1/3,.5,.99][i],color:[[.95,.12,.12],[.12,.95,.12],[.12,.12,.95]][i]};
 }).sort((a,b)=>a.depth-b.depth);
}
export function sampleGaussians(g,u,v) {
 let T=1,r=0,b=0,green=0;
 for(const p of g){let a=Math.min(.99,p.opacity*Math.exp(-.5*((u-p.u)**2/p.xx+(v-p.v)**2/p.yy)));if(a<1/255)continue;r+=T*a*p.color[0];green+=T*a*p.color[1];b+=T*a*p.color[2];T*=1-a;}
 return [r+T*.95,green+T*.96,b+T*.97];
}
export class CoAdaptationDemo {
 constructor(host,{autoplay=true}={}){
  host.className='';this.host=host;this.angle=0;this.playing=autoplay&&!matchMedia('(prefers-reduced-motion: reduce)').matches;this.dead=false;this.last=0;this.time=0;
  host.innerHTML=`<div class="coadapt-lab"><div class="coadapt-tabs" role="tablist" aria-label="Co-adaptation demo"><button role="tab" aria-selected="true" data-mode="results">01 · See the artifacts</button><button role="tab" aria-selected="false" data-mode="mechanism">02 · Why it happens</button></div><div class="coadapt-results"></div><div class="coadapt-mechanism" hidden><div class="coadapt-canvases"><div class="coadapt-world"></div><canvas class="coadapt-output" width="1000" height="480" role="img" aria-label="Linked 3D Gaussian structure and rendered camera view"></canvas></div><div class="coadapt-controls"><button data-action="play" aria-label="Pause camera motion">Ⅱ</button><button data-angle="0">Training view</button><input aria-label="Camera angle" type="range" min="0" max="40" step="1" value="0"><button data-angle="32">Novel view</button><output>0°</output></div></div></div>`;
  this.lab=host.firstElementChild;this.results=this.lab.querySelector('.coadapt-results');this.mechanism=this.lab.querySelector('.coadapt-mechanism');
  const comparisonHost=document.createElement('div');this.results.append(comparisonHost);this.comparison=new window.ComparisonDemo(comparisonHost,{autoplay});const legend=document.createElement('div');legend.className='coadapt-result-labels';legend.innerHTML='<span>3DGS</span><span>+ Gaussian dropout</span>';this.results.append(legend);
  this.lab.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.mode));
  this.lab.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{this.pause();this.setAngle(Number(b.dataset.angle));});
  this.range=this.mechanism.querySelector('input');this.range.oninput=()=>{this.pause();this.setAngle(Number(this.range.value));};
  this.play=this.lab.querySelector('[data-action="play"]');this.play.onclick=()=>{this.playing=!this.playing;this.updatePlay();};
  this.mode='results';
  const tabs=[...this.lab.querySelectorAll('[role=tab]')];
  tabs.forEach((tab,i)=>{
   const panel=i===0?this.results:this.mechanism;
   tab.id=`artifact-tab-${i}`;tab.setAttribute('aria-controls',`artifact-panel-${i}`);tab.tabIndex=i===0?0:-1;
   panel.id=`artifact-panel-${i}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);
   tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight'||event.key==='ArrowLeft')next=1-i;else if(event.key==='Home')next=0;else if(event.key==='End')next=1;else return;event.preventDefault();this.setMode(tabs[next].dataset.mode);tabs[next].focus();});
  });
 }
 setMode(mode){
  const caption=document.querySelector('#artifact-caption');if(caption)caption.textContent=mode==='results'?'Watch the region inside the dashed outline for color artifacts as you drag the divider.':'In the training view, overlapping Gaussians blend to gray. In a novel view, their overlap changes, revealing color errors.';this.mode=mode;this.results.hidden=mode!=='results';this.mechanism.hidden=mode!=='mechanism';
  this.lab.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.mode===mode));b.tabIndex=b.dataset.mode===mode?0:-1;});
  if(mode==='mechanism'&&!this.renderer&&!this.unavailable){try{this.initScene();}catch(e){this.unavailable=true;this.mechanism.innerHTML='<p class="coadapt-unavailable">The 3D illustration requires WebGL. You can still view the scene comparison.</p>';}}
  if(this.comparison?.video){mode==='results'&&this.playing?this.comparison.video.play().catch(()=>{}):this.comparison.video.pause();}
  this.onModeChange?.(mode);this.last=0;
 }
 pause(){this.playing=false;this.updatePlay();}
 updatePlay(){this.play.textContent=this.playing?'Ⅱ':'▶';this.play.setAttribute('aria-label',this.playing?'Pause camera motion':'Play camera motion');}
 setAngle(a){this.angle=a;this.range.value=String(Math.round(a));this.lab.querySelector('output').textContent=`${Math.round(a)}°`;this.draw();}
 initScene(){
  this.canvas=this.lab.querySelector('.coadapt-output');this.ctx=this.canvas.getContext('2d');this.worldHost=this.lab.querySelector('.coadapt-world');
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#f5f7fa');
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.worldHost.append(this.renderer.domElement);
  this.observerCamera=new THREE.PerspectiveCamera(32,1,.1,60);this.observerCamera.position.set(7,5,-6.5);this.observerCamera.lookAt(0,0,-1.1);
  let grid=new THREE.GridHelper(8,16,0xd0d8e1,0xe3e8ed);grid.position.y=-.8;this.scene.add(grid);
  const colors=[0xe65b57,0x4aaf80,0x4b81dd];
  [-.95,0,.95].forEach((z,i)=>{
   const group=new THREE.Group();group.position.z=z;const scale=new THREE.Vector3(.15*(4+z)/4,.20*(4+z)/4,.32).multiplyScalar(2);
   const sphere=new THREE.SphereGeometry(1,32,20);const mesh=new THREE.Mesh(sphere,new THREE.MeshBasicMaterial({color:colors[i],transparent:true,opacity:.25,depthWrite:false}));mesh.scale.copy(scale);group.add(mesh);
   for(let axis=0;axis<3;axis++){let pts=[];for(let j=0;j<=64;j++){let p=new THREE.Vector3();let t=j/64*Math.PI*2;p.setComponent((axis+1)%3,Math.cos(t));p.setComponent((axis+2)%3,Math.sin(t));p.multiply(scale);pts.push(p);}group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:colors[i],transparent:true,opacity:.8})));}
   this.scene.add(group);
  });
  const path=[];for(let a=0;a<=40;a++){let t=a*Math.PI/180;path.push(new THREE.Vector3(-4*Math.sin(t),-.78,-4*Math.cos(t)));}
  this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(path),new THREE.LineBasicMaterial({color:0x7c8d9e})));
  this.cameraGroup=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.48,.32,.28),new THREE.MeshBasicMaterial({color:0x263b50}));body.position.z=.14;this.cameraGroup.add(body);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.11,.16,.22,16),new THREE.MeshBasicMaterial({color:0x4a6178}));lens.rotation.x=Math.PI/2;lens.position.z=-.1;this.cameraGroup.add(lens);this.scene.add(this.cameraGroup);
  this.viewCamera=new THREE.PerspectiveCamera(23.54,4/3,.3,5.5);this.scene.add(this.viewCamera);
  this.helper=new THREE.CameraHelper(this.viewCamera);this.helper.material.transparent=true;this.helper.material.opacity=.22;this.scene.add(this.helper);
  this.axisLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineDashedMaterial({color:0x7c8d9e,dashSize:.10,gapSize:.07}));this.scene.add(this.axisLine);
  this.raster=document.createElement('canvas');this.raster.width=300;this.raster.height=225;this.rasterCtx=this.raster.getContext('2d');
  this.resize=new ResizeObserver(()=>{const r=this.worldHost.getBoundingClientRect();if(r.width&&r.height){this.renderer.setSize(r.width,r.height,false);this.observerCamera.aspect=r.width/r.height;this.observerCamera.updateProjectionMatrix();this.draw();}});this.resize.observe(this.worldHost);
  let dragX=null,dragAngle=0;this.worldHost.onpointerdown=e=>{this.pause();dragX=e.clientX;dragAngle=this.angle;this.worldHost.setPointerCapture(e.pointerId);};this.worldHost.onpointermove=e=>{if(dragX!==null)this.setAngle(Math.max(0,Math.min(40,dragAngle+(e.clientX-dragX)*.2)));};this.worldHost.onpointerup=this.worldHost.onpointercancel=()=>{dragX=null;};this.updatePlay();this.draw();
  const tick=t=>{if(this.dead)return;this.raf=requestAnimationFrame(tick);if(this.mode!=='mechanism'||this.inView===false||document.hidden){this.last=0;return;}if(t-this.last<70)return;const dt=this.last?(t-this.last)/1000:0;this.last=t;if(!this.playing)return;this.time=(this.time+dt)%12;const p=this.time;const a=p<2?0:p<5?32*(.5-.5*Math.cos((p-2)/3*Math.PI)):p<8?32:p<11?32*(.5+.5*Math.cos((p-8)/3*Math.PI)):0;this.setAngle(a);};this.raf=requestAnimationFrame(tick);
 }
 draw(){
  if(!this.renderer||this.dead)return;const t=this.angle*Math.PI/180,eye=new THREE.Vector3(-4*Math.sin(t),0,-4*Math.cos(t));
  this.cameraGroup.position.copy(eye);this.cameraGroup.lookAt(eye.clone().multiplyScalar(2));this.viewCamera.position.copy(eye);this.viewCamera.lookAt(0,0,0);this.viewCamera.updateMatrixWorld();this.helper.update();
  this.axisLine.geometry.setFromPoints([eye,new THREE.Vector3(0,0,.95)]);this.axisLine.computeLineDistances();this.renderer.render(this.scene,this.observerCamera);
  const ctx=this.ctx;const mobile=this.host.clientWidth<600;this.canvas.width=mobile?560:1000;this.canvas.height=mobile?880:480;const ox=mobile?80:568,oy=mobile?500:90;ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.fillStyle='#20364c';ctx.font='600 21px system-ui';ctx.fillText('01  Three fixed Gaussians',26,35);ctx.fillText('02  Rendered camera view',ox,mobile?450:35);
  ctx.font='15px system-ui';ctx.fillStyle='#697b8b';ctx.fillText('Fixed positions · fixed colors',26,59);ctx.fillText(this.angle<3?'Training view · colors blend':'Novel view · projections separate',ox,mobile?477:59);
  const g=projectGaussians(this.angle),im=this.rasterCtx.createImageData(300,225);for(let y=0;y<225;y++)for(let x=0;x<300;x++){const rgb=sampleGaussians(g,(x-149.5)/135,(112-y)/135);const k=(y*300+x)*4;for(let c=0;c<3;c++)im.data[k+c]=Math.round(rgb[c]*255);im.data[k+3]=255;}this.rasterCtx.putImageData(im,0,0);
  ctx.drawImage(this.raster,ox,oy,400,300);ctx.strokeStyle='#d7e0e8';ctx.lineWidth=1;ctx.strokeRect(ox+.5,oy+.5,399,299);
  ctx.strokeStyle='#34485d';ctx.lineWidth=1.5;ctx.strokeRect(ox+192,oy+142,16,16);
  const col=sampleGaussians(g,0,0);ctx.fillStyle=`rgb(${col.map(v=>Math.round(v*255)).join(',')})`;ctx.fillRect(ox+1,oy+321,26,26);ctx.font='16px system-ui';ctx.fillStyle='#41566b';ctx.fillText(this.angle<3?'Center pixel: neutral gray':'Center pixel: color imbalance',ox+39,oy+340);
  ctx.fillStyle='#41566b';ctx.font='15px system-ui';ctx.fillText('Drag here or move the slider to change the view',26,mobile?407:430);
  ctx.font='12px system-ui';ctx.fillStyle='#8b98a5';ctx.fillText('Illustrative example · perspective projection + alpha compositing',26,mobile?869:467);
 }
 destroy(){this.dead=true;cancelAnimationFrame(this.raf);this.resize?.disconnect();this.comparison?.destroy();if(this.scene)this.scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer?.dispose();this.host.innerHTML='';}
}
