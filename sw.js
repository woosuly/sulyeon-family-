// 설연 Family — Service Worker v7
// v6: 앱 파일을 폰에 저장 → 인터넷이 없어도 앱이 열림 (문장집·지난 데이터 사용)
const CACHE_NAME = 'seolyeon-v76';
const BASE = '/sulyeon-family-/';
// 앱 파일 (폴더 구조 변경 시 함께 수정)
const APP_FILES = [
    './',
    'index.html',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'css/app.css',
    'css/home.css',
    'css/settings.css',
    'css/talk.css',
    'css/translator.css',
    'css/travel.css',
    'css/wide.css',
    'js/core/ai.js',
    'js/core/boot.js',
    'js/core/firebase.js',
    'js/core/icons.js',
    'js/core/nav.js',
    'js/core/push.js',
    'js/core/sync.js',
    'js/core/ui.js',
    'js/core/util.js',
    'js/core/voice.js',
    'js/core/wide.js',
    'js/features/album-select.js',
    'js/features/agent.js',
    'js/features/album.js',
    'js/features/analysis.js',
    'js/features/asset-detail.js',
    'js/features/asset.js',
    'js/features/assistant.js',
    'js/features/chat-ai.js',
    'js/features/chat-extra.js',
    'js/features/chat-menu.js',
    'js/features/chat.js',
    'js/features/dashboard.js',
    'js/features/hike.js',
    'js/features/docs.js',
    'js/features/bills.js',
    'js/features/flight.js',
    'js/features/brain.js',
    'js/features/inbox.js',
    'js/features/iot.js',
    'js/features/map.js',
    'js/features/life.js',
    'js/features/media.js',
    'js/features/money.js',
    'js/features/trip-ai.js',
    'js/features/family.js',
    'js/features/notices.js',
    'js/features/news.js',
    'js/features/receipt.js',
    'js/features/report.js',
    'js/features/save.js',
    'js/features/schedule.js',
    'js/features/shop.js',
    'js/features/talk.js',
    'js/features/theme.js',
    'js/features/travel.js',
    'js/features/trip-extra.js',
    'js/features/trip.js',
    'js/features/weather-hourly.js'
].map(f => BASE + f.replace(/^\.\//, ''));
// 외부 라이브러리 중 오프라인에도 필요한 것 (Firebase SDK·차트·글꼴)
const CDN_OK = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdn\.jsdelivr\.net\/)/;

const NOTIF_OPTIONS = (sender, body) => ({
    body,
    icon:     BASE + 'icon-192.png',
    badge:    BASE + 'icon-192.png',
    tag:      'chat-' + Date.now(),   // 메시지마다 새 알림 → 매번 팝업
    renotify: true,
    vibrate:  [200, 100, 200],
    silent:   false,
    requireInteraction: true,   // ← 헤드업 팝업 유지
    actions: [
        { action: 'open',    title: '열기' },
        { action: 'dismiss', title: '닫기' }
    ],
    data: { url: BASE, sender, body }
});

self.addEventListener('install', e => e.waitUntil(
    caches.open(CACHE_NAME)
        .then(c => Promise.all(APP_FILES.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
        .then(() => self.skipWaiting())
));
self.addEventListener('activate', e => e.waitUntil(
    caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
        .then(() => clients.claim())
));
// 네트워크 우선 · 받은 파일은 캐시에 갱신 · 끊기면 캐시 사용
// (Firestore·AI·날씨 등 API 요청은 건드리지 않음)
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url), same = url.origin === self.location.origin && url.pathname.startsWith(BASE);
    if (!same && !CDN_OK.test(req.url)) return;
    e.respondWith(
        fetch(req).then(async res => {
            if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {}); return res; }
            // 배포 중 잠깐 404 등이 나면 저장해 둔 파일로 대신 (화면이 깨지지 않게)
            const hit = await caches.match(req, { ignoreSearch: same });
            return hit || res;
        }).catch(async () => {
            const hit = await caches.match(req, { ignoreSearch: same });
            if (hit) return hit;
            if (req.mode === 'navigate') return caches.match(BASE + 'index.html');
            return Response.error();
        })
    );
});

// postMessage (앱 실행 중 백그라운드)
self.addEventListener('message', e => {
    if (e.data && e.data.type === 'CLEAR_NOTIF') {
        e.waitUntil(self.registration.getNotifications().then(ns => ns.forEach(n => n.tag !== 'hike' && n.close())));
        return;
    }
    if (!e.data || e.data.type !== 'CHAT_NOTIFY') return;
    e.waitUntil(
        self.registration.showNotification('💬 ' + e.data.sender, NOTIF_OPTIONS(e.data.sender, e.data.body))
    );
});

// Web Push (앱 종료/잠금 화면)
self.addEventListener('push', e => {
    if (!e.data) return;
    let p;
    try { p = e.data.json(); } catch { p = { sender: '설연Family', body: e.data.text() }; }
    const d = p.data || p;   // FCM 데이터 메시지는 {data:{k,id,title,body,tag,sender}} 형태
    const opt = NOTIF_OPTIONS(d.sender, d.body);
    if (d.tag) opt.tag = d.tag;
    e.waitUntil(self.registration.showNotification(d.title || ('💬 ' + (d.sender || '설연Family')), opt));
});

// 알림 클릭
self.addEventListener('notificationclick', e => {
    e.notification.close();
    if (e.action === 'dismiss') return;
    const isChat = (e.notification.tag || '').startsWith('chat');   // 채팅 알림이면 채팅창으로
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.startsWith(self.location.origin + BASE) && 'focus' in c) {
                    if (isChat) c.postMessage({ type: 'OPEN_CHAT' });
                    return c.focus();
                }
            }
            return clients.openWindow(BASE + (isChat ? '?open=chat' : ''));
        })
    );
});
