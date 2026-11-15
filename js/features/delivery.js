// ═══════════════════════════════════════════════════════════
// 🛒 장보기·배달: 컬리(장보기) · 배민(배달 음식·B마트)
//   로그인·결제는 각 앱에서 직접 (자동 주문은 결제 인증·약관·계정 보안 문제로 하지 않음)
//   컬리: 장보기 목록의 품목을 하나씩 컬리 검색으로 열어 담기만 하면 됨 (연 품목은 ✓)
//   배민: 메뉴 이름을 복사해 두고 배민 앱을 엶 → 검색창에 붙여 넣기
//   말로: "우유, 계란 컬리에서 시켜줘" / "배민에서 치킨" / "떡볶이 배달 시켜줘"
// ═══════════════════════════════════════════════════════════
const KURLY_PKG = 'com.dbs.kurly.m2', BAEMIN_PKG = 'com.sampleapp';
const dlN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
let dlOpened = new Set();

function dlOpenUrl(url, pkg) {
    const N = dlN();
    if (N && N.openUrl) N.openUrl({ url, pkg }).catch(() => window.open(url, '_blank'));
    else window.open(url, '_blank');
}
// 컬리에서 담기: 컬리는 외부 앱이 장바구니에 넣는 기능을 열어 두지 않아서, 품목마다 컬리 검색을 열어 주고 담기는 컬리 화면에서
//   [다음 품목 열기] 한 번씩 → 컬리에서 [장바구니 담기] → 돌아오면 다음 품목. 다 끝나면 [다 담았어요]로 목록 체크
//   검색이 브라우저로 열리면(로그인 안 된 화면) [앱] 버튼: 품목 이름을 복사하고 컬리 앱을 엶 → 검색창에 붙여 넣기
function kurlyCart() {
    const items = (typeof famShopItems !== 'undefined' ? famShopItems : []).filter(s => !s.done), next = items.find(s => !dlOpened.has(s.id));
    famSheet(`<div class="fam-h" id="kurly-sheet"><b>🟣 컬리에서 담기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:0 0 8px">컬리는 다른 앱이 장바구니에 직접 넣을 수 없게 막혀 있습니다. 품목마다 컬리 검색을 열어 드리니 컬리 화면에서 <b>장바구니 담기</b>를 누르고 돌아오세요.</div>
        ${next ? `<button class="fam-btn pri" style="width:100%;padding:13px;font-size:15px;background:#5f0080;border-color:#5f0080" onclick="kurlySearch('${famEsc(next.id)}')">다음 품목 열기 › <b>${famEsc(next.text)}</b></button>` : items.length ? '<div class="fam-note" style="color:#047857;font-weight:700">모든 품목을 열었습니다. 컬리 장바구니에서 결제하세요.</div>' : ''}
        ${items.length ? items.map(s => `<div class="ag-li"><span>${dlOpened.has(s.id) ? '✓' : '·'}</span><b style="cursor:pointer" onclick="kurlySearch('${famEsc(s.id)}')">${famEsc(s.text)}</b><button class="fam-btn" style="padding:4px 9px;font-size:11px" onclick="kurlyApp('${famEsc(s.id)}')" title="이름을 복사하고 컬리 앱 열기">앱</button></div>`).join('')
            : '<div class="fam-note">장보기 목록이 비어 있습니다. 위 입력칸에 넣거나 홈에서 "우유, 계란 컬리에서 시켜줘"라고 하세요.</div>'}
        <div class="fam-btns">${dlOpened.size ? '<button class="fam-btn" onclick="kurlyDone()">다 담았어요 (목록 체크)</button>' : ''}<button class="fam-btn" onclick="dlOpenUrl(\'https://www.kurly.com/cart\',KURLY_PKG)">컬리 장바구니</button></div>
        <div class="fam-note">컬리 화면이 로그인 안 된 웹으로 열리면 품목 옆 <b>앱</b>을 누르세요. 이름을 복사하고 컬리 앱을 엽니다.</div>`);
}
function kurlySearch(id) {
    const s = (typeof famShopItems !== 'undefined' ? famShopItems : []).find(x => x.id === id); if (!s) return;
    dlOpened.add(id); dlOpenUrl('https://www.kurly.com/search?sword=' + encodeURIComponent(s.text), KURLY_PKG);
    setTimeout(kurlyCart, 600);   // 돌아오면 다음 품목 버튼이 바로 보이게
}
async function kurlyApp(id) {
    const s = (typeof famShopItems !== 'undefined' ? famShopItems : []).find(x => x.id === id); if (!s) return;
    dlOpened.add(id); try { await navigator.clipboard.writeText(s.text); } catch (e) {}
    const N = dlN(); if (N && N.openApp) N.openApp({ pkg: KURLY_PKG }).catch(() => {}); else dlOpenUrl('https://www.kurly.com', '');
    famToast(`'${s.text}' 복사함 · 컬리 검색창에 붙여 넣으세요`); setTimeout(kurlyCart, 600);
}
// 다 담은 뒤 장보기 목록에서 체크
async function kurlyDone() {
    if (!dlOpened.size) return famToast('아직 연 품목이 없습니다');
    if (!confirm('컬리 장바구니에 다 담으셨나요? 연 품목을 장보기 목록에서 체크합니다.')) return;
    for (const id of dlOpened) await db.collection('shoppingList').doc(id).update({ done: true }).catch(() => {});
    famToast(`${dlOpened.size}개를 체크했습니다`); dlOpened = new Set(); famSheetClose();
}
// 배민: 메뉴 이름 복사 → 앱 열기
async function baeminOpen(q) {
    q = String(q || '').trim();
    if (q) { try { await navigator.clipboard.writeText(q); } catch (e) {} }
    const N = dlN();
    if (!N || !N.openApp) { dlOpenUrl('https://www.baemin.com', ''); return; }
    const r = await N.openApp({ pkg: BAEMIN_PKG }).catch(() => ({}));
    if (typeof famFeedAdd === 'function') famFeedAdd(r.opened === false ? '배민 앱이 없어 설치 화면을 열었습니다.' : `🛵 배민을 열었습니다.${q ? ` 검색창에 <b>${famEsc(q)}</b>를 붙여 넣으세요 (복사해 두었습니다).` : ''}`);
}
function baeminForm() {
    famSheet(`<div class="fam-h"><b>🛵 배민</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="ff-form"><div class="full"><label>무엇을 시킬까요? (선택)</label><input id="bm-q" placeholder="예: 치킨, 떡볶이, B마트 생수"></div></div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="const v=document.getElementById('bm-q').value;famSheetClose();baeminOpen(v)">배민 열기</button></div>`);
}

