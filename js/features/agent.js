// ═══════════════════════════════════════════════════════════
// 🤖 비서: 리마인더 · 기억 노트 · 브리핑 (서버 비서 엔진 functions/agent.js와 짝)
//   reminders/{id} {owner, at(ms), title, text}   — 시각이 되면 서버가 푸시 후 삭제
//   notes/{id}     {text, by, at}                 — "기억해줘"로 저장, AI 답변 때 참고
//   briefs/{id}    {owner, type, date, title, body} — 서버가 만든 브리핑
//   briefReq/{id}  {owner, type}                  — 앱에서 "지금 받아보기"
// ═══════════════════════════════════════════════════════════
let agNotes = [], agRems = [], agBriefs = [], agUnsubs = [];
const agMe = () => (typeof famUser === 'function' ? famUser() : '') || '';
const agFmt = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const agLocalInput = ms => { const d = new Date(ms - new Date().getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };

// ── 말 거는 방식 판단 (assistant.js famRun에서 호출) ──
function agRoute(raw) {
    const t = raw.trim();
    if (typeof iotRoute === 'function' && iotRoute(t)) return true;       // 집 기기(스마트싱스) — '에어컨 틀어줘'가 음악으로 가지 않게 먼저
    if (typeof mediaRoute === 'function' && mediaRoute(t)) return true;   // 음악·영상
    if (typeof lifeRoute === 'function' && lifeRoute(t)) return true;     // 길찾기·차·택배
    // 산행: '주말에 어느 산 갈까', '등산 추천해줘' → 서버 산행 추천 / '100대 명산' → 진행 현황
    if (/(항공권|비행기\s*표|항공\s*가격)/.test(t) && typeof flOpen === 'function') { flOpen(); return true; }
    if (/(관리비|공과금|전기\s*요금|가스\s*요금)/.test(t) && /(얼마|추이|보여|비교|현황|나왔)/.test(t)) { showSection('save-section'); setTimeout(() => document.getElementById('bill-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); return true; }
    if (/(여권|면허|건강\s*검진|서류)/.test(t) && /(만료|언제|갱신|기한|남았)/.test(t)) { showSection('save-section'); setTimeout(() => document.getElementById('doc-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); return true; }
    if (/100\s*대\s*명산|명산\s*(현황|몇)/.test(t) && typeof hikeM100Sheet === 'function') { hikeM100Sheet(); return true; }
    if (/(등산|산행|어느\s*산|무슨\s*산|어떤\s*산)/.test(t) && /(추천|갈까|가볼까|어디|좋을까)/.test(t)) { agBriefNow('hike'); famFeedAdd('⛰️ 이번 주말 날씨·미세먼지·일몰을 보고 안 가 본 산 위주로 추천을 만드는 중입니다. 완료되면 알림이 옵니다.'); return true; }
    if (/(기억\s*해\s*(줘|둬|놔)|기억해|메모\s*해\s*(줘|둬)|적어\s*(줘|둬))[.!]?$/.test(t)) { agNoteSave(t); return true; }
    // 알림 요청: '~에 알려줘'(시각 + 에) 또는 할 일 동사가 있을 때만. '주말 날씨 알려줘' 같은 정보 요청은 AI 답변으로
    const askEnd = /(알려\s*줘|알림\s*(줘|해\s*줘)|리마인드|깨워\s*줘|말해\s*줘)[.!]?$/.test(t);
    const timeE = /((오늘|내일|모레|글피|\d+\s*(시|분|일)|\d+시\s*반|[월화수목금토일]요일|아침|점심|저녁|밤|퇴근|출근|주말)\s*(에|쯤|전에|때)|\d+\s*(분|시간|일)\s*(뒤|후))/.test(t);
    const act = /(전화|챙기|가져|사\s*오|사와|보내|먹|복용|납부|입금|예약|하라고|해야|하기|잊지|확인하라|연락)/.test(t);
    const info = /(날씨|뉴스|정보|방법|추천|맛집|얼마|어디|뭐|어떻게|왜|가격|환율|소식|어때)/.test(t);
    if (askEnd && (timeE || (act && /(오늘|내일|모레|\d+\s*시|요일|아침|저녁|밤|퇴근|출근)/.test(t))) && !(info && !act)) { agRemind(t); return true; }
    if (agNotes.length && /(였지|이었지|더라|뭐였|어디였|언제였|몇\s*번이었)/.test(t)) { famAsk(t); return true; }
    return false;
}

// ── 리마인더 ─────────────────────────────────────────────
// "N분/시간 뒤"는 바로 계산, 나머지는 AI가 날짜·시각을 해석 → 확인 카드에서 고쳐서 저장
function agQuickTime(t) {
    let m;
    if ((m = t.match(/(\d+)\s*분\s*(뒤|후)/))) return Date.now() + +m[1] * 6e4;
    if ((m = t.match(/(\d+)\s*시간\s*(뒤|후)/))) return Date.now() + +m[1] * 36e5;
    return 0;
}
async function agRemind(text) {
    if (!text) return famFeedAdd('예) <b>내일 아침 8시에 장모님께 전화 알려줘</b>');
    const c = famFeedAdd('<span class="fam-spin"></span>알림 시각을 정리하는 중…');
    let at = agQuickTime(text), title = text.replace(/(에|때)?\s*(알려\s*줘|알림\s*(줘|해\s*줘)|리마인드|깨워\s*줘|말해\s*줘)[.!]?$/, '').trim();
    if (!at) {
        try {
            const now = new Date(), r = await famCallAI(`지금은 ${now.toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'short' })} (한국). 사용자의 알림 요청에서 알릴 시각과 짧은 제목을 뽑아 JSON만 출력: {"at":"YYYY-MM-DDTHH:MM","title":"..."}.
시각이 '아침'이면 08:00, '점심' 12:00, '저녁' 18:00, '밤' 21:00, '퇴근' 17:30, '출근' 07:30, 날짜만 있으면 09:00. 제목은 할 일만 (예: "장모님께 전화").`, text, { maxTokens: 300 });
            const j = JSON.parse((String(r.text).match(/\{[\s\S]*\}/) || ['{}'])[0]);
            if (j.at) at = new Date(j.at).getTime(); if (j.title) title = j.title;
        } catch (e) { /* 해석 실패: 카드에서 직접 고름 */ }
    }
    if (!at || isNaN(at)) at = Date.now() + 3600e3;
    const id = 'rm' + Date.now();
    c.innerHTML = `<h5>⏰ 이때 알려드릴까요?</h5><div class="ff-form">
        <div class="full"><label>내용</label><input id="${id}-t" value="${famEsc(title)}"></div><div class="full"><label>시각</label><input type="datetime-local" id="${id}-at" value="${agLocalInput(at)}"></div>
        </div><div class="fam-btns"><button class="fam-btn pri" onclick="agRemindSave('${id}',this)">알림 저장</button></div>`;
}
async function agRemindSave(id, btn) {
    const title = document.getElementById(id + '-t').value.trim(), at = new Date(document.getElementById(id + '-at').value).getTime();
    if (!title || !at) return famToast('내용과 시각을 넣어 주세요');
    if (at < Date.now() - 6e4) return famToast('지난 시각입니다');
    await agRemindAdd({ title, at });
    (btn.closest('.ff-card') || btn.parentElement.parentElement).innerHTML = `⏰ <b>${famEsc(agFmt(at))}</b> ${famEsc(title)} — 그때 알려드리겠습니다.`;
}
// 다른 기능(기프티콘 만료·납부기한·차량 점검 등)도 이 함수로 알림을 넣음
async function agRemindAdd(r) {
    const id = r.id || 'rm_' + Date.now() + Math.floor(Math.random() * 99);
    await db.collection('reminders').doc(id).set({ id, owner: r.owner || agMe(), at: r.at, title: r.title, text: r.text || '', kind: r.kind || 'user', repeat: r.repeat || null, createdAt: Date.now() });
    return id;
}
async function agRemindDel(id) { await db.collection('reminders').doc(id).delete().catch(() => {}); }

// ── 기억 노트 ─────────────────────────────────────────────
async function agNoteSave(text) {
    const t = String(text || '').replace(/[,\s]*(이거|이것|이건)?\s*(꼭\s*)?(기억\s*해\s*(줘|둬|놔)|기억해|메모\s*해\s*(줘|둬)|적어\s*(줘|둬))[.!]?$/, '').trim();
    if (!t) return famFeedAdd('예) <b>자동차 보험 ○○화재, 만기 3월 15일 기억해줘</b>');
    const id = 'nt_' + Date.now();
    await db.collection('notes').doc(id).set({ id, text: t, by: agMe(), at: Date.now() });
    famFeedAdd(`📝 기억했습니다: <b>${famEsc(t)}</b><div class="fam-note">나중에 "…어디였지?", "…언제였지?"처럼 물어보세요. <button class="fam-btn" style="padding:3px 8px;font-size:11px" onclick="agNoteDel('${id}');this.closest('.ff-msg,div').remove()">취소</button></div>`);
}
async function agNoteDel(id) { await db.collection('notes').doc(id).delete().catch(() => {}); }
// AI 답변 때 함께 넘기는 집안 정보 (최근 순, 길이 제한)
function agNotesCtx() {
    if (!agNotes.length) return '';
    let s = '', n = 0;
    for (const x of agNotes) { const l = `- ${x.text} (${new Date(x.at).toLocaleDateString('ko-KR')} ${x.by || ''} 저장)\n`; if (s.length + l.length > 3500) break; s += l; n++; }
    return `[가족이 기억해 달라고 저장한 집안 정보 ${n}건 — 질문과 관련 있으면 이 정보를 우선 사용하고 출처로 '저장된 메모'라고 밝힌다]\n${s}\n`;
}

// ── 브리핑 ───────────────────────────────────────────────
function agBriefOpen(id) {
    const b = agBriefs.find(x => x.id === id);
    if (!b) { db.collection('briefs').doc(id).get().then(d => { if (d.exists) { agBriefs.push(d.data()); agBriefOpen(id); } }); return; }
    let m = document.getElementById('ag-brief');
    if (!m) { m = document.createElement('div'); m.id = 'ag-brief'; m.className = 'ib-dim'; m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m); history.pushState({ agb: 1 }, '', ''); }
    m.style.display = 'flex';
    m.innerHTML = `<div class="ib-sheet"><div class="ib-head"><b>${famEsc(b.title)}</b><button class="fam-x" onclick="document.getElementById('ag-brief').remove()">✕</button></div>
        <div class="ib-item ag-brief-body">${famMd(b.body || '')}</div>
        <div class="ib-row ib-acts"><button class="fam-btn" onclick="famCopy(agBriefText('${b.id}'))">복사</button><button class="fam-btn" onclick="famShare(agBriefText('${b.id}'))">공유</button><button class="fam-btn" onclick="document.getElementById('ag-brief').remove();agAskMore('${b.id}')">이어서 묻기</button></div></div>`;
}
const agBriefText = id => { const b = agBriefs.find(x => x.id === id); return b ? b.title + '\n\n' + b.body : ''; };
function agAskMore(id) { const el = document.getElementById('home-cmd-input'), b = agBriefs.find(x => x.id === id); if (typeof showSection === 'function') showSection('main-section'); famAskHist.push({ q: b.title, a: b.body }); famAskAt = Date.now(); if (el) { el.focus(); el.placeholder = '브리핑에 이어서 물어보세요'; } }
const AG_TYPES = { morning: '아침 브리핑', eve: '내일 일정 준비', weekend: '주말 제안', weekly: '주간 요약', hike: '주말 산행 추천' };
async function agBriefNow(type) {
    type = { 아침: 'morning', 내일: 'eve', 주말: 'weekend', 주간: 'weekly', 산행: 'hike' }[String(type || '').trim()] || (AG_TYPES[type] ? type : 'morning');
    await db.collection('briefReq').add({ owner: agMe(), type, at: Date.now() });
    famToast(AG_TYPES[type] + ' 만드는 중… 완료되면 알림이 옵니다');
}
function agRenderBar() {
    const el = document.getElementById('ag-bar'); if (!el) return;
    const since = Date.now() - 20 * 3600e3, b = agBriefs.filter(x => x.at > since).sort((a, c) => c.at - a.at)[0];
    const soon = agRems.filter(r => r.at > Date.now() && r.at < Date.now() + 24 * 3600e3).sort((a, c) => a.at - c.at);
    el.innerHTML = (b ? `<button class="ib-bar" onclick="agBriefOpen('${b.id}')">${fi('news')}<span>${famEsc(b.title)}</span>${fi('expand')}</button>` : '') +
        (soon.length ? `<button class="ib-bar" onclick="famOpenSettings();setTimeout(()=>document.getElementById('ag-set')?.scrollIntoView({behavior:'smooth'}),200)">${fi('clock')}<span>다음 알림 <b>${famEsc(agFmt(soon[0].at))}</b> ${famEsc(soon[0].title)}${soon.length > 1 ? ` 외 ${soon.length - 1}건` : ''}</span></button>` : '');
}

// ── 설정 화면: 브리핑 받아보기, 예정 알림, 기억 노트 ──
function agSetHtml() {
    const rems = agRems.filter(r => r.at > Date.now() - 6e4).sort((a, b) => a.at - b.at).slice(0, 20);
    return `<div class="fam-box" id="ag-set"><h4>🤖 비서</h4>
        <div class="fam-note" style="margin:0 0 10px">아침 07:00 브리핑, 19:00 내일 일정 준비(장소가 있는 일정), 목 19:30 주말 제안, 일 20:00 주간 요약이 자동으로 옵니다.</div>
        <div class="fam-btns" style="margin-top:0">${Object.entries(AG_TYPES).map(([k, n]) => `<button class="fam-btn" onclick="agBriefNow('${k}')">${n}</button>`).join('')}</div>
        ${window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative && Capacitor.Plugins.SeolyeonNative.openAssistantSettings ? `<span class="fam-lbl">홈 버튼 길게 누르면 설연</span>
        <div class="fam-note" style="margin:0 0 6px">① 아래 버튼 → <b>디지털 어시스턴트 앱</b> → <b>설연</b> 선택<br>② 홈 버튼을 길게 눌러 '서클 투 서치'가 뜨면: 설정 → 디스플레이 → 내비게이션 바 → <b>서클 투 서치</b> 끄기<br>앱 아이콘을 길게 누르면 <b>말로 하기</b> 바로가기도 있습니다.</div>
        <div class="fam-btns" style="margin-top:0"><button class="fam-btn" onclick="Capacitor.Plugins.SeolyeonNative.openAssistantSettings()">기본 어시스턴트 앱 설정 열기</button></div>` : ''}
        ${typeof stSetHtml === 'function' ? stSetHtml() : ''}
        <span class="fam-lbl">택배 조회 키 (스마트택배)</span>
        <input class="fam-in" type="text" style="-webkit-text-security:disc" value="${famEsc((typeof famKeys === 'function' && famKeys().sweettracker) || '')}" placeholder="info.sweettracker.co.kr 에서 받은 키" autocomplete="off" onchange="famSetKey('sweettracker',this.value.trim());famToast('택배 조회 키를 저장했습니다')">
        <span class="fam-lbl">또는 tracker.delivery 키 (Client ID:Secret)</span>
        <input class="fam-in" type="text" style="-webkit-text-security:disc" value="${famEsc((typeof famKeys === 'function' && famKeys().trackerdelivery) || '')}" placeholder="console.tracker.delivery 의 ID:Secret" autocomplete="off" onchange="famSetKey('trackerdelivery',this.value.trim());famToast('저장했습니다')">
        <div class="fam-note" style="margin:4px 0 0">둘 중 하나만 있으면 됩니다. 키가 없어도 택배 목록의 [조회]로 네이버 택배 조회를 열 수 있습니다.</div>
        <span class="fam-lbl">비서 실행 기록</span>
        <div class="fam-note" style="margin:0 0 6px">비서가 실패했거나 👎를 누른 요청을 모아 봅니다. 복사해서 Claude에게 보내면 고칠 곳을 찾기 쉽습니다.</div>
        <div class="fam-btns" style="margin-top:0"><button class="fam-btn" onclick="brRunsOpen()">실행 기록 보기</button></div>
        <span class="fam-lbl">예정된 알림 ${rems.length}건</span>
        ${rems.length ? rems.map(r => `<div class="ag-li"><span>${famEsc(agFmt(r.at))}</span><b>${famEsc(r.title)}</b><button class="fam-x" onclick="agRemindDel('${r.id}').then(()=>famRenderSettings())">✕</button></div>`).join('') : '<div class="fam-note" style="margin:0">홈에서 "내일 8시에 ○○ 알려줘"라고 입력하세요.</div>'}
        <span class="fam-lbl">기억 노트 ${agNotes.length}건</span>
        ${agNotes.length ? agNotes.slice(0, 30).map(n => `<div class="ag-li"><span>${famEsc(n.by || '')}</span><b>${famEsc(n.text)}</b><button class="fam-x" onclick="agNoteDel('${n.id}').then(()=>famRenderSettings())">✕</button></div>`).join('') : '<div class="fam-note" style="margin:0">홈에서 "○○ 기억해줘"라고 입력하세요.</div>'}
    </div>`;
}

// ── 시작: 로그인 후 구독 ──────────────────────────────────
(function agBoot() {
    const start = () => {
        const me = agMe(); if (!me || agUnsubs.length) return;
        agUnsubs.push(db.collection('notes').onSnapshot(s => { agNotes = s.docs.map(d => d.data()).sort((a, b) => b.at - a.at); }, () => {}));
        agUnsubs.push(db.collection('reminders').where('owner', '==', me).onSnapshot(s => { agRems = s.docs.map(d => d.data()); agRenderBar(); }, () => {}));
        agUnsubs.push(db.collection('briefs').where('owner', '==', me).onSnapshot(s => {
            const before = new Set(agBriefs.map(b => b.id + b.at));
            agBriefs = s.docs.map(d => d.data()).sort((a, b) => b.at - a.at);
            agRenderBar();
            // 방금 요청한 브리핑이 오면 바로 열기
            const fresh = agBriefs.find(b => !before.has(b.id + b.at) && Date.now() - b.at < 120e3);
            if (fresh && before.size && document.visibilityState === 'visible') agBriefOpen(fresh.id);
        }, () => {}));
    };
    const wait = () => { if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(start, 1200); }); else setTimeout(wait, 1000); };
    window.addEventListener('load', () => setTimeout(wait, 600));
})();
