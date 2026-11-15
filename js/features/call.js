// ═══════════════════════════════════════════════════════════
// 📞 말로 전화 걸기: "와이프한테 전화해 줘", "장모님께 전화 연결해 줘"
//   폰 연락처에서 이름으로 찾음 (와이프·아내·여보 → wife·한미연 등 저장명 후보) + '가족 챙기기' 연락처
//   한 사람이면 2초 뒤 바로 걸기([취소] 가능), 여러 명이면 고르기
//   바로 걸기 권한을 허용하지 않으면 전화 앱에 번호만 넣어 엶 (통화 버튼은 직접)
// ═══════════════════════════════════════════════════════════
const callN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
let callTimer = null;

function callNames(who) {
    const w = String(who || '').trim(), me = famUser();
    if (/^(와이프|아내|집사람|마누라|부인|여보|자기|wife|미연|한미연)$/i.test(w) && me === '정우설') return ['wife', '와이프', '한미연', '미연', '아내', '여보', '♥'];
    if (/^(남편|신랑|여보|자기|husband|우설|정우설)$/i.test(w) && me === '한미연') return ['husband', '남편', '정우설', '우설', '신랑', '여보', '♥'];
    const bare = w.replace(/(님|씨)$/, '');
    return [...new Set([w, bare])].filter(Boolean);
}
// "와이프한테 전화해 줘" → "와이프"
function callWho(t) {
    const m = String(t).replace(/^\s*((헬로|하이|hello|hi|헤이|hey)\s*)?(설연|설현)(아|야)?[\s,]*/i, '').match(/^(.{1,15}?)\s*(에게|한테|께|에|랑|이랑|하고)?\s*(전화|통화)/);
    return m ? m[1].replace(/^(지금|빨리|좀)\s*/, '').trim() : '';
}
async function callPerson(who) {
    const N = callN();
    if (!N || !N.findContact) { famFeedAdd('📞 말로 전화 걸기는 휴대폰 설연 앱(1.39 이상)에서 됩니다.'); return { ok: false, reason: 'not-app' }; }
    const names = callNames(who);
    let items = [];
    try { items = (await N.findContact({ names })).items || []; } catch (e) { famFeedAdd('📞 연락처를 보려면 연락처 권한을 허용해 주세요.'); return { ok: false, reason: 'no-permission' }; }
    // 가족 챙기기에 적어 둔 번호도 후보로
    try { (typeof fmCare !== 'undefined' ? fmCare : []).filter(c => c.phone && names.some(n => String(c.name + ' ' + (c.rel || '')).includes(n))).forEach(c => items.push({ name: c.name, number: c.phone, q: '' })); } catch (e) {}
    // 같은 번호는 하나로, 먼저 찾은 이름 후보 순서대로
    const seen = new Set(); items = items.filter(x => { const k = String(x.number).replace(/\D/g, '').slice(-8); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    items.sort((a, b) => (names.indexOf(a.q) + 99) % 99 - (names.indexOf(b.q) + 99) % 99);
    if (!items.length) { famFeedAdd(`📞 연락처에서 <b>${famEsc(who)}</b>를 찾지 못했습니다. 연락처에 저장된 이름으로 말씀해 주세요.`); return { ok: false, reason: 'not-found' }; }
    const mask = n => { const d = String(n).replace(/\D/g, ''); return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : n; };
    if (items.length === 1 || names[0] === 'wife' || names[0] === 'husband') {
        const x = items[0], id = 'call' + Date.now();
        famFeedAdd(`<div id="${id}">📞 <b>${famEsc(x.name)}</b> (${mask(x.number)})에게 전화를 겁니다… <button class="fam-btn" onclick="callCancel('${id}')">취소</button></div>`);
        clearTimeout(callTimer);
        callTimer = setTimeout(() => callDial(x.number, id), 2000);
        return { ok: true, calling: x.name };
    }
    famFeedAdd(`<h5>📞 누구에게 걸까요?</h5>${items.slice(0, 6).map(x => `<div class="ag-li"><b>${famEsc(x.name)}</b><span>${mask(x.number)}</span><button class="fam-btn pri" onclick="callDial('${famEsc(x.number)}')">걸기</button></div>`).join('')}`);
    return { ok: true, choose: items.length };
}
function callCancel(id) { clearTimeout(callTimer); callTimer = null; const el = document.getElementById(id); if (el) el.innerHTML = '📞 전화를 취소했습니다.'; }
async function callDial(number, id) {
    callTimer = null;
    const N = callN(); if (!N) return;
    try { const r = await N.callNumber({ number }); if (r && r.direct === false) famToast('전화 앱을 열었습니다. 통화 버튼을 눌러 주세요'); }
    catch (e) { if (N.dial) N.dial({ number }); }
    const el = id && document.getElementById(id); if (el) el.querySelectorAll('button').forEach(b => b.remove());
}
// 홈 입력: '전화해 줘·전화 걸어 줘·전화 연결' (단, '전화하라고 알려줘' 같은 알림 요청은 제외)
famRoute('전화', 15, t => {
    if (!/(전화|통화)\s*(좀\s*)?(해\s*줘|해줘|걸어|연결|부탁|해\s*주세요|하자|할래)/.test(t) || /(알려|알림|리마인드|라고|기억)/.test(t)) return false;
    const who = callWho(t); if (!who) return false;
    callPerson(who); return true;
});
