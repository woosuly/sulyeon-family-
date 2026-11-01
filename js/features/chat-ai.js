    // ═══════════════════════════════════════════════════════════
    // 🫧 채팅 @AI 멘션
    // ═══════════════════════════════════════════════════════════
    const MENTION = [['Claude', 'claude', '🟠'], ['GPT', 'gpt', '🟢'], ['Gemini', 'gemini', '🔵']];
    function famMentionCheck() {
        const ta = document.getElementById('chat-input'), box = document.getElementById('fam-mention'); if (!ta || !box) return;
        const m = ta.value.slice(0, ta.selectionStart || ta.value.length).match(/@([A-Za-z가-힣]*)$/);
        if (!m) { box.style.display = 'none'; return; }
        const q = m[1].toLowerCase(), def = famProv();
        const list = MENTION.filter(x => x[0].toLowerCase().startsWith(q) || q === '').sort((a, b) => (b[1] === def) - (a[1] === def));
        if (!list.length) { box.style.display = 'none'; return; }
        const r = ta.getBoundingClientRect();
        box.style.left = Math.max(8, r.left) + 'px'; box.style.bottom = (window.innerHeight - r.top + 6) + 'px'; box.style.minWidth = '160px';
        box.innerHTML = list.map(([n, k, ic]) => `<button onmousedown="event.preventDefault()" onclick="famMentionPick('${n}')">${ic} @${n}<span style="margin-left:auto;font-size:11px;color:#94a3b8;font-weight:500">${!(famKeys()[k] || '') ? '키 없음' : k === def ? '기본' : ''}</span></button>`).join('')
            + (q === '' ? `<button onmousedown="event.preventDefault()" onclick="document.getElementById('fam-mention').style.display='none';openGeminiWindow()" style="font-size:12px;font-weight:600;color:#64748b;border-top:1px solid #f1f5f9">↗ AI 앱 열기</button>` : '');
        box.style.display = 'block';
    }
    function famMentionPick(n) {
        const ta = document.getElementById('chat-input'); const pos = ta.selectionStart || ta.value.length;
        const before = ta.value.slice(0, pos).replace(/@([A-Za-z가-힣]*)$/, '@' + n + ' '); ta.value = before + ta.value.slice(pos);
        document.getElementById('fam-mention').style.display = 'none'; ta.focus(); ta.setSelectionRange(before.length, before.length);
    }
    // ✨ 버튼 = @ 입력과 같은 동작 (커서 위치에 @를 넣고 선택창 표시)
    function famAIButton() {
        const ta = document.getElementById('chat-input'); if (!ta) return;
        const pos = ta.selectionStart ?? ta.value.length, before = ta.value.slice(0, pos);
        if (!/@([A-Za-z가-힣]*)$/.test(before)) {
            const ins = (before && !/\s$/.test(before) ? ' ' : '') + '@';
            ta.value = before + ins + ta.value.slice(pos);
            ta.setSelectionRange(pos + ins.length, pos + ins.length);
        }
        ta.focus(); famMentionCheck();
        setTimeout(famMentionCheck, 350);   // 키보드가 올라온 뒤 위치 다시 계산
    }

    // ═══════════════════════════════════════════════════════════
    // 👤 프로필 사진
    //   Storage profiles/ 에 저장, config/profiles 문서에 {이름: URL}
    // ═══════════════════════════════════════════════════════════
    let famPhotos = {};
    const FAM_AV = { '정우설': ['👨', '#dbeafe'], '한미연': ['👩', '#fce7f3'], 'Claude': ['🟠', '#fff7ed'], 'GPT': ['🟢', '#f0fdf4'], 'Gemini': ['🔵', '#eff6ff'], 'AI': ['🤖', '#f1f5f9'] };
    // zoom=true 이면 탭했을 때 크게 보기
    function famAvatarHtml(name, size, zoom) {
        size = size || 28; const url = famPhotos[name], [em, bg] = FAM_AV[name] || ['👤', '#f1f5f9'];
        const z = zoom ? ` onclick="event.stopPropagation();famAvatarZoom('${famEsc(name)}')" style="cursor:zoom-in;` : ` style="`;
        return url ? `<img src="${famEsc(url)}" class="fam-av"${z}width:${size}px;height:${size}px" alt="">`
            : `<span class="fam-av"${z}width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * .58)}px">${em}</span>`;
    }
    // 프로필 크게 보기 (사진·캐릭터·기본 아이콘 모두)
    function famAvatarZoom(name) {
        famAvatarZoomClose();
        const o = document.createElement('div'); o.id = 'fam-av-zoom';
        o.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;cursor:zoom-out;animation:timModalIn .18s ease-out';
        const size = Math.min(320, Math.round(window.innerWidth * 0.72));
        o.innerHTML = famAvatarHtml(name, size).replace('class="fam-av"', 'class="fam-av" style="box-shadow:0 12px 40px rgba(0,0,0,.35)"').replace('" style="box-shadow:0 12px 40px rgba(0,0,0,.35)" style="', '" style="box-shadow:0 12px 40px rgba(0,0,0,.35);')
            + `<div style="color:#fff;font-size:18px;font-weight:800">${famEsc(name)}</div>`
            + (name === famUser() ? `<button class="fam-btn" style="padding:8px 16px;font-size:13px" onclick="event.stopPropagation();famAvatarZoomClose();famProfileSheet()">프로필 변경</button>` : '');
        o.onclick = famAvatarZoomClose;
        document.body.appendChild(o);
        history.pushState({ famAvZoom: 1 }, '', '');
    }
    function famAvatarZoomClose() { const o = document.getElementById('fam-av-zoom'); if (o) o.remove(); }
    window.addEventListener('popstate', famAvatarZoomClose);
    function famPhotosListen() {
        try { db.collection('config').doc('profiles').onSnapshot(d => { famPhotos = (d.exists && d.data()) || {}; famAvatarApply(); }, () => {}); } catch (e) {}
    }
    function famAvatarApply() {
        const me = famUser(), dv = document.getElementById('drw-avatar');
        if (dv && me) dv.innerHTML = famAvatarHtml(me, 36);
        const pm = document.querySelectorAll('#profile-modal .profile-avatar');
        ['정우설', '한미연'].forEach((n, i) => { if (pm[i] && famPhotos[n]) pm[i].innerHTML = famAvatarHtml(n, 44); });
        const cs = document.getElementById('chat-section');
        if (cs && cs.classList.contains('active') && typeof renderChatMessages === 'function') renderChatMessages();
        famTypingRender();
    }
    function famProfileSheet() {
        const me = famUser(); if (!me) { if (typeof openProfileModal === 'function') openProfileModal(); return; }
        famSheet(`<div class="fam-h"><b>👤 프로필</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div style="text-align:center;padding:4px 0 14px">${famAvatarHtml(me, 96, true)}<div style="font-size:17px;font-weight:800;color:#1e293b;margin-top:10px">${famEsc(me)}</div></div>
            <div class="fam-box">
                <button class="ff-res" onclick="famAvatarPicker()"><i>🎨</i><div>캐릭터 고르기<small>사진 대신 일러스트 · 이모지 캐릭터</small></div></button>
                <button class="ff-res" onclick="document.getElementById('fam-avatar-input').click()"><i>📷</i><div>내 사진·이미지 올리기<small>앨범의 아무 이미지나 · 가운데를 정사각형으로 잘라 저장</small></div></button>
                ${famPhotos[me] ? `<button class="ff-res" onclick="famAvatarRemove()"><i>🗑</i><div>기본 아이콘으로<small>지금 사진·캐릭터를 지웁니다</small></div></button>` : ''}
                <button class="ff-res" onclick="famSheetClose();resetProfile()"><i>🔄</i><div>사용자 전환<small>이 폰을 다른 사람 이름으로 사용</small></div></button>
            </div>`);
    }
    // 🎨 캐릭터 고르기 (DiceBear 무료 일러스트 아바타 — 저작권 걱정 없는 생성 캐릭터)
    const FAM_AV_STYLES = [['notionists', '스케치'], ['lorelei', '일러스트'], ['adventurer', '애니'], ['big-smile', '스마일'], ['fun-emoji', '이모지'], ['thumbs', '심플']];
    const FAM_AV_BG = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c1f0c1';
    let famAvStyle = 'notionists', famAvSeedBase = '';
    const famAvUrl = (style, seed) => `https://api.dicebear.com/10.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${FAM_AV_BG}&radius=50`;
    function famAvatarPicker(style, reshuffle) {
        if (style) famAvStyle = style;
        if (reshuffle || !famAvSeedBase) famAvSeedBase = Math.random().toString(36).slice(2, 7);
        const seeds = Array.from({ length: 12 }, (_, i) => famAvSeedBase + i);
        famSheet(`<div class="fam-h"><b>🎨 캐릭터 고르기</b><button class="fam-x" onclick="famProfileSheet()">✕</button></div>
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none">${FAM_AV_STYLES.map(([k, n]) => `<button class="fam-btn ${k === famAvStyle ? 'pri' : ''}" style="flex:none;padding:6px 12px;font-size:12px" onclick="famAvatarPicker('${k}')">${n}</button>`).join('')}</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:6px 0 12px">${seeds.map(sd => `<button onclick="famAvatarSet('${famAvUrl(famAvStyle, sd)}')" style="border:none;background:none;padding:0;cursor:pointer"><img src="${famAvUrl(famAvStyle, sd)}" loading="lazy" style="width:100%;aspect-ratio:1;border-radius:50%;background:#f1f5f9" alt=""></button>`).join('')}</div>
            <div class="fam-btns"><button class="fam-btn" onclick="famAvatarPicker(null, true)">🔀 다른 캐릭터 보기</button></div>
            <div class="fam-note">마음에 드는 캐릭터를 누르면 바로 적용됩니다.</div>`);
    }
    async function famAvatarSet(url) {
        const me = famUser(); if (!me) return;
        try {
            const old = famPhotos[me];
            await db.collection('config').doc('profiles').set({ [me]: url }, { merge: true });
            famPhotos[me] = url; if (old && typeof albumDelFile === 'function') albumDelFile(old);
            famAvatarApply(); famProfileSheet(); famToast('프로필을 바꿨습니다');
        } catch (e) { famToast('변경 실패: ' + e.message); }
    }

    function famSquare(file, size) {
        return new Promise((ok, no) => {
            const img = new Image(), u = URL.createObjectURL(file);
            img.onload = () => {
                const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = size;
                c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
                URL.revokeObjectURL(u); c.toBlob(b => b ? ok(b) : no(new Error('이미지 변환 실패')), 'image/jpeg', 0.85);
            };
            img.onerror = () => no(new Error('이미지를 읽지 못했습니다')); img.src = u;
        });
    }
    async function famAvatarFile(input) {
        const f = input.files && input.files[0]; input.value = ''; const me = famUser(); if (!f || !me) return;
        try {
            famToast('사진 올리는 중…');
            const blob = await famSquare(f, 400), ref = storage.ref(`profiles/${me}_${Date.now()}.jpg`);
            await ref.put(blob, { contentType: 'image/jpeg' });
            const url = await ref.getDownloadURL(), old = famPhotos[me];
            await db.collection('config').doc('profiles').set({ [me]: url }, { merge: true });
            famPhotos[me] = url; if (old && typeof albumDelFile === 'function') albumDelFile(old);
            famAvatarApply(); famProfileSheet(); famToast('프로필 사진을 바꿨습니다');
        } catch (e) { famToast('사진 변경 실패: ' + e.message); }
    }
    async function famAvatarRemove() {
        const me = famUser(), old = famPhotos[me]; if (!old || !confirm('기본 아이콘으로 바꿀까요?')) return;
        try {
            await db.collection('config').doc('profiles').set({ [me]: firebase.firestore.FieldValue.delete() }, { merge: true });
            delete famPhotos[me]; if (typeof albumDelFile === 'function') albumDelFile(old);
            famAvatarApply(); famProfileSheet();
        } catch (e) { famToast('삭제 실패: ' + e.message); }
    }

    // ═══════════════════════════════════════════════════════════
    // ✍️ 입력 중 표시
    //   typing/{이름} 문서에 입력 중일 때 2.5초마다 기록, 받는 쪽은 7초간 표시
    //   AI가 답변을 만드는 동안은 typing/AI 에 기록 → 두 폰 모두에 표시
    // ═══════════════════════════════════════════════════════════
    let famTypingLast = 0, famTypingOn = false;
    const famTypers = {}, famTyperName = {};
    function famTypingPing() {
        const me = famUser(), ta = document.getElementById('chat-input'); if (!me || !ta) return;
        if (!ta.value.trim()) { famTypingStop(); return; }
        const now = Date.now(); if (famTypingOn && now - famTypingLast < 2500) return;
        famTypingLast = now; famTypingOn = true;
        db.collection('typing').doc(me).set({ on: true, name: me, at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
    function famTypingStop() {
        if (!famTypingOn) return; famTypingOn = false; const me = famUser();
        if (me) db.collection('typing').doc(me).set({ on: false, name: me, at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
    function famTypingAI(name, on) {
        db.collection('typing').doc('AI').set({ on, name, at: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
    function famTypingListen() {
        try {
            db.collection('typing').onSnapshot(s => {
                s.docChanges().forEach(ch => {
                    const id = ch.doc.id; if (id === famUser()) return;
                    const d = ch.doc.data({ serverTimestamps: 'estimate' }) || {}, at = d.at && d.at.toMillis ? d.at.toMillis() : 0;
                    clearTimeout(famTypers[id]); delete famTypers[id];
                    if (ch.type !== 'removed' && d.on && Date.now() - at < (id === 'AI' ? 90000 : 15000)) {
                        famTyperName[id] = d.name || id;
                        famTypers[id] = setTimeout(() => { delete famTypers[id]; famTypingRender(); }, id === 'AI' ? 90000 : 7000);
                    }
                });
                famTypingRender();
            }, () => {});
        } catch (e) {}
    }
    function famTypingRender() {
        const el = document.getElementById('chat-typing'); if (!el) return;
        const ids = Object.keys(famTypers);
        if (!ids.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
        el.innerHTML = ids.map(id => { const n = famTyperName[id] || id, ai = id === 'AI';
            return `<div class="ct-row">${famAvatarHtml(n, 20, true)}<span>${famEsc(n)}${ai ? '가 답변 중' : '님이 입력 중'}</span><span class="ct-dots"><i></i><i></i><i></i></span></div>`; }).join('');
        el.style.display = 'block';
        const box = document.getElementById('chat-messages');
        if (box && box.scrollHeight - box.scrollTop - box.clientHeight < 120) box.scrollTop = box.scrollHeight;
    }

    function famMentionProvider(text) {
        if (/@(claude|클로드)/i.test(text)) return 'claude';
        if (/@(gpt|지피티|챗gpt)/i.test(text)) return 'gpt';
        if (/@(gemini|제미나이|재미나이)/i.test(text)) return 'gemini';
        return '';
    }
    async function famChatAI(text) {
        const p = famMentionProvider(text); if (!p) return;
        if (!(famKeys()[p] || '')) { famToast(FAM_NAMES[p] + ' API 키가 없습니다. ⚙️ 설정에서 입력하세요.'); return; }
        famTypingAI(FAM_NAMES[p], true);
        const ctx = (typeof chatMessages !== 'undefined' ? chatMessages : []).filter(m => m.text).slice(-12).map(m => `${m.isAI ? (m.aiName || 'AI') : (m.sender || '')}: ${m.text}`).join('\n');
        try {
            const r = await famCallAI(`너는 부부가 쓰는 가족 채팅방에 초대된 AI "${FAM_NAMES[p]}"다. 대화 맥락을 보고 마지막 질문에 한국어로 짧고 친근하게 답한다. 최신 정보가 필요하면 웹 검색을 쓴다.`,
                `최근 대화:\n${ctx}\n\n방금 질문: ${text.replace(/@\S+/g, '').trim()}`, { provider: p, search: true, maxTokens: 900 });
            await db.collection('messages').add({ type: 'text', text: (r.text || '').trim() || '(응답 없음)', sender: FAM_NAMES[p], isAI: true, aiName: FAM_NAMES[p], isRead: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        } catch (e) { famToast(FAM_NAMES[p] + ' 오류: ' + e.message); }
        famTypingAI(FAM_NAMES[p], false);
    }

