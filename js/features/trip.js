// ═══════════════════════════════════════════════════════════
// ✈️ 여행 기록 — 여행별 경비(가계부 연결) · 사진(앨범 연결) · 외화 환산
//   가계부 항목 필드: tripId(여행 id), cur(통화), fAmt(현지 금액), rate(1단위당 원)
//   amt는 항상 원화 → 기존 집계·분석은 그대로 동작
//   여행 필드: albumId(연결 앨범 폴더), currency(최근 사용 통화)
// ═══════════════════════════════════════════════════════════
const FX_CURS = [['KRW', '원'], ['EUR', '유로'], ['USD', '달러'], ['JPY', '엔'], ['CNY', '위안'], ['GBP', '파운드'], ['CHF', '스위스 프랑'], ['CZK', '체코 코루나'], ['HUF', '헝가리 포린트'],
    ['VND', '베트남 동'], ['THB', '태국 바트'], ['TWD', '대만 달러'], ['HKD', '홍콩 달러'], ['SGD', '싱가포르 달러'], ['AUD', '호주 달러'], ['CAD', '캐나다 달러'], ['PHP', '필리핀 페소']];
const FX_SIGN = { KRW: '₩', EUR: '€', USD: '$', JPY: '¥', CNY: '¥', GBP: '£', CHF: 'CHF ', CZK: 'Kč ', HUF: 'Ft ', VND: '₫', THB: '฿', TWD: 'NT$', HKD: 'HK$', SGD: 'S$', AUD: 'A$', CAD: 'C$', PHP: '₱' };
const fxFmt = (cur, v) => (FX_SIGN[cur] || cur + ' ') + Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
let famTripForce = null;

// ── 환율 (1단위당 원화) — 하루 1번 받아 폰에 보관, 오프라인이면 마지막 값 사용 ──
async function famFxRates() {
    let c = null; try { c = JSON.parse(localStorage.getItem('famFx') || 'null'); } catch (e) {}
    const today = famYmd(new Date());
    if (c && c.date === today && c.rates) return c.rates;
    const save = rates => { try { localStorage.setItem('famFx', JSON.stringify({ date: today, rates })); } catch (e) {} return rates; };
    try {
        const j = await (await fetch('https://open.er-api.com/v6/latest/KRW')).json();
        if (j && j.rates) { const r = {}; Object.entries(j.rates).forEach(([k, v]) => { if (v) r[k] = 1 / v; }); return save(r); }
    } catch (e) {}
    try {
        const j = await (await fetch('https://api.frankfurter.app/latest?from=KRW')).json();
        if (j && j.rates) { const r = {}; Object.entries(j.rates).forEach(([k, v]) => { if (v) r[k] = 1 / v; }); return save(r); }
    } catch (e) {}
    return (c && c.rates) || {};
}
const fxRound = r => Math.round(r * 100) / 100;

// ── "커피 4.5유로", "€12", "20불" 같은 외화 금액 인식 ──
function famParseForeign(text) {
    const t = String(text || ''); let m;
    const SYM = { '€': 'EUR', '$': 'USD', '£': 'GBP', '¥': 'JPY', '₫': 'VND', '฿': 'THB' };
    if ((m = t.match(/([€$£¥₫฿])\s*(\d+(?:[.,]\d+)?)/))) return { cur: SYM[m[1]], fAmt: parseFloat(m[2].replace(',', '.')), rest: t.replace(m[0], ' ') };
    const U = [[/대만\s*달러|twd/i, 'TWD'], [/홍콩\s*달러|hkd/i, 'HKD'], [/싱가포르\s*달러|sgd/i, 'SGD'], [/호주\s*달러|aud/i, 'AUD'], [/캐나다\s*달러|cad/i, 'CAD'],
        [/스위스\s*프랑|chf|프랑/i, 'CHF'], [/유로|eur/i, 'EUR'], [/달러|불|usd/i, 'USD'], [/엔|jpy/i, 'JPY'], [/위안|元|cny|rmb/i, 'CNY'], [/파운드|gbp/i, 'GBP'],
        [/코루나|czk/i, 'CZK'], [/포린트|huf/i, 'HUF'], [/바트|thb/i, 'THB'], [/페소|php/i, 'PHP'], [/동|vnd/i, 'VND']];
    for (const [re, cur] of U) {
        const r = new RegExp('(\\d+(?:[.,]\\d+)?)\\s*(?:' + re.source + ')(?![가-힣a-z])', 'i');
        if ((m = t.match(r))) {
            const v = parseFloat(m[1].replace(',', '.'));
            if (cur === 'VND' && v < 1000) continue;            // "101동" 같은 주소 오인 방지
            return { cur, fAmt: v, rest: t.replace(m[0], ' ') };
        }
    }
    return null;
}

