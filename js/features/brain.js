// ═══════════════════════════════════════════════════════════
// 🧠 비서 두뇌: AI가 앱 기능을 '도구'로 골라 여러 단계를 스스로 처리
//   예) "다음 달 연휴에 1박 산행 잡아줘" → 일정 확인 → 날씨 → 산 추천(웹검색) → 일정 등록 → 알림
//   · 집안 현황(일정·알림·택배·서류·관리비·저축·산행 등)을 한 번에 요약해 AI에게 함께 줌 (흩어진 기억 통합)
//   · 읽기 도구는 바로 실행, 쓰기 도구(일정·알림·메모·장보기 등)는 실행 후 '되돌리기' 버튼
//     돈 기록·가족 채팅·문자·카톡은 확인 카드만 띄움 (사람이 눌러야 저장·전송)
//   · 실행 기록 agentRuns/{id} {q, tools, ok, err, ms, by, at, rate} — 실패·👎를 모아 고칠 곳 찾기
//   Claude·Gemini·GPT 모두 지원 (각 회사의 도구 호출 형식으로 변환)
// ═══════════════════════════════════════════════════════════
const BR_MAX_STEPS = 8;
const brYmd = d => famYmd(d instanceof Date ? d : new Date(d));
const brW = n => Math.round(Number(n) || 0).toLocaleString('ko-KR') + '원';
const brSafe = f => { try { return f(); } catch (e) { return undefined; } };
const brG = name => brSafe(() => eval(name));   // 다른 파일의 let 전역(schData 등)을 안전하게 읽기

// ── 집안 현황 요약 (매 요청마다 AI에게 같이 보냄) ──
function brSnapshot() {
    const today = brYmd(new Date()), in7 = brYmd(Date.now() + 7 * 864e5), L = [];
    const sch = (brG('schData') || []).filter(s => s.date >= today && s.date <= in7).sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
    if (sch.length) L.push('7일 안 일정: ' + sch.slice(0, 12).map(s => `${s.date.slice(5)} ${s.startTime || ''} ${s.memo || ''}${s.place ? '@' + s.place : ''}(${s.member || '공통'})`).join(' / '));
    const rem = (brG('agRems') || []).filter(r => r.at > Date.now()).sort((a, b) => a.at - b.at).slice(0, 6);
    if (rem.length) L.push('예정 알림: ' + rem.map(r => `${agFmt(r.at)} ${r.title}`).join(' / '));
    const trips = (brG('planData') || []).filter(p => (p.end || p.start || '') >= today).sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 5);
    if (trips.length) L.push('다가오는 여행·산행: ' + trips.map(p => `${p.start}~${p.end || ''} ${p.loc || ''}(${p.subType || p.mType || ''})`).join(' / '));
    const pc = (brG('parcels') || []).filter(p => !p.done); if (pc.length) L.push(`배송 중 택배 ${pc.length}건: ` + pc.slice(0, 4).map(p => `${p.item || p.company || ''} ${p.status || ''}`).join(' / '));
    const docs = (brG('lifeDocs') || []).filter(d => d.expire && d.expire <= brYmd(Date.now() + 120 * 864e5)); if (docs.length) L.push('만료 임박 서류: ' + docs.map(d => `${d.owner} ${d.name} ${d.expire}`).join(' / '));
    const inbox = (brG('ibItems') || []).filter(x => x.status === 'pending'); if (inbox.length) L.push(`확인 대기 ${inbox.length}건 (답장 초안 ${inbox.filter(x => x.reply).length})`);
    const shop = (brG('famShopItems') || []).filter(s => !s.done); if (shop.length) L.push('장보기: ' + shop.slice(0, 10).map(s => s.text).join(', '));
    const goals = (brG('svGoals') || []).filter(g => !g.archived); if (goals.length) L.push('저축 목표: ' + goals.map(g => g.name).join(', '));
    const hikes = brG('hikeLogs') || []; if (hikes.length) L.push(`산행 기록 ${hikes.length}회, 최근 ${hikes[0].date} ${hikes[0].place}` + (typeof hikeM100Done === 'function' ? `, 100대 명산 ${hikeM100Done().length}/100` : ''));
    const wish = (brG('wishes') || []).slice(0, 10); if (wish.length) L.push('가고 싶은 곳: ' + wish.map(w => w.name).join(', '));
    const fl = brG('flWatch') || []; if (fl.length) L.push('항공권 지켜보기: ' + fl.map(w => `${w.dest}${w.last && w.last.low ? ' ' + brW(w.last.low) : ''}`).join(', '));
    return L.join('\n');
}

