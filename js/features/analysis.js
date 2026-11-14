    // ═══════════════════════════════════════════════════════════
    // 📊 가계부 집계 · AI 트렌드 분석
    // ═══════════════════════════════════════════════════════════
    const ANA_MEMBERS = [['공통', ''], ['정우설', ''], ['한미연', '']];
    const ana = { period: '3m', from: '', to: '', members: { '공통': true, '정우설': true, '한미연': true }, types: { '수입': true, '지출': true }, catOff: {}, excl: {}, ai: '' };
    let anaChart = null;
    function anaYM(s) { const m = String(s || '').match(/(\d{4})\D?(\d{1,2})/); return m ? m[1] + '-' + String(m[2]).padStart(2, '0') : ''; }
    function anaAll() {
        const out = [], seen = new Set();
        Object.keys(assetData || {}).forEach(k => (assetData[k] || []).forEach(e => { const id = e.id || (e.date + e.amt + e.memo); if (seen.has(id)) return; seen.add(id); const mem = ['공통', '정우설', '한미연'].includes(e.member) ? e.member : (e.member === '남편' ? '정우설' : e.member === '아내' ? '한미연' : '공통'); out.push({ ...e, _id: id, _m: mem, _ym: anaYM(e.date), amt: Number(e.amt) || 0, category: e.category || '기타' }); }));
        return out;
    }
    function anaMonthsBack(n) { const d = new Date(Date.now() + 9 * 3600e3), a = []; for (let i = n - 1; i >= 0; i--) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); a.push(x.toISOString().slice(0, 7)); } return a; }
    function anaRange() {
        if (ana.period === 'all') return null;
        if (ana.period === 'custom') { const f = ana.from || '0000-00', t = ana.to || '9999-99'; return [f, t]; }
        const n = { m: 1, '3m': 3, '6m': 6, '12m': 12 }[ana.period] || 3, ms = anaMonthsBack(n); return [ms[0], ms[ms.length - 1]];
    }
    function anaBase() { const r = anaRange(); return anaAll().filter(e => e._ym && (!r || (e._ym >= r[0] && e._ym <= r[1])) && ana.members[e._m] && ana.types[e.type]); }
    function anaFiltered() { return anaBase().filter(e => !ana.catOff[e.type + '|' + e.category] && !ana.excl[e._id]); }
    const anaW = n => (Math.round(n) || 0).toLocaleString('ko-KR') + '원';
    function anaRender() {
        const root = document.getElementById('ana-root'); if (!root) return;
        const base = anaBase(), rows = anaFiltered();
        const cats = {}; base.forEach(e => { const k = e.type + '|' + e.category; cats[k] = (cats[k] || 0) + e.amt; });
        const inc = rows.filter(e => e.type === '수입').reduce((a, e) => a + e.amt, 0), exp = rows.filter(e => e.type === '지출').reduce((a, e) => a + e.amt, 0);
        const months = [...new Set(rows.map(e => e._ym))].sort();
        const byCat = {}; rows.forEach(e => { const k = e.type + '|' + e.category; byCat[k] = (byCat[k] || 0) + e.amt; });
        const byMem = {}; rows.forEach(e => { const m = byMem[e._m] || (byMem[e._m] = { 수입: 0, 지출: 0 }); m[e.type] += e.amt; });
        const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]), maxCat = catList.length ? catList[0][1] : 1;
        const P = [['m', '이번 달'], ['3m', '3개월'], ['6m', '6개월'], ['12m', '12개월'], ['all', '전체'], ['custom', '기간 지정']];
        const chk = (grp, val, on, label) => `<label class="fam-chk ${on ? '' : 'off'}"><input type="checkbox" data-ana="${grp}" value="${famEsc(val)}" ${on ? 'checked' : ''}> ${label}</label>`;
        const catChecks = t => Object.keys(cats).filter(k => k.startsWith(t + '|')).sort((a, b) => cats[b] - cats[a]).map(k => chk('cat', k, !ana.catOff[k], famEsc(k.split('|')[1]))).join('') || '<span class="fam-note" style="margin:0">해당 내역 없음</span>';
        root.innerHTML = `
            <div class="fam-box"><h4>조건</h4>
                <div class="fam-grid2">
                    <select class="fam-sel" onchange="ana.period=this.value;anaRender()">${P.map(([k, n]) => `<option value="${k}" ${ana.period === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
                    <select class="fam-sel" onchange="anaSetMember(this.value)">${[['all','구성원 전체'],['정우설','정우설'],['한미연','한미연'],['공통','공통']].map(([k,n]) => `<option value="${k}" ${anaMemberSel() === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
                    <select class="fam-sel" onchange="anaSetType(this.value)">${[['all','수입·지출'],['수입','수입만'],['지출','지출만']].map(([k,n]) => `<option value="${k}" ${anaTypeSel() === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
                    <button class="fam-btn" onclick="anaOpenCats()">항목 ${Object.keys(cats).filter(k => !ana.catOff[k]).length}/${Object.keys(cats).length} ▾</button>
                </div>
                ${ana.period === 'custom' ? `<div style="display:flex;gap:8px;margin-top:10px;align-items:center"><input type="month" class="fam-in" value="${ana.from}" onchange="ana.from=this.value;anaRender()"><span>~</span><input type="month" class="fam-in" value="${ana.to}" onchange="ana.to=this.value;anaRender()"></div>` : ''}
            </div>
            <div class="fam-sum">
                <div class="sum-box inc" style="cursor:default"><small>수입</small><b style="color:var(--month-header)">${anaW(inc)}</b></div>
                <div class="sum-box exp" style="cursor:default"><small>지출</small><b style="color:#d9465c">${anaW(exp)}</b></div>
                <div class="sum-box bal"><small>손익</small><b style="color:${inc - exp < 0 ? '#b91c1c' : '#1e40af'}">${anaW(inc - exp)}</b></div>
            </div>
            <div class="fam-note" style="margin:-4px 0 10px">${rows.length}건 · ${months.length}개월${months.length && exp ? ' · 월평균 지출 ' + anaW(exp / months.length) : ''}</div>
            <div class="fam-box"><h4>월별 추이</h4><div style="height:210px"><canvas id="anaChart"></canvas></div></div>
            <div class="fam-box"><h4>구성원별</h4>${Object.keys(byMem).length ? ANA_MEMBERS.filter(([m]) => byMem[m]).map(([m, ic]) => `<div class="fam-row"><span style="flex:none;width:76px">${ic} ${m}</span><span style="flex:1;color:#166534">+${anaW(byMem[m]['수입'])}</span><span style="flex:1;color:#991b1b;text-align:right">-${anaW(byMem[m]['지출'])}</span></div>`).join('') : '<div class="fam-note">선택된 내역이 없습니다</div>'}</div>
            <div class="fam-box"><h4>항목별</h4>${catList.length ? catList.map(([k, v]) => { const [t, c] = k.split('|'); return `<div class="fam-row"><span style="flex:none;width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t === '수입' ? '📥' : '📤'} ${famEsc(c)}</span><div class="fam-bar"><i style="width:${Math.max(2, v / maxCat * 100)}%;background:${t === '수입' ? '#22c55e' : 'var(--month-header)'}"></i></div><span style="flex:none;width:96px;text-align:right">${anaW(v)}</span></div>`; }).join('') : '<div class="fam-note">선택된 내역이 없습니다</div>'}</div>
            <div class="fam-box"><h4>🤖 AI 트렌드 분석</h4>
                <div class="fam-note" style="margin:0 0 10px">지금 선택한 조건의 월별·항목별 집계만 AI에 보내 분석합니다. 메모 내용은 보내지 않습니다.</div>
                <button class="fam-btn pri" id="ana-ai-btn" onclick="anaAI()" ${rows.length ? '' : 'disabled'}>분석하기</button>
                <div id="ana-ai-out" class="fam-ai" style="margin-top:12px">${ana.ai ? famMd(ana.ai) : ''}</div>
            </div>
            <details class="fam-box"><summary style="font-size:13px;font-weight:800;color:#1e293b;cursor:pointer;">내역 ${base.filter(e => !ana.catOff[e.type + '|' + e.category]).length}건 — 체크 해제하면 집계에서 빠집니다</summary>
                <div style="margin-top:8px">${base.filter(e => !ana.catOff[e.type + '|' + e.category]).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 400).map(e => `<label class="fam-row" style="cursor:pointer"><input type="checkbox" data-ana="ex" value="${famEsc(e._id)}" ${ana.excl[e._id] ? '' : 'checked'} style="width:16px;height:16px;accent-color:var(--month-header)"><span style="flex:none;width:44px;color:#94a3b8;font-size:11px">${famEsc(String(e.date).slice(5))}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${famEsc(e.category)}${e.memo ? ' · ' + famEsc(e.memo) : ''} <span style="color:#94a3b8;font-size:11px">${famEsc(e._m)}</span></span><b style="flex:none;color:${e.type === '수입' ? '#166534' : '#991b1b'}">${e.type === '수입' ? '+' : '-'}${anaW(e.amt)}</b></label>`).join('')}</div>
            </details>`;
        anaDrawChart(rows, months);
    }
    function anaMemberSel() { const on = Object.keys(ana.members).filter(k => ana.members[k]); return on.length === 3 ? 'all' : on[0] || 'all'; }
    function anaSetMember(v) { ['공통', '정우설', '한미연'].forEach(k => ana.members[k] = (v === 'all' || v === k)); anaRender(); }
    function anaTypeSel() { return ana.types['수입'] && ana.types['지출'] ? 'all' : ana.types['수입'] ? '수입' : '지출'; }
    function anaSetType(v) { ana.types['수입'] = v !== '지출'; ana.types['지출'] = v !== '수입'; anaRender(); }
    function anaOpenCats() {
        const base = anaBase(), cats = {}; base.forEach(e => { const k = e.type + '|' + e.category; cats[k] = (cats[k] || 0) + e.amt; });
        const grp = t => Object.keys(cats).filter(k => k.startsWith(t + '|')).sort((a, b) => cats[b] - cats[a]);
        const row = k => `<label class="fam-row" style="cursor:pointer"><input type="checkbox" data-ana="cat" value="${famEsc(k)}" ${ana.catOff[k] ? '' : 'checked'} style="width:18px;height:18px;accent-color:var(--month-header)"><span style="flex:1">${famEsc(k.split('|')[1])}</span><span style="color:#94a3b8;font-size:12px">${anaW(cats[k])}</span></label>`;
        famSheet(`<div class="fam-h"><b>항목 선택</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            ${['수입', '지출'].filter(t => ana.types[t]).map(t => `<div class="fam-box"><h4>${t}</h4>${grp(t).map(row).join('') || '<div class="fam-note">해당 내역 없음</div>'}</div>`).join('')}
            <div class="fam-btns"><button class="fam-btn" onclick="ana.catOff={};anaRender();anaOpenCats()">전체 선택</button><button class="fam-btn" onclick="anaAllOff();anaOpenCats()">전체 해제</button><button class="fam-btn pri" style="margin-left:auto" onclick="famSheetClose()">완료</button></div>`);
    }
    function anaAllOff() { anaBase().forEach(e => { ana.catOff[e.type + '|' + e.category] = true; }); anaRender(); }
    function anaDrawChart(rows, months) {
        const cv = document.getElementById('anaChart'); if (!cv || typeof Chart === 'undefined') return;
        if (anaChart) { try { anaChart.destroy(); } catch (e) {} anaChart = null; }
        const r = anaRange(); let labels = months;
        if (r && ana.period !== 'custom') labels = anaMonthsBack({ m: 1, '3m': 3, '6m': 6, '12m': 12 }[ana.period]);
        const sum = (ym, t) => rows.filter(e => e._ym === ym && e.type === t).reduce((a, e) => a + e.amt, 0);
        const ds = [];
        if (ana.types['수입']) ds.push({ type: 'bar', label: '수입', data: labels.map(m => sum(m, '수입')), backgroundColor: famChartColor('inc'), borderRadius: 6, maxBarThickness: 22 });
        if (ana.types['지출']) ds.push({ type: 'bar', label: '지출', data: labels.map(m => sum(m, '지출')), backgroundColor: famChartColor('exp'), borderRadius: 6, maxBarThickness: 22 });
        if (ana.types['수입'] && ana.types['지출']) ds.push({ type: 'line', label: '손익', data: labels.map(m => sum(m, '수입') - sum(m, '지출')), borderColor: '#64748b', backgroundColor: '#1e40af', tension: .3, pointRadius: 3 });
        anaChart = new Chart(cv.getContext('2d'), { data: { labels: labels.map(m => m.slice(2).replace('-', '.')), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { boxWidth: 10, font: { size: 11 } } } }, scales: { y: { ticks: { font: { size: 10 }, callback: v => Math.abs(v) >= 10000 ? Math.round(v / 10000) + '만' : v } }, x: { ticks: { font: { size: 10 } } } } } });
    }
    async function anaAI() {
        const rows = anaFiltered(); if (!rows.length) return;
        const btn = document.getElementById('ana-ai-btn'), out = document.getElementById('ana-ai-out');
        btn.disabled = true; out.innerHTML = '<span class="fam-spin"></span>분석 중…';
        const months = [...new Set(rows.map(e => e._ym))].sort(), lines = [];
        months.forEach(m => {
            const r = rows.filter(e => e._ym === m), inc = r.filter(e => e.type === '수입').reduce((a, e) => a + e.amt, 0), exp = r.filter(e => e.type === '지출').reduce((a, e) => a + e.amt, 0);
            const cat = {}; r.forEach(e => { const k = e.type + ':' + e.category; cat[k] = (cat[k] || 0) + e.amt; });
            const mem = {}; r.filter(e => e.type === '지출').forEach(e => { mem[e._m] = (mem[e._m] || 0) + e.amt; });
            lines.push(`${m} | 수입 ${inc} | 지출 ${exp} | 항목 ${Object.entries(cat).map(([k, v]) => k + ' ' + v).join(', ')} | 구성원별 지출 ${Object.entries(mem).map(([k, v]) => k + ' ' + v).join(', ')}`);
        });
        const cond = `구성원: ${Object.keys(ana.members).filter(k => ana.members[k]).join('·')} / 구분: ${Object.keys(ana.types).filter(k => ana.types[k]).join('·')} / 제외 항목: ${Object.keys(ana.catOff).filter(k => ana.catOff[k]).join(', ') || '없음'}`;
        try {
            const r = await famCallAI('너는 가족 가계부를 함께 보는 재무 코치다. 주어진 숫자만 근거로 쓰고, 평이한 한국어로 짧고 구체적으로 답한다. 과장하거나 훈계하지 않는다. 금액은 만원 단위로 반올림해 쓴다.',
                `집계 조건: ${cond}\n월별 데이터(원):\n${lines.join('\n')}\n\n다음 순서로 정리해줘.\n1) 한 줄 요약\n2) 추세: 늘어난 항목과 줄어든 항목 (숫자 근거)\n3) 눈에 띄는 변동이나 일회성 지출로 보이는 것\n4) 구성원별 특징 (해당될 때만)\n5) 다음 달 주의할 점과 현실적인 절감 제안 2~3개`, { maxTokens: 1800 });
            ana.ai = r.text || '(응답 없음)';
        } catch (e) { ana.ai = '분석 실패: ' + e.message; }
        out.innerHTML = famMd(ana.ai); btn.disabled = false;
    }
    document.addEventListener('change', e => {
        const t = e.target; if (!t.dataset || !t.dataset.ana) return;
        const g = t.dataset.ana, v = t.value;
        if (g === 'member') ana.members[v] = t.checked;
        else if (g === 'type') ana.types[v] = t.checked;
        else if (g === 'cat') { if (t.checked) delete ana.catOff[v]; else ana.catOff[v] = true; }
        else if (g === 'ex') { if (t.checked) delete ana.excl[v]; else ana.excl[v] = true; }
        if (g !== 'ex') { anaRender(); return; }
        const open = document.querySelector('#ana-root details[open]') ? true : false; anaRender(); if (open) { const d = document.querySelector('#ana-root details:last-of-type'); if (d) d.open = true; }
    });

    // ── 화면 전환 연결 ──
    (function () {
        const orig = window.showSection;
        if (typeof orig !== 'function') return;
        window.showSection = function (id, push) {
            orig(id, push);
            if (id === 'news-section') { const de = document.getElementById('di-news'); if (de) de.classList.add('active'); newsOnEnter(); }
            else if (newsUnsub) { try { newsUnsub(); } catch (e) {} newsUnsub = null; }
            if (id === 'asset-analysis-section') { const de = document.getElementById('di-asset'); if (de) de.classList.add('active'); anaRender(); }
        };
    })();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { const ns = document.getElementById('news-section'); if (ns && ns.classList.contains('active')) newsOnEnter(); } });
    window.addEventListener('popstate', () => { const m = document.getElementById('fam-settings'); if (m && m.style.display === 'flex') m.style.display = 'none'; });
