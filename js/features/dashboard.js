        // 데이터가 바뀔 때마다 불리는 갱신 지점 — 홈 요약(famHomeToday)·넓은 화면 패널이 여기에 연결됨
        // (예전 "요약" 화면과 메인 슬라이드는 홈 요약으로 대체되어 삭제)
        function renderMainDashboard() {}

        // ── 주간 날씨 팝업 ──────────────────────────────────────────────
        async function openWeeklyWeather() {
            const modal = document.getElementById('weekly-weather-modal');
            const listEl = document.getElementById('weekly-weather-list');
            document.getElementById('weekly-city').textContent = userCityName;
            listEl.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:16px;">로딩 중...</div>';
            modal.classList.remove('hidden');
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
                const res = await fetch(url);
                const data = await res.json();
                const days  = data.daily?.time || [];
                const codes = data.daily?.weathercode || [];
                const maxT  = data.daily?.temperature_2m_max || [];
                const minT  = data.daily?.temperature_2m_min || [];
                const dayNames = ['일','월','화','수','목','금','토'];
                listEl.innerHTML = days.map((ds, i) => {
                    const d    = new Date(ds);
                    const dw   = dayNames[d.getDay()];
                    const isToday = i === 0;
                    const color = d.getDay()===0?'#ef4444':d.getDay()===6?'#3b82f6':'#374151';
                    const emoji = getWeatherEmoji(codes[i], 1);
                    return `<div onclick="famHourlyOpen(${i})" style="display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid #f8fafc;cursor:pointer;">
                        <div style="min-width:44px;font-size:12px;font-weight:${isToday?800:600};color:${color};">
                            ${isToday?'오늘':ds.slice(5).replace('-','/')}<br>
                            <span style="font-size:10px;font-weight:500;">(${dw})</span>
                        </div>
                        <span style="font-size:22px;flex-shrink:0;">${emoji}</span>
                        <div style="flex:1;">
                            <div style="font-size:12px;color:#374151;font-weight:700;">${Math.round(maxT[i]||0)}° <span style="color:#94a3b8;font-weight:400;">/ ${Math.round(minT[i]||0)}°</span></div>
                        </div>
                        <span style="color:#cbd5e1;font-size:14px;">›</span>
                    </div>`;
                }).join('');
            } catch(e) {
                listEl.innerHTML = '<div style="text-align:center;color:#ef4444;padding:16px;font-size:13px;">날씨 정보를 불러올 수 없습니다.</div>';
            }
        }

        // ── 서울 시간 병기 (해외 시간대일 때) ──────────────────────────
        function updateSeoulTime() {
            const badge = document.getElementById('info-seoul-time');
            const txt   = document.getElementById('info-seoul-text');
            if (!badge) return;
            // 한국 시간대면 병기 불필요
            if (userTimezone === 'Asia/Seoul') { badge.style.display = 'none'; return; }
            try {
                const now = new Date();
                const seoulTime = now.toLocaleTimeString('ko-KR', {
                    timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit', hour12:false
                });
                if (txt) txt.textContent = `서울 ${seoulTime}`;
                badge.style.display = 'inline-flex';
            } catch(e) { badge.style.display = 'none'; }
        }
        function closeModal() {
            document.getElementById('master-modal').style.display = 'none';
        }

