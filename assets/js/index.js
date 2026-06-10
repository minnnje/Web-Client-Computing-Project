document.addEventListener('DOMContentLoaded', () => {
    const waveContainer = document.getElementById('wave-container');
    const body = document.body;
    const exploreBtn = document.getElementById('explore-btn');

    // 페이지 로드 시 파도가 하단 1/3까지 등장
    setTimeout(() => {
        if (waveContainer) waveContainer.classList.add('on-load');
    }, 200);

    // 탐험 시작하기 버튼 클릭 시 메뉴 화면으로 자동 스크롤
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            window.scrollTo({
                top: window.innerHeight,
                behavior: 'smooth'
            });
        });
    }

    // 스크롤 상태에 따라 홈/메뉴 화면 전환
    const updatePageState = () => {
        const isScrolled = window.scrollY > 100;

        if (waveContainer) {
            waveContainer.classList.toggle('fill-screen', isScrolled);
        }

        body.classList.toggle('scrolled', isScrolled);
    };

    updatePageState();
    window.addEventListener('scroll', updatePageState, { passive: true });
});
