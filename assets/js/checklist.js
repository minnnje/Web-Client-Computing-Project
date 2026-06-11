const themes = {
  surf: {
    title: "서핑 데이",
    items: ["래시가드", "비치 타월", "선크림", "여벌 옷", "방수팩", "슬리퍼", "물병", "간단한 간식"]
  },
  healing: {
    title: "힐링 비치",
    items: ["돗자리", "선글라스", "모자", "카메라", "간식", "보조배터리", "가벼운 책", "얇은 겉옷"]
  },
  overnight: {
    title: "1박 여행",
    items: ["세면도구", "잠옷", "충전기", "상비약", "여분 수건", "숙소 예약 확인", "속옷", "작은 가방"]
  }
};

const themeTitle = document.getElementById("theme-title");
const checkList = document.getElementById("check-list");
const progressBar = document.getElementById("progress-bar");
const progressCount = document.getElementById("progress-count");
const statusMessage = document.getElementById("status-message");
const completeBanner = document.getElementById("complete-banner");
const confettiLayer = document.getElementById("confetti-layer");
const newItem = document.getElementById("new-item");
const addBtn = document.getElementById("add-btn");
const clearDone = document.getElementById("clear-done");
const resetBtn = document.getElementById("reset-btn");
let currentTheme = "surf";
let items = [];
let wasComplete = false;

function loadTheme(theme) {
  currentTheme = theme;
  wasComplete = false;
  const saved = localStorage.getItem(`checklist-${theme}`);
  items = saved ? JSON.parse(saved) : themes[theme].items.map((text) => ({ text, done: false }));
  themeTitle.textContent = themes[theme].title;
  render();
}

function save() {
  localStorage.setItem(`checklist-${currentTheme}`, JSON.stringify(items));
}

function updateProgress() {
  const total = items.length || 1;
  const done = items.filter((item) => item.done).length;
  const percent = Math.round((done / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressCount.textContent = `${done} / ${items.length} 완료`;
  document.body.dataset.progress = percent === 100 ? "complete" : percent >= 50 ? "half" : "start";

  if (items.length === 0) {
    statusMessage.textContent = "직접 필요한 준비물을 추가해보세요.";
  } else if (done === 0) {
    statusMessage.textContent = "천천히 챙겨볼까요?";
  } else if (done < items.length) {
    statusMessage.textContent = percent >= 50 ? "거의 준비되고 있어요." : "좋아요, 하나씩 챙기는 중이에요.";
  } else {
    statusMessage.textContent = "완벽해요. 이제 바다로 떠나요.";
  }

  const isComplete = items.length > 0 && done === items.length;
  completeBanner.hidden = !isComplete;

  if (isComplete && !wasComplete) {
    launchConfetti();
  }

  wasComplete = isComplete;
}

function launchConfetti() {
  confettiLayer.innerHTML = "";
  const colors = ["#0025AA", "#0071FF", "#01BCFF", "#FF1001", "#FE958E", "#FFECD1"];

  for (let i = 0; i < 28; i += 1) {
    const piece = document.createElement("span");
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--delay", `${Math.random() * 0.35}s`);
    piece.style.setProperty("--rotate", `${Math.random() * 360}deg`);
    piece.style.background = colors[i % colors.length];
    confettiLayer.appendChild(piece);
  }

  confettiLayer.classList.remove("is-active");
  void confettiLayer.offsetWidth;
  confettiLayer.classList.add("is-active");

  window.setTimeout(() => {
    confettiLayer.classList.remove("is-active");
  }, 1800);
}

function render() {
  checkList.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = item.done ? "is-done" : "";
    li.innerHTML = `
      <label>
        <input type="checkbox" ${item.done ? "checked" : ""} data-index="${index}">
        <span class="custom-check" aria-hidden="true"></span>
        <span>${item.text}</span>
      </label>
    `;
    checkList.appendChild(li);
  });
  updateProgress();
  save();
}

document.querySelectorAll(".theme-btn").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".theme-btn").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    loadTheme(button.dataset.theme);
  });
});

checkList.addEventListener("change", (event) => {
  const index = Number(event.target.dataset.index);
  if (Number.isNaN(index)) return;
  items[index].done = event.target.checked;
  render();
});

addBtn.addEventListener("click", () => {
  const text = newItem.value.trim();
  if (!text) return;
  items.push({ text, done: false });
  newItem.value = "";
  render();
});

newItem.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addBtn.click();
});

clearDone.addEventListener("click", () => {
  items = items.filter((item) => !item.done);
  render();
});

resetBtn.addEventListener("click", () => {
  localStorage.removeItem(`checklist-${currentTheme}`);
  loadTheme(currentTheme);
});

loadTheme(currentTheme);
