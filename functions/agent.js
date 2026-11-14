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

// ── 산행 판단용: 일몰 · 미세먼지 (Open-Meteo, 9~17시 평균, 한국 기준 등급) ──
async function outdoor(lat, lon, day) {
  const out = [];
  try {
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunset&timezone=Asia%2FSeoul&forecast_days=10`)).json();
    const i = j.daily.time.indexOf(day); if (i >= 0) out.push('일몰 ' + String(j.daily.sunset[i]).slice(11, 16));
  } catch (e) {}
  try {
    const j = await (await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm10,pm2_5&timezone=Asia%2FSeoul&forecast_days=5`)).json();
    const h = j.hourly, idx = h.time.map((t, k) => t.startsWith(day) && +t.slice(11, 13) >= 9 && +t.slice(11, 13) <= 17 ? k : -1).filter(k => k >= 0);
    if (idx.length) {
      const avg = a => Math.round(idx.reduce((x, k) => x + (a[k] || 0), 0) / idx.length), p10 = avg(h.pm10), p25 = avg(h.pm2_5);
      const g = Math.max(p10 <= 30 ? 0 : p10 <= 80 ? 1 : p10 <= 150 ? 2 : 3, p25 <= 15 ? 0 : p25 <= 35 ? 1 : p25 <= 75 ? 2 : 3);
      out.push(`미세먼지 ${['좋음', '보통', '나쁨', '매우 나쁨'][g]}(PM10 ${p10}·PM2.5 ${p25})`);
    }
  } catch (e) {}
  return out.join(', ');
}
// 산림청 100대 명산 (앱 js/features/hike.js 와 같은 목록)
const M100 = '가리산 가리왕산 가야산 가지산 감악산 강천산 계룡산 계방산 공작산 관악산 구병산 금산 금수산 금오산 금정산 깃대봉 남산 내연산 내장산 대둔산 대암산 대야산 덕숭산 덕유산 덕항산 도락산 도봉산 두륜산 두타산 마니산 마이산 명성산 명지산 모악산 무등산 무학산 미륵산 민주지산 방장산 방태산 백덕산 백암산 백운산(광양) 백운산(포천) 백운산(정선) 변산 북한산 비슬산 삼악산 서대산 선운산 설악산 성인봉 소백산 소요산 속리산 신불산 연화산 오대산 오봉산 용문산 용화산 운문산 운악산 운장산 월악산 월출산 유명산 응봉산 장안산 재약산 적상산 점봉산 조계산 주왕산 주흘산 지리산 지리산(통영) 천관산 천마산 천성산 천태산 청량산 추월산 축령산 치악산 칠갑산 태백산 태화산 팔공산 팔봉산 팔영산 한라산 화악산 화왕산 황매산 황석산 황악산 황장산 희양산'.split(' ');
async function visitedMts() {
  const logs = (await db().collection('hikeLogs').get()).docs.map(d => d.data());
  return [...new Set(logs.map(h => (String(h.place || '').match(/[가-힣]{1,8}산/) || [''])[0]).filter(Boolean))];
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
  // at 하나로만 조회 (복합 색인 불필요), 보낸 알림은 지움
  const s = await db().collection('reminders').where('at', '<=', now).limit(50).get();
  for (const d of s.docs) {
    const r = d.data();
    await pushTo(r.owner, {k: 'remind', id: d.id, title: '⏰ ' + (r.title || '알림'), body: r.text && r.text !== r.title ? r.text : '', tag: 'remind-' + d.id});
    await d.ref.delete();
    if (r.keepId && (r.repeat === 'monthly' || r.repeat === 'yearly')) {
      // 정기결제 알림: 같은 id로 다음 달(해) 같은 날에 다시 (말일 넘으면 그 달 마지막 날)
      const k = new Date(r.at + 9 * 3600e3), y = k.getUTCFullYear(), m = k.getUTCMonth() + (r.repeat === 'monthly' ? 1 : 12), day = r.day || k.getUTCDate();
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      await db().collection('reminders').doc(d.id).set({...r, at: Date.UTC(y, m, Math.min(day, last), k.getUTCHours(), k.getUTCMinutes()) - 9 * 3600e3});
    } else if (r.repeat === 'yearly') { const nid = d.id + '_y'; await db().collection('reminders').doc(nid).set({...r, id: nid, at: r.at + 365 * 864e5}); }
  }
}

