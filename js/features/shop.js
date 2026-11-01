    // ═══════════════════════════════════════════════════════════
    // 🛒 쇼핑 · 장보기 목록
    // ═══════════════════════════════════════════════════════════
    const SHOPS = [['컬리', 'https://www.kurly.com', '#5f0080'], ['쿠팡', 'https://www.coupang.com', '#e52528'], ['SSG', 'https://www.ssg.com', '#ff5452'],
        ['G마켓', 'https://www.gmarket.co.kr', '#00a650'], ['네이버쇼핑', 'https://shopping.naver.com', '#03c75a'], ['배달의민족', 'https://www.baemin.com', '#2ac1bc']];
    let famShopItems = [], famShopUnsub = null;
    function famShopListen() {
        if (famShopUnsub) return;
        try { famShopUnsub = db.collection('shoppingList').onSnapshot(s => { famShopItems = s.docs.map(d => ({ id: d.id, ...d.data() })); famShopRender(); famHomeBanners(); }, () => {}); } catch (e) {}
    }
    function famShopRender() {
        const el = document.getElementById('shop-list'); if (!el) return;
        const items = [...famShopItems].sort((a, b) => (a.done - b.done) || ((b.createdAt || 0) - (a.createdAt || 0)));
        el.innerHTML = items.length ? items.map(i => `<div class="shop-item ${i.done ? 'done' : ''}"><input type="checkbox" ${i.done ? 'checked' : ''} onchange="famShopToggle('${i.id}',this.checked)"><span style="flex:1;font-size:14px">${famEsc(i.text)}</span><small style="color:#94a3b8;font-size:11px">${famEsc(i.by || '')}</small><button class="fam-x" style="width:26px;height:26px;font-size:11px" onclick="famShopDel('${i.id}')">✕</button></div>`).join('')
            : '<div class="fam-note" style="text-align:center;padding:14px 0">장보기 목록이 비어 있습니다.</div>';
        const cnt = document.getElementById('shop-count'); if (cnt) cnt.textContent = items.filter(i => !i.done).length ? `남은 ${items.filter(i => !i.done).length}개` : '';
    }
    async function famShopAdd(text, fromFeed) {
        const raw = String(text || ''), items = raw.split(/[,，\n]/.test(raw) || !fromFeed ? /[,，\n]/ : /\s+/).map(x => x.trim()).filter(Boolean);
        if (!items.length) return;
        try {
            const b = db.batch(); items.forEach((t, i) => { const id = 'shop_' + Date.now() + '_' + i; b.set(db.collection('shoppingList').doc(id), { id, text: t, done: false, by: famUser(), createdAt: Date.now() + i }); }); await b.commit();
            if (fromFeed) famFeedAdd(`✅ 장보기 목록에 ${items.map(famEsc).join(', ')} 추가했습니다. <button class="fam-btn" style="padding:4px 9px;font-size:12px" onclick="famFeedClose();showSection('shop-section')">목록 보기</button>`);
        } catch (e) { famToast('추가 실패: ' + e.message); }
    }
    function famShopAddInput() { const el = document.getElementById('shop-new'); const v = el.value.trim(); if (!v) return; el.value = ''; famShopAdd(v, false); }
    function famShopToggle(id, on) { db.collection('shoppingList').doc(id).update({ done: on }).catch(e => famToast(e.message)); }
    function famShopDel(id) { db.collection('shoppingList').doc(id).delete().catch(e => famToast(e.message)); }
    // 구매 완료 항목을 묶어 가계부 기록 카드로 (금액만 입력하면 됨)
    function famShopToAsset() {
        const done = famShopItems.filter(i => i.done);
        if (!done.length) { famToast('구매 완료로 체크한 항목이 없습니다'); return; }
        const memo = '장보기: ' + done.map(i => i.text).join(', ');
        const hist = famHistCat('장보기', '지출');
        famAssetCard('', { amt: 0, date: famYmd(new Date()), member: famUser() || '공통', type: '지출', category: hist || '생활비', _hist: !!hist, pay: '카드', memo: memo.length > 80 ? memo.slice(0, 80) + '…' : memo });
        famToast('홈에서 금액을 입력하고 저장하세요');
    }
    function famShopClearDone() { const done = famShopItems.filter(i => i.done); if (!done.length) return; if (!confirm(`구매 완료 ${done.length}개를 지울까요?`)) return; const b = db.batch(); done.forEach(i => b.delete(db.collection('shoppingList').doc(i.id))); b.commit(); }
    function famShopGrid() { const el = document.getElementById('shop-grid'); if (el) el.innerHTML = SHOPS.map(([n, u, c]) => `<a class="shop-btn" href="${u}" target="_blank" rel="noopener"><i style="background:${c}">${famEsc(n.slice(0, 1))}</i>${famEsc(n)}</a>`).join(''); }

