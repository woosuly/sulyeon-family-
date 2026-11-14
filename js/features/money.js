// ═══════════════════════════════════════════════════════════
// 💳 돈·생활 관리: 정기결제 감지 · 차량 · 엑셀 내보내기
//   (저축·정기이체 화면에 표시, 알림은 비서 리마인더 agRemindAdd 사용)
// ═══════════════════════════════════════════════════════════
const mnW = n => Math.round(Number(n) || 0).toLocaleString('ko-KR') + '원';
const mnYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mnNorm = s => String(s || '').replace(/\(취소\)|\[고정\]|\(주\)|주식회사|㈜/g, '').split(' · ')[0].replace(/\s+/g, '').toLowerCase();

// ── 정기결제 감지: 최근 6개월 카드 지출 중 매달 비슷한 날·비슷한 금액으로 반복된 것 ──
function subDetect() {
    const all = typeof anaAll === 'function' ? anaAll() : [], now = new Date();
    const from = mnYmd(new Date(now.getFullYear(), now.getMonth() - 6, 1));
    const g = {};
    all.filter(e => e.type === '지출' && e.amt > 0 && e.date >= from && e.memo && !/\[고정\]/.test(e.memo)).forEach(e => { const k = mnNorm(e.memo); if (k.length >= 2) (g[k] = g[k] || []).push(e); });
    const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const out = [];
    Object.values(g).forEach(list => {
        const byM = {}; list.forEach(e => { const m = e.date.slice(0, 7); (byM[m] = byM[m] || []).push(e); });
        const months = Object.keys(byM).sort(); if (months.length < 2) return;
        if (Object.values(byM).some(v => v.length > 2)) return;                 // 한 달에 여러 번 = 정기결제 아님 (마트·카페 등)
        const one = months.map(m => byM[m][0]), amts = one.map(e => e.amt), days = one.map(e => +e.date.slice(8, 10));
        const ma = med(amts), md = med(days);
        if (amts.some(a => Math.abs(a - ma) > ma * 0.2)) return;                // 금액이 ±20% 안
        if (days.some(d => Math.min(Math.abs(d - md), 31 - Math.abs(d - md)) > 4)) return;   // 날짜가 ±4일 안
        const lastM = months[months.length - 1], thisM = mnYmd(now).slice(0, 7), prevM = mnYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
        if (lastM !== thisM && lastM !== prevM) return;                         // 최근 두 달 안에 결제된 것만
        let next = new Date(now.getFullYear(), now.getMonth() + (lastM === thisM ? 1 : 0), Math.min(md, 28));
        if (next < now) next = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(md, 28));
        const changed = amts.length >= 2 && amts[amts.length - 1] !== amts[amts.length - 2];
        out.push({ name: one[one.length - 1].memo.split(' · ')[0], amt: ma, day: md, months: months.length, next: mnYmd(next), last: amts[amts.length - 1], prev: amts[amts.length - 2], changed, cat: one[0].category });
    });
    return out.sort((a, b) => b.amt - a.amt);
}
function subRender() {
    const el = document.getElementById('sub-list'); if (!el) return;
    const subs = subDetect(), tot = subs.reduce((s, x) => s + x.amt, 0);
    if (!subs.length) { el.innerHTML = '<div class="fam-note" style="margin:0">카드 내역이 2개월 이상 쌓이면 매달 반복되는 결제(구독·통신·보험 등)를 찾아 보여 줍니다.</div>'; return; }
    el.innerHTML = `<div class="fam-note" style="margin:0 0 6px">월 약 <b>${mnW(tot)}</b> · ${subs.length}건 (카드 결제로 이미 가계부에 들어가므로 정기 이체로 따로 넣지 않아도 됩니다)</div>` +
        subs.map((x, i) => `<div class="ag-li"><span>매월 ${x.day}일</span><b>${famEsc(x.name)}${x.changed ? ` <em class="ib-tag warn">금액 변경 ${mnW(x.prev)}→${mnW(x.last)}</em>` : ''}</b><span>${mnW(x.amt)}</span><button class="fam-btn" style="padding:4px 8px;font-size:11px" onclick="subRemind(${i})">알림</button></div>`).join('');
}
async function subRemind(i) {
    const x = subDetect()[i]; if (!x || typeof agRemindAdd !== 'function') return;
    const at = new Date(x.next + 'T09:00:00'); at.setDate(at.getDate() - 1);
    await agRemindAdd({ at: Math.max(at.getTime(), Date.now() + 10 * 6e4), title: `내일 ${x.name} 결제 예정 (약 ${mnW(x.amt)})`, kind: 'sub' });
    famToast(`${x.next.slice(5).replace('-', '/')} 결제 하루 전에 알려드립니다`);
}

