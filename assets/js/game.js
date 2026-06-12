const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameImages = {
  background: new Image(),
  islandFrames: [new Image(), new Image()],
  playerFrames: [new Image(), new Image()],
  stampBase: new Image(),
  stampMarks: [
    new Image(),
    new Image(),
    new Image(),
    new Image(),
    new Image(),
    new Image(),
  ],
};

gameImages.background.src = "../assets/images/game-ocean-perspective-bg.png";
gameImages.islandFrames[0].src = "../assets/images/game-island-frame-1.png";
gameImages.islandFrames[1].src = "../assets/images/game-island-frame-2.png";
gameImages.playerFrames[0].src = "../assets/images/game-player-frame-1.png";
gameImages.playerFrames[1].src = "../assets/images/game-player-frame-2.png";
gameImages.stampBase.src = "../assets/images/stamp-base-blank.png";

const stampMarkSources = [
  "../assets/images/stamp-icon-shell.png",
  "../assets/images/stamp-icon-clam.png",
  "../assets/images/stamp-icon-turtle.png",
  "../assets/images/stamp-icon-shrimp.png",
  "../assets/images/stamp-icon-crab.png",
  "../assets/images/stamp-icon-wave.png",
];

gameImages.stampMarks.forEach((image, index) => {
  image.src = stampMarkSources[index];
});

gameImages.islandFrames.forEach((image, index) => {
  image.addEventListener("load", () => {
    gameImages.islandFrames[index] = createTransparentIslandImage(image);
  });

  if (image.complete && image.naturalWidth > 0) {
    gameImages.islandFrames[index] = createTransparentIslandImage(image);
  }
});

const scoreText = document.getElementById("scoreText");
const levelText = document.getElementById("levelText");
const bestText = document.getElementById("bestText");
const lifeText = document.getElementById("lifeText");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const resultText = document.getElementById("resultText");
const beachGrid = document.getElementById("beachGrid");
const stampMessage = document.getElementById("stampMessage");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const againBtn = document.getElementById("againBtn");
const resetStampBtn = document.getElementById("resetStampBtn");

const beaches = [
  {
    id: "yangyang",
    name: "양양 서피비치",
    region: "강원",
    info: "입문자에게 인기 있는 대표 서핑 스팟. 넓은 모래 해변과 청량한 분위가 특징입니다.",
    image: "../assets/images/yangyang-surf-beach.jpg",
  },
  {
    id: "songjeong",
    name: "송정 해수욕장",
    region: "부산",
    info: "도심 접근성이 좋고 서핑 강습이 활발한 부산의 대표 해변입니다.",
    image: "../assets/images/songjung-beach.jpg",
  },
  {
    id: "jungmun",
    name: "중문 색달해변",
    region: "제주",
    info: "이국적인 풍경과 강한 파도로 유명한 제주 서핑 명소입니다.",
    image: "../assets/images/jungmun-beach.jpg",
  },
  {
    id: "manripo",
    name: "만리포 해수욕장",
    region: "충남",
    info: "서해안에서 서핑을 즐기기 좋은 넓은 해변입니다.",
    image: "../assets/images/mallipo-beach.jpg",
  },
  {
    id: "hyeopjae",
    name: "협재 해변",
    region: "제주",
    info: "맑은 바다색과 감성적인 해변 풍경으로 인기 있는 스팟입니다.",
    image: "../assets/images/hyeopjae-beach.jpg",
  },
  {
    id: "goseong",
    name: "봉포 해수욕장",
    region: "고성",
    info: "윈드서핑과 서핑을 함께 즐기기 좋은 동해안 해변입니다.",
    image: "../assets/images/bongpo-beach.jpg",
  },
  {
    id: "gangreung",
    name: "경포 해수욕장",
    region: "강릉",
    info: "파도 컨디션이 좋아 경험자에게도 매력적인 서핑 포인트입니다.",
    image: "../assets/images/gyeongpo-beach.jpg",
  },
];

const game = {
  running: false,
  frame: 0,
  score: 0,
  level: 1,
  life: 3,
  best: Number(localStorage.getItem("surfBestScore")) || 0,
  isles: [],
  stamps: [],
  keys: {},
  touch: { active: false, x: 0, y: 0 },
};

const player = {
  x: canvas.width / 2 - 39,
  y: canvas.height - 118,
  w: 78,
  h: 104,
  speed: 5.5,
  invincible: 0,
};

