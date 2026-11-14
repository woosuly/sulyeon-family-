// ═══════════════════════════════════════════════════════════
// 👪 가족 챙기기: 안부 연락 주기 · 경조사 장부
//   careList/{id} {name, rel, every(일), last(ms), phone}   — 연락한 지 오래되면 아침 브리핑에 표시
//   gyeongjo/{id} {date, person, rel, event, dir('보냄'|'받음'), amt, memo, by}
// ═══════════════════════════════════════════════════════════
let fmCare = [], fmGj = [], fmTab = 'care';
const fmW = n => (Number(n) || 0).toLocaleString('ko-KR') + '원';
const fmDays = ms => ms ? Math.floor((Date.now() - ms) / 864e5) : null;
const FM_EVENTS = ['결혼', '장례', '돌·백일', '생일·회갑·칠순', '병문안', '개업·이사', '기타'];

function fmListen() {
    try {
        db.collection('careList').onSnapshot(s => { fmCare = s.docs.map(d => ({ id: d.id, ...d.data() })); if (document.getElementById('fm-body')) fmRender(); }, () => {});
        db.collection('gyeongjo').onSnapshot(s => { fmGj = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date))); if (document.getElementById('fm-body')) fmRender(); }, () => {});
    } catch (e) {}
}
function fmOpen(tab) {
    if (tab) fmTab = tab;
    famSheet(`<div class="fam-h"><b>가족 챙기기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-seg" style="margin-bottom:10px"><button id="fm-t-care" onclick="fmTab='care';fmRender()">안부 연락</button><button id="fm-t-gj" onclick="fmTab='gj';fmRender()">경조사 장부</button></div>
        <div id="fm-body"></div>`);
    fmRender();
}
function fmRender() {
    const el = document.getElementById('fm-body'); if (!el) return;
    document.getElementById('fm-t-care')?.classList.toggle('on', fmTab === 'care'); document.getElementById('fm-t-gj')?.classList.toggle('on', fmTab === 'gj');
    if (fmTab === 'care') {
        const rows = fmCare.map(c => ({ ...c, d: fmDays(c.last), over: c.last ? fmDays(c.last) - (+c.every || 14) : 999 })).sort((a, b) => b.over - a.over);
        el.innerHTML = `<div class="fam-note" style="margin:0 0 8px">정한 주기보다 오래 연락하지 않으면 아침 브리핑에 알려 드립니다.</div>` +
            (rows.length ? rows.map(c => `<div class="ag-li"><span>${famEsc(c.rel || '')}</span><b>${famEsc(c.name)} <small style="color:${c.over > 0 ? '#d9465c' : '#94a3b8'};font-weight:600">${c.d == null ? '기록 없음' : c.d === 0 ? '오늘 연락' : c.d + '일 전'} · ${+c.every || 14}일마다</small></b>
                ${c.phone ? `<button class="fam-btn" style="padding:4px 8px;font-size:11px" onclick="fmCall('${c.id}')">전화</button>` : ''}<button class="fam-btn pri" style="padding:4px 8px;font-size:11px" onclick="fmContacted('${c.id}')">연락함</button><button class="fam-x" onclick="fmCareForm('${c.id}')">⋯</button></div>`).join('')
                : '<div class="fam-note">장인어른·장모님·형님처럼 자주 챙길 분을 넣어 두세요.</div>') +
            `<div class="fam-btns"><button class="fam-btn" onclick="fmCareForm()">＋ 사람 추가</button></div>`;
    } else {
        const q = (document.getElementById('fm-q') || {}).value || '';
        const list = fmGj.filter(g => !q || (g.person + g.rel + g.event + (g.memo || '')).includes(q));
        const sent = fmGj.filter(g => g.dir === '보냄').reduce((a, g) => a + (+g.amt || 0), 0), got = fmGj.filter(g => g.dir === '받음').reduce((a, g) => a + (+g.amt || 0), 0);
        el.innerHTML = `<div class="ff-form" style="margin-bottom:6px"><div class="full"><input id="fm-q" value="${famEsc(q)}" placeholder="이름으로 찾기" oninput="fmRender();this.focus();this.setSelectionRange(this.value.length,this.value.length)"></div></div>
            <div class="fam-note" style="margin:0 0 6px">보냄 ${fmW(sent)} · 받음 ${fmW(got)}</div>` +
            (list.length ? list.map(g => `<div class="ag-li" onclick="fmGjForm('${g.id}')" style="cursor:pointer"><span>${famEsc(String(g.date).slice(2).replace(/-/g, '.'))}</span><b>${famEsc(g.person)}${g.rel ? ` <small style="color:#94a3b8;font-weight:600">${famEsc(g.rel)}</small>` : ''} · ${famEsc(g.event)}</b><span style="color:${g.dir === '보냄' ? '#d9465c' : 'var(--month-header)'};font-weight:700">${g.dir === '보냄' ? '-' : '+'}${fmW(g.amt)}</span></div>`).join('')
                : '<div class="fam-note">축의금·조의금을 주고받은 기록을 남겨 두면, 그 분의 경조사 연락이 왔을 때 지난 기록을 함께 보여 드립니다.</div>') +
            `<div class="fam-btns"><button class="fam-btn" onclick="fmGjForm()">＋ 기록 추가</button></div>`;
    }
}
function fmCareForm(id) {
    const c = id ? fmCare.find(x => x.id === id) : { every: 14 };
    famSheet(`<div class="fam-h"><b>${id ? '수정' : '챙길 분 추가'}</b><button class="fam-x" onclick="fmOpen('care')">✕</button></div>
        <div class="ff-form"><div><label>이름</label><input id="fc-name" value="${famEsc(c.name || '')}" placeholder="예: 장모님"></div><div><label>관계</label><input id="fc-rel" value="${famEsc(c.rel || '')}" placeholder="예: 처가"></div>
        <div><label>연락 주기(일)</label><input id="fc-every" type="number" inputmode="numeric" value="${+c.every || 14}"></div><div><label>전화번호 (선택)</label><input id="fc-phone" inputmode="tel" value="${famEsc(c.phone || '')}"></div></div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="fmCareSave('${id || ''}')">저장</button>${id ? `<button class="fam-btn" onclick="if(confirm('지울까요?'))db.collection('careList').doc('${id}').delete().then(()=>fmOpen('care'))">삭제</button>` : ''}</div>`);
}
async function fmCareSave(id) {
    const g = k => document.getElementById('fc-' + k).value.trim(); if (!g('name')) return famToast('이름을 넣어 주세요');
    const nid = id || 'cr_' + Date.now(), prev = fmCare.find(x => x.id === id) || {};
    await db.collection('careList').doc(nid).set({ id: nid, name: g('name'), rel: g('rel'), every: Math.max(1, +g('every') || 14), phone: g('phone'), last: prev.last || Date.now(), by: famUser() });
    fmOpen('care');
}
async function fmContacted(id) { await db.collection('careList').doc(id).update({ last: Date.now(), lastBy: famUser() }); famToast('연락 기록했습니다'); }
function fmCall(id) {
    const c = fmCare.find(x => x.id === id); if (!c || !c.phone) return;
    const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    if (N && N.dial) N.dial({ number: c.phone }); else location.href = 'tel:' + c.phone;
    fmContacted(id);
}
function fmGjForm(id, pre) {
    const g = id ? fmGj.find(x => x.id === id) : { date: famYmd(new Date()), dir: '보냄', event: '결혼', ...(pre || {}) };
    famSheet(`<div class="fam-h"><b>${id ? '경조사 수정' : '경조사 기록'}</b><button class="fam-x" onclick="fmOpen('gj')">✕</button></div>
        <div class="ff-form"><div><label>누구</label><input id="fg-person" value="${famEsc(g.person || '')}" placeholder="이름"></div><div><label>관계</label><input id="fg-rel" value="${famEsc(g.rel || '')}" placeholder="예: 회사 동료"></div>
        <div><label>종류</label><select id="fg-event">${FM_EVENTS.map(e => `<option ${e === g.event ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
        <div><label>주고받음</label><select id="fg-dir"><option ${g.dir === '보냄' ? 'selected' : ''}>보냄</option><option ${g.dir === '받음' ? 'selected' : ''}>받음</option></select></div>
        <div><label>금액</label><input id="fg-amt" type="text" inputmode="numeric" value="${g.amt ? (+g.amt).toLocaleString('ko-KR') : ''}" oninput="asAmtFmt(this)"></div><div><label>날짜</label><input id="fg-date" type="date" value="${g.date || ''}"></div>
        <div class="full"><label>메모</label><input id="fg-memo" value="${famEsc(g.memo || '')}" placeholder="예: 화환도 보냄"></div></div>
        ${!id ? '<label class="fam-chk" style="border:none;padding:0;background:none;font-size:12px"><input type="checkbox" id="fg-asset" checked> 보낸 돈은 가계부(가족)에도 기록</label>' : ''}
        <div class="fam-btns"><button class="fam-btn pri" onclick="fmGjSave('${id || ''}')">저장</button>${id ? `<button class="fam-btn" onclick="if(confirm('지울까요?'))db.collection('gyeongjo').doc('${id}').delete().then(()=>fmOpen('gj'))">삭제</button>` : ''}</div>`);
}
async function fmGjSave(id) {
    const g = k => document.getElementById('fg-' + k).value.trim(), amt = +String(g('amt')).replace(/[^\d]/g, '') || 0;
    if (!g('person')) return famToast('이름을 넣어 주세요');
    const nid = id || 'gj_' + Date.now(), v = { id: nid, person: g('person'), rel: g('rel'), event: g('event'), dir: g('dir'), amt, date: g('date') || famYmd(new Date()), memo: g('memo'), by: famUser() };
    await db.collection('gyeongjo').doc(nid).set(v);
    const toAsset = document.getElementById('fg-asset');
    if (!id && toAsset && toAsset.checked && v.dir === '보냄' && amt) {
        const aid = 'as_' + nid; await db.collection('assets').doc(aid).set({ id: aid, member: famUser() || '공통', date: v.date, type: '지출', category: '가족', pay: '현금', amt, memo: `${v.person} ${v.event}`, src: 'gyeongjo' });
    }
    famToast('기록했습니다'); fmOpen('gj');
}
// 문자·카톡에 이름이 나오면 지난 경조사 기록 찾기 (확인 대기 화면에서 사용)
function fmGjFor(text) {
    const t = String(text || ''); if (!t || !fmGj.length) return [];
    return fmGj.filter(g => g.person && g.person.length >= 2 && t.includes(g.person)).slice(0, 3);
}

(function fmBoot() {
    const wait = () => { if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(fmListen, 1500); }); else setTimeout(wait, 1000); };
    window.addEventListener('load', () => setTimeout(wait, 800));
})();
