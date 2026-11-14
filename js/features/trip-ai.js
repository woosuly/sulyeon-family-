// ═══════════════════════════════════════════════════════════
// ✈️ 여행 비서: 떠날 수 있는 날 → 여행 제안 → 여행 초안(일정·예산·준비물·예약 할 일) → 계획 저장
//   정보가 부족해 실행이 미뤄지는 것을 줄이는 게 목적: 날짜를 먼저 찾아 주고, 초안을 만들어 계획에 바로 넣음
// ═══════════════════════════════════════════════════════════
const tpYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tpAdd = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return tpYmd(d); };
const tpMD = s => { const d = new Date(s + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`; };
const tpHoli = ds => (typeof famHoli === 'function' ? famHoli(ds) : '') || '';
const tpOff = ds => { const w = new Date(ds + 'T00:00:00').getDay(); return w === 0 || w === 6 || !!tpHoli(ds); };

// ── 떠날 수 있는 날: 3일 이상 쉬는 날, 연차 하루로 4일 이상 되는 날 (앞으로 6개월) ──
function tpWindows(days = 180) {
    const out = [], start = tpAdd(tpYmd(new Date()), 1);
    let i = 0;
    while (i < days) {
        const d = tpAdd(start, i);
        if (!tpOff(d)) { i++; continue; }
        let j = i; while (j < days + 7 && tpOff(tpAdd(start, j))) j++;
        const run = Array.from({ length: j - i }, (_, k) => tpAdd(start, i + k));
        const holi = [...new Set(run.map(tpHoli).filter(Boolean))];
        if (run.length >= 3) out.push({ start: run[0], end: run[run.length - 1], n: run.length, leave: 0, label: holi.join('·') || '주말' });
        // 앞·뒤로 연차 하루를 붙이면 길어지는 경우
        if (holi.length) for (const side of [-1, 1]) {
            const bridge = side < 0 ? tpAdd(run[0], -1) : tpAdd(run[run.length - 1], 1), beyond = side < 0 ? tpAdd(bridge, -1) : tpAdd(bridge, 1);
            if (!tpOff(bridge) && tpOff(beyond)) {
                let a = side < 0 ? beyond : run[0], b = side < 0 ? run[run.length - 1] : beyond;
                while (tpOff(tpAdd(a, -1))) a = tpAdd(a, -1); while (tpOff(tpAdd(b, 1))) b = tpAdd(b, 1);
                const n = Math.round((new Date(b) - new Date(a)) / 864e5) + 1;
                if (n >= 4) out.push({ start: a, end: b, n, leave: 1, leaveDay: bridge, label: holi.join('·') });
            }
        }
        i = j;
    }
    const sch = typeof schData !== 'undefined' ? schData : [];
    const seen = new Set();
    return out.filter(w => { const k = w.start + w.end; if (seen.has(k)) return false; seen.add(k); return w.n >= 3 && (w.label !== '주말' || w.n >= 3); })
        .map(w => ({ ...w, busy: sch.filter(e => e.date >= w.start && e.date <= w.end && !e.planId).map(e => e.memo).slice(0, 3), trip: sch.some(e => e.date >= w.start && e.date <= w.end && e.planId) }))
        .filter(w => w.label !== '주말')   // 주말만 3일(드묾)은 제외, 공휴일 낀 것 위주
        .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 10);
}
function tpOpen() {
    const ws = tpWindows();
    famSheet(`<div class="fam-h"><b>떠날 수 있는 날</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:0 0 8px">앞으로 6개월 연휴와, 연차 하루로 길어지는 날입니다. 일정이 겹치면 표시합니다.</div>
        ${ws.length ? ws.map((w, i) => `<div class="tp-win">
            <div><b>${tpMD(w.start)} ~ ${tpMD(w.end)}</b> <span class="ib-tag">${w.n}일</span>${w.leave ? ` <span class="ib-tag warn">연차 ${tpMD(w.leaveDay)}</span>` : ''}${w.trip ? ' <span class="ib-tag">여행 계획 있음</span>' : ''}
            <div class="ib-sub">${famEsc(w.label)}${w.busy.length ? ' · 일정: ' + famEsc(w.busy.join(', ')) : ''}</div></div>
            <button class="fam-btn pri" onclick="tpSuggest(${i})">어디 갈까</button></div>`).join('') : '<div class="fam-note">6개월 안에 3일 이상 연휴가 없습니다.</div>'}
        <div class="fam-btns"><button class="fam-btn" onclick="tpDraftForm()">목적지가 정해졌으면: 여행 초안 만들기</button></div>`);
}

// ── 여행 제안 (웹 검색): 기간·시기·가고 싶은 곳·지난 여행을 보고 3곳 ──
async function tpWishNames() {
    try { const s = await db.collection('wishes').get(); return s.docs.map(d => d.data()).filter(w => !w.done).map(w => w.name).slice(0, 20); } catch (e) { return []; }
}
async function tpSuggest(i) {
    const w = tpWindows()[i]; if (!w) return;
    famSheet(`<div class="fam-h"><b>${tpMD(w.start)}~${tpMD(w.end)} 여행 제안</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note"><span class="fam-spin"></span> 시기·날씨·가고 싶은 곳을 보고 고르는 중… (20~40초)</div>`);
    const wish = await tpWishNames(), past = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && p.start > tpAdd(tpYmd(new Date()), -730)).map(p => p.loc).slice(0, 15);
    try {
        const r = await famCallAI(`너는 40대 후반 부부(청주 거주, 여행·등산 좋아함, 자녀 없음)의 여행 비서다. 웹 검색으로 그 시기의 날씨·축제·성수기 여부를 확인하고, JSON만 출력한다.
{"options":[{"name":"목적지","type":"국내|해외","why":"왜 지금 좋은지 2문장(날씨·제철·행사 근거)","move":"청주에서 이동 방법·시간","budget":"2인 예상 경비(교통·숙박·식비 포함)","hike":"근처 등산·걷기 코스 1곳 또는 빈칸","caution":"주의할 점(성수기 가격·예약 마감 등)"}]}
- 3곳: 기간이 4일 이상이면 해외 1곳 이상 포함, 3일이면 국내 위주.
- '가고 싶은 곳' 목록에 시기가 맞는 곳이 있으면 우선. 최근 다녀온 곳은 피한다.
- 모르는 가격은 '확인 필요'.`,
            `기간: ${w.start} ~ ${w.end} (${w.n}일${w.leave ? ', ' + w.leaveDay + ' 연차 사용' : ''}, ${w.label})\n가고 싶은 곳: ${wish.join(', ') || '없음'}\n최근 다녀온 곳: ${past.join(', ') || '없음'}`, { search: true, maxTokens: 3000 });
        const j = JSON.parse((String(r.text).match(/\{[\s\S]*\}/) || ['{}'])[0]), ops = j.options || [];
        window._tpOps = { w, ops };
        famSheet(`<div class="fam-h"><b>${tpMD(w.start)}~${tpMD(w.end)} 여행 제안</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            ${ops.map((o, k) => `<div class="tp-op"><b>${famEsc(o.name)}</b> <span class="ib-tag">${famEsc(o.type || '')}</span>
                <div class="tp-l">${famEsc(o.why || '')}</div>
                <div class="tp-l"><small>이동</small>${famEsc(o.move || '')}</div><div class="tp-l"><small>경비</small>${famEsc(o.budget || '')}</div>
                ${o.hike ? `<div class="tp-l"><small>걷기</small>${famEsc(o.hike)}</div>` : ''}${o.caution ? `<div class="tp-l warn"><small>주의</small>${famEsc(o.caution)}</div>` : ''}
                <div class="fam-btns"><button class="fam-btn pri" onclick="tpDraft(_tpOps.ops[${k}].name,_tpOps.w.start,_tpOps.w.end,'')">이곳으로 여행 초안</button></div></div>`).join('') || '<div class="fam-note">제안을 받지 못했습니다.</div>'}`);
    } catch (e) { famSheet(`<div class="fam-h"><b>여행 제안</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note">⚠️ ${famEsc(e.message)}</div>`); }
}

