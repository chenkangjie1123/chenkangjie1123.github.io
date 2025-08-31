/** 工具：事件坐标映射到 canvas 像素坐标 */
function eventXOnCanvas(canvas, e) {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const clientX = ('touches' in e) ? e.touches[0].clientX : e.clientX;
  return (clientX - r.left) * scaleX;
}

/** 双联：从同一帧的左半与右半做对比 */
function playMergeVid(vid, canvas) {
  const labelsFirst = [...canvas.parentElement.querySelectorAll('.video-label > :first-child')];
  const labelsLast  = [...canvas.parentElement.querySelectorAll('.video-label > :last-child')];
  const borderThickness = 4;

  const ctx = canvas.getContext("2d");
  const H = vid.videoHeight;
  const W = vid.videoWidth / 2;       // 单段宽

  canvas.width = W;
  canvas.height = H;
  canvas.style.aspectRatio = `${W}/${H}`;

  let position = 0.5;                  // 0..1
  let bcr = canvas.getBoundingClientRect();
  const HIT_RADIUS = Math.max(14, Math.round(canvas.width * 0.02));
  const SNAP = Math.max(8, Math.round(canvas.width * 0.01));

  function clamp(v, a, b){ return Math.min(Math.max(v,a), b); }

  function updateCaptionMasks() {
    if (labelsFirst) {
      for (let el of labelsFirst) {
        el.style.clipPath = `xywh(0 0 ${bcr.width*position - borderThickness/2}px 100%)`;
      }
    }
    if (labelsLast) {
      for (let el of labelsLast) {
        el.style.clipPath = `inset(0 0 0 calc(100% - ${bcr.width*(1-position) - borderThickness/2}px))`;
      }
    }
  }

  function draw() {
    // 左段（底）
    ctx.drawImage(vid, 0, 0, W, H, 0, 0, W, H);

    // 右段从 position 开始覆盖
    const x = clamp(W * position, 0, W);
    const ww = clamp(W - x, 0, W);
    if (ww > 0) {
      ctx.drawImage(vid, W + x, 0, ww, H, x, 0, ww, H);
    }

    // 视觉元素：分割线与圆点+箭头
    const arrowY = H / 10;
    const r = 0.063 * H;
    ctx.save();
    // 圆
    ctx.beginPath();
    ctx.arc(x, arrowY, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD79340";
    ctx.fill();
    // 竖线
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#444";
    ctx.stroke();
    ctx.restore();

    requestAnimationFrame(draw);
  }

  function pickHandle(px){
    const d = Math.abs(px - position*W);
    return d <= HIT_RADIUS ? 1 : 0;
  }

  function moveHandle(px){
    let x = clamp(px, 0, W);
    if (Math.abs(x - 0) <= SNAP) x = 0;
    if (Math.abs(x - W) <= SNAP) x = W;
    position = x / W;
    bcr = canvas.getBoundingClientRect();
    updateCaptionMasks();
  }

  // 悬停改变光标
  canvas.addEventListener('mousemove', (e) => {
    const x = eventXOnCanvas(canvas, e);
    canvas.style.cursor = pickHandle(x) ? 'col-resize' : 'default';
  });

  // 鼠标拖拽
  let dragging = 0;
  canvas.addEventListener('mousedown', (e) => {
    const x = eventXOnCanvas(canvas, e);
    dragging = pickHandle(x);
    if (dragging) moveHandle(x);
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = eventXOnCanvas(canvas, e);
    moveHandle(x);
  });
  window.addEventListener('mouseup', () => dragging = 0);

  // 触摸拖拽
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const x = eventXOnCanvas(canvas, e);
    dragging = pickHandle(x);
    if (dragging) moveHandle(x);
  }, {passive:false});
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const x = eventXOnCanvas(canvas, e);
    moveHandle(x);
  }, {passive:false});
  canvas.addEventListener('touchend', () => dragging = 0);

  // 启动
  updateCaptionMasks();
  if (vid.readyState > 3) vid.play();
  requestAnimationFrame(draw);
}

