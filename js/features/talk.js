// ═══════════════════════════════════════════════════════════
// 🌐 여행 통역 (v75 새로 구성)
//   대화 : 두 사람 마이크 · 입력 · 원문/번역/한글 발음 · 자동 읽어주기 · 크게 보여주기 · 마주보기
//   사진 : 메뉴판(음식 설명·주의 표시·주문 문장) / 안내문 / 일반 글
//   문장집 : 여행지 언어로 상황별 문장 생성·폰에 저장(오프라인) · ⭐ 즐겨찾기 부부 공유
//   AI : ⚙️ 설정의 키 사용 (Gemini 키가 있으면 응답이 빠른 Gemini 우선)
//   저장 : talkFavs(즐겨찾기), talkPacks(문장집 공유 캐시) / 대화 기록은 이 폰에만
// ═══════════════════════════════════════════════════════════
const TALK_LANGS = [
    ['ko', '한국어', 'ko-KR', '🇰🇷', '한국어'], ['en', '영어', 'en-US', '🇺🇸', 'English'], ['ja', '일본어', 'ja-JP', '🇯🇵', '日本語'],
    ['zh', '중국어', 'zh-CN', '🇨🇳', '中文'], ['zh-TW', '중국어(번체)', 'zh-TW', '🇹🇼', '中文(繁體)'], ['it', '이탈리아어', 'it-IT', '🇮🇹', 'Italiano'],
    ['fr', '프랑스어', 'fr-FR', '🇫🇷', 'Français'], ['es', '스페인어', 'es-ES', '🇪🇸', 'Español'], ['de', '독일어', 'de-DE', '🇩🇪', 'Deutsch'],
    ['pt', '포르투갈어', 'pt-PT', '🇵🇹', 'Português'], ['nl', '네덜란드어', 'nl-NL', '🇳🇱', 'Nederlands'], ['cs', '체코어', 'cs-CZ', '🇨🇿', 'Čeština'],
    ['hu', '헝가리어', 'hu-HU', '🇭🇺', 'Magyar'], ['hr', '크로아티아어', 'hr-HR', '🇭🇷', 'Hrvatski'], ['el', '그리스어', 'el-GR', '🇬🇷', 'Ελληνικά'],
    ['tr', '튀르키예어', 'tr-TR', '🇹🇷', 'Türkçe'], ['ru', '러시아어', 'ru-RU', '🇷🇺', 'Русский'], ['vi', '베트남어', 'vi-VN', '🇻🇳', 'Tiếng Việt'],
    ['th', '태국어', 'th-TH', '🇹🇭', 'ไทย'], ['id', '인도네시아어', 'id-ID', '🇮🇩', 'Bahasa Indonesia']
];
const TALK_TAP = { ko: '눌러서 말하기', en: 'Tap to speak', ja: 'タップして話す', zh: '点击说话', 'zh-TW': '點擊說話', it: 'Tocca per parlare', fr: 'Touchez pour parler', es: 'Toca para hablar', de: 'Tippen zum Sprechen', pt: 'Toque para falar', nl: 'Tik om te spreken', cs: 'Klepněte a mluvte', hu: 'Koppintson és beszéljen', hr: 'Dodirnite i govorite', el: 'Πατήστε για να μιλήσετε', tr: 'Konuşmak için dokunun', ru: 'Нажмите и говорите', vi: 'Chạm để nói', th: 'แตะเพื่อพูด', id: 'Ketuk untuk bicara' };
const TALK_WAIT = { ko: '번역 중…', en: 'Translating…', ja: '翻訳中…', zh: '翻译中…', 'zh-TW': '翻譯中…', it: 'Traduzione…', fr: 'Traduction…', es: 'Traduciendo…', de: 'Übersetze…', pt: 'Traduzindo…' };
// 여행지 → 언어 (여행 계획 목적지로 자동 제안)
const TALK_DEST = [[/일본|도쿄|오사카|교토|후쿠오카|삿포로|오키나와|나고야/, 'ja'], [/대만|타이베이|타이중|가오슝/, 'zh-TW'], [/홍콩|마카오/, 'zh-TW'], [/중국|상하이|베이징|칭다오|우시|쿤산|푸저우|복주|항저우|청두|장가계/, 'zh'],
    [/이탈리아|로마|밀라노|베네치아|베니스|피렌체|나폴리|토스카나|돌로미티|시칠리아/, 'it'], [/프랑스|파리|니스|리옹|마르세유|몽생미셸|샤모니/, 'fr'], [/스페인|바르셀로나|마드리드|세비야|그라나다|발렌시아/, 'es'],
    [/독일|베를린|뮌헨|프랑크푸르트|함부르크|오스트리아|빈|잘츠부르크|인스브루크|스위스|취리히|인터라켄|루체른|체르마트|융프라우/, 'de'], [/포르투갈|리스본|포르투/, 'pt'], [/네덜란드|암스테르담/, 'nl'],
    [/체코|프라하|체스키/, 'cs'], [/헝가리|부다페스트/, 'hu'], [/크로아티아|두브로브니크|자그레브|스플리트|플리트비체/, 'hr'], [/그리스|아테네|산토리니/, 'el'], [/튀르키예|터키|이스탄불|카파도키아/, 'tr'],
    [/러시아|모스크바|블라디보스토크/, 'ru'], [/베트남|다낭|하노이|호치민|나트랑|푸꾸옥|하롱/, 'vi'], [/태국|방콕|치앙마이|푸껫|파타야|끄라비/, 'th'], [/인도네시아|발리|자카르타/, 'id'],
    [/미국|영국|호주|캐나다|뉴질랜드|뉴욕|런던|하와이|괌|사이판|싱가포르|필리핀|세부|보라카이|LA|시드니/, 'en']];
