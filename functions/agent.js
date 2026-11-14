/*
 * 설연 비서 엔진 — 5분마다 실행 (앱이 꺼져 있어도 동작)
 *  ① 리마인더: reminders/{id} {owner, at(ms), text, done:false} → 시각이 되면 푸시
 *     (기프티콘 만료·납부기한·차량 점검·예약 무료취소 기한 등도 앱이 리마인더로 넣음)
 *  ② 아침 브리핑 07:00 — 오늘 일정·날씨·확인 대기·마감 임박
 *  ③ 전날 지역 브리핑 19:00 — 내일 일정 장소의 날씨·이동·맛집 (AI 웹검색)
 *  ④ 주말 근교 제안 목 19:30 — 이번 주말 날씨 + 근교 등산·명소·숙소, 가고 싶은 곳 목록 참고
 *  ⑤ 주간 요약 일 20:00 — 이번 주 지출, 다음 주 일정, 떠날 수 있는 연휴
 *  결과는 briefs/{id}에 저장하고 푸시 (앱에서 눌러 전체 보기)
 *  설정: config/agent {users:['정우설','한미연'], lat, lon, city, off:{morning:true,...}}
 */
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

const db = () => getFirestore();
const KST = 9 * 3600e3;
const kst = (ms = Date.now()) => new Date(ms + KST);                       // 날짜 계산용 (UTC 필드에 한국 시각)
const ymd = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * 864e5));
const won = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const md = s => { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WD[d.getUTCDay()]})`; };

// 공휴일 (대체공휴일 포함) — 해마다 추가
const HOLI = {
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날', '2026-03-02': '삼일절 대체',
  '2026-05-05': '어린이날', '2026-05-25': '부처님오신날 대체', '2026-06-03': '지방선거', '2026-08-17': '광복절 대체',
  '2026-09-24': '추석', '2026-09-25': '추석', '2026-09-26': '추석', '2026-10-05': '개천절 대체', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-08': '설날', '2027-02-09': '설날 대체', '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날',
  '2027-08-16': '광복절 대체', '2027-09-14': '추석', '2027-09-15': '추석', '2027-09-16': '추석', '2027-10-04': '개천절 대체', '2027-10-11': '한글날 대체', '2027-12-27': '성탄절 대체',
};

// ── 푸시 ────────────────────────────────────────────────
async function pushTo(user, data) {
  const snap = await db().collection('pushTokens').where('token', '==', user).get();
  const tokens = [...new Set(snap.docs.map(d => d.data().fcm).filter(Boolean))];
  if (!tokens.length) return 0;
  const res = await getMessaging().sendEachForMulticast({
    tokens, data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
    webpush: {headers: {Urgency: 'high', TTL: '86400'}}, android: {priority: 'high', ttl: 86400 * 1000},
  });
  return res.successCount;
}

// ── AI (가족 공유 키 사용: Claude는 웹검색 포함) ─────────
async function ai(system, user, search) {
  const k = (await db().collection('config').doc('aiShared').get()).data() || {};
  const cfg = (await db().collection('config').doc('agent').get()).data() || {};
  if (k.claude) {
    const body = {model: cfg.claudeModel || 'claude-sonnet-5-5', max_tokens: 2500, system, messages: [{role: 'user', content: user}]};
    if (search) body.tools = [{type: 'web_search_20250305', name: 'web_search', max_uses: 6}];
    const r = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': k.claude, 'anthropic-version': '2023-06-01'}, body: JSON.stringify(body)});
    const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || r.status);
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }
  if (k.gemini) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel || 'gemini-3.6-flash'}:generateContent?key=${k.gemini}`, {method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({systemInstruction: {parts: [{text: system}]}, contents: [{role: 'user', parts: [{text: user}]}], ...(search ? {tools: [{google_search: {}}]} : {})})});
    const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || r.status);
    return ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  }
  if (k.gpt) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + k.gpt},
      body: JSON.stringify({model: cfg.gptModel || 'gpt-5.4-mini', messages: [{role: 'system', content: system}, {role: 'user', content: user}]})});
    const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || r.status);
    return (j.choices[0].message.content || '').trim();
  }
  return '';
}
const AI_SYS = '너는 40대 후반 부부(정우설·한미연, 청주 거주, 여행과 등산을 좋아함)의 가정 비서다. 한국어, 군더더기 없는 존댓말. 확인 안 된 정보는 지어내지 말고 "확인 필요"로 표시. 마크다운 제목(#)은 쓰지 말고 짧은 문단과 "- " 목록만.';

