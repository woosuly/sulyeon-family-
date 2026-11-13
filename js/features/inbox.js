// ═══════════════════════════════════════════════════════════
// 📥 문자 비서 — 폰 문자를 읽어 확인 대기로 올림
//   카드 결제·취소 문자 → (지정 카드만) 가계부 반영 대기
//   그 밖의 문자(택배·예약·병원·고지서 등) → AI가 요약·일정·답장 초안 제안
//   반영은 항상 확인을 누른 뒤에만. 인증번호 문자는 폰에서부터 제외됨.
//   데이터: inbox/{id} { kind:'card'|'sms', owner, status:'pending'|'done'|'skip', ... }
// ═══════════════════════════════════════════════════════════
const IB_CARD_DEFAULT = { '1089': '정우설' };
let ibCards = (() => { try { return JSON.parse(localStorage.getItem('ibCards')) || IB_CARD_DEFAULT; } catch (e) { return IB_CARD_DEFAULT; } })();
let ibItems = [], ibUnsub = null, ibBusy = false;

const ibN = () => (typeof famPlug === 'function' ? famPlug('SeolyeonNative') : null);
const ibNorm = t => String(t || '').replace(/\[\s*web\s*발신\s*\]/gi, '').replace(/\s+/g, ' ').trim();
function ibHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }
const ibLS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };

// ── 카드 문자 해석 (삼성카드 형식) ─────────────────────────
//  승인: "삼성1089승인 정*설 7,000원 일시불 11/13 07:09 지에스차지비 누적2,239,771원"
//  취소: "[삼성카드]1089취소 11/11 주식회사차지비 -4,109원 q.samsungcard.com/…"
function ibParseCard(text, ts) {
    const t = ibNorm(text);
    let m, r = null;
    if ((m = t.match(/삼성(?:카드)?\s*(\d{4})\s*승인\s*(?:\S+\s+)?([\d,]+)\s*원\s*(?:일시불|\d+\s*개월|할부\S*)?\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2})\s+(.+?)(?:\s*누적\s*[\d,]+\s*원.*)?$/)))
        r = { card: m[1], cancel: false, amt: +m[2].replace(/,/g, ''), mo: +m[3], d: +m[4], hm: m[5], merchant: m[6].trim() };
    else if ((m = t.match(/삼성(?:카드)?\]?\s*(\d{4})\s*취소\s*(\d{1,2})\/(\d{1,2})\s+(.+?)\s+-?\s*([\d,]+)\s*원/)))
        r = { card: m[1], cancel: true, amt: +m[5].replace(/,/g, ''), mo: +m[2], d: +m[3], hm: '', merchant: m[4].trim() };
    if (!r || !r.amt) return null;
    const base = new Date(ts || Date.now());
    let y = base.getFullYear(); if (r.mo > base.getMonth() + 1) y--;   // 1월에 받은 12월 결제 등
    r.date = `${y}-${String(r.mo).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`;
    r.key = 'c_' + ibHash([r.card, r.cancel ? 'x' : 'o', r.date, r.hm, r.amt, r.merchant.replace(/\s/g, '')].join('|'));
    return r;
}
function ibCardCat(merchant) {
    const h = typeof famHistCat === 'function' ? famHistCat(merchant, '지출') : '';
    if (h) return h;
    if (/차지비|충전|주유|오일|에너지|하이패스|주차|택시|코레일|SRT/i.test(merchant)) return '교통비';
    if (/샷|와인|주류|카페|커피|식당|푸드|치킨|피자|베이커리|배달/i.test(merchant)) return '식사';
    if (/마트|이마트|홈플러스|롯데마트|코스트코|다이소|편의점|GS25|CU|세븐/i.test(merchant)) return '생활비';
    return typeof famGuessCat === 'function' ? famGuessCat(merchant, '지출') : '기타지출';
}

