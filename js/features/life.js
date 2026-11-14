// ═══════════════════════════════════════════════════════════
// 🧭 생활 연동: 네이버 지도 길찾기 · My BMW · 택배 추적
//   길찾기: "○○까지 길 안내" → 네이버 지도 앱 (좌표를 알면 바로 경로, 모르면 장소 검색)
//   My BMW: 문 열기·잠금은 BMW가 외부 앱에 열지 않아 앱만 바로 열어 줌
//   택배:   parcels/{운송장} {company, invoice, item, status, eta, done, by}
//           문자·카톡에서 운송장을 뽑아 등록 → 서버가 1시간마다 조회, 출발·도착 때 알림
// ═══════════════════════════════════════════════════════════
const NMAP_PKG = 'com.nhn.android.nmap', BMW_PKG = 'de.bmw.connected.mobile20.row';
let parcels = [];
const lfN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;

// ── 네이버 지도 ──
function naverRoute(dest, geo) {
    dest = String(dest || '').trim(); if (!dest) return famToast('목적지를 말씀해 주세요');
    const app = 'com.seolyeon.family';
    const url = geo && geo.lat ? `nmap://route/car?dlat=${geo.lat}&dlng=${geo.lng}&dname=${encodeURIComponent(dest)}&appname=${app}` : `nmap://search?query=${encodeURIComponent(dest)}&appname=${app}`;
    const N = lfN();
    if (N && N.openUrl) N.openUrl({ url, pkg: NMAP_PKG }).catch(() => window.open('https://map.naver.com/p/search/' + encodeURIComponent(dest), '_blank'));
    else window.open('https://map.naver.com/p/search/' + encodeURIComponent(dest), '_blank');
}
// 일정·여행 이름으로 좌표 찾기 (여행 계획에 지도 위치가 있으면 사용)
function lfGeoFor(name) {
    const p = (typeof planData !== 'undefined' ? planData : []).find(x => x.geo && x.loc && (name.includes(x.loc) || x.loc.includes(name)));
    return p ? p.geo : null;
}

// ── My BMW ──
async function bmwOpen(what) {
    const N = lfN();
    if (!N || !N.openApp) return famFeedAdd('My BMW 앱 열기는 설연 앱(APK)에서 됩니다.');
    const r = await N.openApp({ pkg: BMW_PKG }).catch(() => ({}));
    famFeedAdd(r.opened === false ? 'My BMW 앱이 없어 설치 화면을 열었습니다.' : `🚗 My BMW를 열었습니다.${what ? ` <b>${famEsc(what)}</b> 버튼을 눌러 주세요.` : ''} <span style="color:#94a3b8">(문 열기·잠금은 BMW 정책상 앱에서 직접 누르셔야 합니다)</span>`);
}

