        // ── 가계부 개선 ────────────────────────────────────────────────────
        let assetPeriod = 'month';
        let assetSelectedKey = '';   // 클릭한 월(YYYY-MM) 또는 주(wsStr~weStr) 저장
        let assetSelectedLabel = ''; // 표시용 레이블
        let assetMemberFilter = 'all';
        let assetDayDate = '';
        let assetCalViewDate = new Date();

        function switchAssetPeriod(btn) {
            document.querySelectorAll('.asset-period-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            assetPeriod = btn.dataset.period;
            initAssetCharts();
        }

        function switchAssetMember(btn) {
            document.querySelectorAll('.asset-member-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            assetMemberFilter = btn.dataset.m;
            renderAssetCal();
            updateAssetCalSummary();
        }

        function assetCalNavigate(n) {
            assetCalViewDate.setMonth(assetCalViewDate.getMonth() + n);
            renderAssetCal();
            updateAssetCalSummary();
        }

        function assetCalToday() {
            assetCalViewDate = new Date();
            renderAssetCal();
            updateAssetCalSummary();
        }

        function toggleAssetCat() {
            const type = document.getElementById('as-type').value;
            const isIncome = type === '수입';
            document.getElementById('as-income-section').style.display  = isIncome ? '' : 'none';
            document.getElementById('as-expense-section').style.display = isIncome ? 'none' : '';
            // 첫 번째 칩 자동 선택
            if (isIncome) {
                const first = document.querySelector('#as-income-cat-group .sch-chip');
                if (first) selectChip(first, 'as-income-cat-group');
            } else {
                const first = document.querySelector('#as-expense-cat-group .sch-chip');
                if (first) selectChip(first, 'as-expense-cat-group');
                resetChips('as-pay-group', '카드', 'as-pay');
            }
        }

        function getAssetData() {
            const all = {};
            ['남편','아내','정우설','한미연','공통'].forEach(m => {
                if (assetData[m]) all[m] = assetData[m];
            });
            let arr = Object.values(all).flat();
            if (assetMemberFilter !== 'all') arr = arr.filter(a => a.member === assetMemberFilter);
            return arr;
        }

        function updateAssetCalSummary() {
            const y = assetCalViewDate.getFullYear(), m = assetCalViewDate.getMonth();
            const ym = `${y}-${String(m+1).padStart(2,'0')}`;
            document.getElementById('asset-cal-title').textContent = `${y}년 ${m+1}월`;
            const arr = getAssetData().filter(a => a.date?.startsWith(ym));
            const inc = arr.filter(a=>a.type==='수입').reduce((s,a)=>s+Number(a.amt),0);
            const exp = arr.filter(a=>a.type==='지출').reduce((s,a)=>s+Number(a.amt),0);
            document.getElementById('acal-income').textContent  = inc.toLocaleString()+'원';
            document.getElementById('acal-expense').textContent = exp.toLocaleString()+'원';
            document.getElementById('acal-balance').textContent = (inc-exp).toLocaleString()+'원';
        }

        function showAssetDetail(kind, keep) {
            const box   = document.getElementById('asset-detail-box');
            const title = document.getElementById('asset-detail-title');
            const list  = document.getElementById('asset-detail-list');
            const mark = on => document.querySelectorAll('#asset-section .sum-box').forEach(b => b.classList.toggle('on', on && b.classList.contains(kind === 'income' ? 'inc' : 'exp')));
            if (!keep && box.style.display !== 'none' && box.dataset.kind === kind) { box.style.display = 'none'; mark(false); return; }
            mark(true);
            box.style.display = 'block';
            box.dataset.kind  = kind; // 차트 클릭 시 재호출용

            const typeLabel = kind === 'income' ? '수입' : '지출';
            const color     = kind === 'income' ? '#166634' : '#991b1b';
            const isIncome  = kind === 'income';

            const iconMap = {
                '급여':'💼','상여':'🎁','주식':'📈','기타수입':'💰',
                '생활비':'🏠','의료비':'🏥','쇼핑':'🛍','식사':'🍽',
                '교통비':'🚗','여가':'🎭','여행비':'✈️','가족':'👨‍👩‍👧',
                '기타지출':'📌','기타':'📌',
            };
            const incomeOrder  = ['급여','상여','주식','기타수입','기타'];
            const expenseOrder = ['생활비','의료비','쇼핑','식사','교통비','여가','여행비','가족','기타지출','기타'];

            // ── 선택된 기간 기준으로 데이터 필터
            const allArr = Object.values(assetData).flat();
            let arr;
            if (assetPeriod === 'month') {
                arr = allArr.filter(a => a.type === typeLabel && a.date?.startsWith(assetSelectedKey));
            } else {
                const [wsStr, weStr] = assetSelectedKey.split('~');
                arr = allArr.filter(a => a.type === typeLabel && a.date >= wsStr && a.date <= weStr);
            }

            title.innerHTML = `<span style="color:${color};">${isIncome?'📥':'📤'} ${assetSelectedLabel} ${typeLabel} 내역</span>`;

            const catMap = {};
            arr.forEach(a => { const k = a.category||'기타'; catMap[k]=(catMap[k]||0)+Number(a.amt); });
            const total = arr.reduce((s,a) => s+Number(a.amt), 0);

            if (!Object.keys(catMap).length) {
                list.innerHTML = `<div style="text-align:center;color:#cbd5e1;padding:20px;font-size:13px;">${assetSelectedLabel} ${typeLabel} 내역이 없습니다.</div>`;
                return;
            }

            const order = isIncome ? incomeOrder : expenseOrder;
            const sorted = Object.entries(catMap).sort((a,b) => {
                const ai = order.indexOf(a[0]), bi = order.indexOf(b[0]);
                if (ai===-1&&bi===-1) return b[1]-a[1];
                if (ai===-1) return 1; if (bi===-1) return -1;
                return ai-bi;
            });

            const fmt2 = n => n>=10000?(n/10000).toFixed(0)+'만':n.toLocaleString();
            list.innerHTML = sorted.map(([k,v]) => {
                const pct = total>0?Math.round(v/total*100):0;
                const icon = iconMap[k]||'💡';
                return `<div style="padding:9px 0;border-bottom:1px solid #f8fafc;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                        <div style="display:flex;align-items:center;gap:7px;">
                            <span style="font-size:15px;">${icon}</span>
                            <span style="font-size:13px;font-weight:700;color:#1e293b;">${k}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:13px;font-weight:800;color:${color};">${v.toLocaleString()}원</span>
                            <span style="font-size:10px;color:#94a3b8;margin-left:4px;">${pct}%</span>
                        </div>
                    </div>
                    <div style="height:5px;background:#f1f5f9;border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;opacity:.75;"></div>
                    </div>
                </div>`;
            }).join('') +
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 4px;font-size:14px;font-weight:800;border-top:1.5px solid #e2e8f0;margin-top:4px;">
                <span style="color:#1e293b;">합계</span>
                <span style="color:${color};">${total.toLocaleString()}원</span>
            </div>`;
        }

        // 가계부 일별 캘린더 렌더 (기존 renderAssetCal 교체)

        function openAssetDayModal(ds) {
            assetDayDate = ds;
            const arr = getAssetData().filter(a => a.date === ds);
            // 날짜 타이틀 + 일합계
            const inc = arr.filter(a=>a.type==='수입').reduce((s,a)=>s+Number(a.amt),0);
            const exp = arr.filter(a=>a.type==='지출').reduce((s,a)=>s+Number(a.amt),0);
            document.getElementById('asset-day-title').innerHTML =
                `💰 ${ds}&nbsp;<span style="font-size:12px;color:#166534;font-weight:700;">+${inc.toLocaleString()}</span>&nbsp;<span style="font-size:12px;color:#991b1b;font-weight:700;">-${exp.toLocaleString()}</span>`;
            const list = document.getElementById('asset-day-list');
            list.innerHTML = '';
            if (!arr.length) {
                list.innerHTML = '<div style="text-align:center;color:#cbd5e1;padding:16px;font-size:13px;">항목이 없습니다.</div>';
            } else {
                arr.forEach(item => {
                    const el = document.createElement('div');
                    el.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:9px 10px;border-radius:10px;margin-bottom:6px;background:#f8fafc;';
                    const memberBg = item.member==='정우설'?'#dbeafe':item.member==='한미연'?'#fce7f3':'#f0fdf4';
                    const left = document.createElement('div'); left.style.flex='1';
                    left.innerHTML = `
                        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;flex-wrap:wrap;">
                            <span style="font-size:10px;background:${memberBg};padding:1px 7px;border-radius:20px;font-weight:700;">${item.member||'가족'}</span>
                            <span style="font-size:10px;color:#94a3b8;">${item.category||''} · ${item.pay||''}${item.cur && item.cur!=='KRW' ? ' · '+escHtml(item.cur)+' '+Number(item.fAmt||0).toLocaleString('ko-KR') : ''}${item.tripId ? ' · ✈️' : ''}</span>
                        </div>
                        <div style="font-size:13px;font-weight:600;color:#1e293b;">${escHtml(item.memo||'내용 없음')}</div>`;
                    const right = document.createElement('div');
                    right.style.cssText = 'text-align:right;flex-shrink:0;margin-left:10px;';
                    right.innerHTML = `<div style="font-size:14px;font-weight:800;color:${item.type==='수입'?'#166534':'#991b1b'};">${item.type==='수입'?'+':'-'}${Number(item.amt).toLocaleString()}원</div>`;
                    const btn = document.createElement('button');
                    btn.className = 'sch-item-action-btn'; btn.textContent = '•••';
                    btn.onclick = (e) => { e.stopPropagation(); closeAssetDayModal(); openAssetEntryModal(item, ds); };
                    el.appendChild(left); el.appendChild(right); el.appendChild(btn);
                    list.appendChild(el);
                });
            }
            document.getElementById('asset-day-modal').classList.remove('hidden');
            history.pushState({ modal: 'asset-day' }, '', '');
        }

        function closeAssetDayModal() {
            document.getElementById('asset-day-modal').classList.add('hidden');
        }

        // initAssetCharts - 월별 6개월 / 주차별 W# 6주 + 클릭 연동
        let _periodMeta = []; // 차트 인덱스별 기간 정보

        // 손익: 막대 대신 월 이름 아래에 작은 글씨 (적자는 빨강)
        const famNetLabels = (inc, exp) => ({ id: 'famNetLabels', afterDraw(ch) {
            const ctx = ch.ctx, x = ch.scales.x, y0 = x.bottom + 3;
            inc.forEach((v, i) => {
                const n = v - (exp[i] || 0); if (!v && !exp[i]) return;
                const t = (n > 0 ? '+' : n < 0 ? '-' : '') + (Math.abs(n) >= 1e4 ? Math.round(Math.abs(n) / 1e4).toLocaleString('ko-KR') + '만' : Math.abs(n).toLocaleString('ko-KR'));
                ctx.save(); ctx.font = '600 10px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillStyle = n < 0 ? '#d9465c' : '#64748b'; ctx.fillText(t, x.getPixelForTick(i), y0); ctx.restore();
            });
        } });
        function initAssetCharts() {
            if (aChart) aChart.destroy();
            const ctx = document.getElementById('mainAssetChart')?.getContext('2d');
            if (!ctx) return;
            const today = new Date();
            const allArr = getAssetData();
            _periodMeta = [];

            const chartOpts = {
                responsive: true, maintainAspectRatio: false, layout: { padding: { bottom: 14 } },
                onClick: (evt, elements) => {
                    if (!elements.length) return;
                    const p = _periodMeta[elements[0].index];
                    if (!p) return;
                    assetSelectedKey   = p.key;
                    assetSelectedLabel = p.label;
                    updateAssetSummaryCards();
                    // 상세 박스 열려있으면 갱신
                    const box = document.getElementById('asset-detail-box');
                    if (box && box.style.display !== 'none') {
                        showAssetDetail(box.dataset.kind || 'expense', true);
                    }
                },
                plugins: { legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } } },
                scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748b' } },
                          y: { grid: { color: 'rgba(148,163,184,.18)' }, border: { display: false }, ticks: { font: { size: 10 }, color: '#94a3b8', callback: v => Math.abs(v) >= 1e4 ? (v / 1e4).toLocaleString('ko-KR') + '만' : v } } }
            };

            if (assetPeriod === 'month') {
                const labels=[]; const incData=[]; const expData=[];
                for (let i=5; i>=0; i--) {
                    const d = new Date(today.getFullYear(), today.getMonth()-i, 1);
                    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    const label = `${d.getMonth()+1}월`;
                    labels.push(label);
                    _periodMeta.push({ key, label });
                    const ma = allArr.filter(a=>a.date?.startsWith(key));
                    incData.push(ma.filter(a=>a.type==='수입').reduce((s,a)=>s+Number(a.amt),0));
                    expData.push(ma.filter(a=>a.type==='지출').reduce((s,a)=>s+Number(a.amt),0));
                }
                // 기본: 이번달
                assetSelectedKey   = _periodMeta[5].key;
                assetSelectedLabel = _periodMeta[5].label;
                aChart = new Chart(ctx, { data:{ labels, datasets:[
                    {type:'bar',label:'수입',data:incData,backgroundColor:famChartColor('inc'),borderRadius:6,maxBarThickness:22},
                    {type:'bar',label:'지출',data:expData,backgroundColor:famChartColor('exp'),borderRadius:6,maxBarThickness:22}
                ]}, options: chartOpts, plugins: [famNetLabels(incData, expData)] });

            } else {
                const labels=[]; const incData=[]; const expData=[];
                for (let i=5; i>=0; i--) {
                    const dayOfWeek = today.getDay() || 7;
                    const mon = new Date(today);
                    mon.setDate(today.getDate() - dayOfWeek + 1 - i*7);
                    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                    const wsStr = famDs(mon);
                    const weStr = famDs(sun);
                    const wn = getWeekNumber(mon);
                    const label = `W${wn}`;
                    labels.push(label);
                    _periodMeta.push({ key: wsStr+'~'+weStr, label, wsStr, weStr });
                    const wa = allArr.filter(a=>a.date>=wsStr && a.date<=weStr);
                    incData.push(wa.filter(a=>a.type==='수입').reduce((s,a)=>s+Number(a.amt),0));
                    expData.push(wa.filter(a=>a.type==='지출').reduce((s,a)=>s+Number(a.amt),0));
                }
                // 기본: 이번주
                assetSelectedKey   = _periodMeta[5].key;
                assetSelectedLabel = _periodMeta[5].label;
                aChart = new Chart(ctx, { data:{ labels, datasets:[
                    {type:'bar',label:'수입',data:incData,backgroundColor:famChartColor('inc'),borderRadius:6,maxBarThickness:22},
                    {type:'bar',label:'지출',data:expData,backgroundColor:famChartColor('exp'),borderRadius:6,maxBarThickness:22}
                ]}, options: chartOpts, plugins: [famNetLabels(incData, expData)] });
            }

            updateAssetSummaryCards();
        }

        // 선택 기간 기준 요약카드 업데이트
        function updateAssetSummaryCards() {
            const allArr = Object.values(assetData).flat();
            let arr;
            if (assetPeriod === 'month') {
                arr = allArr.filter(a => a.date?.startsWith(assetSelectedKey));
            } else {
                const [wsStr, weStr] = assetSelectedKey.split('~');
                arr = allArr.filter(a => a.date >= wsStr && a.date <= weStr);
            }
            const inc = arr.filter(a=>a.type==='수입').reduce((s,a)=>s+Number(a.amt),0);
            const exp = arr.filter(a=>a.type==='지출').reduce((s,a)=>s+Number(a.amt),0);
            const bal = inc - exp;
            const incEl = document.getElementById('asset-total-income');
            const expEl = document.getElementById('asset-total-expense');
            const balEl = document.getElementById('asset-balance');
            if (incEl) incEl.textContent = inc.toLocaleString()+'원';
            if (expEl) expEl.textContent = exp.toLocaleString()+'원';
            if (balEl) { balEl.textContent = bal.toLocaleString()+'원'; balEl.style.color = bal>=0?'#1e40af':'#991b1b'; }
        }

