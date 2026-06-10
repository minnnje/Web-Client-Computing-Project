const answers = {};
const resultBtn = document.getElementById("result-btn");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultDesc = document.getElementById("result-desc");
const spotGrid = document.getElementById("spot-grid");

const results = {
  active: {
    title: "액티브 서퍼형",
    desc: "활동량이 많고 새로운 경험을 선호합니다. 파도, 수업, 주변 즐길 거리가 함께 있는 해변이 잘 맞습니다.",
    spots: [
      ["양양 죽도해변", "국내 대표 서핑 스팟"],
      ["부산 송정해수욕장", "도심 접근성과 서핑 강습"],
      ["제주 중문색달해변", "강한 풍경과 도전감"]
    ]
  },
  healing: {
    title: "힐링 비치형",
    desc: "여유로운 휴식과 풍경을 우선합니다. 사람이 너무 붐비지 않고 산책과 카페를 함께 즐길 수 있는 해변이 어울립니다.",
    spots: [
      ["고성 송지호해변", "잔잔한 분위기"],
      ["강릉 안목해변", "카페 거리와 바다"],
      ["태안 만리포해수욕장", "서해권 대표 해변"]
    ]
  },
  social: {
    title: "서핑 커뮤니티형",
    desc: "사람들과 함께 배우고 즐기는 타입입니다. 강습, 렌탈, 주변 상권이 잘 갖춰진 해변을 추천합니다.",
    spots: [
      ["양양 인구해변", "서핑 문화와 상권"],
      ["부산 송정해수욕장", "초보 강습과 접근성"],
      ["포항 용한리해변", "동해안 서핑 스팟"]
    ]
  }
};

document.querySelectorAll(".choice-card").forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.closest(".question").dataset.question;
    answers[question] = button.dataset.value;
    button.closest(".choice-grid").querySelectorAll(".choice-card").forEach((item) => {
      item.classList.toggle("is-selected", item === button);
    });
  });
});

function getResultKey() {
  if (answers.mood) return answers.mood;
  if (answers.skill === "beginner") return "healing";
  if (answers.skill === "challenge") return "active";
  return "social";
}

resultBtn.addEventListener("click", () => {
  const result = results[getResultKey()];
  resultTitle.textContent = result.title;
  resultDesc.textContent = result.desc;
  spotGrid.innerHTML = result.spots.map(([name, desc]) => (
    `<div class="spot"><strong>${name}</strong><span>${desc}</span></div>`
  )).join("");
  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
});