// ── 여행 초안: 목적지·날짜 → 일자별 일정, 예산, 준비물, 예약 할 일(마감일) ──
function tpDraftForm(dest, s, e) {
    const t = tpYmd(new Date());
    famSheet(`<div class="fam-h"><b>여행 초안 만들기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="ff-form"><div class="full"><label>목적지</label><input id="tp-dest" value="${famEsc(dest || '')}" placeholder="예: 교토, 남해, 설악산"></div>
        <div><label>출발</label><input type="date" id="tp-s" value="${s || ''}" min="${t}"></div><div><label>도착</label><input type="date" id="tp-e" value="${e || ''}" min="${t}"></div>
        <div class="full"><label>원하는 것 (선택)</label><input id="tp-note" placeholder="예: 온천, 등산 하루, 맛집 위주, 렌터카 없이"></div></div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="tpDraft(document.getElementById('tp-dest').value,document.getElementById('tp-s').value,document.getElementById('tp-e').value,document.getElementById('tp-note').value)">초안 만들기</button></div>`);
}
async function tpDraft(dest, start, end, note) {
    dest = String(dest || '').trim(); if (!dest || !start) return famToast('목적지와 출발일을 넣어 주세요');
    end = end && end >= start ? end : start;
    const n = Math.round((new Date(end) - new Date(start)) / 864e5) + 1;
    famSheet(`<div class="fam-h"><b>${famEsc(dest)} 여행 초안</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note"><span class="fam-spin"></span> 일정·숙소 지역·예산·예약 마감을 정리하는 중… (30~60초)</div>`);
    try {
        const r = await famCallAI(`너는 40대 후반 부부(청주 거주, 여행·등산 좋아함)의 여행 비서다. 웹 검색으로 최신 정보(운영시간·휴무·축제·교통·환율)를 확인해 실행 가능한 초안을 만든다. JSON만 출력.
{"type":"국내|해외","summary":"한 줄 요약","stay":"추천 숙소 지역과 이유 1문장","days":[{"date":"YYYY-MM-DD","plan":"오전 ○○ → 점심 ○○(메뉴) → 오후 ○○ → 저녁 ○○, 이동수단 포함 한 줄"}],
"budget":{"교통":0,"숙박":0,"식비":0,"입장·기타":0},"supplies":"준비물 쉼표 나열(해외면 여권·환전·eSIM 등 포함)",
"bookings":[{"what":"예약할 것(항공·숙소·렌터카·입장권)","by":"YYYY-MM-DD 언제까지 예약하면 좋은지","tip":"이유·요령 짧게"}],"tips":["현지 팁 2~3개"]}
- 일정은 하루 3~4곳으로 무리하지 않게, 이동 동선 순서. 40대 후반 부부 체력 고려.
- 예산은 2인 기준 원화 정수. 모르는 건 보수적으로.
- 오늘은 ${tpYmd(new Date())}. 예약 마감일은 오늘 이후로.`,
            `목적지: ${dest}\n기간: ${start} ~ ${end} (${n}일)\n원하는 것: ${note || '특별히 없음'}\n출발지: 청주`, { search: true, maxTokens: 5000 });
        const j = JSON.parse((String(r.text).match(/\{[\s\S]*\}/) || ['{}'])[0]);
        const b = j.budget || {}, tot = Object.values(b).reduce((a, v) => a + (Number(v) || 0), 0);
        window._tpDraft = { dest, start, end, j, tot };
        famSheet(`<div class="fam-h"><b>${famEsc(dest)} ${tpMD(start)}~${tpMD(end)}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-note" style="margin:0 0 8px">${famEsc(j.summary || '')}${j.stay ? '<br>숙소: ' + famEsc(j.stay) : ''}</div>
            <div class="fam-box"><h4>일정</h4>${(j.days || []).map(d => `<div class="tp-l"><small>${tpMD(d.date)}</small>${famEsc(d.plan)}</div>`).join('')}</div>
            <div class="fam-box"><h4 style="display:flex">예산 (2인)<span style="margin-left:auto;color:var(--month-header)">${tot.toLocaleString('ko-KR')}원</span></h4>${Object.entries(b).map(([k, v]) => `<div class="tp-l"><small>${famEsc(k)}</small>${(Number(v) || 0).toLocaleString('ko-KR')}원</div>`).join('')}</div>
            ${(j.bookings || []).length ? `<div class="fam-box"><h4>예약 할 일</h4>${j.bookings.map(x => `<div class="tp-l"><small>${x.by ? tpMD(x.by) + '까지' : ''}</small><b>${famEsc(x.what)}</b> ${famEsc(x.tip || '')}</div>`).join('')}</div>` : ''}
            ${j.supplies ? `<div class="fam-box"><h4>준비물</h4><div class="tp-l">${famEsc(j.supplies)}</div></div>` : ''}
            ${(j.tips || []).length ? `<div class="fam-box"><h4>알아둘 것</h4>${j.tips.map(t => `<div class="tp-l">- ${famEsc(t)}</div>`).join('')}</div>` : ''}
            <div class="fam-btns"><button class="fam-btn pri" onclick="tpSave()">여행 계획으로 저장</button>${(j.bookings || []).length ? '<button class="fam-btn" onclick="tpBookRemind()">예약 마감 알림</button>' : ''}<button class="fam-btn" onclick="famShare(tpDraftText())">공유</button></div>`);
    } catch (e) { famSheet(`<div class="fam-h"><b>여행 초안</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note">⚠️ ${famEsc(e.message)}</div>`); }
}
function tpDraftText() {
    const t = window._tpDraft; if (!t) return ''; const j = t.j;
    return `${t.dest} ${t.start}~${t.end}\n${j.summary || ''}\n\n` + (j.days || []).map(d => `${d.date} ${d.plan}`).join('\n') + `\n\n예산(2인) ${t.tot.toLocaleString('ko-KR')}원\n준비물: ${j.supplies || ''}`;
}
// 계획 화면(기존 저장 방식)에 채워서 열기 → 확인 후 저장하면 일정에도 날짜별로 들어감
function tpSave() {
    const t = window._tpDraft; if (!t) return; const j = t.j;
    famSheetClose(); showSection('travel-section'); openPlanModal(null);
    setTimeout(() => {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        if (j.type === '해외') { const b = document.querySelector('#plan-area-group [data-val="해외"]'); if (b) selectChip(b, 'plan-area-group'); }
        set('plan-loc', t.dest); set('plan-start-date', t.start); set('plan-end-date', t.end);
        if (typeof generateDayInputs === 'function') generateDayInputs();
        const ins = document.querySelectorAll('.day-input'); (j.days || []).forEach((d, i) => { if (ins[i]) ins[i].value = d.plan; });
        set('plan-supplies', j.supplies || '');
        set('plan-memo', [j.summary, j.stay ? '숙소: ' + j.stay : '', `예산(2인) ${t.tot.toLocaleString('ko-KR')}원: ` + Object.entries(j.budget || {}).map(([k, v]) => `${k} ${(Number(v) || 0).toLocaleString('ko-KR')}`).join(', '), ...(j.tips || [])].filter(Boolean).join('\n'));
        famToast('초안을 채웠습니다. 확인 후 저장을 누르세요');
    }, 350);
}
async function tpBookRemind() {
    const t = window._tpDraft; if (!t || typeof agRemindAdd !== 'function') return; let n = 0;
    for (const x of t.j.bookings || []) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(x.by || '')) continue;
        const at = new Date(x.by + 'T09:00:00'); at.setDate(at.getDate() - 3);
        await agRemindAdd({ at: Math.max(at.getTime(), Date.now() + 30 * 6e4), title: `${t.dest} 여행: ${x.what} 예약 (${tpMD(x.by)}까지)`, text: x.tip || '', kind: 'trip' }); n++;
    }
    famToast(n ? `예약 마감 ${n}건, 3일 전에 알려드립니다` : '마감일이 있는 예약이 없습니다');
}
