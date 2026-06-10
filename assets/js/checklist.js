const themes = {
  surf: {
    title: "서핑 당일치기",
    items: ["래시가드", "수건", "선크림", "여벌 옷", "방수팩", "슬리퍼"]
  },
  healing: {
    title: "힐링 바캉스",
    items: ["돗자리", "선글라스", "모자", "카메라", "간식", "보조배터리"]
  },
  overnight: {
    title: "1박 2일 여행",
    items: ["세면도구", "잠옷", "충전기", "상비약", "여분 수건", "숙소 예약 확인"]
  }
};

const themeTitle = document.getElementById("theme-title");
const checkList = document.getElementById("check-list");
const progressBar = document.getElementById("progress-bar");
const newItem = document.getElementById("new-item");
const addBtn = document.getElementById("add-btn");
const clearDone = document.getElementById("clear-done");
const resetBtn = document.getElementById("reset-btn");
let currentTheme = "surf";
let items = [];

function loadTheme(theme) {
  currentTheme = theme;
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
  progressBar.style.width = `${Math.round((done / total) * 100)}%`;
}

function render() {
  checkList.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <label>
        <input type="checkbox" ${item.done ? "checked" : ""} data-index="${index}">
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
