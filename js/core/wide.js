// ═══════════════════════════════════════════════════════════
// 🖥️ 넓은 화면 보조 — 고정 메뉴의 프로필·배지 표시, ☰ 메뉴 접기
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
// 넓은 화면에서 ☰ = 메뉴 접기/펴기 (기억함, 1280px 미만은 기본 접힘)
function wideNav() {
    let v = null; try { v = localStorage.getItem('navMini'); } catch (e) {}
    document.documentElement.classList.toggle('nav-mini', v === null ? window.innerWidth < 1280 : v === '1');
}
wideNav();
(function () {
    const td = window.toggleDrawer;
    window.toggleDrawer = function () {
        if (!wideMQ.matches) return td.apply(this, arguments);
        const on = !document.documentElement.classList.contains('nav-mini');
        document.documentElement.classList.toggle('nav-mini', on);
        try { localStorage.setItem('navMini', on ? '1' : '0'); } catch (e) {}
        setTimeout(() => { try { if (typeof mapObj !== 'undefined' && mapObj) mapObj.invalidateSize(); } catch (e) {} }, 250);
    };
    const ss = window.showSection;
    window.showSection = function (id, push) { const r = ss.apply(this, arguments); wideSync(); return r; };
    const ub = window.updateChatBadge;
    if (typeof ub === 'function') window.updateChatBadge = function () { const r = ub.apply(this, arguments); wideSync(); return r; };
    const onChange = () => {
        wideSync();
        try { if (document.getElementById('schedule-section').classList.contains('active')) renderSch(); } catch (e) {}
        if (!wideMQ.matches && typeof closeDrawer === 'function') closeDrawer();
    };
    try { wideMQ.addEventListener('change', onChange); } catch (e) { wideMQ.addListener(onChange); }
    window.addEventListener('load', () => setTimeout(() => { wideSync(); }, 1500));
})();
