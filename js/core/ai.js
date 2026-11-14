    // ═══════════════════════════════════════════════════════════
    // 공통: AI 설정 · 호출
    // ═══════════════════════════════════════════════════════════
    const FAM_MODEL_DEFAULTS = {
        claude: ['claude-sonnet-5-5','claude-opus-5-5','claude-haiku-5-5','claude-fable-5-1'],
        gpt:    ['gpt-5.4-mini','gpt-6-astra','gpt-5.4-nano'],
        gemini: ['gemini-3.6-flash','gemini-3.8-flash','gemini-4-argon','gemini-3.5-flash-lite']
    };
    const FAM_NAMES = { claude:'Claude', gpt:'GPT', gemini:'Gemini' };
    const famEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function famLS(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
    // AI 키: 한 사람이 설정에 넣으면 가족 공유 문서(config/aiShared)에 저장 → 다른 폰은 AI 종류만 고르면 됨
    let famShared = (() => { try { return JSON.parse(famLS('famSharedKeys') || '{}') || {}; } catch (e) { return {}; } })();
    function famLocalKeys() { return (typeof timGetKeys === 'function') ? timGetKeys() : { gemini: famLS('timKey_gemini') || '', claude: famLS('timKey_claude') || '', gpt: famLS('timKey_gpt') || '' }; }
    function famKeys() { const l = famLocalKeys(), o = {}; Object.keys(famShared || {}).forEach(k => { if (typeof famShared[k] === 'string' && !['by'].includes(k)) o[k] = famShared[k]; }); ['gemini', 'claude', 'gpt'].forEach(p => o[p] = famShared[p] || l[p] || ''); return o; }   // 택배·유튜브 등 다른 공유 키도 포함
    (function famSharedListen() {
        try {
            firebase.auth().onAuthStateChanged(u => {
                if (!u) return;
                db.collection('config').doc('aiShared').onSnapshot(d => {
                    famShared = d.exists ? (d.data() || {}) : {};
                    famLS('famSharedKeys', JSON.stringify({ gemini: famShared.gemini || '', claude: famShared.claude || '', gpt: famShared.gpt || '', by: famShared.by || '' }));
                    if (famShared.gemini && typeof _GCLOUD_KEY !== 'undefined') { try { _GCLOUD_KEY = famShared.gemini; } catch (e) {} }
                    const st = document.getElementById('fam-settings-body'); if (st && st.offsetParent) famRenderSettings();
                }, () => {});
                // 이 폰에만 있던 키는 처음 한 번 공유 문서로 올림
                const l = famLocalKeys(), up = {};
                ['gemini', 'claude', 'gpt'].forEach(p => { if (l[p] && !famShared[p]) up[p] = l[p]; });
                if (Object.keys(up).length) db.collection('config').doc('aiShared').set({ ...up, by: famUser(), at: Date.now() }, { merge: true }).catch(() => {});
            });
        } catch (e) {}
    })();
    function famProv() { const p = famLS('famAI_provider'); if (p) return p; const k = famKeys(); return k.claude ? 'claude' : k.gemini ? 'gemini' : k.gpt ? 'gpt' : 'claude'; }
    function famModelList(p) { try { const l = JSON.parse(famLS('famAI_list_' + p) || 'null'); if (l && l.length) return l; } catch (e) {} return FAM_MODEL_DEFAULTS[p]; }
    function famModel(p) { return famLS('famAI_model_' + p) || famModelList(p)[0]; }
    function famSetKey(p, v) {
        v = (v || '').trim();
        famLS('timKey_' + p, v || null);
        if (p === 'gemini' && typeof _GCLOUD_KEY !== 'undefined') { try { _GCLOUD_KEY = v; } catch (e) {} }
        famShared[p] = v;
        clearTimeout(famSetKey._t);
        famSetKey._t = setTimeout(() => { try { db.collection('config').doc('aiShared').set({ [p]: v, by: famUser(), at: Date.now() }, { merge: true }).catch(e => famToast('키 공유 저장 실패: ' + e.message)); } catch (e) {} }, 800);
    }

    async function famCallAI(system, user, opt) {
        opt = opt || {};
        const p = opt.provider || famProv(), key = (famKeys()[p] || '').trim(), model = famModel(p), max = opt.maxTokens || 2500, img = opt.image;
        if (!key) throw new Error(FAM_NAMES[p] + ' API 키가 없습니다. 오른쪽 위 ⚙️ 설정에서 입력하세요.');
        let res, j, sources = [];
        if (p === 'claude') {
            const body = { model, max_tokens: max, system, messages: [{ role: 'user', content: img ? [{ type: img.mime === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: img.mime, data: img.data } }, { type: 'text', text: user }] : user }] };
            if (opt.search) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }];
            res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify(body) });
            j = await res.json(); if (!res.ok) throw new Error(j.error?.message || res.status);
            (j.content || []).forEach(b => {
                if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(r => { if (r.url) sources.push({ url: r.url, title: r.title || r.url }); });
                (b.citations || []).forEach(c => { if (c.url) sources.push({ url: c.url, title: c.title || c.url }); });
            });
            return { text: (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(''), sources };
        }
        if (p === 'gemini') {
            const body = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: img ? [{ inline_data: { mime_type: img.mime, data: img.data } }, { text: user }] : [{ text: user }] }], generationConfig: { maxOutputTokens: max } };
            if (opt.search) body.tools = [{ google_search: {} }];
            res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
            j = await res.json(); if (!res.ok) throw new Error(j.error?.message || res.status);
            const c = j.candidates?.[0];
            (c?.groundingMetadata?.groundingChunks || []).forEach(g => { if (g.web?.uri) sources.push({ url: g.web.uri, title: g.web.title || g.web.uri }); });
            return { text: (c?.content?.parts || []).map(x => x.text || '').join(''), sources };
        }
        // GPT
        if (opt.search) {
            res = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify({ model, input: [{ role: 'system', content: system }, { role: 'user', content: user }], tools: [{ type: 'web_search' }] }) });
            j = await res.json(); if (!res.ok) throw new Error(j.error?.message || res.status);
            let text = j.output_text || '';
            (j.output || []).forEach(o => (o.content || []).forEach(c => { if (!j.output_text && c.text) text += c.text; (c.annotations || []).forEach(a => { if (a.url) sources.push({ url: a.url, title: a.title || a.url }); }); }));
            return { text, sources };
        }
        res = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: img ? [{ type: 'text', text: user }, img.mime === 'application/pdf' ? { type: 'file', file: { filename: img.name || 'document.pdf', file_data: 'data:application/pdf;base64,' + img.data } } : { type: 'image_url', image_url: { url: 'data:' + img.mime + ';base64,' + img.data } }] : user }], max_completion_tokens: max }) });
        j = await res.json(); if (!res.ok) throw new Error(j.error?.message || res.status);
        return { text: j.choices?.[0]?.message?.content || '', sources };
    }
    function famMd(s) {
        let h = famEsc(s);
        h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4} (.+)$/gm, '<b>$1</b>').replace(/^[-*] /gm, '• ').replace(/\n/g, '<br>');
        return h;
    }
    function famToast(t) {
        const d = document.createElement('div');
        d.textContent = t;
        d.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:9999;max-width:88vw;box-shadow:0 8px 24px rgba(0,0,0,.25)';
        document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
    }

    // ═══════════════════════════════════════════════════════════
    // ⚙️ 설정 (테마 + AI)
    // ═══════════════════════════════════════════════════════════
    let famShowKey = false, famCustomModel = false;
    function famOpenSettings() { famCustomModel = false; famRenderSettings(); if (typeof ibStateRefresh === 'function') setTimeout(ibStateRefresh, 50); document.getElementById('fam-settings').style.display = 'flex'; history.pushState({ famSettings: 1 }, '', ''); }
    function famCloseSettings() { document.getElementById('fam-settings').style.display = 'none'; }
    function famThemeMode() { try { return localStorage.getItem('famThemeMode') || 'light'; } catch (e) { return 'light'; } }
    function famApplyTheme() {
        const m = famThemeMode(), dark = m === 'dark' || (m === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
    }
    function famSetThemeMode(m) { try { localStorage.setItem('famThemeMode', m); } catch (e) {} famApplyTheme(); famRenderSettings(); }
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', famApplyTheme); } catch (e) {}
    function famRenderSettings() {
        const p = famProv(), key = famKeys()[p] || '', list = famModelList(p), cur = famModel(p), custom = famCustomModel || !list.includes(cur);
        const fetched = !!famLS('famAI_list_' + p);
        document.getElementById('fam-settings-body').innerHTML = `
            <div class="fam-h"><b>⚙️ 설정</b><button class="fam-x" onclick="famCloseSettings()">✕</button></div>
            <div class="fam-box"><h4>🎨 화면</h4>
                <span class="fam-lbl" style="margin-top:0">화면 모드</span>
                <div class="fam-seg" style="margin-bottom:10px">${[['light', '☀️ 주간'], ['dark', '🌙 야간'], ['auto', '📱 자동']].map(([k, n]) => `<button class="${famThemeMode() === k ? 'on' : ''}" onclick="famSetThemeMode('${k}')">${n}</button>`).join('')}</div>
                <button class="fam-btn" style="width:100%" onclick="famCloseSettings();openThemeColorModal();">앱 테마 색상 변경</button>
            </div>
            <div class="fam-box"><h4>🤖 AI 연결</h4>
                <div class="fam-note" style="margin:0 0 10px">번역, 홈 비서, NEWS, 가계부 분석에 사용됩니다. 키는 한 사람만 넣으면 가족 계정에 저장되어 다른 폰에서도 그대로 씁니다. 다른 폰에서는 사용할 AI만 고르면 됩니다.</div>
                <span class="fam-lbl" style="margin-top:0">사용할 AI</span>
                <div class="fam-seg">${['claude', 'gpt', 'gemini'].map(k => `<button class="${k === p ? 'on' : ''}" onclick="famSetProv('${k}')">${FAM_NAMES[k]}</button>`).join('')}</div>
                <span class="fam-lbl">${FAM_NAMES[p]} API 키</span>
                <input id="fam-key" class="fam-in" type="text" style="${famShowKey ? '' : '-webkit-text-security:disc'}" value="${famEsc(key)}" placeholder="${FAM_NAMES[p]} API 키 붙여넣기" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" oninput="famKeyInput(this.value)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                    <label class="fam-chk" style="border:none;padding:0;background:none"><input type="checkbox" ${famShowKey ? 'checked' : ''} onchange="famShowKey=this.checked;document.getElementById('fam-key').style.webkitTextSecurity=this.checked?'none':'disc'"> 키 보이기</label>
                    <span id="fam-key-st" style="font-size:11px;color:#64748b">${key ? (famShared[p] ? '공유됨' + (famShared.by ? ' · ' + famEsc(famShared.by) + ' 등록' : '') : '입력됨') + ' · 끝자리 ' + famEsc(key.slice(-4)) : '미입력'}</span>
                </div>
                <span class="fam-lbl">${FAM_NAMES[p]} 모델</span>
                <select class="fam-sel" onchange="famPickModel(this.value)">${list.map(m => `<option value="${famEsc(m)}" ${m === cur && !custom ? 'selected' : ''}>${famEsc(m)}</option>`).join('')}<option value="__custom" ${custom ? 'selected' : ''}>직접 입력…</option></select>
                ${custom ? `<input class="fam-in" style="margin-top:8px" value="${famEsc(cur)}" placeholder="모델 ID" autocapitalize="off" autocorrect="off" spellcheck="false" oninput="famLS('famAI_model_${p}',this.value.trim())">` : ''}
                <div class="fam-note">${fetched ? '이 키로 불러온 실제 사용 가능 목록입니다.' : '기본 목록입니다. 키 입력 후 "모델 목록 불러오기"로 최신 목록을 받으세요.'}</div>
                <div class="fam-btns"><button class="fam-btn" onclick="famLoadModels()">모델 목록 불러오기</button><button class="fam-btn" onclick="famTestAI()">연결 테스트</button></div>
            </div>
            ${typeof agSetHtml === 'function' ? agSetHtml() : ''}
            ${typeof ibSetHtml === 'function' ? ibSetHtml() : ''}
            <div class="fam-box"><h4>💾 데이터 백업</h4>
                <div class="fam-note" style="margin:0 0 10px">Firestore 데이터를 파일로 내려받습니다. 월 1회 정도 받아 두세요.</div>
                <div class="fam-btns" style="margin-top:0"><button class="fam-btn pri" onclick="famBackupJSON(this)">전체 백업 (JSON)</button><button class="fam-btn" onclick="famBackupCSV(this)">가계부 (CSV · 엑셀)</button></div>
            </div>`;
    }

    // ═══════════════════════════════════════════════════════════
    // 💾 데이터 백업
    // ═══════════════════════════════════════════════════════════
    const FAM_BACKUP_COLS = ['schedules', 'assets', 'plans', 'albums', 'shoppingList', 'fixedExpenses', 'savingsGoals', 'savingsLogs', 'budgetReports', 'config', 'messages'];
    function famDownload(name, text, mime) {
        // 앱(WebView)에서는 내려받기가 안 되므로 폰 다운로드 폴더에 저장
        if (typeof famSaveFile === 'function' && window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative && Capacitor.Plugins.SeolyeonNative.saveFile) {
            const b64 = btoa(unescape(encodeURIComponent(text))); famSaveFile(name, b64, mime.split(';')[0]); return;
        }
        const blob = new Blob([text], { type: mime }), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    async function famBackupJSON(btn) {
        btn.disabled = true; const old = btn.textContent; btn.textContent = '받는 중…';
        try {
            const out = { app: '설연 Family', version: FAM_VER, exportedAt: new Date().toISOString(), by: famUser(), data: {} };
            for (const c of FAM_BACKUP_COLS) {
                const snap = await db.collection(c).get({ source: 'server' }).catch(() => db.collection(c).get());
                out.data[c] = snap.docs.filter(d => !(c === 'config' && d.id === 'aiShared')).map(d => ({ _id: d.id, ...d.data() }));   // AI 키는 백업 파일에서 제외
            }
            const json = JSON.stringify(out, (k, v) => (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v, 1);
            famDownload(`seolyeon-backup-${famYmd(new Date())}.json`, json, 'application/json');
            famToast('백업 파일을 내려받았습니다 (' + Math.round(json.length / 1024) + 'KB)');
        } catch (e) { famToast('백업 실패: ' + e.message); }
        btn.disabled = false; btn.textContent = old;
    }
    function famBackupCSV() {
        const rows = (typeof anaAll === 'function' ? anaAll() : []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
        if (!rows.length) { famToast('가계부 내역이 없습니다'); return; }
        const q = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
        const csv = ['날짜,구분,분류,금액,구성원,결제,메모', ...rows.map(e => [e.date, e.type, e.category, e.amt, e._m, e.pay || '', e.memo || ''].map(q).join(','))].join('\r\n');
        famDownload(`seolyeon-가계부-${famYmd(new Date())}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
        famToast(rows.length + '건을 내려받았습니다');
    }
    function famSetProv(p) { famLS('famAI_provider', p); famCustomModel = false; famRenderSettings(); }
    function famKeyInput(v) { const p = famProv(); famSetKey(p, v); const st = document.getElementById('fam-key-st'); if (st) st.textContent = v.trim() ? '입력됨 · 끝자리 ' + v.trim().slice(-4) : '미입력'; }
    function famPickModel(v) { const p = famProv(); if (v === '__custom') { famCustomModel = true; famRenderSettings(); return; } famLS('famAI_model_' + p, v); famCustomModel = false; famRenderSettings(); famToast('모델: ' + v); }
    async function famLoadModels() {
        const p = famProv(), key = (famKeys()[p] || '').trim(); if (!key) { famToast('키를 먼저 입력하세요'); return; }
        famToast('모델 목록 불러오는 중…');
        try {
            let ids = [], r, j;
            if (p === 'claude') { r = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }); j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status); ids = (j.data || []).map(x => x.id); }
            else if (p === 'gpt') { r = await fetch('https://api.openai.com/v1/models', { headers: { authorization: 'Bearer ' + key } }); j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status); ids = (j.data || []).map(x => x.id).filter(id => /^(gpt|o\d|chatgpt)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct)/.test(id)).sort().reverse(); }
            else { r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key)); j = await r.json(); if (!r.ok) throw new Error(j.error?.message || r.status); ids = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')).filter(id => /^gemini/.test(id) && !/(embedding|image|tts|audio)/.test(id)).sort().reverse(); }
            if (!ids.length) throw new Error('사용 가능한 모델이 없습니다');
            famLS('famAI_list_' + p, JSON.stringify(ids)); if (!ids.includes(famModel(p))) famLS('famAI_model_' + p, ids[0]);
            famCustomModel = false; famRenderSettings(); famToast(ids.length + '개 모델을 불러왔습니다');
        } catch (e) { famToast('불러오기 실패: ' + e.message); }
    }
    async function famTestAI() { famToast('연결 확인 중…'); try { const r = await famCallAI('짧게 답하라.', '"정상" 한 단어로 답해.', { maxTokens: 50 }); famToast('연결 정상 · ' + (r.text || '').slice(0, 20)); } catch (e) { famToast('실패: ' + e.message); } }