/** 三联：同一帧里横向 [左 | 中 | 右] */
function playMergeVid3(vid, canvas) {
  const labels = [...canvas.parentElement.querySelectorAll('.video-label > span')]; // 3 个
  const ctx = canvas.getContext('2d');
  const Wfull = vid.videoWidth, H = vid.videoHeight;
  const W = Wfull / 3;   // 单段宽

  canvas.width  = W;
  canvas.height = H;
  canvas.style.aspectRatio = `${W}/${H}`;

  let position1 = 0.33;  // 0..1
  let position2 = 0.66;  // 0..1
  let bcr = canvas.getBoundingClientRect();

  const HIT_RADIUS = Math.max(14, Math.round(canvas.width * 0.02));
  const SNAP = Math.max(8, Math.round(canvas.width * 0.01));

  function clamp(v, a, b){ return Math.min(Math.max(v,a), b); }

  function updateCaptionMasks() {
    if (labels.length >= 3) {
      // 左段
      labels[0].style.clipPath = `xywh(0 0 ${bcr.width*position1 - 2}px 100%)`;
      // 中段
      const p1 = bcr.width*position1, p2 = bcr.width*position2;
      labels[1].style.clipPath = `inset(0 ${Math.max(0, bcr.width - p2)}px 0 ${Math.max(0, p1)}px)`;
      // 右段
      labels[2].style.clipPath = `inset(0 0 0 ${Math.max(0, bcr.width*position2)}px)`;
    }
  }

  function draw() {
    // 左段（底）
    ctx.drawImage(vid, 0, 0, W, H, 0, 0, W, H);

    // 中段从 position1 开始覆盖
    const x1 = clamp(W*position1, 0, W), w1 = clamp(W - x1, 0, W);
    if (w1 > 0) ctx.drawImage(vid, W + x1, 0, w1, H, x1, 0, w1, H);

    // 右段从 position2 开始覆盖
    const x2 = clamp(W*position2, 0, W), w2 = clamp(W - x2, 0, W);
    if (w2 > 0) ctx.drawImage(vid, 2*W + x2, 0, w2, H, x2, 0, w2, H);

    // 两条分界线 + 圆
    const arrowY = H/10, r = 0.063*H;
    ctx.save();
    ctx.lineWidth = 5; ctx.strokeStyle = '#444';

    // p1
    ctx.beginPath();
    ctx.arc(x1, arrowY, r, 0, Math.PI*2);
    ctx.fillStyle = "#FFD79340";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke();

    // p2
    ctx.beginPath();
    ctx.arc(x2, arrowY, r, 0, Math.PI*2);
    ctx.fillStyle = "#FFD79340";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x2, 0); ctx.lineTo(x2, H); ctx.stroke();

    ctx.restore();

    requestAnimationFrame(draw);
  }

  function pickHandleByX(px){
    const d1 = Math.abs(px - W*position1);
    const d2 = Math.abs(px - W*position2);
    if (d1 < d2 && d1 <= HIT_RADIUS) return 1;
    if (d2 <= HIT_RADIUS) return 2;
    return 0;
  }

  function moveHandle(which, px){
    const x = clamp(px, 0, W);
    let xSnap = x;
    if (which === 1) {
      // 吸附到 0 或 p2
      if (Math.abs(x - 0) <= SNAP) xSnap = 0;
      if (Math.abs(x - W*position2) <= SNAP) xSnap = W*position2;
      position1 = Math.min(xSnap / W, position2);
    } else {
      // 吸附到 1 或 p1
      if (Math.abs(x - W) <= SNAP) xSnap = W;
      if (Math.abs(x - W*position1) <= SNAP) xSnap = W*position1;
      position2 = Math.max(xSnap / W, position1);
    }
    bcr = canvas.getBoundingClientRect();
    updateCaptionMasks();
  }

  // 悬停光标
  canvas.addEventListener('mousemove', (e) => {
    const x = eventXOnCanvas(canvas, e);
    const which = pickHandleByX(x);
    canvas.style.cursor = which ? 'col-resize' : 'default';
  });

  // 鼠标拖拽
  let dragging = 0;
  canvas.addEventListener('mousedown', (e) => {
    const x = eventXOnCanvas(canvas, e);
    dragging = pickHandleByX(x);
    if (dragging) moveHandle(dragging, x);
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const x = eventXOnCanvas(canvas, e);
    moveHandle(dragging, x);
  });
  window.addEventListener('mouseup', () => dragging = 0);

  // 触摸拖拽（阻止滚动）
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const x = eventXOnCanvas(canvas, e);
    dragging = pickHandleByX(x);
    if (dragging) moveHandle(dragging, x);
  }, {passive:false});
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    const x = eventXOnCanvas(canvas, e);
    moveHandle(dragging, x);
  }, {passive:false});
  canvas.addEventListener('touchend', () => dragging = 0);

  // 启动
  updateCaptionMasks();
  if (vid.readyState > 3) vid.play();
  requestAnimationFrame(draw);
}

/** 初始化：把 <video.video-compare> 替换为 canvas 并启动对应模式 */
function ondocumentready() {
  [...document.querySelectorAll('video.video-compare')].forEach(element => {
    function loadeddata () {
      const canvas = document.createElement("canvas");
      element.parentNode.insertBefore(canvas, element.nextSibling);
      element.height = 0;
      element.style.position = "absolute";
      canvas.classList.add("video-compare");

      const isTri = element.getAttribute('data-merge') === '3';
      // 先给一个大概的画布尺寸，真正的宽高会在对应函数里设置
      canvas.style.aspectRatio = isTri
        ? `${element.videoWidth/3}/${element.videoHeight}`
        : `${element.videoWidth/2}/${element.videoHeight}`;

      element.play();
      if (isTri) playMergeVid3(element, canvas);
      else       playMergeVid(element, canvas);
    }

    if (element.readyState > 3) loadeddata();
    else element.addEventListener("loadeddata", loadeddata);
  });

  // 可选：保持你原来的 slider 控制逻辑（略）
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ondocumentready);
} else {
  ondocumentready();
}