let unlockedStampIds = JSON.parse(localStorage.getItem("surfStampIds")) || [];

function saveStamps() {
  localStorage.setItem("surfStampIds", JSON.stringify(unlockedStampIds));
}

function fallbackBeachArt() {
  return '<div class="beach-art fallback-art"><span>surf spot</span></div>';
}

function renderBeachDex() {
  beachGrid.innerHTML = "";

  beaches.forEach((beach, index) => {
    const isUnlocked = unlockedStampIds.includes(beach.id);
    const card = document.createElement("article");
    card.className = `beach-card ${isUnlocked ? "" : "locked"}`;

    if (isUnlocked) {
      const markSrc = stampMarkSources[index % stampMarkSources.length];

      card.innerHTML = `
        <img class="beach-art" src="${beach.image}" alt="${beach.name}">
        <div class="stamp dex-stamp" aria-label="획득 스탬프">
          <img class="stamp-base" src="../assets/images/stamp-base-blank.png" alt="">
          <img class="stamp-mark" src="${markSrc}" alt="">
        </div>
        <h3>${beach.name}</h3>
        <p><strong>${beach.region}</strong> · ${beach.info}</p>
      `;

      const img = card.querySelector("img.beach-art");
      img.addEventListener("error", () => {
        img.outerHTML = fallbackBeachArt();
      });
    } else {
      card.innerHTML = `
        <div class="beach-art locked-art"></div>
        <h3>잠긴 해변</h3>
        <p>게임을 플레이하고 랜덤 스탬프를 획득하면 정보가 열립니다.</p>
      `;
    }

    beachGrid.appendChild(card);
  });
}

function resetGame() {
  game.running = true;
  game.frame = 0;
  game.score = 0;
  game.level = 1;
  game.life = 3;
  game.isles = [];
  game.stamps = [];

  player.x = canvas.width / 2 - player.w / 2;
  player.y = canvas.height - 118;
  player.invincible = 0;

  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  stampMessage.textContent = "파도를 타며 섬을 피해 보세요!";
  updateInfo();
}

function updateInfo() {
  scoreText.textContent = game.score;
  levelText.textContent = game.level;
  lifeText.textContent = game.life;
  bestText.textContent = game.best;
}

function spawnIsle() {
  const sizes = [
    { w: 96, h: 96 },
    { w: 116, h: 116 },
    { w: 136, h: 136 },
  ];

  const { w: baseW, h: baseH } = sizes[Math.floor(Math.random() * sizes.length)];
  const startScale = 0.40 + Math.random() * 0.08;
  const startW = baseW * startScale;
  const startH = baseH * startScale;

  // 6개 레인: 좌/중앙/우측 수직 레인 + 좌우 사선 레인.
  // start는 화면 위쪽 생성 위치, end는 플레이어 근처 도착 위치 비율이다.
  const lanes = [
    { start: 0.36, end: 0.18 },
    { start: 0.43, end: 0.34 },
    { start: 0.49, end: 0.49 },
    { start: 0.57, end: 0.64 },
    { start: 0.64, end: 0.78 },
    { start: 0.72, end: 0.92 },
  ];

  const laneIndex = Math.floor(Math.random() * lanes.length);
  const lane = lanes[laneIndex];

  const topJitter = (Math.random() - 0.5) * canvas.width * 0.045;
  const bottomJitter = (Math.random() - 0.5) * canvas.width * 0.055;

  const startCenterX = canvas.width * lane.start + topJitter;
  const endCenterX = canvas.width * lane.end + bottomJitter;

  game.isles.push({
    x: startCenterX - startW / 2,
    y: -startH - Math.random() * 80,
    startCenterX,
    endCenterX,
    cx: startCenterX,
    laneIndex,
    baseW,
    baseH,
    w: startW,
    h: startH,
    vy: 2.35 + game.level * 0.22 + Math.random() * 0.42,
    vx: 0,
    frameOffset: Math.floor(Math.random() * 20),
    rotation: (Math.random() - 0.5) * 0.12,
    hit: false,
  });
}

function updatePlayer() {
  if (game.keys.ArrowLeft || game.keys.a || game.keys.A) player.x -= player.speed;
  if (game.keys.ArrowRight || game.keys.d || game.keys.D) player.x += player.speed;
  if (game.keys.ArrowUp || game.keys.w || game.keys.W) player.y -= player.speed;
  if (game.keys.ArrowDown || game.keys.s || game.keys.S) player.y += player.speed;

  if (game.touch.active) {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    const dx = game.touch.x - cx;
    const dy = game.touch.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > player.speed) {
      player.x += (dx / dist) * player.speed;
      player.y += (dy / dist) * player.speed;
    }
  }

  clampPlayerPosition();

  if (player.invincible > 0) player.invincible -= 1;
}

