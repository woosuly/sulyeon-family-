// ═══════════════════════════════════════════════════════════
// 🪪 생활 서류 만료: 여권 · 운전면허 · 건강검진 · 보험 갱신 등
//   lifeDocs/{id} {name, owner(정우설|한미연|공통), expire(YYYY-MM-DD), note, at}
//   저장하면 90일·30일·7일 전 09:00 알림 (비서 리마인더)
//   해외여행 계획이 여권 만료 6개월 안쪽이면 경고 (입국 요건)
//   (자동차 보험·검사는 '차량' 칸에서 따로 관리)
// ═══════════════════════════════════════════════════════════
let lifeDocs = [];
const DOC_KINDS = ['여권', '운전면허 갱신', '국가건강검진', '실손보험 갱신', '국제운전면허', '비자·ESTA', '신용카드 유효기간', '기타'];
const DOC_AHEAD = [90, 30, 7];
const docDays = d => Math.ceil((new Date(d + 'T00:00:00') - new Date(famYmd(new Date()) + 'T00:00:00')) / 864e5);
const docDday = d => { const n = docDays(d); return n === 0 ? '오늘' : n > 0 ? `D-${n}` : `${-n}일 지남`; };

function docListen() { try { db.collection('lifeDocs').onSnapshot(s => { lifeDocs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.expire).localeCompare(String(b.expire))); docRender(); }, () => {}); } catch (e) {} }

// 여권 만료 6개월 안쪽에 출발하는 해외여행
function docPassportWarn() {
    let all = []; try { all = planData || []; } catch (e) {}
    const today = famYmd(new Date()), trips = all.filter(p => p.mType === '해외' && p.start >= today);
    const out = [];
    lifeDocs.filter(d => d.name === '여권' && d.expire).forEach(d => trips.forEach(p => {
        const who = d.owner === '공통' || !p.member || p.member === '공통' || p.member === d.owner;
        const lim = new Date(d.expire + 'T00:00:00'); lim.setMonth(lim.getMonth() - 6);
        if (who && p.start >= famYmd(lim)) out.push(`${d.owner} 여권(${d.expire} 만료) — ${p.loc || '해외여행'} ${p.start} 출발: 만료 6개월 안쪽이라 입국이 막힐 수 있습니다`);
    }));
    return out;
}

function docRender() {
    const el = document.getElementById('doc-box'); if (!el) return;
    const warn = docPassportWarn();
    el.innerHTML = (warn.length ? warn.map(w => `<div class="fam-note" style="margin:0 0 6px;color:#b91c1c">⚠️ ${famEsc(w)}</div>`).join('') : '') +
        (lifeDocs.length ? lifeDocs.map(d => {
            const n = docDays(d.expire), c = n < 0 ? '#b91c1c' : n <= 30 ? '#c2410c' : n <= 90 ? '#a16207' : '#64748b';
            return `<div class="ag-li" onclick="docForm('${d.id}')" style="cursor:pointer"><span>${famEsc(d.owner || '')}</span><b>${famEsc(d.name)}${d.note ? `<br><small style="color:#64748b;font-weight:500">${famEsc(d.note)}</small>` : ''}</b><span style="color:${c};font-weight:700">${docDday(d.expire)}</span></div>`;
        }).join('') : '<div class="fam-note" style="margin:0">여권·운전면허 갱신일·건강검진 등을 넣어 두면 90일·30일·7일 전에 알려 드립니다.</div>');
}