// ② 아침 브리핑
async function morning(u, day, cfg) {
  const sch = (await schedulesOn(day)).filter(e => mine(e, u));
  const w = await weather(cfg.lat, cfg.lon, day);
  const pend = (await db().collection('inbox').where('owner', '==', u).where('status', '==', 'pending').get()).size;
  const soon = (await db().collection('reminders').where('owner', '==', u).get()).docs.map(d => d.data()).filter(r => r.at <= Date.now() + 3 * 864e5);
  const lines = [];
  lines.push(`날씨(${cfg.city}): ${w || '정보 없음'}`);
  lines.push(sch.length ? '오늘 일정\n' + sch.map(e => '- ' + schLine(e)).join('\n') : '오늘 일정 없음');
  if (soon.length) lines.push('3일 안 알림\n' + soon.sort((a, b) => a.at - b.at).map(r => `- ${md(ymd(kst(r.at)))} ${r.title || r.text}`).join('\n'));
  if (pend) lines.push(`확인 대기 ${pend}건 (가계부·문자)`);
  // 후속 확인: 답장 초안을 만든 지 반나절 넘게 처리 안 한 메시지
  const late = (await db().collection('inbox').where('owner', '==', u).where('status', '==', 'pending').get()).docs.map(d => d.data()).filter(x => x.reply && Date.now() - (x.at || 0) > 12 * 3600e3).slice(0, 4);
  if (late.length) lines.push('답장 안 한 메시지\n' + late.map(x => `- ${x.name || x.room || x.from || ''}: ${x.summary || ''}`).join('\n'));
  // 연락한 지 오래된 가족 (careList: every일 주기)
  const care = (await db().collection('careList').get()).docs.map(d => d.data()).map(c => ({...c, d: Math.floor((Date.now() - (c.last || 0)) / 864e5)})).filter(c => c.d > (+c.every || 14)).sort((a, b) => b.d - a.d).slice(0, 3);
  if (care.length) lines.push('안부 연락\n' + care.map(c => `- ${c.name}${c.rel ? '(' + c.rel + ')' : ''} ${c.d}일째 연락 없음`).join('\n'));
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
  const wish = (await db().collection('wishes').get()).docs.map(d => d.data()).filter(x => !x.done).map(x => x.name).slice(0, 15);
  const [o1, o2, been] = [await outdoor(cfg.lat, cfg.lon, sat), await outdoor(cfg.lat, cfg.lon, sun), await visitedMts()];
  const text = await ai(AI_SYS, `이번 주말 ${md(sat)}~${md(sun)} 청주 날씨: 토 ${w1 || '?'}${o1 ? ', ' + o1 : ''} / 일 ${w2 || '?'}${o2 ? ', ' + o2 : ''}.
다녀온 산: ${been.length ? been.join(', ') : '기록 없음'} (등산 코스는 안 가 본 산 우선).
주말 일정: ${busy.length ? busy.join(', ') : '없음'}. 가고 싶은 곳 목록: ${wish.length ? wish.join(', ') : '없음'}.
청주에서 2시간 이내로 다녀올 만한 곳 3가지를 제안해줘 (등산 코스 1곳 이상, 지금 시기의 단풍·꽃·축제 등 제철 요소, 가고 싶은 곳 목록에 맞는 게 있으면 우선).
각 제안: 이름, 왜 지금인지, 이동 시간, 함께 들를 식당 1곳, 1박이면 숙소 후보 1곳. 일정이 이미 있으면 남는 시간에 맞춰줘.`, true).catch(e => '제안을 만들지 못했습니다: ' + e.message);
  if (text) await saveBrief('weekend', u, day, `이번 주말 제안 (${md(sat)}~)`, text);
}

