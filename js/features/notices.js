// ═══════════════════════════════════════════════════════════
// 🏠 홈 알림 — ④ 기념일(매년 반복 일정) ⑤ 그날의 기록(몇 년 전 오늘의 여행)
//   기념일: 7일 이내면 홈 배너, 7일 전·당일에는 가족 채팅에 1번 알림 (notices/{key}로 중복 방지)
// ═══════════════════════════════════════════════════════════
const annIcon = m => /생일|생신|탄생/.test(m || '') ? '🎂' : /결혼|기념/.test(m || '') ? '💐' : /제사|기일|추모/.test(m || '') ? '🕯️' : '📅';
function annDays(ds) { return Math.round((new Date(ds + 'T00:00:00') - new Date(famYmd(new Date()) + 'T00:00:00')) / 864e5); }
function annUpcoming() {
    const t = famYmd(new Date()), e = new Date(); e.setDate(e.getDate() + 7); const end = famYmd(e);
    return (typeof schData !== 'undefined' ? schData : []).filter(s => s.repeat && s.repeat.unit === 'year' && s.date >= t && s.date <= end).sort((a, b) => a.date.localeCompare(b.date));
}
function memToday() {
    const now = new Date(), out = [];
    for (let k = 1; k <= 10; k++) {
        const d = new Date(now); d.setFullYear(now.getFullYear() - k); const ds = famYmd(d);
        (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && p.start <= ds && (p.end || p.start) >= ds).forEach(p => {
            const f = typeof tripFolder === 'function' ? tripFolder(p) : null, ph = f ? (f.photos || []) : [];
            if (ph.length || (p.recap && p.recap.text)) out.push({ k, p, photo: ph.length ? ph[(now.getDate() + k) % ph.length] : '' });
        });
    }
    return out.slice(0, 1);
}
function noticesRender() {
    const el = document.getElementById('home-notices'); if (!el) return;
    const anns = annUpcoming().slice(0, 2), mem = memToday()[0];
    el.innerHTML = anns.map(s => { const d = annDays(s.date); return `<div class="home-banner ann ${d === 0 ? 'today' : ''}" onclick="famGoSch('${s.date}')"><span>${annIcon(s.memo)}</span><b>${famEsc(s.memo || '')}</b><span class="ann-d">${d === 0 ? '오늘' : 'D-' + d}</span></div>`; }).join('')
        + (mem ? `<div class="home-banner mem" onclick="famGoPlan('${famEsc(mem.p.id)}')">${mem.photo ? `<img src="${famEsc(mem.photo)}" alt="">` : '<span>📸</span>'}<div><small>${mem.k}년 전 오늘</small><b>${getTypeIcon(mem.p.subType)} ${famEsc(mem.p.loc || mem.p.subType || '')}</b></div><span style="color:#94a3b8">›</span></div>` : '');
}
// 7일 전·당일 채팅 알림 (두 폰 중 먼저 연 쪽이 1번만 보냄)
async function noticesChat() {
    if (!famUser()) return;
    for (const s of annUpcoming()) {
        const d = annDays(s.date); if (d !== 0 && d !== 7) continue;
        const ref = db.collection('notices').doc(`ann_${s.id}_${d}`);
        try {
            const send = await db.runTransaction(async t => { const x = await t.get(ref); if (x.exists) return false; t.set(ref, { at: Date.now(), by: famUser() }); return true; });
            if (send) db.collection('messages').add({ type: 'text', text: `${annIcon(s.memo)} ${s.memo} ${d === 0 ? '오늘입니다' : '일주일 남았습니다 (' + s.date.slice(5).replace('-', '/') + ')'}`, sender: '📅 기념일 알림', isRead: false, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        } catch (e) {}
    }
}
(function () {
    const ht = window.famHomeToday;
    window.famHomeToday = function () { const r = ht.apply(this, arguments); try { noticesRender(); } catch (e) {} return r; };
    let last = '';
    const daily = () => { const t = famYmd(new Date()); if (t === last) return; last = t; noticesChat(); };
    famAuthGate(() => setTimeout(daily, 12000));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { daily(); noticesRender(); } });
})();
