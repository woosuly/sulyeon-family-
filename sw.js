// 설연 Family — Service Worker v5
const CACHE_NAME = 'seolyeon-v5';
const BASE = '/sulyeon-family-/';

const NOTIF_OPTIONS = (sender, body) => ({
    body,
    icon:     BASE + 'icon-192.png',
    badge:    BASE + 'icon-192.png',
    tag:      'chat-message',
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

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
    caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
        .then(() => clients.claim())
));
self.addEventListener('fetch', e =>
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
);

// postMessage (앱 실행 중 백그라운드)
self.addEventListener('message', e => {
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
    e.waitUntil(
        self.registration.showNotification('💬 ' + (p.sender || '설연Family'), NOTIF_OPTIONS(p.sender, p.body))
    );
});

// 알림 클릭
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            for (const c of list) {
                if (c.url.startsWith(self.location.origin + BASE) && 'focus' in c) return c.focus();
            }
            return clients.openWindow(BASE);
        })
    );
});
