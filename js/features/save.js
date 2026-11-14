    // ═══════════════════════════════════════════════════════════
    // 🎯 저축 목표 · 🔁 정기 이체 (지출 → 가계부 / 저축 → 목표)
    // ═══════════════════════════════════════════════════════════
    let fxList = [], fxUnsub = null, fxRunning = false, svGoals = [], svLogs = [], svUnsub = null;
    const svW = n => { n = Math.round(Number(n) || 0); const a = Math.abs(n); return (n < 0 ? '-' : '') + (a >= 10000 ? (a % 10000 === 0 ? (a / 10000).toLocaleString('ko-KR') + '만' : (a / 10000).toFixed(1).replace(/\.0$/, '') + '만') : a.toLocaleString('ko-KR')) + '원'; };
    function fxListen() { if (fxUnsub) return; try { fxUnsub = db.collection('fixedExpenses').onSnapshot(s => { fxList = s.docs.map(d => ({ id: d.id, ...d.data() })); fxRun(); svRender(); }, () => {}); } catch (e) {} }
    function svListen() {
        if (svUnsub) return;
        try {
            const u1 = db.collection('savingsGoals').onSnapshot(s => { svGoals = s.docs.map(d => ({ id: d.id, ...d.data() })); svRender(); famHomeBanners(); }, () => {});
            const u2 = db.collection('savingsLogs').onSnapshot(s => { svLogs = s.docs.map(d => ({ id: d.id, ...d.data() })); svRender(); famHomeBanners(); }, () => {});
            svUnsub = () => { u1(); u2(); };
        } catch (e) {}
    }
    const svSaved = gid => svLogs.filter(l => l.goalId === gid).reduce((a, l) => a + (Number(l.amt) || 0), 0);
    function svMonthsLeft(deadline) { if (!deadline) return 0; const n = new Date(), d = new Date(deadline + (deadline.length === 7 ? '-01' : '') + 'T00:00:00'); return Math.max(1, (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth() + (deadline.length === 7 ? 1 : 0)); }
    async function fxRun() {
        if (fxRunning || !fxList.length) return; fxRunning = true;
        try {
            const now = new Date(), ym = famYmd(now).slice(0, 7), last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (const f of fxList.filter(f => f.active !== false)) {
                const day = Math.min(Math.max(1, +f.day || 1), last); if (now.getDate() < day) continue;
                const date = `${ym}-${String(day).padStart(2, '0')}`;
                if (f.kind === 'saving') {
                    if (!f.goalId) continue;
                    const id = `fxs_${f.id}_${ym}`, ref = db.collection('savingsLogs').doc(id), snap = await ref.get();
                    if (!snap.exists) await ref.set({ id, goalId: f.goalId, date, amt: Number(f.amt) || 0, memo: `[정기] ${f.name || ''}`, by: '자동', fixedId: f.id, createdAt: Date.now() });
                } else {
                    const id = `fx_${f.id}_${ym}`, ref = db.collection('assets').doc(id), snap = await ref.get();
                    if (!snap.exists) await ref.set({ id, member: f.member || '공통', date, type: '지출', category: f.category || '생활비', pay: f.pay || '카드', amt: Number(f.amt) || 0, memo: `[고정] ${f.name || ''}`, fixedId: f.id });
                }
            }
        } catch (e) { console.warn('[정기이체]', e); }
        fxRunning = false;
    }
    function fxOpen() { showSection('save-section'); }
    function svRender() {
        const g = document.getElementById('sv-goals'), fx = document.getElementById('sv-fixed'); if (!g || !fx) return;
        const goals = svGoals.filter(x => !x.archived).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        g.innerHTML = goals.length ? goals.map(x => {
            const saved = svSaved(x.id), tgt = Number(x.target) || 0, pct = tgt ? Math.min(100, Math.round(saved / tgt * 100)) : 0, ml = svMonthsLeft(x.deadline), need = tgt > saved && ml ? Math.ceil((tgt - saved) / ml / 1000) * 1000 : 0;
            const auto = fxList.filter(f => f.kind === 'saving' && f.goalId === x.id && f.active !== false).reduce((a, f) => a + (Number(f.amt) || 0), 0);
            return `<div class="sv-goal" onclick="svGoalView('${x.id}')">
                <div style="display:flex;align-items:baseline;gap:6px"><b style="font-size:14.5px;color:#1e293b;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${famEsc(x.name)}</b><span style="margin-left:auto;font-weight:800;color:${pct >= 100 ? '#059669' : 'var(--month-header)'}">${tgt ? pct + '%' : svW(saved)}</span></div>
                ${x.account ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px">🏦 ${famEsc(x.account)}</div>` : ''}
                ${tgt ? `<div class="sv-bar"><i style="width:${pct}%;${pct >= 100 ? 'background:#10b981' : ''}"></i></div>` : '<div style="height:6px"></div>'}
                <div style="display:flex;font-size:12px;color:#475569"><span>${tgt ? svW(saved) + ' / ' + svW(tgt) : '누적 ' + svW(saved) + ' · 목표 금액 없음'}</span><span style="margin-left:auto;color:#94a3b8">${pct >= 100 && tgt ? '🎉 달성' : x.deadline ? `${famEsc(x.deadline)}까지${need ? ` · 매달 ${svW(need)}` : ''}` : ''}</span></div>
                ${auto ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">🔁 정기 저축 매달 ${svW(auto)}${need && auto < need ? ` · <span style="color:#d97706">${svW(need - auto)} 부족</span>` : ''}</div>` : ''}
                <div style="margin-top:8px;display:flex;gap:6px" onclick="event.stopPropagation()"><button class="fam-btn pri" style="padding:5px 12px;font-size:12px" onclick="svLogForm('${x.id}',1)">＋ 입금</button><button class="fam-btn" style="padding:5px 12px;font-size:12px" onclick="svLogForm('${x.id}',-1)">－ 출금</button></div>
            </div>`;
        }).join('') : '<div class="fam-note" style="text-align:center;padding:10px 0">계좌나 목적별로 저축을 만들어 모아 보세요. 목표 금액은 없어도 됩니다. 예) 청약 · 비상금 · 여행 자금</div>';
        const rows = fxList.slice().sort((a, b) => (+a.day || 0) - (+b.day || 0));
        fx.innerHTML = rows.length ? rows.map(f => {
            const isS = f.kind === 'saving', goal = isS ? svGoals.find(x => x.id === f.goalId) : null;
            return `<div class="fam-row"><input type="checkbox" ${f.active !== false ? 'checked' : ''} onchange="fxSet('${f.id}',{active:this.checked})" style="width:18px;height:18px;accent-color:var(--month-header)">
                <span style="flex:1;min-width:0;cursor:pointer" onclick="fxForm('${f.id}')"><b>${famEsc(f.name)}</b> <small class="sv-tag ${isS ? 's' : ''}">${isS ? '저축' : '지출'}</small><br><small style="color:#94a3b8">매월 ${+f.day}일 · ${isS ? '→ ' + famEsc(goal ? goal.name : '(쌓을 곳 없음)') : famEsc(f.category) + ' · ' + famEsc(f.member) + ' · ' + famEsc(f.pay)}</small></span>
                <b style="white-space:nowrap">${svW(f.amt)}</b></div>`;
        }).join('') + (() => { const on = rows.filter(f => f.active !== false), e = on.filter(f => f.kind !== 'saving').reduce((a, f) => a + (+f.amt || 0), 0), v = on.filter(f => f.kind === 'saving').reduce((a, f) => a + (+f.amt || 0), 0); return `<div class="fam-note" style="text-align:right">매월 지출 ${svW(e)} · 저축 ${svW(v)}</div>`; })()
            : '<div class="fam-note">등록된 정기 이체가 없습니다. 관리비·통신비·적금 등을 넣어 두세요.</div>';
        if (typeof subRender === 'function') { subRender(); carRender(); }
    }
    // ── 목표 ──
    function svGoalForm(id) {
        const x = id ? svGoals.find(g => g.id === id) : {};
        famSheet(`<div class="fam-h"><b>${id ? '✏️ 저축 수정' : '💰 새 저축'}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="ff-form">
                <div class="full"><label>이름</label><input id="svg-name" value="${famEsc(x.name || '')}" placeholder="예: 주택청약 / 제주 여행 자금"></div>
                <div class="full"><label>계좌·보관처 (선택)</label><input id="svg-acc" value="${famEsc(x.account || '')}" placeholder="예: 카카오뱅크 세이프박스"></div>
                <div><label>목표 금액 (만원, 선택)</label><input id="svg-tgt" type="number" inputmode="numeric" value="${x.target ? x.target / 10000 : ''}" placeholder="300"></div>
                <div><label>목표 시점 (선택)</label><input id="svg-dl" type="month" value="${famEsc((x.deadline || '').slice(0, 7))}"></div>
                ${id ? '' : '<div class="full"><label>이미 모은 금액 (만원, 선택)</label><input id="svg-init" type="number" inputmode="numeric" placeholder="0"></div>'}
            </div>
            <div class="fam-btns">${id ? `<button class="fam-btn" onclick="svGoalArchive('${id}')">보관</button><button class="fam-btn" style="color:#dc2626" onclick="svGoalDel('${id}')">삭제</button>` : ''}<button class="fam-btn pri" onclick="svGoalSave('${id || ''}')">저장</button></div>`);
    }
    async function svGoalSave(id) {
        const v = k => (document.getElementById('svg-' + k) || {}).value || '', name = v('name').trim();
        if (!name) { famToast('이름을 입력하세요'); return; }
        const doc = { name, account: v('acc').trim(), target: Math.round((+v('tgt') || 0) * 10000), deadline: v('dl') };
        try {
            if (id) await db.collection('savingsGoals').doc(id).update(doc);
            else {
                const gid = 'goal_' + Date.now(); await db.collection('savingsGoals').doc(gid).set({ id: gid, ...doc, createdAt: Date.now(), by: famUser() });
                const init = Math.round((+v('init') || 0) * 10000);
                if (init) { const lid = 'sl_' + Date.now(); await db.collection('savingsLogs').doc(lid).set({ id: lid, goalId: gid, date: famYmd(new Date()), amt: init, memo: '시작 금액', by: famUser(), createdAt: Date.now() }); }
            }
            famSheetClose(); famToast('저장했습니다');
        } catch (e) { famToast('저장 실패: ' + e.message); }
    }
    function svGoalArchive(id) { if (confirm('이 저축을 보관할까요? 목록에서 숨겨지고 기록은 남습니다.')) db.collection('savingsGoals').doc(id).update({ archived: true }).then(famSheetClose).catch(e => famToast(e.message)); }
    async function svGoalDel(id) {
        if (!confirm('이 저축과 입출금 기록을 모두 삭제할까요?')) return;
        try { const b = db.batch(); svLogs.filter(l => l.goalId === id).forEach(l => b.delete(db.collection('savingsLogs').doc(l.id))); b.delete(db.collection('savingsGoals').doc(id)); await b.commit(); famSheetClose(); } catch (e) { famToast(e.message); }
    }
    function svGoalView(id) {
        const x = svGoals.find(g => g.id === id); if (!x) return;
        const logs = svLogs.filter(l => l.goalId === id).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
        famSheet(`<div class="fam-h"><b>💰 ${famEsc(x.name)}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div style="font-size:13px;color:#475569;margin:-4px 0 10px">${svW(svSaved(id))}${x.target ? ' / ' + svW(x.target) : ''}${x.account ? ' · ' + famEsc(x.account) : ''}</div>
            <div class="fam-box">${logs.length ? logs.map(l => `<div class="fam-row"><span style="flex:1"><b style="color:${l.amt < 0 ? '#dc2626' : '#059669'}">${l.amt < 0 ? '' : '+'}${svW(l.amt)}</b> <small style="color:#94a3b8">${famEsc(l.date)} · ${famEsc(l.memo || '')}${l.by ? ' · ' + famEsc(l.by) : ''}</small></span><button class="fam-x" style="width:24px;height:24px;font-size:10px" onclick="svLogDel('${l.id}','${id}')">✕</button></div>`).join('') : '<div class="fam-note">입출금 기록이 없습니다.</div>'}</div>
            <div class="fam-btns"><button class="fam-btn" onclick="svGoalForm('${id}')">수정</button><button class="fam-btn pri" onclick="svLogForm('${id}',1)">＋ 입금</button></div>`);
    }
    function svLogForm(gid, sign) {
        const x = svGoals.find(g => g.id === gid); if (!x) return;
        famSheet(`<div class="fam-h"><b>${sign > 0 ? '＋ 입금' : '－ 출금'} · ${famEsc(x.name)}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="ff-form">
                <div><label>금액 (원)</label><input id="svl-amt" type="number" inputmode="numeric" placeholder="100000"></div>
                <div><label>날짜</label><input id="svl-date" type="date" value="${famYmd(new Date())}"></div>
                <div class="full"><label>메모 (선택)</label><input id="svl-memo" placeholder="${sign > 0 ? '예: 보너스 일부' : '예: 항공권 결제'}"></div>
            </div>
            <div class="fam-btns"><button class="fam-btn pri" onclick="svLogSave('${gid}',${sign})">저장</button></div>`);
        setTimeout(() => { const el = document.getElementById('svl-amt'); if (el) el.focus(); }, 200);
    }
    async function svLogSave(gid, sign, amtIn, memoIn) {
        const amt = Math.abs(Math.round(amtIn != null ? amtIn : +(document.getElementById('svl-amt') || {}).value || 0)); if (!amt) { famToast('금액을 입력하세요'); return; }
        const id = 'sl_' + Date.now();
        try {
            await db.collection('savingsLogs').doc(id).set({ id, goalId: gid, date: amtIn != null ? famYmd(new Date()) : ((document.getElementById('svl-date') || {}).value || famYmd(new Date())), amt: sign * amt, memo: memoIn != null ? memoIn : ((document.getElementById('svl-memo') || {}).value || '').trim(), by: famUser(), createdAt: Date.now() });
            if (amtIn == null) famSheetClose(); famToast(sign > 0 ? '입금 기록했습니다' : '출금 기록했습니다'); return id;
        } catch (e) { famToast('저장 실패: ' + e.message); }
    }
    function svLogDel(id, gid) { if (confirm('이 기록을 삭제할까요?')) db.collection('savingsLogs').doc(id).delete().then(() => setTimeout(() => svGoalView(gid), 300)).catch(e => famToast(e.message)); }
    // ── 정기 이체 ──
    function fxForm(id) {
        const f = id ? fxList.find(x => x.id === id) : { kind: 'expense', day: 25, category: '생활비', member: '공통', pay: '카드' };
        const goals = svGoals.filter(g => !g.archived);
        famSheet(`<div class="fam-h"><b>${id ? '✏️ 정기 이체 수정' : '🔁 정기 이체 추가'}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="ff-form">
                <div class="full"><label>종류</label><select id="fx-kind" onchange="document.querySelectorAll('.fx-e').forEach(e=>e.style.display=this.value==='saving'?'none':'');document.querySelectorAll('.fx-s').forEach(e=>e.style.display=this.value==='saving'?'':'none')">
                    <option value="expense" ${f.kind !== 'saving' ? 'selected' : ''}>지출 — 가계부에 기록 (관리비·통신비·보험)</option>
                    <option value="saving" ${f.kind === 'saving' ? 'selected' : ''}>저축 — 저축에 적립 (적금·청약·자동이체)</option></select></div>
                <div class="full"><label>이름</label><input id="fx-name" value="${famEsc(f.name || '')}" placeholder="예: 아파트 관리비 / 여행 적금"></div>
                <div><label>금액 (원)</label><input id="fx-amt" type="number" inputmode="numeric" value="${f.amt || ''}"></div>
                <div><label>매월 며칠</label><input id="fx-day" type="number" min="1" max="31" value="${+f.day || 25}"></div>
                <div class="full fx-s" style="${f.kind === 'saving' ? '' : 'display:none'}"><label>쌓을 곳</label><select id="fx-goal"><option value="__new" ${!f.goalId ? 'selected' : ''}>＋ 새로 만들기 (위 이름으로)</option>${goals.map(g => `<option value="${g.id}" ${g.id === f.goalId ? 'selected' : ''}>${famEsc(g.name)}${g.account ? ' · ' + famEsc(g.account) : ''}</option>`).join('')}</select></div>
                <div class="fx-e" style="${f.kind === 'saving' ? 'display:none' : ''}"><label>분류</label><select id="fx-cat">${EXP_CATS.map(c => `<option ${c === f.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
                <div class="fx-e" style="${f.kind === 'saving' ? 'display:none' : ''}"><label>구성원</label>${famMemberSel('fx-mem', f.member || '공통')}</div>
                <div class="fx-e" style="${f.kind === 'saving' ? 'display:none' : ''}"><label>결제</label><select id="fx-pay"><option ${f.pay !== '현금' ? 'selected' : ''}>카드</option><option ${f.pay === '현금' ? 'selected' : ''}>현금</option></select></div>
            </div>
            <div class="fam-btns">${id ? `<button class="fam-btn" style="color:#dc2626" onclick="fxDel('${id}')">삭제</button>` : ''}<button class="fam-btn pri" onclick="fxAdd('${id || ''}')">${id ? '저장' : '추가'}</button></div>`);
    }
    async function fxAdd(editId) {
        const g = k => (document.getElementById('fx-' + k) || {}).value?.trim() || '', amt = Number(g('amt')) || 0, kind = g('kind') || 'expense';
        if (!g('name') || !amt) { famToast('이름과 금액을 입력하세요'); return; }
        const id = editId || 'fixed_' + Date.now();
        let goalId = g('goal');
        if (kind === 'saving' && (!goalId || goalId === '__new')) {
            goalId = 'goal_' + Date.now();
            try { await db.collection('savingsGoals').doc(goalId).set({ id: goalId, name: g('name'), account: '', target: 0, deadline: '', createdAt: Date.now(), by: famUser() }); }
            catch (e) { famToast('저축을 만들지 못했습니다: ' + e.message); return; }
        }
        const doc = { id, kind, name: g('name'), amt, day: Math.min(31, Math.max(1, +g('day') || 1)), category: g('cat') || '생활비', member: g('mem') || '공통', pay: g('pay') || '카드', goalId: kind === 'saving' ? goalId : '', active: editId ? (fxList.find(x => x.id === editId) || {}).active !== false : true };
        try { await db.collection('fixedExpenses').doc(id).set(doc); famSheetClose(); famToast(editId ? '저장했습니다' : '추가했습니다'); }
        catch (e) { famToast('저장 실패: ' + e.message); }
    }
    function fxSet(id, v) { db.collection('fixedExpenses').doc(id).update(v).catch(e => famToast(e.message)); }
    function fxDel(id) { if (confirm('이 정기 이체를 삭제할까요? 이미 기록된 내역은 남습니다.')) db.collection('fixedExpenses').doc(id).delete().then(famSheetClose).catch(e => famToast(e.message)); }

    // ═══════════════════════════════════════════════════════════
    // 📊 항목별 월 예산 (가계부)
    // ═══════════════════════════════════════════════════════════
    let famBudget = {}, famBudgetUnsub = null;
    function budgetListen() { if (famBudgetUnsub) return; try { famBudgetUnsub = db.collection('config').doc('budgets').onSnapshot(d => { famBudget = (d.exists && d.data().cats) || {}; budgetRender(); famHomeToday(); }, () => {}); } catch (e) {} }
    function budgetSpent(ym) { const o = {}; (typeof anaAll === 'function' ? anaAll() : []).filter(e => e._ym === ym && e.type === '지출').forEach(e => o[e.category] = (o[e.category] || 0) + e.amt); return o; }
    const budgetTotal = () => Object.values(famBudget).reduce((a, v) => a + (+v || 0), 0);
    function budgetColor(p) { return p >= 100 ? '#dc2626' : p >= 80 ? '#f59e0b' : 'var(--month-header)'; }
    function budgetRender() {
        const el = document.getElementById('budget-card'); if (!el) return;
        const ym = famYmd(new Date()).slice(0, 7), sp = budgetSpent(ym), cats = EXP_CATS.filter(c => +famBudget[c] > 0), tot = budgetTotal();
        if (!cats.length) { el.innerHTML = ''; return; }   // 예산 설정은 가계부 ⋯ 메뉴에서
        const used = cats.reduce((a, c) => a + (sp[c] || 0), 0), tp = Math.round(used / tot * 100), day = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(), pace = Math.round(day / dim * 100);
        el.innerHTML = `<div class="bd-wrap">
            <div style="display:flex;align-items:center"><b style="font-size:13px;color:#1e293b;white-space:nowrap">📊 ${+ym.slice(5)}월 예산</b><span style="margin-left:8px;font-size:13px;color:${budgetColor(tp)};font-weight:800">${tp}%</span><button class="fam-btn" style="margin-left:auto;padding:3px 10px;font-size:11px;white-space:nowrap" onclick="budgetForm()">설정</button></div>
            <div style="font-size:11px;color:#94a3b8;margin:2px 0 6px">${svW(used)} / ${svW(tot)} · 이번 달 ${pace}% 지남</div>
            ${cats.map(c => { const b = +famBudget[c], u = sp[c] || 0, p = Math.round(u / b * 100); return `<div class="bd-row"><span class="bd-n">${famEsc(c)}</span><div class="sv-bar" style="flex:1;margin:0"><i style="width:${Math.min(100, p)}%;background:${budgetColor(p)}"></i></div><span class="bd-v" style="color:${p >= 100 ? '#dc2626' : '#475569'}">${svW(u)}<small> / ${svW(b)}</small></span></div>`; }).join('')}
            ${(() => { const over = EXP_CATS.filter(c => !(+famBudget[c] > 0) && sp[c]).reduce((a, c) => a + sp[c], 0); return over ? `<div class="fam-note" style="margin-top:4px">예산 없는 항목 지출 ${svW(over)}</div>` : ''; })()}
        </div>`;
    }
    function budgetForm() {
        const ym = famYmd(new Date()).slice(0, 7), sp = budgetSpent(ym), p3 = [1, 2, 3].map(i => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return budgetSpent(famYmd(d).slice(0, 7)); });
        famSheet(`<div class="fam-h"><b>📊 항목별 월 예산</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-note" style="margin:-4px 0 10px">만원 단위로 입력하세요. 비워 두면 그 항목은 예산을 쓰지 않습니다. 회색은 최근 3개월 평균입니다.</div>
            <div class="ff-form">${EXP_CATS.map(c => { const avg = Math.round(p3.reduce((a, o) => a + (o[c] || 0), 0) / 3 / 10000); return `<div><label>${famEsc(c)} <span style="color:#94a3b8;font-weight:500">평균 ${avg}만</span></label><input class="bd-in" data-c="${famEsc(c)}" type="number" inputmode="numeric" value="${+famBudget[c] ? famBudget[c] / 10000 : ''}" placeholder="${avg || ''}"></div>`; }).join('')}</div>
            <div class="fam-btns"><button class="fam-btn pri" onclick="budgetSave()">저장</button></div>`);
    }
    async function budgetSave() {
        const cats = {}; document.querySelectorAll('.bd-in').forEach(i => { const v = Math.round((+i.value || 0) * 10000); if (v > 0) cats[i.dataset.c] = v; });
        try { await db.collection('config').doc('budgets').set({ cats, updatedAt: Date.now(), by: famUser() }); famBudget = cats; budgetRender(); famHomeToday(); famSheetClose(); famToast('예산을 저장했습니다'); }
        catch (e) { famToast('저장 실패: ' + e.message); }
    }