function ellipsesOverlap(a, b) {
  const cx1 = a.x + a.w / 2;
  const cy1 = a.y + a.h / 2;
  const cx2 = b.x + b.w / 2;
  const cy2 = b.y + b.h / 2;
  const rx = a.w / 2 + b.w / 2;
  const ry = a.h / 2 + b.h / 2;
  const dx = cx1 - cx2;
  const dy = cy1 - cy2;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
}

function getIsleHitbox(isle) {
  return {
    x: isle.x + isle.w * 0.15,
    y: isle.y + isle.h * 0.20,
    w: isle.w * 0.70,
    h: isle.h * 0.62,
  };
}


function getPlayerBounds() {
  return {
    minX: 10,
    maxX: canvas.width - player.w - 10,
    minY: canvas.height * 0.50,
    maxY: canvas.height - player.h - 10,
  };
}

function clampPlayerPosition() {
  const bounds = getPlayerBounds();
  player.x = Math.max(bounds.minX, Math.min(bounds.maxX, player.x));
  player.y = Math.max(bounds.minY, Math.min(bounds.maxY, player.y));
}


function updateIsles() {
  const applyPerspective = (isle) => {
    const perspectiveProgress = Math.max(0, Math.min(1, (isle.y + isle.baseH * 0.35) / canvas.height));
    const easedProgress = perspectiveProgress * perspectiveProgress * (3 - 2 * perspectiveProgress);
    const scale = 0.42 + perspectiveProgress * 1.18;

    isle.w = isle.baseW * scale;
    isle.h = isle.baseH * scale;

    // 레인 시작점에서 도착점으로 부드럽게 보간해서 사선/수직 경로를 만든다.
    const startX = isle.startCenterX ?? isle.cx;
    const endX = isle.endCenterX ?? isle.cx;
    isle.cx = startX + (endX - startX) * easedProgress;

    // 화면 끝에서 튕기지 않도록 x 보정을 하지 않는다.
    // 레인 도착점이 화면 밖에 있으면 그대로 화면 밖으로 빠져나간다.
    isle.x = isle.cx - isle.w / 2;
  };

  game.isles.forEach((isle) => {
    isle.y += isle.vy;
    applyPerspective(isle);
  });

  // 같은 레인 안에서만 뒤 섬이 앞 섬을 추월하지 못하게 한다.
  const minGap = 84;
  const laneGroups = new Map();

  game.isles.forEach((isle) => {
    const key = isle.laneIndex ?? 0;
    if (!laneGroups.has(key)) laneGroups.set(key, []);
    laneGroups.get(key).push(isle);
  });

  laneGroups.forEach((laneIsles) => {
    laneIsles.sort((a, b) => b.y - a.y); // 더 아래쪽에 있는 섬이 앞 섬
    for (let i = 1; i < laneIsles.length; i += 1) {
      const frontIsle = laneIsles[i - 1];
      const backIsle = laneIsles[i];

      if (backIsle.y > frontIsle.y - minGap) {
        backIsle.y = frontIsle.y - minGap;
        backIsle.vy = Math.min(backIsle.vy, frontIsle.vy);
        applyPerspective(backIsle);
      }
    }
  });

  for (let i = game.isles.length - 1; i >= 0; i -= 1) {
    const isle = game.isles[i];

    if (!isle.hit && player.invincible === 0 && ellipsesOverlap(player, getIsleHitbox(isle))) {
      isle.hit = true;
      game.life -= 1;
      player.invincible = 80;

      if (game.life <= 0) {
        endGame();
        return;
      }
    }

    if (
      isle.y > canvas.height + isle.h + 40 ||
      isle.x > canvas.width + isle.w + 80 ||
      isle.x + isle.w < -isle.w - 80
    ) {
      game.isles.splice(i, 1);
    }
  }
}