// ── 폰에서 문자 가져와 정리 ──────────────────────────────
async function ibDrain(opt) {
    opt = opt || {};
    const N = ibN(), me = typeof famUser === 'function' ? famUser() : '';
    if (!N || !N.cardQueueTake || ibBusy || !me) return;
    if (!(window.firebase && firebase.auth && firebase.auth().currentUser)) return;   // 로그인 전에는 꺼내지 않음 (잃어버리지 않게)
    ibBusy = true;
    try {
        // 1) 폰 보관함 + (허용 시) 받은 문자함에서 놓친 문자 → 버퍼에 먼저 저장
        let buf = ibLS('ibBuf') || [];
        const q = await N.cardQueueTake().catch(() => ({ items: [] }));
        buf = buf.concat(q.items || []);
        try {
            const last = +(localStorage.getItem('ibSmsAt') || 0), days = last ? Math.min(14, Math.max(1, Math.ceil((Date.now() - last) / 864e5) + 1)) : (opt.days || 3);
            const s = await N.readCardSms({ days, ask: !!opt.ask });
            buf = buf.concat(s.items || []); localStorage.setItem('ibSmsAt', String(Date.now()));
        } catch (e) { /* 문자 읽기 미허용: 알림으로 받은 것만 */ }
        ibLS('ibBuf', buf);
        if (!buf.length) return;

        // 2) 이미 본 문자 거르기
        const seen = new Set(ibLS('ibSeen') || []), cards = [], smss = [], keys = new Set();
        for (const it of buf) {
            const raw = ibNorm(it.text); if (!raw) continue;
            const c = ibParseCard(raw, it.ts);
            const key = c ? c.key : 's_' + ibHash(raw);
            if (seen.has(key) || keys.has(key)) continue; keys.add(key);
            if (c) { if (ibCards[c.card]) cards.push({ ...c, raw, ts: it.ts || Date.now() }); else seen.add(key); }   // 지정 안 된 카드는 무시
            else smss.push({ key, raw, from: it.from || '', ts: it.ts || Date.now() });
        }

        // 3) 카드 → 가계부 확인 대기
        for (const c of cards) {
            await db.collection('inbox').doc(c.key).set({
                id: c.key, kind: 'card', owner: me, status: 'pending', at: Date.now(), ts: c.ts,
                card: c.card, member: ibCards[c.card], date: c.date, amt: c.cancel ? -c.amt : c.amt, cancel: c.cancel,
                merchant: c.merchant, category: ibCardCat(c.merchant), raw: c.raw
            });
            seen.add(c.key);
        }

        // 4) 그 밖의 문자 → AI가 정리 (광고·단순 안내는 버림)
        for (let i = 0; i < smss.length; i += 15) {
            const part = smss.slice(i, i + 15);
            let out = null;
            try { out = await ibAskAI(part); } catch (e) { out = null; }
            for (let k = 0; k < part.length; k++) {
                const s = part[k], a = out ? (out.find(o => +o.i === k) || { skip: true }) : { type: '문자', summary: s.raw.slice(0, 80) };
                if (!a.skip) await db.collection('inbox').doc(s.key).set({
                    id: s.key, kind: 'sms', owner: me, status: 'pending', at: Date.now(), ts: s.ts, from: s.from, raw: s.raw,
                    type: a.type || '문자', summary: a.summary || '', schedule: a.schedule && a.schedule.date ? a.schedule : null, reply: a.reply || ''
                });
                seen.add(s.key);
            }
        }
        ibLS('ibSeen', [...seen].slice(-3000));
        ibLS('ibBuf', []);
    } catch (e) {
        console.warn('ibDrain', e);
    } finally { ibBusy = false; }
}

