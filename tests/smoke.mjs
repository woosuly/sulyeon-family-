// 설연 자동 점검 — 앱을 가짜 Firebase·가짜 안드로이드로 띄워 핵심 동작을 돌려 봄
//   실행: node tests/smoke.mjs   (실패가 하나라도 있으면 종료 코드 1 → GitHub에서 배포 막힘)
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://app.test/';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const results = [];
let page, errors = [];

async function test(name, fn) {
    const before = errors.length;
    try { await fn(); if (errors.length > before) throw new Error('화면 오류: ' + errors.slice(before).join(' | ')); results.push([true, name]); console.log('  ✓', name); }
    catch (e) { results.push([false, name, e.message]); console.log('  ✗', name, '—', e.message.split('\n')[0]); }
}
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} 기대 ${JSON.stringify(b)}, 실제 ${JSON.stringify(a)}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg || '조건 불만족'); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// 가짜 안드로이드 앱 (네이티브 플러그인): 호출 기록 + 테스트에서 이벤트 보내기
const NATIVE = `(() => {
  window.__nativeCalls = []; window.__nl = {}; window.__queue = []; window.__targets = [];
  const ret = {
    cardQueueTake: () => ({ items: window.__queue.splice(0) }), readCardSms: () => { throw new Error('no'); },
    kakaoRooms: () => ({ allow: ['wife'], seen: [] }), msgApps: () => ({ allow: ['com.tencent.mm'], seen: [] }),
    replyTargets: () => ({ items: window.__targets }), replySend: () => ({ sent: true }), takeLaunchPush: () => ({}),
    cardState: () => ({}), lookupContacts: () => ({ names: {} }), apkInfo: () => ({ version: '1.37' }),
    findContact: a => ({ items: (a.names || []).includes('wife') ? [{ name: 'wife', number: '010-1234-5678', q: 'wife' }] : (a.names || []).includes('장모님') ? [{ name: '장모님', number: '010-2222-3333', q: '장모님' }] : [] }),
    callNumber: () => ({ direct: true }), ringerMode: () => ({ mode: window.__ringer == null ? 2 : window.__ringer })
  };
  const mk = name => new Proxy({}, { get: (t, k) => {
    if (typeof k === 'symbol' || k === 'then' || k === 'toJSON') return undefined;
    if (k === 'addListener') return (n, f) => { (window.__nl[n] = window.__nl[n] || []).push(f); return Promise.resolve({ remove() { window.__nl[n] = (window.__nl[n] || []).filter(x => x !== f); } }); };
    return (...a) => { window.__nativeCalls.push([name + '.' + k, a[0]]); try { return Promise.resolve(ret[k] ? ret[k](a[0]) : {}); } catch (e) { return Promise.reject(e); } };
  } });
  window.__emit = (n, d) => (window.__nl[n] || []).slice().forEach(f => f(d));
  const SR = { checkPermissions: async () => ({ speechRecognition: 'granted' }), requestPermissions: async () => ({ speechRecognition: 'granted' }), available: async () => ({ available: true }),
    start: () => new Promise(() => {}), stop: async () => {}, addListener: async () => ({ remove() {} }), removeAllListeners: async () => {} };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', isPluginAvailable: () => true, Plugins: { SeolyeonNative: mk('N'), SpeechRecognition: SR, App: mk('App'), PushNotifications: mk('Push') } };
})();`;

