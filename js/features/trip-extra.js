// ═══════════════════════════════════════════════════════════
// ✈️ 여행 상세 보강 — ① 준비물 체크리스트(부부 공유) ② 여행 기록(종료 후 AI 요약)
//   tripChecks/{id}: planId, text, done, by, at
//   plans.recap = { text, at, by, ai, status }
// ═══════════════════════════════════════════════════════════
const CHK_TPL = {
    '해외여행': ['여권', '여권 사본(사진)', '항공권 e티켓', '숙소 예약 확인', '환전·트래블카드', '해외 결제 카드', '여행자 보험', '유심·eSIM', '멀티 어댑터', '보조배터리', '상비약', '편한 신발', '우산', '설연 문장집 받아두기'],
    '국내여행': ['신분증', '충전기·보조배터리', '상비약', '세면도구', '갈아입을 옷', '우산'],
    '캠핑': ['텐트·폴대·팩', '타프', '침낭·매트', '의자·테이블', '랜턴·여분 배터리', '버너·가스', '코펠·식기', '아이스박스', '장작·토치', '쓰레기봉투', '모기 기피제', '방한 옷'],
    '등산': ['등산화', '배낭', '물 1L 이상', '행동식·간식', '바람막이·여벌 옷', '스틱', '헤드랜턴', '상비약·밴드', '보조배터리', '장갑', '모자·선크림', '설연 하산 체크인'],
    '골프': ['골프백', '골프화', '공·티', '장갑', '모자·선크림', '갈아입을 옷', '예약 확인']
};
const chkTplFor = p => p.subType === '캠핑' ? '캠핑' : p.subType === '등산' ? '등산' : /골프/.test(p.subType || '') ? '골프' : p.mType === '해외' ? '해외여행' : '국내여행';
let chkUnsub = null, chkPid = '', chkItems = [];

// ── ① 준비물 ──
function tripChkListen(pid) {
    if (chkPid === pid && chkUnsub) return;
    if (chkUnsub) try { chkUnsub(); } catch (e) {}
    chkPid = pid; chkItems = [];
    try { chkUnsub = db.collection('tripChecks').where('planId', '==', pid).onSnapshot(s => { chkItems = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.at || 0) - (b.at || 0)); tripChkPaint(); }, () => {}); } catch (e) {}
}
function tripChkPaint() {
    const el = document.getElementById('trip-chk'), p = famTripById(chkPid); if (!el || !p || el.dataset.pid !== p.id) return;
    const done = chkItems.filter(x => x.done).length, n = chkItems.length, past = tripEnd(p) < famYmd(new Date()), tpl = chkTplFor(p);
    if (past && !n) { el.style.display = 'none'; return; }
    el.style.display = '';
    const list = chkItems.map(x => `<label class="chk-row ${x.done ? 'done' : ''}"><input type="checkbox" ${x.done ? 'checked' : ''} onchange="tripChkToggle('${x.id}',this.checked)"><span>${famEsc(x.text)}</span>${x.done && x.by ? `<small>${famEsc(x.by)}</small>` : ''}<button onclick="event.preventDefault();tripChkDel('${x.id}')">✕</button></label>`).join('');
    const tplBtns = Object.keys(CHK_TPL).sort((a, b) => (b === tpl) - (a === tpl)).map(k => `<button class="fam-btn ${k === tpl && !n ? 'pri' : ''}" onclick="tripChkTpl('${k}')">＋ ${k}</button>`).join('');
    const body = `${n ? `<div class="sv-bar" style="margin:2px 0 8px"><i style="width:${Math.round(done / n * 100)}%;background:${done === n ? '#10b981' : 'var(--month-header)'}"></i></div>${list}` : '<div class="fam-note" style="margin:0 0 6px">둘이 같이 체크하는 준비물 목록입니다. 템플릿으로 시작하거나 직접 넣으세요.</div>'}
        <div class="chk-add"><input id="chk-new" placeholder="준비물 추가 (쉼표로 여러 개)" onkeydown="if(event.key==='Enter'){event.preventDefault();tripChkAdd()}"><button onclick="tripChkAdd()">추가</button></div>
        <div class="trip-btns">${p.supplies && !n ? `<button class="fam-btn pri" onclick="tripChkFromMemo()">메모의 준비물을 목록으로</button>` : ''}${tplBtns}</div>`;
    el.innerHTML = `<div class="trip-h">🎒 준비물 ${n ? `<b style="font-size:15px">${done}/${n}</b>${done === n ? '<small style="color:#059669">준비 끝</small>' : ''}` : ''}</div>` +
        (past ? `<details class="trip-list"><summary>목록 보기</summary>${body}</details>` : body);
}
function tripChkToggle(id, on) { db.collection('tripChecks').doc(id).update({ done: on, by: on ? famUser() : '' }).catch(e => famToast(e.message)); }
function tripChkDel(id) { db.collection('tripChecks').doc(id).delete().catch(e => famToast(e.message)); }
async function tripChkAddList(texts) {
    const have = new Set(chkItems.map(x => x.text.replace(/\s/g, ''))), add = texts.map(t => t.trim()).filter(t => t && !have.has(t.replace(/\s/g, '')));
    if (!add.length) { famToast('이미 목록에 있습니다'); return; }
    const b = db.batch(), now = Date.now();
    add.forEach((t, i) => { const id = 'chk_' + now + '_' + i; b.set(db.collection('tripChecks').doc(id), { id, planId: chkPid, text: t, done: false, by: '', at: now + i }); });
    try { await b.commit(); } catch (e) { famToast(e.message); }
}
function tripChkAdd() { const el = document.getElementById('chk-new'), v = (el.value || '').trim(); if (!v) return; el.value = ''; tripChkAddList(v.split(/[,，\n]/)); }
function tripChkTpl(k) { tripChkAddList(CHK_TPL[k] || []); }
function tripChkFromMemo() { const p = famTripById(chkPid); if (p && p.supplies) tripChkAddList(p.supplies.split(/[,，\n·/]/)); }

