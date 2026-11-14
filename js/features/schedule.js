        // ── 달력 네비게이션 ───────────────────────────────────────────────
        const MONTH_EN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        let schDetailDate = '';
        function schNavigate(n) {
            curViewDate.setMonth(curViewDate.getMonth() + n);
            renderSch();
        }

        function schGoToday() {
            curViewDate = new Date();
            renderSch();
        }

        // 간소화된 정확 음력: 기준점 룩업으로 계산
        // 실용적 기준: 1970-01-01 = 음력 1969-11-24
        // 한국 음력 테이블 (1930~2060): [음력 1월 1일의 1970-01-01 기준 일수, 윤달(0=없음), 큰달 비트]
        const FAM_LUNAR = [[-14581,6,3366],[-14198,0,1319],[-13844,0,2647],[-13489,5,4790],[-13105,0,2778],[-12750,0,1748],[-12396,3,3753],[-12012,0,1865],[-11658,7,5779],[-11274,0,2707],[-10920,0,1323],[-10566,6,2651],[-10182,0,2413],[-9827,0,2922],[-9472,4,6996],[-9088,0,2980],[-8734,0,2889],[-8380,2,6803],[-7996,0,2709],[-7642,7,5419],[-7258,0,1325],[-6904,0,2733],[-6549,5,5482],[-6165,0,3506],[-5810,0,3492],[-5456,3,7497],[-5072,0,3402],[-4718,8,6805],[-4334,0,2710],[-3980,0,1366],[-3626,6,2741],[-3242,0,2773],[-2887,0,1746],[-2533,4,3749],[-2149,0,3749],[-1794,0,3658],[-1440,3,3222],[-1057,0,2715],[-702,7,5462],[-318,0,1386],[36,0,2905],[391,5,5970],[775,0,1874],[1129,0,1829],[1483,4,5707],[1867,0,2635],[2221,8,4779],[2605,0,685],[2959,0,1387],[3314,6,2921],[3698,0,3497],[4053,0,3474],[4407,4,6949],[4791,0,3365],[5145,10,6733],[5529,0,2646],[5883,0,694],[6237,6,5549],[6622,0,1748],[6976,0,3497],[7331,5,7570],[7715,0,3730],[8069,0,3366],[8423,3,2646],[8806,0,2647],[9161,8,4790],[9545,0,2906],[9900,0,1748],[10254,5,3785],[10638,0,1865],[10992,0,1683],[11346,4,5415],[11730,0,1323],[12084,0,2651],[12439,2,5466],[12823,0,874],[13177,7,6997],[13562,0,2980],[13916,0,2889],[14270,5,6803],[14654,0,2709],[15008,0,1325],[15362,3,2653],[15746,0,2733],[16101,9,5546],[16485,0,1490],[16839,0,3493],[17194,5,7497],[17578,0,3402],[17932,0,2709],[18286,4,5421],[18670,0,1366],[19024,0,2741],[19379,2,5546],[19763,0,1746],[20117,6,3749],[20501,0,3749],[20856,0,3658],[21210,5,3222],[21593,0,3227],[21948,0,1370],[22302,3,2773],[22686,0,2921],[23041,11,5970],[23425,0,1874],[23779,0,2853],[24133,6,5707],[24517,0,2635],[24871,0,1195],[25225,5,1371],[25609,0,1389],[25964,0,2921],[26319,2,6994],[26703,0,3474],[27057,7,7461],[27441,0,3365],[27795,0,2637],[28149,5,5293],[28533,0,694],[28887,0,1461],[29242,3,3497],[29626,0,3529],[29981,8,7570],[30365,0,3730],[30719,0,3366],[31073,6,2646],[31456,0,2647],[31811,0,1238],[32165,4,1717],[32549,0,1749],[32904,0,3785]];
        const famEpoch = (y, m, d) => Math.round(Date.UTC(y, m, d) / 864e5);
        function famLunar(y, m, d) {
            const e = famEpoch(y, m, d);
            let i = FAM_LUNAR.length - 1; while (i > 0 && FAM_LUNAR[i][0] > e) i--;
            if (i < 0 || e < FAM_LUNAR[0][0] || i === FAM_LUNAR.length - 1 && e >= FAM_LUNAR[i][0] + 390) return null;
            const [st, leap, bits] = FAM_LUNAR[i], n = leap ? 13 : 12;
            let off = e - st;
            for (let k = 0; k < n; k++) {
                const len = (bits >> k) & 1 ? 30 : 29;
                if (off < len) { const isLeap = leap && k === leap; const mon = leap && k >= leap ? k : k + 1; return { year: 1930 + i, month: mon, day: off + 1, leap: !!isLeap }; }
                off -= len;
            }
            return null;
        }
        // 음력 → 양력 (없는 30일은 29일로, 윤달 생일은 평달로)
        function famLunarToSolar(ly, lm, ld, leap) {
            const r = FAM_LUNAR[ly - 1930]; if (!r) return null;
            const [st, lp, bits] = r, n = lp ? 13 : 12; let e = st;
            for (let k = 0; k < n; k++) {
                const isLeap = lp && k === lp, mon = lp && k >= lp ? k : k + 1, len = (bits >> k) & 1 ? 30 : 29;
                if (mon === lm && (!!leap === !!isLeap || (leap && !lp))) { const dd = new Date((e + Math.min(ld, len) - 1) * 864e5); return new Date(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate()); }
                e += len;
            }
            return null;
        }
        function getLunarDate(year, month, day) {
            const l = famLunar(year, month, day);
            return l ? { month: (l.leap ? '윤' : '') + l.month, day: l.day, leap: l.leap, year: l.year } : { month: '', day: '' };
        }
        const famDs = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // ── 연도별 공휴일 (관공서의 공휴일에 관한 규정 기준, 대체공휴일 포함) ──
        // 선거일·임시공휴일은 정부 발표 시 여기에 추가
        const FAM_EXTRA_HOLI = {
            '2023-10-02': '임시공휴일', '2024-04-10': '국회의원선거', '2024-10-01': '임시공휴일',
            '2025-01-27': '임시공휴일', '2025-06-03': '대통령선거', '2026-06-03': '지방선거', '2028-04-12': '국회의원선거'
        };
        const famHoliCache = {};
        // 정부 발표(우주항공청 월력요항) 공휴일 — 임시공휴일·선거일 포함, 앱을 열 때 하루 1번 자동 갱신
        const FAM_HOLI_URL = 'https://cdn.jsdelivr.net/npm/@hyunbinseo/holidays-kr@5.2027.2/dist/index.js';
        let famHoliOnline = (() => { try { return JSON.parse(localStorage.getItem('famHoliOnline') || '{}'); } catch (e) { return {}; } })();
        const famHoliName = n => String(n).replace(/^1월 1일$/, '신정').replace('3ㆍ1절', '삼일절').replace(/^대체공휴일.*$/, '대체공휴일')
            .replace(/^설날 (전날|다음 날)$/, '설날 연휴').replace(/^추석 (전날|다음 날)$/, '추석 연휴').replace('기독탄신일', '크리스마스')
            .replace('부처님 오신 날', '부처님오신날').replace(/^임시공휴일\((.+)\)$/, '$1').replace('전국동시지방선거', '지방선거');
        async function famHoliSync(force) {
            const today = famDs(new Date()); if (!force && famHoliOnline._at === today) return;
            try {
                const mod = await import(FAM_HOLI_URL), y = new Date().getFullYear(), out = { _at: today };
                for (const yy of [y - 1, y, y + 1, y + 2]) { try { out[yy] = await mod.getHolidayPreset(String(yy)); } catch (e) {} }
                if (Object.keys(out).length < 2) return;
                const changed = JSON.stringify({ ...out, _at: 0 }) !== JSON.stringify({ ...famHoliOnline, _at: 0 });
                famHoliOnline = out; try { localStorage.setItem('famHoliOnline', JSON.stringify(out)); } catch (e) {}
                if (changed) {
                    Object.keys(famHoliCache).forEach(k => delete famHoliCache[k]); Object.keys(famSpecCache).forEach(k => delete famSpecCache[k]);
                    try { if (document.getElementById('schedule-section')?.classList.contains('active')) renderSch(); } catch (e) {}
                    try { if (document.getElementById('asset-cal-section')?.classList.contains('active')) renderAssetCal(); } catch (e) {}
                }
            } catch (e) { console.warn('[공휴일] 온라인 갱신 실패, 계산값 사용', e); }
        }
        setTimeout(() => famHoliSync(), 3000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') famHoliSync(); });
        function famHolidaysOf(y) {
            if (famHoliCache[y]) return famHoliCache[y];
            if (famHoliOnline[y]) {
                const o = {}; Object.entries(famHoliOnline[y]).forEach(([k, arr]) => { o[k] = [...new Set((Array.isArray(arr) ? arr : [arr]).map(famHoliName))].join('·'); });
                return (famHoliCache[y] = o);
            }
            const H = {}, add = (d, n) => { if (!d) return; const k = famDs(d); (H[k] = H[k] || []).push(n); };
            const D = (m, d) => new Date(y, m - 1, d);
            const weekendSub = [], kidsSub = [], groups = [];
            add(D(1, 1), '신정');
            add(D(3, 1), '삼일절'); weekendSub.push(D(3, 1));
            if (y >= 2026) { add(D(5, 1), '노동절'); weekendSub.push(D(5, 1)); }
            add(D(5, 5), '어린이날'); if (y >= 2015) kidsSub.push(D(5, 5));
            add(D(6, 6), '현충일');
            if (y >= 2026 || y < 2008) { add(D(7, 17), '제헌절'); if (y >= 2026) weekendSub.push(D(7, 17)); }
            add(D(8, 15), '광복절'); if (y >= 2021) weekendSub.push(D(8, 15));
            add(D(10, 3), '개천절'); if (y >= 2021) weekendSub.push(D(10, 3));
            add(D(10, 9), '한글날'); if (y >= 2021) weekendSub.push(D(10, 9));
            add(D(12, 25), '크리스마스'); if (y >= 2023) weekendSub.push(D(12, 25));
            const bud = famLunarToSolar(y, 4, 8); add(bud, '부처님오신날'); if (y >= 2023 && bud) weekendSub.push(bud);
            const seol = famLunarToSolar(y, 1, 1);
            if (seol) { const g = [-1, 0, 1].map(k => new Date(seol.getFullYear(), seol.getMonth(), seol.getDate() + k)); add(g[0], '설날 연휴'); add(g[1], '설날'); add(g[2], '설날 연휴'); groups.push(g); }
            const chu = famLunarToSolar(y, 8, 15);
            if (chu) { const g = [-1, 0, 1].map(k => new Date(chu.getFullYear(), chu.getMonth(), chu.getDate() + k)); add(g[0], '추석 연휴'); add(g[1], '추석'); add(g[2], '추석 연휴'); groups.push(g); }
            Object.entries(FAM_EXTRA_HOLI).forEach(([k, n]) => { if (+k.slice(0, 4) === y) (H[k] = H[k] || []).push(n); });
            // 대체공휴일
            const isOff = d => { const k = famDs(d); return d.getDay() === 0 || d.getDay() === 6 || !!H[k]; };
            const subAfter = from => { const d = new Date(from); do { d.setDate(d.getDate() + 1); } while (isOff(d)); (H[famDs(d)] = H[famDs(d)] || []).push('대체공휴일'); };
            if (y >= 2014) groups.forEach(g => { let cnt = 0; g.forEach(d => { const names = H[famDs(d)] || []; if (d.getDay() === 0 || names.filter(n => !/설날|추석/.test(n)).length) cnt++; }); for (let i = 0; i < cnt; i++) subAfter(g[2]); });
            kidsSub.forEach(d => { const names = H[famDs(d)] || []; if (d.getDay() === 0 || d.getDay() === 6 || names.length > 1) subAfter(d); });
            weekendSub.forEach(d => { if (d.getDay() === 0 || d.getDay() === 6) subAfter(d); });
            const out = {}; Object.keys(H).forEach(k => out[k] = [...new Set(H[k])].join('·'));
            return (famHoliCache[y] = out);
        }
        // 기념일·절기 (쉬는 날 아님)
        const famSpecCache = {};
        function famSpecialsOf(y) {
            if (famSpecCache[y]) return famSpecCache[y];
            const S = {}, add = (d, n) => { if (d) S[famDs(d)] = S[famDs(d)] ? S[famDs(d)] + '·' + n : n; }, D = (m, d) => new Date(y, m - 1, d);
            add(D(4, 5), '식목일'); add(D(4, 19), '4·19혁명'); add(D(5, 8), '어버이날'); add(D(5, 15), '스승의날'); add(D(5, 18), '5·18민주화운동');
            add(D(6, 25), '6·25전쟁일'); add(D(10, 1), '국군의날');
            if (y < 2026) add(D(5, 1), '근로자의날');
            if (y >= 2008 && y < 2026) add(D(7, 17), '제헌절');
            add(famLunarToSolar(y, 1, 15), '정월대보름'); add(famLunarToSolar(y, 5, 5), '단오'); add(famLunarToSolar(y, 7, 7), '칠석');
            const yy = y % 100; add(D(12, Math.floor(yy * 0.2422 + 21.94) - Math.floor((yy - 1) / 4)), '동지');
            const H = famHolidaysOf(y); Object.keys(S).forEach(k => { if (H[k]) delete S[k]; });
            return (famSpecCache[y] = S);
        }
        const famHoli = ds => famHolidaysOf(+ds.slice(0, 4))[ds] || '';
        const famSpec = ds => famSpecialsOf(+ds.slice(0, 4))[ds] || '';

        // ISO 주차 계산
        function getWeekNumber(date) {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        }

        // ── 월간 캘린더 렌더 ─────────────────────────────────────────────
        // ── 일정 구성원 필터 (드롭다운) ──────────────────────────────────
        const SCH_F = (function(){ try { return JSON.parse(localStorage.getItem('schFilter2')||'null'); } catch(e){ return null; } })() || { mode:'all', trip:true };
        // 구성원 표시: 정우설·한미연·공통 각각 켜고 끔 (예전 드롭다운 설정은 자동 변환)
        if (!SCH_F.show) { const m = SCH_F.mode || 'all'; SCH_F.show = { '정우설': ['all','ws','ws1'].includes(m), '한미연': ['all','hm','hm1'].includes(m), '공통': !['ws1','hm1'].includes(m) }; delete SCH_F.mode; }
        function schKey(ev){ return (ev.member==='정우설'||ev.member==='한미연') ? ev.member : '공통'; }
        function schShow(ev){
            if (ev.planId && !SCH_F.trip) return false;
            return SCH_F.show[schKey(ev)] !== false;
        }
        function schMaxEv(){ return window.innerWidth >= 1024 ? 4 : 3; }
        function schToggle(who,on){ SCH_F.show[who]=on; schSet('show',SCH_F.show); }
        function schSet(k,v){ SCH_F[k]=v; try{ localStorage.setItem('schFilter2',JSON.stringify(SCH_F)); }catch(e){} renderSch(); if (typeof renderMainDashboard==='function') renderMainDashboard(); }
        function schRenderChips(){
            const el=document.getElementById('sch-filter-chips'); if(!el) return;
            // 구성원 색 점 = 달력 막대 색 (누르면 켜고 끔)
            el.innerHTML = [['정우설','#93c5fd'],['한미연','#f9a8d4'],['공통','#86efac']].map(([k,c])=>`<label class="sch-fchip ${SCH_F.show[k]!==false?'':'off'}"><input type="checkbox" ${SCH_F.show[k]!==false?'checked':''} onchange="schToggle('${k}',this.checked)"><i class="sch-dot" style="background:${c}"></i>${k}</label>`).join('') + `
                <label class="sch-fchip ${SCH_F.trip?'':'off'}"><input type="checkbox" ${SCH_F.trip?'checked':''} onchange="schSet('trip',this.checked)">여행·여가</label>`;
        }
        function schAddPlan(ds){
            closeSchDetail();
            openPlanModal(null);
            const s=document.getElementById('plan-start-date'), e=document.getElementById('plan-end-date');
            if(s) s.value=ds; if(e && !e.value) e.value=ds;
            if(typeof generateDayInputs==='function') generateDayInputs();
        }

        function renderSch() {
            schRenderChips();
            const grid = document.getElementById('sch-grid');
            if (!grid) return;
            grid.innerHTML = '';
            renderSchMonth(grid);
        }

        function renderSchMonth(grid) {
            const y = curViewDate.getFullYear(), m = curViewDate.getMonth();

            document.getElementById('sch-label').innerHTML =
                `${y}년 ${m+1}월 <span style="color:#94a3b8;font-size:.8em;font-weight:500">${MONTH_EN[m]}</span>`;

            // 그리드 스타일: W#(28px) + 일~토 7열
            grid.style.cssText = `
                display:grid;
                grid-template-columns:${window.innerWidth < 520 ? 0 : 28}px repeat(7,minmax(0,1fr));
                background:#e2e8f0;
                gap:1px;
                min-width:0; width:100%;
                border-radius:14px;
                overflow:hidden;
            `;

            const today     = new Date();
            const todayStr  = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
            const firstDay  = new Date(y, m, 1).getDay(); // 0=일
            // 이 달 1일이 속한 주의 일요일
            const firstSun  = new Date(y, m, 1 - firstDay);

            /* ── 헤더 ── */
            const mkHdr = (text, color, bg) => {
                const el = document.createElement('div');
                el.style.cssText = `background:${bg||'#f0f4f8'};padding:9px 0;text-align:center;font-size:11px;font-weight:700;color:${color||'#64748b'};`;
                el.textContent = text;
                return el;
            };
            const narrow = window.innerWidth < 520;   // 폰: 주차 칸 숨기고 날짜 칸을 넓게
            grid.appendChild(mkHdr(narrow ? '' : 'W#','#c0ccda'));
            ['일','월','화','수','목','금','토'].forEach((d,i) => {
                grid.appendChild(mkHdr(d, i===0?'#ef4444':i===6?'#3b82f6':'#64748b'));
            });

            /* ── 날짜 행: 이 달을 포함하는 주를 모두 그림 ── */
            // 마지막 날이 포함된 주의 일요일까지
            const lastDay   = new Date(y, m+1, 0).getDate();
            const lastDate  = new Date(y, m, lastDay);
            const lastSun   = new Date(lastDate);
            lastSun.setDate(lastDate.getDate() - lastDate.getDay()); // 마지막 날 주의 일요일

            let weekStart = new Date(firstSun);
            while (weekStart <= lastSun) {
                // ISO 주차: 그 주 목요일(일요일+4) 기준
                const thursday = new Date(weekStart);
                thursday.setDate(weekStart.getDate() + 4);
                const wn = getWeekNumber(thursday);

                // 주차 셀
                const wCell = document.createElement('div');
                wCell.style.cssText = 'background:#f8fafc;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#94a3b8;';
                wCell.textContent = narrow ? '' : `W${wn}`;
                grid.appendChild(wCell);

                // 7일
                for (let dow = 0; dow < 7; dow++) {
                    const date  = new Date(weekStart);
                    date.setDate(weekStart.getDate() + dow);
                    const dy    = date.getFullYear();
                    const dm    = date.getMonth();
                    const dd    = date.getDate();
                    const ds    = `${dy}-${String(dm+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
                    const mKey  = `${String(dm+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
                    const isCur = dm === m;
                    const dayW  = date.getDay();
                    const isRed = dayW === 0 || !!famHoli(ds);
                    const isSat = dayW === 6;
                    const isToday = ds === todayStr;

                    const cell = document.createElement('div');
                    const bgBase = isToday ? '#dbeafe' : isCur ? '#ffffff' : '#f8fafc';
                    cell.style.cssText = `
                        background:${bgBase};
                        height:var(--cal-cell-h,clamp(78px,9vw,112px)); min-width:0;
                        padding:5px 5px 3px;
                        cursor:pointer;
                        display:flex; flex-direction:column;
                        overflow:hidden;
                    `;
                    cell.onmouseenter = () => { cell.style.background = isToday ? '#bfdbfe' : '#f0f7ff'; };
                    cell.onmouseleave = () => { cell.style.background = bgBase; };
                    cell.onclick = () => openDayDetail(ds);

                    /* ── 날짜 숫자 줄 (주차 중복 제거 - W# 열에만 표시) ── */
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:baseline;gap:3px;flex-wrap:nowrap;line-height:1.2;overflow:hidden;white-space:nowrap;flex-shrink:0;';

                    const dNum = document.createElement('span');
                    dNum.style.cssText = `
                        font-weight:800;
                        font-size:clamp(11px,1.3vw,14px);
                        color:${!isCur?'#c0ccda':isToday?'#2563eb':isRed?'#ef4444':isSat?'#3b82f6':'#1e293b'};
                    `;
                    dNum.textContent = dd;
                    row.appendChild(dNum);

                    // 일요일 음력 (주차 레이블 제거, 음력만 유지)
                    if (dayW === 0 && isCur && !narrow) {
                        const lun = getLunarDate(dy, dm, dd);
                        const ls = document.createElement('span');
                        ls.style.cssText = 'font-size:9px;color:#c0ccda;overflow:hidden;text-overflow:ellipsis;';
                        ls.textContent = `(${lun.month}/${lun.day})`;
                        row.appendChild(ls);
                    }
                    cell.appendChild(row);

                    /* ── 이벤트 바 (현재 달만) ── */
                    if (isCur) {
                        // 연속 일정을 먼저(시작일 순) 그려 날마다 같은 줄에 이어지게
                        const dayEvs = schData.filter(s => s.date === ds && schShow(s))
                            .sort((a, b) => (b.span ? 1 : 0) - (a.span ? 1 : 0) || String(a.span?.start || '').localeCompare(String(b.span?.start || '')) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
                        dayEvs.slice(0, schMaxEv()).forEach(ev => {
                            const isImpt = ev.priority === '중요';
                            const bar = document.createElement('div');
                            const sp = ev.span, contL = sp && sp.idx > 0 && dayW !== 0, contR = sp && sp.idx < sp.n - 1 && dayW !== 6;
                            const bg = ev.member==='정우설'?'#dbeafe':ev.member==='한미연'?'#fce7f3':ev.member==='가족'||!ev.member||ev.planId?'#dcfce7':'#f1f5f9';
                            bar.style.cssText = `
                                display:flex; align-items:center; gap:2px;
                                font-size:${narrow ? 10 : 11}px; line-height:1.25; padding:2px ${narrow ? 3 : 5}px; margin-top:2px;
                                border-radius:${contL ? 0 : 5}px ${contR ? 0 : 5}px ${contR ? 0 : 5}px ${contL ? 0 : 5}px;
                                margin-left:${contL ? -6 : 0}px; margin-right:${contR ? -6 : 0}px;
                                font-weight:600; overflow:hidden; min-height:${narrow ? 15 : 17}px;
                                background:${bg};
                                cursor:pointer;
                                border-left:${contL ? 0 : 3}px solid ${isImpt?'#f59e0b':sp?'rgba(0,0,0,.18)':'transparent'};
                            `;
                            if (isImpt && !narrow) {
                                const star = document.createElement('span');
                                star.textContent = '⭐';
                                star.style.cssText = 'font-size:9px;flex-shrink:0;';
                                bar.appendChild(star);
                            }
                            if (ev.repeat && !narrow) {
                                const rep = document.createElement('span');
                                rep.textContent = ev.repeat.cal === 'lunar' ? '🌙' : '🔁';
                                rep.style.cssText = 'font-size:8px;flex-shrink:0;opacity:.7;';
                                bar.appendChild(rep);
                            }
                            const txt = document.createElement('span');
                            txt.style.cssText = 'overflow:hidden;flex:1;min-width:0;' + (narrow ? 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all;white-space:normal;' : 'text-overflow:ellipsis;white-space:nowrap;') + (contL ? 'opacity:.55;' : '');
                            // 연속 일정은 첫날·주 시작(일요일)에만 글자, 나머지는 막대만 이어짐
                            txt.textContent = sp && sp.idx > 0 && dayW !== 0 && !narrow ? '' : (ev.startTime && !narrow ? ev.startTime + ' ' : '') + (ev.memo || '');
                            bar.appendChild(txt);
                            bar.onclick = e => { e.stopPropagation(); openDayDetail(ds); };
                            cell.appendChild(bar);
                        });
                        if (dayEvs.length > schMaxEv()) {
                            const more = document.createElement('div');
                            more.style.cssText = 'font-size:9px;color:#94a3b8;margin-top:2px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;';
                            more.textContent = window.innerWidth < 520 ? `+${dayEvs.length - schMaxEv()}` : `+${dayEvs.length - schMaxEv()}개 더보기`;
                            more.onclick = e => { e.stopPropagation(); openDayDetail(ds); };
                            cell.appendChild(more);
                        }
                    }

                    /* ── 공휴일·기념일: flex:1 공간 차지 후 하단 고정 ── */
                    const spacer = document.createElement('div');
                    spacer.style.flex = '1';
                    cell.appendChild(spacer);

                    if (isCur && (famHoli(ds) || famSpec(ds))) {
                        const label = document.createElement('div');
                        const isHoli = !!famHoli(ds);
                        label.style.cssText = `
                            font-size:8px; font-weight:${isHoli?'700':'500'};
                            color:${isHoli?'#ef4444':'#94a3b8'};
                            line-height:1.3; margin-top:2px; flex-shrink:0;
                            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        `;
                        label.textContent = famHoli(ds) || famSpec(ds); label.title = label.textContent;
                        cell.appendChild(label);
                    }

                    grid.appendChild(cell);
                }

                // 다음 주로
                weekStart.setDate(weekStart.getDate() + 7);
            }
        }

        // ── 날짜 클릭 → 상세 모달 ───────────────────────────────────────
        const DAY_LABEL = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];

        function openDayDetail(ds) {
            schDetailDate = ds;
            closeSchAction();

            const evs     = schData.filter(s => s.date === ds && schShow(s));
            const date    = new Date(ds);
            const mKey    = ds.slice(5,10);
            const holiName = famHoli(ds) || famSpec(ds) || ''; const _lun = getLunarDate(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10));

            document.getElementById('sch-detail-title').textContent =
                `${ds.replace(/-/g,'.')} (${DAY_LABEL[date.getDay()]})`;
            document.getElementById('sch-detail-weekday').textContent =
                (holiName ? `${famHoli(ds) ? '🔴' : '•'} ${holiName} · ` : '') + (_lun.month ? `음력 ${_lun.month}.${_lun.day}` : '');

            const list = document.getElementById('sch-detail-list');
            list.innerHTML = '';

            if (!evs.length) {
                list.innerHTML = `<div style="text-align:center;color:#cbd5e1;padding:20px 0;font-size:13px;">등록된 일정이 없습니다.</div>`;
            } else {
                evs.forEach(ev => {
                    const memberColor = ev.member === '정우설' ? '#dbeafe' : ev.member === '한미연' ? '#fce7f3' : '#f0fdf4';
                    const catIcon = ev.category === '회사' ? '💼' : ev.category === '가족' ? '👨‍👩‍👧' : '🙍';

                    // 아이템 컨테이너
                    const item = document.createElement('div');
                    item.className = 'sch-detail-item';

                    // 왼쪽 내용
                    const left = document.createElement('div');
                    left.className = 'sch-detail-item-left';
                    left.style.flex = '1';
                    left.innerHTML = `
                        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                            ${ev.priority==='중요' ? '<span style="font-size:10px;background:#fef3c7;color:#d97706;padding:1px 7px;border-radius:20px;font-weight:700;">⭐ 중요</span>' : ''}
                            <span style="font-size:10px;background:${memberColor};padding:1px 7px;border-radius:20px;font-weight:700;">${ev.member||''}</span>
                            <span style="font-size:10px;color:#94a3b8;">${catIcon} ${ev.category||''}</span>
                        </div>
                        ${ev.timeType === 'timed' && ev.startTime ? `<div style="font-size:11px;color:var(--month-header);font-weight:700;margin-bottom:3px;">🕐 ${ev.startTime}${ev.endTime?' ~ '+ev.endTime:''}</div>` : ev.timeType === 'allday' ? '<div style="font-size:10px;color:#94a3b8;margin-bottom:2px;">종일</div>' : ''}
                        <div class="sch-detail-memo">${escHtml(ev.memo||'(내용 없음)')}</div>
                        ${ev.place ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">📍 ${escHtml(ev.place)}</div>` : ''}
                    `;

                    // ••• 버튼 - ev.id로만 참조 (JSON 직렬화 없음)
                    const actionBtn = document.createElement('button');
                    actionBtn.className = 'sch-item-action-btn';
                    actionBtn.textContent = '•••';
                    actionBtn.onclick = (e) => {
                        e.stopPropagation();
                        // schData에서 id로 최신 객체 찾기
                        const target = schData.find(s => s.id === ev.id) || ev;
                        openSchActionSheet(target);
                    };

                    item.appendChild(left);
                    item.appendChild(actionBtn);
                    list.appendChild(item);
                });
            }

            document.getElementById('sch-detail-modal').classList.remove('hidden');
        }

        function closeSchDetail() {
            document.getElementById('sch-detail-modal').classList.add('hidden');
        }

        // ── 일정 항목 클릭 → 수정/삭제 액션시트 ─────────────────────────
        let schActionTarget = null; // 현재 액션 대상 일정

        function openSchActionSheet(ev) {
            schActionTarget = ev;
            const memberColor = ev.member === '정우설' ? '#dbeafe' : ev.member === '한미연' ? '#fce7f3' : '#f0fdf4';

            document.getElementById('sch-action-title').innerHTML =
                `${ev.priority==='중요'?'⭐ ':''}${escHtml(ev.memo||'(내용 없음)')}`;
            document.getElementById('sch-action-meta').innerHTML =
                `<span style="background:${memberColor};padding:1px 8px;border-radius:20px;font-size:11px;font-weight:700;">${ev.member||''}</span>
                 &nbsp;${ev.category||''} ${ev.place ? '· 📍'+escHtml(ev.place) : ''}`;

            document.getElementById('sch-action-edit-btn').onclick = () => {
                // closeSchAction보다 먼저 복사해둬야 null이 되지 않음
                const target = schActionTarget;
                closeSchAction();
                openSchModal(target, target.date);
            };

            document.getElementById('sch-action-del-btn').onclick = async () => {
                if (!confirm(`"${ev.memo}" 일정을 삭제할까요?`)) return;
                try {
                    await db.collection('schedules').doc(ev.id).delete();
                    // 모든 모달 완전히 닫기
                    closeSchAction();
                    closeSchDetail();
                    closeModal();
                    renderSch();
                } catch(e) {
                    alert('삭제 오류: ' + e.message);
                }
            };

            document.getElementById('sch-action-sheet').classList.remove('hidden');
        }

        function closeSchAction() {
            document.getElementById('sch-action-sheet').classList.add('hidden');
            schActionTarget = null;
        }

        // ── 반복 범위 선택 모달 ──────────────────────────────────────────
        let repeatScopeAction = null; // 'edit' | 'delete'
        let repeatScopeTarget = null;

        function openRepeatScope(action, target) {
            repeatScopeAction = action;
            repeatScopeTarget = target;

            const isEdit = action === 'edit';
            document.getElementById('sch-scope-title').textContent = isEdit ? '✏️ 반복 일정 수정' : '🗑 반복 일정 삭제';
            document.getElementById('sch-scope-desc').textContent  = isEdit
                ? '어떤 일정을 수정할까요?'
                : '어떤 일정을 삭제할까요?';

            const oneBtn = document.getElementById('sch-scope-one-btn');
            const allBtn = document.getElementById('sch-scope-all-btn');

            // ★ 클로저 실행 전에 로컬 변수로 복사 — closeRepeatScope()가 null로 만들기 전에 저장
            oneBtn.onclick = async () => {
                const t = repeatScopeTarget;   // 먼저 복사
                closeRepeatScope();             // 그 다음 초기화
                if (isEdit) {
                    openSchModal(t, t.date);
                } else {
                    await doDeleteOne(t.id);
                }
            };

            allBtn.onclick = async () => {
                const t = repeatScopeTarget;   // 먼저 복사
                closeRepeatScope();             // 그 다음 초기화
                if (isEdit) {
                    openSchModalForGroup(t);
                } else {
                    await doDeleteGroup(t.repeat.groupId);
                }
            };

            document.getElementById('sch-repeat-scope-modal').classList.remove('hidden');
        }

        function closeRepeatScope() {
            document.getElementById('sch-repeat-scope-modal').classList.add('hidden');
            repeatScopeAction = null;
            repeatScopeTarget = null;
        }

        // ── 삭제 헬퍼 ───────────────────────────────────────────────────
        async function doDeleteOne(id) {
            try {
                await db.collection('schedules').doc(id).delete();
                closeModal(); closeSchDetail(); closeSchAction();
                renderSch();
            } catch(e) { alert('삭제 오류: ' + e.message); }
        }

        async function doDeleteGroup(groupId) {
            try {
                const batch = db.batch();
                schData.filter(s => s.repeat?.groupId === groupId)
                       .forEach(s => batch.delete(db.collection('schedules').doc(s.id)));
                await batch.commit();
                closeModal(); closeSchDetail(); closeSchAction();
                renderSch();
            } catch(e) { alert('삭제 오류: ' + e.message); }
        }

        // ── 반복 그룹 전체 수정용 모달 ──────────────────────────────────
        // 그룹의 원본(groupId === id인 것) 기준으로 모달 열고, 저장 시 전체 업데이트
        function openSchModalForGroup(target) {
            const groupId  = target.repeat.groupId;
            const original = schData.find(s => s.id === groupId) || target;
            // 일반 수정 모달 열되, 저장 시 전체 그룹 업데이트
            openSchModal(original, original.date, true /* editAll */);
        }

        // ── 일정 입력/수정 모달 ─────────────────────────────────────────
        function openSchModal(data, date, editAll = false) {
            closeSchDetail();
            closeSchAction();
            resetModal();

            activeDateStr = date || schDetailDate;
            const isEdit = !!(data && data.id);

            document.getElementById('modal-title').innerText = isEdit
                ? (editAll ? '반복 일정 전체 수정' : '일정 수정')
                : '일정 추가';
            document.getElementById('btn-save').innerText = isEdit ? '수정 저장' : '저장';
            document.getElementById('sch-fields').classList.remove('hidden');
            // 날짜: 시작일~종료일 (연속 일정이면 묶음의 처음~끝)
            const spanOf = data && data.span ? data.span : null;
            document.getElementById('sch-date').value = spanOf ? spanOf.start : activeDateStr;
            document.getElementById('sch-date-end').value = spanOf ? spanOf.end : '';
            const rpOn = !!(data && data.repeat);
            document.getElementById('sch-date-end').disabled = rpOn;   // 반복 일정은 하루 단위
            schDateSync();

            if (isEdit) {
                document.getElementById('edit-id').value   = data.id;
                document.getElementById('sch-memo').value  = data.memo  || '';
                document.getElementById('sch-place').value = data.place || '';
                resetChips('sch-priority-group', data.priority || '일반',   'sch-priority');
                resetChips('sch-member-group',   data.member   || '정우설', 'sch-member');
                resetChips('sch-category-group', data.category || '개인',   'sch-category');
                // 시간 복원
                const tt = data.startTime ? 'timed' : (data.timeType || 'allday');
                resetChips('sch-time-type-group', tt, 'sch-time-type');
                const stEl = document.getElementById('sch-start-time');
                const etEl = document.getElementById('sch-end-time');
                if (stEl) stEl.value = data.startTime || '';
                if (etEl) etEl.value = data.endTime   || '';
                toggleSchTime();
                document.getElementById('btn-del').classList.remove('hidden');
                // 반복 그룹 전체 수정 시 안내
                if (editAll && data.repeat) {
                    const info = document.createElement('div');
                    info.style.cssText = 'font-size:11px;color:#f59e0b;margin-top:8px;padding:6px 10px;background:#fef3c7;border-radius:8px;';
                    info.textContent = '🔁 반복 일정 전체가 수정됩니다.';
                    document.getElementById('sch-fields').prepend(info);
                }
            }

            document.getElementById('btn-save').onclick = async () => {
                const memo = document.getElementById('sch-memo').value.trim();
                if (!memo) { alert('내용을 입력해주세요.'); return; }
                const id = document.getElementById('edit-id').value || 'sch_' + Date.now();
                const dStart = document.getElementById('sch-date').value || activeDateStr;
                let dEnd = document.getElementById('sch-date-end').value || '';
                if (dEnd && dEnd < dStart) { alert('종료일이 시작일보다 앞입니다.'); return; }
                if (dEnd === dStart) dEnd = '';
                const days = dEnd ? schDaysBetween(dStart, dEnd) : [dStart];
                if (days.length > 60) { alert('연속 일정은 60일까지 됩니다.'); return; }
                activeDateStr = dStart;

                const updatedFields = {
                    priority:  document.getElementById('sch-priority').value,
                    member:    document.getElementById('sch-member').value,
                    category:  document.getElementById('sch-category').value,
                    timeType:  document.getElementById('sch-time-type')?.value || 'allday',
                    startTime: document.getElementById('sch-time-type')?.value === 'timed' ? (document.getElementById('sch-start-time')?.value || '') : '',
                    endTime:   document.getElementById('sch-time-type')?.value === 'timed' ? (document.getElementById('sch-end-time')?.value   || '') : '',
                    place:     document.getElementById('sch-place').value.trim(),
                    memo,
                };

                // 반복 체크박스 (신규 등록용)
                const isRepeatChk = document.getElementById('sch-repeat-chk').checked;
                const repeatUnit  = document.querySelector('input[name="sch-repeat-unit"]:checked')?.value || 'week';
                const repeatCal   = document.querySelector('input[name="sch-repeat-cal"]:checked')?.value || 'solar';
                const repeatEnd   = document.getElementById('sch-repeat-end').value;

                try {
                    const batch = db.batch();

                    if (editAll && isEdit) {
                        // 반복 그룹 전체 수정: 같은 groupId 모두 업데이트
                        const groupId = schData.find(s => s.id === id)?.repeat?.groupId || id;
                        schData.filter(s => s.repeat?.groupId === groupId).forEach(s => {
                            batch.update(db.collection('schedules').doc(s.id), updatedFields);
                        });
                    } else if (isEdit && !(schData.find(s => s.id === id) || {}).repeat) {
                        // 일반·연속 일정 수정: 묶음 전체를 지우고 새 날짜 범위로 다시 만듦
                        const orig = schData.find(s => s.id === id) || {};
                        const olds = orig.span ? schData.filter(s => s.span && s.span.groupId === orig.span.groupId) : [orig];
                        olds.forEach(s => s.id && batch.delete(db.collection('schedules').doc(s.id)));
                        const { span: _s, id: _i, date: _d, ...keep } = orig;
                        const gid = orig.span ? orig.span.groupId : id;
                        days.forEach((ds, i) => {
                            const did = days.length === 1 ? (orig.span ? gid : id) : (i === 0 ? gid : `${gid}_d${i}`);
                            batch.set(db.collection('schedules').doc(did), { ...keep, ...updatedFields, id: did, date: ds,
                                span: days.length > 1 ? { groupId: gid, start: dStart, end: dEnd, idx: i, n: days.length } : null });
                        });
                    } else if (isEdit) {
                        // 반복 일정 중 이 날만 수정
                        const orig = schData.find(s => s.id === id);
                        batch.set(db.collection('schedules').doc(id), {
                            ...orig, ...updatedFields,
                        });
                    } else if (days.length > 1) {
                        // 연속 일정 신규: 하루마다 한 건, 같은 묶음 번호로 연결
                        days.forEach((ds, i) => {
                            const did = i === 0 ? id : `${id}_d${i}`;
                            batch.set(db.collection('schedules').doc(did), { id: did, date: ds, ...updatedFields, repeat: null,
                                span: { groupId: id, start: dStart, end: dEnd, idx: i, n: days.length } });
                        });
                    } else {
                        // 신규 등록
                        const newDoc = { id, date: activeDateStr, ...updatedFields,
                            repeat: isRepeatChk ? { unit: repeatUnit, cal: repeatUnit === 'year' ? repeatCal : 'solar', groupId: id } : null };
                        batch.set(db.collection('schedules').doc(id), newDoc);

                        if (isRepeatChk) {
                            getRepeatDates(activeDateStr, repeatUnit, repeatUnit === 'year' ? repeatCal : 'solar', repeatEnd).forEach((ds, i) => {
                                const rid = `${id}_r${i}`;
                                batch.set(db.collection('schedules').doc(rid), {
                                    ...newDoc, id: rid, date: ds,
                                });
                            });
                        }
                    }

                    await batch.commit();
                    closeModal(); closeSchDetail(); closeSchAction();
                    renderSch();
                } catch(e) { alert('저장 중 오류: ' + e.message); }
            };

            document.getElementById('btn-del').onclick = async () => {
                const delId  = document.getElementById('edit-id').value;
                const target = schData.find(s => s.id === delId);
                if (target?.repeat?.groupId) {
                    closeModal();
                    openRepeatScope('delete', target);
                } else if (target && target.span) {
                    if (!confirm(`연속 일정 ${target.span.n}일(${target.span.start} ~ ${target.span.end})을 모두 삭제할까요?`)) return;
                    const b = db.batch(); schData.filter(s => s.span && s.span.groupId === target.span.groupId).forEach(s => b.delete(db.collection('schedules').doc(s.id)));
                    await b.commit(); closeModal(); closeSchDetail(); renderSch();
                } else {
                    if (!confirm('이 일정을 삭제할까요?')) return;
                    await doDeleteOne(delId);
                }
            };

            openModal();
        }

        // 시작일~종료일 사이 날짜 목록
        function schDaysBetween(a, b) {
            const out = []; let d = new Date(a + 'T00:00:00'); const e = new Date(b + 'T00:00:00');
            while (d <= e && out.length < 400) { out.push(famDs(d)); d.setDate(d.getDate() + 1); }
            return out;
        }
        // 날짜 입력이 바뀌면 제목·안내 갱신 (반복 일정과 연속 일정은 같이 못 씀)
        function schDateSync() {
            const s = document.getElementById('sch-date'), e = document.getElementById('sch-date-end'), info = document.getElementById('sch-span-info');
            if (!s) return;
            if (e.value && s.value && e.value < s.value) e.value = s.value;
            const n = e.value && s.value && e.value > s.value ? schDaysBetween(s.value, e.value).length : 1;
            info.textContent = n > 1 ? `${n}일 연속 일정으로 등록됩니다.` : '';
            const rp = document.getElementById('sch-repeat-chk');
            if (rp) { rp.disabled = n > 1; if (n > 1 && rp.checked) { rp.checked = false; toggleRepeatBox(); } }
            if (s.value) activeDateStr = s.value;
        }

        function togglePlanTimeSection() {
            const t = document.getElementById('plan-sub-type').value;
            const sec = document.getElementById('plan-time-section');
            if (sec) sec.style.display = (t==='골프'||t==='스크린골프') ? '' : 'none';
        }

        // ── 반복 일정 ────────────────────────────────────────────────────
        function toggleRepeatBox() {
            const chk = document.getElementById('sch-repeat-chk');
            const box = document.getElementById('sch-repeat-box');
            box.style.display = chk.checked ? 'block' : 'none';
            famRepeatUI();
        }
        // 매년 반복일 때만 양력/음력 선택, 음력이면 음력 월·일 선택
        function famRepeatUI() {
            const unit = document.querySelector('input[name="sch-repeat-unit"]:checked')?.value, cal = document.querySelector('input[name="sch-repeat-cal"]:checked')?.value;
            const row = document.getElementById('sch-cal-row'), pick = document.getElementById('sch-lunar-pick'); if (!row) return;
            row.style.display = unit === 'year' ? 'flex' : 'none';
            if (unit !== 'year') { const sol = document.querySelector('input[name="sch-repeat-cal"][value="solar"]'); if (sol) sol.checked = true; }
            const lunarOn = unit === 'year' && cal === 'lunar'; pick.style.display = lunarOn ? 'flex' : 'none';
            const note = document.querySelector('#sch-repeat-box div[style*="font-size:10px"]'); if (note) note.textContent = unit === 'year' ? '※ 종료일 미설정 시 30년간 반복됩니다.' : '※ 종료일 미설정 시 2년간 반복됩니다.';
            if (lunarOn && activeDateStr) {
                const l = getLunarDate(+activeDateStr.slice(0, 4), +activeDateStr.slice(5, 7) - 1, +activeDateStr.slice(8, 10));
                const ms = document.getElementById('sch-lunar-m'), dd = document.getElementById('sch-lunar-d');
                ms.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('');
                dd.innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('');
                ms.value = String(parseInt(String(l.month).replace('윤', '')) || 1); dd.value = String(l.day || 1);
                famLunarInfo();
            }
        }
        function famLunarInfo() { const el = document.getElementById('sch-lunar-info'); if (el) el.textContent = `올해 양력 ${activeDateStr} · 매년 음력 날짜로 반복`; }
        function famLunarPick() {
            const lm = +document.getElementById('sch-lunar-m').value, ld = +document.getElementById('sch-lunar-d').value, now = new Date();
            const base = +activeDateStr.slice(0, 4) || now.getFullYear();
            const sol = famLunarToSolar(base, lm, ld) || famLunarToSolar(now.getFullYear(), lm, ld);
            if (sol) { activeDateStr = famDs(sol); const sd = document.getElementById('sch-date'); if (sd) sd.value = activeDateStr; const t = document.getElementById('modal-title'); if (t) t.innerText = t.innerText.replace(/\d{4}-\d{2}-\d{2}/, activeDateStr); }
            famLunarInfo();
        }
        document.addEventListener('change', e => { if (e.target && (e.target.name === 'sch-repeat-unit' || e.target.name === 'sch-repeat-cal')) famRepeatUI(); });

        function getRepeatDates(startDs, unit, calType, endDs) {
            const dates = [];
            // 로컬(한국) 자정 기준으로 해석 — UTC 변환(toISOString)으로 날짜가 밀리지 않게
            const start = new Date(startDs + 'T00:00:00');
            // 종료일 미설정 시 2년 (매년은 30년)
            const end = endDs ? new Date(endDs + 'T00:00:00') : new Date(start.getFullYear() + (unit === 'year' ? 30 : 2), start.getMonth(), start.getDate());
            if (unit === 'year' && calType === 'lunar') {
                const sy = +startDs.slice(0, 4), l = famLunar(sy, +startDs.slice(5, 7) - 1, +startDs.slice(8, 10)); if (!l) return dates;
                for (let k = 1; k <= 60; k++) { const d = famLunarToSolar(l.year + k, l.month, l.day); if (!d) break; const ds = famDs(d); if (ds > famDs(end) && !endDs) break; if (endDs && ds > endDs) break; dates.push(ds); }
                return dates;
            }

            // 양력 반복: 첫날 제외, 다음 회차부터
            const sy = start.getFullYear(), sm = start.getMonth(), sd = start.getDate();
            // 해당 월에 그 날짜가 없으면 말일로 (1/31 → 2/28, 2/29 → 2/28)
            const clampDay = (y, m) => new Date(y, m, Math.min(sd, new Date(y, m + 1, 0).getDate()));
            if (unit === 'week') {
                const cur = new Date(start); cur.setDate(cur.getDate() + 7);
                while (cur <= end) { dates.push(famDs(cur)); cur.setDate(cur.getDate() + 7); }
            } else if (unit === 'month') {
                for (let k = 1; ; k++) { const d = clampDay(sy, sm + k); if (d > end) break; dates.push(famDs(d)); }
            } else if (unit === 'year') {
                for (let k = 1; ; k++) { const d = clampDay(sy + k, sm); if (d > end) break; dates.push(famDs(d)); }
            }
            return dates;
        }

        // 칩 선택 헬퍼
        function selectChip(btn, groupId) {
            document.querySelectorAll(`#${groupId} .sch-chip`).forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const map = {
                'sch-priority-group':   'sch-priority',
                'sch-member-group':     'sch-member',
                'sch-category-group':   'sch-category',
                'plan-member-group':    'plan-member',
                'plan-area-group':      'plan-main-type',
                'plan-type-group':      'plan-sub-type',
                'as-member-group':      'as-member',
                'as-type-group':        'as-type',
                'as-income-cat-group':  'as-income-cat',
                'as-expense-cat-group': 'as-expense-cat',
                'as-pay-group':         'as-pay',
                'sch-time-type-group':  'sch-time-type',
            };
            const inputId = map[groupId];
            if (inputId) {
                const el = document.getElementById(inputId);
                if (el) el.value = btn.dataset.val;
            }
        }

        function toggleSchTime() {
            const val = document.getElementById('sch-time-type')?.value;
            const box = document.getElementById('sch-time-inputs');
            if (box) box.style.display = val === 'timed' ? 'flex' : 'none';
        }

        function resetChips(groupId, val, inputId) {
            document.querySelectorAll(`#${groupId} .sch-chip`).forEach(c => {
                c.classList.toggle('active', c.dataset.val === val);
            });
            const el = document.getElementById(inputId);
            if (el) el.value = val;
        }