async function ibAskAI(list) {
    const today = typeof famYmd === 'function' ? famYmd(new Date()) : new Date().toISOString().slice(0, 10);
    const sys = `너는 정우설의 문자 비서다. 오늘은 ${today}. 받은 문자 목록을 보고 JSON 배열만 출력한다 (설명·코드블록 없이).
각 문자마다 {"i":번호,"skip":true|false,"type":"택배|예약|병원|고지서|일정|개인|기타","summary":"한 줄 요약(누가·무엇·언제)","schedule":{"date":"YYYY-MM-DD","time":"HH:MM 또는 빈칸","title":"일정 제목","place":"장소 또는 빈칸"} 또는 null,"reply":"답장 초안 또는 빈칸"}
규칙:
- 광고·홍보·단순 결제/배송완료 안내·스팸처럼 할 일이 없는 문자는 skip:true.
- 날짜·시간이 정해진 방문·예약·진료·약속·납부기한이 있으면 schedule을 채운다. 연도가 없으면 오늘 이후 가장 가까운 날짜.
- 답장이 필요한 문자(질문, 확인 요청, 택배기사 문의 등)에만 reply를 쓴다. 정우설이 보내는 짧고 공손한 존댓말 1~2문장.
- 문자에 없는 내용은 지어내지 않는다.`;
    const user = list.map((s, i) => `[${i}] 보낸사람: ${s.from || '알 수 없음'} | 받은시각: ${new Date(s.ts).toLocaleString('ko-KR')}\n${s.raw}`).join('\n\n');
    const r = await famCallAI(sys, user, { maxTokens: 3000 });
    const m = String(r.text || '').match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]) : null;
}

