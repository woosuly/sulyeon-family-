// ═══════════════════════════════════════════════════════════
// 🧾 관리비 · 공과금 추이
//   bills/{종류_YYYY-MM} {kind, ym, amount, by, src(문자|직접), at}
//   고지 문자·알림톡(관리비·전기·가스·수도·통신)은 inbox.js AI가 금액을 뽑아 자동 기록
//   지난달·지난해 같은 달과 비교해 보여 줌
// ═══════════════════════════════════════════════════════════
let bills = [];
const BILL_KINDS = ['관리비', '전기', '가스', '수도', '통신', '기타'];
const blW = n => Math.round(Number(n) || 0).toLocaleString('ko-KR') + '원';
const blYm = (ym, add) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + add, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

function billListen() { try { db.collection('bills').onSnapshot(s => { bills = s.docs.map(d => ({ id: d.id, ...d.data() })); billRender(); }, () => {}); } catch (e) {} }
async function billSave(b, src) {
    const kind = BILL_KINDS.includes(b.kind) ? b.kind : '기타', ym = /^\d{4}-\d{2}$/.test(b.ym || '') ? b.ym : famYmd(new Date()).slice(0, 7), amount = Math.round(+String(b.amount).replace(/[^\d.]/g, '') || 0);
    if (!amount) return;
    await db.collection('bills').doc(`${kind}_${ym}`).set({ kind, ym, amount, by: famUser(), src: src || '직접', at: Date.now() });
}
const billGet = (kind, ym) => (bills.find(b => b.kind === kind && b.ym === ym) || {}).amount;
function billDiff(now, before) {
    if (!now || !before) return '';
    const p = Math.round((now / before - 1) * 100);
    return p === 0 ? '<small style="color:#64748b">같음</small>' : `<small style="color:${p > 0 ? '#b91c1c' : '#047857'}">${p > 0 ? '▲' : '▼'}${Math.abs(p)}%</small>`;
}
function billRender() {
    const el = document.getElementById('bill-box'); if (!el) return;
    if (!bills.length) { el.innerHTML = '<div class="fam-note" style="margin:0">관리비·전기·가스 고지 문자가 오면 금액을 자동으로 적어 둡니다. 직접 넣어도 됩니다.</div>'; return; }
    const kinds = BILL_KINDS.filter(k => bills.some(b => b.kind === k));
    const last = [...new Set(bills.map(b => b.ym))].sort().pop();
    const total = ym => kinds.reduce((s, k) => s + (billGet(k, ym) || 0), 0);
    // 최근 달 종류별: 금액 · 지난달 대비 · 지난해 같은 달 대비
    const rows = kinds.map(k => {
        const ym = bills.filter(b => b.kind === k).map(b => b.ym).sort().pop(), v = billGet(k, ym), pm = billGet(k, blYm(ym, -1)), py = billGet(k, blYm(ym, -12));
        return `<div class="ag-li" onclick="billForm('${k}','${ym}')" style="cursor:pointer"><span>${ym.slice(2).replace('-', '.')}</span><b>${k}</b><span style="text-align:right">${blW(v)}<br>${pm ? '전월 ' + billDiff(v, pm) : ''}${py ? ' 전년 ' + billDiff(v, py) : ''}</span></div>`;
    }).join('');
    // 최근 6개월 합계 막대
    const months = [...Array(6)].map((_, i) => blYm(last, i - 5)), mx = Math.max(1, ...months.map(total));
    const bars = `<div style="display:flex;gap:4px;align-items:flex-end;height:64px;margin:4px 0 2px">${months.map(m => { const t = total(m); return `<div style="flex:1;text-align:center"><div style="height:${Math.round(t / mx * 48)}px;background:${typeof famChartColor === 'function' ? famChartColor('exp', .75) : '#94a3b8'};border-radius:4px 4px 0 0"></div><small style="font-size:10px;color:#64748b">${+m.slice(5)}월</small></div>`; }).join('')}</div>
        <div class="fam-note" style="margin:0 0 6px">${+last.slice(5)}월 합계 <b>${blW(total(last))}</b>${total(blYm(last, -12)) ? ` · 지난해 ${+last.slice(5)}월 ${blW(total(blYm(last, -12)))} ${billDiff(total(last), total(blYm(last, -12)))}` : ''}</div>`;
    el.innerHTML = bars + rows;
}
function billForm(kind, ym) {
    const v = kind && ym ? billGet(kind, ym) : '';
    famSheet(`<div class="fam-h"><b>관리비·공과금 ${v ? '수정' : '추가'}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="ff-form">
            <div><label>종류</label><select id="bl-kind">${BILL_KINDS.map(k => `<option${k === (kind || '관리비') ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
            <div><label>청구 월</label><input type="month" id="bl-ym" value="${ym || famYmd(new Date()).slice(0, 7)}"></div>
            <div class="full"><label>금액</label><input id="bl-amt" inputmode="numeric" value="${v || ''}" placeholder="예: 235000"></div>
        </div>
        <div class="fam-btns">${v ? `<button class="fam-btn" onclick="billDel('${kind}_${ym}')">삭제</button>` : ''}<button class="fam-btn pri" onclick="billSave({kind:document.getElementById('bl-kind').value,ym:document.getElementById('bl-ym').value,amount:document.getElementById('bl-amt').value}).then(()=>{famSheetClose();famToast('저장했습니다')})">저장</button></div>`);
}
async function billDel(id) { if (!confirm('지울까요?')) return; await db.collection('bills').doc(id).delete().catch(() => {}); famSheetClose(); }

(function () { famAuthGate(() => setTimeout(billListen, 1600)); })();
