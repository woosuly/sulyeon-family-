// ═══════════════════════════════════════════════════════════
// 🖥️ 넓은 화면 보조 — 고정 메뉴의 프로필·배지 표시, 홈 오른쪽 패널(다가오는 일정·여행)
// ═══════════════════════════════════════════════════════════
const wideMQ = window.matchMedia('(min-width:1024px)');
function wideSync() {
    if (!wideMQ.matches) return;
    const nm = document.getElementById('drw-name'), pn = document.getElementById('header-profile-name');
    if (nm && pn && pn.textContent) nm.textContent = pn.textContent;
    const bs = document.getElementById('chat-unread-badge'), bd = document.getElementById('drw-badge');
    if (bs && bd) { const on = bs.style.display !== 'none' && bs.textContent; bd.textContent = on ? bs.textContent : ''; bd.style.display = on ? 'inline-block' : 'none'; }
    if (typeof famAvatarApply === 'function') try { famAvatarApply(); } catch (e) {}
}
function wideSide() {
    const el = document.getElementById('home-side-more'); if (!el || !wideMQ.matches) return;
    const t = famYmd(new Date()), e7 = new Date(); e7.setDate(e7.getDate() + 7); const end = famYmd(e7), dow = ds => '일월화수목금토'[new Date(ds + 'T00:00:00').getDay()];
    const sch = (typeof schData !== 'undefined' ? schData : []).filter(x => x.date >= t && x.date <= end && (typeof schShow !== 'function' || schShow(x)))
        .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || ''))).slice(0, 10);
    const trips = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && (p.end || p.start) >= t).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
    const dd = s => { const n = Math.round((new Date(s + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5); return n > 0 ? 'D-' + n : '진행 중'; };
    el.innerHTML = `<div class="side-box"><h5>📅 7일 이내 일정</h5>${sch.map(x => `<div class="side-row" onclick="famGoSch('${x.date}')"><small>${x.date.slice(5).replace('-', '/')}(${dow(x.date)})</small><span>${x.priority === '중요' ? '⭐ ' : ''}${famEsc(x.memo || '')}</span><b>${x.startTime || ''}</b></div>`).join('') || '<div class="fam-note" style="margin:0">일정이 없습니다</div>'}</div>
        <div class="side-box"><h5>✈️ 다가오는 여행·여가</h5>${trips.map(p => `<div class="side-row" onclick="famGoPlan('${famEsc(p.id)}')"><small>${p.start.slice(5).replace('-', '/')}</small><span>${getTypeIcon(p.subType)} ${famEsc(p.loc || '미정')}</span><b>${dd(p.start)}</b></div>`).join('') || '<div class="fam-note" style="margin:0">계획이 없습니다</div>'}</div>`;
}
(function () {
    const ht = window.famHomeToday;
    window.famHomeToday = function () { const r = ht.apply(this, arguments); try { wideSide(); } catch (e) {} return r; };
    const ss = window.showSection;
    window.showSection = function (id, push) { const r = ss.apply(this, arguments); wideSync(); return r; };
    const ub = window.updateChatBadge;
    if (typeof ub === 'function') window.updateChatBadge = function () { const r = ub.apply(this, arguments); wideSync(); return r; };
    const onChange = () => {
        wideSync(); wideSide();
        try { if (document.getElementById('schedule-section').classList.contains('active')) renderSch(); } catch (e) {}
        if (!wideMQ.matches && typeof closeDrawer === 'function') closeDrawer();
    };
    try { wideMQ.addEventListener('change', onChange); } catch (e) { wideMQ.addListener(onChange); }
    window.addEventListener('load', () => setTimeout(() => { wideSync(); wideSide(); }, 1500));
})();
