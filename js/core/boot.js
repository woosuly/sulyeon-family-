    // ═══════════════════════════════════════════════════════════
    // 연결 · 초기화
    // ═══════════════════════════════════════════════════════════
    (function () {
        const origSend = window.sendChatMessage;
        if (typeof origSend === 'function') {
            window.sendChatMessage = async function () {
                const ta = document.getElementById('chat-input'), text = (ta && ta.value || '').trim();
                const box = document.getElementById('fam-mention'); if (box) box.style.display = 'none';
                famTypingStop();
                const r = await origSend.apply(this, arguments);
                if (text && famMentionProvider(text) && !(typeof chatEditId !== 'undefined' && chatEditId)) famChatAI(text);
                return r;
            };
        }
        const prevShow = window.showSection;
        window.showSection = function (id, push) {
            prevShow(id, push);
            if (id === 'main-section') { famHomeToday(); famFeedHello(); }
            if (id === 'save-section') { const de = document.getElementById('di-save'); if (de) de.classList.add('active'); svRender(); }
            if (id === 'asset-section') budgetRender();
            if (id === 'shop-section') { const de = document.getElementById('di-shop'); if (de) de.classList.add('active'); famShopGrid(); famShopRender(); }
            if (id === 'asset-analysis-section') { if (!rpt.ym) rptWatch(rptPrevYM(1)); else rptRender(); }
            { const mb = document.getElementById('fam-mention'); if (mb) mb.style.display = 'none'; }
            if (id !== 'main-section') { famFeedClose(); const s = document.getElementById('home-sugg'); if (s) s.style.display = 'none'; }
            if (id !== 'chat-section') famTypingStop(); else famTypingRender();
        };
        document.addEventListener('input', e => { if (e.target && e.target.id === 'chat-input') { famMentionCheck(); famTypingPing(); } });
        document.addEventListener('focusout', e => { if (e.target && e.target.id === 'chat-input') famTypingStop(); });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') famTypingStop(); });
        window.addEventListener('resize', () => { const b = document.getElementById('fam-mention'); if (b && b.style.display === 'block') famMentionCheck(); });
        // 드로어 열 때 프로필 사진 반영
        const _od = window.openDrawer; if (typeof _od === 'function') window.openDrawer = function () { _od.apply(this, arguments); famAvatarApply(); };
        document.addEventListener('click', e => { const b = document.getElementById('fam-mention'); if (b && b.style.display === 'block' && !e.target.closest('#fam-mention') && e.target.id !== 'chat-input') b.style.display = 'none'; });
        const _rmd = window.renderMainDashboard;
        if (typeof _rmd === 'function') window.renderMainDashboard = function () { const r = _rmd.apply(this, arguments); famHomeToday(); return r; };
        famFeedWatch(); famFeedHello(); famMicSwap();
        const boot = () => { famShopListen(); fxListen(); svListen(); budgetListen(); famHomeReportWatch(); setTimeout(fxRun, 6000); setInterval(fxRun, 30 * 60e3); famShopGrid(); setTimeout(famShareIn, 1200); famPhotosListen(); famTypingListen(); };
        if (typeof db !== 'undefined') famAuthGate(() => setTimeout(boot, 800));
    })();