// ④-2 주말 산행 추천 (앱에서 요청) — 날씨·미세먼지·일몰, 안 가 본 100대 명산 우선
async function hikeSuggest(u, day, cfg) {
  const wd = new Date(day + 'T00:00:00Z').getUTCDay();
  const sat = wd === 0 ? addDays(day, -1) : addDays(day, (6 - wd + 7) % 7), sun = addDays(sat, 1);
  const info = [];
  for (const d of [sat, sun]) if (d >= day) { const o = await outdoor(cfg.lat, cfg.lon, d); info.push(`${md(d)}: ${await weather(cfg.lat, cfg.lon, d) || '날씨 ?'}${o ? ', ' + o : ''}`); }
  const busy = [...await schedulesOn(sat), ...await schedulesOn(sun)].filter(e => mine(e, u)).map(schLine);
  const been = await visitedMts(), left = M100.filter(m => !been.some(b => m.startsWith(b)));
  const text = await ai(AI_SYS, `주말 산행 추천. 출발지 청주, 부부 2명, 4~6시간 코스 선호.
${info.join('\n')}
주말 일정: ${busy.length ? busy.join(', ') : '없음'}
다녀온 산: ${been.length ? been.join(', ') : '기록 없음'}
아직 안 간 100대 명산: ${left.join(', ')}

청주에서 차로 2시간 이내 산 3곳을 추천해줘. 안 간 100대 명산을 우선하되, 지금 시기(${md(day)})에 좋은 곳.
각 곳: 산 이름(100대 명산이면 표시), 추천 코스(들머리→정상→날머리), 거리·소요 시간·난이도, 청주에서 이동 시간, 들머리 주차, 일몰 전에 내려오려면 늦어도 몇 시 출발, 하산 후 식당 1곳.
날씨·미세먼지가 나쁜 날이면 다른 날을 권하거나 짧은 코스로 바꿔줘. 일정이 있으면 남는 날에 맞춰줘.`, true).catch(e => '추천을 만들지 못했습니다: ' + e.message);
  if (text) await saveBrief('hike', u, day, `주말 산행 추천 (${md(sat)}~)`, text);
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
  // 후속 확인: 이번 주말 산행 추천·등산 일정이 있었는데 산행 기록이 없으면 기록 권유
  const sat = addDays(day, -1), hikeBrief = (await db().collection('briefs').doc(`hike_${addDays(day, -2)}_${u}`).get()).exists || (await db().collection('briefs').where('owner', '==', u).where('type', '==', 'hike').get()).docs.some(d => (d.data().date || '') >= addDays(day, -6));
  const hikePlan = (await db().collection('plans').where('start', '>=', sat).get().catch(() => ({docs: []}))).docs.some(d => d.data().subType === '등산' && d.data().start <= day);
  const logged = (await db().collection('hikeLogs').where('date', '>=', sat).get().catch(() => ({docs: []}))).docs.length;
  const lines = [`이번 주 지출 ${won(sum)}${cats ? '\n' + cats : ''}`, next.length ? '다음 주 일정\n' + next.join('\n') : '다음 주 일정 없음'];
  if (breaks.length) lines.push('떠날 수 있는 연휴 (4개월 안)\n' + breaks.join('\n'));
  if ((hikeBrief || hikePlan) && !logged) lines.push('이번 주말 산행을 다녀오셨으면 산행 기록에 남겨 주세요 (100대 명산 진행률에 반영됩니다).');
  await saveBrief('weekly', u, day, `주간 요약 (${md(from)}~${md(day)})`, lines.join('\n\n'));
}

