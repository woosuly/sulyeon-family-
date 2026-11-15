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
    // 음악 재생 중에도 듣기·읽어주기가 되도록 그동안 소리 우선권을 받아 음악을 잠깐 멈춤 (끝나면 다시 재생)
    let afN = 0, afT = null;
    const focus = on => { const S = P.SeolyeonNative; if (!S || !S.audioFocus) return;
        if (on) { afN++; clearTimeout(afT); S.audioFocus({ on: true }).catch(() => {}); }
        else { afN = Math.max(0, afN - 1); clearTimeout(afT); afT = setTimeout(() => { if (!afN) S.audioFocus({ on: false }).catch(() => {}); }, 1200); } };

    // ── 음성 인식 ──
    const SR = P.SpeechRecognition;
    if (SR) {
        // 폰 음성 인식: 말을 다 하면 최종 결과를 한 번에 받는 방식 (갤럭시 기본 인식은 중간 결과를 안 주는 경우가 있음)
        // 응답이 없어도 반드시 꺼지도록 시간 제한과 중지 처리
        // 폰 인식기는 한 번에 하나만 돌 수 있음 → 이전 세션이 끝나지 않았으면 먼저 멈추고 잠깐 기다림
        let active = false, lastEnd = 0;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const busyErr = m => /busy|already|in progress|not ready|\b(5|8)\b|client/i.test(m);
        class NativeSR {
            constructor() { this.lang = 'ko-KR'; this.interimResults = true; this.continuous = false; this._done = true; this._t = null; this._sub = null; }
            _fire(text, final) {
                if (!this.onresult || !text) return;
                const alt = { transcript: text, confidence: 1 }, res = [alt]; res.isFinal = final;
                this.onresult({ results: [res], resultIndex: 0 });
            }
            _end(err) {
                if (this._done) return; this._done = true; if (this._af) { this._af = false; focus(false); }
                clearTimeout(this._t); if (this._sub) { try { this._sub.remove(); } catch (e) {} this._sub = null; }
                if (err && this.onerror) this.onerror({ error: err });
                if (this.onend) this.onend();
            }
            async _listen() {
                active = true;
                try { return await SR.start({ language: this.lang || 'ko-KR', maxResults: 1, partialResults: false, popup: false }); }   // true면 결과를 기다리지 않고 바로 끝나 버림
                finally { active = false; lastEnd = Date.now(); }
            }
            // 이어 듣기: 폰 인식기는 1~2초만 쉬어도 끝내 버림 → 결과가 나오면 바로 다시 들어 말을 이어 붙임
            //   다시 들을 때 말이 없으면 폰 인식기가 스스로 '말 없음'으로 끝냄(몇 초) → 그때 마침. 최대 4번 이어 붙임
            async _more(acc) {
                for (let k = 0; k < 4 && !this._done && !this._stopReq; k++) {
                    await sleep(Math.max(0, 250 - (Date.now() - lastEnd)));
                    if (this._done || this._stopReq) break;
                    const g = setTimeout(() => SR.stop().catch(() => {}), 12000);   // 혹시 안 끝나면 12초에 멈춤
                    let r = null;
                    try { r = await this._listen(); } catch (e) { r = null; }
                    clearTimeout(g);
                    const t = r && r.matches && r.matches[0];
                    if (!t) break;
                    acc = (acc + ' ' + t).trim(); this._fire(acc, false);
                }
                return acc;
            }
            async start() {
                if (!this._done) return;
                this._done = false;
                try {
                    let pm = await SR.checkPermissions().catch(() => ({}));
                    if (pm.speechRecognition !== 'granted') pm = await SR.requestPermissions().catch(() => ({}));
                    if (pm.speechRecognition !== 'granted') return this._end('not-allowed');
                    // 읽어주기 중이면 끔 (스피커 소리를 인식하거나 마이크를 못 잡는 경우 방지)
                    try { if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch (e) {}
                    // 이전 인식이 아직 돌거나 방금 끝났으면 정리 후 시작
                    if (active) { await SR.stop().catch(() => {}); await sleep(400); }
                    else if (Date.now() - lastEnd < 400) await sleep(400 - (Date.now() - lastEnd));
                    if (this._done) return;
                    this._af = true; focus(true); await sleep(250);   // 음악이 멈출 틈
                    if (this._done) return;
                    try { this._sub = await SR.addListener('partialResults', d => { const t = (d.matches || [])[0]; if (t && this.interimResults) this._fire(t, false); }); } catch (e) {}
                    if (this.onstart) this.onstart();
                    this._stopReq = false;
                    this._t = setTimeout(() => { SR.stop().catch(() => {}); this._end('no-speech'); }, 15000);   // 15초 안에 결과가 없으면 끔
                    let r;
                    try { r = await this._listen(); }
                    catch (e) {
                        // 인식기가 바쁘다는 오류는 한 번 멈췄다가 다시 시도
                        if (!busyErr(String(e && e.message || e)) || this._done) throw e;
                        await SR.stop().catch(() => {}); await sleep(600);
                        if (this._done) return;
                        r = await this._listen();
                    }
                    let t = r && r.matches && r.matches[0];
                    if (t && !this._done && !this._stopReq) {
                        clearTimeout(this._t); this._t = setTimeout(() => { this._stopReq = true; SR.stop().catch(() => {}); }, 40000);   // 이어 듣기 전체 40초까지
                        if (this._sub) { try { this._sub.remove(); } catch (e) {} this._sub = null; }   // 첫 세션의 중간 결과 듣기는 끝냄 (이어 듣기는 따로)
                        t = await this._more(t);
                    }
                    if (t) {
                        this._fire(t, true);
                        // 중지 버튼으로 먼저 끝난 뒤 결과가 늦게 오면 화면 상태만 다시 맞춤
                        if (this._done) { if (this.onend) this.onend(); return; }
                    }
                    this._end(t ? null : 'no-speech');
                } catch (e) {
                    const m = String(e && e.message || e);
                    this._end(/permission|denied/i.test(m) ? 'not-allowed' : /network|server/i.test(m) ? 'network' : 'no-speech');
                }
            }
            // 중지: 말이 끝난 것으로 보고 결과를 기다림 (2.5초 안에 안 오면 끔)
            stop() { this._stopReq = true; SR.stop().catch(() => {}); clearTimeout(this._t); this._t = setTimeout(() => this._end(), 2500); }
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
        const finish = (u) => { if (!u || u !== cur) return; clearTimeout(timer); cur = null; ss.speaking = false; focus(false); if (u.onend) try { u.onend({}); } catch (e) {} };
        if (N.addListener) N.addListener('ttsDone', d => { if (cur && d && d.id === cur._id) finish(cur); });
        const ss = {
            speaking: false, pending: false, paused: false,
            getVoices: () => [],
            speak(u) {
                if (cur) this.cancel();
                cur = u; u._id = 'u' + (++seq); this.speaking = true; focus(true);
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