const TALK_SITS = [['food', '🍽', '식당'], ['cafe', '☕', '카페·빵집'], ['hotel', '🏨', '호텔'], ['move', '🚕', '교통·택시'], ['shop', '🛍', '쇼핑'],
    ['drug', '💊', '약국·병원'], ['way', '🧭', '길 묻기'], ['air', '✈️', '공항'], ['hike', '⛰️', '산행·캠핑'], ['sos', '🆘', '긴급 상황']];
const TALK_SIT_HINT = { hike: '산장·트레킹 코스·케이블카·날씨·길 상태·캠핑장 체크인', sos: '도움 요청·분실·도난·경찰·구급차·대사관 연락', drug: '증상 설명·약 구입·복용법·알레르기', move: '택시 목적지·요금·기차·버스 표 구입·환승' };

const tLang = c => TALK_LANGS.find(l => l[0] === c) || TALK_LANGS[1];
const tLS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
const talk = {
    me: 'ko', them: tLS('talkThem') || 'en', tab: 'conv', auto: tLS('talkAuto') !== false,
    hist: tLS('talkHist') || [], favs: [], sit: '', photoMode: 'menu', photo: null, busy: 0, rec: null, recSide: ''
};
let talkFavUnsub = null, talkLock = null;

// ── AI ──
function talkProv() { const k = famKeys(); return k.gemini ? 'gemini' : famProv(); }
function talkHasKey() { return !!(famKeys()[talkProv()] || ''); }
async function talkAI(system, user, opt) {
    opt = opt || {};
    return (await famCallAI(system, user, { provider: talkProv(), maxTokens: opt.max || 900, image: opt.image })).text || '';
}
function talkJSON(t) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('응답을 읽지 못했습니다'); return JSON.parse(t.slice(a, b + 1)); }
const TALK_SYS = '너는 해외여행 중인 한국인 부부를 돕는 통역사다. 현지에서 실제로 쓰는 자연스럽고 공손한 말투로 옮긴다. 지시한 JSON만 출력한다.';
async function talkTranslate(text, from, to) {
    const F = tLang(from), T = tLang(to);
    const raw = await talkAI(TALK_SYS, `${F[1]}(${F[0]}) → ${T[1]}(${T[0]}) 번역.
JSON: {"tr":"번역문","pron":"${to === 'ko' ? '' : '번역문을 한국어로 소리 나는 대로 적은 발음'}"}
원문: ${text}`, { max: 700 });
    try { const j = talkJSON(raw); return { tr: String(j.tr || '').trim(), pron: String(j.pron || '').trim() }; }
    catch (e) { return { tr: raw.trim(), pron: '' }; }
}

