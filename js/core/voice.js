// ═══════════════════════════════════════════════════════════
// 🎤🔊 안드로이드 앱 음성 연결
//  앱 안 웹화면(WebView)에는 브라우저의 음성 인식·읽어주기가 없어서
//  폰의 음성 인식(SpeechRecognition 플러그인)과 읽어주기(SeolyeonNative.speak)로 대신함.
//  window.SpeechRecognition / window.speechSynthesis 와 같은 모양으로 만들어
//  홈 비서·통역·채팅의 기존 마이크·스피커 버튼이 그대로 동작.
//  (다른 스크립트보다 먼저 불러와야 함)
// ═══════════════════════════════════════════════════════════
(function () {
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
    const P = (C.Plugins || {});

    // ── 음성 인식 ──
    const SR = P.SpeechRecognition;
    if (SR) {
        // 폰 음성 인식: 말을 다 하면 최종 결과를 한 번에 받는 방식 (갤럭시 기본 인식은 중간 결과를 안 주는 경우가 있음)
        // 응답이 없어도 반드시 꺼지도록 시간 제한과 중지 처리
        class NativeSR {
            constructor() { this.lang = 'ko-KR'; this.interimResults = true; this.continuous = false; this._done = true; this._t = null; this._sub = null; }
            _fire(text, final) {
                if (!this.onresult || !text) return;
                const alt = { transcript: text, confidence: 1 }, res = [alt]; res.isFinal = final;
                this.onresult({ results: [res], resultIndex: 0 });
            }
            _end(err) {
                if (this._done) return; this._done = true;
                clearTimeout(this._t); if (this._sub) { try { this._sub.remove(); } catch (e) {} this._sub = null; }
                if (err && this.onerror) this.onerror({ error: err });
                if (this.onend) this.onend();
            }
            async start() {
                if (!this._done) return;
                this._done = false;
                try {
                    let pm = await SR.checkPermissions().catch(() => ({}));
                    if (pm.speechRecognition !== 'granted') pm = await SR.requestPermissions().catch(() => ({}));
                    if (pm.speechRecognition !== 'granted') return this._end('not-allowed');
                    // 중간 결과가 오면 입력창에 미리 보여 줌 (안 와도 동작)
                    try { this._sub = await SR.addListener('partialResults', d => { const t = (d.matches || [])[0]; if (t && this.interimResults) this._fire(t, false); }); } catch (e) {}
                    if (this.onstart) this.onstart();
                    this._t = setTimeout(() => { SR.stop().catch(() => {}); this._end('no-speech'); }, 15000);   // 15초 안에 결과가 없으면 끔
                    const r = await SR.start({ language: this.lang || 'ko-KR', maxResults: 1, partialResults: false, popup: false });
                    const t = r && r.matches && r.matches[0];
                    if (t) this._fire(t, true);
                    this._end(t ? null : 'no-speech');
                } catch (e) {
                    const m = String(e && e.message || e);
                    this._end(/permission|denied/i.test(m) ? 'not-allowed' : /match|speech|7|6/i.test(m) ? 'no-speech' : 'network');
                }
            }
            // 중지: 폰 응답을 기다리지 않고 바로 끔 (마지막 결과가 오면 그것까지 반영)
            stop() { SR.stop().catch(() => {}); clearTimeout(this._t); this._t = setTimeout(() => this._end(), 1200); }
            abort() { SR.stop().catch(() => {}); this._end(); }
        }
        window.SpeechRecognition = NativeSR;
        window.webkitSpeechRecognition = NativeSR;
    }

    // ── 읽어주기 ──
    const N = P.SeolyeonNative;
    if (N && N.speak) {
        if (typeof window.SpeechSynthesisUtterance !== 'function') {
            window.SpeechSynthesisUtterance = function (text) { this.text = text || ''; this.lang = 'ko-KR'; this.rate = 1; this.pitch = 1; this.voice = null; };
        }
        let cur = null, timer = null, seq = 0;
        const finish = (u) => { if (!u || u !== cur) return; clearTimeout(timer); cur = null; ss.speaking = false; if (u.onend) try { u.onend({}); } catch (e) {} };
        if (N.addListener) N.addListener('ttsDone', d => { if (cur && d && d.id === cur._id) finish(cur); });
        const ss = {
            speaking: false, pending: false, paused: false,
            getVoices: () => [],
            speak(u) {
                if (cur) this.cancel();
                cur = u; u._id = 'u' + (++seq); this.speaking = true;
                const lang = (u.voice && u.voice.lang) || u.lang || 'ko-KR', rate = Math.max(.5, Math.min(1.6, (u.rate || 1) * .95));
                N.speak({ text: String(u.text || ''), lang, rate, id: u._id }).then(() => { if (u.onstart) try { u.onstart({}); } catch (e) {} })
                    .catch(() => { finish(u); if (u.onerror) try { u.onerror({ error: 'synthesis-failed' }); } catch (e) {} });
                // 끝났다는 신호가 안 오는 예전 앱 대비: 글자 수로 대략 계산해 끝 처리
                clearTimeout(timer); timer = setTimeout(() => finish(u), 1500 + String(u.text || '').length * 220 / rate);
            },
            cancel() { const u = cur; N.stopSpeak && N.stopSpeak().catch(() => {}); if (u) finish(u); },
            pause() {}, resume() {},
            addEventListener() {}, removeEventListener() {}
        };
        try { Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true }); } catch (e) { window.speechSynthesis = ss; }
    }
})();
