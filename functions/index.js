/* 설연 가족 앱 서버 기능: 새 채팅이 오면 가족 폰에 푸시 알림 (FCM 토큰 방식) */
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const TYPE_BODY = {image: '사진을 보냈어요', video: '동영상을 보냈어요', location: '위치를 보냈어요', file: '파일을 보냈어요'};
const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

exports.sendChatNotif = onDocumentCreated(
  {document: 'messages/{msgId}', region: 'asia-northeast3'},
  async (event) => {
    const msg = event.data && event.data.data();
    if (!msg) return;
    const sender = msg.sender || 'Family';
    const body = clip(msg.text || TYPE_BODY[msg.type] || '새 메시지', 120);
    const msgId = event.params.msgId;

    // 보낸 사람을 뺀 가족의 폰 (FCM 토큰이 있는 것만, 예전 web-push 구독은 무시)
    const snap = await db.collection('pushTokens').where('token', '!=', sender).get();
    const devs = snap.docs.map(d => ({ref: d.ref, ...d.data()})).filter(d => d.fcm);
    if (!devs.length) { console.log('no tokens'); return; }

    const tokens = [...new Set(devs.map(d => d.fcm))];
    // 데이터 메시지로 보내고, 표시는 앱(네이티브)·서비스워커(브라우저)가 함
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      data: {k: 'chat', id: msgId, title: '💬 ' + sender, body, tag: 'chat-' + msgId, sender},
      webpush: {headers: {Urgency: 'high', TTL: '86400'}},
      android: {priority: 'high', ttl: 86400 * 1000},
    });

    // 결과 기록 + 더 이상 쓰지 않는 토큰 정리
    const dead = [];
    res.responses.forEach((r, i) => {
      const who = devs.filter(d => d.fcm === tokens[i]).map(d => d.token + (d.native ? '(앱)' : '(웹)')).join(',');
      if (r.success) { console.log('ok:', who); return; }
      const code = r.error && r.error.code;
      console.log('fail:', who, code);
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
    });
    await Promise.all(devs.filter(d => dead.includes(d.fcm)).map(d => d.ref.delete().catch(() => null)));
  }
);

// 비서 엔진 (리마인더·브리핑) — agent.js
const agent = require('./agent');
exports.agentTick = agent.agentTick;
exports.briefNow = agent.briefNow;
