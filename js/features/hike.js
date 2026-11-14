// ═══════════════════════════════════════════════════════════
// ⛰️ 하산 체크인
//   산행 시작 시 하산 예정 시각 등록 → 가족 채팅에 알림
//   예정 시각이 지나도 체크인이 없으면 두 폰 모두 경고 + 채팅에 경고 1회
//   hikes/{id}: by, place, note, startAt, dueAt(ms), status(active|done|cancel), alertSent
// ═══════════════════════════════════════════════════════════
let hikeList = [], hikeTimer = null, hikeLogs = [], hikeFormPlan = '';
const HIKE_GRACE = 30 * 60e3;       // 예정 시각 후 30분 지나면 경고
const hm = ms => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function hikeListen() {
    try {
        db.collection('hikes').where('status', '==', 'active').onSnapshot(s => {
            hikeList = s.docs.map(d => ({ id: d.id, ...d.data() }));
            hikeCheck(); famHomeBanners();
        }, () => {});
    } catch (e) {}
    clearInterval(hikeTimer); hikeTimer = setInterval(hikeCheck, 60e3);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') hikeCheck(); });
}
const hikeOverdue = h => Date.now() > h.dueAt + HIKE_GRACE;

function hikeForm() {
    const today = famYmd(new Date());
    const plan = (typeof planData !== 'undefined' ? planData : []).find(p => p.subType === '등산' && p.start <= today && (p.end || p.start) >= today);
    hikeFormPlan = plan ? plan.id : '';
    const due = new Date(Date.now() + 5 * 3600e3); due.setMinutes(Math.ceil(due.getMinutes() / 10) * 10, 0, 0);
    famSheet(`<div class="fam-h"><b>⛰️ 산행 시작 · 하산 체크인</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:-4px 0 10px">하산 예정 시각까지 '하산 완료'를 누르지 않으면 30분 뒤 가족 폰에 경고가 뜨고 채팅에도 남습니다.</div>
        <div class="ff-form">
            <div class="full"><label>산 · 코스</label><input id="hk-place" value="${famEsc(plan ? plan.loc || '' : '')}" placeholder="예: 북한산 백운대 (우이동 원점회귀)"></div>
            <div><label>하산 예정 시각</label><input id="hk-due" type="time" value="${hm(due.getTime())}"></div>
            <div><label>동행</label><input id="hk-with" placeholder="예: 혼자 / 친구 2명"></div>
            <div class="full"><label>메모 (선택)</label><input id="hk-note" placeholder="예: 주차 우이동 공영주차장"></div>
        </div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="hikeStart(this)">산행 시작</button></div>`);
}
async function hikeStart(btn) {
    const v = k => (document.getElementById('hk-' + k) || {}).value || '';
    const place = v('place').trim(); if (!place) { famToast('산·코스를 입력하세요'); return; }
    const [h, m] = (v('due') || '17:00').split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0);
    if (d.getTime() < Date.now() - 60e3) d.setDate(d.getDate() + 1);    // 이미 지난 시각이면 다음 날
    const id = 'hike_' + Date.now(), who = famUser() || '가족', note = [v('with').trim(), v('note').trim()].filter(Boolean).join(' · ');
    btn.disabled = true;
    try {
        await db.collection('hikes').doc(id).set({ id, by: who, place, note, planId: hikeFormPlan || '', startAt: Date.now(), dueAt: d.getTime(), status: 'active', alertSent: false });
        hikeChat(`⛰️ ${place} 산행 시작 · 하산 예정 ${hm(d.getTime())}${note ? ' · ' + note : ''}`);
        famSheetClose(); famToast('산행을 등록했습니다. 내려오면 홈에서 하산 완료를 누르세요.');
    } catch (e) { btn.disabled = false; famToast('등록 실패: ' + e.message); }
}
async function hikeDone(id) {
    const h = hikeList.find(x => x.id === id); if (!h) return;
    try {
        const now = Date.now(), mins = Math.max(1, Math.round((now - h.startAt) / 60e3));
        await db.collection('hikes').doc(id).update({ status: 'done', doneAt: now });
        await hikeLogSave({ place: h.place, by: h.by, date: famYmd(new Date(h.startAt)), mins, note: h.note || '', planId: h.planId || '', hikeId: id });
        hikeChat(`✅ ${h.place} 하산 완료 (${hm(now)}) · ${hikeDur(mins)} 산행`); famToast('하산 완료 · 산행 기록에 저장했습니다');
    }
    catch (e) { famToast(e.message); }
}
async function hikeExtend(id, min) {
    const h = hikeList.find(x => x.id === id); if (!h) return;
    const due = Math.max(h.dueAt, Date.now()) + min * 60e3;
    try { await db.collection('hikes').doc(id).update({ dueAt: due, alertSent: false }); hikeChat(`⏱ ${h.place} 하산 예정 ${hm(due)}로 연장`); }
    catch (e) { famToast(e.message); }
}
function hikeCancel(id) { if (confirm('산행 등록을 취소할까요?')) db.collection('hikes').doc(id).update({ status: 'cancel' }).catch(e => famToast(e.message)); }
function hikeShareLoc(id) {
    const h = hikeList.find(x => x.id === id);
    if (!navigator.geolocation) { famToast('위치를 사용할 수 없습니다'); return; }
    famToast('위치 확인 중…');
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude.toFixed(5), lng = pos.coords.longitude.toFixed(5);
        db.collection('messages').add({ type: 'location', location: { lat, lng, label: `${h ? h.place : '산행'} 현재 위치` }, text: '', sender: famUser(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), isRead: false })
            .then(() => famToast('가족 채팅에 위치를 보냈습니다')).catch(e => famToast(e.message));
    }, () => famToast('위치를 가져오지 못했습니다. 위치 권한을 확인하세요.'), { enableHighAccuracy: true, timeout: 15000 });
}
function hikeChat(text) {
    if (!famUser()) return;
    db.collection('messages').add({ type: 'text', text, sender: famUser(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), isRead: false }).catch(() => {});
}
// 예정 시각 경과 확인 — 열려 있는 폰이 먼저 경고를 남김 (한 번만)
async function hikeCheck() {
    for (const h of hikeList) {
        const mine = h.by === famUser();
        if (mine && Date.now() > h.dueAt && !h._notified) { h._notified = 1; hikeNotify('⛰️ 하산 체크인', `${h.place} 하산 예정 시각(${hm(h.dueAt)})이 지났습니다. 내려왔으면 하산 완료를 눌러주세요.`); }
        if (!hikeOverdue(h)) continue;
        if (!mine && !h._notified) { h._notified = 1; hikeNotify(`⚠️ ${h.by} 하산 체크인 없음`, `${h.place} · 예정 ${hm(h.dueAt)} · 연락해 보세요`); }
        if (!h.alertSent) {
            try {
                const ref = db.collection('hikes').doc(h.id);
                const send = await db.runTransaction(async t => { const s = await t.get(ref); if (!s.exists || s.data().alertSent || s.data().status !== 'active') return false; t.update(ref, { alertSent: true }); return true; });
                if (send) db.collection('messages').add({ type: 'text', text: `⚠️ ${h.by} — ${h.place} 하산 예정 ${hm(h.dueAt)}이 지났는데 체크인이 없습니다.${h.note ? ' (' + h.note + ')' : ''}`, sender: '⛰️ 산행 알림', isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            } catch (e) {}
        }
    }
}
function hikeNotify(title, body) {
    try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) {}
    try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const opt = { body, tag: 'hike', renotify: true, requireInteraction: true, icon: '/sulyeon-family-/icon-192.png' };
        if (typeof swReg !== 'undefined' && swReg) swReg.showNotification(title, opt).catch(() => {}); else new Notification(title, opt);
    } catch (e) {}
}
// ── ⛰️ 산행 기록 (hikeLogs/{id}: place, by, date, mins, note, planId) ──
const hikeDur = m => m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ' ' + (m % 60) + '분' : ''}` : `${m}분`;
const hikeMt = place => (String(place || '').match(/[가-힣]{1,8}산/) || [String(place || '').split(/\s/)[0]])[0];
// 산림청 100대 명산 (서버 functions/agent.js 와 같은 목록) — 기록의 'OO산'과 맞춰 진행률 표시
const HIKE_M100 = '가리산 가리왕산 가야산 가지산 감악산 강천산 계룡산 계방산 공작산 관악산 구병산 금산 금수산 금오산 금정산 깃대봉 남산 내연산 내장산 대둔산 대암산 대야산 덕숭산 덕유산 덕항산 도락산 도봉산 두륜산 두타산 마니산 마이산 명성산 명지산 모악산 무등산 무학산 미륵산 민주지산 방장산 방태산 백덕산 백암산 백운산(광양) 백운산(포천) 백운산(정선) 변산 북한산 비슬산 삼악산 서대산 선운산 설악산 성인봉 소백산 소요산 속리산 신불산 연화산 오대산 오봉산 용문산 용화산 운문산 운악산 운장산 월악산 월출산 유명산 응봉산 장안산 재약산 적상산 점봉산 조계산 주왕산 주흘산 지리산 지리산(통영) 천관산 천마산 천성산 천태산 청량산 추월산 축령산 치악산 칠갑산 태백산 태화산 팔공산 팔봉산 팔영산 한라산 화악산 화왕산 황매산 황석산 황악산 황장산 희양산'.split(' ');
function hikeM100Done() { const been = new Set(hikeLogs.map(h => hikeMt(h.place))); return HIKE_M100.filter(m => been.has(m.replace(/\(.+\)/, ''))); }
function hikeM100Sheet() {
    const done = new Set(hikeM100Done());
    famSheet(`<div class="fam-h"><b>100대 명산 ${done.size}/100</b><button class="fam-x" onclick="hikeLogSheet()">✕</button></div>
        <div class="fam-note" style="margin:0 0 8px">산림청 선정 목록입니다. 산행 기록의 산 이름으로 자동 표시됩니다 (같은 이름의 백운산·지리산은 함께 표시).</div>
        <div class="hk-mts">${HIKE_M100.map(m => `<span style="${done.has(m) ? 'background:#059669;color:#fff' : 'opacity:.55'}">${famEsc(m)}</span>`).join('')}</div>`);
}
function hikeLogListen() { try { db.collection('hikeLogs').onSnapshot(s => { hikeLogs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date))); }, () => {}); } catch (e) {} }
async function hikeLogSave(o) { const id = 'hl_' + Date.now(); await db.collection('hikeLogs').doc(id).set({ id, ...o, at: Date.now() }); return id; }
function hikeLogSheet() {
    const y = String(new Date().getFullYear()), thisY = hikeLogs.filter(h => String(h.date).startsWith(y));
    const mts = {}; hikeLogs.forEach(h => { const k = hikeMt(h.place); mts[k] = (mts[k] || 0) + 1; });
    const mins = thisY.reduce((a, h) => a + (+h.mins || 0), 0);
    famSheet(`<div class="fam-h"><b>⛰️ 산행 기록</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="hk-stat"><div><b>${thisY.length}</b><span>${y}년 산행</span></div><div><b>${hikeDur(mins) || '0분'}</b><span>올해 걸은 시간</span></div><div><b>${Object.keys(mts).length}</b><span>다녀온 산</span></div><div onclick="hikeM100Sheet()" style="cursor:pointer"><b>${hikeM100Done().length}<small style="font-size:11px;color:#94a3b8">/100</small></b><span>100대 명산 ›</span></div></div>
        ${Object.keys(mts).length ? `<div class="hk-mts">${Object.entries(mts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span>${famEsc(k)}${n > 1 ? ` <b>${n}</b>` : ''}</span>`).join('')}</div>` : ''}
        <div class="fam-box" style="margin-top:10px">${hikeLogs.length ? hikeLogs.map(h => `<div class="fam-row"><span style="flex:none;width:72px;color:#94a3b8;font-size:11.5px">${famEsc(String(h.date).slice(2).replace(/-/g, '.'))}</span><span style="flex:1;min-width:0"><b>${famEsc(h.place)}</b><br><small style="color:#94a3b8">${famEsc(h.by || '')}${h.note ? ' · ' + famEsc(h.note) : ''}</small></span><b style="flex:none;font-size:12.5px">${hikeDur(+h.mins || 0)}</b><button class="fam-x" style="width:24px;height:24px;font-size:10px;flex:none" onclick="hikeLogDel('${h.id}')">✕</button></div>`).join('') : '<div class="fam-note">아직 기록이 없습니다. 하산 체크인을 완료하면 자동으로 남습니다.</div>'}</div>
        <div class="fam-btns"><button class="fam-btn" onclick="hikeLogForm()">＋ 지난 산행 추가</button><button class="fam-btn" onclick="agBriefNow('hike')">주말 산행 추천</button><button class="fam-btn pri" onclick="hikeForm()">⛰️ 산행 시작</button></div>`);
}
function hikeLogForm() {
    famSheet(`<div class="fam-h"><b>＋ 지난 산행 추가</b><button class="fam-x" onclick="hikeLogSheet()">✕</button></div>
        <div class="ff-form">
            <div class="full"><label>산 · 코스</label><input id="hl-place" placeholder="예: 속리산 문장대"></div>
            <div><label>날짜</label><input id="hl-date" type="date" value="${famYmd(new Date())}"></div>
            <div><label>걸린 시간 (시간)</label><input id="hl-hrs" type="number" inputmode="decimal" step="0.5" placeholder="4.5"></div>
            <div><label>누구</label>${famMemberSel('hl-by', famUser() || '정우설')}</div>
            <div><label>메모</label><input id="hl-note" placeholder="동행·코스"></div>
        </div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="hikeLogAdd(this)">저장</button></div>`);
}
async function hikeLogAdd(btn) {
    const v = k => (document.getElementById('hl-' + k) || {}).value || '', place = v('place').trim();
    if (!place) { famToast('산·코스를 입력하세요'); return; }
    btn.disabled = true;
    try { await hikeLogSave({ place, by: v('by'), date: v('date'), mins: Math.round((+v('hrs') || 0) * 60), note: v('note').trim(), planId: '' }); hikeLogSheet(); famToast('저장했습니다'); }
    catch (e) { btn.disabled = false; famToast(e.message); }
}
function hikeLogDel(id) { if (confirm('이 산행 기록을 지울까요?')) db.collection('hikeLogs').doc(id).delete().then(() => setTimeout(hikeLogSheet, 300)).catch(e => famToast(e.message)); }

