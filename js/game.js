// ===== Wave Rider - Vertical Scrolling Surf Shooter =====
(function () {
  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');

  var CANVAS_W = 480;
  var CANVAS_H = 720;
  var renderScale = 1;
  // Oversample multiplier on top of device pixel ratio for crisper vectors / text.
  var OVERSAMPLE = 2;

  function resizeCanvasBacking() {
    // Use the larger of the device's actual DPR and our oversample minimum.
    var dpr = Math.max(OVERSAMPLE, window.devicePixelRatio || 1);
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    var newW = Math.max(1, Math.round(w * dpr));
    var newH = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
    }
    renderScale = canvas.width / CANVAS_W;

    // High-quality smoothing for any bitmap/gradient sampling.
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  }

  function applyRenderTransform() {
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  }

  function redrawCurrentScene() {
    if (!game) return;
    if (game.paused) {
      // Pause overlay is rendered on top of last frame; nothing to redraw here.
      return;
    }
    applyRenderTransform();
    if (game.over) {
      drawBackground();
      drawParticles();
      drawPopups();
      drawGameOver();
    } else if (!game.running) {
      drawStartScreen();
    }
    // If running, the next animation frame will draw normally.
  }

  function scheduleResize() {
    resizeCanvasBacking();
    redrawCurrentScene();
  }

  window.addEventListener('resize', scheduleResize);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(scheduleResize);
    ro.observe(canvas);
  }

  // ===== UI =====
  var startBtn = document.getElementById('startBtn');
  var resetBtn = document.getElementById('resetBtn');
  var pauseBtn = document.getElementById('pauseBtn');
  var fullscreenBtn = document.getElementById('fullscreenBtn');
  var btnBombCount = document.getElementById('btnBombCount');
  var canvasWrap = document.getElementById('canvasWrap');

  // ===== Persistence =====
  var BEST_KEY = 'waveRiderBestScore';
  var bestScore = 0;
  try {
    var saved = window.localStorage && window.localStorage.getItem(BEST_KEY);
    if (saved) bestScore = parseInt(saved, 10) || 0;
  } catch (e) {}

  // ===== Game State =====
  var game;
  var surfer;
  var bullets;
  var enemies;
  var enemyBullets;
  var pickups;
  var particles;
  var popups;
  var foamLines; // background foam streaks
  var screenShake;
  var damageFlash;
  var bombFlash;

  function initState() {
    game = {
      running: false,
      over: false,
      paused: false,
      score: 0,
      level: 1,
      hp: 100,
      maxHp: 100,
      baseSpeed: 3.6,
      spawnTimer: 0,
      pickupTimer: 0,
      fireCooldown: 0,
      powerLevel: 1, // 1-5
      rapidTimer: 0,
      rapidDuration: 0,
      shieldHp: 0,
      bombs: 3,
      bossActive: false,
      bossSpawnedForLevel: 0,
      animId: null,
      time: 0,
      combo: 0,
      comboTimer: 0,
      comboBest: 0,
      newBest: false
    };

    surfer = {
      x: CANVAS_W / 2,
      y: CANVAS_H * 0.78,
      w: 44,
      h: 64,
      maxSpeed: 7.5,
      accel: 1.05,
      friction: 0.8,
      vx: 0,
      vy: 0,
      moveUp: false,
      moveDown: false,
      moveLeft: false,
      moveRight: false,
      invuln: 0,
      bob: 0,
      tilt: 0
    };

    bullets = [];
    enemies = [];
    enemyBullets = [];
    pickups = [];
    particles = [];
    popups = [];
    screenShake = 0;
    damageFlash = 0;
    bombFlash = 0;

    // Foam streaks flowing top->bottom
    foamLines = [];
    for (var i = 0; i < 18; i++) {
      foamLines.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        len: 14 + Math.random() * 32,
        speed: 1 + Math.random() * 2.4,
        alpha: 0.08 + Math.random() * 0.18,
        thickness: 1 + Math.random() * 1.5
      });
    }
  }

  // ===== Input =====
  var keys = {};
  var GAME_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'q', 'p'];
  function isGameKey(k) { return GAME_KEYS.indexOf(k) !== -1; }

  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (isGameKey(k) && game && (game.running || game.paused)) e.preventDefault();
    if (keys[k]) return;
    keys[k] = true;
    if (k === 'arrowup' || k === 'w') surfer.moveUp = true;
    if (k === 'arrowdown' || k === 's') surfer.moveDown = true;
    if (k === 'arrowleft' || k === 'a') surfer.moveLeft = true;
    if (k === 'arrowright' || k === 'd') surfer.moveRight = true;
    if (k === 'q') triggerBomb();
    if (k === 'p') togglePause();
    if (k === 'escape') {
      // ESC: exit fullscreen (browser may have already done this) + force pause.
      exitFullscreenIfNeeded();
      pauseGame();
    }
  });

  document.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (isGameKey(k) && game && (game.running || game.paused)) e.preventDefault();
    keys[k] = false;
    if (k === 'arrowup' || k === 'w') surfer.moveUp = false;
    if (k === 'arrowdown' || k === 's') surfer.moveDown = false;
    if (k === 'arrowleft' || k === 'a') surfer.moveLeft = false;
    if (k === 'arrowright' || k === 'd') surfer.moveRight = false;
  });

  // Touch / pointer drag — surfer follows finger
  var dragging = false;
  var dragOffset = { x: 0, y: 0 };

  function canvasCoords(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var sx = CANVAS_W / rect.width;
    var sy = CANVAS_H / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy
    };
  }

  function pointerDown(e) {
    if (!game || !game.running || game.paused) return;
    var t = (e.touches && e.touches[0]) || e;
    var p = canvasCoords(t.clientX, t.clientY);
    dragging = true;
    dragOffset.x = surfer.x - p.x;
    dragOffset.y = surfer.y - p.y;
    // Cap offset so finger isn't crazy far away
    var maxOff = 40;
    dragOffset.x = Math.max(-maxOff, Math.min(maxOff, dragOffset.x));
    dragOffset.y = Math.max(-maxOff, Math.min(maxOff, dragOffset.y));
    if (e.cancelable) e.preventDefault();
  }

  function pointerMove(e) {
    if (!dragging) return;
    var t = (e.touches && e.touches[0]) || e;
    var p = canvasCoords(t.clientX, t.clientY);
    var tx = p.x + dragOffset.x;
    var ty = p.y + dragOffset.y;
    // Apply with snap (no velocity for drag)
    var dx = tx - surfer.x;
    var dy = ty - surfer.y;
    surfer.x = tx;
    surfer.y = ty;
    surfer.vx = dx * 0.5;
    surfer.vy = dy * 0.5;
    clampSurfer();
    if (e.cancelable) e.preventDefault();
  }

  function pointerUp() {
    dragging = false;
  }

  canvas.addEventListener('touchstart', pointerDown, { passive: false });
  canvas.addEventListener('touchmove', pointerMove, { passive: false });
  canvas.addEventListener('touchend', pointerUp);
  canvas.addEventListener('touchcancel', pointerUp);
  canvas.addEventListener('mousedown', pointerDown);
  canvas.addEventListener('mousemove', pointerMove);
  canvas.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('mouseleave', pointerUp);

  var btnBomb = document.getElementById('btnBomb');
  if (btnBomb) {
    btnBomb.addEventListener('click', function (e) { e.preventDefault(); triggerBomb(); });
  }

  // ===== Drawing =====
  function drawBackground() {
    // Deep teal -> blue gradient
    var grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#063047');
    grad.addColorStop(0.4, '#0c4b6b');
    grad.addColorStop(0.75, '#106f7e');
    grad.addColorStop(1, '#0b3c52');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle horizontal water bands (parallax tone)
    ctx.fillStyle = 'rgba(26, 188, 156, 0.05)';
    for (var b = 0; b < 4; b++) {
      var by = ((game.time * 0.6 + b * 200) % (CANVAS_H + 100)) - 50;
      ctx.fillRect(0, by, CANVAS_W, 30);
    }

    // Foam streaks (2 layers via thickness/alpha variance)
    for (var i = 0; i < foamLines.length; i++) {
      var f = foamLines[i];
      f.y += f.speed * (game.baseSpeed / 3.6);
      if (f.y > CANVAS_H + 20) {
        f.y = -f.len - Math.random() * 60;
        f.x = Math.random() * CANVAS_W;
        f.speed = 1 + Math.random() * 2.4;
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + f.alpha + ')';
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
    var bob = Math.sin(surfer.bob) * 1.5;
    // Tilt eases toward vx
    var targetTilt = Math.max(-0.35, Math.min(0.35, surfer.vx * 0.06));
    surfer.tilt += (targetTilt - surfer.tilt) * 0.18;

    var x = surfer.x;
    var y = surfer.y + bob;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(surfer.tilt);

    // Wake / foam trail (below the board)
    var trailGrad = ctx.createLinearGradient(0, 30, 0, 80);
    trailGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    trailGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = trailGrad;
    ctx.beginPath();
    ctx.moveTo(-14, 28);
    ctx.lineTo(14, 28);
    ctx.lineTo(10, 80);
    ctx.lineTo(-10, 80);
    ctx.closePath();
    ctx.fill();

    // Surfboard (vertical ellipse, top-down)
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Board accent stripe
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-1.5, -28, 3, 56);

    // Board nose lighter
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, -22, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Surfer body (squatting on board, top-down)
    // Head
    ctx.fillStyle = '#fdd835';
    ctx.beginPath();
    ctx.arc(0, -6, 7, 0, Math.PI * 2);
    ctx.fill();
    // Torso (rashguard)
    ctx.fillStyle = '#1abc9c';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Arms outstretched (balance)
    ctx.strokeStyle = '#fdd835';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7, 2); ctx.lineTo(-14, 8);
    ctx.moveTo(7, 2);  ctx.lineTo(14, 8);
    ctx.stroke();
    // Legs (slight bend)
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-6, 12, 4, 12);
    ctx.fillRect(2, 12, 4, 12);

    // Shield aura
    if (game.powerLevel >= 1 && (game.shieldHp > 0)) {
      var pulse = 0.7 + Math.sin(game.time * 0.15) * 0.2;
      ctx.strokeStyle = 'rgba(183, 148, 244, ' + pulse + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(183, 148, 244, 0.22)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Invuln flash
    if (surfer.invuln > 0 && Math.floor(surfer.invuln / 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 36, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBullet(b) {
    if (b.kind === 'player') {
      // Vertical water beam (going up)
      var grad = ctx.createLinearGradient(b.x, b.y - b.h / 2, b.x, b.y + b.h / 2);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(0.4, 'rgba(0, 210, 255, 1)');
      grad.addColorStop(1, 'rgba(26, 188, 156, 0.2)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.beginPath();
      ctx.arc(b.x, b.y - b.h / 2 + 2, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r || 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 200, 200, 0.8)';
      ctx.beginPath();
      ctx.arc(b.x - 1, b.y - 1, (b.r || 6) / 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemy(e) {
    var x = e.x, y = e.y, w = e.w, h = e.h;

    if (e.type === 'jellyfish') {
      // Jellyfish — dome on top, tentacles below
      ctx.fillStyle = 'rgba(183, 148, 244, 0.9)';
      ctx.beginPath();
      ctx.arc(x, y - 4, w / 2, Math.PI, 0);
      ctx.lineTo(x + w / 2, y + 2);
      ctx.lineTo(x - w / 2, y + 2);
      ctx.closePath();
      ctx.fill();
      // Tentacles (downward)
      ctx.strokeStyle = 'rgba(183, 148, 244, 0.7)';
      ctx.lineWidth = 2;
      for (var t = -2; t <= 2; t++) {
        ctx.beginPath();
        ctx.moveTo(x + t * 5, y + 2);
        ctx.quadraticCurveTo(
          x + t * 5 + Math.sin(game.time * 0.12 + t) * 4,
          y + 14,
          x + t * 5,
          y + h * 0.55
        );
        ctx.stroke();
      }
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 5, y - 6, 2, 0, Math.PI * 2);
      ctx.arc(x + 5, y - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'shark') {
      // Shark facing DOWN (top-down view)
      ctx.fillStyle = '#5d6d7e';
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);          // nose (bottom)
      ctx.quadraticCurveTo(x - w / 2, y, x - w / 3, y - h / 2);
      ctx.lineTo(x + w / 3, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y, x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      // Tail (top)
      ctx.fillStyle = '#34495e';
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x - 8, y - h / 2 - 10);
      ctx.lineTo(x + 8, y - h / 2 - 10);
      ctx.closePath();
      ctx.fill();
      // Side fins
      ctx.fillStyle = '#34495e';
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 4, y);
      ctx.lineTo(x - w / 2 - 6, y + 4);
      ctx.lineTo(x - w / 2 + 2, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 4, y);
      ctx.lineTo(x + w / 2 + 6, y + 4);
      ctx.lineTo(x + w / 2 - 2, y + 8);
      ctx.closePath();
      ctx.fill();
      // Belly highlight
      ctx.fillStyle = '#aeb6bf';
      ctx.beginPath();
      ctx.ellipse(x, y + 6, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, 2.2, 0, Math.PI * 2);
      ctx.arc(x + 4, y - 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, 1, 0, Math.PI * 2);
      ctx.arc(x + 4, y - 4, 1, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'puffer') {
      // Spikes (radial)
      ctx.fillStyle = '#e67e22';
      var spikes = 14;
      for (var sp = 0; sp < spikes; sp++) {
        var ang = (sp / spikes) * Math.PI * 2;
        var sx = x + Math.cos(ang) * (w / 2);
        var sy = y + Math.sin(ang) * (h / 2);
        var ex = x + Math.cos(ang) * (w / 2 + 8);
        var ey = y + Math.sin(ang) * (h / 2 + 8);
        var sx2 = x + Math.cos(ang + 0.2) * (w / 2);
        var sy2 = y + Math.sin(ang + 0.2) * (h / 2);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.lineTo(sx2, sy2);
        ctx.closePath();
        ctx.fill();
      }
      // Body
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 6, y - 3, 4, 0, Math.PI * 2);
      ctx.arc(x + 6, y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x - 6, y - 3, 2, 0, Math.PI * 2);
      ctx.arc(x + 6, y - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'crab') {
      // Body
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      // Claws (left/right)
      ctx.fillStyle = '#922b21';
      ctx.beginPath();
      ctx.arc(x - w / 2 - 4, y - 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w / 2 + 4, y - 2, 8, 0, Math.PI * 2);
      ctx.fill();
      // Legs (bottom)
      ctx.strokeStyle = '#922b21';
      ctx.lineWidth = 2;
      for (var li = -2; li <= 2; li++) {
        ctx.beginPath();
        ctx.moveTo(x + li * 5, y + 4);
        ctx.lineTo(x + li * 7, y + 14);
        ctx.stroke();
      }
      // Eyes
      ctx.strokeStyle = '#922b21';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 6); ctx.lineTo(x - 4, y - 13);
      ctx.moveTo(x + 4, y - 6); ctx.lineTo(x + 4, y - 13);
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x - 4, y - 14, 2, 0, Math.PI * 2);
      ctx.arc(x + 4, y - 14, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'boss') {
      // Outer glow
      var glow = ctx.createRadialGradient(x, y, 20, x, y, 100);
      glow.addColorStop(0, 'rgba(231, 76, 60, 0.35)');
      glow.addColorStop(1, 'rgba(231, 76, 60, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 100, y - 100, 200, 200);
      // Tentacles (8 around)
      ctx.strokeStyle = '#7b241c';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      for (var k = 0; k < 8; k++) {
        var ang = (k / 8) * Math.PI * 2;
        var phase = game.time * 0.05 + k;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          x + Math.cos(ang) * (50 + Math.sin(phase) * 8),
          y + Math.sin(ang) * (50 + Math.cos(phase) * 8),
          x + Math.cos(ang) * 80,
          y + Math.sin(ang) * 80
        );
        ctx.stroke();
      }
      // Body
      ctx.fillStyle = '#922b21';
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a93226';
      ctx.beginPath();
      ctx.arc(x - 6, y - 6, w / 2 - 10, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (e.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (e.hitFlash / 6) + ')';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(w, h) / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPickup(p) {
    var cx = p.x;
    var cy = p.y;
    var float = Math.sin(game.time * 0.1 + p.phase) * 2;

    if (p.type === 'shell') {
      ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2 + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2, Math.PI, 0);
      ctx.lineTo(cx + p.size / 2, cy + float);
      ctx.quadraticCurveTo(cx, cy + float + p.size / 2, cx - p.size / 2, cy + float);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e67e22';
      ctx.lineWidth = 1;
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * (p.size / 6), cy + float - p.size / 2 + 2);
        ctx.lineTo(cx + i * (p.size / 8), cy + float + p.size / 4);
        ctx.stroke();
      }
    } else if (p.type === 'star') {
      ctx.fillStyle = 'rgba(243, 156, 18, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2 + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f39c12';
      drawStar(cx, cy + float, 5, p.size / 2, p.size / 4);
    } else if (p.type === 'heart') {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2 + 8, 0, Math.PI * 2);
      ctx.fill();
      drawHeart(cx, cy + float, p.size);
    } else if (p.type === 'shield') {
      ctx.fillStyle = 'rgba(183, 148, 244, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2 + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b794f4';
      ctx.beginPath();
      ctx.moveTo(cx, cy + float - p.size / 2);
      ctx.lineTo(cx + p.size / 2, cy + float - p.size / 4);
      ctx.lineTo(cx + p.size / 3, cy + float + p.size / 2);
      ctx.lineTo(cx - p.size / 3, cy + float + p.size / 2);
      ctx.lineTo(cx - p.size / 2, cy + float - p.size / 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(cx - 1, cy + float - p.size / 3, 2, p.size / 2);
      ctx.fillRect(cx - p.size / 4, cy + float - 1, p.size / 2, 2);
    } else if (p.type === 'rapid') {
      ctx.fillStyle = 'rgba(0, 210, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2 + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00d2ff';
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + float - p.size / 2);
      ctx.lineTo(cx + p.size / 4, cy + float - 2);
      ctx.lineTo(cx, cy + float + 2);
      ctx.lineTo(cx + 4, cy + float + p.size / 2);
      ctx.lineTo(cx - p.size / 4, cy + float + 2);
      ctx.lineTo(cx, cy + float - 2);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'bomb') {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy + float, p.size / 2 + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(cx, cy + float + 2, p.size / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy + float - p.size / 2 + 2);
      ctx.lineTo(cx + 6, cy + float - p.size / 2 - 4);
      ctx.stroke();
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.arc(cx + 7, cy + float - p.size / 2 - 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStar(cx, cy, spikes, outerR, innerR) {
    var rot = Math.PI / 2 * 3;
    var step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (var i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerR);
    ctx.closePath();
    ctx.fill();
  }

  function drawHeart(cx, cy, size) {
    ctx.fillStyle = '#e74c3c';
    var topY = cy - size / 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy + size / 3);
    ctx.bezierCurveTo(cx - size / 2, topY, cx - size / 2, cy - size / 1.6, cx, cy - size / 6);
    ctx.bezierCurveTo(cx + size / 2, cy - size / 1.6, cx + size / 2, topY, cx, cy + size / 3);
    ctx.closePath();
    ctx.fill();
  }

  function drawParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      ctx.fillStyle = 'rgba(' + p.r + ',' + p.g + ',' + p.b + ',' + p.alpha + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.alpha -= p.fade || 0.03;
      p.size *= 0.97;
      if (p.alpha <= 0 || p.size <= 0.4) particles.splice(i, 1);
    }
  }

  function drawPopups() {
    for (var i = popups.length - 1; i >= 0; i--) {
      var p = popups[i];
      p.y += p.vy;
      p.vy *= 0.94;
      p.life--;
      var alpha = Math.min(1, p.life / 30);
      ctx.font = '700 ' + p.size + 'px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.5) + ')';
      ctx.fillText(p.text, p.x + 1, p.y + 1);
      ctx.fillStyle = p.color.replace('ALPHA', alpha);
      ctx.fillText(p.text, p.x, p.y);
      if (p.life <= 0) popups.splice(i, 1);
    }
  }

  function spawnParticles(x, y, color, count, opts) {
    opts = opts || {};
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    for (var i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * (opts.spread || 5),
        vy: (Math.random() - 0.5) * (opts.spread || 5),
        size: 2 + Math.random() * (opts.size || 3),
        alpha: 1,
        fade: opts.fade || 0.03,
        gravity: opts.gravity || 0,
        r: r, g: g, b: b
      });
    }
  }

  function spawnPopup(text, x, y, color, size) {
    popups.push({
      text: text,
      x: x, y: y,
      vy: -1.6,
      life: 50,
      size: size || 16,
      color: color || 'rgba(255,255,255,ALPHA)'
    });
  }

  function spawnWakeParticle() {
    // White foam behind board
    particles.push({
      x: surfer.x + (Math.random() - 0.5) * 18,
      y: surfer.y + 28 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 1.4 + Math.random() * 1.2,
      size: 2 + Math.random() * 2,
      alpha: 0.6,
      fade: 0.04,
      gravity: 0,
      r: 255, g: 255, b: 255
    });
  }

  // ===== Spawning =====
  function spawnEnemy() {
    var roll = Math.random();
    var canCrab = game.level >= 3;
    var canPuffer = game.level >= 2;
    var type, w, h, hp, speed, score;

    if (canCrab && roll < 0.15 + Math.min(0.1, game.level * 0.01)) {
      type = 'crab';
      w = 50; h = 40;
      hp = 4 + Math.floor(game.level / 3);
      speed = game.baseSpeed * 0.6 + Math.random() * 0.6;
      score = 50;
    } else if (roll < 0.5) {
      type = 'jellyfish';
      w = 36; h = 42;
      hp = 1;
      speed = game.baseSpeed * 0.9 + Math.random() * 1.2;
      score = 15;
    } else if (roll < 0.85) {
      type = 'shark';
      w = 38; h = 70;
      hp = 2 + Math.floor(game.level / 4);
      speed = game.baseSpeed * 1.3 + Math.random() * 1.5;
      score = 30;
    } else if (canPuffer) {
      type = 'puffer';
      w = 46; h = 46;
      hp = 3 + Math.floor(game.level / 3);
      speed = game.baseSpeed * 0.7 + Math.random();
      score = 45;
    } else {
      type = 'jellyfish';
      w = 36; h = 42;
      hp = 1;
      speed = game.baseSpeed * 0.9 + Math.random() * 1.2;
      score = 15;
    }

    var x = 40 + Math.random() * (CANVAS_W - 80);
    enemies.push({
      type: type,
      x: x,
      y: -40,
      w: w, h: h,
      vx: 0,
      vy: speed,
      bobPhase: Math.random() * Math.PI * 2,
      hp: hp,
      maxHp: hp,
      score: score,
      shootCooldown: (type === 'shark' || type === 'crab') ? 90 + Math.floor(Math.random() * 90) : -1,
      hitFlash: 0,
      drift: (Math.random() - 0.5) * 1.2
    });
  }

  function spawnFormation() {
    // V-formation of jellyfish
    var centerX = 60 + Math.random() * (CANVAS_W - 120);
    var count = 5;
    for (var i = 0; i < count; i++) {
      var off = i - Math.floor(count / 2);
      enemies.push({
        type: 'jellyfish',
        x: centerX + off * 36,
        y: -40 - Math.abs(off) * 30,
        w: 34, h: 40,
        vx: 0,
        vy: game.baseSpeed * 1.0,
        bobPhase: Math.random() * Math.PI * 2,
        hp: 1,
        maxHp: 1,
        score: 20,
        shootCooldown: -1,
        hitFlash: 0,
        drift: 0
      });
    }
  }

  function spawnBoss() {
    var hp = 30 + game.level * 10;
    enemies.push({
      type: 'boss',
      x: CANVAS_W / 2,
      y: -80,
      targetX: CANVAS_W / 2,
      targetY: 120,
      w: 130, h: 130,
      vx: 0,
      vy: 1.5,
      hp: hp,
      maxHp: hp,
      score: 400,
      shootCooldown: 80,
      hitFlash: 0,
      phase: 0,
      entered: false,
      patternTimer: 0,
      pattern: 0,
      dir: Math.random() < 0.5 ? -1 : 1
    });
    game.bossActive = true;
    spawnPopup('!! BOSS !!', CANVAS_W / 2, 80, 'rgba(231,76,60,ALPHA)', 28);
  }

  function spawnPickup() {
    var roll = Math.random();
    var type;
    if (roll < 0.45) type = 'shell';
    else if (roll < 0.7) type = 'star';
    else if (roll < 0.84) type = 'heart';
    else if (roll < 0.92) type = 'rapid';
    else if (roll < 0.97) type = 'shield';
    else type = 'bomb';

    pickups.push({
      type: type,
      x: 30 + Math.random() * (CANVAS_W - 60),
      y: -30,
      size: 26,
      vy: game.baseSpeed * 0.75,
      phase: Math.random() * Math.PI * 2
    });
  }

  function spawnPlayerBullets() {
    var cx = surfer.x;
    var cy = surfer.y - 18;
    var bulletSpeed = -11;
    var lvl = game.powerLevel;

    if (lvl === 1) {
      bullets.push({ kind: 'player', x: cx, y: cy, w: 8, h: 18, vx: 0, vy: bulletSpeed, dmg: 1 });
    } else if (lvl === 2) {
      bullets.push({ kind: 'player', x: cx - 8, y: cy, w: 7, h: 16, vx: 0, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx + 8, y: cy, w: 7, h: 16, vx: 0, vy: bulletSpeed, dmg: 1 });
    } else if (lvl === 3) {
      bullets.push({ kind: 'player', x: cx, y: cy - 4, w: 8, h: 18, vx: 0, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx - 12, y: cy, w: 7, h: 16, vx: -0.6, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx + 12, y: cy, w: 7, h: 16, vx: 0.6, vy: bulletSpeed, dmg: 1 });
    } else if (lvl === 4) {
      bullets.push({ kind: 'player', x: cx - 5, y: cy - 4, w: 7, h: 16, vx: 0, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx + 5, y: cy - 4, w: 7, h: 16, vx: 0, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx - 16, y: cy + 2, w: 7, h: 16, vx: -1, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx + 16, y: cy + 2, w: 7, h: 16, vx: 1, vy: bulletSpeed, dmg: 1 });
    } else {
      bullets.push({ kind: 'player', x: cx, y: cy - 6, w: 9, h: 20, vx: 0, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx - 10, y: cy - 2, w: 7, h: 16, vx: -0.4, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx + 10, y: cy - 2, w: 7, h: 16, vx: 0.4, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx - 20, y: cy + 4, w: 7, h: 16, vx: -1.6, vy: bulletSpeed, dmg: 1 });
      bullets.push({ kind: 'player', x: cx + 20, y: cy + 4, w: 7, h: 16, vx: 1.6, vy: bulletSpeed, dmg: 1 });
    }
  }

  function spawnEnemyBullet(e) {
    var bx = e.x;
    var by = e.y + e.h / 2 - 4;
    var dx = surfer.x - bx;
    var dy = surfer.y - by;
    var d = Math.hypot(dx, dy) || 1;
    var speed = e.type === 'boss' ? 4.6 : 3.4;
    enemyBullets.push({
      kind: 'enemy',
      x: bx, y: by,
      r: 6,
      w: 12, h: 12,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed
    });
  }

  function spawnBossFan(e, count, spread) {
    var bx = e.x;
    var by = e.y + 20;
    var dx = surfer.x - bx;
    var dy = surfer.y - by;
    var baseAng = Math.atan2(dy, dx);
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
      var ang = baseAng + t;
      enemyBullets.push({
        kind: 'enemy',
        x: bx, y: by,
        r: 6, w: 12, h: 12,
        vx: Math.cos(ang) * 3.6,
        vy: Math.sin(ang) * 3.6
      });
    }
  }

  function spawnBossRing(e, count) {
    var bx = e.x, by = e.y;
    for (var i = 0; i < count; i++) {
      var ang = (i / count) * Math.PI * 2 + (game.time * 0.03);
      enemyBullets.push({
        kind: 'enemy',
        x: bx, y: by,
        r: 6, w: 12, h: 12,
        vx: Math.cos(ang) * 3.0,
        vy: Math.sin(ang) * 3.0
      });
    }
  }

  // ===== Bomb =====
  function triggerBomb() {
    if (!game || !game.running || game.paused) return;
    if (game.bombs <= 0) return;
    game.bombs--;
    updateBombBadge();
    bombFlash = 28;
    screenShake = 18;

    for (var i = 0; i < enemyBullets.length; i++) {
      spawnParticles(enemyBullets[i].x, enemyBullets[i].y, '#f39c12', 4, { spread: 3 });
    }
    enemyBullets.length = 0;

    for (var j = enemies.length - 1; j >= 0; j--) {
      var e = enemies[j];
      var dmg = e.type === 'boss' ? 15 : 99;
      e.hp -= dmg;
      e.hitFlash = 8;
      spawnParticles(e.x, e.y, '#e74c3c', 18, { spread: 6 });
      if (e.hp <= 0) killEnemy(j, true);
    }
    spawnPopup('BOMB!', CANVAS_W / 2, CANVAS_H / 2, 'rgba(243,156,18,ALPHA)', 36);
  }

  // ===== Collisions =====
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function bulletHitsEnemy(b, e) {
    // bullet center-based, enemy center-based
    return Math.abs(b.x - e.x) < (b.w / 2 + e.w / 2) &&
           Math.abs(b.y - e.y) < (b.h / 2 + e.h / 2);
  }

  function enemyBulletHitsSurfer(eb) {
    return Math.abs(eb.x - surfer.x) < (eb.r + 14) &&
           Math.abs(eb.y - surfer.y) < (eb.r + 18);
  }

  function enemyHitsSurfer(e) {
    return Math.abs(e.x - surfer.x) < (e.w / 2 + 14) &&
           Math.abs(e.y - surfer.y) < (e.h / 2 + 18);
  }

  function pickupHitsSurfer(p) {
    return Math.abs(p.x - surfer.x) < (p.size / 2 + 18) &&
           Math.abs(p.y - surfer.y) < (p.size / 2 + 22);
  }

  // ===== Updates =====
  function clampSurfer() {
    var pad = 18;
    if (surfer.x < pad) { surfer.x = pad; surfer.vx = 0; }
    if (surfer.x > CANVAS_W - pad) { surfer.x = CANVAS_W - pad; surfer.vx = 0; }
    if (surfer.y < CANVAS_H * 0.18) { surfer.y = CANVAS_H * 0.18; surfer.vy = 0; }
    if (surfer.y > CANVAS_H - 26) { surfer.y = CANVAS_H - 26; surfer.vy = 0; }
  }

  function updateSurfer() {
    if (!dragging) {
      if (surfer.moveUp) surfer.vy -= surfer.accel;
      if (surfer.moveDown) surfer.vy += surfer.accel;
      if (surfer.moveLeft) surfer.vx -= surfer.accel;
      if (surfer.moveRight) surfer.vx += surfer.accel;

      if (!surfer.moveUp && !surfer.moveDown) surfer.vy *= surfer.friction;
      if (!surfer.moveLeft && !surfer.moveRight) surfer.vx *= surfer.friction;

      surfer.vx = Math.max(-surfer.maxSpeed, Math.min(surfer.maxSpeed, surfer.vx));
      surfer.vy = Math.max(-surfer.maxSpeed, Math.min(surfer.maxSpeed, surfer.vy));

      surfer.x += surfer.vx;
      surfer.y += surfer.vy;
    }
    clampSurfer();

    if (surfer.invuln > 0) surfer.invuln--;

    // Continuous wake
    if (game.time % 2 === 0) spawnWakeParticle();

    if (game.fireCooldown > 0) game.fireCooldown--;
    var fireRate = game.rapidTimer > 0 ? 4 : Math.max(5, 10 - Math.floor((game.powerLevel - 1) * 0.5));
    if (game.fireCooldown <= 0) {
      spawnPlayerBullets();
      game.fireCooldown = fireRate;
    }

    if (game.rapidTimer > 0) {
      game.rapidTimer--;
      if (game.rapidTimer === 0) {
        spawnPopup('RAPID END', surfer.x, surfer.y - 24, 'rgba(189,195,199,ALPHA)', 14);
      }
    }

    if (game.comboTimer > 0) {
      game.comboTimer--;
      if (game.comboTimer === 0 && game.combo > 0) {
        game.combo = 0;
      }
    }
  }

  function updateBullets() {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -30 || b.x < -30 || b.x > CANVAS_W + 30) {
        bullets.splice(i, 1);
        continue;
      }
      for (var j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (bulletHitsEnemy(b, e)) {
          e.hp -= b.dmg;
          e.hitFlash = 6;
          bullets.splice(i, 1);
          spawnParticles(b.x, b.y, '#1abc9c', 6, { spread: 4 });
          if (e.hp <= 0) killEnemy(j, false);
          break;
        }
      }
    }

    for (var k = enemyBullets.length - 1; k >= 0; k--) {
      var eb = enemyBullets[k];
      eb.x += eb.vx;
      eb.y += eb.vy;
      if (eb.x < -30 || eb.x > CANVAS_W + 30 || eb.y < -30 || eb.y > CANVAS_H + 30) {
        enemyBullets.splice(k, 1);
        continue;
      }
      if (enemyBulletHitsSurfer(eb)) {
        enemyBullets.splice(k, 1);
        damagePlayer(8);
      }
    }
  }

  function updateEnemies() {
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];

      if (e.type === 'boss') {
        if (!e.entered) {
          e.y += e.vy;
          if (e.y >= e.targetY) {
            e.entered = true;
            e.vy = 0;
          }
        } else {
          e.patternTimer++;
          // Move side-to-side
          e.phase += 0.015;
          e.x = CANVAS_W / 2 + Math.sin(e.phase) * (CANVAS_W * 0.32);
          e.y = e.targetY + Math.sin(e.phase * 1.4) * 18;

          if (e.shootCooldown > 0) e.shootCooldown--;
          if (e.shootCooldown <= 0) {
            // 3 patterns rotating
            var p = Math.floor(e.patternTimer / 240) % 3;
            if (p === 0) {
              // Aimed single
              spawnEnemyBullet(e);
              e.shootCooldown = 28;
            } else if (p === 1) {
              // Fan
              spawnBossFan(e, 7, Math.PI * 0.6);
              e.shootCooldown = 70;
            } else {
              // Ring
              spawnBossRing(e, 12);
              e.shootCooldown = 60;
            }
          }
        }
      } else {
        e.y += e.vy;
        if (e.type === 'jellyfish') {
          e.bobPhase += 0.06;
          e.x += Math.sin(e.bobPhase) * 0.6 + e.drift * 0.3;
        } else if (e.drift) {
          e.x += e.drift * 0.2;
        }

        if (e.shootCooldown > 0) {
          e.shootCooldown--;
          if (e.shootCooldown <= 0) {
            spawnEnemyBullet(e);
            e.shootCooldown = 100 + Math.random() * 90;
          }
        }
      }

      if (e.hitFlash > 0) e.hitFlash--;

      if (enemyHitsSurfer(e)) {
        if (e.type === 'boss') {
          damagePlayer(20);
          // small bounce
          e.y -= 4;
        } else {
          damagePlayer(e.type === 'puffer' ? 18 : 12);
          spawnParticles(surfer.x, surfer.y, '#e74c3c', 14);
          enemies.splice(i, 1);
          continue;
        }
      }

      // Off-screen cleanup
      if (e.y > CANVAS_H + 60 || e.x < -80 || e.x > CANVAS_W + 80) {
        enemies.splice(i, 1);
      }
    }
  }

  function updatePickups() {
    for (var i = pickups.length - 1; i >= 0; i--) {
      var p = pickups[i];
      p.y += p.vy;
      if (p.y > CANVAS_H + 30) {
        pickups.splice(i, 1);
        continue;
      }
      if (pickupHitsSurfer(p)) {
        collectPickup(p);
        pickups.splice(i, 1);
      }
    }
  }

  function collectPickup(p) {
    var cx = p.x, cy = p.y;
    if (p.type === 'shell') {
      addScore(20, cx, cy);
      spawnParticles(cx, cy, '#f1c40f', 12);
    } else if (p.type === 'star') {
      if (game.powerLevel < 5) {
        game.powerLevel++;
        spawnPopup('POWER LV ' + game.powerLevel, cx, cy, 'rgba(243,156,18,ALPHA)', 18);
      } else {
        addScore(50, cx, cy);
        spawnPopup('MAX +50', cx, cy, 'rgba(243,156,18,ALPHA)', 16);
      }
      spawnParticles(cx, cy, '#f39c12', 16);
    } else if (p.type === 'rapid') {
      game.rapidTimer = 60 * 8;
      game.rapidDuration = 60 * 8;
      spawnPopup('RAPID FIRE', cx, cy, 'rgba(0,210,255,ALPHA)', 16);
      spawnParticles(cx, cy, '#00d2ff', 16);
    } else if (p.type === 'heart') {
      var healed = Math.min(25, game.maxHp - game.hp);
      game.hp = Math.min(game.maxHp, game.hp + 25);
      spawnPopup('+' + healed + ' HP', cx, cy, 'rgba(231,76,60,ALPHA)', 16);
      spawnParticles(cx, cy, '#e74c3c', 16);
    } else if (p.type === 'shield') {
      game.shieldHp = 40;
      spawnPopup('SHIELD', cx, cy, 'rgba(183,148,244,ALPHA)', 16);
      spawnParticles(cx, cy, '#b794f4', 16);
    } else if (p.type === 'bomb') {
      game.bombs++;
      updateBombBadge();
      spawnPopup('+1 BOMB', cx, cy, 'rgba(231,76,60,ALPHA)', 16);
      spawnParticles(cx, cy, '#e74c3c', 16);
    }
  }

  function killEnemy(index, fromBomb) {
    var e = enemies[index];

    game.combo++;
    game.comboTimer = 90;
    if (game.combo > game.comboBest) game.comboBest = game.combo;
    var multiplier = Math.min(4, 1 + Math.floor(game.combo / 5) * 0.5);
    var earned = Math.round(e.score * multiplier);

    addScore(earned, e.x, e.y, multiplier);
    spawnParticles(e.x, e.y,
      e.type === 'boss' ? '#e74c3c' : '#1abc9c',
      e.type === 'boss' ? 50 : 14,
      { spread: e.type === 'boss' ? 8 : 5 });

    if (e.type === 'boss') {
      screenShake = 22;
      game.bossActive = false;
      pickups.push({ type: 'heart', x: e.x - 30, y: e.y, size: 30, vy: game.baseSpeed * 0.6, phase: 0 });
      pickups.push({ type: 'star', x: e.x, y: e.y, size: 30, vy: game.baseSpeed * 0.6, phase: 0 });
      pickups.push({ type: 'bomb', x: e.x + 30, y: e.y, size: 30, vy: game.baseSpeed * 0.6, phase: 0 });
      spawnPopup('BOSS DOWN!', CANVAS_W / 2, CANVAS_H / 2 - 40, 'rgba(241,196,15,ALPHA)', 28);
    } else {
      if (!fromBomb) screenShake = Math.max(screenShake, 3);
      if (Math.random() < 0.12) {
        pickups.push({
          type: Math.random() < 0.6 ? 'shell' : 'star',
          x: e.x, y: e.y,
          size: 24,
          vy: game.baseSpeed * 0.6,
          phase: 0
        });
      }
    }
    enemies.splice(index, 1);
  }

  function damagePlayer(amount) {
    if (surfer.invuln > 0) return;
    if (game.shieldHp > 0) {
      game.shieldHp -= amount;
      if (game.shieldHp <= 0) {
        game.shieldHp = 0;
      }
      surfer.invuln = 20;
      screenShake = 4;
      spawnPopup('BLOCK', surfer.x, surfer.y - 24, 'rgba(183,148,244,ALPHA)', 14);
      return;
    }
    game.combo = 0;
    game.comboTimer = 0;
    game.hp -= amount;
    if (game.powerLevel > 1 && amount >= 12) {
      game.powerLevel--;
      spawnPopup('POWER↓', surfer.x, surfer.y - 36, 'rgba(231,76,60,ALPHA)', 14);
    }
    surfer.invuln = 42;
    screenShake = 10;
    damageFlash = 22;
    spawnPopup('-' + amount, surfer.x, surfer.y - 22, 'rgba(231,76,60,ALPHA)', 16);
    if (game.hp <= 0) {
      game.hp = 0;
      gameOver();
    }
  }

  function addScore(v, x, y, multiplier) {
    game.score += v;
    if (x !== undefined && y !== undefined) {
      var label = '+' + v;
      if (multiplier && multiplier > 1) label += '  ×' + multiplier.toFixed(1);
      spawnPopup(label, x, y, 'rgba(26,188,156,ALPHA)', multiplier > 1 ? 18 : 14);
    }
    var newLevel = Math.floor(game.score / 130) + 1;
    if (newLevel > game.level) {
      game.level = newLevel;
      game.baseSpeed = 3.6 + (game.level - 1) * 0.45;
      spawnPopup('LEVEL ' + game.level, CANVAS_W / 2, 110, 'rgba(0,210,255,ALPHA)', 22);
    }
    if (game.score > bestScore) {
      bestScore = game.score;
      if (!game.newBest) game.newBest = true;
    }
  }

  function updateBombBadge() {
    if (btnBombCount) btnBombCount.textContent = game.bombs;
  }

  // ===== In-Game HUD =====
  function drawHUD() {
    var hudH = 64;
    // Background gradient
    var hudGrad = ctx.createLinearGradient(0, 0, 0, hudH + 8);
    hudGrad.addColorStop(0, 'rgba(10, 22, 40, 0.78)');
    hudGrad.addColorStop(1, 'rgba(10, 22, 40, 0)');
    ctx.fillStyle = hudGrad;
    ctx.fillRect(0, 0, CANVAS_W, hudH + 8);

    // Bottom divider line
    ctx.strokeStyle = 'rgba(26, 188, 156, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, hudH);
    ctx.lineTo(CANVAS_W, hudH);
    ctx.stroke();

    ctx.textBaseline = 'top';

    // Row 1: SCORE (left) — LV (center) — BEST (right)
    // SCORE
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(189, 195, 199, 0.85)';
    ctx.font = '700 9px Poppins, sans-serif';
    ctx.fillText('SCORE', 14, 8);
    ctx.fillStyle = '#1abc9c';
    ctx.font = '800 18px Poppins, sans-serif';
    ctx.fillText(game.score, 14, 18);

    // LV (center)
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(189, 195, 199, 0.85)';
    ctx.font = '700 9px Poppins, sans-serif';
    ctx.fillText('LEVEL', CANVAS_W / 2, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px Poppins, sans-serif';
    ctx.fillText(game.level, CANVAS_W / 2, 18);

    // BEST (right)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(189, 195, 199, 0.85)';
    ctx.font = '700 9px Poppins, sans-serif';
    ctx.fillText('BEST', CANVAS_W - 14, 8);
    ctx.fillStyle = '#f39c12';
    ctx.font = '800 16px Poppins, sans-serif';
    ctx.fillText('★ ' + bestScore, CANVAS_W - 14, 20);

    // Row 2: HP bar | POW | BOMB
    var hpX = 14, hpY = 46, hpW = 200, hpH = 10;
    // HP label
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(189, 195, 199, 0.85)';
    ctx.font = '700 8px Poppins, sans-serif';
    ctx.fillText('HP', hpX, hpY - 9);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(hpX, hpY, hpW, hpH);
    var hpRatio = Math.max(0, game.hp / game.maxHp);
    var hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpW, 0);
    hpGrad.addColorStop(0, '#e74c3c');
    hpGrad.addColorStop(0.55, '#f39c12');
    hpGrad.addColorStop(1, '#1abc9c');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpX, hpY, hpW * hpRatio, hpH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX, hpY, hpW, hpH);
    // HP number overlay
    ctx.fillStyle = '#fff';
    ctx.font = '700 9px Poppins, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(game.hp) + ' / ' + game.maxHp, hpX + hpW - 3, hpY + 1);

    // POW (between HP and BOMB)
    var powX = CANVAS_W - 70;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(189, 195, 199, 0.85)';
    ctx.font = '700 8px Poppins, sans-serif';
    ctx.fillText('POW', powX, hpY - 9);

    var powText = 'LV' + game.powerLevel;
    var powColor = '#1abc9c';
    if (game.shieldHp > 0) {
      powText = 'LV' + game.powerLevel + ' +S';
      powColor = '#b794f4';
    } else if (game.rapidTimer > 0) {
      powText = 'LV' + game.powerLevel + ' +R';
      powColor = '#00d2ff';
    } else if (game.powerLevel >= 4) {
      powColor = '#f39c12';
    } else if (game.powerLevel >= 2) {
      powColor = '#1abc9c';
    }
    ctx.fillStyle = powColor;
    ctx.font = '800 13px Poppins, sans-serif';
    ctx.fillText(powText, powX, hpY + 1);

    // BOMB (far right of HP row)
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(189, 195, 199, 0.85)';
    ctx.font = '700 8px Poppins, sans-serif';
    ctx.fillText('BOMB', CANVAS_W - 14, hpY - 9);
    ctx.fillStyle = '#e74c3c';
    ctx.font = '800 14px Poppins, sans-serif';
    ctx.fillText('💣 ' + game.bombs, CANVAS_W - 14, hpY);
  }

  // ===== Pause =====
  function pauseGame() {
    if (!game || !game.running || game.paused) return;
    game.paused = true;
    pauseBtn.textContent = '계속하기';
    drawPauseOverlay();
  }

  function resumeGame() {
    if (!game || !game.running || !game.paused) return;
    game.paused = false;
    pauseBtn.textContent = '일시정지';
    gameLoop();
  }

  function togglePause() {
    if (!game || !game.running) return;
    if (game.paused) resumeGame();
    else pauseGame();
  }

  function drawPauseOverlay() {
    applyRenderTransform();
    ctx.fillStyle = 'rgba(10, 22, 40, 0.75)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 4);
    ctx.fillStyle = '#1abc9c';
    ctx.font = '400 14px Poppins, sans-serif';
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
    } catch (e) {}
  }

  function drawGameOver() {
    applyRenderTransform();
    ctx.fillStyle = 'rgba(10, 22, 40, 0.85)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', CANVAS_W / 2, CANVAS_H / 2 - 70);
    ctx.fillStyle = '#1abc9c';
    ctx.font = '700 28px Poppins, sans-serif';
    ctx.fillText('Score ' + game.score, CANVAS_W / 2, CANVAS_H / 2 - 24);
    ctx.fillStyle = '#f1c40f';
    ctx.font = '600 18px Poppins, sans-serif';
    ctx.fillText('Lv. ' + game.level + ' · MAX 콤보 ' + game.comboBest, CANVAS_W / 2, CANVAS_H / 2 + 8);
    if (game.newBest) {
      ctx.fillStyle = '#f39c12';
      ctx.font = '700 22px Poppins, sans-serif';
      ctx.fillText('★ NEW BEST! ★', CANVAS_W / 2, CANVAS_H / 2 + 44);
    } else {
      ctx.fillStyle = '#bdc3c7';
      ctx.font = '400 15px Poppins, sans-serif';
      ctx.fillText('Best ' + bestScore, CANVAS_W / 2, CANVAS_H / 2 + 44);
    }
    ctx.fillStyle = '#bdc3c7';
    ctx.font = '400 13px Poppins, sans-serif';
    ctx.fillText('다시하기 버튼을 눌러 재도전', CANVAS_W / 2, CANVAS_H / 2 + 80);
  }

  function drawStartScreen() {
    applyRenderTransform();
    drawBackground();
    ctx.fillStyle = 'rgba(10, 22, 40, 0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 44px Poppins, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Wave Rider', CANVAS_W / 2, CANVAS_H / 2 - 90);

    ctx.fillStyle = '#1abc9c';
    ctx.font = '600 15px Poppins, sans-serif';
    ctx.fillText('파도를 가르며 바다 생물을 격파하라', CANVAS_W / 2, CANVAS_H / 2 - 60);

    ctx.fillStyle = '#bdc3c7';
    ctx.font = '400 13px Poppins, sans-serif';
    ctx.fillText('WASD / 방향키 — 이동', CANVAS_W / 2, CANVAS_H / 2 - 28);
    ctx.fillText('드래그(모바일) — 서퍼 조종', CANVAS_W / 2, CANVAS_H / 2 - 8);
    ctx.fillText('Q 또는 💣 — 폭탄', CANVAS_W / 2, CANVAS_H / 2 + 12);
    ctx.fillText('P / ESC — 일시정지', CANVAS_W / 2, CANVAS_H / 2 + 32);

    if (bestScore > 0) {
      ctx.fillStyle = '#f39c12';
      ctx.font = '700 16px Poppins, sans-serif';
      ctx.fillText('★ BEST ' + bestScore, CANVAS_W / 2, CANVAS_H / 2 + 70);
    }

    ctx.fillStyle = '#1abc9c';
    ctx.font = '400 13px Poppins, sans-serif';
    ctx.fillText('게임 시작 버튼을 눌러주세요', CANVAS_W / 2, CANVAS_H / 2 + 102);
  }

  // ===== Main Loop =====
  function gameLoop() {
    if (game.paused) return;
    game.time++;

    if (!game.running) {
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

    var spawnInterval = Math.max(20, 60 - game.level * 3);
    if (!game.bossActive && game.spawnTimer >= spawnInterval) {
      game.spawnTimer = 0;
      if (game.level >= 2 && Math.random() < 0.1) spawnFormation();
      else spawnEnemy();
    }

    if (game.pickupTimer >= 300 - Math.min(150, game.level * 8)) {
      game.pickupTimer = 0;
      spawnPickup();
    }

    if (!game.bossActive && game.level >= 5 && game.level % 5 === 0 && game.bossSpawnedForLevel !== game.level) {
      game.bossSpawnedForLevel = game.level;
      enemies.length = 0;
      enemyBullets.length = 0;
      spawnBoss();
    }

    updateSurfer();
    updateBullets();
    updateEnemies();
    updatePickups();

    var shakeX = 0, shakeY = 0;
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

    for (var pi = 0; pi < pickups.length; pi++) drawPickup(pickups[pi]);
    for (var bi = 0; bi < bullets.length; bi++) drawBullet(bullets[bi]);
    drawParticles();
    for (var ei = 0; ei < enemies.length; ei++) drawEnemy(enemies[ei]);
    for (var ebi = 0; ebi < enemyBullets.length; ebi++) drawBullet(enemyBullets[ebi]);

    drawSurfer();
    drawPopups();

    // In-canvas HUD (score / hp / level / best / power / bomb)
    drawHUD();

    // Boss HP bar BELOW the HUD (top, just under HUD divider)
    var boss = null;
    for (var bi2 = 0; bi2 < enemies.length; bi2++) {
      if (enemies[bi2].type === 'boss') { boss = enemies[bi2]; break; }
    }
    if (boss) {
      var barW = CANVAS_W - 40;
      var barH = 10;
      var bx = 20, by = 72;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, barW, barH);
      var ratio = Math.max(0, boss.hp / boss.maxHp);
      var bossGrad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
      bossGrad.addColorStop(0, '#e74c3c');
      bossGrad.addColorStop(1, '#f39c12');
      ctx.fillStyle = bossGrad;
      ctx.fillRect(bx, by, barW * ratio, barH);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.fillStyle = '#fff';
      ctx.font = '700 10px Poppins, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KRAKEN', CANVAS_W / 2, by + 9);
    }

    // Combo HUD (below the top HUD)
    if (game.combo >= 3) {
      var alpha = Math.min(1, game.comboTimer / 60);
      var comboY = boss ? 100 : 90;
      ctx.font = '800 22px Poppins, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(0,0,0,' + (alpha * 0.4) + ')';
      ctx.fillText(game.combo + ' COMBO', CANVAS_W - 14, comboY + 2);
      ctx.fillStyle = 'rgba(243, 156, 18,' + alpha + ')';
      ctx.fillText(game.combo + ' COMBO', CANVAS_W - 16, comboY);
      var mult = Math.min(4, 1 + Math.floor(game.combo / 5) * 0.5);
      if (mult > 1) {
        ctx.font = '700 14px Poppins, sans-serif';
        ctx.fillStyle = 'rgba(241, 196, 15,' + alpha + ')';
        ctx.fillText('×' + mult.toFixed(1), CANVAS_W - 16, comboY + 20);
      }
    }

    // Rapid timer (thin bar just under HUD on left)
    if (game.rapidTimer > 0 && game.rapidDuration > 0) {
      var pw = 110;
      var rRatio = game.rapidTimer / game.rapidDuration;
      var rapidY = boss ? 88 : 70;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(14, rapidY, pw, 4);
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(14, rapidY, pw * rRatio, 4);
    }

    if (damageFlash > 0) {
      ctx.fillStyle = 'rgba(231, 76, 60, ' + (damageFlash / 60) + ')';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      damageFlash--;
    }
    if (bombFlash > 0) {
      ctx.fillStyle = 'rgba(255, 235, 180, ' + (bombFlash / 50) + ')';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      bombFlash--;
    }

    ctx.restore();

    game.animId = requestAnimationFrame(gameLoop);
  }

  // ===== Controls =====
  function resetGame() {
    if (game) cancelAnimationFrame(game.animId);
    initState();
    updateBombBadge();
    pauseBtn.textContent = '일시정지';
    startBtn.textContent = '게임 시작';
    drawStartScreen();
  }

  startBtn.addEventListener('click', function () {
    if (!game) return;
    // Always ensure fullscreen (user gesture required for the request to succeed).
    enterFullscreen();

    if (!game.running || game.over) {
      // Fresh start (initial or after game over).
      resetGame();
      game.running = true;
      startBtn.textContent = '이어하기';
      gameLoop();
    } else if (game.paused) {
      // Resume from a paused state.
      resumeGame();
    }
    // else: already running and in fullscreen — no-op.
  });

  resetBtn.addEventListener('click', function () {
    resetGame();
  });

  pauseBtn.addEventListener('click', function () {
    togglePause();
  });

  // ===== Fullscreen =====
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function enterFullscreen() {
    if (isFullscreen()) return;
    try {
      if (canvasWrap.requestFullscreen) {
        var p = canvasWrap.requestFullscreen();
        if (p && p.catch) p.catch(function () {});
      } else if (canvasWrap.webkitRequestFullscreen) {
        canvasWrap.webkitRequestFullscreen();
      }
    } catch (e) {}
  }

  function exitFullscreenIfNeeded() {
    if (!isFullscreen()) return;
    try {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) {}
  }

  function toggleFullscreen() {
    if (isFullscreen()) exitFullscreenIfNeeded();
    else enterFullscreen();
  }

  function onFullscreenChange() {
    if (isFullscreen()) {
      canvasWrap.classList.add('is-fullscreen');
      fullscreenBtn.textContent = '전체화면 해제';
    } else {
      canvasWrap.classList.remove('is-fullscreen');
      fullscreenBtn.textContent = '전체화면';
      // Exiting fullscreen during gameplay → auto-pause.
      if (game && game.running && !game.paused && !game.over) {
        pauseGame();
      }
    }
    setTimeout(scheduleResize, 50);
    setTimeout(scheduleResize, 250);
  }

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
  var btnFullscreenOverlay = document.getElementById('btnFullscreen');
  if (btnFullscreenOverlay) btnFullscreenOverlay.addEventListener('click', toggleFullscreen);

  // F key as fullscreen shortcut
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'f' || e.key === 'F') && !e.repeat) {
      // Avoid triggering inside input fields
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      toggleFullscreen();
    }
  });

  // Initial
  initState();
  updateBombBadge();
  resizeCanvasBacking();
  drawStartScreen();
  // Some browsers don't fire ResizeObserver synchronously on first render.
  setTimeout(scheduleResize, 0);
})();
