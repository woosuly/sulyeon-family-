// ═══════════════════════════════════════════════════════════
// 💬 카톡·문자 "읽어드릴까요?" 팝업 (안드로이드 앱, 받는 카톡방 + 연락처에 저장된 사람의 문자)
//   설연이 열려 있을 때 카톡이 오면: 팝업 + "카톡이 왔습니다. 읽어드릴까요?" 묻고 5초 듣기
//     "네·응·읽어" → 읽어 줌 / "아니·됐어" → 닫기 / 버튼으로도 가능
//   설연이 닫혀 있으면: 안드로이드 팝업 알림의 [읽어주기] 버튼 (KakaoAsk.java)
//   밤 10시 ~ 아침 7시는 묻지 않음. 설정 → 문자·카톡에서 끄기
// ═══════════════════════════════════════════════════════════
const kkN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
let kkRec = null;
function kkPopup(room, from, text, n) {
    let m = document.getElementById('kk-pop');
    if (!m) { m = document.createElement('div'); m.id = 'kk-pop'; m.className = 'kk-pop'; document.body.appendChild(m); }
    const same = m.dataset.room === room && m.style.display === 'flex';
    m.dataset.room = room; m.style.display = 'flex';
    const sms = room.startsWith('문자 · '), what = sms ? '문자' : '카톡'; m.dataset.what = what;
    m.innerHTML = `<div class="kk-card${sms ? ' sms' : ''}"><div class="kk-h">${sms ? '✉️' : '💬'} <b>${famEsc(room)}</b>${n > 1 ? ` <em>${n}개</em>` : ''}</div>
        <div class="kk-t">${room === from || sms ? '' : famEsc(from) + ': '}${famEsc(String(text).slice(0, 80))}${String(text).length > 80 ? '…' : ''}</div>
        <div class="kk-q">${what}가 왔습니다. 읽어드릴까요? <span id="kk-mic" class="kk-mic"></span></div>
        <div class="kk-list" id="kk-list" style="display:none"></div>
        <div class="kk-b"><button class="fam-btn" onclick="kkNo()">괜찮아요</button><button class="fam-btn" onclick="kkView()">보기</button><button class="fam-btn" onclick="kkOpenApp()">${sms ? '문자' : '카톡'} 열기</button><button class="fam-btn pri" onclick="kkYes()">읽어주기</button></div></div>`;
    clearTimeout(kkPopup._t); kkPopup._t = setTimeout(() => kkHide(), 30000);
    if (!same) kkAskVoice();
}
// 보기: 쌓인 메시지 전부 펼침 (팝업은 닫히지 않게 시간 연장, 묻는 소리·듣기는 멈춤)
async function kkView() {
    const m = document.getElementById('kk-pop'), room = m && m.dataset.room, el = document.getElementById('kk-list'), N = kkN(); if (!room || !el) return;
    try { kkRec && kkRec.abort(); } catch (e) {} try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    const r = N && N.kakaoAsk ? await N.kakaoAsk({ room }).catch(() => ({})) : {}, list = r.list || [];
    const sms = room.startsWith('문자 · ');
    el.innerHTML = list.length ? list.map(x => `<div>${x.from && x.from !== room && !sms ? `<b>${famEsc(x.from)}</b> ` : ''}${famEsc(x.text)}</div>`).join('') : '<div style="color:#94a3b8">이미 읽었거나 지운 메시지입니다.</div>';
    el.style.display = 'block'; m.querySelector('.kk-t').style.display = 'none';
    clearTimeout(kkPopup._t); kkPopup._t = setTimeout(() => kkHide(), 120000);
}
// 원래 앱(카톡·문자)으로 가서 보기·답장
function kkOpenApp() {
    const m = document.getElementById('kk-pop'), sms = m && m.dataset.room && m.dataset.room.startsWith('문자 · '), N = kkN(); kkNo();
    if (N && N.openApp) N.openApp({ pkg: sms ? 'com.samsung.android.messaging' : 'com.kakao.talk' }).catch(() => {});
}
function kkHide() { const m = document.getElementById('kk-pop'); if (m) m.style.display = 'none'; try { kkRec && kkRec.abort(); } catch (e) {} kkRec = null; }
function kkYes() { const m = document.getElementById('kk-pop'), room = m && m.dataset.room; kkHide(); const N = kkN(); if (room && N && N.kakaoRead) N.kakaoRead({ room }); }
function kkNo() { const m = document.getElementById('kk-pop'), room = m && m.dataset.room; kkHide(); const N = kkN(); if (room && N && N.kakaoClear) N.kakaoClear({ room }); }
// 소리로 묻고 대답 듣기 (다른 걸 읽어 주는 중이거나 마이크 사용 중이면 버튼만)
function kkAskVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, ss = window.speechSynthesis;
    if (!SR || !ss || ss.speaking || (typeof famRec !== 'undefined' && famRec)) return;
    const u = new SpeechSynthesisUtterance((document.getElementById('kk-pop')?.dataset.what || '카톡') + '가 왔습니다. 읽어드릴까요?'); u.lang = 'ko-KR';
    u.onend = () => {
        if (document.getElementById('kk-pop')?.style.display !== 'flex') return;
        const r = new SR(); kkRec = r; r.lang = 'ko-KR'; r.interimResults = false;
        const mic = document.getElementById('kk-mic'); if (mic) mic.textContent = '🎤 듣는 중';
        let said = '';
        r.onresult = e => { said = e.results[0][0].transcript || ''; };
        r.onend = () => {
            kkRec = null; const mc = document.getElementById('kk-mic'); if (mc) mc.textContent = '';
            if (/(네|예|응|어|읽어|그래|좋아|부탁)/.test(said) && !/(아니|싫|됐어|괜찮|나중)/.test(said)) kkYes();
            else if (/(아니|싫|됐어|괜찮|나중|그만)/.test(said)) kkNo();
        };
        r.onerror = () => {};
        try { r.start(); setTimeout(() => { try { r.stop(); } catch (e) {} }, 6000); } catch (e) { kkRec = null; }
    };
    ss.speak(u);
}
// 설정 → 문자·카톡
function kkSetHtml() {
    const N = kkN(); if (!N || !N.kakaoAsk) return '';
    setTimeout(() => N.kakaoAsk({}).then(r => { const c = document.getElementById('kk-on'); if (c) c.checked = !!r.on; }).catch(() => {}), 50);
    return `<label class="fam-chk" style="margin-top:8px"><input type="checkbox" id="kk-on" onchange="kkN().kakaoAsk({on:this.checked});famToast(this.checked?'카톡 오면 읽어드릴지 묻습니다':'묻지 않습니다')"> 받는 카톡방, 연락처에 저장된 사람의 문자가 오면 <b>"읽어드릴까요?"</b> 묻기 <small style="color:#94a3b8">(밤 10시~아침 7시 제외)</small></label>`;
}
(function () {
    const wait = () => { const N = kkN(); if (N && N.addListener) { try { N.addListener('kakaoIn', d => kkPopup(d.room, d.from, d.text, d.n)); } catch (e) {} } };
    window.addEventListener('load', () => setTimeout(wait, 800));
})();
