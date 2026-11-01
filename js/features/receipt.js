    // ═══════════════════════════════════════════════════════════
    // 📷 영수증 → 가계부
    // ═══════════════════════════════════════════════════════════
    function famReceiptOpen() { famFeedAdd('📷 영수증 사진을 선택하거나 촬영하세요.'); document.getElementById('fam-receipt-input').click(); }
    function famImgToB64(file, max) {
        return new Promise((ok, no) => {
            const img = new Image(), url = URL.createObjectURL(file);
            img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]); };
            img.onerror = () => no(new Error('이미지를 읽지 못했습니다')); img.src = url;
        });
    }
    async function famReceiptFile(input) {
        const files = Array.from(input.files || []); input.value = ''; if (!files.length) return;
        for (const f of files) await famReceiptOne(f, files.length > 1 ? `(${files.indexOf(f) + 1}/${files.length}) ` : '');
    }
    async function famReceiptOne(f, tag) {
        const c = famFeedAdd(`<span class="fam-spin"></span>${tag}이미지를 읽는 중… (10~30초)`);
        try {
            const data = await famImgToB64(f, 1800), today = famYmd(new Date());
            const r = await famCallAI('너는 영수증·결제내역 캡처를 읽어 가계부 항목을 만드는 도우미다. 이미지에 보이는 내용만 쓰고 추측하지 않는다.',
                `이미지가 영수증이면 총 결제금액으로 1건, 카드사·은행 앱 화면이나 결제 문자 캡처처럼 거래가 여러 건 보이면 거래마다 1건씩 만든다.
취소된 거래와 그 원거래는 뺀다. 잔액·한도·포인트·할인 전 금액은 쓰지 않는다.
오늘은 ${today}이다. 연도가 안 보이면 오늘 기준 가장 가까운 과거 날짜로 쓴다.
JSON만 출력: {"items":[{"date":"YYYY-MM-DD 또는 빈 문자열","store":"가맹점·상호","amount":숫자(영수증 통화 기준, 소수점 그대로),"currency":"KRW|EUR|USD|JPY 등 ISO 통화코드","type":"지출|수입","category":"지출이면 ${EXP_CATS.join('|')}, 수입이면 ${INC_CATS.join('|')} 중 하나","pay":"카드|현금","items":"영수증 품목 3개 이내 쉼표로, 없으면 빈 문자열"}]}`,
                { image: { mime: 'image/jpeg', data }, maxTokens: 2500 });
            const t = r.text || '', a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0) throw new Error('내용을 읽지 못했습니다');
            const j = JSON.parse(t.slice(a, b + 1));
            const raw = Array.isArray(j.items) ? j.items : [{ date: j.date, store: j.store, amount: j.total, category: j.category, pay: j.pay, items: j.items }];
            const list = raw.map(x => {
                const type = x.type === '수입' ? '수입' : '지출', cats = type === '수입' ? INC_CATS : EXP_CATS;
                const store = famClean(String(x.store || '')), memo = famClean(`${store}${x.items ? ' · ' + x.items : ''}`);
                const cur = /^[A-Za-z]{3}$/.test(String(x.currency || '').trim()) ? String(x.currency).trim().toUpperCase() : 'KRW';
                const fAmt = Math.abs(Number(String(x.amount ?? '').replace(/[^\d.-]/g, '')) || 0);
                const amt = cur === 'KRW' ? Math.round(fAmt) : fAmt;
                const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : today;
                const hist = famHistCat(store || memo, type);
                return { amt, date, type, member: famUser() || '정우설', pay: x.pay === '현금' ? '현금' : '카드', memo, category: hist || (cats.includes(x.category) ? x.category : cats[cats.length - 1]), _hist: !!hist, _dup: cur === 'KRW' && famIsDup(date, amt, type), cur, fAmt: cur === 'KRW' ? 0 : fAmt };
            }).filter(x => x.amt > 0);
            if (!list.length) throw new Error('금액을 찾지 못했습니다');
            if (typeof famFxApply === 'function') await famFxApply(list);
            c.innerHTML = `🧾 ${tag}${list.length}건 인식 — 확인 후 저장하세요.`;
            if (list.length === 1) famAssetCard('', list[0]); else famReceiptList(list);
        } catch (e) { c.innerHTML = '⚠️ ' + famEsc(e.message) + ' — ⚙️ 설정에서 AI 키를 확인하세요.'; }
    }
    const famRcData = {};
    function famReceiptList(list) {
        const id = 'rc' + Date.now(); famRcData[id] = list;
        const catOpts = p => (p.type === '수입' ? INC_CATS : EXP_CATS).map(c => `<option ${c === p.category ? 'selected' : ''}>${c}</option>`).join('');
        famFeedAdd(`<h5>💰 ${list.length}건을 가계부에 기록할까요?</h5>
            <div class="ff-form" style="grid-template-columns:1fr 1fr;margin-bottom:6px"><div><label>구성원</label>${famMemberSel(id + '-mem', list[0].member)}</div><div><label>결제</label><select id="${id}-pay"><option ${list[0].pay === '카드' ? 'selected' : ''}>카드</option><option ${list[0].pay === '현금' ? 'selected' : ''}>현금</option></select></div>${typeof famTripSelHtml === 'function' ? famTripSelHtml(id, list[0].date, famTripFor(list[0].date), true) : ''}</div>
            <div id="${id}">${list.map((p, i) => `<div class="rc-row" data-i="${i}"><input type="checkbox" ${p._dup ? '' : 'checked'} style="width:18px;height:18px;margin-top:20px;accent-color:var(--month-header)">
                <div class="ff-form">
                    <div class="s2"><label>${p.type === '수입' ? '📥 수입' : '내용'}${p._dup ? ' <span class="rc-dup">· 이미 같은 날짜·금액 있음</span>' : ''}</label><input data-k="memo" value="${famEsc(p.memo)}"></div>
                    <div><label>분류${p._hist ? ' <span class="rc-hist">· 기록</span>' : ''}</label><select data-k="cat">${catOpts(p)}</select></div>
                    <div><label>금액 (원)${p.cur && p.cur !== 'KRW' ? ` <span class="rc-hist">· ${famEsc(p.cur)} ${p.fAmt}</span>` : ''}</label><input data-k="amt" type="number" inputmode="numeric" value="${p.amt}"></div>
                    <div class="s2"><label>날짜</label><input data-k="date" type="date" value="${p.date}"></div>
                </div></div>`).join('')}</div>
            <div class="fam-btns"><button class="fam-btn pri" onclick="famRcSave('${id}',this)">선택한 건 저장</button></div>`);
    }
    async function famRcSave(id, btn) {
        if (!famRcData[id]) { famToast('앱을 다시 열어 정보가 사라졌습니다. 사진을 다시 올려주세요.'); return; }
        const list = famRcData[id] || [], mem = document.getElementById(id + '-mem').value, pay = document.getElementById(id + '-pay').value;
        const rows = [...document.querySelectorAll(`#${id} .rc-row`)].filter(r => r.querySelector('input[type=checkbox]').checked);
        if (!rows.length) { famToast('저장할 항목을 선택하세요'); return; }
        btn.disabled = true;
        try {
            const bt = db.batch(); let n = 0, sum = 0; const ids = [];
            rows.forEach((r, k) => {
                const p = list[+r.dataset.i], g = q => r.querySelector(`[data-k="${q}"]`).value.trim(), amt = Number(g('amt')) || 0; if (!amt) return;
                const aid = 'as_' + Date.now() + '_' + k;
                bt.set(db.collection('assets').doc(aid), { id: aid, member: mem, date: g('date'), type: p.type, category: g('cat'), pay: p.type === '지출' ? pay : '', amt, memo: g('memo'), ...(p.cur && p.cur !== 'KRW' ? { cur: p.cur, fAmt: p.fAmt, rate: p.rate || 0 } : {}), ...(typeof famTripVals === 'function' ? famTripVals(id) : {}) }); n++; sum += amt; ids.push(aid);
            });
            await bt.commit(); delete famRcData[id];
            btn.closest('.ff-card').innerHTML = `✅ ${n}건 · 합계 <b>${sum.toLocaleString('ko-KR')}원</b> — 가계부에 기록했습니다. (${famEsc(mem)}) ${famUndoBtn('assets', ids)}`;
        } catch (e) { btn.disabled = false; famToast('저장 실패: ' + e.message); }
    }

    // ═══════════════════════════════════════════════════════════
    // 📲 다른 앱에서 공유 받기 (카드 결제 문자 등 → 가계부)
    //   manifest.json 의 share_target(GET, title/text/url)으로 들어온 글을 처리
    // ═══════════════════════════════════════════════════════════
    function famShareIn() {
        let q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
        const text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').trim();
        if (!text) return;
        try { history.replaceState(history.state, '', location.pathname); } catch (e) {}
        showSection('main-section');
        if (/(승인|결제|일시불|할부|입금|출금|이체|카드)/.test(text) && (famKeys()[famProv()] || '')) famShareTx(text);
        else famRun(text);
    }
    async function famShareTx(text) {
        famMe(text.length > 200 ? text.slice(0, 200) + '…' : text);
        const c = famFeedAdd('<span class="fam-spin"></span>결제 내용을 읽는 중…');
        try {
            const today = famYmd(new Date());
            const r = await famCallAI('너는 카드·은행 결제 알림 문자를 읽어 가계부 항목을 만드는 도우미다. 글에 있는 내용만 쓰고 추측하지 않는다.',
                `아래 글에서 거래를 뽑아라. 승인 취소된 거래와 그 원거래는 뺀다. 누적 금액·잔액·한도는 금액으로 쓰지 않는다.
오늘은 ${today}이다. 연도가 없으면 오늘 기준 가장 가까운 과거 날짜로 쓴다.
JSON만 출력: {"items":[{"date":"YYYY-MM-DD","store":"가맹점","amount":숫자,"type":"지출|수입","category":"지출이면 ${EXP_CATS.join('|')}, 수입이면 ${INC_CATS.join('|')} 중 하나","pay":"카드|현금"}]}

${text}`, { maxTokens: 1200 });
            const t = r.text || '', a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0) throw new Error('내용을 읽지 못했습니다');
            const list = (JSON.parse(t.slice(a, b + 1)).items || []).map(x => {
                const type = x.type === '수입' ? '수입' : '지출', cats = type === '수입' ? INC_CATS : EXP_CATS, store = famClean(String(x.store || ''));
                const amt = Math.round(Math.abs(Number(String(x.amount ?? '').replace(/[^\d.-]/g, '')) || 0));
                const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : today, hist = famHistCat(store, type);
                return { amt, date, type, member: famUser() || '정우설', pay: x.pay === '현금' ? '현금' : '카드', memo: store, category: hist || (cats.includes(x.category) ? x.category : cats[cats.length - 1]), _hist: !!hist, _dup: famIsDup(date, amt, type) };
            }).filter(x => x.amt > 0);
            if (!list.length) throw new Error('금액을 찾지 못했습니다');
            c.remove();
            if (list.length === 1) famAssetCard('', list[0]); else famReceiptList(list);
        } catch (e) { c.remove(); famRun(text); }
    }

    // ═══════════════════════════════════════════════════════════
    // ❔ 도움말 · ＋ 메뉴 (팝업)
    // ═══════════════════════════════════════════════════════════
    function famHelp() {
        famSheet(`<div class="fam-h"><b>❔ 사용법</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-box"><h4>그냥 입력하면</h4><div style="font-size:13px;line-height:1.8;color:#334155">
                금액이 있으면 → 가계부 <span style="color:#94a3b8">예) 점심 12000 · 택시 1만5천원 현금</span><br>
                날짜·시간이 있으면 → 일정 <span style="color:#94a3b8">예) 내일 저녁 7시 치과</span><br>
                질문이면 → AI 웹 검색 <span style="color:#94a3b8">예) 이번 주말 서울 날씨?</span><br>
                그 외 → 앱 안에서 찾기</div></div>
            <div class="fam-box"><h4>/ 명령</h4>${CMDS.map(c => `<button class="ff-res" onclick="famSheetClose();famPickCmd('${c[0]}')"><i style="width:auto;min-width:64px;text-align:left;font-weight:800;color:#1e293b">${c[0]}</i><div>${c[2]}${c[1] ? `<small>예) ${famEsc(c[1])}</small>` : ''}</div></button>`).join('')}</div>
            <div class="fam-box"><h4>＋ 버튼</h4><div style="font-size:13px;line-height:1.8;color:#334155">영수증 촬영·사진 업로드, 사진·PDF 요약과 번역</div></div>
            <div class="fam-note">저장 전에는 항상 확인 카드가 뜹니다.</div>`);
    }
    function famPlusMenu() {
        famSheet(`<div class="fam-h"><b>＋ 추가</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-box">
                <button class="ff-res" onclick="famSheetClose();document.getElementById('fam-cam-input').click()"><i>📷</i><div>영수증 촬영<small>찍으면 바로 읽어서 가계부 카드로</small></div></button>
                <button class="ff-res" onclick="famSheetClose();document.getElementById('fam-receipt-input').click()"><i>🧾</i><div>영수증·결제내역 사진<small>앨범에서 여러 장 · 카드 앱 캡처도 됩니다</small></div></button>
                <button class="ff-res" onclick="famSheetClose();famDocPick()"><i>📄</i><div>사진·파일 요약 / 번역<small>사진, PDF, 텍스트 파일</small></div></button>
            </div>`);
    }
    function famReceiptMenu() {
        famSheet(`<div class="fam-h"><b>📷 영수증</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-box">
                <button class="ff-res" onclick="famSheetClose();document.getElementById('fam-cam-input').click()"><i>📷</i><div>촬영<small>찍으면 바로 읽습니다</small></div></button>
                <button class="ff-res" onclick="famSheetClose();document.getElementById('fam-receipt-input').click()"><i>🖼️</i><div>사진 선택<small>여러 장 · 결제내역 캡처 가능</small></div></button>
            </div>`);
    }

    // ═══════════════════════════════════════════════════════════
    // 📄 사진·파일 요약 / 번역
    // ═══════════════════════════════════════════════════════════
    const famDocs = {};
    function famDocPick() { document.getElementById('fam-doc-input').click(); }
    function famReadB64(file) { return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => no(new Error('파일을 읽지 못했습니다')); r.readAsDataURL(file); }); }
    async function famDocFile(input) {
        const f = input.files && input.files[0]; input.value = ''; if (!f) return;
        const name = f.name || '파일', isImg = /^image\//.test(f.type), isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(name);
        const isTxt = /^text\//.test(f.type) || /\.(txt|md|csv|json|html|xml|log)$/i.test(name);
        if (!isImg && !isPdf && !isTxt) { famFeedAdd('⚠️ 사진, PDF, 텍스트 파일만 됩니다. Word·엑셀은 PDF로 저장해서 올려주세요.'); return; }
        if (f.size > 25 * 1024 * 1024) { famFeedAdd('⚠️ 25MB 이하 파일만 됩니다.'); return; }
        const id = 'doc' + Date.now();
        try {
            if (isImg) famDocs[id] = { name, image: { mime: 'image/jpeg', data: await famImgToB64(f, 2000) } };
            else if (isPdf) famDocs[id] = { name, image: { mime: 'application/pdf', data: await famReadB64(f), name } };
            else { const t = await f.text(); famDocs[id] = { name, text: t.length > 60000 ? t.slice(0, 60000) + '\n…(이후 생략)' : t }; }
        } catch (e) { famFeedAdd('⚠️ ' + famEsc(e.message)); return; }
        const icon = isImg ? '🖼️' : isPdf ? '📕' : '📄', kb = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(f.size / 1024)) + 'KB';
        famFeedAdd(`<h5>${icon} ${famEsc(name)} <small style="color:#94a3b8;font-weight:500">${kb}</small></h5>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
                <button class="fam-btn pri" onclick="famDocRun('${id}','sum',this)">요약</button>
                <select class="fam-btn" style="appearance:none;-webkit-appearance:none;width:auto !important;flex:none;margin:0;padding:8px 14px;font-family:inherit" onchange="if(this.value){famDocRun('${id}',this.value,this);this.value=''}"><option value="">🌐 번역 ▾</option>${FAM_LANGS.map(l => `<option value="${l[0]}">${l[1]}</option>`).join('')}</select>
            </div>
            <div style="display:flex;gap:6px;margin-top:8px"><input id="${id}-q" class="fam-sel" style="flex:1" placeholder="이 파일에 대해 질문하기" onkeydown="if(event.key==='Enter'){event.preventDefault();famDocRun('${id}','q',this)}"><button class="fam-btn" onclick="famDocRun('${id}','q',this)">묻기</button></div>`);
    }
    async function famDocRun(id, mode, btn) {
        const d = famDocs[id]; if (!d) { famToast('파일을 다시 올려주세요'); return; }
        const L = mode === 'sum' || mode === 'q' ? FAM_LANGS[0] : famLangOf(mode);
        let task;
        if (mode === 'sum') task = '이 자료를 한국어로 요약하라. 맨 위에 한 줄 결론, 그다음 핵심 3~6개를 bullet로. 숫자·날짜·고유명사는 원문 그대로 정확히. 표가 있으면 핵심 수치만 정리.';
        else if (mode === 'q') { const q = (document.getElementById(id + '-q').value || '').trim(); if (!q) { famToast('질문을 입력하세요'); return; } document.getElementById(id + '-q').value = ''; task = '이 자료를 근거로 질문에 한국어로 답하라. 자료에 없는 내용은 없다고 말하라.\n질문: ' + q; famMe(q); }
        else task = `이 자료의 글을 ${L[1]}로 번역하라. 원문의 문단·목록 구조를 유지하고, 번역문만 출력하라. 사진이면 보이는 글자를 모두 옮긴다.`;
        const label = mode === 'sum' ? '요약' : mode === 'q' ? '답변' : L[1] + ' 번역';
        const c = famFeedAdd(`<span class="fam-spin"></span>${famEsc(d.name)} ${label} 중…`);
        try {
            const r = await famCallAI('너는 가족이 쓰는 앱의 문서 도우미다. 자료에 있는 내용만 사용하고 추측하지 않는다.',
                d.text != null ? `[파일: ${d.name}]\n${d.text}\n\n${task}` : task, { image: d.image, maxTokens: mode === 'sum' || mode === 'q' ? 2000 : 6000 });
            const out = (r.text || '').trim() || '(응답 없음)', oid = id + '-o' + Date.now();
            c.innerHTML = `<h5>${mode === 'sum' ? '📝' : mode === 'q' ? '💬' : '🌐'} ${famEsc(d.name)} · ${label}</h5><div class="fam-ai" id="${oid}">${famMd(out)}</div>
                <div class="fam-btns" style="justify-content:flex-start">${famSpkBtn(oid, L[2])}<button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="famCopy('${oid}')">복사</button><button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="famDocToChat('${oid}')">채팅으로</button></div>
                <div class="fam-note">${famEsc(FAM_NAMES[famProv()])}</div>`;
            c.dataset.raw = out;
        } catch (e) { c.innerHTML = '⚠️ ' + famEsc(e.message); }
    }
    function famCopy(oid) { const c = document.getElementById(oid).closest('.ff-card'); const t = c.dataset.raw || document.getElementById(oid).innerText; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => famToast('복사했습니다'), () => famToast('복사하지 못했습니다')); }
    function famDocToChat(oid) { const c = document.getElementById(oid).closest('.ff-card'); const t = c.dataset.raw || document.getElementById(oid).innerText; famChatSend(t.length > 3000 ? t.slice(0, 3000) + '…' : t); }