// ── 차량: 보험 만기·자동차 검사·정기 점검 → 알림, 이번 달 충전·주유비 ──
let carCfg = {};
function carListen() { try { db.collection('config').doc('vehicle').onSnapshot(d => { carCfg = d.exists ? d.data() : {}; carRender(); }, () => {}); } catch (e) {} }
function carFuel(ym) {
    const all = typeof anaAll === 'function' ? anaAll() : [];
    return all.filter(e => e.type === '지출' && String(e.date).startsWith(ym) && /차지비|충전|에버온|이브이|EV|환경부|주유|오일뱅크|SK에너지|GS칼텍스|S-?OIL|현대오일/i.test(e.memo || '')).reduce((s, e) => s + e.amt, 0);
}
function carRender() {
    const el = document.getElementById('car-box'); if (!el) return;
    const now = new Date(), ym = mnYmd(now).slice(0, 7), pym = mnYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    const c = carCfg, row = (k, n) => c[k] ? `<div class="ag-li"><span>${n}</span><b>${c[k]}</b><span>${carDday(c[k])}</span></div>` : '';
    el.innerHTML = `<div class="fam-note" style="margin:0 0 6px">이번 달 충전·주유 <b>${mnW(carFuel(ym))}</b> · 지난달 ${mnW(carFuel(pym))}</div>
        ${c.name ? `<div class="ag-li"><span>차량</span><b>${famEsc(c.name)}</b></div>` : ''}${row('insurance', '보험 만기')}${row('inspection', '자동차 검사')}${row('service', '다음 점검')}
        ${!c.insurance && !c.inspection && !c.service ? '<div class="fam-note" style="margin:0">보험 만기·검사일을 넣어 두면 2주 전과 전날에 알려 드립니다.</div>' : ''}`;
}
function carDday(d) { const n = Math.ceil((new Date(d + 'T00:00:00') - new Date(mnYmd(new Date()) + 'T00:00:00')) / 864e5); return n === 0 ? '오늘' : n > 0 ? `D-${n}` : `${-n}일 지남`; }
function carForm() {
    const c = carCfg;
    famSheet(`<div class="fam-h"><b>차량 정보</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="ff-form">
            <div class="full"><label>차량 (메모)</label><input id="car-name" value="${famEsc(c.name || '')}" placeholder="예: 아이오닉5 · 12가 3456 · ○○화재"></div>
            <div><label>보험 만기</label><input type="date" id="car-insurance" value="${c.insurance || ''}"></div>
            <div><label>자동차 검사일</label><input type="date" id="car-inspection" value="${c.inspection || ''}"></div>
            <div class="full"><label>다음 점검·소모품 교체</label><input type="date" id="car-service" value="${c.service || ''}"></div>
        </div><div class="fam-btns"><button class="fam-btn pri" onclick="carSave()">저장 (알림 함께 설정)</button></div>`);
}
async function carSave() {
    const g = k => document.getElementById('car-' + k).value.trim(), v = { name: g('name'), insurance: g('insurance'), inspection: g('inspection'), service: g('service'), at: Date.now() };
    await db.collection('config').doc('vehicle').set(v);
    // 날짜마다 2주 전·전날 알림 (같은 항목의 예전 알림은 같은 번호로 덮어씀)
    const N = { insurance: '자동차 보험 만기', inspection: '자동차 검사', service: '차량 점검' };
    for (const k of Object.keys(N)) for (const [suf, days] of [['14', 14], ['1', 1]]) {
        const id = `car_${k}_${suf}`;
        await db.collection('reminders').doc(id).delete().catch(() => {});
        if (!v[k]) continue;
        const at = new Date(v[k] + 'T09:00:00'); at.setDate(at.getDate() - days);
        if (at.getTime() > Date.now()) await agRemindAdd({ id, at: at.getTime(), title: `${N[k]} ${days === 1 ? '내일' : '2주 뒤'} (${v[k].slice(5).replace('-', '/')})`, kind: 'car', owner: famUser() });
    }
    famSheetClose(); famToast('차량 정보를 저장하고 알림을 걸었습니다');
}

