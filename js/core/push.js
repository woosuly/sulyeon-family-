        // ══════════════════════════════════════════════════════
        // 푸시 알림 (FCM 토큰 방식)
        //  - 안드로이드 앱(설연 APK): Capacitor PushNotifications 로 토큰 등록, 표시는 앱이 직접
        //  - 브라우저: firebase messaging getToken, 표시는 sw.js push 이벤트
        //  - 토큰은 pushTokens/{fcm_해시} 에 {token: 사용자, fcm, native} 로 저장
        // ══════════════════════════════════════════════════════
        // 예전 web-push 공개키 (이 키로 만든 구독은 FCM과 맞지 않아 한 번 해제함)
        const OLD_VAPID_KEY = 'BDlXswc9xHJln8xnXJ_EBBtBAms9h2luzkBFHgP4ScfVsWA4cdQHF_Esa8Ng46eFO_aS2DlFRQJsP5Tv4RUCsbo';
        const APK_URL = 'https://github.com/woosuly/sulyeon-family-/releases/latest/download/seolyeon.apk';

        const famNative = () => !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
        const famPlug = n => famNative() && Capacitor.Plugins ? Capacitor.Plugins[n] : null;

        let swReg = null;
        let famNativeState = 'default';

        function famHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

        // 사용자 이름이 정해질 때까지 대기 (최대 30초)
        async function famWaitUser() {
            for (let i = 0; i < 30; i++) {
                const u = localStorage.getItem('chatUser');
                if (u && typeof db !== 'undefined') return u;
                await new Promise(r => setTimeout(r, 1000));
            }
            return null;
        }

        // 토큰 저장 (같은 폰은 같은 문서 → 사용자 바꾸면 덮어씀)
        async function famSaveToken(fcm, native) {
            if (!fcm) return;
            const user = await famWaitUser();
            if (!user) { console.warn('[Push] chatUser 없음, 토큰 저장 스킵'); return; }
            localStorage.setItem('famFcm', fcm);
            localStorage.setItem('famFcmNative', native ? '1' : '');
            await db.collection('pushTokens').doc('fcm_' + famHash(fcm)).set({
                token: user, fcm, native: !!native,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            window._famPushSub = true;   // 서버 푸시 사용 중 → 앱 자체 알림은 끔(중복 방지)
            console.log('[Push] 토큰 저장 완료:', user, native ? '(앱)' : '(웹)');
        }

        // 안드로이드 앱 등록
        async function famNativeRegister(ask) {
            const P = famPlug('PushNotifications');
            if (!P) return 'unsupported';
            try {
                let st = (await P.checkPermissions()).receive;
                if (st !== 'granted') {
                    if (!ask) { famNativeState = st === 'denied' ? 'denied' : 'default'; return famNativeState; }
                    st = (await P.requestPermissions()).receive;
                }
                famNativeState = st === 'granted' ? 'granted' : st === 'denied' ? 'denied' : 'default';
                if (famNativeState !== 'granted') return famNativeState;
                if (!famNativeRegister.bound) {
                    famNativeRegister.bound = true;
                    P.addListener('registration', t => famSaveToken(t.value, true).catch(e => console.warn('[Push] 저장', e)));
                    P.addListener('registrationError', e => console.warn('[Push] 등록 오류', e));
                }
                await P.register();
                return 'granted';
            } catch (e) { console.warn('[Push] 앱 등록', e); return 'error'; }
        }

        // 예전 web-push 구독이면 해제 (FCM이 새로 구독하도록)
        async function famDropOldSub(reg) {
            try {
                const sub = await reg.pushManager.getSubscription();
                const key = sub && sub.options && sub.options.applicationServerKey;
                if (!key) return;
                const b64 = btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                if (b64 === OLD_VAPID_KEY) { await sub.unsubscribe(); console.log('[Push] 예전 구독 해제'); }
            } catch (e) {}
        }

        // 브라우저 등록
        async function famWebRegister(ask) {
            if (!('Notification' in window) || !('serviceWorker' in navigator) || !firebase.messaging) return 'unsupported';
            try { if (!(await firebase.messaging.isSupported())) return 'unsupported'; } catch (e) { return 'unsupported'; }
            if (Notification.permission === 'default') {
                if (!ask) return 'default';
                const p = await Notification.requestPermission();
                if (p !== 'granted') return p;
            }
            if (Notification.permission !== 'granted') return Notification.permission;
            try {
                const reg = swReg || await navigator.serviceWorker.ready;
                await famDropOldSub(reg);
                const tok = await firebase.messaging().getToken({ serviceWorkerRegistration: reg });
                await famSaveToken(tok, false);
                return 'granted';
            } catch (e) { console.warn('[Push] 웹 등록', e); return 'error'; }
        }

        // ask=true 일 때만 권한 창을 띄움 ('알림 켜기' 버튼)
        function famPushRegister(ask) { return famNative() ? famNativeRegister(ask) : famWebRegister(ask); }

        // 현재 상태: granted · denied · default · unsupported
        async function famPushState() {
            if (famNative()) {
                const P = famPlug('PushNotifications');
                if (!P) return 'unsupported';
                try { const st = (await P.checkPermissions()).receive; return st === 'granted' ? 'granted' : st === 'denied' ? 'denied' : 'default'; } catch (e) { return 'default'; }
            }
            if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
            return Notification.permission;
        }

        async function initSW() {
            if ('serviceWorker' in navigator) {
                try {
                    swReg = await navigator.serviceWorker.register('/sulyeon-family-/sw.js', { scope: '/sulyeon-family-/' });
                    console.log('[SW] 등록 성공');
                } catch (e) { console.warn('[SW] 오류:', e); }
            }
            // 권한이 이미 있으면 조용히 토큰 갱신 (권한 요청은 하지 않음)
            const r = await famPushRegister(false);
            console.log('[Push] 상태:', r);
            if (famNative()) famNativeBoot();
        }

        // 프로필 선택 후 토큰의 사용자 갱신 (chatUser 변경 시)
        async function reRegisterPush() {
            const fcm = localStorage.getItem('famFcm');
            if (fcm) famSaveToken(fcm, !!localStorage.getItem('famFcmNative')).catch(() => {});
        }

        // Firebase 초기화 후 등록 (defer)
        window.addEventListener('load', () => setTimeout(initSW, 2000));

        // ── 알림 켜기 배너: 이 기기에 알림이 등록되지 않았을 때만 표시 ──
        async function famPushBanner() {
            if (document.getElementById('fam-push-banner')) return;
            const st = await famPushState();
            if (st === 'unsupported') return;
            if (st === 'granted' && localStorage.getItem('famFcm')) return;
            const b = document.createElement('div');
            b.id = 'fam-push-banner';
            b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;z-index:9999;background:#2b3a55;color:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.2)';
            b.innerHTML = '<span id="fam-push-msg" style="flex:1">이 기기의 채팅 알림이 꺼져 있습니다</span>'
                + '<button id="fam-push-on" style="background:#fff;color:#2b3a55;border:0;border-radius:8px;padding:7px 12px;font-weight:700">알림 켜기</button>'
                + '<button id="fam-push-x" style="background:none;color:#fff;border:0;font-size:16px;padding:4px">✕</button>';
            document.body.appendChild(b);
            const msg = document.getElementById('fam-push-msg');
            document.getElementById('fam-push-x').onclick = () => b.remove();
            document.getElementById('fam-push-on').onclick = async () => {
                if (!localStorage.getItem('chatUser')) { msg.textContent = '채팅에서 사용자를 먼저 선택해 주세요'; return; }
                msg.textContent = '등록 중…';
                const r = await famPushRegister(true);
                if (r !== 'granted') {
                    msg.textContent = r === 'denied'
                        ? (famNative() ? '알림이 차단됨 → 휴대폰 설정 > 애플리케이션 > 설연에서 알림 허용' : '브라우저에서 알림이 차단됨 → 사이트 권한에서 허용 필요')
                        : r === 'default' ? '권한 요청이 막힘 → 설정에서 알림 허용 필요' : '알림 등록 실패';
                    return;
                }
                // 앱은 토큰이 비동기로 오므로 잠시 기다림
                for (let i = 0; i < 10 && !localStorage.getItem('famFcm'); i++) await new Promise(r2 => setTimeout(r2, 500));
                msg.textContent = localStorage.getItem('famFcm') ? '알림 등록 완료' : '등록 대기 중 (잠시 후 다시 확인)';
                if (localStorage.getItem('famFcm')) setTimeout(() => b.remove(), 2500);
            };
        }
        window.addEventListener('load', () => setTimeout(famPushBanner, 6000));

        // ── 안드로이드 앱: 알림 눌러 열기, 새 버전 안내 ──
        let famNativeBooted = false;
        function famNativeBoot() {
            const N = famPlug('SeolyeonNative');
            if (!N || famNativeBooted) return;
            famNativeBooted = true;
            const go = r => { if (r && r.k === 'chat' && typeof showSection === 'function') showSection('chat-section'); };
            N.takeLaunchPush().then(go).catch(() => {});
            N.addListener('pushOpen', go);
            famBackBind();
            famApkUpdateCheck();
        }
        // 안드로이드 뒤로가기 버튼 → 웹의 뒤로가기(popstate) 처리와 연결
        //  열린 창·하위 화면이 있으면 하나 닫고, 홈이면 앱을 백그라운드로
        function famBackBind() {
            const A = famPlug('App');
            if (!A || famBackBind.done) return;
            famBackBind.done = true;
            let waiting = false;
            window.addEventListener('popstate', () => { waiting = false; });
            const overlayOpen = () => ['fam-av-zoom', 'fam-sheet', 'map-ov', 'tk-big', 'fam-settings', 'tk-face', 'master-modal', 'gemini-window', 'profile-modal']
                .some(id => { const el = document.getElementById(id); return el && el.style.display === 'flex'; })
                || ['sch-detail-modal', 'sch-action-sheet', 'travel-detail-modal', 'asset-day-modal'].some(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); })
                || (() => { const lb = document.getElementById('lightbox'); return lb && lb.style.display && lb.style.display !== 'none'; })()
                || (() => { const ep = document.getElementById('chat-emoji-panel'); return ep && ep.style.display !== 'none'; })()
                || (() => { const pd = document.getElementById('photo-detail-view'); return pd && !pd.classList.contains('hidden'); })();
            const atHome = () => { const m = document.getElementById('main-section'); return m && m.classList.contains('active'); };
            A.addListener('backButton', () => {
                if (!overlayOpen() && atHome()) { A.minimizeApp(); return; }
                waiting = true;
                history.back();
                // 웹 기록이 없어 아무 일도 안 일어나면 직접 처리 (창 닫기 → 홈)
                setTimeout(() => { if (waiting) { waiting = false; window.dispatchEvent(new PopStateEvent('popstate', { state: { section: 'main-section' } })); } }, 250);
            });
        }
        async function famApkUpdateCheck() {
            try {
                const A = famPlug('App');
                if (!A) return;
                const last = +localStorage.getItem('famApkAsk') || 0;
                if (Date.now() - last < 864e5) return;
                const [info, rel] = await Promise.all([A.getInfo(), fetch('https://api.github.com/repos/woosuly/sulyeon-family-/releases/latest').then(r => r.json())]);
                const latest = +String(rel.tag_name || '').replace(/^v1\./, '') || 0, cur = +info.build || 0;
                if (!latest || latest <= cur) return;
                localStorage.setItem('famApkAsk', Date.now());
                if (confirm('설연 앱 새 버전이 있습니다. 설치 파일을 받을까요?\n(덮어 설치하면 됩니다. 데이터는 그대로 남습니다)')) location.href = APK_URL;
            } catch (e) {}
        }

        // ── 알림 표시 테스트: 주소 끝에 ?notiftest=1 → 8초 뒤 이 폰에서 직접 알림 (서버 미경유) ──
        if (new URLSearchParams(location.search).get('notiftest') === '1') {
            window.addEventListener('load', async () => {
                if (famNative()) {   // 안드로이드 앱: 앱이 직접 띄우는 알림으로 시험
                    alert('확인 후 8초 안에 홈 화면으로 나가세요.');
                    setTimeout(() => { const N = famPlug('SeolyeonNative'); if (N) N.testNotify().catch(() => {}); }, 8000);
                    return;
                }
                const reg = await navigator.serviceWorker.getRegistration('/sulyeon-family-/');
                const perm = ('Notification' in window) ? Notification.permission : '미지원';
                alert('권한: ' + perm + ' / SW: ' + (reg ? '있음' : '없음') + '\n확인 후 8초 안에 홈 화면으로 나가세요.');
                setTimeout(() => {
                    if (reg && perm === 'granted') reg.showNotification('💬 알림 테스트', {
                        body: '이 알림이 화면 위로 떴나요?', tag: 'chat-test-' + Date.now(),
                        icon: '/sulyeon-family-/icon-192.png', vibrate: [200, 100, 200]
                    });
                }, 8000);
            });
        }

        // ── 채팅 알림 클릭 → 채팅창 열기 ──
        // 앱이 떠 있을 때: SW가 OPEN_CHAT 메시지 전달
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', e => {
                if (e.data && e.data.type === 'OPEN_CHAT' && typeof showSection === 'function') showSection('chat-section');
            });
        }
        // 앱이 꺼져 있을 때: ?open=chat 으로 실행됨
        if (new URLSearchParams(location.search).get('open') === 'chat') {
            window.addEventListener('load', () => setTimeout(() => {
                history.replaceState({ section: 'main-section' }, '', location.pathname);
                if (typeof showSection === 'function') showSection('chat-section');
            }, 1500));
        }

        // ── 앱 아이콘 뱃지 (App Badging API) ──
        function setAppBadge(count) {
            if ('setAppBadge' in navigator) {
                if (count > 0) {
                    navigator.setAppBadge(count).catch(() => {});
                } else {
                    navigator.clearAppBadge().catch(() => {});
                }
            }
        }