// ⑥ 택배 추적 (스마트택배 API) — 1시간마다, 출발·도착 때 알림
const ST = 'https://info.sweettracker.co.kr/api/v1';
const stNorm = s => String(s || '').replace(/\s|\(주\)|주식회사|택배|로지스틱스|logistics/gi, '').toLowerCase();
async function stCompanies(key) {
  const ref = db().collection('config').doc('stCompanies'), c = (await ref.get()).data();
  if (c && c.list && Date.now() - c.at < 7 * 864e5) return c.list;
  const r = await fetch(`${ST}/companylist?t_key=${key}`), j = await r.json();
  const list = (j.Company || j.company || []).map(x => ({code: x.Code || x.code, name: x.Name || x.name}));
  if (list.length) await ref.set({list, at: Date.now()});
  return list;
}
async function stCode(key, company, invoice) {
  const list = await stCompanies(key), n = stNorm(company);
  const hit = n && list.find(x => stNorm(x.name).includes(n) || n.includes(stNorm(x.name)));
  if (hit) return hit.code;
  // 택배사를 모르면 운송장으로 추천 택배사 조회
  try { const r = await fetch(`${ST}/recommend?t_key=${key}&t_invoice=${invoice}`), j = await r.json(); const rc = (j.Recommend || [])[0]; if (rc) return rc.Code; } catch (e) {}
  return '';
}
// tracker.delivery (스마트택배 키가 없을 때) — 키 형식 "ClientID:Secret"
const TD_CARRIERS = [['cj|대한통운', 'kr.cjlogistics'], ['한진', 'kr.hanjin'], ['롯데', 'kr.lotte'], ['우체국|epost', 'kr.epost'], ['로젠', 'kr.logen'],
  ['쿠팡', 'kr.coupangls'], ['gs|편의점|cvs', 'kr.cvsnet'], ['cu', 'kr.cupost'], ['경동', 'kr.kdexp'], ['대신', 'kr.daesin'], ['일양', 'kr.ilyanglogis'], ['천일', 'kr.chunilps'], ['합동', 'kr.hdexp']];
async function tdQuery(key, carrierId, trackingNumber) {
  const r = await fetch('https://apis.tracker.delivery/graphql', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'TRACKQL-API-KEY ' + key},
    body: JSON.stringify({query: 'query T($c:ID!,$n:String!){track(carrierId:$c,trackingNumber:$n){lastEvent{time status{code name} description location{name}}}}', variables: {c: carrierId, n: trackingNumber}})});
  const j = await r.json().catch(() => ({}));
  // 무료 키는 21일마다 만료 → 인증 오류면 따로 알림
  if (r.status === 401 || (j.errors || []).some(e => /UNAUTH|FORBIDDEN/i.test((e.extensions && e.extensions.code) || '') || /auth|credential|api key/i.test(e.message || ''))) throw new Error('TD_AUTH');
  return j.data && j.data.track && j.data.track.lastEvent ? j.data.track.lastEvent : null;
}
async function tdTrack(key, p) {
  const n = stNorm(p.company);
  let ids = p.tdCarrier ? [p.tdCarrier] : TD_CARRIERS.filter(([k]) => n && new RegExp(k, 'i').test(n)).map(x => x[1]);
  if (!ids.length) ids = ['kr.cjlogistics', 'kr.hanjin', 'kr.lotte', 'kr.epost', 'kr.logen'];   // 택배사 모르면 주요 택배사 순서대로
  for (const id of ids) {
    const e = await tdQuery(key, id, p.invoice); if (!e) continue;
    const c = (e.status && e.status.code) || '';
    const level = c === 'DELIVERED' ? 6 : c === 'OUT_FOR_DELIVERY' ? 5 : c === 'IN_TRANSIT' ? 3 : c ? 2 : 0;
    return {tdCarrier: id, level, status: (e.status && e.status.name) || e.description || '', where: (e.location && e.location.name) || '', done: level >= 6};
  }
  return null;
}
async function parcelNotify(p, item, done, level) {
  const owner = p.by || '정우설';
  if (done && !p.done) await pushTo(owner, {k: 'remind', id: 'pc' + p.invoice, title: '📦 택배 도착', body: `${item || p.company || '택배'} 배달 완료`, tag: 'parcel-' + p.invoice});
  else if (level === 5 && (+p.level || 0) < 5) await pushTo(owner, {k: 'remind', id: 'pc' + p.invoice, title: '📦 오늘 도착 예정', body: `${item || p.company || '택배'} 배달 출발`, tag: 'parcel-' + p.invoice});
}
async function runParcels() {
  const cfg = (await db().collection('config').doc('aiShared').get()).data() || {};
  const key = cfg.sweettracker, td = String(cfg.trackerdelivery || '').trim();
  if (!key && !td) return;
  const s = await db().collection('parcels').where('done', '==', false).get();
  for (const d of s.docs) {
    const p = d.data();
    if (Date.now() - (p.at || 0) > 21 * 864e5) { await d.ref.update({done: true, status: p.status || '기간 지남'}); continue; }
    try {
      if (!key) {
        const t = await tdTrack(td, p);
        if (!t) { await d.ref.update({status: '조회 안 됨 (택배사 확인 필요)', checkedAt: Date.now()}); continue; }
        await d.ref.update({...t, checkedAt: Date.now()});
        await parcelNotify(p, p.item, t.done, t.level); continue;
      }
      const code = p.code || await stCode(key, p.company, p.invoice);
      if (!code) { await d.ref.update({status: '택배사 확인 필요', checkedAt: Date.now()}); continue; }
      const r = await fetch(`${ST}/trackingInfo?t_key=${key}&t_code=${code}&t_invoice=${p.invoice}`), j = await r.json();
      if (j.status === false || j.code) { await d.ref.update({code, status: j.msg || '조회 안 됨', checkedAt: Date.now()}); continue; }
      const last = j.lastDetail || (j.trackingDetails || []).slice(-1)[0] || {}, level = +j.level || 0, done = !!j.complete || level >= 6;
      const item = p.item || j.itemName || '';
      await d.ref.update({code, level, status: last.kind || '', where: last.where || '', item, checkedAt: Date.now(), done});
      await parcelNotify(p, item, done, level);
    } catch (e) {
      if (e.message === 'TD_AUTH') {
        if (await once('td_auth_' + ymd(kst()))) await pushTo('정우설', {k: 'remind', id: 'td-auth', title: '📦 택배 조회 키 만료', body: 'console.tracker.delivery → 자격 증명에서 새로 만들어 설정 → 비서에 넣어 주세요', tag: 'td-auth'});
        return;
      }
      console.error('parcel', p.invoice, e.message);
    }
  }
}

