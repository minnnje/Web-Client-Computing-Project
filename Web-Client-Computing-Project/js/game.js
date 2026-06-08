// ===== Wave Rider — Surf Avoidance Game =====
// 전체 코드를 즉시 실행 함수(IIFE)로 감싸 전역 변수 오염을 방지한다.
(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // 논리 좌표계 크기 — 실제 픽셀과 무관하게 항상 이 단위로 좌표를 계산한다.
  const CANVAS_W = 480;
  const CANVAS_H = 720;
  // 논리 좌표 → 실제 픽셀 비율 (resizeCanvasBacking에서 갱신)
  let renderScale = 1;
  // 레티나/고해상도 화면에서 최소 2배 오버샘플링해 텍스처를 선명하게 유지한다.
  const OVERSAMPLE = 2;

  // ===== Canvas Resize =====
  // CSS 크기가 바뀔 때마다 실제 픽셀 버퍼를 DPR에 맞춰 재설정한다.
  // canvas.width/height = 실제 픽셀, canvas.clientWidth/Height = CSS 크기(논리 픽셀).
  function resizeCanvasBacking() {
    const dpr = Math.max(OVERSAMPLE, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const newW = Math.max(1, Math.round(w * dpr));
    const newH = Math.max(1, Math.round(h * dpr));
    // 크기가 실제로 바뀔 때만 재할당 (불필요한 버퍼 초기화 방지)
    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
    }
    renderScale = canvas.width / CANVAS_W;
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }

  // 매 프레임 draw 전에 호출해 논리 좌표계를 실제 픽셀로 스케일링한다.
  function applyRenderTransform() {
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  }

  // 게임 루프가 멈춰 있을 때(일시정지·게임오버 후) 리사이즈 이벤트가 오면 현재 화면을 다시 그린다.
  function redrawCurrentScene() {
    if (!game) return;
    if (game.paused) return;
    applyRenderTransform();
    if (game.over) {
      drawBackground();
      drawParticles();
      drawPopups();
      drawGameOver();
    } else if (!game.running) {
      drawStartScreen();
    }
  }

  function scheduleResize() {
    resizeCanvasBacking();
    redrawCurrentScene();
  }

  window.addEventListener('resize', scheduleResize);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(scheduleResize);
    ro.observe(canvas);
  }

  // ===== UI =====
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const canvasWrap = document.getElementById('canvasWrap');

  // ===== Persistence =====
  // localStorage 키 이름 — 게임 종료 시 최고 점수를 여기에 저장/불러온다.
  const BEST_KEY = 'waveRiderBestScore';
  let bestScore = 0;
  try {
    // 시크릿 모드 등 localStorage 접근이 막힐 수 있으므로 try-catch로 감싼다.
    const saved = window.localStorage?.getItem(BEST_KEY);
    if (saved) bestScore = parseInt(saved, 10) || 0;
  } catch (_) {}

  // ===== Beach Guide / Stamp System =====
  // 획득한 스탬프 ID 배열을 localStorage에 보관한다.
  const STAMP_KEY = 'waveRiderStamps';
  let obtainedStamps = []; // 획득한 해변 ID 목록 (예: [1, 3, 5])

  const BEACH_DATA = [
    { id: 1, img: 'images/양양 서피비치.jpg', name: '양양 서피비치',       location: '강원도 양양군',  emoji: '🏄', color: '#1abc9c', desc: '국내 서핑의 성지. 연중 서퍼들이 찾아오는 강원도 대표 서핑 스팟.',        level: '초급~고급', season: '여름~가을' },
    { id: 2, img: 'images/제주 중문 해수욕장.jpg',name: '제주 중문 해수욕장',  location: '제주 서귀포시',  emoji: '🌊', color: '#3498db', desc: '제주도 남쪽의 웅장한 파도. 제주 서핑의 메카로 불리는 고급 스팟.',    level: '중급~고급', season: '가을~겨울' },
    { id: 3, img: 'images/부산 송정 해수욕장.jpg', name: '부산 송정 해수욕장',  location: '부산 기장군',    emoji: '🐠', color: '#e74c3c', desc: '도심에서 가까운 부산의 대표 서핑 해변. 완만한 파도로 초보에게 인기.', level: '초급~중급', season: '봄~가을'   },
    { id: 4, img: 'images/강릉 경포 해수욕장.jpg',name: '강릉 경포 해수욕장',  location: '강원도 강릉시',  emoji: '🌅', color: '#f39c12', desc: '드라마 배경으로 유명한 강원도의 아름다운 해변.',                      level: '초급',      season: '여름'     },
    { id: 5, img: 'images/고성 봉포 해수욕장.jpg',name: '고성 봉포 해수욕장',  location: '강원도 고성군',  emoji: '🦀', color: '#9b59b6', desc: '한적하고 깨끗한 동해안 북쪽의 숨은 서핑 명소.',                      level: '초급~중급', season: '여름'     },
    { id: 6, img: 'images/제주 협재 해수욕장.jpg',name: '제주 협재 해수욕장',  location: '제주 한림읍',    emoji: '🏖️', color: '#00d2ff', desc: '에메랄드빛 바다와 비양도가 보이는 제주 서쪽 감성 서핑 스팟.',       level: '초급~중급', season: '봄~여름'  },
    { id: 7, img: 'images/태안 만리포 해수욕장.jpg',name: '태안 만리포 해수욕장',location: '충남 태안군',    emoji: '⛵', color: '#e67e22', desc: '서해안 최고의 해수욕장. 독특한 서해 파도의 숨은 서핑 명소.',          level: '중급',      season: '여름~가을' },
  ];

  function loadStamps() {
    try {
      const raw = window.localStorage?.getItem(STAMP_KEY);
      if (raw) obtainedStamps = JSON.parse(raw) || [];
    } catch (_) {}
    renderBeachGuide();
  }

  function saveStamps() {
    try { window.localStorage?.setItem(STAMP_KEY, JSON.stringify(obtainedStamps)); } catch (_) {}
  }

  function collectStamp(beachId) {
    if (obtainedStamps.includes(beachId)) return false;
    const beach = BEACH_DATA.find(b => b.id === beachId);
    if (!beach) return false;
    obtainedStamps.push(beach.id);
    saveStamps();
    renderBeachGuide();
    showStampToast(beach);
    return true;
  }

  function showStampToast(beach) {
    const toast = document.getElementById('stampToast');
    if (!toast) return;
    toast.innerHTML =
      `<span class="stamp-toast-emoji">${beach.emoji}</span>` +
      `<div class="stamp-toast-body">` +
        `<div class="stamp-toast-label">스탬프 획득 #${beach.id}</div>` +
        `<div class="stamp-toast-name">${beach.name}</div>` +
        `<button class="stamp-toast-scroll" onclick="document.getElementById('beachGuideSection').scrollIntoView({behavior:'smooth'})">도감 보기 ↓</button>` +
      `</div>`;
    toast.classList.add('stamp-toast--show');
    clearTimeout(toast._tid);
    toast._tid = setTimeout(() => toast.classList.remove('stamp-toast--show'), 3500);
  }

  function renderBeachGuide() { // 해변 도감 
    const grid = document.getElementById('beachGuideGrid');
    const counter = document.getElementById('stampCounter');
    if (!grid) return;
    if (counter) counter.textContent = `${obtainedStamps.length} / 7`;
    grid.innerHTML = BEACH_DATA.map(b => {
      if (obtainedStamps.includes(b.id)) {
        return `<div class="beach-card beach-card--unlocked" style="--card-color:${b.color}">
          <div class="beach-card-num">STAMP #${b.id}</div>
          <div class="beach-card-image">
            <img class="beach-img" src="${b.img}" alt="${b.name}">
          </div>
          <div class="beach-card-name">${b.name} ${b.emoji}</div>
          <div class="beach-card-location">${b.location}</div>
          <p class="beach-card-desc">${b.desc}</p>
          <div class="beach-card-meta">
            <span>난이도: ${b.level}</span>
            <span>최적 계절: ${b.season}</span>
          </div>
        </div>`;
      }
      return `<div class="beach-card beach-card--locked">
        <div class="beach-card-lock">🔒</div>
        <div class="beach-card-locked-num">STAMP #${b.id}</div>
        <div class="beach-card-locked-hint">스탬프로 해금</div>
      </div>`;
    }).join('');
  }

  // ===== Game State =====
  // 매 게임 시작마다 initState()로 초기화되는 전역 상태 변수들
  let game, surfer, islands, pickups, particles, popups, foamLines;
  let screenShake, damageFlash;

  function initState() {
    game = {
      running: false,   // 게임이 진행 중인지
      over: false,      // 게임 오버 상태인지
      paused: false,    // 일시정지 상태인지
      score: 0,
      level: 1,
      lives: 3,
      maxLives: 3,
      baseSpeed: 2.8,   // 장애물 낙하 기본 속도 (레벨 업 시 증가)
      spawnTimer: 0,    // 장애물 스폰 간격 카운터
      pickupTimer: 0,   // 하트 아이템 스폰 카운터
      stampTimer: 0,    // 스탬프 아이템 스폰 카운터
      animId: null,     // requestAnimationFrame ID (일시정지/취소에 사용)
      time: 0,          // 총 프레임 수 (애니메이션 타이밍 기준)
      newBest: false,   // 이번 게임에서 최고 점수를 경신했는지
    };

    surfer = {
      x: CANVAS_W / 2,
      y: CANVAS_H * 0.78,
      w: 44,
      h: 64,
      maxSpeed: 7.5,
      accel: 1.05,
      friction: 0.8,    // 키를 놓으면 속도가 이 비율로 감속된다 (0~1)
      vx: 0,
      vy: 0,
      moveUp: false,
      moveDown: false,
      moveLeft: false,
      moveRight: false,
      invuln: 0,        // 무적 프레임 수 (충돌 후 100프레임 동안 재피해 방지)
      bob: 0,           // 파도 위 상하 흔들림 애니메이션 각도 (sin 입력값)
      tilt: 0,          // 좌우 이동 속도에 따른 기울기 (vx 기반)
    };

    islands = [];
    pickups = [];
    particles = [];
    popups = [];
    screenShake = 0;
    damageFlash = 0;

    // 배경에 흐르는 흰 거품 줄기 18개 — 바다 느낌을 살리는 장식 효과
    foamLines = Array.from({ length: 18 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      len: 14 + Math.random() * 32,
      speed: 1 + Math.random() * 2.4,
      alpha: 0.08 + Math.random() * 0.18,
      thickness: 1 + Math.random() * 1.5,
    }));
  }

  // ===== Input =====
  const keys = {}; // 현재 눌린 키 상태를 저장 (keydown/keyup으로 갱신)
  // 게임 중 페이지 스크롤을 막아야 할 키 목록
  const GAME_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'p', 'escape'];

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    // 게임 실행 중에는 방향키가 페이지를 스크롤하지 않도록 기본 동작을 막는다.
    if (GAME_KEYS.includes(k) && game?.running) e.preventDefault();
    if (keys[k]) return;
    keys[k] = true;
    if (k === 'arrowup'    || k === 'w') surfer.moveUp    = true;
    if (k === 'arrowdown'  || k === 's') surfer.moveDown  = true;
    if (k === 'arrowleft'  || k === 'a') surfer.moveLeft  = true;
    if (k === 'arrowright' || k === 'd') surfer.moveRight = true;
    if (k === 'p') togglePause();
    if (k === 'escape') { exitFullscreenIfNeeded(); pauseGame(); }
  });

  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    keys[k] = false;
    if (k === 'arrowup'    || k === 'w') surfer.moveUp    = false;
    if (k === 'arrowdown'  || k === 's') surfer.moveDown  = false;
    if (k === 'arrowleft'  || k === 'a') surfer.moveLeft  = false;
    if (k === 'arrowright' || k === 'd') surfer.moveRight = false;
  });

  // Touch / pointer drag — surfer follows finger
  let dragging = false;
  // 터치 시작 시 손가락 위치와 서퍼 위치의 차이를 저장 — 서퍼가 손가락에 붙어 이동하게 한다.
  const dragOffset = { x: 0, y: 0 };

  // 화면 좌표(clientX/Y)를 논리 캔버스 좌표로 변환한다.
  function canvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_W / rect.width),
      y: (clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  }

  function pointerDown(e) {
    if (!game?.running || game.paused) return;
    const t = e.touches?.[0] ?? e;
    const p = canvasCoords(t.clientX, t.clientY);
    dragging = true;
    // 오프셋을 ±40으로 제한해 터치 위치가 서퍼에서 너무 멀어도 갑작스럽게 이동하지 않는다.
    dragOffset.x = Math.max(-40, Math.min(40, surfer.x - p.x));
    dragOffset.y = Math.max(-40, Math.min(40, surfer.y - p.y));
    if (e.cancelable) e.preventDefault();
  }

  function pointerMove(e) {
    if (!dragging) return;
    const t = e.touches?.[0] ?? e;
    const p = canvasCoords(t.clientX, t.clientY);
    const tx = p.x + dragOffset.x;
    const ty = p.y + dragOffset.y;
    // vx/vy를 목표 위치 기반으로 설정해 키보드 입력 로직(updateSurfer)과 호환되게 한다.
    surfer.vx = (tx - surfer.x) * 0.5;
    surfer.vy = (ty - surfer.y) * 0.5;
    surfer.x = tx;
    surfer.y = ty;
    clampSurfer();
    if (e.cancelable) e.preventDefault();
  }

  function pointerUp() { dragging = false; }

  canvas.addEventListener('touchstart',  pointerDown, { passive: false });
  canvas.addEventListener('touchmove',   pointerMove, { passive: false });
  canvas.addEventListener('touchend',    pointerUp);
  canvas.addEventListener('touchcancel', pointerUp);
  canvas.addEventListener('mousedown',   pointerDown);
  canvas.addEventListener('mousemove',   pointerMove);
  canvas.addEventListener('mouseup',     pointerUp);
  canvas.addEventListener('mouseleave',  pointerUp);

  // ===== Drawing =====
  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0,    '#063047');
    grad.addColorStop(0.4,  '#0c4b6b');
    grad.addColorStop(0.75, '#106f7e');
    grad.addColorStop(1,    '#0b3c52');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = 'rgba(26,188,156,0.05)';
    for (let b = 0; b < 4; b++) {
      const by = ((game.time * 0.6 + b * 200) % (CANVAS_H + 100)) - 50;
      ctx.fillRect(0, by, CANVAS_W, 30);
    }

    for (const f of foamLines) {
      f.y += f.speed * (game.baseSpeed / 2.8);
      if (f.y > CANVAS_H + 20) {
        f.y = -f.len - Math.random() * 60;
        f.x = Math.random() * CANVAS_W;
        f.speed = 1 + Math.random() * 2.4;
      }
      ctx.strokeStyle = `rgba(255,255,255,${f.alpha})`;
      ctx.lineWidth = f.thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x, f.y + f.len);
      ctx.stroke();
    }
  }

  function drawSurfer() {
    surfer.bob += 0.1;
    const bob = Math.sin(surfer.bob) * 1.5;
    const targetTilt = Math.max(-0.35, Math.min(0.35, surfer.vx * 0.06));
    surfer.tilt += (targetTilt - surfer.tilt) * 0.18;

    ctx.save();
    ctx.translate(surfer.x, surfer.y + bob);
    ctx.rotate(surfer.tilt);

    // Wake trail
    const trailGrad = ctx.createLinearGradient(0, 30, 0, 80);
    trailGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
    trailGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.moveTo(-14, 28); ctx.lineTo(14, 28);
    ctx.lineTo(10, 80);  ctx.lineTo(-10, 80);
    ctx.closePath(); ctx.fill();

    // Surfboard
    ctx.fillStyle = '#f39c12';
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-1.5, -28, 3, 56);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(0, -22, 9, 8, 0, 0, Math.PI * 2); ctx.fill();

    // Surfer body
    ctx.fillStyle = '#fdd835';
    ctx.beginPath(); ctx.arc(0, -6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1abc9c';
    ctx.beginPath(); ctx.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fdd835'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 2); ctx.lineTo(-14, 8);
    ctx.moveTo(7, 2);  ctx.lineTo(14, 8);
    ctx.stroke();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-6, 12, 4, 12);
    ctx.fillRect(2, 12, 4, 12);

    // Invuln flash
    if (surfer.invuln > 0 && Math.floor(surfer.invuln / 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 36, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  function drawIsland(isle) {
    const { x, y, w, h, hasTree, treeOffX } = isle;
    const hw = w / 2;
    const hh = h * 0.42;

    // Water shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x + 5, y + 8, hw, hh * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    // Rocky base
    ctx.fillStyle = '#7d6040';
    ctx.beginPath(); ctx.ellipse(x, y + hh * 0.15, hw, hh, 0, 0, Math.PI * 2); ctx.fill();

    // Sandy surface
    ctx.fillStyle = '#c9a55a';
    ctx.beginPath(); ctx.ellipse(x, y - hh * 0.1, hw * 0.82, hh * 0.72, 0, 0, Math.PI * 2); ctx.fill();

    // Sandy highlight
    ctx.fillStyle = '#e8c97a';
    ctx.beginPath(); ctx.ellipse(x - hw * 0.18, y - hh * 0.28, hw * 0.38, hh * 0.26, -0.3, 0, Math.PI * 2); ctx.fill();

    if (hasTree) {
      const tx = x + (treeOffX ?? 0);
      const baseY = y - hh * 0.35;
      const topY  = baseY - w * 0.55;

      // Trunk
      ctx.strokeStyle = '#6b3d1e';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, baseY);
      ctx.quadraticCurveTo(tx + 4, baseY - w * 0.25, tx, topY);
      ctx.stroke();

      // Leaves
      for (let l = 0; l < 5; l++) {
        const ang = (l / 5) * Math.PI * 2;
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, topY);
        ctx.quadraticCurveTo(
          tx + Math.cos(ang) * 9,  topY + Math.sin(ang) * 5,
          tx + Math.cos(ang) * 16, topY + Math.sin(ang) * 9
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(tx, topY, 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawRock(rock) {
    const { x, y, w, h, points } = rock;

    // Water shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 9, w / 2 * 0.85, h / 2 * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rock body (dark gray polygon)
    ctx.fillStyle = '#404040';
    ctx.beginPath();
    ctx.moveTo(x + points[0].x, y + points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(x + points[i].x, y + points[i].y);
    ctx.closePath();
    ctx.fill();

    // Mid-tone layer (slight 3D effect)
    ctx.fillStyle = '#555555';
    ctx.beginPath();
    ctx.moveTo(x + points[0].x * 0.8, y + points[0].y * 0.8);
    for (let i = 1; i < points.length; i++) ctx.lineTo(x + points[i].x * 0.8, y + points[i].y * 0.8);
    ctx.closePath();
    ctx.fill();

    // Highlight (wet rock shine)
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath();
    ctx.ellipse(x - w * 0.12, y - h * 0.18, w * 0.28, h * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark outline
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + points[0].x, y + points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(x + points[i].x, y + points[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  function drawPickup(p) {
    const cx = p.x;
    const cy = p.y + Math.sin(game.time * 0.1 + p.phase) * 2;

    if (p.type === 'heart') {
      ctx.fillStyle = 'rgba(231,76,60,0.3)';
      ctx.beginPath(); ctx.arc(cx, cy, p.size / 2 + 8, 0, Math.PI * 2); ctx.fill();
      drawHeart(cx, cy, p.size);
    } else if (p.type === 'stamp') {
      const r = p.size * 0.52;

      // Outer glow
      ctx.fillStyle = 'rgba(192,57,43,0.22)';
      ctx.beginPath(); ctx.arc(cx, cy, r + 9, 0, Math.PI * 2); ctx.fill();

      // Red body
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

      // Double white ring border (stamp style)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r - 2,   0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r - 5.5, 0, Math.PI * 2); ctx.stroke();

      // "STAMP" text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(r * 0.42)}px Poppins,sans-serif`;
      ctx.fillText('STAMP', cx, cy - r * 0.12);

      // Beach ID
      ctx.font = `600 ${Math.round(r * 0.28)}px Poppins,sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(`#${p.beachId}`, cx, cy + r * 0.4);

      ctx.textBaseline = 'top';
    }
  }

  function drawHeart(cx, cy, size) {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(cx, cy + size / 3);
    ctx.bezierCurveTo(cx - size / 2, cy - size / 4,      cx - size / 2, cy - size / 1.6, cx, cy - size / 6);
    ctx.bezierCurveTo(cx + size / 2, cy - size / 1.6,    cx + size / 2, cy - size / 4,   cx, cy + size / 3);
    ctx.closePath(); ctx.fill();
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy;
      p.vy += p.gravity ?? 0;
      p.alpha -= p.fade ?? 0.03;
      p.size *= 0.97;
      if (p.alpha <= 0 || p.size <= 0.4) particles.splice(i, 1);
    }
  }

  function drawPopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.y += p.vy; p.vy *= 0.94; p.life--;
      const alpha = Math.min(1, p.life / 30);
      ctx.font = `700 ${p.size}px Poppins,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.5})`;
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color.replace('ALPHA', alpha);
      ctx.fillText(p.text, p.x, p.y);
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  // ===== Particle / Popup Helpers =====
  function spawnParticles(x, y, color, count, opts = {}) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * (opts.spread ?? 5),
        vy: (Math.random() - 0.5) * (opts.spread ?? 5),
        size: 2 + Math.random() * (opts.size ?? 3),
        alpha: 1, fade: opts.fade ?? 0.03,
        gravity: opts.gravity ?? 0,
        r, g, b,
      });
    }
  }

  function spawnPopup(text, x, y, color, size) {
    popups.push({ text, x, y, vy: -1.6, life: 50, size: size ?? 16, color: color ?? 'rgba(255,255,255,ALPHA)' });
  }

  function spawnWakeParticle() {
    particles.push({
      x: surfer.x + (Math.random() - 0.5) * 18,
      y: surfer.y + 28 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.4 + Math.random() * 1.2,
      size: 2 + Math.random() * 2,
      alpha: 0.6, fade: 0.04, gravity: 0,
      r: 255, g: 255, b: 255,
    });
  }

  // ===== Spawning =====
  function spawnIsland() {
    const sizes = [
      { w: 72, h: 58 },
      { w: 100, h: 82 },
      { w: 132, h: 106 },
    ];
    const { w, h } = sizes[Math.floor(Math.random() * sizes.length)];
    const xMin = w / 2 + 10;
    const xMax = CANVAS_W - w / 2 - 10;
    const x = tryX(xMin, xMax, w / 2 + 45, noOverlapWithStamps);
    islands.push({
      type: 'island',
      x, y: -(h + 10),
      w, h,
      vy: game.baseSpeed + Math.random() * 1.0,
      hasTree: Math.random() < 0.65,
      treeOffX: (Math.random() - 0.5) * w * 0.35,
    });
  }

  function spawnIslandFormation() {
    // 두 섬을 나란히 스폰해 그 사이 gap을 통과하도록 유도하는 패턴
    const iw = 72 + Math.random() * 36;
    // gap은 최소 105px — 서퍼(폭 44px)가 통과할 수 있도록 충분히 확보
    const gap = 105 + Math.random() * 50;
    const startX = 20 + Math.random() * Math.max(1, CANVAS_W - iw * 2 - gap - 40);
    const speed = game.baseSpeed + Math.random() * 0.6;
    const h = 62 + Math.random() * 32;

    [startX + iw / 2, startX + iw + gap + iw / 2].forEach(x => {
      islands.push({
        type: 'island',
        x, y: -(h + 10), w: iw, h, vy: speed,
        hasTree: Math.random() < 0.5,
        treeOffX: (Math.random() - 0.5) * iw * 0.3,
      });
    });
  }

  // 바위를 불규칙한 다각형으로 그리기 위해 8개 꼭짓점을 랜덤 반지름으로 생성한다.
  function generateRockPoints(w, h) {
    const count = 8;
    return Array.from({ length: count }, (_, i) => {
      const ang = (i / count) * Math.PI * 2;
      const r = 0.62 + Math.random() * 0.38; // 62~100% 반지름으로 들쭉날쭉한 모양 생성
      return { x: Math.cos(ang) * (w / 2) * r, y: Math.sin(ang) * (h / 2) * 0.58 * r };
    });
  }

  function spawnRock() {
    const sizes = [
      { w: 78, h: 58 },
      { w: 108, h: 82 },
      { w: 138, h: 104 },
    ];
    const { w, h } = sizes[Math.floor(Math.random() * sizes.length)];
    const xMin = w / 2 + 10;
    const xMax = CANVAS_W - w / 2 - 10;
    const x = tryX(xMin, xMax, w / 2 + 45, noOverlapWithStamps);
    islands.push({
      type: 'rock',
      x, y: -(h + 10),
      w, h,
      vy: game.baseSpeed + Math.random() * 1.2,
      points: generateRockPoints(w, h),
    });
  }

  // 장애물이 스탬프 아이템과 겹치지 않는지 확인한다.
  function noOverlapWithStamps(x, minDist) {
    return !pickups.some(p => p.type === 'stamp' && Math.abs(p.x - x) < minDist);
  }

  // 스탬프 아이템이 장애물(섬/바위)과 겹치지 않는지 확인한다.
  function noOverlapWithObstacles(x, minDist) {
    return !islands.some(isle => Math.abs(isle.x - x) < minDist);
  }

  // 겹치지 않는 X 좌표를 최대 tries번 시도해 반환한다.
  // 모든 시도가 실패하면 마지막 랜덤값을 그냥 사용한다.
  function tryX(min, max, minDist, checkFn, tries = 25) {
    for (let i = 0; i < tries; i++) {
      const x = min + Math.random() * (max - min);
      if (checkFn(x, minDist)) return x;
    }
    return min + Math.random() * (max - min);
  }

  function spawnPickup() {
    // Only spawn hearts for life recovery
    if (game.lives < game.maxLives) {
      pickups.push({
        type: 'heart',
        x: 30 + Math.random() * (CANVAS_W - 60), y: -30,
        size: 30, vy: game.baseSpeed * 0.65, phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnStampPickup() {
    const remaining = BEACH_DATA.filter(b => !obtainedStamps.includes(b.id));
    if (remaining.length === 0) return;
    const bd = remaining[Math.floor(Math.random() * remaining.length)];
    const x = tryX(30, CANVAS_W - 60, 75, noOverlapWithObstacles);
    pickups.push({
      type: 'stamp', beachId: bd.id,
      x, y: -30,
      size: 36, vy: game.baseSpeed * 0.42, phase: Math.random() * Math.PI * 2,
    });
  }

  // ===== Collisions =====
  function islandHitsSurfer(isle) {
    return (
      Math.abs(isle.x - surfer.x) < isle.w * 0.44 + 10 &&
      Math.abs(isle.y - surfer.y) < isle.h * 0.40 + 14
    );
  }

  function pickupHitsSurfer(p) {
    return (
      Math.abs(p.x - surfer.x) < p.size / 2 + 18 &&
      Math.abs(p.y - surfer.y) < p.size / 2 + 22
    );
  }

  // ===== Updates =====
  function clampSurfer() {
    const pad = 18;
    if (surfer.x < pad)             { surfer.x = pad;             surfer.vx = 0; }
    if (surfer.x > CANVAS_W - pad)  { surfer.x = CANVAS_W - pad;  surfer.vx = 0; }
    if (surfer.y < CANVAS_H * 0.18) { surfer.y = CANVAS_H * 0.18; surfer.vy = 0; }
    if (surfer.y > CANVAS_H - 26)   { surfer.y = CANVAS_H - 26;   surfer.vy = 0; }
  }

  function updateSurfer() {
    if (!dragging) {
      if (surfer.moveUp)    surfer.vy -= surfer.accel;
      if (surfer.moveDown)  surfer.vy += surfer.accel;
      if (surfer.moveLeft)  surfer.vx -= surfer.accel;
      if (surfer.moveRight) surfer.vx += surfer.accel;
      if (!surfer.moveUp   && !surfer.moveDown)  surfer.vy *= surfer.friction;
      if (!surfer.moveLeft && !surfer.moveRight) surfer.vx *= surfer.friction;
      surfer.vx = Math.max(-surfer.maxSpeed, Math.min(surfer.maxSpeed, surfer.vx));
      surfer.vy = Math.max(-surfer.maxSpeed, Math.min(surfer.maxSpeed, surfer.vy));
      surfer.x += surfer.vx;
      surfer.y += surfer.vy;
    }
    clampSurfer();
    if (surfer.invuln > 0) surfer.invuln--;
    if (game.time % 2 === 0) spawnWakeParticle();
  }

  function updateIslands() {
    for (let i = islands.length - 1; i >= 0; i--) {
      const isle = islands[i];
      isle.y += isle.vy;
      if (surfer.invuln === 0 && islandHitsSurfer(isle)) {
        damagePlayer();
      }
      if (isle.y > CANVAS_H + isle.h + 20) islands.splice(i, 1);
    }
  }

  function updatePickups() {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.y += p.vy;
      if (p.y > CANVAS_H + 30) { pickups.splice(i, 1); continue; }
      if (pickupHitsSurfer(p)) { collectPickup(p); pickups.splice(i, 1); }
    }
  }

  function collectPickup(p) {
    const { x: cx, y: cy } = p;
    if (p.type === 'heart') {
      if (game.lives < game.maxLives) {
        game.lives++;
        spawnPopup('+1 LIFE', cx, cy, 'rgba(231,76,60,ALPHA)', 16);
      } else {
        addScore(30, cx, cy);
        spawnPopup('+30', cx, cy, 'rgba(26,188,156,ALPHA)', 14);
      }
      spawnParticles(cx, cy, '#e74c3c', 16);
    } else if (p.type === 'stamp') {
      const gotNew = collectStamp(p.beachId);
      spawnParticles(cx, cy, '#c0392b', 18, { spread: 6 });
      if (gotNew) {
        spawnPopup('STAMP GET!', cx, cy - 10, 'rgba(241,196,15,ALPHA)', 22);
      } else {
        addScore(50, cx, cy);
        spawnPopup('ALREADY HAVE', cx, cy, 'rgba(189,195,199,ALPHA)', 13);
      }
    }
  }

  function damagePlayer() {
    if (surfer.invuln > 0) return; // 무적 시간 중 재피해 방지
    game.lives--;
    surfer.invuln = 100; // 100프레임(약 1.7초) 무적 부여
    screenShake = 14;    // 화면 흔들림 강도 (매 프레임 0.85배씩 감쇠)
    damageFlash = 24;    // 빨간 플래시 지속 프레임 수
    spawnPopup('MISS!', surfer.x, surfer.y - 22, 'rgba(231,76,60,ALPHA)', 20);
    spawnParticles(surfer.x, surfer.y, '#e74c3c', 20, { spread: 7 });
    if (game.lives <= 0) {
      game.lives = 0;
      gameOver();
    }
  }

  function addScore(v, x, y) {
    game.score += v;
    if (x !== undefined) spawnPopup(`+${v}`, x, y, 'rgba(26,188,156,ALPHA)', 14);
    // 150점마다 레벨이 오르고, 장애물 속도가 0.38씩 증가한다.
    const newLevel = Math.floor(game.score / 150) + 1;
    if (newLevel > game.level) {
      game.level = newLevel;
      game.baseSpeed = 2.8 + (game.level - 1) * 0.38;
      spawnPopup('LEVEL ' + game.level, CANVAS_W / 2, 110, 'rgba(0,210,255,ALPHA)', 22);
    }
    if (game.score > bestScore) { bestScore = game.score; game.newBest = true; }
  }

  // ===== HUD =====
  function drawHUD() {
    const hudH = 64;
    const hudGrad = ctx.createLinearGradient(0, 0, 0, hudH + 8);
    hudGrad.addColorStop(0, 'rgba(10,22,40,0.78)');
    hudGrad.addColorStop(1, 'rgba(10,22,40,0)');
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, CANVAS_W, hudH + 8);

    ctx.strokeStyle = 'rgba(26,188,156,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, hudH); ctx.lineTo(CANVAS_W, hudH); ctx.stroke();

    ctx.textBaseline = 'top';

    // SCORE (left)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(189,195,199,0.85)';
    ctx.font = '700 9px Poppins,sans-serif';
    ctx.fillText('SCORE', 14, 8);
    ctx.fillStyle = '#1abc9c';
    ctx.font = '800 18px Poppins,sans-serif';
    ctx.fillText(game.score, 14, 18);

    // LEVEL (center)
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(189,195,199,0.85)';
    ctx.font = '700 9px Poppins,sans-serif';
    ctx.fillText('LEVEL', CANVAS_W / 2, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px Poppins,sans-serif';
    ctx.fillText(game.level, CANVAS_W / 2, 18);

    // BEST (right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(189,195,199,0.85)';
    ctx.font = '700 9px Poppins,sans-serif';
    ctx.fillText('BEST', CANVAS_W - 14, 8);
    ctx.fillStyle = '#f39c12';
    ctx.font = '800 16px Poppins,sans-serif';
    ctx.fillText('★ ' + bestScore, CANVAS_W - 14, 20);

    // LIVES — heart icons
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(189,195,199,0.85)';
    ctx.font = '700 8px Poppins,sans-serif';
    ctx.fillText('LIVES', 14, 37);

    for (let i = 0; i < game.maxLives; i++) {
      ctx.fillStyle = i < game.lives ? '#e74c3c' : 'rgba(255,255,255,0.12)';
      ctx.font = '15px sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(i < game.lives ? '♥' : '♡', 12 + i * 19, 46);
    }
    ctx.textBaseline = 'top';
  }

  // ===== Pause =====
  function pauseGame() {
    if (!game?.running || game.paused) return;
    game.paused = true;
    pauseBtn.textContent = '계속하기';
    drawPauseOverlay();
  }

  function resumeGame() {
    if (!game?.running || !game.paused) return;
    game.paused = false;
    pauseBtn.textContent = '일시정지';
    gameLoop();
  }

  function togglePause() {
    if (!game?.running) return;
    if (game.paused) resumeGame(); else pauseGame();
  }

  function drawPauseOverlay() {
    applyRenderTransform();
    ctx.fillStyle = 'rgba(10,22,40,0.75)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px Poppins,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 4);
    ctx.fillStyle = '#1abc9c';
    ctx.font = '400 14px Poppins,sans-serif';
    ctx.fillText('P / ESC 또는 버튼으로 재개', CANVAS_W / 2, CANVAS_H / 2 + 22);
  }

  // ===== Game Over =====
  function gameOver() {
    game.running = false;
    game.over = true;
    startBtn.textContent = '게임 시작';
    pauseBtn.textContent = '일시정지';
    spawnParticles(surfer.x, surfer.y, '#e74c3c', 30, { spread: 8 });
    try {
      if (game.score >= bestScore && window.localStorage) {
        bestScore = game.score;
        window.localStorage.setItem(BEST_KEY, String(bestScore));
      }
    } catch (_) {}
  }

  function drawGameOver() {
    applyRenderTransform();
    ctx.fillStyle = 'rgba(10,22,40,0.85)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Poppins,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', CANVAS_W / 2, CANVAS_H / 2 - 70);
    ctx.fillStyle = '#1abc9c';
    ctx.font = '700 28px Poppins,sans-serif';
    ctx.fillText('Score ' + game.score, CANVAS_W / 2, CANVAS_H / 2 - 24);
    ctx.fillStyle = '#f1c40f';
    ctx.font = '600 18px Poppins,sans-serif';
    ctx.fillText('Lv. ' + game.level, CANVAS_W / 2, CANVAS_H / 2 + 8);
    if (game.newBest) {
      ctx.fillStyle = '#f39c12';
      ctx.font = '700 22px Poppins,sans-serif';
      ctx.fillText('★ NEW BEST! ★', CANVAS_W / 2, CANVAS_H / 2 + 44);
    } else {
      ctx.fillStyle = '#bdc3c7';
      ctx.font = '400 15px Poppins,sans-serif';
      ctx.fillText('Best ' + bestScore, CANVAS_W / 2, CANVAS_H / 2 + 44);
    }
    ctx.fillStyle = '#bdc3c7';
    ctx.font = '400 13px Poppins,sans-serif';
    ctx.fillText('다시하기 버튼을 눌러 재도전', CANVAS_W / 2, CANVAS_H / 2 + 80);
  }

  function drawStartScreen() {
    applyRenderTransform();
    drawBackground();
    ctx.fillStyle = 'rgba(10,22,40,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Poppins,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Wave Rider', CANVAS_W / 2, CANVAS_H / 2 - 90);

    ctx.fillStyle = '#1abc9c';
    ctx.font = '600 15px Poppins,sans-serif';
    ctx.fillText('섬을 피하며 파도를 가르자!', CANVAS_W / 2, CANVAS_H / 2 - 58);

    ctx.fillStyle = '#bdc3c7';
    ctx.font = '400 13px Poppins,sans-serif';
    ctx.fillText('WASD / 방향키 — 이동', CANVAS_W / 2, CANVAS_H / 2 - 22);
    ctx.fillText('드래그(모바일) — 서퍼 조종', CANVAS_W / 2, CANVAS_H / 2 - 2);
    ctx.fillText('P / ESC — 일시정지', CANVAS_W / 2, CANVAS_H / 2 + 18);

    ctx.fillStyle = '#e74c3c';
    ctx.font = '400 12px Poppins,sans-serif';
    ctx.fillText('목숨 ♥♥♥ — 섬에 부딪히면 1개 소진', CANVAS_W / 2, CANVAS_H / 2 + 42);

    if (bestScore > 0) {
      ctx.fillStyle = '#f39c12';
      ctx.font = '700 16px Poppins,sans-serif';
      ctx.fillText('★ BEST ' + bestScore, CANVAS_W / 2, CANVAS_H / 2 + 72);
    }

    ctx.fillStyle = '#1abc9c';
    ctx.font = '400 13px Poppins,sans-serif';
    ctx.fillText('게임 시작 버튼을 눌러주세요', CANVAS_W / 2, CANVAS_H / 2 + 102);
  }

  // ===== Main Loop =====
  // requestAnimationFrame으로 매 프레임 호출되는 메인 게임 루프.
  // 순서: 타이머 증가 → 스폰 판단 → 상태 업데이트 → 화면 그리기
  function gameLoop() {
    if (game.paused) return;
    game.time++;

    if (!game.running) {
      // 게임 오버 상태에서도 파티클/팝업은 계속 애니메이션된다.
      if (game.over) {
        applyRenderTransform();
        drawBackground();
        drawParticles();
        drawPopups();
        drawGameOver();
      }
      return;
    }

    game.spawnTimer++;
    game.pickupTimer++;
    game.stampTimer++;

    // 생존 보너스: 60프레임(약 1초)마다 +2점
    if (game.time % 60 === 0) addScore(2);

    // 장애물 스폰 간격: 레벨이 높을수록 짧아지고 최소 22프레임으로 제한된다.
    const spawnInterval = Math.max(22, 60 - game.level * 4);
    if (game.spawnTimer >= spawnInterval) {
      game.spawnTimer = 0;
      // 레벨 3 이상부터 포메이션(섬 2개) 출현, 레벨 6 이상에서는 빈도 증가
      const formationChance = game.level >= 6 ? 0.35 : game.level >= 3 ? 0.2 : 0;
      if (Math.random() < formationChance) {
        spawnIslandFormation();
      } else if (Math.random() < 0.42) {
        spawnRock();
      } else {
        spawnIsland();
      }
    }

    // 하트 아이템 스폰 간격: 레벨이 높을수록 자주 등장 (최소 180프레임)
    const pickupInterval = Math.max(180, 320 - game.level * 10);
    if (game.pickupTimer >= pickupInterval) {
      game.pickupTimer = 0;
      spawnPickup();
    }

    // 스탬프 아이템은 8초(480프레임)마다 한 번 스폰된다.
    if (game.stampTimer >= 480) {
      game.stampTimer = 0;
      spawnStampPickup();
    }

    updateSurfer();
    updateIslands();
    updatePickups();

    // 피격 시 screenShake를 0.85배씩 감쇠시켜 자연스럽게 흔들림이 가라앉는다.
    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
      shakeX = (Math.random() - 0.5) * screenShake;
      shakeY = (Math.random() - 0.5) * screenShake;
      screenShake *= 0.85;
      if (screenShake < 0.4) screenShake = 0;
    }

    applyRenderTransform();
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground();

    // Draw obstacles (islands and rocks)
    for (const obs of islands) {
      if (obs.type === 'rock') drawRock(obs);
      else drawIsland(obs);
    }

    for (const p of pickups) drawPickup(p);
    drawParticles();
    drawSurfer();
    drawPopups();
    drawHUD();

    if (damageFlash > 0) {
      ctx.fillStyle = `rgba(231,76,60,${damageFlash / 60})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      damageFlash--;
    }

    ctx.restore();

    game.animId = requestAnimationFrame(gameLoop);
  }

  // ===== Controls =====
  function resetGame() {
    if (game) cancelAnimationFrame(game.animId);
    initState();
    pauseBtn.textContent = '일시정지';
    startBtn.textContent = '게임 시작';
    drawStartScreen();
  }

  startBtn.addEventListener('click', () => {
    if (!game) return;
    enterFullscreen();
    if (!game.running || game.over) {
      resetGame();
      game.running = true;
      startBtn.textContent = '이어하기';
      gameLoop();
    } else if (game.paused) {
      resumeGame();
    }
  });

  resetBtn.addEventListener('click', resetGame);
  pauseBtn.addEventListener('click', togglePause);

  // ===== Fullscreen =====
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function enterFullscreen() {
    if (isFullscreen()) return;
    try {
      const p = canvasWrap.requestFullscreen?.() ?? canvasWrap.webkitRequestFullscreen?.();
      p?.catch?.(() => {});
    } catch (_) {}
  }

  function exitFullscreenIfNeeded() {
    if (!isFullscreen()) return;
    try { (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document); } catch (_) {}
  }

  function toggleFullscreen() {
    if (isFullscreen()) exitFullscreenIfNeeded(); else enterFullscreen();
  }

  function onFullscreenChange() {
    if (isFullscreen()) {
      canvasWrap.classList.add('is-fullscreen');
      fullscreenBtn.textContent = '전체화면 해제';
    } else {
      canvasWrap.classList.remove('is-fullscreen');
      fullscreenBtn.textContent = '전체화면';
      if (game?.running && !game.paused && !game.over) pauseGame();
    }
    setTimeout(scheduleResize, 50);
    setTimeout(scheduleResize, 250);
  }

  document.addEventListener('fullscreenchange',       onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
  document.getElementById('btnFullscreen')?.addEventListener('click', toggleFullscreen);

  document.addEventListener('keydown', e => {
    if ((e.key === 'f' || e.key === 'F') && !e.repeat) {
      if (document.activeElement?.tagName === 'INPUT') return;
      toggleFullscreen();
    }
  });

  // ===== Initial =====
  initState();
  loadStamps();
  resizeCanvasBacking();
  drawStartScreen();
  setTimeout(scheduleResize, 0);
})();
