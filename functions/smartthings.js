/*
 * 스마트싱스 연동 (가족 2명만)
 *  stSetup    POST {pat}  : 하루짜리 개인 토큰으로 설연을 스마트싱스 앱(OAuth)으로 등록 → 로그인·승인 주소 돌려줌
 *  stCallback GET         : 삼성 계정 승인 후 돌아오는 곳 → 오래 쓰는 토큰(갱신 토큰) 저장
 *  stApi      POST {op}   : devices(목록·상태) / cmd(기기 제어) / scenes(장면 목록) / scene(장면 실행)
 *  토큰은 secrets/smartthings 에만 저장 (Firestore 규칙에서 앱이 못 읽게 막음)
 */
const {onRequest} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');

const REGION = 'asia-northeast3', PROJECT = process.env.GCLOUD_PROJECT || 'seolyeon-family-seoul';
const CALLBACK = `https://${REGION}-${PROJECT}.cloudfunctions.net/stCallback`;
const API = 'https://api.smartthings.com/v1', TOKEN_URL = 'https://auth-global.api.smartthings.com/oauth/token';
const SCOPES = ['r:devices:*', 'x:devices:*', 'r:scenes:*', 'x:scenes:*', 'r:locations:*'];
const FAMILY = ['woosuly@gmail.com', 'hmy200500750@gmail.com'];
const ref = () => getFirestore().collection('secrets').doc('smartthings');

function cors(req, res) {
  res.set('Access-Control-Allow-Origin', 'https://woosuly.github.io');
  res.set('Access-Control-Allow-Headers', 'authorization, content-type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  return false;
}
async function family(req) {
  const t = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) throw new Error('로그인이 필요합니다');
  const u = await getAuth().verifyIdToken(t);
  if (!u.email_verified || !FAMILY.includes(u.email)) throw new Error('가족 계정만 쓸 수 있습니다');
  return u;
}

// ① 등록: 개인 토큰(PAT)으로 OAuth 앱 생성
exports.stSetup = onRequest({region: REGION}, async (req, res) => {
  if (cors(req, res)) return;
  try {
    await family(req);
    const pat = String((req.body || {}).pat || '').trim(); if (!pat) throw new Error('토큰이 없습니다');
    const cur = (await ref().get()).data() || {};
    let clientId = cur.clientId, secret = cur.secret;
    if (!clientId) {
      const appName = 'seolyeon-family-' + Math.random().toString(36).slice(2, 8);
      const r = await fetch(`${API}/apps`, {method: 'POST', headers: {authorization: 'Bearer ' + pat, 'content-type': 'application/json'},
        body: JSON.stringify({appName, displayName: '설연 가족 앱', description: '설연 가족 앱에서 집 기기 제어', appType: 'API_ONLY', classifications: ['CONNECTED_SERVICE'], singleInstance: true,
          apiOnly: {targetUrl: null}, oauth: {clientName: '설연', scope: SCOPES, redirectUris: [CALLBACK]}})});
      const txt = await r.text(); let j = {}; try { j = JSON.parse(txt); } catch (e) {}
      if (!r.ok) throw new Error(`앱 등록 실패 (${r.status}${r.status === 401 ? ' 토큰 오류·만료' : r.status === 403 ? ' 토큰 권한 부족: 앱(Apps) 권한 필요' : ''}) ` + ((j.error && (j.error.message || j.error.code)) || txt.slice(0, 120)));
      clientId = j.oauthClientId; secret = j.oauthClientSecret;
      await ref().set({clientId, secret, appId: j.app && j.app.appId, at: Date.now()}, {merge: true});
    }
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await ref().set({state}, {merge: true});
    const url = `https://api.smartthings.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(CALLBACK)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}`;
    res.json({url});
  } catch (e) { res.status(400).json({error: e.message}); }
});

