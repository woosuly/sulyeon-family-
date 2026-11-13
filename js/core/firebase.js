        // ── Firebase 설정 ──────────────────────────────────────────────
        const firebaseConfig = {
            apiKey: "AIzaSyB6jvYxW3h0xT3P-KFBKIERjmVDOVPbl1c",
            authDomain: "seolyeon-family-seoul.firebaseapp.com",
            projectId: "seolyeon-family-seoul",
            storageBucket: "seolyeon-family-seoul.firebasestorage.app",
            messagingSenderId: "143116408143",
            appId: "1:143116408143:web:32b6f47d11b06efdcd213a",
            measurementId: "G-1MB01TXC0C"
        };
        firebase.initializeApp(firebaseConfig);
        const storage = firebase.storage();
        const db = firebase.firestore();
        // 오프라인 캐시: 네트워크가 끊겨도 마지막 데이터 조회·입력 가능 (연결되면 자동 동기화)
        try { db.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('[오프라인 캐시]', e.code)); } catch (e) {}

        // ── 전역 상태 ──────────────────────────────────────────────────
        let curViewDate = new Date();
        let schData = [], assetData = { "남편": [], "아내": [], "정우설": [], "한미연": [], "공통": [] }, albumData = [], planData = [];
        let aChart = null, activeDateStr = "", currentMember = "", currentFolderId = null;

        // ── 초기화 ──────────────────────────────────────────────────
        window.onload = () => {
            // 커스텀 테마 색상 복원
            const saved = localStorage.getItem('customThemeColor');
            if (saved) {
                const idx = THEME_COLORS.findIndex(t => t.h === saved);
                if (idx >= 0) applyThemeColor(idx);
                else applyMonthTheme();
            } else {
                applyMonthTheme();
            }
            // 헤더 투명도 복원
            applyHeaderColor(saved || null);
            initClock();
            initWeather();
            famAuthGate(() => { initRealtimeSync(); setTimeout(initChatListener, 1000); }); // 로그인 후 데이터 연결
            initProfile(); // 프로필 초기화 (저장값 없으면 모달 표시)
        };

        // ── 월별 테마 (파스텔톤) ──────────────────────────────────────────
        const MONTH_THEMES = [
            // 1월 - 겨울 아이스블루 파스텔
            { bg:'#eef4fb', gradA:'#ddeaf8', gradB:'#cfe0f5', accent:'#7ab3d8', header:'#3a6a96',
              landmark:'https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1200&q=60', // 설원
              landmarkName:'겨울 설경' },
            // 2월 - 라벤더 파스텔
            { bg:'#f5f0fc', gradA:'#eddff8', gradB:'#e4d0f5', accent:'#b388e8', header:'#7048a0',
              landmark:'https://images.unsplash.com/photo-1522093007474-d86e9bf7ba6f?w=1200&q=60', // 파리 에펠탑
              landmarkName:'파리 에펠탑' },
            // 3월 - 벚꽃 핑크 파스텔
            { bg:'#fef2f6', gradA:'#fce4ed', gradB:'#fad4e4', accent:'#f4a0bc', header:'#c05880',
              landmark:'https://images.unsplash.com/photo-1522093007474-d86e9bf7ba6f?w=1200&q=60', // 벚꽃
              landmarkName:'봄 벚꽃' },
            // 4월 - 민트 그린 파스텔
            { bg:'#f0fbf7', gradA:'#d8f5ec', gradB:'#c8efe3', accent:'#6dcfb0', header:'#2e8b6a',
              landmark:'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=1200&q=60', // 아일랜드 들판
              landmarkName:'아일랜드 초원' },
            // 5월 - 연두 파스텔
            { bg:'#f4fbf0', gradA:'#ddf2d0', gradB:'#cdecc0', accent:'#90cc70', header:'#3a7a28',
              landmark:'https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=1200&q=60', // 토스카나
              landmarkName:'이탈리아 토스카나' },
            // 6월 - 스카이블루 파스텔
            { bg:'#f0f8fe', gradA:'#d0eafc', gradB:'#bde0fa', accent:'#70bcf0', header:'#1a6aa0',
              landmark:'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&q=60', // 산토리니
              landmarkName:'그리스 산토리니' },
            // 7월 - 선샤인 옐로우 파스텔
            { bg:'#fffcf0', gradA:'#fff4cc', gradB:'#ffecaa', accent:'#f5cc50', header:'#8a6400',
              landmark:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=60', // 해변
              landmarkName:'여름 해변' },
            // 8월 - 복숭아 파스텔
            { bg:'#fff6f0', gradA:'#ffe8d8', gradB:'#ffdcc8', accent:'#f0a080', header:'#8a4020',
              landmark:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=60', // 몰디브
              landmarkName:'몰디브 해변' },
            // 9월 - 골든 파스텔
            { bg:'#fdf8f0', gradA:'#f8eacc', gradB:'#f4deb0', accent:'#e0b060', header:'#7a5000',
              landmark:'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=1200&q=60', // 단풍
              landmarkName:'가을 단풍' },
            // 10월 - 테라코타 파스텔
            { bg:'#fdf3ee', gradA:'#f8ddd0', gradB:'#f5ccb8', accent:'#e08060', header:'#7a3818',
              landmark:'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1200&q=60', // 이탈리아
              landmarkName:'이탈리아 가을' },
            // 11월 - 세이지 그린 파스텔
            { bg:'#f2f5f0', gradA:'#dce8d8', gradB:'#ccdcc8', accent:'#88aa78', header:'#3a5830',
              landmark:'https://images.unsplash.com/photo-1552083375-1447ce886485?w=1200&q=60', // 교토 가을
              landmarkName:'교토 가을' },
            // 12월 - 아이시 블루 파스텔
            { bg:'#f0f4fa', gradA:'#d8e4f5', gradB:'#c8d8f0', accent:'#80a8e0', header:'#2a4878',
              landmark:'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1200&q=60', // 겨울 도시
              landmarkName:'겨울 야경' },
        ];

        function applyMonthTheme() {
            const m = new Date().getMonth();
            const t = MONTH_THEMES[m];
            const r = document.documentElement.style;
            r.setProperty('--month-bg', t.bg);
            r.setProperty('--month-grad-a', t.gradA);
            r.setProperty('--month-grad-b', t.gradB);
            r.setProperty('--month-accent', t.accent);
            r.setProperty('--month-header', t.header);
            r.setProperty('--month-text', '#1e293b');
            document.body.style.background = t.bg;
            // CSS 변수로 헤더 색상 제어 (인라인 style 사용 금지)
            applyHeaderOpacity(t.header);
        }

        // ── 시계 / 날짜 ──────────────────────────────────────────────────
        let userTimezone = localStorage.getItem('userTimezone') || 'Asia/Seoul';
        let clockTimer = null;

        function initClock() {
            updateClock();
            clockTimer = setInterval(updateClock, 1000);
        }

        function updateClock() {
            try {
                const now = new Date();
                // 시간 (HH:MM)
                const timeStr = now.toLocaleTimeString('ko-KR', {
                    timeZone:userTimezone, hour:'2-digit', minute:'2-digit', hour12:false
                });
                const timeBig = document.getElementById('info-time-big');
                if (timeBig) timeBig.textContent = timeStr;

                // 날짜 + 요일 (예: 2026년 4월 13일 월요일)
                const dateStr = now.toLocaleDateString('ko-KR', {
                    timeZone:userTimezone, year:'numeric', month:'long',
                    day:'numeric', weekday:'long'
                });
                const dtEl = document.getElementById('info-datetime');
                if (dtEl) dtEl.textContent = dateStr;

                updateSeoulTime();
            } catch(e) {
                const dtEl = document.getElementById('info-datetime');
                if (dtEl) dtEl.textContent = new Date().toLocaleString('ko-KR');
            }
        }

        // ── 날씨 ──────────────────────────────────────────────────
        // Open-Meteo: 무료 API, 키 불필요
        let userLat = parseFloat(localStorage.getItem('userLat') || '37.5665');
        let userLon = parseFloat(localStorage.getItem('userLon') || '126.9780');
        let userCityName = localStorage.getItem('userCityName') || '서울';

        // 날씨: 8초 안에 응답이 없거나 형식이 다르면 한 번 더 시도, 그래도 안 되면 '다시 시도' 표시
        // (앱은 며칠씩 켜져 있으므로 화면으로 돌아올 때 30분 지났으면 새로 받음)
        let weatherAt = 0, weatherBusy = false;
        async function weatherFetchOnce() {
            const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
            try {
                const lat = isFinite(userLat) ? userLat : 37.5665, lon = isFinite(userLon) ? userLon : 126.978;
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`, { signal: ctl.signal, cache: 'no-store' });
                const d = await res.json(), c = d && d.current;
                if (!c || c.temperature_2m == null) throw new Error((d && d.reason) || 'no data');
                return { temperature: c.temperature_2m, weathercode: c.weather_code, is_day: c.is_day };
            } finally { clearTimeout(tm); }
        }
        async function initWeather() {
            if (weatherBusy) return; weatherBusy = true;
            if (!weatherAt) updateWeatherDisplay(null); // 처음에만 로딩 표시
            try {
                let cw; try { cw = await weatherFetchOnce(); } catch (e) { await new Promise(r => setTimeout(r, 1500)); cw = await weatherFetchOnce(); }
                updateWeatherDisplay(cw); weatherAt = Date.now();
            } catch(e) {
                if (!weatherAt) {
                    document.getElementById('weather-icon').textContent = '↻';
                    document.getElementById('weather-temp').textContent = '';
                    document.getElementById('weather-desc').textContent = '날씨 다시 시도';
                }
            } finally { weatherBusy = false; }
        }
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - weatherAt > 30 * 60e3) initWeather(); });
        window.addEventListener('online', () => { if (!weatherAt) initWeather(); });

        function getWeatherEmoji(code, isDay) {
            if (code === 0) return isDay ? '☀️' : '🌙';
            if (code <= 2) return isDay ? '🌤️' : '🌙';
            if (code <= 3) return '☁️';
            if (code <= 49) return '🌫️';
            if (code <= 59) return '🌦️';
            if (code <= 69) return '🌧️';
            if (code <= 79) return '❄️';
            if (code <= 84) return '🌨️';
            if (code <= 99) return '⛈️';
            return '🌡️';
        }

        function getTimeOfDay(hour) {
            if (hour >= 6 && hour < 12) return '오전';
            if (hour >= 12 && hour < 18) return '오후';
            return '저녁';
        }

        function updateWeatherDisplay(cw) {
            if (!cw) {
                document.getElementById('weather-icon').textContent = '⏳';
                document.getElementById('weather-temp').textContent = '';
                document.getElementById('weather-desc').textContent = userCityName;
                return;
            }
            const hour = new Date().getHours();
            const emoji = getWeatherEmoji(cw.weathercode, cw.is_day);
            const timeLabel = getTimeOfDay(hour);
            document.getElementById('weather-icon').textContent = emoji;
            document.getElementById('weather-temp').textContent = `${Math.round(cw.temperature)}°C`;
            document.getElementById('weather-desc').textContent = `${timeLabel} · ${userCityName}`;
        }

        // 위치 설정 모달 (날짜카드 클릭 시)
        function openLocationModal() {
            resetModal();
            document.getElementById('modal-title').innerText = "📍 위치 설정";
            document.getElementById('photo-adjust-fields').classList.remove('hidden');
            document.getElementById('setting-city').value = userCityName || '';
            document.getElementById('btn-save').innerText = "저장";
            document.getElementById('btn-save').onclick = async () => {
                const city = document.getElementById('setting-city').value.trim();
                if (!city) { alert('도시 이름을 입력해주세요.'); return; }
                // geocoding으로 위도/경도/타임존 자동 조회
                try {
                    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`);
                    const data = await res.json();
                    const r = data.results?.[0];
                    if (!r) { alert('도시를 찾을 수 없어요. 영문으로 다시 입력해보세요.'); return; }
                    userCityName = r.name;
                    userLat      = r.latitude;
                    userLon      = r.longitude;
                    userTimezone = r.timezone || 'Asia/Seoul';
                    localStorage.setItem('userCityName', userCityName);
                    localStorage.setItem('userLat',      userLat);
                    localStorage.setItem('userLon',      userLon);
                    localStorage.setItem('userTimezone', userTimezone);
                    initWeather();
                    closeModal();
                } catch(e) {
                    alert('위치 조회 중 오류가 발생했어요. 다시 시도해주세요.');
                }
            };
            openModal();
        }


        // ══════════════════════════════════════════════════════
        // 👤 프로필 (사용자 식별) 관리
        // ══════════════════════════════════════════════════════
        let chatUser = localStorage.getItem('chatUser') || '';

        function initProfile() {
            if (chatUser) {
                applyProfile(chatUser);
            } else {
                openProfileModal();
            }
        }

        function selectProfile(name) {
            chatUser = name;
            localStorage.setItem('chatUser', name);
            applyProfile(name);
            closeProfileModal();
            // Push 구독 재등록 (token 업데이트)
            if (typeof reRegisterPush === 'function') reRegisterPush();
        }

        function applyProfile(name) {
            const avatar = name === '정우설' ? '👨' : '👩';
            const avatarEl = document.getElementById('header-profile-avatar');
            const nameEl   = document.getElementById('header-profile-name');
            if (avatarEl) avatarEl.textContent = avatar;
            if (nameEl)   nameEl.textContent   = name;
            chatUser = name;
        }

        function openProfileModal() {
            document.getElementById('profile-modal').style.display = 'flex';
        }

        function closeProfileModal() {
            document.getElementById('profile-modal').style.display = 'none';
        }

        function resetProfile() {
            if (!confirm('사용자를 변경할까요? 변경 후 새로고침됩니다.')) return;
            localStorage.removeItem('chatUser');
            location.reload();
        }

