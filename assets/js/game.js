const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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
};

const player = {
  x: canvas.width / 2 - 22,
  y: canvas.height - 92,
  w: 44,
  h: 68,
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

  beaches.forEach((beach) => {
    const isUnlocked = unlockedStampIds.includes(beach.id);
    const card = document.createElement("article");
    card.className = `beach-card ${isUnlocked ? "" : "locked"}`;

    if (isUnlocked) {
      card.innerHTML = `
        <img class="beach-art" src="${beach.image}" alt="${beach.name}">
        <div class="stamp">stamp</div>
        <h3>${beach.name}</h3>
        <p><strong>${beach.region}</strong> · ${beach.info}</p>
      `;

      const img = card.querySelector("img");
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
  player.y = canvas.height - 92;
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
    { w: 72, h: 58 },
    { w: 100, h: 82 },
    { w: 132, h: 106 },
  ];
  const { w, h } = sizes[Math.floor(Math.random() * sizes.length)];
  const randomType = Math.random();
  let color = "#fff0cd";
  let detail = "#2aab60";

  if (randomType < 0.33) {
    color = "#ffe0a3";
    detail = "#138b56";
  } else if (randomType < 0.66) {
    color = "#ffd28a";
    detail = "#196f3d";
  }

  game.isles.push({
    x: Math.random() * (canvas.width - w),
    y: -h - Math.random() * 120,
    w,
    h,
    vy: 2.4 + game.level * 0.28 + Math.random() * 1.2,
    color,
    detail,
    hit: false,
  });
}

function updatePlayer() {
  if (game.keys.ArrowLeft || game.keys.a || game.keys.A) player.x -= player.speed;
  if (game.keys.ArrowRight || game.keys.d || game.keys.D) player.x += player.speed;
  if (game.keys.ArrowUp || game.keys.w || game.keys.W) player.y -= player.speed;
  if (game.keys.ArrowDown || game.keys.s || game.keys.S) player.y += player.speed;

  player.x = Math.max(10, Math.min(canvas.width - player.w - 10, player.x));
  player.y = Math.max(10, Math.min(canvas.height - player.h - 10, player.y));

  if (player.invincible > 0) player.invincible -= 1;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function updateIsles() {
  for (let i = game.isles.length - 1; i >= 0; i -= 1) {
    const isle = game.isles[i];
    isle.y += isle.vy;

    if (!isle.hit && player.invincible === 0 && rectsOverlap(player, isle)) {
      isle.hit = true;
      game.life -= 1;
      player.invincible = 80;

      if (game.life <= 0) {
        endGame();
        return;
      }
    }

    if (isle.y > canvas.height + 40) {
      game.isles.splice(i, 1);
    }
  }
}

function spawnStamp() {
  const size = 48;
  const locked = beaches.filter((beach) => !unlockedStampIds.includes(beach.id));
  if (locked.length === 0) return;

  const beach = locked[Math.floor(Math.random() * locked.length)];
  const num = beaches.indexOf(beach) + 1;
  game.stamps.push({
    x: Math.random() * (canvas.width - size),
    y: -size - 10,
    w: size,
    h: size,
    vy: 2.2 + Math.random() * 0.8,
    num,
    collected: false,
  });
}

function updateStamps() {
  for (let i = game.stamps.length - 1; i >= 0; i -= 1) {
    const stamp = game.stamps[i];
    stamp.y += stamp.vy;

    if (!stamp.collected && rectsOverlap(player, stamp)) {
      stamp.collected = true;
      earnStampByNum(stamp.num);
    }

    if (stamp.y > canvas.height + 40 || stamp.collected) {
      game.stamps.splice(i, 1);
    }
  }
}

function updateGame() {
  game.frame += 1;
  game.score += 1;
  game.level = Math.floor(game.score / 450) + 1;

  const spawnInterval = Math.max(22, 60 - game.level * 4);
  if (game.frame % spawnInterval === 0) spawnIsle();
  if (game.frame % 300 === 0) spawnStamp();

  updatePlayer();
  updateIsles();
  updateStamps();
  updateInfo();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#11bff0");
  sky.addColorStop(0.55, "#20c3ef");
  sky.addColorStop(1, "#0878df");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i += 1) {
    const y = (game.frame * 1.2 + i * 98) % (canvas.height + 120) - 80;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 40) {
      ctx.quadraticCurveTo(x + 20, y + 15, x + 40, y);
    }
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.globalAlpha = player.invincible > 0 && game.frame % 8 < 4 ? 0.45 : 1;
  ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
  ctx.rotate(-0.22);

  ctx.fillStyle = "#ff3b23";
  ctx.beginPath();
  ctx.ellipse(0, 0, player.w / 2, player.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff2d4";
  ctx.beginPath();
  ctx.ellipse(0, 0, player.w / 4, player.h / 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#071a4d";
  ctx.beginPath();
  ctx.arc(0, -8, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-6, 2, 12, 24);
  ctx.restore();
}

function drawIsle(isle) {
  ctx.save();
  ctx.translate(isle.x + isle.w / 2, isle.y + isle.h / 2);

  ctx.fillStyle = isle.hit ? "#ff938d" : isle.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, isle.w / 2, isle.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isle.detail;
  ctx.beginPath();
  ctx.ellipse(-isle.w * 0.12, -isle.h * 0.08, isle.w * 0.18, isle.h * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(isle.w * 0.18, isle.h * 0.05, isle.w * 0.14, isle.h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(7, 26, 77, 0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawStamp(stamp) {
  const r = stamp.w / 2;
  ctx.save();
  ctx.translate(stamp.x + r, stamp.y + r);

  ctx.fillStyle = "#d0021b";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 11px sans-serif";
  ctx.fillText("stamp", 0, -6);

  ctx.font = "bold 13px sans-serif";
  ctx.fillText(`#${stamp.num}`, 0, 8);

  ctx.restore();
}

function drawGame() {
  drawBackground();
  game.isles.forEach(drawIsle);
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

function moveByTouch(event) {
  const touch = event.touches[0];
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  player.x = (touch.clientX - rect.left) * scaleX - player.w / 2;
  player.y = (touch.clientY - rect.top) * scaleY - player.h / 2;
  player.x = Math.max(10, Math.min(canvas.width - player.w - 10, player.x));
  player.y = Math.max(10, Math.min(canvas.height - player.h - 10, player.y));
}

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  moveByTouch(event);
});

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  moveByTouch(event);
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