// ── 택배 ──
function parcelListen() { try { db.collection('parcels').onSnapshot(s => { parcels = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0)); parcelBar(); }, () => {}); } catch (e) {} }
function parcelBar() {
    const el = document.getElementById('pc-bar'); if (!el) return;
    const on = parcels.filter(p => !p.done);
    if (!on.length) { el.innerHTML = ''; return; }
    const today = on.filter(p => /출발|배송중|배달\s*중|도착\s*예정/.test(p.status || '')).length;
    el.innerHTML = `<button class="ib-bar" onclick="parcelOpen()">${fi('cart')}<span>택배 <b>${on.length}</b>건${today ? ` · 오늘 도착 예정 ${today}` : ''}</span>${fi('expand')}</button>`;
}
function parcelOpen() {
    const on = parcels.filter(p => !p.done), off = parcels.filter(p => p.done).slice(0, 5);
    const row = p => `<div class="ag-li"><span>${famEsc(p.company || '')}</span><b>${famEsc(p.item || p.invoice)}<br><small style="color:#64748b;font-weight:500">${famEsc(p.status || '조회 대기')}${p.where ? ' · ' + famEsc(p.where) : ''}${p.checkedAt ? ' · ' + new Date(p.checkedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</small></b>${p.done ? '' : `<button class="fam-btn" style="padding:4px 8px;font-size:11px" onclick="parcelDone('${p.id}')">받음</button>`}</div>`;
    famSheet(`<div class="fam-h"><b>택배</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        ${on.length ? on.map(row).join('') : '<div class="fam-note">배송 중인 택배가 없습니다.</div>'}
        ${off.length ? '<span class="fam-lbl">최근 받은 택배</span>' + off.map(row).join('') : ''}
        <div class="fam-note">택배 문자·알림톡이 오면 운송장을 찾아 자동으로 추가하고, 1시간마다 조회해 출발·도착 때 알려 드립니다.</div>
        <div class="fam-btns"><button class="fam-btn" onclick="parcelAddForm()">＋ 운송장 직접 추가</button><button class="fam-btn" onclick="naverOrders()">네이버 주문내역</button></div>`);
}
function parcelAddForm() {
    famSheet(`<div class="fam-h"><b>운송장 추가</b><button class="fam-x" onclick="parcelOpen()">✕</button></div>
        <div class="ff-form"><div><label>택배사</label><input id="pc-co" placeholder="예: CJ대한통운"></div><div><label>운송장 번호</label><input id="pc-no" inputmode="numeric"></div>
        <div class="full"><label>물건 (선택)</label><input id="pc-item" placeholder="예: 운동화"></div></div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="parcelAdd({company:document.getElementById('pc-co').value,invoice:document.getElementById('pc-no').value,item:document.getElementById('pc-item').value}).then(parcelOpen)">추가</button></div>`);
}
async function parcelAdd(p) {
    const inv = String(p.invoice || '').replace(/[^\d]/g, ''); if (inv.length < 8) { famToast('운송장 번호를 확인해 주세요'); return; }
    const ref = db.collection('parcels').doc(inv), old = await ref.get().catch(() => null);
    if (old && old.exists) return;   // 이미 등록됨
    await ref.set({ id: inv, invoice: inv, company: String(p.company || '').trim(), item: String(p.item || '').trim(), status: '', done: false, at: Date.now(), by: famUser() });
}
async function parcelDone(id) { await db.collection('parcels').doc(id).update({ done: true, doneAt: Date.now() }); famToast('받음으로 표시했습니다'); parcelOpen(); }
function naverOrders() { const N = lfN(), url = 'https://m.pay.naver.com/o/home'; if (N && N.openUrl) N.openUrl({ url, pkg: '' }); else window.open(url, '_blank'); }

// ── 말로 하는 요청 (agent.js agRoute에서 호출) ──
function lifeRoute(t) {
    let m;
    if ((m = t.match(/^(.+?)\s*(까지|으로|로)?\s*(길\s*(안내|찾기|찾아\s*줘?)|가는\s*길|네비|내비|경로)/))) { const d = m[1].replace(/(지금|여기서|집에서|에서)\s*/g, '').trim(); if (d) { naverRoute(d, lfGeoFor(d)); famFeedAdd(`🧭 네이버 지도에서 <b>${famEsc(d)}</b> 길찾기를 엽니다.`); return true; } }
    if (/네이버\s*지도\s*(열어|켜)/.test(t)) { naverRoute('내 위치'); return true; }
    if (/(차|bmw|비엠|BMW)\s*(문)?\s*(열어|닫아|잠가|잠궈|잠금|시동|에어컨|히터|위치|어디)/i.test(t) || /my\s*bmw|마이\s*비엠/i.test(t)) {
        const w = /열어/.test(t) ? '문 열기' : /닫아|잠가|잠궈|잠금/.test(t) ? '문 잠금' : /시동|에어컨|히터/.test(t) ? '공조 시작' : /위치|어디/.test(t) ? '차량 위치' : '';
        bmwOpen(w); return true;
    }
    if (/택배|배송/.test(t) && /(어디|언제|조회|현황|목록|왔|와|보여)/.test(t)) { parcelOpen(); return true; }
    if (/네이버\s*(주문|구매|쇼핑)\s*(내역|목록)?/.test(t)) { naverOrders(); return true; }
    return false;
}

(function lfBoot() {
    const wait = () => { if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(parcelListen, 1700); }); else setTimeout(wait, 1000); };
    window.addEventListener('load', () => setTimeout(wait, 900));
})();