// 말로 하는 요청 (life.js lifeRoute 끝에서 호출)
function dlRoute(t) {
    const clean = s => s.replace(/(컬리|마켓\s*컬리|배민|배달의\s*민족|b\s*마트|비\s*마트)\s*(에서|로|으로)?/gi, ' ').replace(/(좀|주문|시켜|담아|사)\s*(해)?\s*(줘|주세요|줄래|라)?|배달|장보기|장\s*봐|목록|열어|보여/g, ' ').replace(/\s+/g, ' ').trim();
    if (/컬리/.test(t) && /(시켜|주문|담아|사\s*줘|장보기|살게)/.test(t)) {
        const items = clean(t).split(/\s*(?:,|，|그리고|하고|랑|이랑|와|과)\s*/).map(x => x.trim()).filter(x => x.length >= 1 && x.length <= 30);
        (async () => {
            if (items.length && typeof famShopAdd === 'function') await famShopAdd(items.join(','), true);
            setTimeout(kurlyCart, 900);
        })();
        if (typeof famFeedAdd === 'function') famFeedAdd(`🟣 ${items.length ? `<b>${famEsc(items.join(', '))}</b>을(를) 장보기에 넣고 ` : ''}컬리 담기 목록을 엽니다.`);
        return true;
    }
    if (/(배민|배달의\s*민족|b\s*마트|비\s*마트)/i.test(t) || /(배달\s*시켜|시켜\s*먹|배달\s*주문)/.test(t)) { baeminOpen(clean(t)); return true; }
    return false;
}