function spawnStamp() {
  const locked = beaches.filter((beach) => !unlockedStampIds.includes(beach.id));
  if (locked.length === 0) return;

  const beach = locked[Math.floor(Math.random() * locked.length)];
  const num = beaches.indexOf(beach) + 1;

  const baseW = 64;
  const baseH = 64;
  const startScale = 0.36 + Math.random() * 0.10;
  const startW = baseW * startScale;
  const startH = baseH * startScale;

  const centerX = canvas.width * 0.5;
  const laneHalfWidth = Math.min(115, canvas.width * 0.27);
  const topSpread = laneHalfWidth * 0.55;
  const startCenterX = centerX + (Math.random() - 0.5) * topSpread;

  game.stamps.push({
    x: startCenterX - startW / 2,
    y: -startH - Math.random() * 90,
    cx: startCenterX,
    baseW,
    baseH,
    w: startW,
    h: startH,
    vy: 2.15 + game.level * 0.20 + Math.random() * 0.75,
    vx: 0,
    num,
    rotation: (Math.random() - 0.5) * 0.24,
    collected: false,
  });
}

function updateStamps() {
  for (let i = game.stamps.length - 1; i >= 0; i -= 1) {
    const stamp = game.stamps[i];

    stamp.y += stamp.vy;

    const perspectiveProgress = Math.max(0, Math.min(1, (stamp.y + stamp.baseH * 0.3) / canvas.height));
    const scale = 0.36 + perspectiveProgress * 0.88;

    stamp.w = stamp.baseW * scale;
    stamp.h = stamp.baseH * scale;
    stamp.cx += stamp.vx;

    const laneHalfWidth = Math.min(115, canvas.width * 0.27);
    const minCenterX = canvas.width * 0.5 - laneHalfWidth + stamp.w / 2;
    const maxCenterX = canvas.width * 0.5 + laneHalfWidth - stamp.w / 2;
    stamp.cx = Math.max(minCenterX, Math.min(maxCenterX, stamp.cx));
    stamp.x = stamp.cx - stamp.w / 2;

    if (!stamp.collected && ellipsesOverlap(player, stamp)) {
      stamp.collected = true;
      earnStampByNum(stamp.num);
    }

    if (stamp.y > canvas.height + stamp.h + 40 || stamp.collected) {
      game.stamps.splice(i, 1);
    }
  }
}

function updateGame() {
  game.frame += 1;
  game.score += 1;
  game.level = Math.floor(game.score / 450) + 1;

  const spawnInterval = Math.max(22, 60 - game.level * 4);
  const maxIsles = game.level >= 3 ? 5 : 4;
  if (game.isles.length < maxIsles && game.frame % spawnInterval === 0) {
    spawnIsle();
  }
  if (game.frame % 300 === 0) spawnStamp();

  updatePlayer();
  updateIsles();
  updateStamps();
  updateInfo();
}


