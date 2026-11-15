// ═══════════════════════════════════════════════════════════
// 🎙️ 말로 물은 것의 답은 팝업으로: 화면 위쪽에 답을 크게 보여 주고 "읽어드릴까요?" 묻기
//   위젯 마이크·빅스비·홈 마이크로 말한 요청만 (손으로 친 요청은 지금처럼 홈 대화에만)
//   "네·응·읽어" → 읽어 줌 / "아니·됐어" → 닫기 / 버튼: 닫기 · 자세히(홈 대화) · 읽어주기
//   비서 두뇌(brain.js famAgent)가 답을 마치면 famAnswerHook(질문, 답)을 부름
// ═══════════════════════════════════════════════════════════
let vaMark = 0, vaRec = null;
function famVoiceMark() { vaMark = Date.now(); }
const vaPlain = t => String(t || '').replace(/\*\*|__|`|#+\s/g, '').replace(/^\s*[-*•]\s*/gm, '· ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/https?:\/\/\S+/g, '').trim();
function famAnswerHook(q, text) {
    if (!vaMark || Date.now() - vaMark > 120e3 || !text) return;
    vaMark = 0;
    vaPopup(q, text);
}
function vaPopup(q, text) {
    let m = document.getElementById('va-pop');
    if (!m) { m = document.createElement('div'); m.id = 'va-pop'; m.className = 'kk-pop'; document.body.appendChild(m); }
    const plain = vaPlain(text); m.dataset.text = plain;
    m.innerHTML = `<div class="kk-card va-card"><div class="kk-h">🎙️ <b>설연</b> <small style="color:#64748b">${famEsc(String(q || '').slice(0, 40))}</small></div>
        <div class="va-t">${famEsc(plain).replace(/\n/g, '<br>')}</div>
        <div class="kk-q">읽어드릴까요? <span id="va-mic" class="kk-mic"></span></div>
        <div class="kk-b"><button class="fam-btn" onclick="vaHide()">닫기</button><button class="fam-btn" onclick="vaHide(true)">자세히</button><button class="fam-btn pri" onclick="vaRead()">읽어주기</button></div></div>`;
    m.style.display = 'flex';
    clearTimeout(vaPopup._t); vaPopup._t = setTimeout(() => vaHide(), 90000);
    vaAsk();
}
function vaHide(more) {
    const m = document.getElementById('va-pop'); if (m) m.style.display = 'none';
    try { vaRec && vaRec.abort(); } catch (e) {} vaRec = null;
    if (more && typeof showSection === 'function') showSection('main-section');
}
function vaRead() {
    const m = document.getElementById('va-pop'), t = m && m.dataset.text; if (!t) return;
    try { vaRec && vaRec.abort(); } catch (e) {} vaRec = null;
    const q = m.querySelector('.kk-q'); if (q) q.textContent = '🔊 읽는 중…';
    const ss = window.speechSynthesis; if (!ss) return;
    ss.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/·/g, ',').slice(0, 1200)); u.lang = 'ko-KR';
    u.onend = u.onerror = () => { const k = document.querySelector('#va-pop .kk-q'); if (k) k.textContent = ''; };
    ss.speak(u);
}
// 소리로 묻고 5초 듣기 (다른 걸 읽는 중이거나 마이크 사용 중이면 버튼만)
function vaAsk() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, ss = window.speechSynthesis;
    if (!SR || !ss || ss.speaking || (typeof famRec !== 'undefined' && famRec)) return;
    const u = new SpeechSynthesisUtterance('읽어드릴까요?'); u.lang = 'ko-KR';
    u.onend = () => {
        if (document.getElementById('va-pop')?.style.display !== 'flex') return;
        const r = new SR(); vaRec = r; r.lang = 'ko-KR'; r.interimResults = false;
        const mic = document.getElementById('va-mic'); if (mic) mic.textContent = '🎤 듣는 중';
        let said = '';
        r.onresult = e => { said = e.results[0][0].transcript || ''; };
        r.onend = () => {
            if (vaRec !== r) return; vaRec = null;
            const mc = document.getElementById('va-mic'); if (mc) mc.textContent = '';
            if (/(아니|싫|됐어|괜찮|나중|그만)/.test(said)) vaHide();
            else if (/(네|예|응|어|읽어|그래|좋아|부탁)/.test(said)) vaRead();
        };
        r.onerror = () => {};
        try { r.start(); setTimeout(() => { try { r.stop(); } catch (e) {} }, 6000); } catch (e) { vaRec = null; }
    };
    ss.speak(u);
}