// ── 여행 찾기 ──
const tripEnd = p => p.end || p.start || '';
function famTripFor(date) {
    if (!date) return '';
    const hit = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && p.start <= date && tripEnd(p) >= date).sort((a, b) => b.start.localeCompare(a.start));
    return hit.length ? hit[0].id : '';
}
const famTripById = id => (typeof planData !== 'undefined' ? planData : []).find(p => p.id === id);
const tripLabel = p => `${getTypeIcon(p.subType)} ${p.loc || '미정'} (${(p.start || '').slice(2).replace(/-/g, '.')})`;

function famTripSelHtml(pre, date, sel, onlyActive) {
    const all = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start);
    const near = d => { const a = new Date((date || famYmd(new Date())) + 'T00:00:00'), b = new Date(d + 'T00:00:00'); return Math.abs(a - b) / 864e5; };
    let list = all.filter(p => p.id === sel || near(p.start) <= 45 || near(tripEnd(p)) <= 45);
    if (onlyActive && !sel && !famTripFor(date)) return '';
    if (!list.length) list = all.slice().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8);
    if (!list.length) return '';
    list.sort((a, b) => b.start.localeCompare(a.start));
    return `<div class="full"><label>✈️ 여행 연결</label><select id="${pre}-trip" onchange="famTripPicked('${pre}')">
        <option value="">연결 안 함</option>${list.map(p => `<option value="${famEsc(p.id)}" ${p.id === sel ? 'selected' : ''}>${famEsc(tripLabel(p))}</option>`).join('')}</select></div>`;
}
function famTripPicked(pre) {
    const t = famTripById((document.getElementById(pre + '-trip') || {}).value), c = document.getElementById(pre + '-cur'), fa = document.getElementById(pre + '-famt');
    if (t && t.currency && c && c.value === 'KRW' && !(fa && fa.value)) { c.value = t.currency; famFxCur(pre); }
}

