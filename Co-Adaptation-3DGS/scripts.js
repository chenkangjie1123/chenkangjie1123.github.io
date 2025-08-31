function playMergeVid3(vid, canvas) {
  // 三联拼接：同一帧里横向 [左 | 中 | 右]
  const labels = [...canvas.parentElement.querySelectorAll('.video-label > span')]; // 期望 3 个
  const borderThickness = 4;

  let position1 = 0.33; // 第一条分界（相对画布宽度 0..1）
  let position2 = 0.66; // 第二条分界（相对画布宽度 0..1）
  let bcr = canvas.getBoundingClientRect();

  const ctx = canvas.getContext('2d');
  const Wfull = vid.videoWidth;
  const H = vid.videoHeight;
  const W = Wfull / 3; // 单段宽度（画布宽）

  canvas.width = W;
  canvas.height = H;
  canvas.style.aspectRatio = `${W}/${H}`;

  function clamp(v, lo, hi){ return Math.min(Math.max(v, lo), hi); }

  function updateCaptionMasks() {
    if (labels.length >= 3) {
      // 第1段：可见 [0, position1)
      labels[0].style.clipPath = `xywh(0 0 ${bcr.width*position1 - borderThickness/2}px 100%)`;
      // 第2段：可见 [position1, position2)
      const p1px = bcr.width * position1;
      const p2px = bcr.width * position2;
      labels[1].style.clipPath = `inset(0 ${Math.max(0, bcr.width - p2px) }px 0 ${Math.max(0, p1px) }px)`;
      // 第3段：可见 [position2, W]
      labels[2].style.clipPath = `inset(0 0 0 ${Math.max(0, bcr.width*position2) }px)`;
    }
  }

  function draw() {
    // 先画左段（整段）
    ctx.drawImage(vid, 0, 0, W, H, 0, 0, W, H);

    // 叠加中段：从 position1 开始
    const col1 = clamp(W * position1, 0, W);
    const w1   = clamp(W - col1, 0, W);
    if (w1 > 0) {
      // 源取自中段（第2段）：[W + col1, 0, w1, H] → 目标 [col1, 0, w1, H]
      ctx.drawImage(vid, W + col1, 0, w1, H, col1, 0, w1, H);
    }

    // 叠加右段：从 position2 开始
    const col2 = clamp(W * position2, 0, W);
    const w2   = clamp(W - col2, 0, W);
    if (w2 > 0) {
      // 源取自右段（第3段）：[2W + col2, 0, w2, H] → 目标 [col2, 0, w2, H]
      ctx.drawImage(vid, 2*W + col2, 0, w2, H, col2, 0, w2, H);
    }

    // --- 可视化：两条分界线 + 圆点 + 双向箭头 ---
    ctx.save();
    ctx.strokeStyle = "#444444";
    ctx.fillStyle = "#444444";
    ctx.lineWidth = 5;

    const arrowLength = 0.09 * H;
    const arrowheadW  = 0.025 * H;
    const arrowheadL  = 0.04 * H;
    const arrowY      = H / 10;
    const arrowW      = 0.007 * H;

    function drawDividerAt(px) {
      // 圆圈
      ctx.beginPath();
      ctx.arc(px, arrowY, arrowLength*0.7, 0, Math.PI*2);
      ctx.fillStyle = "#FFD79340";
      ctx.fill();

      // 竖线
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();

      // 箭头（左右）
      ctx.beginPath();
      ctx.moveTo(px, arrowY - arrowW/2);
      ctx.lineTo(px + arrowLength/2 - arrowheadL/2, arrowY - arrowW/2);
      ctx.lineTo(px + arrowLength/2 - arrowheadL/2, arrowY - arrowheadW/2);
      ctx.lineTo(px + arrowLength/2, arrowY);
      ctx.lineTo(px + arrowLength/2 - arrowheadL/2, arrowY + arrowheadW/2);
      ctx.lineTo(px + arrowLength/2 - arrowheadL/2, arrowY + arrowW/2);
      ctx.lineTo(px - arrowLength/2 + arrowheadL/2, arrowY + arrowW/2);
      ctx.lineTo(px - arrowLength/2 + arrowheadL/2, arrowY + arrowheadW/2);
      ctx.lineTo(px - arrowLength/2, arrowY);
      ctx.lineTo(px - arrowLength/2 + arrowheadL/2, arrowY - arrowheadW/2);
      ctx.lineTo(px - arrowLength/2 + arrowheadL/2, arrowY);
      ctx.lineTo(px - arrowLength/2 + arrowheadL/2, arrowY - arrowW/2);
      ctx.lineTo(px, arrowY - arrowW/2);
      ctx.closePath();
      ctx.fillStyle = "#444444";
      ctx.fill();
    }

    drawDividerAt(W * position1);
    drawDividerAt(W * position2);

    ctx.restore();

    requestAnimationFrame(draw);
  }

  function pickHandle(px) {
    // 返回更近的分界 (1 或 2)
    const x = clamp(px, 0, W);
    const d1 = Math.abs(x - W*position1);
    const d2 = Math.abs(x - W*position2);
    return d1 <= d2 ? 1 : 2;
  }

  function moveHandle(which, xpx) {
    const x = clamp(xpx, 0, W);
    if (which === 1) {
      // 保证 p1 ≤ p2
      position1 = Math.min(x / W, position2);
    } else {
      position2 = Math.max(x / W, position1);
    }
    bcr = canvas.getBoundingClientRect();
    updateCaptionMasks();
  }

  // 事件
  let dragging = 0; // 0:无, 1:拖p1, 2:拖p2
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    dragging = pickHandle(e.clientX - r.left);
    moveHandle(dragging, e.clientX - r.left);
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const r = canvas.getBoundingClientRect();
    moveHandle(dragging, e.clientX - r.left);
  });
  window.addEventListener('mouseup', () => dragging = 0);

  // 触摸
  canvas.addEventListener('touchstart', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - r.left;
    dragging = pickHandle(x);
    moveHandle(dragging, x);
  }, {passive:true});
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const r = canvas.getBoundingClientRect();
    moveHandle(dragging, e.touches[0].clientX - r.left);
  }, {passive:true});
  canvas.addEventListener('touchend', () => dragging = 0);

  // 初始遮罩并启动
  updateCaptionMasks();
  if (vid.readyState > 3) vid.play();
  requestAnimationFrame(draw);
}

