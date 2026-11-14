// ═══════════════════════════════════════════════════════════
// 🏠 스마트싱스: 집 기기 제어 (서버 stApi를 거쳐 호출, 토큰은 서버에만)
//   "에어컨 켜줘", "거실 불 꺼줘", "외출 모드 실행", "집 상태 알려줘"
//   끄기·장면은 바로 실행, 켜기·문 열기·온도 변경 등은 확인 후 실행
// ═══════════════════════════════════════════════════════════
const ST_FN = 'https://asia-northeast3-seolyeon-family-seoul.cloudfunctions.net/';
let stDevices = null, stScenes = null, stLinked = null;
async function stCall(fn, body) {
    const u = firebase.auth().currentUser; if (!u) throw new Error('로그인이 필요합니다');
    const r = await fetch(ST_FN + fn, { method: 'POST', headers: { authorization: 'Bearer ' + await u.getIdToken(), 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({ error: '서버 응답 오류 (' + r.status + ')' }));
    if (!r.ok || j.error) throw new Error(j.error || r.status);
    return j;
}
const stApi = b => stCall('stApi', b);

// ── 연결 (설정 → 비서) ──
function stSetHtml() {
    return `<span class="fam-lbl">스마트싱스 (집 기기 제어)</span>
        <div id="st-state" class="fam-note" style="margin:0 0 6px">확인 중…</div>
        <div class="fam-btns" style="margin-top:0"><button class="fam-btn" onclick="stConnectForm()">연결하기</button><button class="fam-btn" onclick="famCloseSettings();stOpen()">기기 보기</button></div>`;
}
async function stStateRefresh() {
    const el = document.getElementById('st-state'); if (!el) return;
    try { const s = await stApi({ op: 'status' }); stLinked = s.linked; el.innerHTML = s.linked ? `<b>연결됨</b> · ${new Date(s.linkedAt).toLocaleDateString('ko-KR')}` : '연결 안 됨'; }
    catch (e) { el.textContent = /Failed to fetch|404|응답/.test(e.message) ? '서버 배포 후 쓸 수 있습니다' : e.message; }
}
function stConnectForm() {
    famSheet(`<div class="fam-h"><b>스마트싱스 연결</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:0 0 8px">
        ① 아래 버튼으로 토큰 페이지를 열고 삼성 계정으로 로그인<br>
        ② <b>새 토큰 생성</b> → 이름 아무거나 → 권한은 <b>기기(Devices)·장면(Scenes)·위치(Locations)</b> 전부 체크 → 생성<br>
        ③ 나온 토큰을 복사해 아래 칸에 붙여넣고 <b>연결</b><br>
        ④ 삼성 로그인 화면이 뜨면 <b>허용</b> → "연결 완료"가 보이면 앱으로 돌아오기<br>
        <small>토큰은 하루 뒤 만료되지만, 연결 후에는 서버가 오래 쓰는 열쇠로 바꿔 보관합니다.</small></div>
        <div class="fam-btns" style="margin-top:0"><button class="fam-btn" onclick="ytOpen('https://account.smartthings.com/tokens','')">토큰 페이지 열기</button></div>
        <div class="ff-form"><div class="full"><label>토큰</label><input id="st-pat" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="붙여넣기"></div></div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="stConnect(this)">연결</button></div>`);
}
async function stConnect(btn) {
    const pat = document.getElementById('st-pat').value.trim(); if (!pat) return famToast('토큰을 붙여넣어 주세요');
    btn.disabled = true; btn.textContent = '등록 중…';
    try { const r = await stCall('stSetup', { pat }); famSheetClose(); famToast('삼성 계정 화면에서 허용을 눌러 주세요'); ytOpen(r.url, ''); }
    catch (e) { famToast('연결 실패: ' + e.message); btn.disabled = false; btn.textContent = '연결'; }
}

// ── 기기 목록·제어 ──
const stIcon = d => /에어컨|air|ac/i.test(d.name) ? '❄️' : /불|조명|light|lamp|전등/i.test(d.name) ? '💡' : /tv|티비/i.test(d.name) ? '📺' : /세탁|건조/i.test(d.name) ? '🧺' : /청소|로봇/i.test(d.name) ? '🧹' : /냉장/i.test(d.name) ? '🧊' : /도어|문|lock/i.test(d.name) ? '🚪' : '🔌';
function stLine(d) {
    const s = [];
    if (d.on != null) s.push(d.on ? '켜짐' : '꺼짐');
    if (d.mode) s.push(d.mode); if (d.set != null) s.push('설정 ' + d.set + '°'); if (d.temp != null) s.push('현재 ' + d.temp + '°');
    if (d.contact) s.push(d.contact === 'open' ? '열림' : '닫힘'); if (d.lock) s.push(d.lock === 'locked' ? '잠김' : '열림');
    return s.join(' · ');
}
async function stLoad(force) {
    if (stDevices && !force) return;
    const [a, b] = await Promise.all([stApi({ op: 'devices' }), stApi({ op: 'scenes' }).catch(() => ({ scenes: [] }))]);
    stDevices = a.devices || []; stScenes = b.scenes || [];
}
async function stOpen() {
    famSheet(`<div class="fam-h"><b>집 기기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note"><span class="fam-spin"></span> 불러오는 중…</div>`);
    try { await stLoad(true); stRender(); }
    catch (e) { famSheet(`<div class="fam-h"><b>집 기기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note">${famEsc(e.message)}</div><div class="fam-btns"><button class="fam-btn" onclick="stConnectForm()">연결하기</button></div>`); }
}
function stRender() {
    famSheet(`<div class="fam-h"><b>집 기기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        ${stScenes.length ? `<span class="fam-lbl" style="margin-top:0">장면</span><div class="fam-btns" style="margin-top:0;flex-wrap:wrap">${stScenes.map(s => `<button class="fam-btn" onclick="stScene('${s.id}',this)">${famEsc(s.name)}</button>`).join('')}</div>` : ''}
        <span class="fam-lbl">기기 ${stDevices.length}개</span>
        ${stDevices.map(d => `<div class="ag-li"><span style="font-size:18px">${stIcon(d)}</span><b>${famEsc(d.name)}<br><small style="color:#64748b;font-weight:500">${famEsc(stLine(d))}</small></b>
            ${d.caps.includes('switch') ? `<button class="fam-btn ${d.on ? 'pri' : ''}" style="padding:5px 12px;font-size:12px" onclick="stSwitch('${d.id}',${!d.on},this)">${d.on ? '끄기' : '켜기'}</button>` : ''}</div>`).join('') || '<div class="fam-note">기기가 없습니다.</div>'}
        <div class="fam-btns"><button class="fam-btn" onclick="stOpen()">새로고침</button></div>`);
}
async function stSwitch(id, on, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try { await stApi({ op: 'cmd', id, capability: 'switch', command: on ? 'on' : 'off' }); const d = stDevices.find(x => x.id === id); if (d) d.on = on; famToast(`${d ? d.name : '기기'} ${on ? '켰습니다' : '껐습니다'}`); if (document.getElementById('fam-sheet').style.display === 'flex') stRender(); }
    catch (e) { famToast('실패: ' + e.message); if (btn) { btn.disabled = false; btn.textContent = on ? '켜기' : '끄기'; } }
}
async function stScene(id, btn) { try { if (btn) btn.disabled = true; await stApi({ op: 'scene', id }); famToast('장면을 실행했습니다'); } catch (e) { famToast('실패: ' + e.message); } if (btn) btn.disabled = false; }

// ── 말로 제어: AI가 기기·명령을 골라 줌 ──
async function stVoice(text) {
    const c = famFeedAdd('<span class="fam-spin"></span>집 기기 확인 중…');
    try {
        await stLoad(false);
        const list = stDevices.map((d, i) => `${i}. ${d.name} [${d.caps.join(',')}] ${stLine(d)}`).join('\n'), sc = stScenes.map((s, i) => `S${i}. ${s.name}`).join('\n');
        const r = await famCallAI(`스마트싱스 집 기기 제어 요청을 해석해 JSON만 출력.
{"act":"cmd|scene|status","dev":기기번호 또는 null,"scene":"S번호" 또는 null,"capability":"switch|thermostatCoolingSetpoint|airConditionerMode|audioVolume 등","command":"on|off|setCoolingSetpoint|setAirConditionerMode 등","args":[],"say":"사용자에게 할 한 줄 (예: 거실 에어컨을 24도로 켤게요)"}
- 기기 목록에 있는 capability만 사용. 상태를 묻는 말이면 act=status, say에 목록 기준 상태 요약.
- 장면 이름과 맞으면 act=scene.`, `기기:\n${list}\n장면:\n${sc || '없음'}\n\n요청: ${text}`, { maxTokens: 400 });
        const j = JSON.parse((String(r.text).match(/\{[\s\S]*\}/) || ['{}'])[0]);
        if (j.act === 'status' || (!j.capability && j.act !== 'scene')) { c.innerHTML = '🏠 ' + famEsc(j.say || stDevices.map(d => d.name + ' ' + stLine(d)).join(', ')); return; }
        if (j.act === 'scene') { const s = stScenes[+String(j.scene).replace('S', '')]; if (!s) throw new Error('장면을 찾지 못했습니다'); await stApi({ op: 'scene', id: s.id }); c.innerHTML = `🏠 <b>${famEsc(s.name)}</b> 장면을 실행했습니다.`; return; }
        const d = stDevices[+j.dev]; if (!d) throw new Error('기기를 찾지 못했습니다');
        const safe = j.command === 'off' || (j.capability === 'lock' && j.command === 'lock');
        window._stPend = { id: d.id, capability: j.capability, command: j.command, args: j.args || [], name: d.name };
        if (safe) return stDo(c);
        c.innerHTML = `🏠 ${famEsc(j.say || d.name + ' ' + j.command)}<div class="fam-btns"><button class="fam-btn pri" onclick="stDo(this.closest('.ff-card')||this.parentElement.parentElement)">실행</button><button class="fam-btn" onclick="this.closest('.ff-card').innerHTML='취소했습니다'">취소</button></div>`;
    } catch (e) { c.innerHTML = '🏠 ' + famEsc(e.message) + (/연결/.test(e.message) ? ' <button class="fam-btn" onclick="stConnectForm()">연결하기</button>' : ''); }
}
async function stDo(c) {
    const p = window._stPend; if (!p) return;
    try { await stApi({ op: 'cmd', ...p }); c.innerHTML = `🏠 <b>${famEsc(p.name)}</b> — 완료했습니다.`; const d = (stDevices || []).find(x => x.id === p.id); if (d && p.capability === 'switch') d.on = p.command === 'on'; }
    catch (e) { c.innerHTML = '🏠 실패: ' + famEsc(e.message); }
}
function iotRoute(t) {
    if (/(에어컨|불|조명|전등|티비|TV|tv|공기청정기|청정기|제습기|가습기|선풍기|보일러|세탁기|건조기|로봇청소기|청소기|플러그|커튼|스마트싱스|외출\s*모드|귀가\s*모드|취침\s*모드|집\s*상태)/.test(t) &&
        /(켜|꺼|틀어|끄|온도|도로|낮춰|올려|실행|모드|상태|돌려|멈춰|열어|닫아|어때)/.test(t)) { stVoice(t); return true; }
    return false;
}