// ② 승인 후 돌아오는 곳: 코드 → 토큰
exports.stCallback = onRequest({region: REGION}, async (req, res) => {
  const page = (msg) => res.set('content-type', 'text/html; charset=utf-8').send(`<!doctype html><meta name=viewport content="width=device-width"><body style="font-family:sans-serif;padding:40px 24px;text-align:center"><h2>${msg}</h2><p>설연 앱으로 돌아가세요.</p></body>`);
  try {
    const s = (await ref().get()).data() || {};
    if (!req.query.code || req.query.state !== s.state) return page('연결 실패: 다시 시도해 주세요');
    const r = await fetch(TOKEN_URL, {method: 'POST', headers: {authorization: 'Basic ' + Buffer.from(s.clientId + ':' + s.secret).toString('base64'), 'content-type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({grant_type: 'authorization_code', code: req.query.code, client_id: s.clientId, redirect_uri: CALLBACK})});
    const j = await r.json();
    if (!r.ok) return page('연결 실패: ' + (j.error_description || j.error || r.status));
    await ref().set({access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 86400) * 1000 - 60e3, state: null, linkedAt: Date.now()}, {merge: true});
    page('스마트싱스 연결 완료');
  } catch (e) { page('연결 실패: ' + e.message); }
});

// 토큰: 만료되면 갱신 (갱신 토큰도 새로 받으면 저장)
async function token() {
  const s = (await ref().get()).data() || {};
  if (!s.refresh) throw new Error('스마트싱스가 연결되지 않았습니다. 설정 → 비서에서 연결하세요');
  if (s.access && s.exp > Date.now()) return s.access;
  const r = await fetch(TOKEN_URL, {method: 'POST', headers: {authorization: 'Basic ' + Buffer.from(s.clientId + ':' + s.secret).toString('base64'), 'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: s.refresh, client_id: s.clientId})});
  const j = await r.json();
  if (!r.ok) throw new Error('스마트싱스 다시 연결 필요 (' + (j.error || r.status) + ')');
  await ref().set({access: j.access_token, refresh: j.refresh_token || s.refresh, exp: Date.now() + (j.expires_in || 86400) * 1000 - 60e3}, {merge: true});
  return j.access_token;
}
async function st(path, opt = {}) {
  const r = await fetch(API + path, {...opt, headers: {authorization: 'Bearer ' + await token(), 'content-type': 'application/json', ...(opt.headers || {})}});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
  return j;
}
// 화면에 보여 줄 기기 상태 요약 (켜짐/꺼짐, 온도, 문 열림 등)
function brief(st) {
  const m = (st.components && st.components.main) || {}, v = (cap, at) => m[cap] && m[cap][at] && m[cap][at].value;
  const o = {};
  if (v('switch', 'switch') != null) o.on = v('switch', 'switch') === 'on';
  if (v('temperatureMeasurement', 'temperature') != null) o.temp = v('temperatureMeasurement', 'temperature');
  if (v('thermostatCoolingSetpoint', 'coolingSetpoint') != null) o.set = v('thermostatCoolingSetpoint', 'coolingSetpoint');
  if (v('airConditionerMode', 'airConditionerMode') != null) o.mode = v('airConditionerMode', 'airConditionerMode');
  if (v('contactSensor', 'contact') != null) o.contact = v('contactSensor', 'contact');
  if (v('lock', 'lock') != null) o.lock = v('lock', 'lock');
  if (v('battery', 'battery') != null) o.battery = v('battery', 'battery');
  return o;
}

// ③ 제어
exports.stApi = onRequest({region: REGION, timeoutSeconds: 60}, async (req, res) => {
  if (cors(req, res)) return;
  try {
    await family(req);
    const b = req.body || {};
    if (b.op === 'status') { const s = (await ref().get()).data() || {}; return res.json({linked: !!s.refresh, linkedAt: s.linkedAt || 0}); }
    if (b.op === 'devices') {
      const ds = (await st('/devices')).items || [];
      const out = await Promise.all(ds.slice(0, 40).map(async d => {
        const caps = [...new Set((d.components || []).flatMap(c => (c.capabilities || []).map(x => x.id)))];
        let s = {}; try { s = brief(await st(`/devices/${d.deviceId}/status`)); } catch (e) {}
        return {id: d.deviceId, name: d.label || d.name, room: d.roomId || '', caps: caps.filter(c => !/^(healthCheck|refresh|ocf|execute|custom\.|samsungce\.(?!driverState))/.test(c)).slice(0, 15), ...s};
      }));
      return res.json({devices: out});
    }
    if (b.op === 'cmd') {
      if (!b.id || !b.capability || !b.command) throw new Error('명령이 부족합니다');
      await st(`/devices/${b.id}/commands`, {method: 'POST', body: JSON.stringify({commands: [{component: b.component || 'main', capability: b.capability, command: b.command, arguments: b.args || []}]})});
      return res.json({ok: true});
    }
    if (b.op === 'scenes') return res.json({scenes: ((await st('/scenes')).items || []).map(s => ({id: s.sceneId, name: s.sceneName}))});
    if (b.op === 'scene') { await st(`/scenes/${b.id}/execute`, {method: 'POST', body: '{}'}); return res.json({ok: true}); }
    throw new Error('알 수 없는 요청');
  } catch (e) { res.status(400).json({error: e.message}); }
});