async function boot(browser, native) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 412, height: 900 } });
    await ctx.route('**/*', async r => {
        const u = new URL(r.request().url());
        if (u.origin + '/' === BASE) {
            const p = join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
            if (!existsSync(p)) return r.fulfill({ status: 404, body: '' });
            return r.fulfill({ status: 200, contentType: MIME[extname(p)] || 'application/octet-stream', body: readFileSync(p) });
        }
        if (u.host === 'www.gstatic.com' && u.pathname.includes('firebase-app-compat')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(join(ROOT, 'tests/mock-firebase.js')) });
        if (u.host === 'www.gstatic.com') return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
        if (u.pathname.includes('chart')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Chart=function(){return{destroy(){},update(){},data:{datasets:[]},options:{}}};window.Chart.register=function(){};' });
        // 지오코딩 가짜 응답: 다낭(도시) / 홍천 비발디파크(장소)
        if (u.host.startsWith('geocoding-api')) { const n = u.searchParams.get('name') || ''; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ results: /da nang|다낭/i.test(n) ? [{ name: '다낭', latitude: 16.07, longitude: 108.22, country_code: 'VN', country: '베트남', admin1: '다낭', population: 750000 }] : /hongcheon|홍천/i.test(n) ? [{ name: '홍천군', latitude: 37.69, longitude: 127.88, country_code: 'KR', country: '대한민국', admin1: '강원도', population: 70000 }] : [] }) }); }
        if (u.host.startsWith('nominatim')) { const q = u.searchParams.get('q') || ''; return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/비발디/.test(q) ? [{ lat: '37.65', lon: '127.68', display_name: '비발디파크, 홍천군, 강원특별자치도, 대한민국', address: { country_code: 'kr', country: '대한민국', state: '강원특별자치도', county: '홍천군' } }] : /다낭/.test(q) ? [{ lat: '35.1', lon: '129.0', display_name: '다낭식당, 부산, 대한민국', address: { country_code: 'kr', country: '대한민국', city: '부산' } }] : []) }); }
        if (u.host.includes('open-meteo')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ current_weather: { temperature: 11, weathercode: 0, is_day: 1, windspeed: 3 }, current: { temperature_2m: 11, weather_code: 0, is_day: 1 }, hourly: { time: [], temperature_2m: [], weathercode: [], precipitation_probability: [] }, daily: { time: [], weathercode: [], temperature_2m_max: [], temperature_2m_min: [], sunrise: [], sunset: [] } }) });
        if (r.request().resourceType() === 'image' || r.request().resourceType() === 'font' || r.request().resourceType() === 'stylesheet') return r.abort();
        return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
    });
    await ctx.addInitScript(() => { try { localStorage.setItem('chatUser', '정우설'); localStorage.setItem('famThemeMode', 'light'); } catch (e) {} });
    if (native) await ctx.addInitScript(NATIVE);
    page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE);
    await page.waitForFunction(() => typeof famRun === 'function' && typeof famAgent === 'function' && document.readyState === 'complete', null, { timeout: 20000 });
    await wait(2500);   // 로그인 뒤 데이터 연결·리스너 시작 대기
    return ctx;
}
// 사용자 입력 처리 경로: 끝 처리 함수들을 가로채 어디로 갔는지 기록
async function spyRoutes() {
    await page.evaluate(() => {
        window.__hits = [];
        const leaf = ['famAgent', 'famAsk', 'famSchCard', 'famAssetCard', 'agRemind', 'agNoteSave', 'flOpen', 'billAnswer', 'docAnswer', 'hikeM100Sheet', 'agBriefNow',
            'kurlyCart', 'baeminOpen', 'famShopAdd', 'ibCardFromText', 'musicPlay', 'videoSearch', 'famGo', 'showSection', 'famTranslateText', 'famSearch', 'mapOpen', 'famChatSend', 'callPerson', 'stOpen', 'roborockOpen', 'parcelLook'];
        leaf.forEach(n => { if (typeof window[n] === 'function') { const o = window[n]; window['__o_' + n] = o; window[n] = function () { window.__hits.push(n); return n === 'famShopAdd' ? Promise.resolve() : true; }; } });
    });
}
async function unspy() { await page.evaluate(() => Object.keys(window).filter(k => k.startsWith('__o_')).forEach(k => { window[k.slice(4)] = window[k]; delete window[k]; })); }
async function route(text) { return page.evaluate(t => { window.__hits = []; famRun(t); return window.__hits[0] || '(없음)'; }, text); }