// ── 읽어주기 ──
function talkVoices() { try { return speechSynthesis.getVoices() || []; } catch (e) { return []; } }
try { speechSynthesis.onvoiceschanged = () => talkVoices(); } catch (e) {}
function talkSpeak(text, code) {
    const ss = window.speechSynthesis; if (!ss || !text) return;
    ss.cancel();
    const sr = tLang(code)[2], u = new SpeechSynthesisUtterance(text); u.lang = sr; u.rate = 0.92;
    const vs = talkVoices(), v = vs.find(x => (x.lang || '').replace('_', '-').toLowerCase() === sr.toLowerCase()) || vs.find(x => (x.lang || '').toLowerCase().startsWith(sr.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    ss.speak(u);
}

// ── 화면 ──
function talkRender() {
    const root = document.getElementById('talk-root'); if (!root) return;
    const M = tLang(talk.me), T = tLang(talk.them), sug = talkTripLang();
    root.innerHTML = `
        <div class="tk-top">
            <div class="tk-lang fixed">${M[3]} ${M[1]}</div>
            <span class="tk-swap">↔</span>
            <button class="tk-lang them" onclick="talkPickLang()">${T[3]} ${T[1]} <span>▾</span></button>
        </div>
        ${sug && sug.lang !== talk.them ? `<button class="tk-sug" onclick="talkSetThem('${sug.lang}')">${famEsc(sug.loc)} 여행 → ${tLang(sug.lang)[1]}로 바꾸기</button>` : ''}
        ${!navigator.onLine ? `<div class="tk-sug warn">인터넷 연결 없음 · 저장해 둔 문장집과 내 문장만 쓸 수 있습니다</div>` : talkHasKey() ? '' : `<button class="tk-sug warn" onclick="famOpenSettings()">AI 키를 먼저 설정하세요 (Gemini 권장)</button>`}
        <div class="tk-seg">${[['conv', fi('chat') + '번역'], ['photo', fi('camera') + '사진'], ['book', fi('book') + '문장집']].map(([k, n]) => `<button class="${talk.tab === k ? 'on' : ''}" onclick="talkTab('${k}')">${n}</button>`).join('')}</div>
        <div class="tk-body" id="tk-body"></div>
        <div class="tk-dock" id="tk-dock" ${talk.tab === 'conv' ? '' : 'style="display:none"'}>
            <div class="tk-input"><textarea id="tk-txt" rows="1" enterkeyhint="send" placeholder="입력하면 언어를 알아서 판단합니다" oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,96)+'px'" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();talkSendText()}"></textarea><button onclick="talkSendText()" title="번역">${fi('send')}</button></div>
            <div class="tk-mics">
                <button class="tk-mic me" id="tk-mic-me" onclick="talkMic('me')"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></b><span>${M[3]} ${M[1]}</span></button>
                <button class="tk-face-btn" onclick="talkFace()" title="마주보기">↕<small>마주보기</small></button>
                <button class="tk-mic them" id="tk-mic-them" onclick="talkMic('them')"><b><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></b><span>${T[3]} ${famEsc(T[4])}</span></button>
            </div>
            <div class="tk-sub"><label><input type="checkbox" ${talk.auto ? 'checked' : ''} onchange="talk.auto=this.checked;tLS('talkAuto',this.checked)"> 번역 자동 읽어주기</label><button onclick="talkClear()">대화 지우기</button></div>
        </div>`;
    talkBody();
}
function talkTab(t) { talk.tab = t; talkRender(); }
function talkBody() {
    const b = document.getElementById('tk-body'); if (!b) return;
    if (talk.tab === 'conv') {
        const list = talk.hist.filter(h => h.lang === talk.them);
        b.innerHTML = list.length ? list.map(talkMsgHtml).join('') + '<div id="tk-live"></div>' : `
            <div class="tk-empty">
                <b>${tLang(talk.them)[3]} ${tLang(talk.them)[1]} 대화</b>
                <p>글로 쓰거나 아래 마이크를 누르고 말하면 번역해서 읽어줍니다.<br>왼쪽은 우리, 오른쪽은 상대방 버튼입니다.</p>
            </div><div id="tk-live"></div>`;
        b.scrollTop = b.scrollHeight;
    } else if (talk.tab === 'photo') talkPhotoBody(b);
    else talkBookBody(b);
}
function talkMsgHtml(h) {
    const mine = h.side === 'me', to = mine ? h.lang : 'ko';
    return `<div class="tk-msg ${mine ? 'me' : 'them'}">
        <div class="tk-src">${famEsc(h.src)}</div>
        <div class="tk-tr">${famEsc(h.tr)}</div>
        ${h.pron ? `<div class="tk-pron">[${famEsc(h.pron)}]</div>` : ''}
        <div class="tk-act"><button onclick="talkSpeak(talkH('${h.id}').tr,'${to}')" title="읽기">${fi('speaker')}</button><button onclick="talkBig('${h.id}')">${fi('expand')}크게</button>${mine ? `<button class="${talkIsFav(h.lang, h.tr) ? 'on' : ''}" onclick="talkFavToggle('${h.id}')">${fi('star')}${talkIsFav(h.lang, h.tr) ? '내 문장' : '저장'}</button>` : ''}</div>
    </div>`;
}
const talkH = id => talk.hist.find(h => h.id === id) || {};
function talkSave() { talk.hist = talk.hist.slice(-150); tLS('talkHist', talk.hist); }
function talkClear() { if (!confirm(`${tLang(talk.them)[1]} 대화 기록을 지울까요?`)) return; talk.hist = talk.hist.filter(h => h.lang !== talk.them); talkSave(); talkBody(); }

// ── 언어 선택 ──
function talkPickLang() {
    famSheet(`<div class="fam-h"><b>상대방 언어</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="tk-langs">${TALK_LANGS.filter(l => l[0] !== 'ko').map(l => `<button class="${l[0] === talk.them ? 'on' : ''}" onclick="talkSetThem('${l[0]}');famSheetClose()"><span>${l[3]}</span>${l[1]}<small>${famEsc(l[4])}</small></button>`).join('')}</div>`);
}
function talkSetThem(c) { talk.them = c; tLS('talkThem', c); talk.sit = ''; talkFavListen(); talkRender(); }
function talkTripLang() {
    const t = famYmd(new Date()), lim = new Date(); lim.setDate(lim.getDate() + 60); const l2 = famYmd(lim);
    const trips = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && (p.end || p.start) >= t && p.start <= l2).sort((a, b) => a.start.localeCompare(b.start));
    for (const p of trips) { const s = `${p.loc || ''} ${p.memo || ''}`; const m = TALK_DEST.find(([re]) => re.test(s)); if (m) return { lang: m[1], loc: p.loc || '' }; }
    return null;
}

// ── 말하기 ──
function talkMic(side) {
    if (talk.rec) { const same = talk.recSide === side; try { talk.rec.stop(); } catch (e) {} if (same) return; }
    if (!talkHasKey()) { famOpenSettings(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { famToast('이 브라우저는 음성 인식을 지원하지 않습니다. 크롬에서 열어 주세요'); return; }
    try { speechSynthesis.cancel(); } catch (e) {}
    const lang = side === 'me' ? talk.me : talk.them, r = new SR(); talk.rec = r; talk.recSide = side;
    r.lang = tLang(lang)[2]; r.interimResults = true; r.continuous = false;
    const btn = document.getElementById('tk-mic-' + side); if (btn) btn.classList.add('on');
    const fb = document.getElementById('tkf-mic-' + side); if (fb) fb.classList.add('on');
    let text = '';
    r.onresult = e => { text = ''; for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript; talkLive(side, text); };
    r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') famToast('마이크 권한을 허용해 주세요'); else if (e.error === 'network') famToast('음성 인식은 인터넷 연결이 필요합니다'); };
    r.onend = () => {
        talk.rec = null; talk.recSide = '';
        document.querySelectorAll('.tk-mic.on,.tkf-mic.on').forEach(x => x.classList.remove('on'));
        talkLive(side, '');
        if (text.trim()) talkRun(side, text.trim());
    };
    try { r.start(); } catch (e) { talk.rec = null; famToast('음성 입력을 시작하지 못했습니다'); }
}
function talkLive(side, text) {
    const el = document.getElementById('tk-live'); if (el) { el.innerHTML = text ? `<div class="tk-msg ${side} live"><div class="tk-tr">${famEsc(text)}</div></div>` : ''; const b = document.getElementById('tk-body'); if (b) b.scrollTop = b.scrollHeight; }
    const fs = document.getElementById('tkf-said-' + side); if (fs) fs.textContent = text;
}
function talkSendText() {
    const el = document.getElementById('tk-txt'), v = (el.value || '').trim(); if (!v) return;
    el.value = ''; el.style.height = 'auto';
    talkRun(/[가-힣]/.test(v) ? 'me' : 'them', v);
}
async function talkRun(side, text) {
    if (!talkHasKey()) { famOpenSettings(); return; }
    const from = side === 'me' ? talk.me : talk.them, to = side === 'me' ? talk.them : talk.me;
    const id = 't' + Date.now(), lang = talk.them;
    const h = { id, side, lang, src: text, tr: '…', pron: '', at: Date.now() };
    talk.hist.push(h); if (talk.tab === 'conv') talkBody();
    talkFaceOut(side === 'me' ? 'them' : 'me', TALK_WAIT[tLang(to)[0]] || TALK_WAIT.en, true);
    try {
        const r = await talkTranslate(text, from, to);
        h.tr = r.tr || '—'; h.pron = r.pron;
        talkSave();
        if (talk.tab === 'conv') talkBody();
        talkFaceOut(side === 'me' ? 'them' : 'me', h.tr, false, h.pron);
        if (talk.auto) talkSpeak(h.tr, to);
    } catch (e) {
        h.tr = '⚠️ ' + e.message; if (talk.tab === 'conv') talkBody(); talkFaceOut(side === 'me' ? 'them' : 'me', '⚠️ ' + e.message, true);
    }
}

// ── 크게 보여주기 (점원에게 화면 보여줄 때) ──
function talkBig(id, data) {
    const h = data || talkH(id), to = data ? data.to : (h.side === 'me' ? h.lang : 'ko');
    let o = document.getElementById('tk-big'); if (!o) { o = document.createElement('div'); o.id = 'tk-big'; document.body.appendChild(o); }
    o.innerHTML = `<div class="tk-big-in" id="tk-big-in"><div class="tk-big-tr">${famEsc(h.tr)}</div>${h.src ? `<div class="tk-big-src">${famEsc(h.src)}</div>` : ''}</div>
        <div class="tk-big-bar"><button onclick="document.getElementById('tk-big-in').classList.toggle('flip')">뒤집기</button><button onclick="talkSpeak(${famEsc(JSON.stringify(h.tr))},'${to}')">읽기</button><button onclick="talkBigClose()">닫기</button></div>`;
    o.style.display = 'flex'; talkWake(true); history.pushState({ tkBig: 1 }, '', '');
}
function talkBigClose() { const o = document.getElementById('tk-big'); if (o) o.style.display = 'none'; talkWake(false); }

// ── 마주보기 ──
function talkFace() {
    if (!talkHasKey()) { famOpenSettings(); return; }
    const M = tLang(talk.me), T = tLang(talk.them);
    let o = document.getElementById('tk-face'); if (!o) { o = document.createElement('div'); o.id = 'tk-face'; document.body.appendChild(o); }
    const half = (side, L) => `<div class="tkf-half tkf-${side}">
        <div class="tkf-lang">${L[3]} ${famEsc(L[4])}</div>
        <div class="tkf-out" id="tkf-out-${side}"><span class="tkf-ph">${side === 'me' ? '상대방 말이 여기에 번역됩니다' : famEsc(TALK_TAP[L[0]] || TALK_TAP.en) + ' ↓'}</span></div>
        <div class="tkf-pron" id="tkf-pron-${side}"></div>
        <div class="tkf-said" id="tkf-said-${side}"></div>
        <button class="tkf-mic" id="tkf-mic-${side}" onclick="talkMic('${side}')">${fi('mic')} ${famEsc(TALK_TAP[L[0]] || TALK_TAP.en)}</button>
    </div>`;
    o.innerHTML = half('them', T) + `<div class="tkf-mid"><button onclick="talkFaceClose()">닫기</button><span>${M[3]} ↔ ${T[3]}</span><button onclick="talk.auto=!talk.auto;tLS('talkAuto',talk.auto);this.textContent=talk.auto?'읽기 켜짐':'읽기 꺼짐'">${talk.auto ? '읽기 켜짐' : '읽기 꺼짐'}</button></div>` + half('me', M);
    o.style.display = 'flex'; talkWake(true); history.pushState({ tkFace: 1 }, '', '');
}
function talkFaceOut(side, text, ph, pron) {
    const o = document.getElementById('tk-face'); if (!o || o.style.display !== 'flex') return;
    const el = document.getElementById('tkf-out-' + side), pr = document.getElementById('tkf-pron-' + side);
    if (el) el.innerHTML = ph ? `<span class="tkf-ph">${famEsc(text)}</span>` : famEsc(text);
    if (pr) pr.textContent = '';
    const sd = document.getElementById('tkf-said-' + (side === 'me' ? 'them' : 'me')); if (sd && !ph) sd.textContent = '';
}
function talkFaceClose() { if (talk.rec) try { talk.rec.abort(); } catch (e) {} const o = document.getElementById('tk-face'); if (o) o.style.display = 'none'; talkWake(false); if (talk.tab === 'conv') talkBody(); }
function talkWake(on) {
    try { if (on && navigator.wakeLock) navigator.wakeLock.request('screen').then(l => talkLock = l).catch(() => {}); else if (!on && talkLock) { talkLock.release(); talkLock = null; } } catch (e) {}
}

// ── 사진 (메뉴판·안내문·일반) ──
function talkPhotoBody(b) {
    const P = talk.photo, T = tLang(talk.them);
    b.innerHTML = `<div class="tk-pad">
        <div class="tk-chips">${[['menu', '메뉴판'], ['sign', '안내문·표지판'], ['text', '일반 글']].map(([k, n]) => `<button class="${talk.photoMode === k ? 'on' : ''}" onclick="talk.photoMode='${k}';talkBody()">${n}</button>`).join('')}</div>
        <div class="tk-photo-btns"><button class="fam-btn pri" onclick="document.getElementById('tk-cam').click()">${fi('camera')} 촬영</button><button class="fam-btn" onclick="document.getElementById('tk-gal').click()">${fi('image')} 사진 선택</button></div>
        <input type="file" id="tk-cam" accept="image/*" capture="environment" style="display:none" onchange="talkPhoto(this)">
        <input type="file" id="tk-gal" accept="image/*" style="display:none" onchange="talkPhoto(this)">
        <div id="tk-photo-out">${P ? talkPhotoHtml(P) : `<div class="tk-empty"><p>${talk.photoMode === 'menu' ? '메뉴판을 찍으면 메뉴마다 어떤 음식인지, 맵거나 해산물이 들었는지 알려주고 주문 문장도 만들어 줍니다.' : '찍은 글을 한국어로 옮기고 핵심을 정리해 줍니다.'}</p></div>`}</div>
    </div>`;
}
async function talkPhoto(input) {
    const f = input.files && input.files[0]; input.value = ''; if (!f) return;
    if (!talkHasKey()) { famOpenSettings(); return; }
    const out = document.getElementById('tk-photo-out'), mode = talk.photoMode, T = tLang(talk.them);
    out.innerHTML = '<div class="tk-empty"><span class="fam-spin"></span>사진을 읽는 중… (10~20초)</div>';
    try {
        const data = await famImgToB64(f, 1800), thumb = 'data:image/jpeg;base64,' + data;
        const q = mode === 'menu'
            ? `메뉴판 사진이다. 메뉴마다 JSON으로 정리하라. 음식 설명은 재료와 조리법 위주로 한국어 한 줄.
tags는 해당될 때만 다음 중에서: 매운맛, 돼지고기, 소고기, 해산물, 견과류, 유제품, 글루텐, 채식, 술
JSON: {"items":[{"orig":"메뉴판 표기 그대로","ko":"한국어 이름","desc":"설명","price":"가격 표기 그대로 또는 빈 문자열","tags":[]}],"tip":"이 식당에서 주문할 때 알아두면 좋은 점 한 줄(없으면 빈 문자열)"}`
            : `사진 속 글을 한국어로 옮겨라. ${mode === 'sign' ? '안내문·표지판이므로 무엇을 하라는/하지 말라는 내용인지 분명히.' : ''}
JSON: {"summary":"한 줄 요약","items":[{"orig":"원문 줄","ko":"한국어"}]}`;
        const r = talkJSON(await talkAI('너는 여행 중인 한국인 부부를 돕는다. 사진에 보이는 내용만 사용하고 추측하지 않는다. JSON만 출력한다.', q, { image: { mime: 'image/jpeg', data }, max: 3500 }));
        talk.photo = { mode, lang: talk.them, thumb, ...r };
        out.innerHTML = talkPhotoHtml(talk.photo);
    } catch (e) { out.innerHTML = `<div class="tk-empty">⚠️ ${famEsc(e.message)}</div>`; }
}
function talkPhotoHtml(P) {
    const items = P.items || [];
    return `<img class="tk-thumb" src="${P.thumb}" onclick="openLightbox(this.src)">
        ${P.summary ? `<div class="tk-sum">${famEsc(P.summary)}</div>` : ''}${P.tip ? `<div class="tk-sum">${famEsc(P.tip)}</div>` : ''}
        ${items.map((x, i) => P.mode === 'menu' ? `<div class="tk-menu">
            <div class="tk-menu-h"><b>${famEsc(x.ko || '')}</b>${x.price ? `<span>${famEsc(x.price)}</span>` : ''}</div>
            <div class="tk-menu-o">${famEsc(x.orig || '')}</div>
            ${x.desc ? `<div class="tk-menu-d">${famEsc(x.desc)}</div>` : ''}
            ${(x.tags || []).length ? `<div class="tk-tags">${x.tags.map(t => `<i class="${/매운|해산|견과|유제|글루텐|돼지|술/.test(t) ? 'w' : ''}">${famEsc(t)}</i>`).join('')}</div>` : ''}
            <div class="tk-act"><button onclick="talkSpeak(${famEsc(JSON.stringify(x.orig || ''))},'${P.lang}')">${fi('speaker')}메뉴 이름</button><button onclick="talkOrder(${i})">이거 주세요</button></div>
        </div>` : `<div class="tk-line"><div class="tk-menu-o">${famEsc(x.orig || '')}</div><div>${famEsc(x.ko || '')}</div></div>`).join('')}`;
}
async function talkOrder(i) {
    const x = (talk.photo.items || [])[i]; if (!x) return;
    famToast('주문 문장 만드는 중…');
    try {
        const r = await talkTranslate(`"${x.orig}" 하나 주세요.`, 'ko', talk.photo.lang);
        talkBig('', { tr: r.tr, src: `${x.ko} 하나 주세요${r.pron ? ' · [' + r.pron + ']' : ''}`, to: talk.photo.lang });
        if (talk.auto) talkSpeak(r.tr, talk.photo.lang);
    } catch (e) { famToast(e.message); }
}

// ── 문장집 ──
function talkPackKey(sit) { return `talkPack_${talk.them}_${sit}`; }
function talkBookBody(b) {
    const T = tLang(talk.them), favs = talk.favs.filter(f => f.lang === talk.them);
    if (talk.sit) {
        const S = TALK_SITS.find(s => s[0] === talk.sit), pack = tLS(talkPackKey(talk.sit));
        b.innerHTML = `<div class="tk-pad"><div class="tk-book-h"><button class="fam-btn" onclick="talk.sit='';talkBody()">◀ 상황</button><b>${S[2]}</b><button class="fam-btn" onclick="talkPackMake('${talk.sit}',true)">새로 만들기</button></div>
            <div id="tk-pack">${pack ? talkPhraseList(pack.items, 'p') : '<div class="tk-empty"><span class="fam-spin"></span>문장을 준비하는 중…</div>'}</div></div>`;
        if (!pack) { if (navigator.onLine) talkPackMake(talk.sit, false); else document.getElementById('tk-pack').innerHTML = '<div class="tk-empty">이 상황 문장은 아직 저장되지 않았습니다. 인터넷이 될 때 받아두세요.</div>'; }
        return;
    }
    const have = TALK_SITS.filter(s => tLS(talkPackKey(s[0]))).length;
    b.innerHTML = `<div class="tk-pad">
        <div class="tk-book-sec tk-sec-row"><span>내 문장 <small>둘이 함께 보는 목록 · ${favs.length}개</small></span><button class="fam-btn" onclick="talkMyAdd()">${fi('plus')} 추가</button></div>
        ${favs.length ? talkPhraseList(favs, 'f') : `<div class="fam-note">자주 쓸 말을 직접 넣어 두세요. 한국어로 쓰면 ${T[1]} 번역과 발음을 붙여 저장합니다.</div>`}
        <div class="tk-book-sec">${T[1]} 상황별 문장 <small>${have}/${TALK_SITS.length} 저장됨</small></div>
        <div class="tk-sits">${TALK_SITS.map(([k, ic, n]) => `<button onclick="talk.sit='${k}';talkBody()">${n}${tLS(talkPackKey(k)) ? '<i>✓</i>' : ''}</button>`).join('')}</div>
        <button class="fam-btn pri" style="width:100%;margin-top:12px" onclick="talkPackAll(this)">여행 전에 전부 받아두기 (오프라인용)</button>
        <div class="fam-note">한 번 받아두면 인터넷이 없어도 문장 보기와 읽어주기가 됩니다. 아내분 폰에서도 다시 만들지 않고 바로 받습니다.</div>
    </div>`;
}
function talkPhraseList(items, kind) {
    window._tkList = window._tkList || {}; window._tkList[kind] = items;
    return (items || []).map((x, i) => `<div class="tk-phrase">
        <div class="tk-ph-ko">${famEsc(x.ko || '')}</div>
        <div class="tk-ph-tr">${famEsc(x.tr || '')}</div>
        ${x.pron ? `<div class="tk-pron">[${famEsc(x.pron)}]</div>` : ''}
        <div class="tk-act"><button onclick="talkPhr('${kind}',${i},'say')" title="읽기">${fi('speaker')}</button><button onclick="talkPhr('${kind}',${i},'big')">${fi('expand')}크게</button><button class="${talkIsFav(talk.them, x.tr) ? 'on' : ''}" onclick="talkPhr('${kind}',${i},'fav')">${fi('star')}${kind === 'f' ? '빼기' : talkIsFav(talk.them, x.tr) ? '내 문장' : '저장'}</button></div>
    </div>`).join('');
}
function talkPhr(kind, i, act) {
    const x = (window._tkList[kind] || [])[i]; if (!x) return;
    if (act === 'say') talkSpeak(x.tr, talk.them);
    else if (act === 'big') talkBig('', { tr: x.tr, src: x.ko + (x.pron ? ' · [' + x.pron + ']' : ''), to: talk.them });
    else talkFavSet(talk.them, x.ko, x.tr, x.pron);
}
async function talkPackMake(sit, force) {
    const key = talkPackKey(sit), docId = `${talk.them}_${sit}`;
    if (!force) {
        try { const d = await db.collection('talkPacks').doc(docId).get(); if (d.exists && (d.data().items || []).length) { tLS(key, d.data()); if (talk.sit === sit) talkBody(); return true; } } catch (e) {}
    }
    if (!talkHasKey()) { famOpenSettings(); return false; }
    const S = TALK_SITS.find(s => s[0] === sit), T = tLang(talk.them);
    if (force) { const el = document.getElementById('tk-pack'); if (el) el.innerHTML = '<div class="tk-empty"><span class="fam-spin"></span>문장을 새로 만드는 중…</div>'; }
    try {
        const r = talkJSON(await talkAI(TALK_SYS, `${S[2]} 상황(${TALK_SIT_HINT[sit] || ''})에서 한국인 부부 여행자가 ${T[1]}로 실제로 자주 쓰는 문장 14개.
짧고 공손하게, 상대에게 말하는 문장 위주로. 자주 듣게 되는 질문 2~3개(예: 몇 분이세요?)도 포함하고 그 경우 ko 앞에 "(들을 말)"을 붙인다.
JSON: {"items":[{"ko":"한국어","tr":"${T[1]}","pron":"${T[1]} 문장을 한국어로 소리 나는 대로"}]}`, { max: 3500 }));
        const doc = { lang: talk.them, sit, items: (r.items || []).filter(x => x.tr), at: Date.now(), by: famUser() };
        if (!doc.items.length) throw new Error('문장을 만들지 못했습니다');
        tLS(key, doc);
        db.collection('talkPacks').doc(docId).set(doc).catch(() => {});
        if (talk.sit === sit) talkBody();
        return true;
    } catch (e) { const el = document.getElementById('tk-pack'); if (el && talk.sit === sit) el.innerHTML = `<div class="tk-empty">⚠️ ${famEsc(e.message)}</div>`; return false; }
}
async function talkPackAll(btn) {
    btn.disabled = true; let n = 0;
    for (const [k, ic, nm] of TALK_SITS) {
        btn.textContent = `받는 중… ${nm} (${++n}/${TALK_SITS.length})`;
        if (!tLS(talkPackKey(k))) await talkPackMake(k, false);
    }
    famToast('상황별 문장을 모두 저장했습니다'); talkBody();
}

// ── 내 문장 직접 추가: 한국어 → 상대 언어 번역·발음 붙여 talkFavs에 저장 ──
function talkMyAdd() {
    const T = tLang(talk.them);
    famSheet(`<div class="fam-h"><b>내 문장 추가 · ${T[1]}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <textarea id="tk-my" rows="3" class="tk-my-in" placeholder="예) 땅콩 알레르기가 있어요"></textarea>
        <div class="fam-note">한국어로 쓰면 ${T[1]} 번역과 한글 발음을 붙여 저장합니다. 두 사람 폰에 함께 보입니다.</div>
        <button class="fam-btn pri" style="width:100%" id="tk-my-go" onclick="talkMySave()">번역해서 저장</button>`);
    setTimeout(() => { const el = document.getElementById('tk-my'); if (el) el.focus(); }, 100);
}
async function talkMySave() {
    const el = document.getElementById('tk-my'), btn = document.getElementById('tk-my-go'), ko = (el && el.value || '').trim();
    if (!ko) return;
    if (!talkHasKey()) { famOpenSettings(); return; }
    btn.disabled = true; btn.textContent = '번역 중…';
    try {
        const lang = talk.them, r = await talkTranslate(ko, 'ko', lang);
        if (!r.tr) throw new Error('번역하지 못했습니다');
        const id = 'tf_' + Date.now();
        await db.collection('talkFavs').doc(id).set({ id, lang, ko, tr: r.tr, pron: r.pron || '', by: famUser(), at: Date.now(), mine: true });
        famSheetClose(); famToast('내 문장에 저장했습니다');
    } catch (e) { btn.disabled = false; btn.textContent = '번역해서 저장'; famToast(e.message); }
}

// ── 즐겨찾기 (부부 공유) ──
function talkFavListen() {
    if (talkFavUnsub) return;
    try { talkFavUnsub = db.collection('talkFavs').onSnapshot(s => { talk.favs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0)); if (talk.tab === 'book' && document.getElementById('translator-section').classList.contains('active')) talkBody(); }, () => {}); } catch (e) {}
}
const talkIsFav = (lang, tr) => talk.favs.some(f => f.lang === lang && f.tr === tr);
function talkFavSet(lang, ko, tr, pron) {
    const ex = talk.favs.find(f => f.lang === lang && f.tr === tr);
    if (ex) { db.collection('talkFavs').doc(ex.id).delete().catch(e => famToast(e.message)); famToast('내 문장에서 뺐습니다'); }
    else { const id = 'tf_' + Date.now(); db.collection('talkFavs').doc(id).set({ id, lang, ko: ko || '', tr, pron: pron || '', by: famUser(), at: Date.now() }).catch(e => famToast(e.message)); famToast('내 문장에 저장했습니다'); }
    setTimeout(talkBody, 300);
}
function talkFavToggle(id) { const h = talkH(id); talkFavSet(h.lang, h.src, h.tr, h.pron); }

// ── 연결 ──
(function () {
    const ss = window.showSection;
    window.showSection = function (id, push) {
        const r = ss.apply(this, arguments);
        if (id === 'translator-section') { talkFavListen(); if (!navigator.onLine) talk.tab = 'book'; talkRender(); }
        else if (talk.rec) try { talk.rec.abort(); } catch (e) {}
        return r;
    };
    const net = () => { const sec = document.getElementById('translator-section'); if (sec && sec.classList.contains('active')) talkRender(); };
    window.addEventListener('online', net); window.addEventListener('offline', net);
    window.addEventListener('popstate', () => {
        const f = document.getElementById('tk-face'), g = document.getElementById('tk-big');
        if (g && g.style.display === 'flex') talkBigClose();
        else if (f && f.style.display === 'flex') talkFaceClose();
    });
})();