// ── 외화 입력 줄 ──
function famFxRowHtml(pre, p) {
    const cur = (p.cur && p.cur !== 'KRW') ? p.cur : ((famTripById(p.tripId) || {}).currency || 'KRW'), show = cur !== 'KRW';
    return `<div class="full fx-row">
        <button type="button" class="fx-link" id="${pre}-fxbtn" ${show ? 'style="display:none"' : ''} onclick="famFxShow('${pre}')">💱 외화로 입력</button>
        <div class="fx-grid" id="${pre}-fxgrid" ${show ? '' : 'style="display:none"'}>
            <div><label>통화</label><select id="${pre}-cur" onchange="famFxCur('${pre}')">${FX_CURS.map(([k, n]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k} ${n}</option>`).join('')}</select></div>
            <div><label>현지 금액</label><input id="${pre}-famt" type="number" inputmode="decimal" step="any" value="${p.fAmt || ''}" oninput="famFxCalc('${pre}')"></div>
            <div><label>환율 (원)</label><input id="${pre}-rate" type="number" inputmode="decimal" step="any" value="${p.rate ? fxRound(p.rate) : ''}" oninput="famFxCalc('${pre}')"></div>
        </div>
        <div class="fx-note" id="${pre}-fxnote"></div></div>`;
}
function famFxShow(pre) {
    const c = document.getElementById(pre + '-cur'); let last = 'EUR'; try { last = localStorage.getItem('famLastCur') || 'EUR'; } catch (e) {}
    const t = famTripById((document.getElementById(pre + '-trip') || {}).value);
    c.value = (t && t.currency) || last; famFxCur(pre);
    setTimeout(() => { const f = document.getElementById(pre + '-famt'); if (f) f.focus(); }, 50);
}
async function famFxCur(pre) {
    const c = document.getElementById(pre + '-cur'), grid = document.getElementById(pre + '-fxgrid'), btn = document.getElementById(pre + '-fxbtn'), note = document.getElementById(pre + '-fxnote');
    if (!c) return;
    if (c.value === 'KRW') { grid.style.display = 'none'; btn.style.display = ''; note.textContent = ''; return; }
    grid.style.display = ''; btn.style.display = 'none';
    try { localStorage.setItem('famLastCur', c.value); } catch (e) {}
    note.textContent = '환율 확인 중…';
    const r = (await famFxRates())[c.value];
    const rate = document.getElementById(pre + '-rate');
    if (r && rate) rate.value = fxRound(r);
    if (!r) note.textContent = '환율을 가져오지 못했습니다. 환율을 직접 입력하세요.';
    famFxCalc(pre);
}
function famFxCalc(pre) {
    const c = document.getElementById(pre + '-cur'), fa = +((document.getElementById(pre + '-famt') || {}).value || 0), rt = +((document.getElementById(pre + '-rate') || {}).value || 0), note = document.getElementById(pre + '-fxnote'), amt = document.getElementById(pre + '-amt');
    if (!c || c.value === 'KRW') return;
    if (fa && rt && amt) amt.value = Math.round(fa * rt);
    if (note) note.textContent = rt ? `1 ${c.value} = ${rt.toLocaleString('ko-KR')}원${fa ? ` · ${fxFmt(c.value, fa)} ≈ ${Math.round(fa * rt).toLocaleString('ko-KR')}원` : ''}` : '환율을 입력하세요';
}
function famFxInit(pre, p) {
    const c = document.getElementById(pre + '-cur'); if (!c || c.value === 'KRW') return;
    if (!(document.getElementById(pre + '-rate') || {}).value) famFxCur(pre); else famFxCalc(pre);
}
async function famFxApply(list) {
    if (!list.some(x => x.cur && x.cur !== 'KRW')) return;
    const rates = await famFxRates();
    list.forEach(x => { if (!x.cur || x.cur === 'KRW') return; const r = rates[x.cur]; x.rate = r || 0; if (r) x.amt = Math.round(x.fAmt * r); });
}

// ── 저장할 값 (가계부 문서에 덧붙임) ──
function famTripVals(pre) {
    const v = {}, el = k => document.getElementById(pre + '-' + k), t = el('trip'), c = el('cur');
    if (t) v.tripId = t.value || '';
    if (c) {
        if (c.value !== 'KRW' && +(el('famt') || {}).value) { v.cur = c.value; v.fAmt = +el('famt').value; v.rate = +(el('rate') || {}).value || 0; }
        else { v.cur = ''; v.fAmt = 0; v.rate = 0; }
    }
    // 여행에 쓴 통화를 기억 → 다음 입력 때 자동 선택
    const tp = famTripById(v.tripId);
    if (tp && v.cur && tp.currency !== v.cur) db.collection('plans').doc(tp.id).update({ currency: v.cur }).catch(() => {});
    return v;
}
// 가계부 입력 모달에 여행·외화 입력 추가
function famTripAssetInit(data, date) {
    const box = document.getElementById('as-trip-box'); if (!box) return;
    const p = data ? { tripId: data.tripId || '', cur: data.cur, fAmt: data.fAmt, rate: data.rate } : { tripId: famTripForce || famTripFor(date) };
    famTripForce = null;
    box.innerHTML = `<div class="ff-form" style="margin-top:14px">${famTripSelHtml('as', date, p.tripId, false)}${famFxRowHtml('as', p)}</div>`;
    famFxInit('as', p);
}

// ── 여행 상세: 기록 (경비 · 사진) ──
function tripAssets(pid) { return (typeof anaAll === 'function' ? anaAll() : []).filter(e => e.tripId === pid); }
function tripCost(pid) { return tripAssets(pid).reduce((a, e) => a + (e.type === '지출' ? e.amt : -e.amt), 0); }
function tripFolder(p) { return p.albumId ? (typeof albumData !== 'undefined' ? albumData : []).find(f => f.id === p.albumId) : null; }
function tripCardCost(p) {
    const n = tripCost(p.id), f = tripFolder(p), ph = f ? (f.photos || []).length : 0;
    if (!n && !ph) return '';
    return `<div class="trip-chip">${n ? `💰 ${svW(n)}` : ''}${n && ph ? ' · ' : ''}${ph ? `📷 ${ph}장` : ''}</div>`;
}
function tripRecordHtml(p) {
    const rows = tripAssets(p.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const exp = rows.filter(e => e.type === '지출'), back = rows.filter(e => e.type === '수입');
    const total = exp.reduce((a, e) => a + e.amt, 0) - back.reduce((a, e) => a + e.amt, 0);
    const byCat = {}; exp.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amt);
    const byCur = {}; exp.filter(e => e.cur && e.cur !== 'KRW').forEach(e => { const o = byCur[e.cur] || (byCur[e.cur] = { f: 0, k: 0 }); o.f += Number(e.fAmt) || 0; o.k += e.amt; });
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]), max = cats.length ? cats[0][1] : 1;
    const ps = p.start, pe = tripEnd(p);
    const loose = ps ? (typeof anaAll === 'function' ? anaAll() : []).filter(e => e.type === '지출' && !e.tripId && !e.fixedId && e.date >= ps && e.date <= pe) : [];
    const people = p.member === '공통' ? 2 : 1, days = ps ? Math.max(1, Math.round((new Date(pe + 'T00:00:00') - new Date(ps + 'T00:00:00')) / 864e5) + 1) : 1;
    const f = tripFolder(p), photos = f ? (f.photos || []) : [];
    const pid = famEsc(p.id);
    return `
    <div class="trip-sec"><div class="trip-h">💰 경비 <b>${svW(total)}</b>${rows.length ? `<small>${rows.length}건${people > 1 ? ` · 1인당 ${svW(total / people)}` : ''}${days > 1 ? ` · 하루 ${svW(total / days)}` : ''}</small>` : ''}</div>
        ${cats.length ? cats.map(([k, v]) => `<div class="bd-row"><span class="bd-n">${famEsc(k)}</span><div class="sv-bar" style="flex:1;margin:0"><i style="width:${Math.max(3, v / max * 100)}%"></i></div><span class="bd-v">${svW(v)}</span></div>`).join('') : '<div class="fam-note" style="margin:0">아직 연결된 경비가 없습니다.</div>'}
        ${Object.keys(byCur).length ? `<div class="fam-note">${Object.entries(byCur).map(([k, o]) => `${fxFmt(k, o.f)} → ${svW(o.k)} (평균 ${Math.round(o.k / (o.f || 1)).toLocaleString('ko-KR')}원)`).join(' · ')}</div>` : ''}
        ${back.length ? `<div class="fam-note">환급·정산 ${svW(back.reduce((a, e) => a + e.amt, 0))} 차감</div>` : ''}
        ${rows.length ? `<details class="trip-list"><summary>내역 보기</summary>${rows.map(e => `<div class="trip-row"><span>${famEsc(String(e.date).slice(5).replace('-', '/'))}</span><span class="trip-memo">${famEsc(e.memo || e.category)}${e.cur && e.cur !== 'KRW' ? ` <small>${fxFmt(e.cur, e.fAmt)}</small>` : ''}</span><b style="color:${e.type === '수입' ? '#059669' : '#334155'}">${e.type === '수입' ? '+' : ''}${svW(e.amt)}</b><button title="연결 해제" onclick="tripUnlink('${famEsc(e.id)}','${pid}')">✕</button></div>`).join('')}</details>` : ''}
        <div class="trip-btns"><button class="fam-btn pri" onclick="tripAddCost('${pid}')">＋ 경비 추가</button>
        ${loose.length ? `<button class="fam-btn" onclick="tripLinkSheet('${pid}')">기간 중 미연결 ${loose.length}건 연결</button>` : ''}</div>
    </div>
    <div class="trip-sec"><div class="trip-h">📷 사진 ${photos.length ? `<small>${photos.length}장</small>` : ''}</div>
        ${f ? `${photos.length ? `<div class="trip-ph">${photos.slice(0, 8).map(u => `<img src="${famEsc(u)}" loading="lazy" onclick="openLightbox(this.src)">`).join('')}</div>` : '<div class="fam-note" style="margin:0">아직 사진이 없습니다.</div>'}
            <div class="trip-btns"><button class="fam-btn" onclick="tripOpenAlbum('${pid}',false)">앨범 열기</button><button class="fam-btn" onclick="tripOpenAlbum('${pid}',true)">📷 사진 추가</button></div>`
        : `<div class="trip-btns"><button class="fam-btn pri" onclick="tripOpenAlbum('${pid}',true)">📷 앨범 폴더 만들고 사진 추가</button>${(typeof albumData !== 'undefined' && albumData.length) ? `<select class="fam-mini-sel" onchange="if(this.value)tripLinkAlbum('${pid}',this.value)"><option value="">기존 폴더 연결…</option>${albumData.map(x => `<option value="${famEsc(x.id)}">📁 ${famEsc(x.name)}</option>`).join('')}</select>` : ''}</div>`}
    </div>`;
}
function tripReopen(pid) { setTimeout(() => { const p = famTripById(pid); if (p && !document.getElementById('travel-detail-modal').classList.contains('hidden')) openTravelDetail(p); }, 450); }
function tripAddCost(pid) {
    const p = famTripById(pid); if (!p) return;
    const today = famYmd(new Date()), d = (today >= p.start && today <= tripEnd(p)) ? today : p.start;
    famTripForce = pid; closeTravelDetail(); openAssetEntryModal(null, d);
    resetChips('as-type-group', '지출', 'as-type'); toggleAssetCat();
    const c = document.querySelector('#as-expense-cat-group .sch-chip[data-val="여행비"]'); if (c) selectChip(c, 'as-expense-cat-group');
}
function tripUnlink(aid, pid) {
    if (!confirm('이 항목을 여행에서 빼까요? 가계부 기록은 그대로 남습니다.')) return;
    db.collection('assets').doc(aid).update({ tripId: '' }).then(() => tripReopen(pid)).catch(e => famToast(e.message));
}
function tripLinkSheet(pid) {
    const p = famTripById(pid); if (!p) return;
    const list = anaAll().filter(e => e.type === '지출' && !e.tripId && !e.fixedId && e.date >= p.start && e.date <= tripEnd(p)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    famSheet(`<div class="fam-h"><b>✈️ ${famEsc(p.loc || '')} 경비로 연결</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:-4px 0 10px">여행 기간에 기록된 지출입니다. 여행 경비에 넣을 항목만 체크하세요. (정기 이체 자동 기록은 제외)</div>
        <div class="fam-box" id="trip-link-list">${list.map(e => `<label class="fam-row" style="cursor:pointer"><input type="checkbox" value="${famEsc(e.id)}" ${['여행비', '식사', '교통비', '여가'].includes(e.category) ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--month-header)">
            <span style="flex:none;width:40px;color:#94a3b8;font-size:11px">${famEsc(String(e.date).slice(5))}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${famEsc(e.category)}${e.memo ? ' · ' + famEsc(e.memo) : ''} <small style="color:#94a3b8">${famEsc(e._m)}</small></span><b>${svW(e.amt)}</b></label>`).join('')}</div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="tripLinkSave('${famEsc(pid)}',this)">연결</button></div>`);
}
async function tripLinkSave(pid, btn) {
    const ids = [...document.querySelectorAll('#trip-link-list input:checked')].map(i => i.value);
    if (!ids.length) { famToast('선택한 항목이 없습니다'); return; }
    btn.disabled = true;
    try { const b = db.batch(); ids.forEach(id => b.update(db.collection('assets').doc(id), { tripId: pid })); await b.commit(); famSheetClose(); famToast(ids.length + '건을 연결했습니다'); tripReopen(pid); }
    catch (e) { btn.disabled = false; famToast(e.message); }
}
async function tripLinkAlbum(pid, fid) {
    try { await db.collection('plans').doc(pid).update({ albumId: fid }); await db.collection('albums').doc(fid).update({ planId: pid }); tripReopen(pid); }
    catch (e) { famToast(e.message); }
}
async function tripOpenAlbum(pid, upload) {
    const p = famTripById(pid); if (!p) return;
    let fid = p.albumId && tripFolder(p) ? p.albumId : '';
    if (!fid) {
        fid = 'f_' + Date.now();
        const name = `${(p.start || '').slice(2, 7).replace('-', '.')} ${p.loc || p.subType || '여행'}`.trim();
        try { await db.collection('albums').doc(fid).set({ id: fid, name, photos: [], planId: pid }); await db.collection('plans').doc(pid).update({ albumId: fid }); }
        catch (e) { famToast('폴더를 만들지 못했습니다: ' + e.message); return; }
        if (!albumData.find(x => x.id === fid)) albumData.push({ id: fid, name, photos: [], planId: pid });
    }
    closeTravelDetail(); showSection('photo-section');
    setTimeout(() => { openFolderDetail(fid); if (upload) document.getElementById('gallery-upload').click(); }, 250);
}
