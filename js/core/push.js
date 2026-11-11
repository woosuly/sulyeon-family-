        // ── VAPID 공개키 (Base64url) ──
        const VAPID_PUBLIC_KEY = 'BDlXswc9xHJln8xnXJ_EBBtBAms9h2luzkBFHgP4ScfVsWA4cdQHF_Esa8Ng46eFO_aS2DlFRQJsP5Tv4RUCsbo';

        function urlBase64ToUint8Array(base64String) {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
            const raw     = atob(base64);
            return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
        }

        let swReg = null;

        async function initSW() {
            if (!('serviceWorker' in navigator)) return;
            try {
                swReg = await navigator.serviceWorker.register('/sulyeon-family-/sw.js', { scope: '/sulyeon-family-/' });
                console.log('[SW] 등록 성공');

                // 알림 권한 확인만 (요청은 '알림 켜기' 버튼에서만 → 자동 요청 반복으로 브라우저가 차단하는 문제 방지)
                const perm = Notification.permission;
                console.log('[알림] 권한:', perm);
                if (perm !== 'granted') return;

                // Push 구독
                let sub = await swReg.pushManager.getSubscription();
                if (!sub) {
                    sub = await swReg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                    });
                }
                window._famPushSub = !!sub;   // 서버 푸시 사용 중 → 앱 자체 알림은 끔(중복 방지)
                // chatUser 있을 때까지 대기 (최대 30초)
                let token = localStorage.getItem('chatUser');
                let tries = 0;
                while (!token && tries < 30) {
                    await new Promise(r => setTimeout(r, 1000));
                    token = localStorage.getItem('chatUser');
                    tries++;
                }
                if (!token) { console.warn('[Push] chatUser 없음, 구독 저장 스킵'); return; }

                const subKey = 'push_' + token + '_' + btoa(sub.endpoint).slice(-16).replace(/[^a-zA-Z0-9]/g,'');
                if (typeof db !== 'undefined') {
                    await db.collection('pushTokens').doc(subKey).set({
                        token, endpoint: sub.endpoint,
                        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
                        auth:   btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    console.log('[Push] 구독 저장 완료:', token);
                }
            } catch(e) {
                console.warn('[SW] 오류:', e);
            }
        }

        // 프로필 선택 후 Push 재등록 (chatUser 변경 시)
        async function reRegisterPush() {
            if (!swReg) return;
            try {
                const sub = await swReg.pushManager.getSubscription();
                if (!sub) return;
                const token = localStorage.getItem('chatUser');
                if (!token) return;
                const subKey = 'push_' + token + '_' + btoa(sub.endpoint).slice(-16).replace(/[^a-zA-Z0-9]/g,'');
                await db.collection('pushTokens').doc(subKey).set({
                    token, endpoint: sub.endpoint,
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
                    auth:   btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('[Push] 재등록 완료:', token);
            } catch(e) { console.warn('[Push 재등록]', e); }
        }

        // Firebase 초기화 후 SW 등록 (defer)
        window.addEventListener('load', () => setTimeout(initSW, 2000));

        // ── 알림 켜기 배너: 이 기기에 권한/구독이 없을 때만 표시 ──
        // 버튼 탭(사용자 동작)으로 권한 요청 → 브라우저가 팝업을 막지 않음
        async function famPushBanner() {
            if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
            if (document.getElementById('fam-push-banner')) return;
            const reg = await navigator.serviceWorker.getRegistration('/sulyeon-family-/');
            const sub = reg && await reg.pushManager.getSubscription();
            if (Notification.permission === 'granted' && sub) return;
            const b = document.createElement('div');
            b.id = 'fam-push-banner';
            b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;z-index:9999;background:#3a6a96;color:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;font-size:14px;box-shadow:0 4px 14px rgba(0,0,0,.2)';
            b.innerHTML = '<span id="fam-push-msg" style="flex:1">이 기기의 채팅 알림이 꺼져 있습니다</span>'
                + '<button id="fam-push-on" style="background:#fff;color:#3a6a96;border:0;border-radius:8px;padding:7px 12px;font-weight:700">알림 켜기</button>'
                + '<button id="fam-push-x" style="background:none;color:#fff;border:0;font-size:16px;padding:4px">✕</button>';
            document.body.appendChild(b);
            const msg = document.getElementById('fam-push-msg');
            document.getElementById('fam-push-x').onclick = () => b.remove();
            document.getElementById('fam-push-on').onclick = async () => {
                const perm = await Notification.requestPermission();
                if (perm !== 'granted') {
                    msg.textContent = perm === 'denied' ? '브라우저에서 알림이 차단됨 → 사이트 권한에서 허용 필요' : '권한 요청이 막힘(일시 차단) → 사이트 권한에서 알림 허용 필요';
                    return;
                }
                if (!localStorage.getItem('chatUser')) { msg.textContent = '채팅에서 사용자를 먼저 선택해 주세요'; return; }
                msg.textContent = '등록 중…';
                await initSW();
                const r = await navigator.serviceWorker.getRegistration('/sulyeon-family-/');
                const s = r && await r.pushManager.getSubscription();
                msg.textContent = s ? '알림 등록 완료' : '구독 실패 (브라우저가 푸시를 지원하지 않음)';
                if (s) setTimeout(() => b.remove(), 2500);
            };
        }
        window.addEventListener('load', () => setTimeout(famPushBanner, 5000));

        // ── 알림 표시 테스트: 주소 끝에 ?notiftest=1 → 8초 뒤 이 폰에서 직접 알림 (서버 미경유) ──
        if (new URLSearchParams(location.search).get('notiftest') === '1') {
            window.addEventListener('load', async () => {
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