// ========= 初始化里加一个分支，数据属性 data-merge="3" 用三联 =========
function ondocumentready() {
  [...document.querySelectorAll('video.video-compare')].forEach(element => {
    function loadeddata () {
      const canvas = document.createElement("canvas");
      element.parentNode.insertBefore(canvas, element.nextSibling);
      element.height = 0;
      element.style.position = "absolute";
      canvas.classList.add("video-compare");

      const isTri = element.getAttribute('data-merge') === '3';
      if (isTri) {
        // 三联：画布宽=单段宽
        canvas.style.aspectRatio = `${element.videoWidth/3}/${element.videoHeight}`;
        canvas.width  = element.videoWidth/3;
        canvas.height = element.videoHeight;
      } else {
        // 双联（原逻辑）
        canvas.style.aspectRatio = `${element.videoWidth/2}/${element.videoHeight}`;
        canvas.width  = element.videoWidth/2;
        canvas.height = element.videoHeight;
      }

      element.play();
      if (isTri) playMergeVid3(element, canvas);
      else       playMergeVid(element, canvas); // 你现有的双联函数
    }
    if (element.readyState > 3) loadeddata();
    else element.addEventListener("loadeddata", loadeddata);
  });

  [...document.querySelectorAll('input[data-control-video]')].forEach(element => {
    const video = document.getElementById(element.getAttribute("data-control-video"));
    const sliderImagesRoot = document.getElementById(element.getAttribute("data-control-slider-images"));
    element.addEventListener("input", function() { 
      const value = Math.min(100, Math.max(0, element.value));
      const slice = video.duration * value / 100;
      video.currentTime = ""+slice;
      // Apply color to active borders
      if (sliderImagesRoot) {
        const el1 = Math.min(Math.floor(value / 100 * (sliderImagesRoot.children.length-1)), sliderImagesRoot.children.length-2);
        const offset = (sliderImagesRoot.children.length-1)*value/100 - el1;
        for (var i = 0; i < sliderImagesRoot.children.length; i++) {
          sliderImagesRoot.children[i].style.setProperty("--active-weight", "0%");
          if (i === el1) {
            sliderImagesRoot.children[i].style.setProperty("--active-weight", `${100*(1-offset)}%`);
          }
          if (i === el1+1) {
            sliderImagesRoot.children[i].style.setProperty("--active-weight", `${100*offset}%`);
          }
        }
      }
    });

  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ondocumentready);
} else {
  ondocumentready();
}