function drawCoverImage(image, x, y, width, height) {
  if (!image.complete || image.naturalWidth === 0) return false;

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = image.naturalWidth;
  let sh = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sw = image.naturalHeight * targetRatio;
    sx = (image.naturalWidth - sw) / 2;
  } else {
    sh = image.naturalWidth / targetRatio;
    sy = (image.naturalHeight - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
  return true;
}

function drawContainImage(image, x, y, width, height, rotation = 0) {
  const imageWidth = image.naturalWidth || image.width || 0;
  const imageHeight = image.naturalHeight || image.height || 0;
  if (!image || image.complete === false || imageWidth === 0 || imageHeight === 0) return false;

  const scale = Math.min(width / imageWidth, height / imageHeight);
  const drawW = imageWidth * scale;
  const drawH = imageHeight * scale;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return true;
}

function createTransparentIslandImage(image) {
  const offscreen = document.createElement("canvas");
  offscreen.width = image.naturalWidth;
  offscreen.height = image.naturalHeight;

  const offscreenCtx = offscreen.getContext("2d");
  offscreenCtx.drawImage(image, 0, 0);

  const imageData = offscreenCtx.getImageData(0, 0, offscreen.width, offscreen.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    if (red < 38 && green < 38 && blue < 38) {
      data[i + 3] = 0;
    }
  }

  offscreenCtx.putImageData(imageData, 0, 0);
  return offscreen;
}

function drawBackground() {
  const hasBackgroundImage = drawCoverImage(gameImages.background, 0, 0, canvas.width, canvas.height);

  if (!hasBackgroundImage) {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#114fcf");
    sky.addColorStop(0.58, "#088df1");
    sky.addColorStop(1, "#11c4ec");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawPlayer() {
  ctx.save();
  ctx.globalAlpha = player.invincible > 0 && game.frame % 8 < 4 ? 0.45 : 1;

  const frameIndex = Math.floor(game.frame / 10) % gameImages.playerFrames.length;
  const playerImage = gameImages.playerFrames[frameIndex];

  const drewImage = drawContainImage(
    playerImage,
    player.x - player.w * 0.28,
    player.y - player.h * 0.20,
    player.w * 1.56,
    player.h * 1.38,
    -0.03
  );

  if (!drewImage) {
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.rotate(-0.22);

    ctx.fillStyle = "#ff3b23";
    ctx.beginPath();
    ctx.ellipse(0, 0, player.w / 2, player.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawIsle(isle) {
  ctx.save();

  if (isle.hit) {
    ctx.globalAlpha = 0.62;
  }

  const frameIndex = Math.floor((game.frame + (isle.frameOffset || 0)) / 12) % gameImages.islandFrames.length;
  const islandImage = gameImages.islandFrames[frameIndex];

  const drewImage = drawContainImage(
    islandImage,
    isle.x - isle.w * 0.08,
    isle.y - isle.h * 0.10,
    isle.w * 1.16,
    isle.h * 1.20,
    isle.rotation || 0
  );

  if (!drewImage) {
    ctx.translate(isle.x + isle.w / 2, isle.y + isle.h / 2);
    ctx.fillStyle = isle.hit ? "#ff938d" : "#ffe0a3";
    ctx.beginPath();
    ctx.ellipse(0, 0, isle.w / 2, isle.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStamp(stamp) {
  ctx.save();

  const rotation = stamp.rotation || 0;
  const markImage = gameImages.stampMarks[(stamp.num - 1) % gameImages.stampMarks.length];

  const baseDrawn = drawContainImage(
    gameImages.stampBase,
    stamp.x,
    stamp.y,
    stamp.w,
    stamp.h,
    rotation
  );

  if (baseDrawn) {
    drawContainImage(
      markImage,
      stamp.x + stamp.w * 0.25,
      stamp.y + stamp.h * 0.25,
      stamp.w * 0.50,
      stamp.h * 0.50,
      rotation
    );
  }

  if (!baseDrawn) {
    const r = stamp.w / 2;
    ctx.translate(stamp.x + r, stamp.y + r);
    ctx.rotate(rotation);

    ctx.fillStyle = "#fff2d4";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ff4a32";
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGame() {
  drawBackground();

  [...game.isles].reverse().forEach(drawIsle);

  game.stamps.forEach(drawStamp);
  drawPlayer();
}

function loop() {
  if (game.running) updateGame();
  drawGame();
  requestAnimationFrame(loop);
}

function earnStampByNum(num) {
  const beach = beaches[num - 1];
  if (!beach) return;

  if (unlockedStampIds.includes(beach.id)) {
    stampMessage.textContent = `${beach.name} 스탬프는 이미 보유 중입니다.`;
    return;
  }

  unlockedStampIds.push(beach.id);
  saveStamps();
  renderBeachDex();
  stampMessage.textContent = `새 스탬프 획득: ${beach.name}`;
}

function endGame() {
  game.running = false;
  game.best = Math.max(game.best, game.score);
  localStorage.setItem("surfBestScore", String(game.best));

  resultText.textContent = `점수 ${game.score} / 레벨 ${game.level}`;
  gameOverOverlay.classList.remove("hidden");
  updateInfo();
}

window.addEventListener("keydown", (event) => {
  game.keys[event.key] = true;

  const moveKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "w", "a", "s", "d", "W", "A", "S", "D"];
  if (moveKeys.includes(event.key)) event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  game.keys[event.key] = false;
});

function updateTouchTarget(event) {
  const touch = event.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  game.touch.x = (touch.clientX - rect.left) * scaleX;
  game.touch.y = (touch.clientY - rect.top) * scaleY;
  game.touch.active = true;
}

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  updateTouchTarget(event);
});

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  updateTouchTarget(event);
});

canvas.addEventListener("touchend", (event) => {
  event.preventDefault();
  game.touch.active = false;
});

startBtn.addEventListener("click", resetGame);
restartBtn.addEventListener("click", resetGame);
againBtn.addEventListener("click", resetGame);

resetStampBtn.addEventListener("click", () => {
  unlockedStampIds = [];
  saveStamps();
  renderBeachDex();
  stampMessage.textContent = "도감이 초기화되었습니다.";
});

renderBeachDex();
updateInfo();
drawGame();
loop();