// ⑦ 항공권 가격 지켜보기 — flightWatch/{id} {dest, from, when, nights, pax, target, by, last, hist}
//    월 09:00 주 1회 + 앱에서 '지금 확인'. AI 웹검색 기준 참고 가격 (실시간 최저가 아님)
async function flightCheck(w) {
  const r = await ai('너는 항공권 가격 조사원이다. 웹검색 결과에 실제로 나온 가격만 쓰고, 못 찾으면 low를 0으로 한다. JSON만 출력.',
    `${w.from || '인천'} → ${w.dest} 왕복 항공권, 여행 시기 ${w.when || '미정'}${w.nights ? ', ' + w.nights + '박' : ''}, 성인 ${w.pax || 2}명.
지금 검색되는 1인 왕복 최저가 수준을 찾아 JSON만: {"low":원 단위 숫자(1인 왕복),"airline":"항공사·직항/경유","note":"한 줄 조언 (지금 살지, 더 볼지, 특가 시기)","src":"가격을 본 사이트"}`, true);
  const j = JSON.parse((String(r).match(/\{[\s\S]*\}/) || ['{}'])[0]);
  return {low: Math.round(+j.low || 0), airline: String(j.airline || '').slice(0, 60), note: String(j.note || '').slice(0, 200), src: String(j.src || '').slice(0, 80), at: Date.now()};
}
async function runFlights(owner, fid) {
  const docs = fid ? [await db().collection('flightWatch').doc(fid).get()].filter(d => d.exists) : (await db().collection('flightWatch').get()).docs;
  for (const d of docs) {
    const w = d.data(); if (w.off) continue;
    try {
      const c = await flightCheck(w), prev = w.last && w.last.low;
      await d.ref.update({last: c, hist: [...(w.hist || []), {at: c.at, low: c.low}].slice(-12)});
      if (!c.low) { if (owner) await pushTo(owner, {k: 'remind', id: 'fl' + d.id, title: `✈️ ${w.dest} 항공권`, body: '가격을 찾지 못했습니다. 시기·출발지를 구체적으로 적어 보세요', tag: 'flight-' + d.id}); continue; }
      const drop = prev && c.low <= prev * 0.9, hit = w.target && c.low <= w.target;
      if (owner || drop || hit) await pushTo(owner || w.by || '정우설', {k: 'remind', id: 'fl' + d.id, tag: 'flight-' + d.id,
        title: `✈️ ${w.dest} 왕복 1인 약 ${won(c.low)}${hit ? ' · 목표가 도달' : drop ? ' · 지난주보다 ' + Math.round((1 - c.low / prev) * 100) + '% 내림' : ''}`, body: `${c.airline} ${c.note}`.trim()});
    } catch (e) { console.error('flight', d.id, e.message); }
  }
}

