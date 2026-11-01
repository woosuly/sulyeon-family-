        // ── 메인 슬라이드 ──────────────────────────────────────────────
        let mainSlideIdx = 0;

        function goMainSlide(idx) {
            const track = document.getElementById('main-slide-track');
            if (!track) return;
            mainSlideIdx = idx;
            track.scrollTo({ left: idx * track.offsetWidth, behavior: 'smooth' });
            document.querySelectorAll('.main-slide-dot').forEach((d, i) => {
                d.classList.toggle('active', i === idx);
            });
        }

        // 스와이프 감지
        function initMainSlide() {
            const track = document.getElementById('main-slide-track');
            if (!track) return;
            let startX = 0;
            track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
            track.addEventListener('touchend',   e => {
                const dx = e.changedTouches[0].clientX - startX;
                if (Math.abs(dx) > 50) goMainSlide(dx < 0 ? 1 : 0);
            }, { passive: true });
            // 스크롤로도 dot 동기화
            track.addEventListener('scroll', () => {
                const idx = Math.round(track.scrollLeft / track.offsetWidth);
                if (idx !== mainSlideIdx) {
                    mainSlideIdx = idx;
                    document.querySelectorAll('.main-slide-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
            var idcBar=document.getElementById('idc-bar');if(idcBar)idcBar.style.display=idx===0?'':'none';
                }
            }, { passive: true });
        }

        function renderMainDashboard() {
            const today    = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
            const fmt      = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const fmt2     = n => n >= 10000 ? (n/10000).toFixed(0)+'만' : n.toLocaleString();
            const memberColor = m => m==='정우설'?'#3b82f6':m==='한미연'?'#f472b6':'#10b981';
            const memberLabel = m => m==='정우설'?'정우설':m==='한미연'?'한미연':'공통';

            // ── 오늘 일정
            const todayEvs = schData.filter(s => s.date === todayStr && schShow(s));
            const tl = document.getElementById('main-today-list');
            if (tl) tl.innerHTML = todayEvs.length
                ? todayEvs.slice(0,4).map(ev => `
                    <div class="dash-ev-item">
                        <div class="dash-ev-dot" style="background:${memberColor(ev.member)};"></div>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(ev.memo||'')}</span>
                        ${ev.priority==='중요'?'<span style="font-size:10px;">⭐</span>':''}
                    </div>`).join('')
                : '<div class="dash-empty">일정 없음</div>';

            // ── 이번달 중요 일정 (오늘 이후만)
            const ym2 = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
            const wEvs = schData.filter(s => s.priority==='중요' && s.date>=todayStr && s.date.startsWith(ym2) && schShow(s));
            const wl = document.getElementById('main-week-list');
            if (wl) wl.innerHTML = wEvs.length
                ? wEvs.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5).map(ev => `
                    <div class="dash-ev-item">
                        <div class="dash-ev-dot" style="background:${memberColor(ev.member)};"></div>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(ev.memo||'')}</span>
                        <span style="font-size:9px;color:#94a3b8;flex-shrink:0;">${ev.date?.slice(5).replace('-','/')}</span>
                    </div>`).join('')
                : '<div class="dash-empty">이번달 중요 일정 없음</div>';

            // ── 여행&여가 다가올 3개 (오늘 포함, 지난 것 제외)
            const travelEl = document.getElementById('main-travel-list');
            if (travelEl) {
                const typeIcon = t => ({'여행':'✈️','캠핑':'⛺','골프':'⛳','스크린골프':'🏌️','등산':'🏔️'}[t]||'📌');
                const mbg = m => m==='정우설'?'#dbeafe':m==='한미연'?'#fce7f3':'#f0fdf4';
                const dday = s => {
                    const d = Math.ceil((new Date(s) - new Date(todayStr)) / 86400000);
                    return d > 0 ? `D-${d}` : d === 0 ? '🎯 D-Day' : `D+${Math.abs(d)}`;
                };
                // end 날짜 기준으로 지난 것 필터 (end 없으면 start로 판단)
                const upcoming = [...(planData||[])]
                    .filter(p => {
                        const endDate = p.end || p.start || '';
                        return endDate >= todayStr; // 오늘 이후 종료되는 것
                    })
                    .sort((a,b) => (a.start||'').localeCompare(b.start||''))
                    .slice(0,3);
                travelEl.innerHTML = upcoming.length
                    ? upcoming.map(p => {
                        const startStr = (p.start||'').slice(5).replace('-','/');
                        const endStr   = p.end && p.end !== p.start ? '~'+(p.end||'').slice(5).replace('-','/') : '당일';
                        return `<div class="dash-ev-item" style="flex-direction:column;align-items:flex-start;gap:3px;padding:7px 8px;">
                            <div style="display:flex;align-items:center;gap:6px;width:100%;">
                                <span style="font-size:14px;">${typeIcon(p.subType)}</span>
                                <span style="flex:1;font-weight:700;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.loc||'미정')}</span>
                                <span style="font-size:10px;font-weight:800;color:var(--month-accent);flex-shrink:0;">${dday(p.start)}</span>
                            </div>
                            <div style="display:flex;gap:5px;align-items:center;padding-left:20px;flex-wrap:wrap;">
                                <span style="font-size:9px;color:#94a3b8;">${startStr} ${endStr}</span>
                                <span style="font-size:9px;background:${mbg(p.member)};padding:1px 7px;border-radius:10px;font-weight:600;">${p.member||'공통'}</span>
                                <span style="font-size:9px;color:#94a3b8;">${p.subType||''}</span>
                            </div>
                        </div>`;
                    }).join('')
                    : '<div class="dash-empty">다가올 계획이 없어요</div>';
            }

            // ── 가계부 수입/지출/손익
            const ym = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
            const allA = Object.values(assetData).flat().filter(a=>a.date?.startsWith(ym));
            const inc  = allA.filter(a=>a.type==='수입').reduce((s,a)=>s+Number(a.amt),0);
            const exp  = allA.filter(a=>a.type==='지출').reduce((s,a)=>s+Number(a.amt),0);
            const mi=document.getElementById('main-inc'), me=document.getElementById('main-exp'), mb=document.getElementById('main-bal');
            if(mi) mi.textContent = fmt2(inc)+'원';
            if(me) me.textContent = fmt2(exp)+'원';
            if(mb){ mb.textContent = fmt2(inc-exp)+'원'; mb.style.color = inc>=exp?'#166534':'#991b1b'; }

            // ── 지출 유형 막대 그래프 (항상 표시)
            const barsEl = document.getElementById('main-expense-bars');
            if (barsEl) {
                const expArr = allA.filter(a=>a.type==='지출');
                const catMap = {};
                expArr.forEach(a=>{ const k=a.category||'기타'; catMap[k]=(catMap[k]||0)+Number(a.amt); });
                const total = Object.values(catMap).reduce((s,v)=>s+v,0);
                const catColors = {
                    '생활비':'#6366f1','의료비':'#ec4899','쇼핑':'#f59e0b','식사':'#10b981',
                    '교통비':'#3b82f6','여가':'#8b5cf6','여행비':'#06b6d4','가족':'#f97316',
                    '기타지출':'#94a3b8','기타':'#94a3b8'
                };
                if (total === 0) {
                    barsEl.innerHTML = '<div class="dash-empty">지출 내역 없음</div>';
                } else {
                const catOrder = ['생활비','의료비','쇼핑','식사','교통비','여가','여행비','가족','기타지출','기타'];
                    const sorted = catOrder.filter(k=>catMap[k]).map(k=>[k,catMap[k]])
                        .concat(Object.entries(catMap).filter(([k])=>!catOrder.includes(k)))
                        .sort((a,b)=>b[1]-a[1]);
                    barsEl.style.cssText = 'flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;max-width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;padding-right:2px;';
                    barsEl.innerHTML = sorted.map(([k,v])=>{
                        const pct = Math.round(v/total*100);
                        const col = catColors[k]||'#94a3b8';
                        return `<div>
                            <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:9px;margin-bottom:2px;">
                                <span style="color:#374151;font-weight:700;">${k}</span>
                                <span style="color:#64748b;">${fmt2(v)}<span style="color:#94a3b8;font-size:8px;margin-left:2px;">${pct}%</span></span>
                            </div>
                            <div style="height:5px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                                <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;"></div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }
        }

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

