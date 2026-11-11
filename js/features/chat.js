        // ══════════════════════════════════════════════════════
        // 💬 채팅 — Firebase Storage + Firestore 풀스택
        // ══════════════════════════════════════════════════════
        let chatMessages    = [];
        let chatEditId      = null;
        let chatSearchKw    = '';
        let chatUnsubscribe = null;

        // 미디어 첨부 상태
        let chatPendingFile     = null;
        let chatPendingType     = null;   // 'image' | 'video' | 'location'
        let chatPendingLocation = null;

        /* ── 파일 선택 ── */
        function onChatFileSelect(input) {
            const file = input.files[0];
            if (!file) return;
            const isVideo = file.type.startsWith('video/');
            chatPendingType     = isVideo ? 'video' : 'image';
            chatPendingLocation = null;
            chatPendingFile     = null; // 압축 완료 전 null 유지

            const thumbEl  = document.getElementById('chat-preview-thumb');
            const nameEl   = document.getElementById('chat-preview-name');
            const preview  = document.getElementById('chat-preview');
            const bar      = document.getElementById('chat-progress-bar');
            const sendBtn  = document.querySelector('.chat-send-btn');

            if (bar)     bar.style.width = '0%';
            if (preview) preview.style.display = 'flex';

            if (isVideo) {
                chatPendingFile = file;
                const url = URL.createObjectURL(file);
                if (thumbEl) thumbEl.innerHTML = `<video src="${url}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;"></video>`;
                if (nameEl)  nameEl.textContent = `${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`;
            } else {
                // 압축 중 전송 버튼 비활성화
                if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.4'; }
                if (nameEl)  nameEl.textContent = '⏳ 압축 중...';

                const reader = new FileReader();
                reader.onload = e => {
                    const img = new Image();
                    img.onload = () => {
                        // 원본 크기
                        const origMB = (file.size / 1024 / 1024).toFixed(1);

                        // 최대 800px로 리사이즈 (더 강한 압축)
                        const MAX = 800;
                        let w = img.width, h = img.height;
                        if (w > MAX || h > MAX) {
                            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                            else       { w = Math.round(w * MAX / h); h = MAX; }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                        // 품질 0.75 (충분한 화질 유지하면서 용량 최소화)
                        canvas.toBlob(blob => {
                            chatPendingFile = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
                            const compMB = (blob.size / 1024 / 1024).toFixed(1);
                            const ratio  = Math.round((1 - blob.size / file.size) * 100);

                            if (nameEl)  nameEl.textContent = `✅ 압축완료 ${origMB}MB→${compMB}MB (${ratio}% 감소) — ➤ 눌러서 전송`;
                            if (thumbEl) thumbEl.innerHTML  = `<img src="${canvas.toDataURL('image/jpeg', 0.5)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">`;

                            // 압축 완료 → 전송 버튼 활성화
                            if (sendBtn) {
                                sendBtn.disabled = false;
                                sendBtn.style.opacity = '1';
                                sendBtn.style.background = 'var(--month-header)';
                            }
                        }, 'image/jpeg', 0.75);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
            input.value = '';
        }

        function cancelChatMedia() {
            chatPendingFile     = null;
            chatPendingType     = null;
            chatPendingLocation = null;
            const preview = document.getElementById('chat-preview');
            const thumb   = document.getElementById('chat-preview-thumb');
            if (preview) preview.style.display = 'none';
            if (thumb)   thumb.innerHTML = '';
        }

        /* ── 위치 공유 (모달 입력) ── */
        function shareChatLocation() {
            const modal = document.getElementById('chat-location-modal');
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    const inp = document.getElementById('chat-location-input');
                    if (inp) { inp.value = ''; inp.focus(); }
                }, 100);
            }
        }

        function confirmChatLocation() {
            const inp  = document.getElementById('chat-location-input');
            const addr = (inp?.value || '').trim();
            if (!addr) { inp?.focus(); return; }

            // 모달 닫기 (두 방식 모두 시도)
            const modal = document.getElementById('chat-location-modal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }

            // 위치 프리뷰 세팅
            chatPendingFile     = null;
            chatPendingType     = 'location';
            chatPendingLocation = { lat: '', lng: '', label: addr };

            // 프리뷰 표시
            const thumbEl = document.getElementById('chat-preview-thumb');
            const nameEl  = document.getElementById('chat-preview-name');
            const preview = document.getElementById('chat-preview');
            if (thumbEl) thumbEl.innerHTML = '<span style="font-size:28px;">📍</span>';
            if (nameEl)  nameEl.textContent = addr;
            if (preview) preview.style.display = 'flex';

            // 바로 전송
            sendChatMessage();
        }

        /* ── 실시간 리스너 ── */
        const CHAT_LIMIT = 400;
        function initChatListener() {
            if (chatUnsubscribe) return;
            initChatNotif();
            try {
                let firstLoad = true;
                // 최근 CHAT_LIMIT개만 구독 (전체를 받으면 기록이 쌓일수록 느려짐)
                chatUnsubscribe = db.collection('messages')
                    .orderBy('createdAt', 'asc')
                    .limitToLast(CHAT_LIMIT)
                    .onSnapshot({ includeMetadataChanges: false }, snap => {
                        chatMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                        if (firstLoad) {
                            // 첫 로드: 알림 없이 뱃지만 업데이트
                            firstLoad = false;
                        } else {
                            // 새 메시지 수신 시 (개수 비교 대신 변경분으로 판단 — 제한 구독에서도 동작)
                            snap.docChanges().forEach(ch => {
                                if (ch.type !== 'added') return;
                                const m = ch.doc.data();
                                if (!m.sender || m.sender === chatUser || m.isAI) return;
                                triggerChatNotif(m.text || '📎 미디어', m.sender);
                            });
                        }

                        // 뱃지 항상 업데이트
                        const unread = chatMessages.filter(m =>
                            m.sender !== chatUser && m.sender !== 'AI' && !m.isRead
                        ).length;
                        updateChatBadge(unread);

                        // 채팅창이 화면에 표시 중이면 렌더링
                        const section = document.getElementById('chat-section');
                        if (section && section.classList.contains('active')) {
                            renderChatMessages();
                            // 실제로 화면을 보고 있을 때만 읽음 처리 (백그라운드에서 알림이 바로 지워지는 문제 방지)
                            if (document.visibilityState === 'visible') markChatRead();
                        }
                    }, err => {
                        console.error('채팅 리스너 오류:', err.code, err.message);
                        chatUnsubscribe = null;
                        // 5초 후 재연결 시도
                        setTimeout(() => { if (!chatUnsubscribe) initChatListener(); }, 5000);
                    });
            } catch(e) {
                console.error('initChatListener 오류:', e);
                setTimeout(() => { if (!chatUnsubscribe) initChatListener(); }, 5000);
            }
        }

        // 채팅창 열릴 때 배경/날씨효과 적용 (DOM이 확정된 후 실행)
        function initChatUI() {
            applyChatBg();
            if (chatFxType && chatFxType !== 'none') {
                // 채팅 카드가 실제로 화면에 그려진 후 캔버스 크기 설정
                requestAnimationFrame(() => {
                    const canvas = document.getElementById('chat-fx-canvas');
                    const card   = document.getElementById('chat-card');
                    if (canvas && card) {
                        canvas.width  = card.offsetWidth  || window.innerWidth;
                        canvas.height = card.offsetHeight || window.innerHeight;
                    }
                    startChatFx();
                });
            }
        }

        function renderChatMessages() {
            const el = document.getElementById('chat-messages');
            if (!el) return;

            // 뱃지는 리스너에서 처리, 여기선 렌더링만

            const kw = chatSearchKw.trim().toLowerCase();
            const filtered = kw
                ? chatMessages.filter(m => (m.text||'').toLowerCase().includes(kw))
                : chatMessages;

            let html = '', lastDate = '';
            filtered.forEach(m => {
                const isMe   = m.sender === chatUser;
                const isAI   = !!m.isAI;
                const side   = isMe ? 'me' : 'them';
                const ts     = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt || Date.now());
                const dateStr = ts.toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' });
                const timeStr = ts.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false });
                const highlight = (kw && (m.text||'').toLowerCase().includes(kw)) ? ' highlight' : '';

                if (dateStr !== lastDate) {
                    html += `<div class="chat-date-divider">${dateStr}</div>`;
                    lastDate = dateStr;
                }

                const readMark = isMe
                    ? `<span class="chat-read">${m.isRead ? '&#10003;&#10003;읽음' : '&#10003;전송'}</span>`
                    : '';
                const msgType = m.type || 'text';
                const isMedia = ['image','video','location'].includes(msgType);
                const canEdit = isMe && !isMedia && !isAI;

                html += `<div class="chat-bubble-wrap ${side}${highlight}" data-id="${m.id}"${isMe ? ` onclick="chatToggleAct(this,event)"` : ''}>
                    ${(!isMe||isAI) ? `<div class="chat-sender" style="display:flex;align-items:center;gap:5px;">${typeof famAvatarHtml==='function' ? famAvatarHtml(isAI?(m.aiName||'AI'):m.sender, 22, true) : ''}${isAI?escHtml(m.aiName||'AI'):escHtml(m.sender||'')}</div>` : ''}
                    <div class="${(isMedia||isAI)?'':'chat-bubble'}">${renderMsgContent(m)}</div>
                    <div class="chat-meta"><span>${timeStr}</span>${readMark}</div>
                    ${isMe ? `<div class="chat-actions">
                        ${canEdit ? `<button class="chat-act-btn" onclick="event.stopPropagation();editChatMessage('${m.id}')">&#9999;&#65039; 수정</button>` : ''}
                        <button class="chat-act-btn" style="color:#ef4444;" onclick="event.stopPropagation();deleteChatMessage('${m.id}')">&#128465; 삭제</button>
                    </div>` : ''}
                </div>`;
            });

            el.innerHTML = html || `<div style="text-align:center;color:#cbd5e1;padding:40px 0;font-size:13px;">
                ${kw ? '검색 결과가 없어요.' : '첫 메시지를 보내보세요 &#128172;'}</div>`;

            if (!kw) el.scrollTop = el.scrollHeight;
        }

        /* ── 콘텐츠 렌더 ── */
        function renderMsgContent(m) {
            if (m.type === 'image') {
                return '<div class="chat-img-bubble" onclick="openChatImgLightbox(\'' + m.mediaUrl + '\')">'
                     + '<img src="' + m.mediaUrl + '" alt="사진" loading="lazy"></div>';
            }
            if (m.type === 'video') {
                return '<div class="chat-video-bubble"><video src="' + m.mediaUrl
                     + '" controls preload="metadata" style="border-radius:14px;max-width:220px;width:100%;"></video></div>';
            }
            if (m.type === 'location') {
                const lat = m.location?.lat || '';
                const lng = m.location?.lng || '';
                const lbl = escHtml(m.location?.label || '위치');
                const hasCoords = lat && lng;
                const mapUrl = hasCoords
                    ? 'https://www.google.com/maps?q=' + lat + ',' + lng
                    : 'https://www.google.com/maps/search/' + encodeURIComponent(m.location?.label || '');
                return '<a href="' + mapUrl + '" target="_blank" class="chat-location-card" style="text-decoration:none;">'
                     + '<div class="chat-location-map"><span style="font-size:36px;">&#128205;</span></div>'
                     + '<div class="chat-location-info">'
                     + '<div class="loc-title">&#128205; ' + lbl + '</div>'
                     + (hasCoords ? '<div class="loc-coords">' + lat + ', ' + lng + '</div>' : '')
                     + '<div style="font-size:10px;color:var(--month-accent);margin-top:3px;font-weight:600;">Google Maps에서 보기 &#8594;</div>'
                     + '</div></a>';
            }
            if (m.isAI) {
                return '<div class="chat-ai-bubble">' + escHtml(m.text||'') + '</div>';
            }
            const text = escHtml(m.text || '');
            const kw   = chatSearchKw.trim().toLowerCase();
            if (kw && text.toLowerCase().includes(kw)) {
                const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return '<span>' + text.replace(new RegExp('('+safe+')','gi'),
                    '<mark style="background:#fef08a;border-radius:3px;padding:0 2px;">$1</mark>') + '</span>';
            }
            return '<span>' + text + '</span>';
        }

        function openChatImgLightbox(url) {
            const lb = document.getElementById('lightbox');
            document.getElementById('lightbox-img').src = url;
            if (lb) lb.style.display = 'flex';
        }

        function escHtml(t) {
            return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
        }

        /* ── 전송 ── */
        function addChatNewline() {
            const el = document.getElementById('chat-input');
            if (!el) return;
            const s = el.selectionStart, e = el.selectionEnd;
            el.value = el.value.slice(0, s) + '\n' + el.value.slice(e);
            el.selectionStart = el.selectionEnd = s + 1;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            el.focus();
        }

        async function sendChatMessage() {
            // 사용자 미설정 시 프로필 모달 먼저
            if (!chatUser) { openProfileModal(); return; }

            const input = document.getElementById('chat-input');
            const text  = (input?.value || '').trim();

            // 이미지 선택했는데 아직 압축 중이면 대기
            if (chatPendingType === 'image' && !chatPendingFile) {
                const nameEl = document.getElementById('chat-preview-name');
                if (nameEl) nameEl.textContent = '⏳ 압축 완료 후 다시 눌러주세요';
                return;
            }

            // ⚡ 먼저 input 비우고 포커스 유지 (키보드 튕김 방지)
            const hadMedia = !!chatPendingType;
            const pendingType = chatPendingType;
            const pendingLoc  = chatPendingLocation;
            if (input && !chatEditId) {
                input.value = '';
                input.style.height = '44px';
                input.focus(); // 서버 응답 기다리기 전에 포커스 유지
            }

            try {
                if (hadMedia && !chatEditId) {
                    if (pendingType === 'location') {
                        await db.collection('messages').add({
                            type: 'location', location: pendingLoc,
                            text: '', sender: chatUser,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            isRead: false
                        });
                    } else {
                        const url = await uploadAndSendMedia();
                        await db.collection('messages').add({
                            type: pendingType, mediaUrl: url,
                            text: text || '', sender: chatUser,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            isRead: false
                        });
                    }
                    cancelChatMedia();
                    if (input) input.focus();
                    return;
                }

                if (!text) return;

                if (chatEditId) {
                    await db.collection('messages').doc(chatEditId).update({
                        text, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    cancelChatEdit();
                    if (input) { input.value = ''; input.style.height = '44px'; input.focus(); }
                } else {
                    await db.collection('messages').add({
                        type: 'text', text, sender: chatUser,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isRead: false
                    });
                    if (input) input.focus();
                }
                const ep = document.getElementById('chat-emoji-panel');
                if (ep) ep.style.display = 'none';

            } catch(e) {
                console.error('전송 오류:', e);
                alert('메시지 전송 실패: ' + (e.message || e.code || '알 수 없는 오류'));
            }
        }

        /* ── 수정 ── */
        // 내 메시지를 탭하면 수정/삭제 버튼 표시 (모바일은 hover가 없음)
        function chatToggleAct(el, ev) {
            if (ev && ev.target.closest('a,video,.chat-img-bubble,button')) return;
            const on = !el.classList.contains('show-act');
            document.querySelectorAll('.chat-bubble-wrap.show-act').forEach(x => x.classList.remove('show-act'));
            if (on) el.classList.add('show-act');
        }

        function editChatMessage(id, text) {
            // 본문은 onclick 문자열 대신 데이터에서 가져옴 (줄바꿈·따옴표가 있어도 동작)
            if (text === undefined) { const m = chatMessages.find(x => x.id === id); text = (m && m.text) || ''; }
            chatEditId = id;
            const input = document.getElementById('chat-input');
            if (input) {
                input.value = text;
                input.focus();
                input.style.height = 'auto';
                input.style.height = input.scrollHeight + 'px';
            }
            const bar = document.getElementById('chat-edit-bar');
            if (bar) bar.style.display = 'flex';
        }

        function cancelChatEdit() {
            chatEditId = null;
            const input = document.getElementById('chat-input');
            if (input) { input.value = ''; input.style.height = 'auto'; }
            const bar = document.getElementById('chat-edit-bar');
            if (bar) bar.style.display = 'none';
        }

        /* ── 삭제 (Storage 파일 포함) ── */
        async function deleteChatMessage(id) {
            if (!confirm('이 메시지를 삭제할까요?')) return;
            const msg = chatMessages.find(m => m.id === id);
            if (msg?.mediaUrl) {
                try { await storage.refFromURL(msg.mediaUrl).delete(); } catch(e) {}
            }
            await db.collection('messages').doc(id).delete();
        }

        /* ── 읽음 처리 ── */
        function markChatRead() {
            if (!chatMessages.length) return;
            const batch = db.batch();
            let changed = false;
            chatMessages.forEach(m => {
                if (m.sender !== chatUser && m.sender !== 'AI' && !m.isRead) {
                    batch.update(db.collection('messages').doc(m.id), { isRead: true });
                    m.isRead = true; // 로컬도 즉시 반영
                    changed = true;
                }
            });
            if (changed) batch.commit().catch(e => console.error('markRead:', e));

            // 뱃지 즉시 0으로
            updateChatBadge(0);

            // SW 알림 + PWA 앱 뱃지 모두 닫기
            // controller가 없을 때(SW 교체 직후 등)도 닫히도록 등록 객체에서 직접 닫음
            if (navigator.serviceWorker) {
                navigator.serviceWorker.getRegistration('/sulyeon-family-/')
                    .then(reg => reg && reg.getNotifications())
                    .then(ns => (ns || []).forEach(n => n.tag !== 'hike' && n.close()))
                    .catch(() => {});
            }
            if ('clearAppBadge' in navigator) {
                navigator.clearAppBadge().catch(() => {});
            }
        }
        // 채팅창을 열어둔 채 앱으로 돌아오면 그때 읽음 처리
        document.addEventListener('visibilitychange', () => {
            const s = document.getElementById('chat-section');
            if (document.visibilityState === 'visible' && s && s.classList.contains('active')) markChatRead();
        });

        /* ── Storage 업로드 ── */
        async function uploadAndSendMedia() {
            if (!chatPendingFile) return null;
            const ext  = chatPendingFile.name.split('.').pop() || 'bin';
            const path = 'chat/' + Date.now() + '_' + chatUser + '.' + ext;
            const ref  = storage.ref(path);
            const task = ref.put(chatPendingFile);
            return new Promise((resolve, reject) => {
                task.on('state_changed',
                    snap => {
                        const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
                        const bar = document.getElementById('chat-progress-bar');
                        if (bar) bar.style.width = pct + '%';
                    },
                    err => reject(err),
                    async () => resolve(await task.snapshot.ref.getDownloadURL())
                );
            });
        }

        /* ── 검색 ── */
        function chatSearch(kw) {
            chatSearchKw = kw;
            renderChatMessages();
        }

        /* ── escapeHtml (하위 호환) ── */
        function escapeHtml(t) { return escHtml(t); }

