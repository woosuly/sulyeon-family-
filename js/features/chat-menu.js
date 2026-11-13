// ═══════════════════════════════════════════════════════════
// 채팅 말풍선 메뉴 (한씨네 방식)
//  - 말풍선을 길게 누르면(PC는 오른쪽 클릭) 바로 옆에 작은 팝업
//  - 맨 위 공감 6개, 아래 답장·복사·공유·번역·읽기 (+ 내 메시지: 수정·삭제)
//  - 공감은 messages/{id}.rx = {사람: 이모지}, 한 사람 하나, 같은 걸 다시 누르면 취소
// ═══════════════════════════════════════════════════════════
const CHAT_RX = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const CHAT_MI = {
    reply: '<path d="M10 8L5 12l5 4"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    trans: '<path d="M4 5h8M8 3v2M6 5c0 4 3 7 6 8"/><path d="M11 5c-1 4-4 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
    spk: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
};
const chatMi = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${CHAT_MI[k]}</svg>`;
let chatReplyTo = null;          // 답장 대상 {id, sender, text}
const chatTrCache = {};          // 번역 결과 (id+언어)

// 손을 뗄 때 생기는 click이 '메뉴 바깥 클릭'으로 처리돼 바로 닫히지 않게 450ms 동안 막음
function chatEatClick() {
    const f = e => { e.stopPropagation(); e.preventDefault(); };
    document.addEventListener('click', f, true);
    setTimeout(() => document.removeEventListener('click', f, true), 450);
}

// 복사: 클립보드가 막힌 환경(앱 안 웹 화면)에서는 숨긴 textarea + execCommand로 다시 시도
function famCopy(t, msg) {
    if (!t) return;
    const ok = () => famToast(msg || '복사했습니다');
    const old = () => {
        try {
            const a = document.createElement('textarea');
            a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(a); a.select(); a.setSelectionRange(0, t.length);
            const r = document.execCommand('copy'); a.remove();
            r ? ok() : famToast('복사할 수 없습니다');
        } catch (e) { famToast('복사할 수 없습니다'); }
    };
    try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(ok, old); else old(); } catch (e) { old(); }
}
// 공유: 앱(APK)은 안드로이드 공유창, 브라우저는 공유 기능, 둘 다 안 되면 복사
async function famShare(t) {
    if (!t) return;
    const P = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    if (P && P.share) { try { await P.share({ text: t }); return; } catch (e) {} }
    if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    famCopy(t, '복사했습니다. 보낼 앱에 붙여넣어 주세요');
}
// 읽기: 앱은 네이티브 TTS, 아니면 브라우저 읽기
function chatSpeak(text, code) {
    const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    const sr = (typeof tLang === 'function' ? tLang(code)[2] : 'ko-KR');
    if (P && P.speak) { P.speak({ text, lang: sr }).catch(() => { if (typeof talkSpeak === 'function') talkSpeak(text, code); }); return; }
    if (typeof talkSpeak === 'function') talkSpeak(text, code);
}

const chatFindMsg = id => (typeof chatMessages !== 'undefined' ? chatMessages : []).find(m => m.id === id);
function chatShareBody(m) {
    if (m.type === 'location') { const l = m.location || {}; return [l.label || '위치', l.lat && l.lng ? `https://www.google.com/maps?q=${l.lat},${l.lng}` : ''].filter(Boolean).join('\n'); }
    return [m.text, m.mediaUrl].filter(Boolean).join('\n');
}

// ── 공감 ──
function chatRxHtml(m) {
    const r = m.rx || {}, cnt = {};
    Object.values(r).forEach(e => cnt[e] = (cnt[e] || 0) + 1);
    const ks = Object.keys(cnt); if (!ks.length) return '';
    return `<div class="rxs">${ks.map(e => `<button class="rx ${r[chatUser] === e ? 'on' : ''}" onclick="event.stopPropagation();chatReact('${m.id}','${e}')" aria-label="${e} ${cnt[e]}명">${e}${cnt[e] > 1 ? ' ' + cnt[e] : ''}</button>`).join('')}</div>`;
}
async function chatReact(id, em) {
    const m = chatFindMsg(id); if (!m || !chatUser) return;
    const r = { ...(m.rx || {}) };
    if (r[chatUser] === em) delete r[chatUser]; else r[chatUser] = em;
    m.rx = r; renderChatMessages();
    try { await db.collection('messages').doc(id).update({ rx: Object.keys(r).length ? r : firebase.firestore.FieldValue.delete() }); }
    catch (e) { famToast('공감을 저장하지 못했습니다: ' + e.message); }
}