// ── 도구 정의 (설명은 AI가 고를 때 읽음) ──
const brS = (props, req) => ({ type: 'object', properties: props, required: req || [] });
const brStr = d => ({ type: 'string', description: d }), brNum = d => ({ type: 'number', description: d });
const BR_TOOLS = [
    { name: 'list_schedules', description: '기간 안의 가족 일정 조회', params: brS({ from: brStr('YYYY-MM-DD'), to: brStr('YYYY-MM-DD'), keyword: brStr('선택: 내용·장소 검색어') }, ['from', 'to']) },
    { name: 'free_days', description: '기간 안에서 일정이 없는 날·주말·공휴일 찾기 (여행·산행 날짜 고를 때)', params: brS({ from: brStr('YYYY-MM-DD'), to: brStr('YYYY-MM-DD') }, ['from', 'to']) },
    { name: 'query_ledger', description: '가계부 조회: 기간 합계, 분류별 합계, 큰 지출. keyword로 가맹점·내용 검색', params: brS({ from: brStr('YYYY-MM-DD'), to: brStr('YYYY-MM-DD'), type: brStr('지출|수입|전체'), keyword: brStr('선택'), member: brStr('정우설|한미연|공통|전체') }, ['from', 'to']) },
    { name: 'weather', description: '장소·날짜의 날씨, 미세먼지, 일몰 (16일 안)', params: brS({ place: brStr('지명 (예: 속리산, 제주, 청주)'), date: brStr('YYYY-MM-DD') }, ['place', 'date']) },
    { name: 'web_search', description: '최신 정보 웹검색 (맛집·숙소·코스·가격·운영시간 등). 질문을 구체적으로', params: brS({ query: brStr('검색해서 알아낼 내용') }, ['query']) },
    { name: 'search_app', description: '앱 안 기록(일정·가계부·여행·채팅·장보기·메모) 검색', params: brS({ keyword: brStr('검색어') }, ['keyword']) },
    { name: 'hike_info', description: '다녀온 산 목록과 안 가 본 100대 명산', params: brS({}) },
    { name: 'add_schedule', description: '일정 추가 (여러 날이면 end). 바로 저장되고 되돌리기 가능', params: brS({ date: brStr('YYYY-MM-DD'), end: brStr('선택: 마지막 날 YYYY-MM-DD'), time: brStr('선택: HH:MM'), title: brStr('일정 내용'), place: brStr('선택'), member: brStr('정우설|한미연|공통') }, ['date', 'title']) },
    { name: 'add_reminder', description: '특정 시각에 푸시 알림. 바로 저장', params: brS({ at: brStr('YYYY-MM-DDTHH:MM'), title: brStr('알림 내용'), who: brStr('정우설|한미연|둘 다') }, ['at', 'title']) },
    { name: 'save_note', description: '가족이 기억해 달라는 정보 저장 (보험사, 비밀번호 제외 생활 정보 등)', params: brS({ text: brStr('기억할 내용') }, ['text']) },
    { name: 'add_shopping', description: '장보기 목록에 추가', params: brS({ items: { type: 'array', items: { type: 'string' }, description: '물건 이름들' } }, ['items']) },
    { name: 'add_wish', description: '가고 싶은 곳 목록에 추가', params: brS({ name: brStr('장소'), note: brStr('선택'), abroad: { type: 'boolean', description: '해외면 true' } }, ['name']) },
    { name: 'watch_flight', description: '항공권 가격 지켜보기 등록 (매주 확인·알림)', params: brS({ dest: brStr('도착 도시'), from: brStr('출발 공항, 기본 인천'), when: brStr('여행 시기'), nights: brNum('몇 박'), target: brNum('선택: 1인 왕복 목표가(원)') }, ['dest', 'when']) },
    { name: 'propose_ledger', description: '가계부 기록 확인 카드 띄우기 (사용자가 눌러야 저장)', params: brS({ text: brStr('예: 점심 김밥천국 12000 카드') }, ['text']) },
    { name: 'draft_message', description: '가족 채팅·문자·카톡 보낼 말 초안 카드 (사용자가 눌러야 전송)', params: brS({ to: brStr('아내|남편|가족채팅|사람 이름'), text: brStr('보낼 내용') }, ['text']) },
    { name: 'open_app', description: '화면·앱 열기: 길찾기, 음악, 영상, 택배, 산행기록, 항공권, 저축 화면 등', params: brS({ what: brStr('navigate|music|video|parcels|hikelog|flights|save|schedule|ledger|travel|map'), arg: brStr('목적지·검색어 등') }, ['what']) },
];