// ── 확인 대기 목록 (내 것만) ─────────────────────────────
function ibListen() {
    const me = typeof famUser === 'function' ? famUser() : '';
    if (ibUnsub || !me || typeof db === 'undefined') return;
    ibUnsub = db.collection('inbox').where('owner', '==', me).where('status', '==', 'pending').onSnapshot(s => {
        ibItems = s.docs.map(d => d.data()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
        ibRenderBar();
        if (document.getElementById('ib-modal')) ibRender();
    }, () => {});
}
function ibRenderBar() {
    const el = document.getElementById('ib-bar'); if (!el) return;
    if (!ibItems.length) { el.innerHTML = ''; return; }
    const nc = ibItems.filter(x => x.kind === 'card').length, ns = ibItems.filter(x => x.kind === 'sms' && x.schedule).length, nr = ibItems.filter(x => x.reply).length;
    const parts = [nc && `가계부 ${nc}`, ns && `일정 ${ns}`, nr && `답장 ${nr}`].filter(Boolean);
    el.innerHTML = `<button class="ib-bar" onclick="ibOpen()">${fi('list')}<span>확인 대기 <b>${ibItems.length}</b>건${parts.length ? ' · ' + parts.join(' · ') : ''}</span>${fi('expand')}</button>`;
}
function ibOpen() {
    if (!document.getElementById('ib-modal')) {
        const m = document.createElement('div');
        m.id = 'ib-modal'; m.className = 'ib-dim'; m.style.display = 'flex';
        m.onclick = e => { if (e.target === m) ibClose(); };
        m.innerHTML = '<div class="ib-sheet"><div class="ib-head"><b>확인 대기</b><button class="fam-x" onclick="ibClose()">✕</button></div><div id="ib-body"></div></div>';
        document.body.appendChild(m);
        history.pushState({ ib: 1 }, '', '');
    }
    ibRender();
}
function ibClose() { const m = document.getElementById('ib-modal'); if (m) m.remove(); }
const ibWon = n => (n < 0 ? '-' : '') + Math.abs(n).toLocaleString('ko-KR') + '원';
const ibMD = d => { const p = String(d || '').split('-'); return p.length === 3 ? `${+p[1]}/${+p[2]}` : d; };
function ibRender() {
    const b = document.getElementById('ib-body'); if (!b) return;
    if (!ibItems.length) { b.innerHTML = '<div class="ib-empty">확인할 항목이 없습니다.</div>'; return; }
    const cards = ibItems.filter(x => x.kind === 'card'), smss = ibItems.filter(x => x.kind === 'sms');
    const cats = c => EXP_CATS.map(x => `<option ${x === c ? 'selected' : ''}>${x}</option>`).join('');
    let h = '';
    if (cards.length) {
        h += `<div class="ib-sec"><span>가계부 반영 ${cards.length}건</span><button class="fam-btn pri" onclick="ibCardAll()">모두 반영</button></div>`;
        h += cards.map(c => `<div class="ib-item">
            <div class="ib-row"><span class="ib-date">${ibMD(c.date)}</span><span class="ib-name">${famEsc(c.merchant)}${c.cancel ? ' <em class="ib-tag">취소</em>' : ''}</span><b class="ib-amt ${c.cancel ? 'minus' : ''}">${ibWon(c.amt)}</b></div>
            <div class="ib-row"><select id="ibc-${c.id}" class="fam-sel ib-cat">${cats(c.category)}</select><span class="ib-sub">${famEsc(c.member)}</span>
            <button class="fam-btn" onclick="ibSkip('${c.id}')">제외</button><button class="fam-btn pri" onclick="ibCardOk('${c.id}')">반영</button></div></div>`).join('');
    }
    if (smss.length) {
        h += `<div class="ib-sec"><span>문자 ${smss.length}건</span></div>`;
        h += smss.map(s => {
            const sc = s.schedule;
            return `<div class="ib-item">
            <div class="ib-row"><em class="ib-tag">${famEsc(s.type || '문자')}</em><span class="ib-name">${famEsc(s.summary || s.raw.slice(0, 60))}</span></div>
            <div class="ib-sub">${famEsc(s.from || '')} · ${new Date(s.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <details class="ib-raw"><summary>원문</summary>${famEsc(s.raw)}</details>
            ${sc ? `<div class="ib-sch">${fi('calendar')}<span>${ibMD(sc.date)}${sc.time ? ' ' + famEsc(sc.time) : ''} ${famEsc(sc.title || '')}${sc.place ? ' · ' + famEsc(sc.place) : ''}</span><button class="fam-btn pri" onclick="ibSchOk('${s.id}')">일정 등록</button></div>` : ''}
            ${s.reply ? `<textarea id="ibr-${s.id}" class="fam-in ib-reply" rows="2">${famEsc(s.reply)}</textarea>` : ''}
            <div class="ib-row ib-acts">${s.reply ? `<button class="fam-btn" onclick="famCopy(document.getElementById('ibr-${s.id}').value)">답장 복사</button><button class="fam-btn" onclick="famShare(document.getElementById('ibr-${s.id}').value)">답장 보내기</button>` : ''}<button class="fam-btn" onclick="ibSkip('${s.id}')">확인 완료</button></div></div>`;
        }).join('');
    }
    b.innerHTML = h;
}
const ibGet = id => ibItems.find(x => x.id === id);
async function ibSkip(id) { await db.collection('inbox').doc(id).update({ status: 'skip', doneAt: Date.now() }); }
async function ibCardSave(c, cat) {
    const aid = 'as_' + c.id;
    await db.collection('assets').doc(aid).set({ id: aid, member: c.member || '정우설', date: c.date, type: '지출', category: cat || c.category, pay: '카드', amt: c.amt, memo: c.merchant + (c.cancel ? ' (취소)' : ''), src: 'card' });
    await db.collection('inbox').doc(c.id).update({ status: 'done', doneAt: Date.now(), assetId: aid });
}
async function ibCardOk(id) {
    const c = ibGet(id); if (!c) return;
    const sel = document.getElementById('ibc-' + id);
    try { await ibCardSave(c, sel && sel.value); famToast(`${c.merchant} ${ibWon(c.amt)} 가계부에 반영`); } catch (e) { famToast('반영 실패: ' + e.message); }
}
async function ibCardAll() {
    const cs = ibItems.filter(x => x.kind === 'card'); let n = 0;
    for (const c of cs) { const sel = document.getElementById('ibc-' + c.id); try { await ibCardSave(c, sel && sel.value); n++; } catch (e) {} }
    famToast(n + '건을 가계부에 반영했습니다');
}
async function ibSchOk(id) {
    const s = ibGet(id); if (!s || !s.schedule) return;
    const sc = s.schedule, sid = 'sch_' + Date.now(), time = /^\d{1,2}:\d{2}$/.test(sc.time || '') ? sc.time : '';
    try {
        await db.collection('schedules').doc(sid).set({ id: sid, date: sc.date, priority: '일반', member: s.owner, category: '개인', timeType: time ? 'timed' : 'allday', startTime: time, endTime: '', place: sc.place || '', memo: sc.title || s.summary, repeat: null, src: 'sms' });
        await db.collection('inbox').doc(id).update(s.reply ? { schedule: null, schDone: sid } : { status: 'done', doneAt: Date.now(), schDone: sid });
        famToast(`${ibMD(sc.date)} 일정에 등록했습니다`);
    } catch (e) { famToast('등록 실패: ' + e.message); }
}

// ── 설정 화면 ─────────────────────────────────────────────
function ibSetHtml() {
    if (!ibN()) return '';
    return `<div class="fam-box"><h4>📥 문자 비서</h4>
        <div class="fam-note" style="margin:0 0 10px">이 폰의 문자를 읽어 카드 결제는 가계부 반영 대기로, 택배·예약 등은 요약·일정·답장 초안으로 올립니다. 반영은 확인을 눌러야 됩니다. 인증번호 문자는 저장하지 않습니다.</div>
        <div id="ib-state" class="fam-note" style="margin:0 0 8px">상태 확인 중…</div>
        <div class="fam-btns" style="margin-top:0"><button class="fam-btn" onclick="ibN().openCardListenerSettings()">알림 읽기 허용</button><button class="fam-btn" onclick="ibAskSms()">문자함 읽기 허용</button></div>
        <span class="fam-lbl">가계부에 넣을 카드 (끝 4자리 · 사용자)</span>
        <input class="fam-in" value="${famEsc(Object.entries(ibCards).map(([k, v]) => k + ' ' + v).join(', '))}" placeholder="예: 1089 정우설" onchange="ibSetCards(this.value)">
        <div class="fam-note">허용 버튼이 회색으로 막혀 있으면: 설정 → 애플리케이션 → 설연 → 오른쪽 위 ⋮ → '제한된 설정 허용' 후 다시 누르세요.</div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="ibCheckNow(this)">지금 문자 확인</button></div>
    </div>`;
}
async function ibStateRefresh() {
    const el = document.getElementById('ib-state'), N = ibN(); if (!el || !N) return;
    try { const s = await N.cardState(); el.innerHTML = `알림 읽기: <b>${s.listener ? '허용됨' : '꺼짐'}</b> · 문자함 읽기: <b>${s.sms ? '허용됨' : '꺼짐'}</b>`; } catch (e) { el.textContent = '새 버전 앱(APK)이 필요합니다'; }
}
function ibSetCards(v) {
    const o = {}; String(v).split(/[,\n]/).forEach(p => { const m = p.trim().match(/^(\d{4})\s*(.*)$/); if (m) o[m[1]] = m[2].trim() || famUser(); });
    ibCards = Object.keys(o).length ? o : IB_CARD_DEFAULT; ibLS('ibCards', ibCards); famToast('카드: ' + Object.keys(ibCards).join(', '));
}
async function ibAskSms() { try { await ibN().readCardSms({ days: 1, ask: true }); famToast('문자함 읽기를 허용했습니다'); } catch (e) { famToast('문자함 읽기가 허용되지 않았습니다'); } ibStateRefresh(); }
async function ibCheckNow(btn) {
    btn.disabled = true; const t = btn.textContent; btn.textContent = '확인 중…';
    await ibDrain({ days: 7 }); btn.disabled = false; btn.textContent = t;
    famToast(ibItems.length ? '확인 대기 ' + ibItems.length + '건' : '새로 확인할 문자가 없습니다');
}

// ── 시작: 로그인 후 목록 구독, 앱으로 돌아올 때마다 문자 가져오기 ──
(function ibBoot() {
    const start = () => { ibListen(); ibDrain(); };
    const wait = () => { if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(start, 1500); }); else setTimeout(wait, 1000); };
    window.addEventListener('load', () => setTimeout(wait, 500));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { ibDrain(); ibStateRefresh(); } });
    window.addEventListener('load', () => setTimeout(() => { const N = ibN(); if (N && N.addListener) N.addListener('cardQueued', () => ibDrain()); }, 2000));
})();
