    // ═══════════════════════════════════════════════════════════
    // 공용 유틸
    // ═══════════════════════════════════════════════════════════
    const famYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const famUser = () => { try { return (typeof chatUser !== 'undefined' && chatUser) || localStorage.getItem('chatUser') || ''; } catch (e) { return ''; } };
    const EXP_CATS = ['생활비', '의료비', '쇼핑', '식사', '교통비', '여가', '여행비', '가족', '기타지출'];
    const INC_CATS = ['급여', '상여', '주식', '기타수입'];
    function famSheet(html) { const o = document.getElementById('fam-sheet'); document.getElementById('fam-sheet-body').innerHTML = html; if (o.style.display !== 'flex') history.pushState({ famSheet: 1 }, '', ''); o.style.display = 'flex'; }
    function famSheetClose() { document.getElementById('fam-sheet').style.display = 'none'; }

    // ═══════════════════════════════════════════════════════════
    // 🔐 Google 로그인 (Firestore 보안 규칙용)
    // ═══════════════════════════════════════════════════════════
    const famAuthQ = []; let famAuthUser = null, famAuthInit = false;
    function famAuthGate(cb) {
        if (!(window.firebase && firebase.auth)) { cb(); return; }
        if (famAuthUser) { cb(); return; }
        famAuthQ.push(cb);
        if (famAuthInit) return; famAuthInit = true;
        const a = firebase.auth();
        a.getRedirectResult().catch(e => famLoginMsg(famAuthErr(e)));
        a.onAuthStateChanged(u => {
            if (u) { famAuthUser = u; famLoginHide(); while (famAuthQ.length) { try { famAuthQ.shift()(); } catch (e) { console.warn(e); } } }
            else { famAuthUser = null; famLoginShow(); }
        });
    }
    function famAuthErr(e) {
        const c = (e && e.code) || '';
        if (c === 'auth/operation-not-allowed') return 'Firebase 콘솔에서 Google 로그인이 아직 켜져 있지 않습니다.';
        if (c === 'auth/unauthorized-domain') return '이 주소가 Firebase 승인 도메인에 없습니다.';
        if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
        return (e && e.message) || String(e);
    }
    function famLoginShow() {
        let o = document.getElementById('fam-login');
        if (!o) {
            o = document.createElement('div'); o.id = 'fam-login';
            o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--month-bg,#f8fafc);display:flex;align-items:center;justify-content:center;padding:24px';
            o.innerHTML = `<div style="text-align:center;max-width:320px;width:100%">
                <img src="icon-192.png" style="width:84px;height:84px;border-radius:22px;box-shadow:0 8px 24px rgba(0,0,0,.12)" onerror="this.style.display='none'">
                <div style="font-size:22px;font-weight:800;color:#1e293b;margin:16px 0 4px">설연 Family</div>
                <div style="font-size:13px;color:#64748b;margin-bottom:22px">가족 계정으로 로그인하세요</div>
                <button onclick="famLogin()" style="width:100%;padding:13px;border-radius:14px;border:1.5px solid #e2e8f0;background:#fff;font-size:15px;font-weight:700;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;font-family:inherit"><span style="font-weight:900;color:#4285f4">G</span> Google로 로그인</button>
                <div id="fam-login-msg" style="font-size:12px;color:#dc2626;margin-top:12px;min-height:16px"></div></div>`;
            document.body.appendChild(o);
        }
        o.style.display = 'flex';
    }
    function famLoginHide() { const o = document.getElementById('fam-login'); if (o) o.style.display = 'none'; }
    function famLoginMsg(t) { const m = document.getElementById('fam-login-msg'); if (m && t) m.textContent = t; }
    async function famLogin() {
        const a = firebase.auth(), pv = new firebase.auth.GoogleAuthProvider(); pv.setCustomParameters({ prompt: 'select_account' });
        try { await a.signInWithPopup(pv); }
        catch (e) {
            if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(e.code || '')) { try { await a.signInWithRedirect(pv); } catch (e2) { famLoginMsg(famAuthErr(e2)); } }
            else famLoginMsg(famAuthErr(e));
        }
    }
    function famLogout() { if (confirm('로그아웃할까요?')) firebase.auth().signOut().then(() => location.reload()); }

    // ═══════════════════════════════════════════════════════════
    // 🔄 새 버전 알림
    // ═══════════════════════════════════════════════════════════
    const FAM_VER = (document.querySelector('.footer-info')?.textContent.match(/v([\d.]+)/) || [])[1] || '';
    let famVerLast = 0;
    async function famVerCheck() {
        if (!FAM_VER || Date.now() - famVerLast < 10 * 60e3) return; famVerLast = Date.now();
        try {
            const r = await fetch(location.pathname + '?vc=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
            const v = ((await r.text()).match(/Family Shared v([\d.]+)/) || [])[1];
            if (v && v !== FAM_VER) famVerShow(v);
        } catch (e) {}
    }
    function famVerShow(v) {
        if (document.getElementById('fam-ver')) return;
        const d = document.createElement('div'); d.id = 'fam-ver';
        d.style.cssText = 'position:fixed;top:calc(64px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:9800;background:#1e293b;color:#fff;border-radius:14px;padding:9px 10px 9px 14px;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:92vw';
        d.innerHTML = `<span style="white-space:nowrap">새 버전 v${famEsc(v)}이 있습니다</span><button onclick="famVerApply()" style="white-space:nowrap;border:none;background:#fff;color:#1e293b;border-radius:10px;padding:6px 10px;font-weight:800;font-size:12px;cursor:pointer">새로고침</button><button onclick="this.parentNode.remove()" style="border:none;background:none;color:#94a3b8;font-size:14px;cursor:pointer">✕</button>`;
        document.body.appendChild(d);
    }
    async function famVerApply() {
        try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
        try { const rs = await navigator.serviceWorker?.getRegistrations?.(); if (rs) for (const r of rs) await r.update(); } catch (e) {}
        location.replace(location.pathname + '?r=' + Date.now());
    }
    setTimeout(famVerCheck, 5000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') famVerCheck(); });