// ── 도구 실행 ──
const brLog = [];   // 이번 요청에서 저장한 것 (되돌리기용) {col, id}
async function brRun(name, a) {
    a = a || {};
    const me = famUser() || '정우설';
    switch (name) {
        case 'list_schedules': {
            const k = (a.keyword || '').toLowerCase();
            const r = (brG('schData') || []).filter(s => s.date >= a.from && s.date <= a.to && (!k || String(s.memo + ' ' + (s.place || '')).toLowerCase().includes(k)))
                .sort((x, y) => (x.date + (x.startTime || '')).localeCompare(y.date + (y.startTime || ''))).slice(0, 60)
                .map(s => ({ date: s.date, time: s.startTime || '', title: s.memo, place: s.place || '', member: s.member || '공통' }));
            return { count: r.length, items: r };
        }
        case 'free_days': {
            const busy = new Set((brG('schData') || []).map(s => s.date)), out = [];
            const holi = typeof famHoli === 'function' ? famHoli : () => '';
            for (let d = new Date(a.from + 'T00:00:00'); brYmd(d) <= a.to && out.length < 60; d.setDate(d.getDate() + 1)) {
                const y = brYmd(d), wd = d.getDay(), h = brSafe(() => holi(y)) || '';
                if (!busy.has(y) && (wd === 0 || wd === 6 || h)) out.push(`${y}(${'일월화수목금토'[wd]})${h ? ' ' + h : ''}`);
            }
            return { free_weekend_or_holiday: out, note: '평일은 출근일이라 제외. 일정이 있는 날도 제외.' };
        }
        case 'query_ledger': {
            const k = (a.keyword || '').toLowerCase(), t = a.type && a.type !== '전체' ? a.type : '', m = a.member && a.member !== '전체' ? a.member : '';
            const rows = (typeof anaAll === 'function' ? anaAll() : []).filter(e => e.date >= a.from && e.date <= a.to && (!t || e.type === t) && (!m || e._m === m) && (!k || String(e.memo + ' ' + e.category).toLowerCase().includes(k)));
            const sum = x => rows.filter(e => e.type === x).reduce((s, e) => s + e.amt, 0), cat = {};
            rows.filter(e => e.type === '지출').forEach(e => cat[e.category] = (cat[e.category] || 0) + e.amt);
            return { 지출: brW(sum('지출')), 수입: brW(sum('수입')), 건수: rows.length, 분류별: Object.entries(cat).sort((x, y) => y[1] - x[1]).slice(0, 10).map(([c, v]) => `${c} ${brW(v)}`),
                큰_지출: rows.filter(e => e.type === '지출').sort((x, y) => y.amt - x.amt).slice(0, 8).map(e => `${e.date} ${e.memo || e.category} ${brW(e.amt)}`) };
        }
        case 'weather': {
            const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(a.place)}&count=1&language=ko`)).json().catch(() => ({}));
            const p = (g.results || [])[0]; if (!p) return { error: '장소 좌표를 못 찾음. 더 큰 지명(시·군)으로 다시' };
            const [w, q] = await Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=Asia%2FSeoul&forecast_days=16`).then(r => r.json()).catch(() => ({})),
                fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.latitude}&longitude=${p.longitude}&hourly=pm10,pm2_5&timezone=Asia%2FSeoul&forecast_days=5`).then(r => r.json()).catch(() => ({}))]);
            const d = w.daily, i = d ? d.time.indexOf(a.date) : -1;
            if (i < 0) return { place: p.name, error: '예보 범위(16일) 밖. 평년 기후로 판단' };
            const c = d.weather_code[i], sky = c <= 1 ? '맑음' : c <= 3 ? '구름' : c <= 48 ? '안개' : c <= 67 ? '비' : c <= 77 ? '눈' : c <= 82 ? '소나기' : '뇌우';
            let pm = '';
            if (q.hourly) { const idx = q.hourly.time.map((t, k) => t.startsWith(a.date) && +t.slice(11, 13) >= 9 && +t.slice(11, 13) <= 17 ? k : -1).filter(k => k >= 0); if (idx.length) pm = `PM10 ${Math.round(idx.reduce((s, k) => s + q.hourly.pm10[k], 0) / idx.length)}, PM2.5 ${Math.round(idx.reduce((s, k) => s + q.hourly.pm2_5[k], 0) / idx.length)}`; }
            return { place: p.name, date: a.date, sky, temp: `${Math.round(d.temperature_2m_min[i])}~${Math.round(d.temperature_2m_max[i])}°C`, rain: d.precipitation_probability_max[i] + '%', wind: d.wind_speed_10m_max[i] + 'km/h', sunrise: String(d.sunrise[i]).slice(11), sunset: String(d.sunset[i]).slice(11), dust: pm || '5일 밖' };
        }
        case 'web_search': {
            const r = await famCallAI('웹검색으로 사실을 확인해 한국어로 핵심만 정리한다. 이름·위치·가격·시간 등 구체적으로. 확인 안 된 것은 "확인 필요".', a.query, { search: true, maxTokens: 2500 });
            (r.sources || []).forEach(s => brSrc.push(s));
            return { result: (r.text || '').slice(0, 5000) };
        }
        case 'search_app': {
            const k = String(a.keyword || '').toLowerCase(), hit = s => String(s || '').toLowerCase().includes(k), out = [];
            (brG('schData') || []).forEach(s => { if (hit(s.memo) || hit(s.place)) out.push(`일정 ${s.date} ${s.memo}`); });
            (typeof anaAll === 'function' ? anaAll() : []).forEach(e => { if (hit(e.memo)) out.push(`가계부 ${e.date} ${e.memo} ${brW(e.amt)}`); });
            (brG('planData') || []).forEach(p => { if (hit(p.loc) || hit(p.memo)) out.push(`여행 ${p.start} ${p.loc}`); });
            (brG('agNotes') || []).forEach(n => { if (hit(n.text)) out.push(`메모 ${n.text}`); });
            (brG('hikeLogs') || []).forEach(h => { if (hit(h.place)) out.push(`산행 ${h.date} ${h.place}`); });
            return { count: out.length, items: out.sort().reverse().slice(0, 40) };
        }
        case 'hike_info': {
            const done = typeof hikeM100Done === 'function' ? hikeM100Done() : [];
            return { visited: [...new Set((brG('hikeLogs') || []).map(h => h.place))].slice(0, 40), m100_done: done, m100_left: (brG('HIKE_M100') || []).filter(m => !done.includes(m)) };
        }
        case 'add_schedule': {
            const mem = ['정우설', '한미연', '공통'].includes(a.member) ? a.member : '공통', days = [];
            for (let d = new Date(a.date + 'T00:00:00'); brYmd(d) <= (a.end || a.date) && days.length < 14; d.setDate(d.getDate() + 1)) days.push(brYmd(d));
            const gid = days.length > 1 ? 'grp_' + Date.now() : null;
            for (let i = 0; i < days.length; i++) {
                const sid = 'sch_' + Date.now() + i;
                await db.collection('schedules').doc(sid).set({ id: sid, date: days[i], priority: '일반', member: mem, category: mem === '공통' ? '가족' : '개인', timeType: a.time ? 'timed' : 'allday', startTime: a.time || '', endTime: '', place: a.place || '', memo: a.title, repeat: null, by: 'AI', ...(gid ? { span: { groupId: gid, start: days[0], end: days[days.length - 1], idx: i, n: days.length } } : {}) });
                brLog.push({ col: 'schedules', id: sid, label: `📅 ${days[i]} ${a.time || ''} ${a.title}` });
            }
            return { ok: true, saved: days };
        }
        case 'add_reminder': {
            const at = new Date(a.at).getTime(); if (!at || at < Date.now()) return { error: '지난 시각이거나 형식 오류' };
            const whos = a.who === '둘 다' ? ['정우설', '한미연'] : [['정우설', '한미연'].includes(a.who) ? a.who : me];
            for (const o of whos) { const id = await agRemindAdd({ at, title: a.title, owner: o, kind: 'ai' }); brLog.push({ col: 'reminders', id, label: `⏰ ${agFmt(at)} ${a.title}${whos.length > 1 ? ' (' + o + ')' : ''}` }); }
            return { ok: true };
        }
        case 'save_note': {
            if (/(비밀번호|패스워드|카드\s*번호|계좌\s*번호|주민)/.test(a.text)) return { error: '비밀번호·카드·계좌·주민번호는 저장하지 않음' };
            const id = 'nt_' + Date.now(); await db.collection('notes').doc(id).set({ id, text: a.text, by: me, at: Date.now() });
            brLog.push({ col: 'notes', id, label: `📝 ${a.text}` }); return { ok: true };
        }
        case 'add_shopping': {
            for (const t of (a.items || []).slice(0, 15)) { const id = 'sh_' + Date.now() + Math.floor(Math.random() * 999); await db.collection('shoppingList').doc(id).set({ id, text: String(t).trim(), done: false, by: me, createdAt: Date.now() }); brLog.push({ col: 'shoppingList', id, label: `🛒 ${t}` }); }
            return { ok: true };
        }
        case 'add_wish': {
            const id = 'w_' + Date.now(); await db.collection('wishes').doc(id).set({ id, name: a.name, note: a.note || '', kind: a.abroad ? '해외' : '국내', type: '', from: 'AI', by: me, at: Date.now() });
            brLog.push({ col: 'wishes', id, label: `📍 가고 싶은 곳: ${a.name}` }); return { ok: true };
        }
        case 'watch_flight': {
            const id = 'fl_' + Date.now(); await db.collection('flightWatch').doc(id).set({ id, dest: a.dest, from: a.from || '인천', when: a.when || '', nights: +a.nights || 0, pax: 2, target: +a.target || 0, by: me, at: Date.now(), hist: [] });
            await db.collection('briefReq').add({ owner: me, type: 'flight', fid: id, at: Date.now() });
            brLog.push({ col: 'flightWatch', id, label: `✈️ ${a.dest} 항공권 지켜보기` }); return { ok: true, note: '가격 확인은 1분 안에 알림으로' };
        }
        case 'propose_ledger': brUi.push(() => famAssetCard(a.text)); return { ok: true, note: '확인 카드를 띄움. 사용자가 저장해야 기록됨' };
        case 'draft_message': brUi.push(() => brDraftCard(a.to, a.text)); return { ok: true, note: '초안 카드를 띄움. 사용자가 눌러야 전송' };
        case 'open_app': {
            const w = a.what, g = a.arg || '';
            const act = { navigate: () => naverRoute(g, typeof lfGeoFor === 'function' ? lfGeoFor(g) : null), music: () => musicPlay(g), video: () => videoSearch(g), parcels: () => parcelOpen(), hikelog: () => hikeLogSheet(), flights: () => flOpen(),
                save: () => { famFeedClose(); showSection('save-section'); }, schedule: () => g ? famGoSch(g) : (famFeedClose(), showSection('schedule-section')), ledger: () => { famFeedClose(); showSection('asset-cal-section'); }, travel: () => { famFeedClose(); showSection('travel-section'); }, map: () => mapOpen() }[w];
            if (!act) return { error: '모르는 화면' };
            brUi.push(act); return { ok: true };
        }
    }
    return { error: '없는 도구: ' + name };
}
let brUi = [], brSrc = [];

// 메시지 초안: 가족 채팅은 확인 후 전송, 그 밖엔 카톡·문자로 넘기기
function brDraftCard(to, text) {
    const fam = !to || /(아내|남편|여보|가족|채팅|미연|우설)/.test(to), id = 'dm' + Date.now();
    famFeedAdd(`<h5>✉️ ${famEsc(to || '가족 채팅')}에게 보낼 초안</h5><textarea id="${id}" class="fam-in" rows="3" style="width:100%">${famEsc(text)}</textarea>
        <div class="fam-btns">${fam ? `<button class="fam-btn pri" onclick="famChatSend(document.getElementById('${id}').value);this.closest('.ff-card').remove()">가족 채팅으로 보내기</button>` : ''}
        <button class="fam-btn" onclick="(window.Capacitor&&Capacitor.Plugins.SeolyeonNative&&Capacitor.Plugins.SeolyeonNative.kakaoShare?Capacitor.Plugins.SeolyeonNative.kakaoShare({text:document.getElementById('${id}').value}):famShare(document.getElementById('${id}').value))">카톡으로</button>
        <button class="fam-btn" onclick="brCopy(document.getElementById('${id}').value)">복사</button></div>`);
}

// ── 회사별 도구 호출 형식 ──
function brToolsFor(p) {
    if (p === 'claude') return BR_TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.params }));
    if (p === 'gemini') return [{ functionDeclarations: BR_TOOLS.map(t => ({ name: t.name, description: t.description, parameters: Object.keys(t.params.properties).length ? t.params : undefined })) }];
    return BR_TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.params } }));
}
async function brCall(p, key, model, system, msgs) {
    let r, j;
    if (p === 'claude') {
        r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model, max_tokens: 4000, system, tools: brToolsFor(p), messages: msgs }) });
        j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
        msgs.push({ role: 'assistant', content: j.content });
        return { text: j.content.filter(b => b.type === 'text').map(b => b.text).join(''), calls: j.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, args: b.input })) };
    }
    if (p === 'gemini') {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: msgs, tools: brToolsFor(p) }) });
        j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
        const parts = j.candidates?.[0]?.content?.parts || [];
        msgs.push({ role: 'model', parts });
        return { text: parts.map(x => x.text || '').join(''), calls: parts.filter(x => x.functionCall).map((x, i) => ({ id: 'g' + i, name: x.functionCall.name, args: x.functionCall.args })) };
    }
    r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...msgs], tools: brToolsFor(p) }) });
    j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status);
    const m = j.choices[0].message; msgs.push(m);
    return { text: m.content || '', calls: (m.tool_calls || []).map(c => ({ id: c.id, name: c.function.name, args: brSafe(() => JSON.parse(c.function.arguments)) || {} })) };
}
function brResults(p, msgs, res) {
    if (p === 'claude') msgs.push({ role: 'user', content: res.map(x => ({ type: 'tool_result', tool_use_id: x.id, content: JSON.stringify(x.out).slice(0, 12000) })) });
    else if (p === 'gemini') msgs.push({ role: 'user', parts: res.map(x => ({ functionResponse: { name: x.name, response: { result: x.out } } })) });
    else res.forEach(x => msgs.push({ role: 'tool', tool_call_id: x.id, content: JSON.stringify(x.out).slice(0, 12000) }));
}
const BR_STEP = { list_schedules: '일정 확인', free_days: '빈 날 찾기', query_ledger: '가계부 확인', weather: '날씨 확인', web_search: '웹 검색', search_app: '앱 기록 찾기', hike_info: '산행 기록 확인',
    add_schedule: '일정 저장', add_reminder: '알림 설정', save_note: '메모 저장', add_shopping: '장보기 추가', add_wish: '가볼 곳 추가', watch_flight: '항공권 등록', propose_ledger: '가계부 카드', draft_message: '메시지 초안', open_app: '화면 열기' };

// ── 실행 ──
async function famAgent(q) {
    const p = famProv(), key = (famKeys()[p] || '').trim();
    if (!key) return famAsk(q);
    const t0 = Date.now(), now = new Date(), me = famUser() || '정우설';
    const c = famFeedAdd('<span class="fam-spin"></span><span class="br-step">생각하는 중…</span>');
    const stepEl = () => c.querySelector('.br-step'), done = [];
    brLog.length = 0; brUi = []; brSrc = [];
    const hist = (typeof famAskHist !== 'undefined' ? famAskHist : []).slice(-4).map(h => `사용자: ${h.q}\n비서: ${String(h.a).slice(0, 1200)}`).join('\n\n');
    const system = `너는 정우설·한미연 부부(40대 후반, 자녀 없음, 청주 거주, 여행·등산 좋아함)의 가정 비서다. 지금 사용자는 ${me}.