function hikeBannerHtml() {
    return hikeList.map(h => {
        const mine = h.by === famUser(), late = Date.now() > h.dueAt, warn = hikeOverdue(h);
        return `<div class="hike-ban ${warn ? 'warn' : late ? 'late' : ''}">
            <div><b>⛰️ ${mine ? '' : famEsc(h.by) + ' · '}${famEsc(h.place)}</b><small>하산 예정 ${hm(h.dueAt)}${warn ? ' · 체크인 없음' : late ? ' · 예정 시각 지남' : ''}${h.note ? ' · ' + famEsc(h.note) : ''}</small></div>
            ${mine ? `<div class="trip-btns"><button class="fam-btn pri" onclick="hikeDone('${h.id}')">✅ 하산 완료</button><button class="fam-btn" onclick="hikeExtend('${h.id}',60)">+1시간</button><button class="fam-btn" onclick="hikeShareLoc('${h.id}')">📍 위치 보내기</button><button class="fam-btn" onclick="hikeCancel('${h.id}')">취소</button></div>`
                : `<div class="trip-btns"><button class="fam-btn" onclick="showSection('chat-section')">채팅 열기</button></div>`}
        </div>`;
    }).join('');
}
(function () {
    const hb = window.famHomeBanners;
    window.famHomeBanners = function () { hb.apply(this, arguments); const el = document.getElementById('fam-home-banners'); if (el && hikeList.length) el.insertAdjacentHTML('afterbegin', hikeBannerHtml()); };
    // 등산 계획 상세에 산행 시작 버튼
    const tr = window.tripRecordHtml;
    window.tripRecordHtml = function (p) {
        const today = famYmd(new Date()), on = p.subType === '등산' && p.start <= today && (p.end || p.start) >= today;
        const logs = p.subType === '등산' ? hikeLogs.filter(h => h.planId === p.id || (!h.planId && h.date >= p.start && h.date <= (p.end || p.start))) : [];
        return (on ? `<div class="trip-btns" style="margin-top:10px"><button class="fam-btn pri" onclick="closeTravelDetail();hikeForm()">⛰️ 산행 시작 · 하산 체크인</button></div>` : '')
            + (logs.length ? `<div class="trip-sec"><div class="trip-h">⛰️ 산행</div>${logs.map(h => `<div class="fam-row"><span style="flex:1">${famEsc(h.place)} <small style="color:#94a3b8">${famEsc(h.by || '')}</small></span><b>${hikeDur(+h.mins || 0)}</b></div>`).join('')}</div>` : '') + tr(p);
    };
    famAuthGate(() => setTimeout(() => { hikeListen(); hikeLogListen(); }, 900));
})();