function docForm(id) {
    const d = lifeDocs.find(x => x.id === id) || { name: '여권', owner: famUser() || '정우설', expire: '', note: '' };
    const me = d.owner;
    famSheet(`<div class="fam-h"><b>${id ? '서류 수정' : '서류 추가'}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="ff-form">
            <div><label>종류</label><select id="doc-name">${DOC_KINDS.map(k => `<option${k === d.name ? ' selected' : ''}>${k}</option>`).join('')}${DOC_KINDS.includes(d.name) ? '' : `<option selected>${famEsc(d.name)}</option>`}</select></div>
            <div><label>누구</label><select id="doc-owner">${['정우설', '한미연', '공통'].map(k => `<option${k === me ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
            <div class="full"><label>만료·갱신 기한</label><input type="date" id="doc-expire" value="${d.expire || ''}"></div>
            <div class="full"><label>메모 (선택)</label><input id="doc-note" value="${famEsc(d.note || '')}" placeholder="예: 여권번호 끝 4자리, 보험사, 검진 병원"></div>
        </div>
        <div class="fam-btns" style="margin-top:4px"><label class="fam-btn" style="cursor:pointer">📷 사진·캡처로 채우기<input type="file" accept="image/*" style="display:none" onchange="docFromImg(this)"></label></div>
        <div class="fam-note">여권 사진면, 면허증 뒷면, 검진 안내문, 보험 갱신 안내 캡처를 올리면 종류·기한을 읽어 채웁니다. 여권·면허 번호는 저장하지 않습니다.</div>
        <div class="fam-note">국가건강검진은 출생 연도 짝·홀수에 맞는 해의 12월 31일까지입니다. 운전면허는 면허증 뒷면 '적성검사(갱신) 기간' 끝 날짜를 넣으세요.</div>
        <div class="fam-btns">${id ? `<button class="fam-btn" onclick="docDel('${id}')">삭제</button>` : ''}<button class="fam-btn pri" onclick="docSave('${id || ''}',this)">저장 (알림 함께)</button></div>`);
}
// 사진·캡처 → 종류·기한·누구 읽어서 양식 채움 (번호 같은 식별정보는 메모에 넣지 않음)
async function docFromImg(input) {
    const f = (input.files || [])[0]; input.value = ''; if (!f) return;
    const lbl = input.parentElement, old = lbl.firstChild.textContent; lbl.firstChild.textContent = '읽는 중… ';
    try {
        const data = await famImgToB64(f, 1600);
        const r = await famCallAI('너는 신분증·서류·안내문 이미지에서 만료일·갱신 기한을 읽는 도우미다. 이미지에 보이는 내용만 쓴다. JSON만 출력.',
            `오늘은 ${famYmd(new Date())}. 가족: 정우설(JEONG WOO SEOL), 한미연(HAN MI YEON).
{"name":"${DOC_KINDS.join('|')} 중 하나 (맞는 게 없으면 짧은 이름)","expire":"YYYY-MM-DD (여권은 기간만료일, 운전면허는 적성검사·갱신 기간의 마지막 날, 검진은 수검 기한, 보험은 만기·갱신일)","owner":"정우설|한미연|공통 (이미지의 이름으로 판단, 모르면 빈칸)","note":"짧은 메모 (발급기관·보험사·병원 등). 여권번호·면허번호·주민번호 등 번호는 절대 쓰지 않음"}`,
            { image: { mime: 'image/jpeg', data }, maxTokens: 400 });
        const t = r.text || '', j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
        const set = (k, v) => { const el = document.getElementById('doc-' + k); if (!el || !v) return; if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === v)) el.add(new Option(v, v)); el.value = v; };
        set('name', j.name); if (/^\d{4}-\d{2}-\d{2}$/.test(j.expire || '')) set('expire', j.expire); set('owner', j.owner); set('note', String(j.note || '').replace(/[A-Z]{1,2}\d{6,}|\d{2}-\d{2}-\d{6}-\d{2}|\d{6}-\d{7}/g, '').trim());
        famToast(j.expire ? '읽었습니다. 확인 후 저장하세요' : '기한을 찾지 못했습니다. 직접 넣어 주세요');
    } catch (e) { famToast('읽지 못했습니다: ' + e.message); }
    lbl.firstChild.textContent = old;
}
async function docSave(id, btn) {
    const g = k => document.getElementById('doc-' + k).value.trim();
    const v = { name: g('name'), owner: g('owner'), expire: g('expire'), note: g('note'), at: Date.now() };
    if (!v.expire) return famToast('기한 날짜를 넣어 주세요');
    btn.disabled = true;
    try {
        id = id || 'doc_' + Date.now();
        await db.collection('lifeDocs').doc(id).set({ id, ...v });
        await docReminders(id, v);
        famSheetClose(); famToast('저장했습니다. 90·30·7일 전에 알려 드립니다');
    } catch (e) { btn.disabled = false; famToast(e.message); }
}
// 같은 서류의 예전 알림은 지우고 새로 (공통이면 두 사람 모두)
async function docReminders(id, v) {
    const owners = v ? (v.owner === '공통' ? ['정우설', '한미연'] : [v.owner]) : [];
    for (const o of ['정우설', '한미연']) for (const n of DOC_AHEAD) await db.collection('reminders').doc(`${id}_${o}_${n}`).delete().catch(() => {});
    if (!v) return;
    for (const o of owners) for (const n of DOC_AHEAD) {
        const at = new Date(v.expire + 'T09:00:00'); at.setDate(at.getDate() - n);
        if (at.getTime() > Date.now()) await agRemindAdd({ id: `${id}_${o}_${n}`, owner: o, at: at.getTime(), title: `${v.owner === '공통' ? '' : v.owner + ' '}${v.name} ${n}일 남음 (${v.expire.slice(2).replace(/-/g, '.')})`, text: v.note || '', kind: 'doc' });
    }
}
async function docDel(id) {
    if (!confirm('이 서류와 알림을 지울까요?')) return;
    await docReminders(id, null);
    await db.collection('lifeDocs').doc(id).delete().catch(e => famToast(e.message));
    famSheetClose();
}

(function () {
    famAuthGate(() => setTimeout(docListen, 1500));
    // 저축 화면을 열 때마다 다시 그림 (여행 계획이 나중에 불러와져도 여권 경고 반영)
    const ss = window.showSection;
    if (typeof ss === 'function') window.showSection = function (id) { const r = ss.apply(this, arguments); if (id === 'save-section') setTimeout(docRender, 50); return r; };
})();