// ── 5분마다 ──────────────────────────────────────────────
exports.agentTick = onSchedule({schedule: 'every 5 minutes', timeZone: 'Asia/Seoul', region: 'asia-northeast3', timeoutSeconds: 300, memory: '512MiB'}, async () => {
  const now = Date.now(), k = kst(now), day = ymd(k), hm = k.getUTCHours() * 60 + k.getUTCMinutes(), wd = k.getUTCDay();
  const cfg = {users: ['정우설', '한미연'], lat: 36.6424, lon: 127.489, city: '청주', off: {}, ...((await db().collection('config').doc('agent').get()).data() || {})};
  await runReminders(now).catch(e => console.error('reminders', e));
  if (k.getUTCMinutes() < 5 && hm >= 7 * 60 && hm < 23 * 60 && await once('parcel_' + day + '_' + k.getUTCHours())) await runParcels().catch(e => console.error('parcels', e));
  // 하루 한 번 정리: 14일 지난 브리핑·기록, 처리 끝난 30일 지난 확인 대기
  if (hm >= 3 * 60 && hm < 3 * 60 + 15 && await once('cleanup_' + day)) {
    for (const [col, field, ms] of [['briefs', 'at', 14 * 864e5], ['agentLog', 'at', 14 * 864e5], ['briefReq', 'at', 7 * 864e5], ['agentRuns', 'at', 60 * 864e5]]) {
      const old = await db().collection(col).where(field, '<', now - ms).limit(300).get().catch(() => ({docs: []}));
      await Promise.all(old.docs.map(d => d.ref.delete()));
    }
  }
  const at = (h, m) => hm >= h * 60 + m && hm < h * 60 + m + 15;   // 늦게 실행돼도 15분 안이면 처리
  if (wd === 1 && at(9, 0) && await once('flight_' + day)) await runFlights('', '').catch(e => console.error('flights', e));
  for (const u of cfg.users) {
    const job = async (name, fn) => { if (cfg.off[name] || (cfg.offBy && cfg.offBy[u] && cfg.offBy[u][name])) return; if (await once(`${name}_${day}_${u}`)) await fn().catch(e => console.error(name, u, e)); };
    if (at(7, 0)) await job('morning', () => morning(u, day, cfg));
    if (at(19, 0)) await job('eve', () => eveRegional(u, day));
    if (wd === 4 && at(19, 30)) await job('weekend', () => weekend(u, day, cfg));
    if (wd === 0 && at(20, 0)) await job('weekly', () => weekly(u, day));
    if (day.endsWith('-01') && at(9, 0)) await job('snap', () => pushTo(u, {k: 'remind', id: 'snap', title: '이번 달 자산 현황', body: '예금·투자·연금 잔액을 적어 두면 순자산 흐름이 보입니다. 저축·정기이체 화면에서 입력하세요.', tag: 'snap'}));
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
    else if (r.type === 'hike') await hikeSuggest(r.owner, day, cfg);
    else if (r.type === 'flight') await runFlights(r.owner, r.fid || '');
    else if (r.type === 'weekly') await weekly(r.owner, day);
    else await morning(r.owner, day, cfg);
    await ev.data.ref.update({done: true});
  } catch (e) { await ev.data.ref.update({error: String(e.message || e)}); }
});

exports._test = {longBreaks, md, addDays, HOLI};
