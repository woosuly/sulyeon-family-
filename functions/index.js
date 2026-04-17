const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();

const VAPID_PUBLIC = 'BDlXswc9xHJln8xnXJ_EBBtBAms9h2luzkBFHgP4ScfVsWA4cdQHF_Esa8Ng46eFO_aS2DlFRQJsP5Tv4RUCsbo';

exports.sendChatNotif = onDocumentCreated(
  {document: 'messages/{msgId}', region: 'asia-northeast3'},
  async (event) => {
    const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
    if (!VAPID_PRIVATE) { console.error('no vapid key'); return; }

    webpush.setVapidDetails('mailto:woosuly@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

    const msg = event.data.data();
    const sender = msg.sender || 'Family';
    const body = (msg.text || 'new message').slice(0, 60);

    const tokensSnap = await admin.firestore()
      .collection('pushTokens')
      .where('token', '!=', sender)
      .get();

    if (tokensSnap.empty) { console.log('no tokens'); return; }

    const subs = tokensSnap.docs.map(d => d.data()).filter(d => d.endpoint && d.p256dh && d.auth);
    if (!subs.length) { console.log('no subs'); return; }

    const payload = JSON.stringify({sender, body});

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(
        {endpoint: sub.endpoint, keys: {p256dh: sub.p256dh, auth: sub.auth}},
        payload
      ))
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'rejected') {
        console.log('fail:', subs[i].token, r.reason && r.reason.statusCode);
        if (r.reason && (r.reason.statusCode === 404 || r.reason.statusCode === 410)) {
          const old = await admin.firestore().collection('pushTokens')
            .where('endpoint', '==', subs[i].endpoint).get();
          old.forEach(function(d) { d.ref.delete(); });
        }
      } else {
        console.log('ok:', subs[i].token);
      }
    }
  }
);