const browser = await chromium.launch();
try {
    // ── 1. 웹(브라우저)으로 열기 ──
    console.log('\n[웹]');
    let ctx = await boot(browser, false);
    await test('앱이 오류 없이 뜸', async () => { ok(await page.evaluate(() => !!document.getElementById('home-cmd-input')), '홈 입력칸 없음'); });
    await test('모든 화면 열기', async () => {
        const ids = await page.evaluate(() => [...document.querySelectorAll('[id$="-section"]')].map(e => e.id));
        ok(ids.length >= 10, '화면 수가 너무 적음 ' + ids.length);
        for (const id of ids) { await page.evaluate(i => showSection(i), id); await wait(150); }
        await page.evaluate(() => showSection('main-section'));
    });
    await test('설정 열기', async () => { await page.evaluate(() => famOpenSettings()); await wait(400); await page.evaluate(() => { try { famSheetClose(); } catch (e) {} const m = document.querySelector('.modal[style*="flex"], #fam-settings'); if (m && m.style) m.style.display = 'none'; }); });
    await spyRoutes();
    const R = [
        ['내일 오후 3시 치과', 'famSchCard'],
        ['헬로 설연 내일 오후 3시 치과', 'famSchCard'],
        ['점심 12000원', 'famAssetCard'],
        ['내일 아침 8시에 장모님께 전화하라고 알려줘', 'agRemind'],
        ['주차 B2 34번 기억해줘', 'agNoteSave'],
        ['다낭 항공권 12월 말 알아봐 줘', 'famAgent'],
        ['항공권', 'flOpen'],
        ['관리비 얼마 나왔어?', 'billAnswer'],
        ['여권 만료 언제야?', 'docAnswer'],
        ['100대 명산 현황', 'hikeM100Sheet'],
        ['이번 주말 등산 어디 갈까?', 'agBriefNow'],
        ['우유, 계란 컬리에서 시켜줘', 'famShopAdd'],
        ['배민에서 치킨', 'baeminOpen'],
        ['와이프한테 최근 일주일 카톡 정리해 줘', 'famAgent'],
        ['오늘 위챗 뭐 왔어?', 'famAgent'],
        ['다음 주 제주도 2박 3일 여행 일정 짜줘', 'famAgent'],
        ['와이프한테 전화해 줘', 'callPerson'],
        ['헬로 설연 장모님께 전화 연결해 줘', 'callPerson'],
        ['내일 저녁 7시에 장모님께 전화하라고 알려줘', 'agRemind'],
    ];
    for (const [t, want] of R) await test(`입력 "${t}" → ${want}`, async () => eq(await route(t), want));
    await test('입력 처리: 한 기능이 오류를 내도 다음으로 넘어감', async () => {
        await page.evaluate(() => famRoute('시험 오류', 1, () => { throw new Error('boom'); }));
        const r = await route('내일 오후 3시 치과');
        await page.evaluate(() => { const i = famRoutes.findIndex(x => x.name === '시험 오류'); famRoutes.splice(i, 1); });
        eq(r, 'famSchCard');
    });
    await unspy();
    await test('여행 노트: 출장(해외 포함)은 💼 출장으로 따로', async () => {
        const r = await page.evaluate(() => ({ k: mapKind({ subType: '출장', mType: '해외' }), f: MAP_KIND.some(x => x[0] === '출장'), c: !!MAP_COLOR['출장'], ic: getTypeIcon('출장') }));
        eq(r, { k: '출장', f: true, c: true, ic: '💼' });
    });
    await test('여행 노트 위치: AI 정리 → 도시 좌표 (해외는 엉뚱한 국내 가게로 안 감)', async () => {
        const r = await page.evaluate(async () => {
            const ai = window.famCallAI;
            window.famCallAI = async (sys, user) => ({ text: /\|다낭 가족여행/.test(user) ? '[{"i":0,"place":"","city":"Da Nang","cityKo":"다낭","cc":"vn"}]' : '[{"i":0,"place":"비발디파크","city":"Hongcheon","cityKo":"홍천","cc":"kr"}]' });
            const a = await mapGeocode('다낭 가족여행 3박', false), b = await mapGeocode('홍천 비발디 캠핑', true);
            window.famCallAI = ai; return { a, b };
        });
        eq([r.a.cc, r.a.city, Math.round(r.a.lat)], ['vn', '다낭', 16], '다낭');
        eq([r.b.cc, r.b.sido, r.b.city, Math.round(r.b.lng * 10)], ['kr', '강원', '홍천', 1277], '홍천 비발디파크');
    });
    await test('여행 노트: 위치 고치기 창이 지도 화면 위에 뜸', async () => {
        const z = await page.evaluate(() => { mapOpen('stat'); famSheet('<b>x</b>'); const r = [getComputedStyle(document.getElementById('fam-sheet')).zIndex, getComputedStyle(document.getElementById('map-ov')).zIndex].map(Number); famSheetClose(); mapClose(); return r; });
        ok(z[0] > z[1], `시트 ${z[0]} ≤ 지도 ${z[1]}`);
    });
    await test('여행 노트 위치: 구글 키가 있으면 구글로 찾음', async () => {
        const r = await page.evaluate(async () => {
            const fk = window.famKeys, ai = window.famCallAI;
            window.famKeys = () => ({ ...fk(), gmaps: 'test' });
            window.famCallAI = async () => ({ text: '[{"i":0,"place":"","city":"Rome","cityKo":"로마","cc":"it"}]' });
            const comp = [{ types: ['country'], short_name: 'IT', long_name: '이탈리아' }, { types: ['locality'], short_name: 'Roma', long_name: '로마' }];
            window.google = { maps: { Map: function () {}, Geocoder: function () { this.geocode = async o => ({ results: o.componentRestrictions && o.componentRestrictions.country === 'it' ? [{ address_components: comp, formatted_address: '이탈리아 로마', geometry: { location: { lat: () => 41.9, lng: () => 12.5 } } }] : [] }); } } };
            const g = await mapGeocode('로마 신혼여행', false);
            window.famKeys = fk; window.famCallAI = ai; delete window.google;
            return g;
        });
        eq([r.v, r.cc, r.city, r.country], [3, 'it', '로마', '이탈리아']);
    });
    await test('비서 도구: 일정 추가 → 저장됨', async () => {
        const r = await page.evaluate(async () => { const before = Object.keys(window.__db).filter(k => k.startsWith('schedules/')).length; const x = await brRun('add_schedule', { date: '2026-12-23', end_date: '2026-12-27', memo: '시험 제주 여행', member: '공통' }); return { x, n: Object.keys(window.__db).filter(k => k.startsWith('schedules/')).length - before }; });
        ok(r.n >= 1, '일정 문서가 생기지 않음 ' + JSON.stringify(r.x));
    });
    await test('비서 도구: 메시지 조회가 기간·와이프로 찾음', async () => {
        const r = await page.evaluate(async () => {
            const now = Date.now();
            await db.collection('msgLog').doc('t1').set({ owner: '정우설', ts: now - 2 * 864e5, kind: 'kakao', app: '카톡', room: 'wife', from: 'wife', text: '저녁에 장 보고 갈게' });
            await db.collection('msgLog').doc('t2').set({ owner: '정우설', ts: now - 20 * 864e5, kind: 'kakao', app: '카톡', room: 'wife', from: 'wife', text: '오래된 메시지' });
            await db.collection('msgLog').doc('t3').set({ owner: '한미연', ts: now - 864e5, kind: 'kakao', app: '카톡', room: 'x', from: 'x', text: '남의 메시지' });
            return brRun('list_messages', { who: '와이프', days: 7 });
        });
        eq(r.count, 1, '찾은 수'); ok(r.messages[0].includes('장 보고'), '내용');
    });
    await ctx.close();

    // ── 2. 안드로이드 앱으로 열기 (가짜 네이티브) ──
    console.log('\n[안드로이드 앱]');
    ctx = await boot(browser, true);
    await test('앱이 오류 없이 뜸 (네이티브)', async () => { ok(await page.evaluate(() => typeof window.SpeechRecognition === 'function'), '음성 인식 없음'); });
    await test('음성: 말하는 동안 글자 표시 → 끝나면 바로 실행', async () => {
        await spyRoutes();
        await page.evaluate(() => { document.getElementById('home-cmd-input').value = ''; famGoBtn(); });
        await page.waitForFunction(() => window.__nativeCalls.some(c => c[0] === 'N.listenStart'), null, { timeout: 5000 });
        const sid = await page.evaluate(() => window.__nativeCalls.filter(c => c[0] === 'N.listenStart').pop()[1].sid);
        await page.evaluate(s => window.__emit('ear', { type: 'partial', text: '내일 오후 3시', sid: s }), sid);
        eq(await page.inputValue('#home-cmd-input'), '내일 오후 3시', '중간 글자');
        await page.evaluate(s => { window.__emit('ear', { type: 'final', text: '내일 오후 3시 치과', sid: s }); window.__emit('ear', { type: 'end', sid: s }); }, sid);
        await wait(200);
        eq(await page.evaluate(() => window.__hits[0]), 'famSchCard', '실행 경로');
        await unspy();
    });
    await test('음성: 위젯 마이크로 열기 → 듣기 시작', async () => {
        await page.evaluate(() => { window.__nativeCalls.length = 0; window.__emit('pushOpen', { k: 'voice', id: '' }); });
        await page.waitForFunction(() => window.__nativeCalls.some(c => c[0] === 'N.listenStart'), null, { timeout: 5000 });
        await page.evaluate(() => { const s = window.__nativeCalls.filter(c => c[0] === 'N.listenStart').pop()[1].sid; window.__emit('ear', { type: 'end', sid: s }); });
    });
    await test('메시지 받기: 카톡 → 정리 + 원문 기록', async () => {
        const r = await page.evaluate(async () => {
            window.famCallAI = async () => ({ text: '[{"i":0,"skip":true}]' });
            window.__queue.push({ text: '오늘 저녁 7시에 같이 밥 먹자', ts: Date.now(), from: 'wife', kind: 'kakao', room: 'wife' });
            window.__queue.push({ text: '张总：明天上午10点开会', ts: Date.now(), from: '张总', kind: 'app', room: '工作群', app: '위챗', pkg: 'com.tencent.mm' });
            await ibDrain();
            const ks = Object.keys(window.__db);
            return { inbox: ks.filter(k => k.startsWith('inbox/')).map(k => window.__db[k]), log: ks.filter(k => k.startsWith('msgLog/')).map(k => window.__db[k]) };
        });
        eq(r.log.length, 2, '원문 기록 수');
        ok(r.inbox.some(x => x.room === 'wife' && x.type === '메시지'), '카톡 메시지가 확인 대기에 없음');
        ok(r.inbox.some(x => x.kind === 'app' && x.app === '위챗'), '위챗 메시지가 확인 대기에 없음');
    });
    await test('메시지 받기: 정리 중에 또 부르면 끝날 때까지 기다림 + 보이스톡 알림은 버림', async () => {
        const r = await page.evaluate(async () => {
            window.famCallAI = async () => { await new Promise(r => setTimeout(r, 400)); return { text: '[{"i":0,"skip":true}]' }; };
            window.__queue.push({ text: '보이스톡 통화 중', ts: Date.now(), from: '정우량', kind: 'kakao', room: 'wife' });
            window.__queue.push({ text: '오늘 늦어?', ts: Date.now() + 1, from: 'wife', kind: 'kakao', room: 'wife' });
            const before = Object.keys(window.__db).filter(k => k.startsWith('msgLog/')).length;
            const p1 = ibDrain(); const p2 = ibDrain();   // 앱 시작 정리 + 알림 눌러 정리
            await p2;
            const logs = Object.keys(window.__db).filter(k => k.startsWith('msgLog/')).map(k => window.__db[k].text);
            return { same: p1 === p2, added: logs.length - before, voice: logs.some(t => /보이스톡/.test(t)) };
        });
        ok(r.same, '두 번째 호출이 기다리지 않음'); eq(r.added, 1, '기록 수'); ok(!r.voice, '보이스톡 알림이 기록됨');
    });
    await test('바로 보내기: 와이프 → wife 카톡방', async () => {
        const r = await page.evaluate(async () => { window.__targets = [{ pkg: 'com.kakao.talk', app: '카카오톡', room: 'wife', ts: Date.now() }]; return brTargetFor('와이프'); });
        ok(r && r.room === 'wife', '대상 못 찾음');
    });
    await test('전화: "와이프한테 전화해 줘" → wife 연락처로 2초 뒤 걸기', async () => {
        await page.evaluate(() => { window.__nativeCalls.length = 0; famRun('와이프한테 전화해 줘'); });
        await page.waitForFunction(() => window.__nativeCalls.some(c => c[0] === 'N.callNumber'), null, { timeout: 5000 });
        eq(await page.evaluate(() => window.__nativeCalls.find(c => c[0] === 'N.callNumber')[1].number), '010-1234-5678');
    });
    await test('전화: 취소하면 걸지 않음', async () => {
        await page.evaluate(() => { window.__nativeCalls.length = 0; famRun('장모님께 전화 걸어 줘'); });
        await page.waitForFunction(() => document.querySelector('[id^="call"] button'), null, { timeout: 5000 });
        await page.evaluate(() => document.querySelector('[id^="call"] button').click());
        await wait(2500);
        ok(!(await page.evaluate(() => window.__nativeCalls.some(c => c[0] === 'N.callNumber'))), '취소했는데 걸었음');
    });
    await test('말로 물은 답: 팝업으로 보여 주고 읽어드릴까요?', async () => {
        await page.evaluate(() => { famVoiceMark(); famAnswerHook('가계부 요약해 줘', '**이번 달 지출** 120만 원입니다.'); });
        const r = await page.evaluate(() => { const m = document.getElementById('va-pop'); return m && m.style.display === 'flex' ? m.querySelector('.va-t').textContent : ''; });
        ok(r.includes('이번 달 지출 120만 원'), '팝업 내용 ' + r);
        await page.evaluate(() => { vaHide(); famAnswerHook('x', '손으로 친 요청'); });
        ok(await page.evaluate(() => document.getElementById('va-pop').style.display !== 'flex'), '말로 묻지 않았는데 팝업이 뜸');
    });
    await test('알림음: 휴대폰이 진동·무음이면 소리 안 냄', async () => {
        const r = await page.evaluate(async () => {
            let n = 0; const AC = window.AudioContext; window.AudioContext = function () { n++; return new AC(); };
            const out = {};
            for (const m of [0, 1, 2]) { window.__ringer = m; n = 0; await famChime(); out[m] = n; }
            window.AudioContext = AC; return out;
        });
        eq(r, { 0: 0, 1: 0, 2: 1 }, '모드별 소리 횟수');
    });
    await test('위젯: 데이터 보내기', async () => {
        await page.evaluate(() => { window.__nativeCalls.length = 0; wgPush(true); });
        const d = await page.evaluate(() => (window.__nativeCalls.find(c => c[0] === 'N.widgetSet') || [])[1]);
        ok(d && Array.isArray(d.items) && typeof d.cards === 'number' && d.w && d.w.lat, '위젯 데이터 모양이 다름 ' + JSON.stringify(d));
    });
    await ctx.close();

    // ── 3. 파일 점검 ──
    console.log('\n[파일]');
    await test('index.html이 부르는 스크립트 파일이 모두 있음', async () => {
        const html = readFileSync(join(ROOT, 'index.html'), 'utf8'), miss = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]).filter(f => !existsSync(join(ROOT, f)));
        eq(miss, [], '없는 파일');
    });
    await test('sw.js 캐시 목록에 스크립트가 모두 있음 (빠지면 오프라인·새 버전에서 안 뜸)', async () => {
        const html = readFileSync(join(ROOT, 'index.html'), 'utf8'), sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
        eq([...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]).filter(f => !sw.includes(`'${f}'`)), [], 'sw.js에 없는 파일');
    });
} finally { await browser.close(); }

const fail = results.filter(r => !r[0]);
console.log(`\n${results.length - fail.length}/${results.length} 통과`);
if (fail.length) { fail.forEach(f => console.log('실패:', f[1], '—', f[2])); process.exit(1); }
