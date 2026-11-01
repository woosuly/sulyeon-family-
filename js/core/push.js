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

                // 알림 권한 요청
                const perm = await Notification.requestPermission();
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