// ── 메뉴 ──
function chatMenuClose() {
    const d = document.getElementById('chat-mpop-dim'); if (d) d.remove();
    document.querySelectorAll('.chat-bubble-wrap.picked').forEach(x => x.classList.remove('picked'));
}
function chatMsgMenu(id) {
    const m = chatFindMsg(id); if (!m) return;
    chatMenuClose();
    const mine = m.sender === chatUser && !m.isAI, hasText = !!(m.text && m.text.trim());
    const ko = hasText && /[가-힣]/.test(m.text), to = ko ? ((typeof talk !== 'undefined' && talk.them) || 'en') : 'ko';
    const tr = hasText ? chatTrCache[id + to] : null;
    const mineRx = (m.rx || {})[chatUser] || '';
    const isMedia = ['image', 'video', 'location'].includes(m.type || 'text');
    const btns = `<button data-a="reply">${chatMi('reply')}<span>답장</span></button>`
        + (hasText ? `<button data-a="copy">${chatMi('copy')}<span>복사</span></button>` : '')
        + (chatShareBody(m) ? `<button data-a="share">${chatMi('share')}<span>공유</span></button>` : '')
        + (hasText ? `<button data-a="trans">${chatMi('trans')}<span>번역</span></button><button data-a="spk">${chatMi('spk')}<span>읽기</span></button>` : '')
        + (mine && hasText && !isMedia ? `<button data-a="edit">${chatMi('edit')}<span>수정</span></button>` : '')
        + (mine ? `<button data-a="del" class="red">${chatMi('del')}<span>삭제</span></button>` : '');
    const d = document.createElement('div');
    d.id = 'chat-mpop-dim'; d.className = 'mpop-dim'; d.style.display = 'flex';
    d.innerHTML = `<div class="mpop" id="chat-mpop" role="menu">
        <div class="mpop-rx">${CHAT_RX.map(e => `<button data-rx="${e}" class="${mineRx === e ? 'on' : ''}" aria-label="공감 ${e}">${e}</button>`).join('')}</div>
        <div class="mpop-b">${btns}</div>
        ${tr ? `<div class="mpop-tr"><div class="tr-t">${escHtml(tr.tr)}</div>${tr.pron ? `<div class="tr-p">발음 · ${escHtml(tr.pron)}</div>` : ''}</div>` : ''}
    </div>`;
    if (!document.getElementById('chat-mpop-dim')) history.pushState({ mpop: 1 }, '', '');
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) chatMenuClose(); });
    chatPlacePop(id);
    d.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => { chatMenuClose(); chatReact(id, b.dataset.rx); });
    const act = {
        reply: () => { chatMenuClose(); chatSetReply(m); },
        copy: () => { chatMenuClose(); famCopy(m.text); },
        share: () => { chatMenuClose(); famShare(chatShareBody(m)); },
        spk: () => chatSpeak(tr ? tr.tr : m.text, tr ? to : (ko ? 'ko' : 'en')),
        edit: () => { chatMenuClose(); editChatMessage(id); },
        trans: async b => {
            if (typeof talkTranslate !== 'function') return famToast('번역 기능을 불러오지 못했습니다');
            b.querySelector('span').textContent = '번역 중';
            try { chatTrCache[id + to] = await talkTranslate(m.text, ko ? 'ko' : 'en', to); chatMsgMenu(id); }
            catch (e) { b.querySelector('span').textContent = '번역'; famToast(e.message); }
        },
        del: b => {   // 한 번 더 눌러 확인
            if (!b.dataset.sure) { b.dataset.sure = 1; b.querySelector('span').textContent = '한 번 더'; return; }
            chatMenuClose(); deleteChatMessage(id, true);
        }
    };
    d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => act[b.dataset.a](b));
}
// 위치: 말풍선 아래(공간이 없으면 위), 내 메시지는 오른쪽 맞춤, 누른 말풍선에 테두리
function chatPlacePop(id) {
    const p = document.getElementById('chat-mpop'), w = document.querySelector(`#chat-messages .chat-bubble-wrap[data-id="${CSS.escape(id)}"]`);
    if (!p) return;
    const W = innerWidth, H = window.visualViewport ? visualViewport.height : innerHeight;
    const tgt = w ? (w.querySelector('.chat-bubble,.chat-ai-bubble,.chat-img-bubble,.chat-video-bubble,.chat-location-card') || w) : null;
    const b = tgt ? tgt.getBoundingClientRect() : { top: H / 2, bottom: H / 2, left: 12, right: W - 12 };
    const mine = w && w.classList.contains('me'), pw = p.offsetWidth, ph = p.offsetHeight;
    let y = b.bottom + 6; if (y + ph > H - 8) y = b.top - ph - 6; if (y < 8) y = Math.max(8, H - ph - 8);
    let x = mine ? b.right - pw : b.left; x = Math.max(8, Math.min(x, W - pw - 8));
    p.style.left = x + 'px'; p.style.top = y + 'px';
    if (w) w.classList.add('picked');
}

