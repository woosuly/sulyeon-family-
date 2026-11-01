// ═══════════════════════════════════════════════════════════
// ⛰️ 하산 체크인
//   산행 시작 시 하산 예정 시각 등록 → 가족 채팅에 알림
//   예정 시각이 지나도 체크인이 없으면 두 폰 모두 경고 + 채팅에 경고 1회
//   hikes/{id}: by, place, note, startAt, dueAt(ms), status(active|done|cancel), alertSent
// ═══════════════════════════════════════════════════════════
let hikeList = [], hikeTimer = null;
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
        await db.collection('hikes').doc(id).set({ id, by: who, place, note, startAt: Date.now(), dueAt: d.getTime(), status: 'active', alertSent: false });
        hikeChat(`⛰️ ${place} 산행 시작 · 하산 예정 ${hm(d.getTime())}${note ? ' · ' + note : ''}`);
        famSheetClose(); famToast('산행을 등록했습니다. 내려오면 홈에서 하산 완료를 누르세요.');
    } catch (e) { btn.disabled = false; famToast('등록 실패: ' + e.message); }
}
async function hikeDone(id) {
    const h = hikeList.find(x => x.id === id); if (!h) return;
    try { await db.collection('hikes').doc(id).update({ status: 'done', doneAt: Date.now() }); hikeChat(`✅ ${h.place} 하산 완료 (${hm(Date.now())})`); famToast('하산 완료로 기록했습니다'); }
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
        return (on ? `<div class="trip-btns" style="margin-top:10px"><button class="fam-btn pri" onclick="closeTravelDetail();hikeForm()">⛰️ 산행 시작 · 하산 체크인</button></div>` : '') + tr(p);
    };
    famAuthGate(() => setTimeout(hikeListen, 900));
})();
