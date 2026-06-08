// ===== Beach Travel Checklist =====
(function () {
  const themeData = {
    beginner: {
      title: '서핑 초보자용 준비물',
      items: [
        '서핑 보드 (렌탈 가능)',
        '래시가드',
        '서프 왁스',
        '리쉬 코드',
        '방수 선크림 SPF 50+',
        '수건 2장',
        '여벌 옷',
        '물 1.5L',
        '간단한 간식'
      ]
    },
    healing: {
      title: '해변 힐링용 준비물',
      items: [
        '비치 타올',
        '돗자리',
        '선글라스',
        '와이드 챙 모자',
        '선크림',
        '읽을 책 또는 e-reader',
        '블루투스 스피커',
        '시원한 음료',
        '아이스박스'
      ]
    },
    advanced: {
      title: '서핑 고수용 준비물',
      items: [
        '내 보드 (숏보드/롱보드)',
        '예비 핀과 핀 키',
        '리쉬 코드 (예비 포함)',
        '서프 왁스 + 왁스 콤',
        '웨트슈트',
        '부티 / 글러브',
        '고프로 + 마운트',
        '서핑 일지/노트',
        '응급 약품'
      ]
    },
    party: {
      title: '비치 파티용 준비물',
      items: [
        '비치 발리볼',
        '프리스비',
        '아이스박스 + 얼음',
        '음료와 스낵',
        '일회용 컵 / 접시',
        '블루투스 스피커',
        '쓰레기 봉투',
        '폴라로이드 카메라',
        '비치 의자'
      ]
    }
  };

  const themeGrid = document.getElementById('themeGrid');
  const checklistPanel = document.getElementById('checklistPanel');
  const checklistTitle = document.getElementById('checklistTitle');
  const checklistItems = document.getElementById('checklistItems');
  const checklistProgress = document.getElementById('checklistProgress');
  const progressBarFill = document.getElementById('progressBarFill');
  const itemInput = document.getElementById('itemInput');
  const addItemBtn = document.getElementById('addItemBtn');
  const clearCheckedBtn = document.getElementById('clearCheckedBtn');
  const resetThemeBtn = document.getElementById('resetThemeBtn');

  let currentTheme = null;
  // items: [{ text: string, done: boolean }]
  let items = [];

  function render() {
    checklistItems.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'checklist-empty';
      empty.textContent = '아직 준비물이 없어요. 아래에서 직접 추가해보세요!';
      checklistItems.appendChild(empty);
    } else {
      items.forEach(function (item, index) {
        const li = document.createElement('li');
        li.className = 'checklist-item' + (item.done ? ' done' : '');

        const box = document.createElement('span');
        box.className = 'checklist-checkbox';

        const text = document.createElement('span');
        text.className = 'checklist-item-text';
        text.textContent = item.text;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'checklist-item-remove';
        removeBtn.setAttribute('aria-label', '삭제');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          items.splice(index, 1);
          render();
        });

        li.addEventListener('click', function () {
          items[index].done = !items[index].done;
          render();
        });

        li.appendChild(box);
        li.appendChild(text);
        li.appendChild(removeBtn);
        checklistItems.appendChild(li);
      });
    }

    const doneCount = items.filter(function (i) { return i.done; }).length;
    const total = items.length;
    checklistProgress.textContent = doneCount + ' / ' + total + ' 완료';
    const percent = total === 0 ? 0 : (doneCount / total) * 100;
    progressBarFill.style.width = percent + '%';
  }

  function loadTheme(themeKey) {
    const data = themeData[themeKey];
    if (!data) return;

    currentTheme = themeKey;
    checklistTitle.textContent = data.title;
    items = data.items.map(function (text) {
      return { text: text, done: false };
    });

    Array.prototype.forEach.call(themeGrid.querySelectorAll('.theme-card'), function (card) {
      if (card.getAttribute('data-theme') === themeKey) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    checklistPanel.classList.add('show');
    render();
    checklistPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addCustomItem() {
    const value = itemInput.value.trim();
    if (!value) {
      itemInput.focus();
      return;
    }
    items.push({ text: value, done: false });
    itemInput.value = '';
    render();
  }

  Array.prototype.forEach.call(themeGrid.querySelectorAll('.theme-card'), function (card) {
    card.addEventListener('click', function () {
      loadTheme(card.getAttribute('data-theme'));
    });
  });

  addItemBtn.addEventListener('click', addCustomItem);

  itemInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomItem();
    }
  });

  clearCheckedBtn.addEventListener('click', function () {
    items = items.filter(function (i) { return !i.done; });
    render();
  });

  resetThemeBtn.addEventListener('click', function () {
    if (currentTheme) {
      loadTheme(currentTheme);
    }
  });
})();