// ── 날씨 (Open-Meteo) ───────────────────────────────────
async function weather(lat, lon, day) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=10`);
    const j = await r.json(), d = j.daily; if (!d) return '';
    const i = d.time.indexOf(day); if (i < 0) return '';
    const c = d.weather_code[i], s = c <= 1 ? '맑음' : c <= 3 ? '구름' : c <= 48 ? '안개' : c <= 67 ? '비' : c <= 77 ? '눈' : c <= 82 ? '소나기' : '뇌우';
    return `${s} ${Math.round(d.temperature_2m_min[i])}~${Math.round(d.temperature_2m_max[i])}°C, 강수 ${d.precipitation_probability_max[i] ?? 0}%`;
  } catch (e) { return ''; }
}

// ── 데이터 ───────────────────────────────────────────────
const mine = (e, u) => !e.member || e.member === u || e.member === '공통';
async function schedulesOn(day) {
  const s = await db().collection('schedules').where('date', '==', day).get();
  return s.docs.map(d => d.data()).sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
}
const schLine = e => `${e.startTime ? e.startTime + ' ' : ''}${e.memo || '(내용 없음)'}${e.place ? ' · ' + e.place : ''}${e.member && e.member !== '공통' ? ' (' + e.member + ')' : ''}`;

async function saveBrief(type, owner, day, title, body) {
  const id = `${type}_${day}_${owner}`;
  await db().collection('briefs').doc(id).set({id, type, owner, date: day, title, body, at: Date.now()});
  await pushTo(owner, {k: 'brief', id, title, body: body.split('\n').filter(Boolean).slice(0, 3).join(' / ').slice(0, 180), tag: 'brief-' + type});
  return id;
}
async function once(key) {   // 같은 브리핑을 하루 한 번만
  const ref = db().collection('agentLog').doc(key);
  try { await ref.create({at: Date.now()}); return true; } catch (e) { return false; }
}

// ① 리마인더
async function runReminders(now) {
  const s = await db().collection('reminders').where('done', '==', false).where('at', '<=', now).limit(50).get();
  for (const d of s.docs) {
    const r = d.data();
    await pushTo(r.owner, {k: 'remind', id: d.id, title: '⏰ ' + (r.title || '알림'), body: r.text || '', tag: 'remind-' + d.id});
    await d.ref.update({done: true, sentAt: Date.now()});
    if (r.repeat === 'yearly') await db().collection('reminders').add({...r, at: r.at + 365 * 864e5, done: false});
  }
}

// ② 아침 브리핑
async function morning(u, day, cfg) {
  const sch = (await schedulesOn(day)).filter(e => mine(e, u));
  const w = await weather(cfg.lat, cfg.lon, day);
  const pend = (await db().collection('inbox').where('owner', '==', u).where('status', '==', 'pending').get()).size;
  const soon = (await db().collection('reminders').where('owner', '==', u).where('done', '==', false).where('at', '<=', Date.now() + 3 * 864e5).get()).docs.map(d => d.data());
  const lines = [];
  lines.push(`날씨(${cfg.city}): ${w || '정보 없음'}`);
  lines.push(sch.length ? '오늘 일정\n' + sch.map(e => '- ' + schLine(e)).join('\n') : '오늘 일정 없음');
  if (soon.length) lines.push('3일 안 알림\n' + soon.sort((a, b) => a.at - b.at).map(r => `- ${md(ymd(kst(r.at)))} ${r.title || r.text}`).join('\n'));
  if (pend) lines.push(`확인 대기 ${pend}건 (가계부·문자)`);
  if (HOLI[day]) lines.unshift(`오늘은 ${HOLI[day]}입니다.`);
  await saveBrief('morning', u, day, `${md(day)} 아침 브리핑`, lines.join('\n\n'));
}

// ③ 전날 지역 브리핑 (내일 장소 있는 일정만)
async function eveRegional(u, day) {
  const tmr = addDays(day, 1);
  const sch = (await schedulesOn(tmr)).filter(e => mine(e, u) && (e.place || /[가-힣]{2,}(역|시|군|구|동|공원|산|월드|시장|호텔|병원|공항)/.test(e.memo || '')));
  if (!sch.length) return;
  const q = sch.map(e => `- ${schLine(e)}`).join('\n');
  const text = await ai(AI_SYS, `내일(${md(tmr)}) 일정:\n${q}\n\n각 일정마다 다음을 짧게 정리해줘. 출발지는 청주.\n- 그날 그 지역 날씨와 옷차림\n- 청주에서 가는 방법과 대략 소요 시간, 주차\n- 근처 식사 후보 2곳 (이름·특징·대략 가격)\n- 운영시간·예약 등 확인할 것`, true).catch(e => '지역 정보를 가져오지 못했습니다: ' + e.message);
  if (text) await saveBrief('eve', u, tmr, `내일 ${md(tmr)} 일정 준비`, text);
}

// ④ 주말 근교 제안
async function weekend(u, day, cfg) {
  const sat = addDays(day, (6 - new Date(day + 'T00:00:00Z').getUTCDay() + 7) % 7), sun = addDays(sat, 1);
  const [w1, w2] = [await weather(cfg.lat, cfg.lon, sat), await weather(cfg.lat, cfg.lon, sun)];
  const busy = [...await schedulesOn(sat), ...await schedulesOn(sun)].filter(e => mine(e, u)).map(schLine);
  const wish = (await db().collection('travelWish').get()).docs.map(d => d.data()).filter(x => !x.done).map(x => x.name).slice(0, 15);
  const text = await ai(AI_SYS, `이번 주말 ${md(sat)}~${md(sun)} 청주 날씨: 토 ${w1 || '?'}, 일 ${w2 || '?'}.
