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
// 컬리에서 담기: 남은 장보기 품목 목록 → 품목마다 [컬리 검색]
function kurlyCart() {
    const items = (typeof famShopItems !== 'undefined' ? famShopItems : []).filter(s => !s.done);
    famSheet(`<div class="fam-h"><b>🟣 컬리에서 담기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:0 0 8px">품목을 누르면 컬리 검색이 열립니다. 장바구니에 담고 돌아와서 다음 품목을 누르세요. 결제는 컬리 앱에서 한 번에 하시면 됩니다.</div>
        ${items.length ? items.map(s => `<div class="ag-li" style="cursor:pointer" onclick="kurlySearch('${famEsc(s.id)}',this)"><span>${dlOpened.has(s.id) ? '✓' : '🔍'}</span><b>${famEsc(s.text)}</b><span style="color:#7c3aed;font-weight:700">컬리 ›</span></div>`).join('')
            : '<div class="fam-note">장보기 목록이 비어 있습니다. 위 입력칸에 넣거나 홈에서 "우유, 계란 컬리에서 시켜줘"라고 하세요.</div>'}
        <div class="fam-btns">${items.length ? '<button class="fam-btn" onclick="kurlyDone()">담은 품목 목록에서 지우기</button>' : ''}<button class="fam-btn pri" onclick="dlOpenUrl(\'https://www.kurly.com/cart\',KURLY_PKG)">컬리 장바구니</button></div>`);
}
function kurlySearch(id, row) {
    const s = (typeof famShopItems !== 'undefined' ? famShopItems : []).find(x => x.id === id); if (!s) return;
    dlOpened.add(id); if (row) row.firstElementChild.textContent = '✓';
    dlOpenUrl('https://www.kurly.com/search?sword=' + encodeURIComponent(s.text), KURLY_PKG);
}
// 컬리에서 연(담은) 품목은 장보기 목록에서 완료 처리
async function kurlyDone() {
    if (!dlOpened.size) return famToast('아직 연 품목이 없습니다');
    for (const id of dlOpened) await db.collection('shoppingList').doc(id).update({ done: true }).catch(() => {});
    famToast(`${dlOpened.size}개를 완료로 표시했습니다`); dlOpened = new Set(); famSheetClose();
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
