// ===== Find My Wave - Form Logic =====
(function () {
  const form = document.getElementById('waveForm');
  const resultPanel = document.getElementById('resultPanel');
  const retryBtn = document.getElementById('retryBtn');

  // Wave type definitions
  const waveTypes = {
    bigWave: {
      icon: '&#127754;',
      name: '빅 웨이브 라이더',
      desc: '당신은 거침없이 큰 파도에 도전하는 타입입니다! 위험을 두려워하지 않고 강렬한 경험을 추구하는 당신에게는 하와이 노스쇼어의 파이프라인이나 포르투갈 나자레의 초대형 파도가 어울립니다. 거센 파도 속에서 진정한 자유를 느끼세요.',
      traits: ['도전적', '대담함', '강한 체력', '아드레날린']
    },
    mellow: {
      icon: '&#127749;',
      name: '멜로우 크루저',
      desc: '당신은 여유로운 파도 위에서 평화를 찾는 타입입니다. 잔잔한 파도 위에서 롱보드를 타며 석양을 감상하는 것이 최고의 순간이죠. 발리의 쿠타 비치나 제주도의 중문 해변에서 느긋하게 파도를 즐겨보세요.',
      traits: ['여유로움', '감성적', '평화로움', '자연 친화']
    },
    soul: {
      icon: '&#127756;',
      name: '소울 서퍼',
      desc: '당신은 서핑을 통해 자아를 탐구하는 철학적 서퍼입니다. 파도의 리듬 속에서 명상하듯 서핑하며, 바다와 하나가 되는 순간을 추구합니다. 아이슬란드의 차가운 바다부터 인도네시아의 숨은 포인트까지, 미지의 파도를 찾아 떠나보세요.',
      traits: ['창의적', '탐험가', '깊은 사색', '독립적']
    },
    party: {
      icon: '&#127881;',
      name: '파티 웨이브 서퍼',
      desc: '당신은 서핑도 함께할 때 더 즐거운 사교적 서퍼입니다! 친구들과 함께 파도를 타고, 해변에서 파티를 즐기는 것이 당신의 스타일. 호주 골드코스트나 캘리포니아 헌팅턴 비치에서 서핑 커뮤니티와 함께 즐거운 시간을 보내세요.',
      traits: ['사교적', '에너지 넘침', '유쾌함', '팀 플레이어']
    }
  };

  // Scoring map
  const scoreMap = {
    q2: { adventure: 'bigWave', chill: 'mellow', explore: 'soul', social: 'party' },
    q3: { storm: 'bigWave', sunny: 'mellow', sunset: 'soul', misty: 'soul' },
    q4: { bold: 'bigWave', calm: 'mellow', creative: 'soul', energetic: 'party' },
    q5: { rock: 'bigWave', reggae: 'mellow', electronic: 'soul', pop: 'party' }
  };

  function validate() {
    let valid = true;

    // Name
    const name = document.getElementById('userName').value.trim();
    const nameError = document.getElementById('nameError');
    if (!name) {
      nameError.style.display = 'block';
      valid = false;
    } else {
      nameError.style.display = 'none';
    }

    // Q2
    const q2 = form.querySelector('input[name="q2"]:checked');
    const q2Error = document.getElementById('q2Error');
    if (!q2) {
      q2Error.style.display = 'block';
      valid = false;
    } else {
      q2Error.style.display = 'none';
    }

    // Q3
    const q3 = document.getElementById('q3').value;
    const q3Error = document.getElementById('q3Error');
    if (!q3) {
      q3Error.style.display = 'block';
      valid = false;
    } else {
      q3Error.style.display = 'none';
    }

    // Q4
    const q4 = form.querySelector('input[name="q4"]:checked');
    const q4Error = document.getElementById('q4Error');
    if (!q4) {
      q4Error.style.display = 'block';
      valid = false;
    } else {
      q4Error.style.display = 'none';
    }

    // Q5
    const q5 = form.querySelector('input[name="q5"]:checked');
    const q5Error = document.getElementById('q5Error');
    if (!q5) {
      q5Error.style.display = 'block';
      valid = false;
    } else {
      q5Error.style.display = 'none';
    }

    return valid;
  }

  function calculateResult() {
    const tally = { bigWave: 0, mellow: 0, soul: 0, party: 0 };

    const q2Val = form.querySelector('input[name="q2"]:checked').value;
    const q3Val = document.getElementById('q3').value;
    const q4Val = form.querySelector('input[name="q4"]:checked').value;
    const q5Val = form.querySelector('input[name="q5"]:checked').value;

    tally[scoreMap.q2[q2Val]]++;
    tally[scoreMap.q3[q3Val]]++;
    tally[scoreMap.q4[q4Val]]++;
    tally[scoreMap.q5[q5Val]]++;

    // Find max
    let maxType = 'mellow';
    let maxCount = 0;
    for (const type in tally) {
      if (tally[type] > maxCount) {
        maxCount = tally[type];
        maxType = type;
      }
    }

    return maxType;
  }

  function showResult(type) {
    const data = waveTypes[type];
    const name = document.getElementById('userName').value.trim();

    document.getElementById('resultIcon').innerHTML = data.icon;
    document.getElementById('resultType').textContent = name + '님은 ' + data.name;
    document.getElementById('resultDesc').textContent = data.desc;

    const traitsEl = document.getElementById('resultTraits');
    traitsEl.innerHTML = '';
    for (let i = 0; i < data.traits.length; i++) {
      const tag = document.createElement('span');
      tag.className = 'trait-tag';
      tag.textContent = '#' + data.traits[i];
      traitsEl.appendChild(tag);
    }

    form.style.display = 'none';
    resultPanel.classList.add('show');
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Submit handler
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!validate()) {
      // Scroll to first error
      const firstError = form.querySelector('.form-error[style*="block"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const resultType = calculateResult();
    showResult(resultType);
  });

  // Retry
  retryBtn.addEventListener('click', function () {
    form.reset();
    form.style.display = 'block';
    resultPanel.classList.remove('show');

    // Hide all errors
    const errors = form.querySelectorAll('.form-error');
    for (let i = 0; i < errors.length; i++) {
      errors[i].style.display = 'none';
    }

    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
