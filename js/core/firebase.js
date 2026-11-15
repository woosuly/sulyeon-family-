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
        // 시계·날씨는 화면 뼈대가 준비되면 바로 시작 (window.onload는 이미지·외부 스크립트가 다 받아질 때까지 기다려서, 하나만 느려도 날씨가 안 뜸)
        let famEarlyBoot = false;
        document.addEventListener('DOMContentLoaded', () => { famEarlyBoot = true; try { initClock(); } catch (e) {} try { initWeather(); } catch (e) {} });
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
            if (!famEarlyBoot) { initClock(); initWeather(); }
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
        // 예비: Open-Meteo가 안 될 때 wttr.in (날씨 코드는 Open-Meteo 코드로 대략 맞춤)
        async function weatherFetchWttr() {
            const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
            try {
                const lat = isFinite(userLat) ? userLat : 37.5665, lon = isFinite(userLon) ? userLon : 126.978;
                const d = await (await fetch(`https://wttr.in/${lat.toFixed(3)},${lon.toFixed(3)}?format=j1`, { signal: ctl.signal, cache: 'no-store' })).json();
                const c = d && d.current_condition && d.current_condition[0]; if (!c) throw new Error('no data');
                const w = +c.weatherCode, code = w === 113 ? 0 : w === 116 ? 2 : w <= 122 ? 3 : w <= 260 && w >= 143 && w <= 248 ? 45 : w >= 386 ? 95 : [179, 182, 185, 227, 230, 323, 326, 329, 332, 335, 338, 350, 368, 371, 374, 377].includes(w) ? 71 : 61;
                const h = new Date().getHours();
                return { temperature: +c.temp_C, weathercode: code, is_day: h >= 6 && h < 18 ? 1 : 0 };
            } finally { clearTimeout(tm); }
        }
        let weatherErr = '';
        async function initWeather() {
            if (weatherBusy) return; weatherBusy = true;
            if (!weatherAt) updateWeatherDisplay(null); // 처음에만 로딩 표시
            try {
                let cw;
                try { cw = await weatherFetchOnce(); }
                catch (e) {
                    weatherErr = e.name === 'AbortError' ? '응답 없음' : (e.message || '오류');
                    await new Promise(r => setTimeout(r, 1000));
                    try { cw = await weatherFetchOnce(); } catch (e2) { cw = await weatherFetchWttr(); }
                }
                updateWeatherDisplay(cw); weatherAt = Date.now(); weatherErr = '';
            } catch(e) {
                if (!weatherAt) {
                    document.getElementById('weather-icon').textContent = '↻';
                    document.getElementById('weather-temp').textContent = '';
                    document.getElementById('weather-desc').textContent = '날씨 다시 시도' + (weatherErr ? ` (${weatherErr})` : '');
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
            window.famWx = cw;   // 홈 화면 위젯용
            const hour = new Date().getHours();
            const emoji = getWeatherEmoji(cw.weathercode, cw.is_day);
            const timeLabel = getTimeOfDay(hour);
            document.getElementById('weather-icon').textContent = emoji;
            document.getElementById('weather-temp').textContent = `${Math.round(cw.temperature)}°C`;
            document.getElementById('weather-desc').textContent = `${timeLabel} · ${userCityName}`;
        }

        // 위치 설정 (날짜카드 클릭 시): 지금 위치(GPS) 한 번 누르기, 또는 한글로 검색해서 고르기
        function locSet(name, lat, lon, tz) {
            userCityName = name; userLat = +lat; userLon = +lon; userTimezone = tz || 'Asia/Seoul';
            localStorage.setItem('userCityName', userCityName); localStorage.setItem('userLat', userLat); localStorage.setItem('userLon', userLon); localStorage.setItem('userTimezone', userTimezone);
            weatherAt = 0; initWeather(); try { updateClock(); } catch (e) {}
            if (typeof famSheetClose === 'function') famSheetClose();
            if (typeof famToast === 'function') famToast(`위치: ${name}`);
        }
        function openLocationModal() {
            famSheet(`<div class="fam-h"><b>📍 날씨 위치</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
                <button class="fam-btn pri" style="width:100%;padding:13px;font-size:15px" onclick="locHere(this)">📍 지금 있는 곳으로</button>
                <div style="display:flex;gap:6px;margin-top:12px"><input id="loc-q" class="fam-in" style="flex:1;margin:0" placeholder="지역 이름 (예: 청주, 제주, 오사카)" onkeydown="if(event.key==='Enter')locSearch()"><button class="fam-btn" onclick="locSearch()">찾기</button></div>
                <div id="loc-res" style="margin-top:8px"></div>
                <div class="fam-note">지금: <b>${famEsc(userCityName || '')}</b> · 한글·영문 모두 됩니다. 해외 여행지도 같은 방법으로 바꿀 수 있습니다.</div>`);
            setTimeout(() => { const el = document.getElementById('loc-q'); if (el) el.focus(); }, 250);
        }
        // 지금 위치: 폰 위치 → 지역 이름(한글)
        function locHere(btn) {
            if (!navigator.geolocation) return famToast('이 폰에서는 위치를 쓸 수 없습니다');
            btn.disabled = true; btn.textContent = '위치 확인 중…';
            navigator.geolocation.getCurrentPosition(async pos => {
                const { latitude: la, longitude: lo } = pos.coords; let name = '';
                try { const r = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=ko`)).json(); name = r.city || r.locality || r.principalSubdivision || ''; } catch (e) {}
                locSet(name || '현재 위치', la, lo, Intl.DateTimeFormat().resolvedOptions().timeZone);
            }, e => { btn.disabled = false; btn.textContent = '📍 지금 있는 곳으로'; famToast(e.code === 1 ? '위치 권한을 허용해 주세요 (폰 설정 → 애플리케이션 → 설연 → 권한)' : '위치를 못 찾았습니다. 아래에서 검색해 주세요'); },
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60e3 });
        }
        // 한글로 찾기: 결과 여러 개면 골라서
        async function locSearch() {
            const q = (document.getElementById('loc-q') || {}).value?.trim(); const box = document.getElementById('loc-res'); if (!q || !box) return;
            box.innerHTML = '<div class="fam-note">찾는 중…</div>';
            const get = async lang => ((await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${lang}`)).json()).results || []);
            let rs = []; try { rs = await get('ko'); if (!rs.length) rs = await get('en'); } catch (e) {}
            // '청주시'처럼 끝에 시·군·구를 붙이면 못 찾는 경우가 있어 한 번 더
            if (!rs.length && /[시군구도]$/.test(q)) { try { const q2 = q.replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구|도)$/, ''); rs = ((await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q2)}&count=6&language=ko`)).json()).results || []); } catch (e) {} }
            if (!rs.length) { box.innerHTML = '<div class="fam-note">못 찾았습니다. 더 큰 지역 이름으로 해 보세요 (예: 오창 → 청주).</div>'; return; }
            window._locRs = rs;
            box.innerHTML = rs.map((r, i) => `<div class="ag-li" style="cursor:pointer" onclick="const r=window._locRs[${i}];locSet(r.name,r.latitude,r.longitude,r.timezone)"><span>📍</span><b>${famEsc(r.name)}<br><small style="color:#64748b;font-weight:500">${famEsc([r.admin1, r.country].filter(Boolean).join(' · '))}</small></b><span style="color:#94a3b8">선택 ›</span></div>`).join('');
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

