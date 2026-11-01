    // ═══════════════════════════════════════════════════════════
    // 한국어 해석기 (날짜·시간·구성원·금액·분류)
    // ═══════════════════════════════════════════════════════════
    function famParseDate(t, base) {
        base = base ? new Date(base) : new Date(); base.setHours(0, 0, 0, 0);
        let m, d = null;
        const cut = re => { t = t.replace(re, ' '); };
        if ((m = t.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/))) { d = new Date(+m[1], +m[2] - 1, +m[3]); cut(m[0]); }
        else if ((m = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) { d = new Date(base.getFullYear(), +m[1] - 1, +m[2]); cut(m[0]); }
        else if ((m = t.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/))) { d = new Date(base.getFullYear(), +m[1] - 1, +m[2]); cut(m[0]); }
        else if ((m = t.match(/(오늘|내일|모레|글피)/))) { d = new Date(base); d.setDate(d.getDate() + { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 }[m[1]]); cut(m[0]); }
        else if ((m = t.match(/(이번\s*주|다음\s*주|담주)?\s*([월화수목금토일])요일/))) {
            const dow = '일월화수목금토'.indexOf(m[2]); d = new Date(base);
            if (m[1] && /다음|담주/.test(m[1])) { const mon = new Date(base); mon.setDate(base.getDate() + ((8 - base.getDay()) % 7 || 7)); d = new Date(mon); d.setDate(mon.getDate() + ((dow + 6) % 7)); }
            else if (m[1]) { const mon = new Date(base); mon.setDate(base.getDate() - ((base.getDay() + 6) % 7)); d = new Date(mon); d.setDate(mon.getDate() + ((dow + 6) % 7)); }
            else { d.setDate(base.getDate() + ((dow - base.getDay() + 7) % 7)); }
            cut(m[0]);
        }
        else if ((m = t.match(/(?:^|\s)(\d{1,2})\s*일(?![가-힣])/))) { d = new Date(base.getFullYear(), base.getMonth(), +m[1]); if (d < base) d.setMonth(d.getMonth() + 1); cut(m[0]); }
        return { date: d ? famYmd(d) : '', rest: t };
    }
    function famParseTime(t) {
        let m;
        if ((m = t.match(/(\d{1,2}):(\d{2})/))) { t = t.replace(m[0], ' '); return { time: `${String(+m[1]).padStart(2, '0')}:${m[2]}`, rest: t }; }
        if ((m = t.match(/(오전|오후|아침|저녁|밤|새벽)?\s*(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분|(반))?/))) {
            let h = +m[2], mi = m[3] ? +m[3] : m[4] ? 30 : 0;
            if (/오후|저녁|밤/.test(m[1] || '') && h < 12) h += 12;
            else if (/오전|아침|새벽/.test(m[1] || '') && h === 12) h = 0;
            else if (!m[1] && h >= 1 && h <= 6) h += 12;
            t = t.replace(m[0], ' ');
            return { time: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`, rest: t };
        }
        return { time: '', rest: t };
    }
    function famParseMember(t, def) {
        const rules = [[/정우설|우설|남편|아빠/, '정우설'], [/한미연|미연|아내|엄마/, '한미연'], [/공통|같이|우리|가족(?!\s*모임)/, '공통']];
        for (const [re, v] of rules) { const m = t.match(re); if (m) return { member: v, rest: t.replace(m[0], ' ') }; }
        return { member: def, rest: t };
    }
    function famParseAmount(t) {
        let m, amt = 0;
        if ((m = t.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천)?\s*원?/))) amt = Math.round(parseFloat(m[1]) * 10000 + (m[2] ? +m[2] * 1000 : 0));
        else if ((m = t.match(/(\d+)\s*천\s*원?/))) amt = +m[1] * 1000;
        else if ((m = t.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/))) amt = +m[1].replace(/,/g, '');
        else if ((m = t.match(/(?:^|\s)(\d{1,3}(?:,\d{3})+|\d{3,})(?=\s|$)/))) amt = +m[1].replace(/,/g, '');
        return { amt, rest: m ? t.replace(m[0], ' ') : t };
    }
    function famGuessCat(t, type) {
        if (type === '수입') return /급여|월급/.test(t) ? '급여' : /상여|보너스|성과급/.test(t) ? '상여' : /주식|배당/.test(t) ? '주식' : '기타수입';
        const R = [['식사', /점심|저녁|아침|식사|밥|카페|커피|배달|외식|치킨|피자|간식|술|회식/], ['교통비', /택시|버스|지하철|주유|기름|톨비|하이패스|주차|KTX|기차|교통/], ['의료비', /병원|약국|약값|치과|한의원|검진|의원/], ['여행비', /여행|호텔|숙소|항공|비행기|펜션|리조트/], ['여가', /영화|공연|골프|캠핑|헬스|운동|넷플릭스|구독|취미/], ['가족', /용돈|선물|부모님|경조사|축의금|조의금|생일/], ['생활비', /관리비|전기|가스|수도|통신|인터넷|마트|장보기|생필품|세탁/], ['쇼핑', /쇼핑|옷|신발|가방|쿠팡|컬리|구매|주문/]];
        for (const [c, re] of R) if (re.test(t)) return c;
        return '기타지출';
    }
    const famClean = t => t.replace(/\s+/g, ' ').replace(/^[\s,·]+|[\s,·]+$/g, '').trim();
    const famNormMemo = s => String(s || '').replace(/\[고정\]/g, '').split(' · ')[0].replace(/\s+/g, '').toLowerCase();
    const famFirstWord = s => (String(s || '').replace(/\[고정\]/g, '').trim().split(/[\s·,]+/)[0] || '').toLowerCase();
    // 같은 가게·내용을 예전에 어느 분류로 저장했는지 (많이 쓴 순)
    function famHistCat(memo, type) {
        if (typeof anaAll !== 'function') return '';
        const k = famNormMemo(memo), f = famFirstWord(memo); if (!k) return '';
        const c1 = {}, c2 = {};
        anaAll().forEach(e => {
            if (e.type !== type || !e.memo) return;
            if (famNormMemo(e.memo) === k) c1[e.category] = (c1[e.category] || 0) + 1;
            else if (f.length >= 2 && famFirstWord(e.memo) === f) c2[e.category] = (c2[e.category] || 0) + 1;
        });
        const pick = o => (Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [''])[0];
        const c = pick(c1) || pick(c2);
        return (type === '수입' ? INC_CATS : EXP_CATS).includes(c) ? c : '';
    }
    function famIsDup(date, amt, type) { return typeof anaAll === 'function' && anaAll().some(e => e.date === date && e.amt === amt && e.type === type); }
    function famParseAsset(text) {
        const a = famParseAmount(text), d = famParseDate(a.rest), mb = famParseMember(d.rest, famUser() || '정우설');
        const type = /급여|월급|상여|보너스|배당|입금|수입|환급|받음|받았/.test(text) ? '수입' : '지출';
        const pay = /현금/.test(text) ? '현금' : '카드';
        const memo = famClean(mb.rest.replace(/현금|카드|원$/g, ' '));
        const hist = famHistCat(memo, type);
        return { amt: a.amt, date: d.date || famYmd(new Date()), member: mb.member, type, category: hist || famGuessCat(text, type), _hist: !!hist, pay, memo };
    }
    function famParseSch(text) {
        const d = famParseDate(text), tm = famParseTime(d.rest), mb = famParseMember(tm.rest, famUser() || '정우설');
        return { date: d.date || famYmd(new Date()), time: tm.time, member: mb.member, memo: famClean(mb.rest), _found: !!(d.date || tm.time) };
    }

    // ═══════════════════════════════════════════════════════════
    // 🤖 홈 어시스턴트 (입력창 · 명령 · 피드)
    // ═══════════════════════════════════════════════════════════
    const CMDS = [
        ['/일정', '내일 7시 치과', '일정 추가'], ['/가계부', '점심 12000', '가계부 기록'], ['/영수증', '', '사진으로 가계부 기록'],
        ['/채팅', '저녁 뭐 먹어?', '가족 채팅 보내기'], ['/쇼핑', '우유 계란', '장보기 목록 추가'], ['/검색', '캠핑', '앱 안에서 찾기'],
        ['/ai', '이번 주말 서울 날씨', 'AI 웹 검색'], ['/뉴스', '', '오늘 NEWS'], ['/리포트', '', '지난달 가계부 리포트'], ['/저축', '', '저축 목표·정기이체'], ['/예산', '', '항목별 월 예산'], ['/번역', '영어 내일 회의는 3시', '글 번역 (언어 생략 시 한↔영)'], ['/통역', '', '마주보기 통역 (음성)'], ['/여행', '', '여행·여가 기록과 경비'], ['/산행', '', '하산 체크인 등록'], ['/파일', '', '사진·PDF 요약·번역'], ['/새대화', '', '대화 초기화 (기록은 지난 대화에 보관)'], ['/지난대화', '', '지난 대화 보기']
    ];
    let famSuggIdx = 0;
    function famCmdInput(el) {
        const v = el.value, box = document.getElementById('home-sugg');
        if (!v.startsWith('/') || v.includes(' ')) { box.style.display = 'none'; return; }
        const list = CMDS.filter(c => c[0].startsWith(v.toLowerCase()) || c[0].startsWith(v));
        if (!list.length) { box.style.display = 'none'; return; }
        famSuggIdx = 0;
        box.innerHTML = list.map((c, i) => `<button class="${i === 0 ? 'on' : ''}" onclick="famPickCmd('${c[0]}')"><b>${c[0]}</b><span>${c[2]}${c[1] ? ' · 예) ' + famEsc(c[1]) : ''}</span></button>`).join('');
        box.style.display = 'block';
    }
    function famPickCmd(c) {
        const el = document.getElementById('home-cmd-input'); document.getElementById('home-sugg').style.display = 'none';
        if (['/통역', '/여행', '/산행', '/영수증', '/뉴스', '/리포트', '/저축', '/예산', '/지우기', '/새대화', '/지난대화', '/파일', '/도움말'].includes(c)) { el.value = ''; famRun(c); return; }
        el.value = c + ' '; el.focus();
    }
    function famCmdKey(e) {
        const box = document.getElementById('home-sugg');
        if (e.key === 'Enter') { e.preventDefault(); if (box.style.display === 'block') { const b = box.querySelectorAll('button')[famSuggIdx]; if (b) { b.click(); return; } } famSubmit(); }
        else if (box.style.display === 'block' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault(); const bs = box.querySelectorAll('button'); famSuggIdx = (famSuggIdx + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length; bs.forEach((b, i) => b.classList.toggle('on', i === famSuggIdx));
        }
    }
    function famCmdFocus() { setTimeout(() => { const sc = document.getElementById('home-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 350); }
    // 키보드가 올라와 화면이 줄어들면 최근 대화가 보이게
    window.addEventListener('resize', () => { if (document.activeElement && document.activeElement.id === 'home-cmd-input') famCmdFocus(); });
    function famSubmit() { const el = document.getElementById('home-cmd-input'); const v = el.value.trim(); if (!v) return; el.value = ''; document.getElementById('home-sugg').style.display = 'none'; famMicSwap(); famRun(v); }
    // ── 🎤 음성 입력 (크롬 내장) : 입력창이 비면 ➤ 자리에 🎤 ──
    const FamSR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let famRec = null;
    function famMicSwap() {
        const b = document.getElementById('home-cmd-go'), v = (document.getElementById('home-cmd-input') || {}).value || ''; if (!b) return;
        b.textContent = famRec ? '■' : (!v.trim() && FamSR) ? '🎤' : '➤'; b.classList.toggle('rec', !!famRec);
    }
    function famGoBtn() {
        const el = document.getElementById('home-cmd-input');
        if (famRec) { try { famRec.stop(); } catch (e) {} return; }
        if (el.value.trim() || !FamSR) return famSubmit();
        const r = new FamSR(); famRec = r; r.lang = 'ko-KR'; r.interimResults = true; r.continuous = false;
        r.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; el.value = t; };
        r.onerror = e => { if (e.error === 'not-allowed') famToast('마이크 권한을 허용해 주세요'); else if (e.error !== 'no-speech' && e.error !== 'aborted') famToast('음성 인식 오류: ' + e.error); };
        r.onend = () => { famRec = null; el.placeholder = '무엇이든 입력하세요'; famMicSwap(); if (el.value.trim()) el.focus(); };
        el.placeholder = '듣고 있어요…'; famMicSwap();
        try { r.start(); } catch (e) { famRec = null; famMicSwap(); famToast('음성 입력을 시작하지 못했습니다'); }
    }
    // ── 🔊 읽어주기 (크롬 내장) ──
    let famSpeakBtn = null;
    function famSpeak(btn, oid, lang) {
        const ss = window.speechSynthesis; if (!ss) { famToast('이 브라우저는 읽어주기를 지원하지 않습니다'); return; }
        const was = famSpeakBtn === btn; ss.cancel(); if (famSpeakBtn) famSpeakBtn.textContent = '🔊'; famSpeakBtn = null;
        if (was) return;
        const el = document.getElementById(oid), card = el.closest('.ff-card'), raw = (card && card.dataset.raw) || el.innerText;
        const text = raw.replace(/\*\*|__|#+\s|`/g, '').replace(/^[-*•]\s*/gm, '').replace(/https?:\/\/\S+/g, '');
        const u = new SpeechSynthesisUtterance(text.slice(0, 4000)); u.lang = lang || 'ko-KR';
        const v = ss.getVoices().find(x => (x.lang || '').replace('_', '-').toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase())); if (v) u.voice = v;
        u.onend = u.onerror = () => { if (famSpeakBtn === btn) { btn.textContent = '🔊'; famSpeakBtn = null; } };
        famSpeakBtn = btn; btn.textContent = '⏹'; ss.speak(u);
    }
    const famSpkBtn = (oid, lang) => `<button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="famSpeak(this,'${oid}','${lang || 'ko-KR'}')">🔊</button>`;
    // ── 번역 언어 ──
    const FAM_LANGS = [['ko', '한국어', 'ko-KR'], ['en', '영어', 'en-US'], ['zh', '중국어(간체)', 'zh-CN'], ['zh-TW', '중국어(번체)', 'zh-TW'], ['ja', '일본어', 'ja-JP'], ['vi', '베트남어', 'vi-VN'], ['th', '태국어', 'th-TH'],
        ['es', '스페인어', 'es-ES'], ['fr', '프랑스어', 'fr-FR'], ['de', '독일어', 'de-DE'], ['it', '이탈리아어', 'it-IT'], ['ru', '러시아어', 'ru-RU'], ['id', '인도네시아어', 'id-ID']];
    const famLangOf = k => FAM_LANGS.find(l => l[0] === k) || FAM_LANGS[1];
    function famLangFromText(t) { const n = { 한국어: 'ko', 한글: 'ko', 영어: 'en', 영문: 'en', 번체: 'zh-TW', 중국어: 'zh', 중문: 'zh', 일본어: 'ja', 일어: 'ja', 베트남어: 'vi', 태국어: 'th', 스페인어: 'es', 프랑스어: 'fr', 불어: 'fr', 독일어: 'de', 이탈리아어: 'it', 러시아어: 'ru', 인도네시아어: 'id' }; for (const k in n) if (t.includes(k)) return n[k]; return ''; }
    async function famTranslateText(text, lang) {
        if (!text) return famFeedAdd('예) <b>/번역 영어 내일 회의는 3시입니다</b> · 언어를 빼면 한국어↔영어');
        if (!lang) lang = /[가-힣]/.test(text) ? 'en' : 'ko';
        const L = famLangOf(lang), c = famFeedAdd(`<span class="fam-spin"></span>${L[1]}로 번역 중…`);
        try {
            const r = await famCallAI('너는 번역가다. 자연스럽고 정확하게 번역하고 번역문만 출력한다.', `다음 글을 ${L[1]}로 번역하라. 문단 구조를 유지하라.\n\n${text}`, { maxTokens: 3000 });
            const out = (r.text || '').trim(), oid = 'tr' + Date.now();
            c.innerHTML = `<h5>🌐 ${L[1]}</h5><div class="fam-ai" id="${oid}">${famMd(out)}</div><div class="fam-btns" style="justify-content:flex-start">${famSpkBtn(oid, L[2])}<button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="famCopy('${oid}')">복사</button><button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="famDocToChat('${oid}')">채팅으로</button></div>`;
            c.dataset.raw = out;
        } catch (e) { c.innerHTML = '⚠️ ' + famEsc(e.message); }
    }
    function famFeedSave() {
        const b = document.getElementById('fam-feed-body'); if (!b) return;
        const c = b.cloneNode(true); c.querySelectorAll('.ff-hello').forEach(x => x.remove());
        c.querySelectorAll('.fam-spin').forEach(x => { const card = x.closest('.ff-card'); if (card) card.innerHTML = '⚠️ 처리 중에 앱이 닫혔습니다. 다시 시도해 주세요.'; });
        let h = c.innerHTML;
        while (h.length > 1500000 && c.firstElementChild) { c.firstElementChild.remove(); h = c.innerHTML; }
        try { localStorage.setItem('famFeed', h); } catch (e) {}
    }
    let famFeedSaveT = null;
    function famFeedWatch() {
        const b = document.getElementById('fam-feed-body'); if (!b || b._watch) return; b._watch = 1;
        try { const h = localStorage.getItem('famFeed'); if (h && !b.querySelector('.ff-card,.ff-me')) b.innerHTML = h; } catch (e) {}
        new MutationObserver(() => { clearTimeout(famFeedSaveT); famFeedSaveT = setTimeout(famFeedSave, 600); }).observe(b, { childList: true, subtree: true, characterData: true });
        setTimeout(() => { const sc = document.getElementById('home-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 300);
    }
    function famFeedHello() {
        const b = document.getElementById('fam-feed-body'); if (!b || b.children.length) return;
        const ex = ['내일 저녁 7시 치과', '점심 12000', '우유랑 계란 사야돼', '이번 달 식비 얼마야', '비상금 10만 저축', '이번 주 일정 알려줘', '아내한테 늦는다고 보내줘', '회의는 3시입니다 영어로 번역해줘', '오늘 일정 뭐야', '택시 1만5천원 현금'];
        const pick = ex.slice().sort(() => Math.random() - .5).slice(0, 2).join(' · ');
        b.innerHTML = `<div class="ff-hello" style="padding:14px 8px 4px;font-size:12px;color:#94a3b8">예) ${pick}</div>`;
    }
    function famFeedOpen() { const m = document.getElementById('main-section'); if (m && !m.classList.contains('active')) showSection('main-section'); }
    function famFeedClose() {}
    function famFeedClear() { famFeedNew(); }
    // ── 새 대화 · 지난 대화 (이 폰에 보관) ──
    function famHistGet() { try { return JSON.parse(localStorage.getItem('famFeedHist') || '[]'); } catch (e) { return []; } }
    function famHistPut(list) {
        for (let n = list.length; n >= 0; n--) { try { localStorage.setItem('famFeedHist', JSON.stringify(list.slice(0, n))); return; } catch (e) {} }
    }
    function famFeedNew() {
        const b = document.getElementById('fam-feed-body'); famFeedSave();
        const items = b.querySelectorAll('.ff-card,.ff-me');
        if (!items.length) { famToast('새 대화입니다'); return; }
        let html = ''; try { html = localStorage.getItem('famFeed') || ''; } catch (e) {}
        const first = b.querySelector('.ff-me'), title = (first ? first.textContent : items[0].textContent).trim().slice(0, 40);
        const list = famHistGet(); list.unshift({ id: 'h' + Date.now(), ts: Date.now(), title, n: b.querySelectorAll('.ff-me').length, html });
        famHistPut(list.slice(0, 100));
        b.innerHTML = ''; try { localStorage.removeItem('famFeed'); } catch (e) {} famFeedHello();
        famToast('새 대화를 시작합니다 · 이전 대화는 🕘 지난 대화에 있습니다');
    }
    function famHistOpen() {
        const list = famHistGet(), fmt = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
        famSheet(`<div class="fam-h"><b>🕘 지난 대화</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-box">${list.length ? list.map(h => `<div style="display:flex;align-items:center;border-bottom:1px solid #eef2f7"><button class="ff-res" style="border:0;flex:1" onclick="famHistView('${h.id}')"><i>💬</i><div>${famEsc(h.title || '(내용 없음)')}<small>${fmt(h.ts)} · 입력 ${h.n || 0}개</small></div></button><button class="fam-x" style="width:26px;height:26px;font-size:11px;flex:none" onclick="famHistDel('${h.id}')">✕</button></div>`).join('') : '<div class="fam-note">보관된 대화가 없습니다. ↺ 새 대화를 누르면 지금 대화가 여기로 옮겨집니다.</div>'}</div>
            <div class="fam-note">이 폰에만 저장됩니다.</div>`);
    }
    function famHistView(id) {
        const h = famHistGet().find(x => x.id === id); if (!h) return;
        famSheet(`<div class="fam-h"><button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="famHistOpen()">◀ 목록</button><b style="flex:1;margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${famEsc(h.title || '')}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div class="fam-feed-body ff-hist-view" style="padding:0">${h.html}</div>
            <div class="fam-btns"><button class="fam-btn" onclick="famHistRestore('${id}')">이 대화 이어서 하기</button></div>`);
    }
    function famHistRestore(id) {
        const list = famHistGet(), h = list.find(x => x.id === id); if (!h) return;
        const b = document.getElementById('fam-feed-body');
        if (b.querySelector('.ff-card,.ff-me')) famFeedNew();
        famHistPut(famHistGet().filter(x => x.id !== id));
        b.innerHTML = h.html; famSheetClose(); famFeedSave();
        setTimeout(() => { const sc = document.getElementById('home-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 50);
    }
    function famHistDel(id) { if (!confirm('이 대화를 삭제할까요?')) return; famHistPut(famHistGet().filter(x => x.id !== id)); famHistOpen(); }
    function famFeedAdd(html, cls) {
        const b = document.getElementById('fam-feed-body'), h = b.querySelector('.ff-hello'); if (h) h.remove();
        const d = document.createElement('div'); d.className = cls || 'ff-card'; d.innerHTML = html; b.appendChild(d); famFeedOpen();
        setTimeout(() => { const sc = document.getElementById('home-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }, 30); return d;
    }
    function famMe(t) { famFeedAdd(famEsc(t), 'ff-me'); }

    function famRun(raw) {
        const m = raw.match(/^\/(\S+)\s*([\s\S]*)$/), cmd = m ? m[1].toLowerCase() : '', arg = m ? m[2].trim() : raw;
        if (cmd === '지우기' || cmd === '새대화') return famFeedNew();
        if (cmd === '지난대화') return famHistOpen();
        if (cmd === '도움말' || cmd === 'help') return famHelp();
        if (cmd === '영수증') return famReceiptMenu();
        if (cmd === '파일') return famDocPick();
        if (cmd === '통역') { showSection('translator-section'); return setTimeout(faceOpen, 300); }
        if (cmd === '여행') return showSection('travel-section');
        if (cmd === '산행' || cmd === '하산') return hikeForm();
        famMe(raw);
        if (cmd === '일정') return famSchCard(arg);
        if (cmd === '가계부') return famAssetCard(arg);
        if (cmd === '채팅') return famChatSend(arg);
        if (cmd === '쇼핑') return arg ? famShopAdd(arg, true) : (famFeedClose(), showSection('shop-section'));
        if (cmd === '검색') return famSearch(arg);
        if (cmd === 'ai' || cmd === 'ai검색') return famAsk(arg);
        if (cmd === '번역') { const lk = famLangFromText(arg.split(/\s+/)[0] || ''); return famTranslateText(lk ? arg.replace(/^\S+\s*/, '') : arg, lk); }
        if (cmd === '뉴스' || cmd === 'news') { famFeedClose(); return showSection('news-section'); }
        if (cmd === '리포트') { famFeedClose(); showSection('asset-analysis-section'); return; }
        if (cmd === '고정지출' || cmd === '저축' || cmd === '정기이체') { famFeedClose(); return showSection('save-section'); }
        if (cmd === '예산') { showSection('asset-section'); return setTimeout(budgetForm, 300); }
        if (m) return famFeedAdd(`"/${famEsc(cmd)}"는 없는 명령입니다. <b>/도움말</b>을 입력해 보세요.`);
        // 슬래시 없음 → 말하듯 쓴 문장 해석 → 자동 분류
        if (famIntent(raw)) return;
        if (typeof famParseForeign === 'function' && famParseForeign(raw)) return famAssetCard(raw);
        const a = famParseAmount(raw);
        if (a.amt >= 100) return famAssetCard(raw);
        const s = famParseSch(raw);
        if (s._found) return famSchCard(raw);
        if (/[?？]\s*$/.test(raw) || /^(뭐|무엇|어떻게|왜|언제|어디|누가|추천|알려|비교|설명)/.test(raw)) return famAsk(raw);
        return famAIRoute(raw);
    }

    // ═══════════════════════════════════════════════════════════
    // 🗣️ 말하듯 쓴 문장 해석
    // ═══════════════════════════════════════════════════════════
    const NAV = [
        [/채팅|톡방|대화방|메시지/, 'chat-section', '채팅'], [/가계부\s*달력|지출\s*달력/, 'asset-cal-section', '가계부 달력'],
        [/분석|리포트|집계|통계/, 'asset-analysis-section', '집계·분석'], [/고정\s*지출|정기\s*이체|저축|적금|목표/, 'save-section', '저축·정기이체'], [/예산/, 'asset-section', '가계부'],
        [/가계부|지출\s*내역|수입\s*내역/, 'asset-section', '가계부'], [/일정|달력|캘린더|스케줄/, 'schedule-section', '일정'],
        [/앨범|사진첩/, 'photo-section', '앨범'], [/여행|여가|캠핑/, 'travel-section', '여행·여가'], [/뉴스|news/i, 'news-section', 'NEWS'],
        [/번역기|통역/, 'translator-section', '번역·통역'], [/장보기|쇼핑/, 'shop-section', '쇼핑·장보기'], [/설정/, '#set', '설정'],
        [/지난\s*대화/, '#hist', '지난 대화'], [/^홈|홈\s*화면/, 'main-section', '홈']
    ];
    function famGo(target, label) {
        if (target === '#fx') return fxOpen();
        if (target === '#set') return famOpenSettings();
        if (target === '#hist') return famHistOpen();
        famFeedAdd(`➡️ <b>${famEsc(label)}</b> 화면을 엽니다.`);
        setTimeout(() => showSection(target), 250);
    }
    const famPeriod = t => {
        const d = new Date(); d.setHours(0, 0, 0, 0); const ymd = famYmd;
        if (/오늘/.test(t)) return [ymd(d), ymd(d), '오늘'];
        if (/어제/.test(t)) { d.setDate(d.getDate() - 1); return [ymd(d), ymd(d), '어제']; }
        if (/지난\s*주|저번\s*주/.test(t)) { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); const e = new Date(m); e.setDate(m.getDate() + 6); return [ymd(m), ymd(e), '지난주']; }
        if (/이번\s*주|금주/.test(t)) { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const e = new Date(m); e.setDate(m.getDate() + 6); return [ymd(m), ymd(e), '이번 주']; }
        if (/지난\s*달|저번\s*달|전월/.test(t)) { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 0); return [ymd(a), ymd(b), `${a.getMonth() + 1}월`]; }
        let mm = t.match(/(\d{1,2})\s*월/); if (mm) { const y = d.getFullYear() - (+mm[1] > d.getMonth() + 1 ? 1 : 0), a = new Date(y, +mm[1] - 1, 1), b = new Date(y, +mm[1], 0); return [ymd(a), ymd(b), `${+mm[1]}월`]; }
        if (/올해|금년/.test(t)) return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`, '올해'];
        const a = new Date(d.getFullYear(), d.getMonth(), 1), b = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [ymd(a), ymd(b), `${d.getMonth() + 1}월`];
    };
    function famSchList(t) {
        let from, to, label;
        if (/이번\s*주|다음\s*주|담주|지난\s*주/.test(t) && !/[월화수목금토일]요일/.test(t)) {
            const d = new Date(); d.setHours(0, 0, 0, 0); const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (/다음|담주/.test(t) ? 7 : /지난/.test(t) ? -7 : 0));
            const e = new Date(m); e.setDate(m.getDate() + 6); from = famYmd(m); to = famYmd(e); label = /다음|담주/.test(t) ? '다음 주' : /지난/.test(t) ? '지난주' : '이번 주';
        } else { const p = famParseDate(t); from = to = p.date || famYmd(new Date()); label = !p.date || from === famYmd(new Date()) ? '오늘' : from; }
        const mb = famParseMember(t, '').member;
        const list = (typeof schData !== 'undefined' ? schData : []).filter(x => x.date >= from && x.date <= to && (!mb || mb === '공통' || x.member === mb || x.member === '공통'))
            .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
        const dow = ds => '일월화수목금토'[new Date(ds + 'T00:00:00').getDay()];
        famFeedAdd(`<h5>📅 ${famEsc(label)} 일정 ${list.length}건${mb && mb !== '공통' ? ' · ' + famEsc(mb) : ''}</h5>${list.map(x => `<button class="ff-res" onclick="famGoSch('${x.date}')"><i>${x.priority === '중요' ? '⭐' : '•'}</i><div>${famEsc(x.memo || '')}<small>${x.date.slice(5)}(${dow(x.date)}) ${x.startTime || '종일'} · ${famEsc(x.member || '')}</small></div></button>`).join('') || '<div class="fam-note">일정이 없습니다.</div>'}`);
    }
    function famMoneyAnswer(t) {
        const [from, to, label] = famPeriod(t), type = /수입|들어온|번\s*돈|월급/.test(t) ? '수입' : '지출';
        const cats = type === '수입' ? INC_CATS : EXP_CATS;
        let cat = cats.find(c => t.includes(c.replace('비', '')) || t.includes(c)) || '';
        if (!cat && type === '지출') { const g = famGuessCat(t, '지출'); if (g !== '기타지출') cat = g; }
        const mb = famParseMember(t, '').member;
        const all = (typeof anaAll === 'function' ? anaAll() : []).filter(e => e.type === type && e.date >= from && e.date <= to && (!cat || e.category === cat) && (!mb || mb === '공통' ? true : e._m === mb));
        const sum = all.reduce((a, e) => a + e.amt, 0), by = {};
        all.forEach(e => by[e.category] = (by[e.category] || 0) + e.amt);
        const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4);
        famFeedAdd(`<h5>💰 ${famEsc(label)}${mb && mb !== '공통' ? ' ' + famEsc(mb) : ''} ${cat ? famEsc(cat) + ' ' : ''}${type}</h5>
            <div style="font-size:20px;font-weight:800;color:#1e293b">${sum.toLocaleString('ko-KR')}원 <small style="font-size:12px;color:#94a3b8;font-weight:600">${all.length}건 · ${from.slice(5)}~${to.slice(5)}</small></div>
            ${!cat && top.length ? `<div style="margin-top:6px;font-size:12.5px;color:#475569">${top.map(([k, v]) => `${famEsc(k)} ${v.toLocaleString('ko-KR')}원`).join(' · ')}</div>` : ''}
            <div class="fam-btns" style="justify-content:flex-start"><button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="showSection('asset-analysis-section')">집계·분석 열기</button></div>`);
    }
    function famChatConfirm(msg) {
        const id = 'cm' + Date.now();
        famFeedAdd(`<h5>🫧 가족 채팅으로 보낼까요?</h5><div class="ff-form"><div class="full"><input id="${id}" value="${famEsc(msg)}"></div></div>
            <div class="fam-btns"><button class="fam-btn pri" onclick="const v=document.getElementById('${id}').value.trim();if(v){this.closest('.ff-card').remove();famChatSend(v);}">보내기</button></div>`);
    }
    function famIntent(raw) {
        const t = raw.trim().replace(/[.!~]+$/, ''), short = t.length <= 24;
        // 1) 화면 이동: "채팅창 열어줘", "가계부 보여줘", "일정으로 가자"
        if (/(열어|열기|켜\s*줘|켜봐|가자|가줘|이동|띄워|들어가|보여\s*줘|보여줄래)/.test(t) && short && !/[?？]$/.test(t)) {
            const isData = /(일정|스케줄|약속)/.test(t) && /(오늘|내일|모레|이번\s*주|다음\s*주|담주|\d+\s*일|[월화수목금토일]요일)/.test(t);
            const isMoney = /(얼마|합계|총)/.test(t);
            if (!isData && !isMoney) { const n = NAV.find(([re]) => re.test(t)); if (n) { famGo(n[1], n[2]); return true; } }
        }
        // 2) 일정 묻기: "오늘 일정 뭐야", "내일 약속 있어?", "이번주 일정 알려줘"
        if (/(일정|스케줄|약속)/.test(t) && /(뭐|무슨|있|알려|보여|몇|확인|어때|\?|？)/.test(t) && !famParseTime(t).time) { famSchList(t); return true; }
        // 3) 돈 묻기: "이번달 지출 얼마야", "지난달 식비 얼마 썼어?"
        if (/(얼마|합계|총액|몇\s*만|얼마나)/.test(t) && /(지출|썼|쓴|수입|들어온|벌|비용|식비|식사|교통|생활비|쇼핑|여행|의료|가계부|돈)/.test(t)) { famMoneyAnswer(t.replace('식비', '식사')); return true; }
        // 3-1) 저축 목표에 입금/출금: "여행자금 10만 저축", "비상금에서 5만 뺐어"
        if (typeof svGoals !== 'undefined' && svGoals.length && /(저축|적립|모았|넣었|넣어|입금|출금|뺐|꺼냈|인출)/.test(t)) {
            const g = svGoals.filter(x => !x.archived).find(x => t.replace(/\s/g, '').includes(String(x.name).replace(/\s/g, '')) || (x.account && t.includes(x.account)));
            const am = famParseAmount(t).amt;
            if (g && am) { const sign = /(출금|뺐|꺼냈|인출|썼)/.test(t) ? -1 : 1, cid = 'svq' + Date.now();
                famFeedAdd(`<h5>🎯 ${famEsc(g.name)}에 ${sign > 0 ? '입금' : '출금'}할까요?</h5><div style="font-size:18px;font-weight:800;color:${sign > 0 ? '#059669' : '#dc2626'}">${sign > 0 ? '+' : '-'}${svW(am)}</div><div class="fam-btns"><button class="fam-btn pri" id="${cid}" onclick="this.disabled=true;svLogSave('${g.id}',${sign},${am},'홈에서 기록').then(lid=>{if(lid)this.closest('.ff-card').innerHTML='✅ ${famEsc(g.name)} ${sign > 0 ? '입금' : '출금'} ${svW(am)} 기록했습니다. '+famUndoBtn('savingsLogs',[lid])})">기록</button></div>`); return true; }
        }
        // 4) 장보기: "우유 장보기에 추가", "계란 사야돼", "휴지 떨어졌어"
        let m = t.match(/^(.+?)\s*(?:을|를)?\s*(?:장보기|쇼핑\s*목록|장바구니)(?:에|로|목록에)?\s*(?:추가|넣어|담아|적어|올려)/);
        if (!m) m = t.match(/^(.+?)\s*(?:을|를|이|가)?\s*(?:사야\s*(?:돼|해|함|됨|겠다|겠어|할\s*듯)|떨어졌|다\s*썼|다\s*떨어)/);
        if (m && !famParseAmount(t).amt) { famShopAdd(m[1].replace(/\s*(이랑|하고|랑|와|과)\s*/g, ',').replace(/\s+/g, ','), true); return true; }
        // 5) 채팅 보내기: "아내한테 늦는다고 보내줘", "채팅으로 저녁 먹었어? 보내줘"
        m = t.match(/^(?:아내|미연|남편|우설|여보|가족|채팅방?|톡방?)\s*(?:한테|에게|께|에|으로|로)\s*(.+?)\s*(?:라고|이라고|고)?\s*(?:보내|전해|말해|톡|남겨|올려)/);
        if (m) { famChatConfirm(m[1]); return true; }
        // 6) 번역: "회의는 3시입니다 영어로 번역해줘", "중국어로 번역: 감사합니다"
        m = t.match(/^(\S+?)(?:로|으로)\s*번역(?:해\s*줘|해)?\s*[:：]\s*(.+)$/);
        if (m && famLangFromText(m[1])) { famTranslateText(m[2], famLangFromText(m[1])); return true; }
        m = t.match(/^(.+?)\s*(?:을|를)?\s*(\S+?)(?:로|으로)\s*(?:번역|바꿔|옮겨)/);
        if (m && famLangFromText(m[2])) { famTranslateText(m[1], famLangFromText(m[2])); return true; }
        // 7) 찾기: "치과 찾아줘", "캠핑 검색해줘"
        m = t.match(/^(.+?)\s*(?:을|를)?\s*(?:찾아|검색)/);
        if (m && short) { famSearch(m[1]); return true; }
        return false;
    }
    // 그래도 모르면: AI에게 의도만 물어서 처리 (키 없으면 앱 안에서 찾기)
    async function famAIRoute(raw) {
        if (!(famKeys()[famProv()] || '')) return famSearch(raw, true);
        const c = famFeedAdd('<span class="fam-spin"></span>무슨 뜻인지 확인하는 중…');
        try {
            const r = await famCallAI('너는 가족 앱의 명령 해석기다. 사용자의 한국어 문장을 아래 JSON 중 하나로만 바꾼다. 설명 없이 JSON만 출력한다.',
                `오늘: ${famYmd(new Date())}
가능한 동작:
{"a":"nav","to":"chat|schedule|asset|assetcal|analysis|photo|travel|news|shop|fixed|settings|home"}  화면 열기
{"a":"schedule","text":"날짜 시간 내용"}  일정 추가
{"a":"asset","text":"내용 금액"}  가계부 기록
{"a":"shop","items":["품목"]}  장보기 추가
{"a":"chat","text":"보낼 말"}  가족 채팅 보내기
{"a":"list_schedule","text":"기간"}  일정 조회
{"a":"money","text":"기간 항목"}  지출·수입 조회
{"a":"web","q":"질문"}  일반 질문·최신 정보
{"a":"find","q":"검색어"}  앱 안의 기록 찾기
문장: ${raw}`, { maxTokens: 300 });
            const tx = r.text || '', i = tx.indexOf('{'), k = tx.lastIndexOf('}'); const j = i >= 0 ? JSON.parse(tx.slice(i, k + 1)) : {};
            c.remove();
            const TO = { chat: 'chat-section', schedule: 'schedule-section', asset: 'asset-section', assetcal: 'asset-cal-section', analysis: 'asset-analysis-section', photo: 'photo-section', travel: 'travel-section', news: 'news-section', shop: 'shop-section', home: 'main-section', fixed: '#fx', settings: '#set' };
            if (j.a === 'nav' && TO[j.to]) return famGo(TO[j.to], (NAV.find(n => n[1] === TO[j.to]) || [0, 0, j.to])[2]);
            if (j.a === 'schedule') return famSchCard(j.text || raw);
            if (j.a === 'asset') return famAssetCard(j.text || raw);
            if (j.a === 'shop' && Array.isArray(j.items) && j.items.length) return famShopAdd(j.items.join(','), true);
            if (j.a === 'chat' && j.text) return famChatConfirm(j.text);
            if (j.a === 'list_schedule') return famSchList(j.text || raw);
            if (j.a === 'money') return famMoneyAnswer(j.text || raw);
            if (j.a === 'web') return famAsk(j.q || raw);
            return famSearch(j.q || raw, true);
        } catch (e) { c.remove(); famSearch(raw, true); }
    }

    // ── 저장 되돌리기 ──
    function famUndoBtn(col, ids) { return `<button class="fam-btn" style="padding:4px 9px;font-size:12px" onclick="famUndo(this,'${col}','${ids.join(',')}')">되돌리기</button>`; }
    async function famUndo(btn, col, ids) {
        btn.disabled = true;
        try { const b = db.batch(); ids.split(',').filter(Boolean).forEach(id => b.delete(db.collection(col).doc(id))); await b.commit(); btn.closest('.ff-card').innerHTML = '↩️ 저장을 취소했습니다.'; }
        catch (e) { btn.disabled = false; famToast('되돌리지 못했습니다: ' + e.message); }
    }

    // ── 일정 확인 카드 ──
    function famMemberSel(id, v) { return `<select id="${id}">${['정우설', '한미연', '공통'].map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select>`; }
    function famSchCard(text) {
        if (!text) return famFeedAdd('예) <b>/일정 내일 오후 7시 치과</b>');
        const p = famParseSch(text), id = 'c' + Date.now();
        const amb = !!p.time && /\d\s*시/.test(text) && !/(오전|오후|아침|저녁|밤|새벽|낮)/.test(text) && !/\d{1,2}:\d{2}/.test(text);
        famFeedAdd(`<h5>📅 일정으로 저장할까요?</h5><div class="ff-form">
            <div class="full"><label>내용</label><input id="${id}-memo" value="${famEsc(p.memo || text)}"></div>
            <div><label>날짜</label><input type="date" id="${id}-date" value="${p.date}"></div>
            <div><label>시간 (비우면 종일)${amb ? ' <span class="rc-dup">· 오전/오후 확인</span>' : ''}</label><input type="time" id="${id}-time" value="${p.time}"${amb ? ' style="border-color:#f59e0b;background:#fffbeb"' : ''}></div>
            <div><label>구성원</label>${famMemberSel(id + '-mem', p.member)}</div>
            <div><label>중요도</label><select id="${id}-pri"><option>일반</option><option>중요</option></select></div>
            </div><div class="fam-btns"><button class="fam-btn pri" onclick="famSchSave('${id}',this)">저장</button></div>`);
    }
    async function famSchSave(id, btn) {
        const g = k => document.getElementById(id + '-' + k).value.trim();
        if (!g('memo') || !g('date')) { famToast('내용과 날짜를 확인하세요'); return; }
        btn.disabled = true;
        const sid = 'sch_' + Date.now(), mem = g('mem'), time = g('time');
        try {
            await db.collection('schedules').doc(sid).set({ id: sid, date: g('date'), priority: g('pri'), member: mem, category: mem === '공통' ? '가족' : '개인', timeType: time ? 'timed' : 'allday', startTime: time, endTime: '', place: '', memo: g('memo'), repeat: null });
            btn.closest('.ff-card').innerHTML = `✅ <b>${famEsc(g('date'))}${time ? ' ' + time : ''}</b> ${famEsc(g('memo'))} · ${famEsc(mem)} — 일정에 저장했습니다. <button class="fam-btn" style="padding:4px 9px;font-size:12px" onclick="famGoSch('${g('date')}')">달력에서 보기</button> ${famUndoBtn('schedules', [sid])}`;
        } catch (e) { btn.disabled = false; famToast('저장 실패: ' + e.message); }
    }
    function famGoSch(date) { famFeedClose(); showSection('schedule-section'); setTimeout(() => { try { curViewDate = new Date(date + 'T00:00:00'); renderSch(); openDayDetail(date); } catch (e) {} }, 350); }

    // ── 가계부 확인 카드 ──
    function famAssetCard(text, pre) {
        if (!text && !pre) return famFeedAdd('예) <b>/가계부 점심 12000</b> · <b>/가계부 월급 350만 입금</b>');
        let p = pre; if (!p) { const fx = typeof famParseForeign === 'function' ? famParseForeign(text) : null; p = famParseAsset(fx ? fx.rest : text); if (fx) { p.cur = fx.cur; p.fAmt = fx.fAmt; p.amt = 0; } }
        const id = 'c' + Date.now() + Math.floor(Math.random() * 99);
        if (p.tripId === undefined && typeof famTripFor === 'function') p.tripId = famTripFor(p.date);
        const cats = t => (t === '수입' ? INC_CATS : EXP_CATS).map(c => `<option ${c === p.category ? 'selected' : ''}>${c}</option>`).join('');
        famFeedAdd(`<h5>💰 가계부에 기록할까요?</h5>${p._dup ? '<div class="rc-dup" style="margin:-4px 0 8px">⚠️ 같은 날짜·금액 내역이 이미 있습니다. 중복인지 확인하세요.</div>' : ''}<div class="ff-form">
            <div class="full"><label>내용</label><input id="${id}-memo" value="${famEsc(p.memo)}"></div>
            <div><label>금액 (원)</label><input type="number" inputmode="numeric" id="${id}-amt" value="${p.amt || ''}"></div>
            ${typeof famFxRowHtml === 'function' ? famFxRowHtml(id, p) : ''}
            <div><label>날짜</label><input type="date" id="${id}-date" value="${p.date}"></div>
            <div><label>구분</label><select id="${id}-type" onchange="document.getElementById('${id}-cat').innerHTML=(this.value==='수입'?INC_CATS:EXP_CATS).map(c=>'<option>'+c+'</option>').join('')"><option ${p.type === '지출' ? 'selected' : ''}>지출</option><option ${p.type === '수입' ? 'selected' : ''}>수입</option></select></div>
            <div><label>분류${p._hist ? ' <span class="rc-hist">· 지난 기록 기준</span>' : ''}</label><select id="${id}-cat">${cats(p.type)}</select></div>
            <div><label>구성원</label>${famMemberSel(id + '-mem', p.member)}</div>
            <div><label>결제</label><select id="${id}-pay"><option ${p.pay === '카드' ? 'selected' : ''}>카드</option><option ${p.pay === '현금' ? 'selected' : ''}>현금</option></select></div>
            ${typeof famTripSelHtml === 'function' ? famTripSelHtml(id, p.date, p.tripId, true) : ''}
            </div><div class="fam-btns"><button class="fam-btn pri" onclick="famAssetSave('${id}',this)">저장</button></div>`);
        if (typeof famFxInit === 'function') famFxInit(id, p);
    }
    async function famAssetSave(id, btn) {
        const g = k => document.getElementById(id + '-' + k).value.trim();
        const amt = Number(g('amt')) || 0; if (!amt) { famToast('금액을 입력하세요'); return; }
        btn.disabled = true;
        const aid = 'as_' + Date.now() + Math.floor(Math.random() * 99), type = g('type');
        try {
            await db.collection('assets').doc(aid).set({ id: aid, member: g('mem'), date: g('date'), type, category: g('cat'), pay: type === '지출' ? g('pay') : '', amt, memo: g('memo'), ...(typeof famTripVals === 'function' ? famTripVals(id) : {}) });
            btn.closest('.ff-card').innerHTML = `✅ ${famEsc(g('date'))} ${type} <b>${amt.toLocaleString('ko-KR')}원</b> · ${famEsc(g('cat'))} · ${famEsc(g('mem'))} — 가계부에 기록했습니다. ${famUndoBtn('assets', [aid])}`;
        } catch (e) { btn.disabled = false; famToast('저장 실패: ' + e.message); }
    }

    // ── 채팅 보내기 ──
    async function famChatSend(text) {
        if (!text) return famFeedAdd('예) <b>/채팅 오늘 늦어요</b>');
        if (!famUser()) { famFeedClose(); if (typeof openProfileModal === 'function') openProfileModal(); return; }
        try {
            await db.collection('messages').add({ type: 'text', text, sender: famUser(), createdAt: firebase.firestore.FieldValue.serverTimestamp(), isRead: false });
            famFeedAdd(`✅ 가족 채팅으로 보냈습니다. <button class="fam-btn" style="padding:4px 9px;font-size:12px" onclick="famFeedClose();showSection('chat-section')">채팅 열기</button>`);
            if (/@(claude|클로드|gpt|지피티|gemini|제미나이|재미나이)/i.test(text)) famChatAI(text);
        } catch (e) { famFeedAdd('⚠️ 전송 실패: ' + famEsc(e.message)); }
    }

    // ── 통합 검색 ──
    function famSearch(q, offerAI) {
        if (!q) return famFeedAdd('예) <b>/검색 캠핑</b>');
        const ql = q.toLowerCase(), hit = s => String(s || '').toLowerCase().includes(ql), res = [];
        (typeof schData !== 'undefined' ? schData : []).forEach(s => { if (hit(s.memo) || hit(s.place)) res.push({ ic: '📅', t: s.memo || '', sub: `${s.date}${s.startTime ? ' ' + s.startTime : ''} · ${s.member || '공통'}`, d: s.date, go: `famGoSch('${s.date}')` }); });
        Object.values(typeof assetData !== 'undefined' ? assetData : {}).forEach(arr => (arr || []).forEach(a => { if (hit(a.memo) || hit(a.category)) res.push({ ic: '💰', t: `${a.category} ${Number(a.amt || 0).toLocaleString('ko-KR')}원${a.memo ? ' · ' + a.memo : ''}`, sub: `${a.date} · ${a.type} · ${a.member}`, d: a.date, go: `famFeedClose();showSection('asset-cal-section')` }); }));
        (typeof planData !== 'undefined' ? planData : []).forEach((p, i) => { if (hit(p.loc) || hit(p.supplies) || hit(p.memo) || hit(p.subType)) res.push({ ic: '✈️', t: `${p.loc || '미정'} (${p.subType || ''})`, sub: `${p.start || ''} ~ ${p.end || ''}`, d: p.start || '', go: `famGoPlan('${famEsc(p.id)}')` }); });
        (typeof chatMessages !== 'undefined' ? chatMessages : []).forEach(c => { if (c.text && hit(c.text)) { const dt = c.createdAt?.toDate ? famYmd(c.createdAt.toDate()) : ''; res.push({ ic: '🫧', t: c.text.slice(0, 60), sub: `${dt} · ${c.isAI ? 'AI' : c.sender || ''}`, d: dt, go: `famFeedClose();showSection('chat-section')` }); } });
        (famShopItems || []).forEach(s => { if (hit(s.text)) res.push({ ic: '🛒', t: s.text, sub: s.done ? '구매 완료' : '장보기 목록', d: '', go: `famFeedClose();showSection('shop-section')` }); });
        res.sort((a, b) => String(b.d).localeCompare(String(a.d)));
        famFeedAdd(`<h5>🔎 "${famEsc(q)}" 검색 결과 ${res.length}건</h5>${res.slice(0, 30).map(r => `<button class="ff-res" onclick="${r.go}"><i>${r.ic}</i><div><div>${famEsc(r.t)}</div><small>${famEsc(r.sub)}</small></div></button>`).join('') || '<div class="fam-note">앱 안에서 찾지 못했습니다.</div>'}
            ${offerAI !== false ? `<div class="fam-btns"><button class="fam-btn" onclick="famAsk(${famEsc(JSON.stringify(q))})">🌐 AI에게 웹 검색으로 묻기</button></div>` : ''}`);
    }
    function famGoPlan(id) { const p = (planData || []).find(x => String(x.id) === String(id)); famFeedClose(); showSection('travel-section'); if (p) setTimeout(() => openTravelDetail(p), 350); }

    // ── AI 웹 검색 ──
    async function famAsk(q) {
        if (!q) return famFeedAdd('예) <b>/ai 이번 주말 서울 날씨</b>');
        const c = famFeedAdd('<span class="fam-spin"></span>AI가 웹을 검색하는 중…');
        try {
            const r = await famCallAI('너는 가족이 함께 쓰는 앱의 AI 비서다. 필요하면 웹 검색으로 최신 정보를 확인하고, 한국어로 짧고 정확하게 답한다. 모르면 모른다고 한다.', q, { search: true, maxTokens: 1500 });
            const seen = new Set(), src = (r.sources || []).filter(s => /^https?:/.test(s.url) && !seen.has(s.url) && seen.add(s.url)).slice(0, 5);
            const oid = 'ai' + Date.now(); c.dataset.raw = r.text || '';
            c.innerHTML = `<div class="fam-ai" id="${oid}">${famMd(r.text || '(응답 없음)')}</div>${src.length ? `<div style="margin-top:8px;border-top:1px solid #e2e8f0;padding-top:6px">${src.map(s => `<a href="${famEsc(s.url)}" target="_blank" rel="noopener" style="display:block;font-size:11.5px;color:#2563eb;padding:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">↗ ${famEsc(s.title)}</a>`).join('')}</div>` : ''}<div class="fam-note" style="display:flex;align-items:center;gap:6px">${famEsc(FAM_NAMES[famProv()])} · 웹 검색<button onclick="famSpeak(this,'${oid}','ko-KR')" style="margin-left:auto;border:none;background:none;font-size:15px;cursor:pointer;padding:2px 4px">🔊</button></div>`;
        } catch (e) { c.innerHTML = '⚠️ ' + famEsc(e.message); }
    }