지금: ${now.toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'short' })} (한국).
일하는 방식:
- 요청을 끝까지 처리한다. 필요한 도구를 여러 번 순서대로 쓴다 (예: 빈 날 찾기 → 날씨 → 웹검색으로 코스·식당 → 일정 저장 → 전날 알림).
- 사용자가 '잡아줘·넣어줘·알려줘·기억해'처럼 실행을 원하면 묻지 말고 합리적으로 정해서 저장한다. 고른 이유를 답에 짧게 밝힌다.
- 추천·조사만 원하면 저장하지 않는다. 돈 기록·메시지 전송은 propose_ledger·draft_message로 카드만 띄운다.
- 날짜·사실은 도구로 확인한 것만 쓴다. 모르면 '확인 필요'.
- 답은 한국어, 결론 먼저, 짧은 문단과 '- ' 목록. 과장 없이. 마크다운 제목(#) 쓰지 않음.
[집안 현황]
${brSnapshot() || '(없음)'}
${typeof agNotesCtx === 'function' ? agNotesCtx() : ''}${hist ? '[앞선 대화]\n' + hist : ''}`;
    const msgs = p === 'gemini' ? [{ role: 'user', parts: [{ text: q }] }] : [{ role: 'user', content: q }];
    let text = '', err = '';
    try {
        for (let i = 0; i < BR_MAX_STEPS; i++) {
            const r = await brCall(p, key, famModel(p), system, msgs);
            if (!r.calls.length) { text = r.text; break; }
            const res = [];
            for (const call of r.calls) {
                if (stepEl()) stepEl().textContent = (BR_STEP[call.name] || call.name) + ' 중…';
                let out; try { out = await brRun(call.name, call.args); } catch (e) { out = { error: e.message }; }
                done.push(call.name + (out && out.error ? '✗' : ''));
                res.push({ id: call.id, name: call.name, out });
            }
            brResults(p, msgs, res);
            if (i === BR_MAX_STEPS - 1) text = r.text || '여러 단계를 거쳤지만 마무리하지 못했습니다. 조금 더 구체적으로 말씀해 주세요.';
        }
    } catch (e) { err = e.message; }
    // 화면 그리기
    if (err && !text) c.innerHTML = '⚠️ ' + famEsc(err);
    else {
        const rid = 'br' + Date.now(); c.dataset.raw = text;
        const seen = new Set(), src = brSrc.filter(s => /^https?:/.test(s.url) && !seen.has(s.url) && seen.add(s.url)).slice(0, 5);
        c.innerHTML = `<div class="fam-ai" id="${rid}">${famMd(text || '처리했습니다.')}</div>
            ${brLog.length ? `<div class="br-done">${brLog.map(x => `<div>✅ ${famEsc(x.label)}</div>`).join('')}<button class="fam-btn" style="padding:4px 9px;font-size:12px;margin-top:4px" onclick="brUndo(this,'${famEsc(JSON.stringify(brLog.map(x => [x.col, x.id])))}')">모두 되돌리기</button></div>` : ''}
            ${src.length ? `<div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:6px">${src.map(s => `<a href="${famEsc(s.url)}" target="_blank" rel="noopener" style="display:block;font-size:11.5px;color:#2563eb;padding:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">↗ ${famEsc(s.title)}</a>`).join('')}</div>` : ''}
            <div class="fam-note" style="display:flex;align-items:center;gap:6px">${famEsc(FAM_NAMES[p])}${done.length ? ' · ' + done.length + '단계' : ''}<button onclick="famSpeak(this,'${rid}','ko-KR')" style="margin-left:auto;border:none;background:none;font-size:15px;cursor:pointer;padding:2px 4px">🔊</button></div>
            <div class="ff-ai-acts"><button onclick="brCopy(famAiText(this))">복사</button><button onclick="famShare(famAiText(this))">공유</button><button onclick="brRate(this,'${rid}',1)">👍</button><button onclick="brRate(this,'${rid}',-1)">👎</button></div>`;
        c.dataset.run = rid;
        if (typeof famAskHist !== 'undefined') { famAskHist.push({ q, a: text }); famAskAt = Date.now(); }
        brUi.forEach(f => { try { f(); } catch (e) {} });
    }
    // 실행 기록 (고칠 곳 찾기용)
    try { await db.collection('agentRuns').doc(c.dataset.run || 'br' + Date.now()).set({ q: q.slice(0, 300), tools: done, ok: !err, err: err.slice(0, 300), ms: Date.now() - t0, prov: p, by: me, at: Date.now(), answer: String(text).slice(0, 600) }); } catch (e) {}
}
function brCopy(t) { try { navigator.clipboard.writeText(String(t || '')).then(() => famToast('복사했습니다'), () => famToast('복사하지 못했습니다')); } catch (e) { famToast('복사하지 못했습니다'); } }
async function brUndo(btn, json) {
    btn.disabled = true;
    try { const b = db.batch(); JSON.parse(json).forEach(([col, id]) => b.delete(db.collection(col).doc(id))); await b.commit(); btn.parentElement.innerHTML = '↩️ 저장한 것을 모두 취소했습니다.'; }
    catch (e) { btn.disabled = false; famToast('되돌리지 못했습니다: ' + e.message); }
}
async function brRate(btn, rid, v) {
    btn.parentElement.querySelectorAll('button').forEach(b => { if (/👍|👎/.test(b.textContent)) b.style.opacity = b === btn ? 1 : .35; });
    let why = '';
    if (v < 0) why = prompt('어디가 아쉬웠나요? (선택, 고칠 때 참고)') || '';
    try { await db.collection('agentRuns').doc(rid).set({ rate: v, why: why.slice(0, 300) }, { merge: true }); famToast(v > 0 ? '고맙습니다' : '기록했습니다. 고칠 때 참고하겠습니다'); } catch (e) {}
}

// 설정 → 비서: 최근 실패·👎 기록 (복사해서 Claude에게 붙여 넣으면 고칠 곳을 찾기 쉬움)
async function brRunsOpen() {
    const s = await db.collection('agentRuns').orderBy('at', 'desc').limit(60).get().catch(() => null);
    const runs = s ? s.docs.map(d => d.data()) : [], bad = runs.filter(r => !r.ok || r.rate < 0);
    const txt = bad.map(r => `- ${new Date(r.at).toLocaleString('ko-KR')} [${r.by}] "${r.q}" → ${r.ok ? '👎 ' + (r.why || '') : '오류 ' + r.err} | 도구: ${(r.tools || []).join(',')} | 답: ${String(r.answer || '').slice(0, 120)}`).join('\n');
    famSheet(`<div class="fam-h"><b>비서 실행 기록</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note">최근 ${runs.length}건 중 오류·👎 ${bad.length}건 · 평균 ${runs.length ? Math.round(runs.reduce((a, r) => a + (r.ms || 0), 0) / runs.length / 1000) : 0}초</div>
        <div style="max-height:50vh;overflow:auto;font-size:12px;white-space:pre-wrap;background:#f8fafc;border-radius:10px;padding:8px">${famEsc(txt || '문제 기록이 없습니다.')}</div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="brCopy(${famEsc(JSON.stringify(txt))})">복사 (Claude에게 보내기용)</button></div>`);
}
