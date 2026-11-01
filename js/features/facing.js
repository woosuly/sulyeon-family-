// ═══════════════════════════════════════════════════════════
// ↕ 마주보기 통역 — 화면 위쪽은 상대방(180° 회전), 아래쪽은 나
//   말하거나 입력하면 번역문이 상대 쪽에 크게 표시되고 읽어줌
// ═══════════════════════════════════════════════════════════
const FACE_TAP = { ko: '눌러서 말하기', en: 'Tap to speak', it: 'Tocca per parlare', fr: 'Touchez pour parler', zh: '点击说话', ja: 'タップして話す', vi: 'Chạm để nói', th: 'แตะเพื่อพูด', pt: 'Toque para falar' };
const FACE_WAIT = { ko: '번역 중…', en: 'Translating…', it: 'Traduzione…', fr: 'Traduction…', zh: '翻译中…', ja: '翻訳中…', vi: 'Đang dịch…', th: 'กำลังแปล…', pt: 'Traduzindo…' };
const FACE_HINT = { ko: '상대방 말이 여기에 번역됩니다', en: 'The other person’s words appear here', it: 'Qui appare la traduzione', fr: 'La traduction apparaît ici', zh: '翻译显示在这里', ja: 'ここに翻訳が表示されます', vi: 'Bản dịch hiện ở đây', th: 'คำแปลจะแสดงที่นี่', pt: 'A tradução aparece aqui' };
let faceSR = null, faceSide = '', faceTTS = true, faceLock = null;

function faceLang(side) { return side === 'me' ? timSrc : timTgt; }
function faceOpen() {
    if (!timGetKey()) { timOpenApiKeyModal(); return; }
    try { timStopMyMic(); timStopPeerMic(); timStopLiveMode(); } catch (e) {}
    let o = document.getElementById('face-ov');
    if (!o) { o = document.createElement('div'); o.id = 'face-ov'; document.body.appendChild(o); }
    o.innerHTML = `
        <div class="face-half face-peer" id="face-peer">${faceHalfHtml('peer')}</div>
        <div class="face-mid">
            <button onclick="faceClose()">✕ 닫기</button>
            <span>${timSrc.f} ${famEsc(timSrc.n)} ↔ ${timTgt.f} ${famEsc(timTgt.n)}</span>
            <button id="face-tts" onclick="faceTTS=!faceTTS;this.textContent=faceTTS?'🔊 켜짐':'🔇 꺼짐'">${faceTTS ? '🔊 켜짐' : '🔇 꺼짐'}</button>
        </div>
        <div class="face-half face-me" id="face-me">${faceHalfHtml('me')}</div>`;
    o.style.display = 'flex';
    history.pushState({ face: 1 }, '', '');
    try { navigator.wakeLock && navigator.wakeLock.request('screen').then(l => faceLock = l).catch(() => {}); } catch (e) {}
}
function faceHalfHtml(side) {
    const L = faceLang(side), g = L.g;
    return `<div class="face-lang">${L.f} ${famEsc(L.n)}</div>
        <div class="face-out" id="face-out-${side}"><span class="face-ph">${famEsc(FACE_HINT[g] || FACE_HINT.en)}</span></div>
        <div class="face-said" id="face-said-${side}"></div>
        <div class="face-ctl">
            ${side === 'me' ? `<input id="face-txt" placeholder="입력해서 보내기" onkeydown="if(event.key==='Enter'){event.preventDefault();faceSendText()}"><button class="face-send" onclick="faceSendText()">➤</button>` : ''}
            <button class="face-mic" id="face-mic-${side}" onclick="faceMic('${side}')">🎙️ ${famEsc(FACE_TAP[g] || FACE_TAP.en)}</button>
        </div>`;
}
function faceClose() {
    faceStopSR();
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    try { faceLock && faceLock.release(); } catch (e) {} faceLock = null;
    const o = document.getElementById('face-ov'); if (o) o.style.display = 'none';
}
function faceStopSR() {
    if (faceSR) { try { faceSR.onend = null; faceSR.abort(); } catch (e) {} }
    faceSR = null;
    ['me', 'peer'].forEach(s => { const b = document.getElementById('face-mic-' + s); if (b) b.classList.remove('on'); });
    faceSide = '';
}
async function faceMic(side) {
    if (faceSide === side) { try { faceSR.stop(); } catch (e) {} return; }
    faceStopSR();
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { famToast('이 브라우저는 음성 인식을 지원하지 않습니다 (Chrome 권장)'); return; }
    if (!await _timGrantMic()) return;
    try { speechSynthesis.cancel(); } catch (e) {}
    const L = faceLang(side), r = new SR(); faceSR = r; faceSide = side;
    r.lang = L.sr; r.interimResults = true; r.continuous = false;
    const said = document.getElementById('face-said-' + side), btn = document.getElementById('face-mic-' + side);
    btn.classList.add('on');
    let finalTxt = '';
    r.onresult = e => {
        let t = ''; finalTxt = '';
        for (let i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript; }
        said.textContent = t;
    };
    r.onerror = e => { if (e.error === 'not-allowed') famToast('마이크 권한을 허용해 주세요'); };
    r.onend = () => {
        const t = (finalTxt || said.textContent || '').trim();
        faceSR = null; faceSide = ''; btn.classList.remove('on');
        if (t) faceTranslate(side, t);
    };
    try { r.start(); } catch (e) { faceStopSR(); }
}
function faceSendText() {
    const el = document.getElementById('face-txt'), t = (el.value || '').trim(); if (!t) return;
    el.value = ''; document.getElementById('face-said-me').textContent = t; faceTranslate('me', t);
}
async function faceTranslate(side, text) {
    const from = faceLang(side), toSide = side === 'me' ? 'peer' : 'me', to = faceLang(toSide), out = document.getElementById('face-out-' + toSide);
    out.innerHTML = `<span class="face-ph">${famEsc(FACE_WAIT[to.g] || FACE_WAIT.en)}</span>`;
    try {
        const prompt = `You are interpreting a face-to-face conversation while travelling. Translate from ${from.n} (${from.g}) to ${to.n} (${to.g}). Keep it natural and polite, as spoken language. Output only the translation.\n\n${text}`;
        const tr = ((await timCallAI('interpret', prompt)) || '').trim();
        out.textContent = tr || '—';
        if (tr && faceTTS) timSpeakLang(tr, to.sr);
        faceLog(side, text, tr);
    } catch (e) { out.innerHTML = `<span class="face-ph">⚠️ ${famEsc(e.message)}</span>`; }
}
// 통역 탭의 대화 기록에도 남김
function faceLog(side, orig, tr) { if (!tr) return; window._faceMute = true; try { _timAddBubble(side === 'me' ? 'my' : 'peer', orig, tr, faceLang(side === 'me' ? 'peer' : 'me').sr); } catch (e) {} window._faceMute = false; }
// 대화 기록에 넣을 때는 다시 읽지 않도록
(function () {
    const sp = window.timSpeakLang;
    window.timSpeakLang = function (text, lang) { if (window._faceMute) return; return sp(text, lang); };
    const sel = window.timSelectInterpMode;
    window.timSelectInterpMode = function (mode) {
        if (mode === 'face') { const m = document.getElementById('tim-interp-mode-modal'); if (m) m.style.display = 'none'; faceOpen(); return; }
        return sel(mode);
    };
    window.addEventListener('popstate', () => { const o = document.getElementById('face-ov'); if (o && o.style.display === 'flex') faceClose(); });
})();
