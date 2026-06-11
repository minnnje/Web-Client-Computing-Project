const answers = {};
const questions = Array.from(document.querySelectorAll(".question"));
const stepLabel = document.getElementById("step-label");
const stepProgressBar = document.getElementById("step-progress-bar");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultDesc = document.getElementById("result-desc");
const matchRate = document.getElementById("match-rate");
const matchBar = document.getElementById("match-bar");
const answerSummaryList = document.getElementById("answer-summary-list");
const keywordRow = document.getElementById("keyword-row");
const spotGrid = document.getElementById("spot-grid");
const restartTestBtn = document.getElementById("restart-test-btn");

let currentStep = 0;

const results = {
  active: {
    title: "액티브 서퍼형",
    desc: "활동량이 많고 새로운 경험을 선호합니다. 파도, 강습, 주변 즐길 거리가 함께 있는 해변이 잘 맞습니다.",
    keywords: ["서핑강습", "핫플", "활동적인여행"],
    spots: [
      ["양양 죽도해변", "국내 대표 서핑 스팟"],
      ["부산 송정해수욕장", "도심 접근성과 서핑 강습"],
      ["제주 중문색달해변", "강한 풍경과 도전감"],
    ],
  },
  healing: {
    title: "힐링 비치형",
    desc: "여유로운 휴식과 풍경을 우선합니다. 사람이 너무 붐비지 않고 산책과 카페를 함께 즐길 수 있는 해변이 어울립니다.",
    keywords: ["감성해변", "산책", "조용한휴식"],
    spots: [
      ["협재 해변", "맑은 바다색과 감성적인 풍경"],
      ["고성 봉포 해수욕장", "차분한 동해안 분위기"],
      ["강릉 경포 해수욕장", "바다 산책과 주변 볼거리"],
    ],
  },
  social: {
    title: "커뮤니티 입문형",
    desc: "사람들과 함께 배우고 즐기는 타입입니다. 강습, 렌탈, 주변 상권이 잘 갖춰진 해변을 추천합니다.",
    keywords: ["입문자추천", "강습", "사람들과함께"],
    spots: [
      ["양양 서피비치", "서핑 문화와 활기 있는 분위기"],
      ["부산 송정해수욕장", "초보 강습과 접근성"],
      ["해운대 해수욕장", "도심형 바다와 풍부한 편의시설"],
    ],
  },
};

const scoring = {
  active: "active",
  healing: "healing",
  social: "social",
  beginner: "social",
  middle: "healing",
  challenge: "active",
  city: "social",
  nature: "healing",
  hotspot: "active",
};

const answerLabels = {
  active: "액티브",
  healing: "힐링",
  social: "소셜",
  beginner: "처음이에요",
  middle: "몇 번 타봤어요",
  challenge: "도전하고 싶어요",
  city: "도심형",
  nature: "자연형",
  hotspot: "핫스팟",
};

function getCurrentQuestionKey() {
  return questions[currentStep].dataset.question;
}

function updateStep() {
  questions.forEach((question, index) => {
    question.classList.toggle("is-active", index === currentStep);
  });

  const progress = ((currentStep + 1) / questions.length) * 100;
  stepLabel.textContent = `Step ${currentStep + 1} / ${questions.length}`;
  stepProgressBar.style.width = `${progress}%`;
  prevBtn.disabled = currentStep === 0;
  nextBtn.textContent = currentStep === questions.length - 1 ? "결과 보기" : "다음";
  nextBtn.disabled = !answers[getCurrentQuestionKey()];
}

function selectChoice(button) {
  const question = button.closest(".question");
  const questionKey = question.dataset.question;
  answers[questionKey] = button.dataset.value;

  question.querySelectorAll(".choice-card").forEach((item) => {
    item.classList.toggle("is-selected", item === button);
  });

  nextBtn.disabled = false;
}

function getScore() {
  const score = { active: 0, healing: 0, social: 0 };

  Object.values(answers).forEach((value) => {
    score[scoring[value]] += 1;
  });

  return score;
}

function getResultKey() {
  return Object.entries(getScore()).sort((a, b) => b[1] - a[1])[0][0];
}

function getMatchPercent(resultKey) {
  const score = getScore();
  const base = Math.round((score[resultKey] / questions.length) * 100);
  return Math.min(96, Math.max(72, base + 8));
}

function showResult() {
  const resultKey = getResultKey();
  const result = results[resultKey];
  const percent = getMatchPercent(resultKey);

  resultTitle.textContent = `당신의 파도는 "${result.title}"`;
  resultDesc.textContent = result.desc;
  matchRate.textContent = `${percent}%`;
  matchBar.style.width = "0%";
  answerSummaryList.innerHTML = Object.values(answers).map((answer) => (
    `<span>${answerLabels[answer]}</span>`
  )).join("");
  keywordRow.innerHTML = result.keywords.map((keyword, index) => (
    `<span style="--delay:${index * 70}ms">#${keyword}</span>`
  )).join("");
  spotGrid.innerHTML = result.spots.map(([name, desc], index) => (
    `<div class="spot" style="--delay:${index * 90}ms"><strong>${name}</strong><span>${desc}</span></div>`
  )).join("");

  resultCard.hidden = false;
  requestAnimationFrame(() => {
    matchBar.style.width = `${percent}%`;
  });
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

document.querySelectorAll(".choice-card").forEach((button) => {
  button.addEventListener("click", () => selectChoice(button));
});

prevBtn.addEventListener("click", () => {
  if (currentStep === 0) return;
  currentStep -= 1;
  updateStep();
});

nextBtn.addEventListener("click", () => {
  if (!answers[getCurrentQuestionKey()]) return;

  if (currentStep < questions.length - 1) {
    currentStep += 1;
    updateStep();
    return;
  }

  showResult();
});

restartTestBtn.addEventListener("click", () => {
  Object.keys(answers).forEach((key) => delete answers[key]);
  document.querySelectorAll(".choice-card").forEach((button) => button.classList.remove("is-selected"));
  resultCard.hidden = true;
  currentStep = 0;
  updateStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

updateStep();