// ── 답장 ──
function chatSetReply(m) {
    chatReplyTo = { id: m.id, sender: m.isAI ? (m.aiName || 'AI') : (m.sender || ''), text: (m.text || ({ image: '사진', video: '동영상', location: '위치' }[m.type] || '')).slice(0, 80) };
    let bar = document.getElementById('chat-reply-bar');
    if (!bar) {
        bar = document.createElement('div'); bar.id = 'chat-reply-bar'; bar.className = 'chat-reply-bar';
        const ib = document.querySelector('#chat-section .chat-input-bar'); ib.parentNode.insertBefore(bar, ib);
    }
    bar.innerHTML = `<div><b>${escHtml(chatReplyTo.sender)}에게 답장</b><span>${escHtml(chatReplyTo.text)}</span></div><button onclick="chatClearReply()" aria-label="답장 취소">✕</button>`;
    bar.style.display = 'flex';
    const input = document.getElementById('chat-input'); if (input) input.focus();
}
function chatClearReply() { chatReplyTo = null; const bar = document.getElementById('chat-reply-bar'); if (bar) bar.style.display = 'none'; }
function chatReplyHtml(m) {
    if (!m.replyTo) return '';
    return `<div class="chat-quote" onclick="event.stopPropagation();chatJumpTo('${m.replyTo.id}')"><b>${escHtml(m.replyTo.sender || '')}</b>${escHtml(m.replyTo.text || '')}</div>`;
}
function chatJumpTo(id) {
    const el = document.querySelector(`#chat-messages .chat-bubble-wrap[data-id="${CSS.escape(id)}"]`);
    if (!el) return famToast('원래 메시지를 찾지 못했습니다');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('highlight'); setTimeout(() => el.classList.remove('highlight'), 1600);
}

// ── 길게 누르기 연결 (휴대폰: 450ms, PC: 오른쪽 클릭) ──
(function () {
    let timer = null, sx = 0, sy = 0, lastOpen = 0;
    const wrapOf = t => t.closest && t.closest('#chat-messages .chat-bubble-wrap');
    const skip = t => t.closest('a,video,button,.rxs,.chat-quote');
    const open = id => {
        if (Date.now() - lastOpen < 600) return;   // 터치 길게 누르기와 contextmenu가 둘 다 오는 경우 한 번만
        lastOpen = Date.now();
        chatEatClick();
        try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
        chatMsgMenu(id);
    };
    document.addEventListener('touchstart', e => {
        const w = wrapOf(e.target); if (!w || skip(e.target)) return;
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        clearTimeout(timer); timer = setTimeout(() => open(w.dataset.id), 450);
    }, { passive: true });
    document.addEventListener('touchmove', e => { if (timer && (Math.abs(e.touches[0].clientX - sx) > 10 || Math.abs(e.touches[0].clientY - sy) > 10)) { clearTimeout(timer); timer = null; } }, { passive: true });
    ['touchend', 'touchcancel'].forEach(t => document.addEventListener(t, () => { clearTimeout(timer); timer = null; }, { passive: true }));
    document.addEventListener('contextmenu', e => {
        const w = wrapOf(e.target); if (!w || skip(e.target)) return;
        e.preventDefault(); open(w.dataset.id);
    });
})();