// ── ② 여행 기록 ──
function tripRecapData(p) {
    const rows = tripAssets(p.id).filter(e => e.type === '지출'), by = {};
    rows.forEach(e => { const k = tripBK(e.category); by[k] = (by[k] || 0) + e.amt; });
    const total = rows.reduce((a, e) => a + e.amt, 0), B = tripBudget(p), f = tripFolder(p);
    const top = rows.slice().sort((a, b) => b.amt - a.amt).slice(0, 5).map(e => `${e.memo || e.category} ${e.amt}원`);
    const hikes = (typeof hikeLogs !== 'undefined' ? hikeLogs : []).filter(h => h.planId === p.id || (h.date >= p.start && h.date <= tripEnd(p)));
    return { total, by, B, photos: f ? (f.photos || []).length : 0, top, hikes, n: rows.length };
}
async function tripRecapMake(pid, auto) {
    const p = famTripById(pid); if (!p) return false;
    if (!(famKeys()[famProv()] || '')) { if (!auto) famOpenSettings(); return false; }
    const ref = db.collection('plans').doc(pid);
    try {
        const go = await db.runTransaction(async t => { const s = await t.get(ref); const r = (s.data() || {}).recap; if (auto && r && (r.text || (r.status === 'making' && Date.now() - (r.at || 0) < 5 * 60e3))) return false; t.update(ref, { recap: { ...(r || {}), status: 'making', at: Date.now() } }); return true; });
        if (!go) return false;
    } catch (e) { return false; }
    if (!auto) tripRecapPaint(pid, '<span class="fam-spin"></span>여행 기록을 만드는 중…');
    const d = tripRecapData(p), days = Math.max(1, Math.round((new Date(tripEnd(p) + 'T00:00:00') - new Date(p.start + 'T00:00:00')) / 864e5) + 1);
    try {
        const r = await famCallAI('너는 부부의 여행·여가 기록을 정리해 주는 도우미다. 주어진 사실만 쓰고 지어내지 않는다. 담백한 한국어로 쓰고 과장하지 않는다. 금액은 만원 단위로 반올림한다.',
            `${p.subType || '여행'} · ${p.loc || ''} · ${p.start}~${tripEnd(p)} (${days}일) · ${p.member === '공통' ? '부부 함께' : p.member}
일별 메모: ${(p.dayMemos || []).filter(Boolean).map((m, i) => `${i + 1}일차 ${m}`).join(' / ') || '없음'}
메모: ${p.memo || '없음'}
경비 합계 ${d.total}원 (${d.n}건) · 분류별 ${Object.entries(d.by).map(([k, v]) => k + ' ' + v).join(', ') || '없음'}
예산: ${d.B ? d.B.total + '원' : '없음'}
큰 지출: ${d.top.join(', ') || '없음'}
사진 ${d.photos}장${d.hikes.length ? `\n산행: ${d.hikes.map(h => `${h.place} ${h.mins}분`).join(', ')}` : ''}

위 내용으로 4~6줄짜리 여행 기록을 써라. 첫 줄은 어디서 무엇을 했는지 한 문장, 이어서 일정 흐름, 경비(예산이 있으면 예산 대비), 다음에 참고할 점 한 줄. 목록 기호 없이 줄바꿈만 쓴다.`, { maxTokens: 900 });
        const text = (r.text || '').trim(); if (!text) throw new Error('응답이 비어 있습니다');
        const recap = { text, at: Date.now(), by: famUser() || '', ai: FAM_NAMES[famProv()], status: 'done' };
        await ref.update({ recap }); p.recap = recap;
        if (auto) db.collection('messages').add({ type: 'text', text: `📝 ${p.loc || p.subType} 여행 기록\n${text}`, sender: '✈️ 여행 기록', isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
        tripRecapPaint(pid);
        return true;
    } catch (e) {
        ref.update({ recap: firebase.firestore.FieldValue.delete() }).catch(() => {});
        if (!auto) tripRecapPaint(pid, '⚠️ ' + famEsc(e.message));
        return false;
    }
}
function tripRecapHtml(p) {
    if (!p.start || tripEnd(p) >= famYmd(new Date())) return '';
    return `<div class="trip-sec recap" id="trip-recap" data-pid="${famEsc(p.id)}">${tripRecapInner(p)}</div>`;
}
function tripRecapInner(p, msg) {
    const r = p.recap;
    if (msg) return `<div class="trip-h">📝 여행 기록</div><div class="fam-note" style="margin:0">${msg}</div>`;
    if (r && r.text) return `<div class="trip-h">📝 여행 기록<button class="trip-edit" onclick="tripRecapMake('${famEsc(p.id)}',false)">다시 만들기</button></div><div class="recap-text">${famEsc(r.text).replace(/\n/g, '<br>')}</div>`;
    return `<div class="trip-h">📝 여행 기록</div><div class="trip-btns" style="margin-top:0"><button class="fam-btn pri" onclick="tripRecapMake('${famEsc(p.id)}',false)">일정·경비·사진으로 기록 만들기</button></div>`;
}
function tripRecapPaint(pid, msg) { const el = document.getElementById('trip-recap'), p = famTripById(pid); if (el && p && el.dataset.pid === pid) el.innerHTML = tripRecapInner(p, msg); }
// 끝난 지 7일 안 된 여행은 기록을 자동으로 만들어 채팅으로 보냄 (하루 한 번 확인)
async function tripRecapAuto() {
    const today = famYmd(new Date()); try { if (localStorage.getItem('famRecapRun') === today) return; } catch (e) {}
    if (!(famKeys()[famProv()] || '')) return;
    const wk = new Date(); wk.setDate(wk.getDate() - 7); const from = famYmd(wk);
    const list = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && tripEnd(p) < today && tripEnd(p) >= from && !(p.recap && p.recap.text) && p.subType !== '스크린골프'
        && (tripAssets(p.id).length || (p.dayMemos || []).some(Boolean) || tripFolder(p)));
    try { localStorage.setItem('famRecapRun', today); } catch (e) {}
    for (const p of list.slice(0, 2)) await tripRecapMake(p.id, true);
}

// ── 여행 상세에 연결 ──
(function () {
    const tr = window.tripRecordHtml;
    window.tripRecordHtml = function (p) {
        tripChkListen(p.id); setTimeout(tripChkPaint, 0);
        return tripRecapHtml(p) + `<div class="trip-sec" id="trip-chk" data-pid="${famEsc(p.id)}"></div>` + tr(p);
    };
    famAuthGate(() => setTimeout(tripRecapAuto, 15000));
})();