주말 일정: ${busy.length ? busy.join(', ') : '없음'}. 가고 싶은 곳 목록: ${wish.length ? wish.join(', ') : '없음'}.
청주에서 2시간 이내로 다녀올 만한 곳 3가지를 제안해줘 (등산 코스 1곳 이상, 지금 시기의 단풍·꽃·축제 등 제철 요소, 가고 싶은 곳 목록에 맞는 게 있으면 우선).
각 제안: 이름, 왜 지금인지, 이동 시간, 함께 들를 식당 1곳, 1박이면 숙소 후보 1곳. 일정이 이미 있으면 남는 시간에 맞춰줘.`, true).catch(e => '제안을 만들지 못했습니다: ' + e.message);
  if (text) await saveBrief('weekend', u, day, `이번 주말 제안 (${md(sat)}~)`, text);
}

// ⑤ 주간 요약 + 떠날 수 있는 연휴
function longBreaks(from, days = 120) {
  const out = []; let run = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(from, i), wd = new Date(d + 'T00:00:00Z').getUTCDay(), off = wd === 0 || wd === 6 || HOLI[d];
    if (off) run.push(d); else { if (run.length >= 3 || (run.length >= 2 && run.some(x => HOLI[x]))) out.push(run); run = []; }
  }
  // 하루 연차로 4일 이상이 되는 경우도 찾기
  const res = out.filter(r => r.some(x => HOLI[x])).map(r => `- ${md(r[0])}~${md(r[r.length - 1])} ${r.length}일 연휴 (${[...new Set(r.map(x => HOLI[x]).filter(Boolean))].join(', ')})`);
  for (let i = 0; i <= days; i++) {
    const d = addDays(from, i), wd = new Date(d + 'T00:00:00Z').getUTCDay();
    if (HOLI[d] && (wd === 2 || wd === 4)) res.push(`- ${md(d)} ${HOLI[d]}: ${wd === 2 ? '월요일' : '금요일'} 연차 하루면 4일 연휴`);
  }
  return [...new Set(res)].slice(0, 6);
}
async function weekly(u, day) {
  const from = addDays(day, -6);
  const as = (await db().collection('assets').where('date', '>=', from).where('date', '<=', day).get()).docs.map(d => d.data()).filter(e => e.type === '지출' && (e.member === u || e.member === '공통' || !e.member));
  const sum = as.reduce((a, e) => a + (Number(e.amt) || 0), 0), byCat = {};
  as.forEach(e => { byCat[e.category || '기타'] = (byCat[e.category || '기타'] || 0) + (Number(e.amt) || 0); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `${c} ${won(v)}`).join(', ');
  const next = [];
  for (let i = 1; i <= 7; i++) { const d = addDays(day, i); (await schedulesOn(d)).filter(e => mine(e, u)).forEach(e => next.push(`- ${md(d)} ${schLine(e)}`)); }
  const breaks = longBreaks(addDays(day, 1));
  const lines = [`이번 주 지출 ${won(sum)}${cats ? '\n' + cats : ''}`, next.length ? '다음 주 일정\n' + next.join('\n') : '다음 주 일정 없음'];
  if (breaks.length) lines.push('떠날 수 있는 연휴 (4개월 안)\n' + breaks.join('\n'));
  await saveBrief('weekly', u, day, `주간 요약 (${md(from)}~${md(day)})`, lines.join('\n\n'));
}

// ── 5분마다 ──────────────────────────────────────────────
exports.agentTick = onSchedule({schedule: 'every 5 minutes', timeZone: 'Asia/Seoul', region: 'asia-northeast3', timeoutSeconds: 300, memory: '512MiB'}, async () => {
  const now = Date.now(), k = kst(now), day = ymd(k), hm = k.getUTCHours() * 60 + k.getUTCMinutes(), wd = k.getUTCDay();
  const cfg = {users: ['정우설', '한미연'], lat: 36.6424, lon: 127.489, city: '청주', off: {}, ...((await db().collection('config').doc('agent').get()).data() || {})};
  await runReminders(now).catch(e => console.error('reminders', e));
  const at = (h, m) => hm >= h * 60 + m && hm < h * 60 + m + 15;   // 늦게 실행돼도 15분 안이면 처리
  for (const u of cfg.users) {
    const job = async (name, fn) => { if (cfg.off[name] || (cfg.offBy && cfg.offBy[u] && cfg.offBy[u][name])) return; if (await once(`${name}_${day}_${u}`)) await fn().catch(e => console.error(name, u, e)); };
    if (at(7, 0)) await job('morning', () => morning(u, day, cfg));
    if (at(19, 0)) await job('eve', () => eveRegional(u, day));
    if (wd === 4 && at(19, 30)) await job('weekend', () => weekend(u, day, cfg));
    if (wd === 0 && at(20, 0)) await job('weekly', () => weekly(u, day));
  }
});

// 앱에서 바로 실행해 보기용 (지금 아침 브리핑 만들기 등) — briefReq/{id} {owner, type} 생성 시
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
exports.briefNow = onDocumentCreated({document: 'briefReq/{id}', region: 'asia-northeast3', timeoutSeconds: 300, memory: '512MiB'}, async (ev) => {
  const r = ev.data && ev.data.data(); if (!r || !r.owner) return;
  const cfg = {lat: 36.6424, lon: 127.489, city: '청주', ...((await db().collection('config').doc('agent').get()).data() || {})};
  const day = ymd(kst());
  try {
    if (r.type === 'eve') await eveRegional(r.owner, day);
    else if (r.type === 'weekend') await weekend(r.owner, day, cfg);
    else if (r.type === 'weekly') await weekly(r.owner, day);
    else await morning(r.owner, day, cfg);
    await ev.data.ref.update({done: true});
  } catch (e) { await ev.data.ref.update({error: String(e.message || e)}); }
});

exports._test = {longBreaks, md, addDays, HOLI};