// ── 엑셀 내보내기: 내역 · 월별/분류별 요약 · 여행 정산 ──
async function famXlsx() {
    famToast('엑셀 만드는 중…');
    try {
        if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'; s.onload = ok; s.onerror = () => no(new Error('엑셀 도구를 불러오지 못했습니다')); document.head.appendChild(s); });
        const rows = (typeof anaAll === 'function' ? anaAll() : []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (!rows.length) return famToast('가계부 내역이 없습니다');
        const trip = id => { const p = typeof famTripById === 'function' ? famTripById(id) : null; return p ? `${p.loc || '여행'} (${p.start || ''})` : ''; };
        const wb = XLSX.utils.book_new();
        // 1) 내역
        const s1 = XLSX.utils.json_to_sheet(rows.map(e => ({ 날짜: e.date, 구분: e.type, 분류: e.category, 금액: e.type === '지출' ? -e.amt : e.amt, 구성원: e._m, 결제: e.pay || '', 내용: e.memo || '', 여행: e.tripId ? trip(e.tripId) : '' })));
        s1['!cols'] = [{ wch: 11 }, { wch: 5 }, { wch: 8 }, { wch: 12 }, { wch: 7 }, { wch: 5 }, { wch: 28 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, s1, '내역');
        // 2) 월별 · 분류별 지출
        const months = [...new Set(rows.map(e => String(e.date).slice(0, 7)))].sort(), cats = [...new Set(rows.filter(e => e.type === '지출').map(e => e.category))];
        const sum = (m, f) => rows.filter(e => String(e.date).startsWith(m) && f(e)).reduce((s, e) => s + e.amt, 0);
        const s2 = XLSX.utils.json_to_sheet(months.map(m => ({ 월: m, 수입: sum(m, e => e.type === '수입'), 지출: sum(m, e => e.type === '지출'), 손익: sum(m, e => e.type === '수입') - sum(m, e => e.type === '지출'), ...Object.fromEntries(cats.map(c => [c, sum(m, e => e.type === '지출' && e.category === c)])) })));
        XLSX.utils.book_append_sheet(wb, s2, '월별 요약');
        // 3) 여행 정산: 여행별 분류 합계와 사람별 낸 돈
        const trips = [...new Set(rows.filter(e => e.tripId && e.type === '지출').map(e => e.tripId))];
        if (trips.length) {
            const t = [];
            trips.forEach(id => {
                const es = rows.filter(e => e.tripId === id && e.type === '지출'), tot = es.reduce((s, e) => s + e.amt, 0);
                const by = k => Object.entries(es.reduce((o, e) => { o[e[k]] = (o[e[k]] || 0) + e.amt; return o; }, {}));
                t.push({ 여행: trip(id), 항목: '합계', 금액: tot });
                by('category').forEach(([k, v]) => t.push({ 여행: '', 항목: '분류 · ' + k, 금액: v }));
                by('_m').forEach(([k, v]) => t.push({ 여행: '', 항목: '낸 사람 · ' + k, 금액: v }));
                t.push({ 여행: '', 항목: '1인당 (2명)', 금액: Math.round(tot / 2) }, {});
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(t), '여행 정산');
        }
        const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        await famSaveFile(`설연-가계부-${mnYmd(new Date())}.xlsx`, b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e) { famToast('엑셀 실패: ' + e.message); }
}
// 파일 저장: 앱에서는 폰 '다운로드' 폴더에 저장 후 열기, 브라우저에서는 내려받기
async function famSaveFile(name, b64, mime) {
    const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    if (N && N.saveFile) { await N.saveFile({ name, data: b64, mime, open: true }); famToast('다운로드 폴더에 저장했습니다: ' + name); return; }
    const a = document.createElement('a'); a.href = `data:${mime};base64,${b64}`; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    famToast('내려받았습니다: ' + name);
}

(function mnBoot() {
    const wait = () => { if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(carListen, 1500); }); else setTimeout(wait, 1000); };
    window.addEventListener('load', () => setTimeout(wait, 700));
})();
