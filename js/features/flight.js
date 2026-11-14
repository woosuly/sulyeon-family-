// ═══════════════════════════════════════════════════════════
// ✈️ 항공권 가격 지켜보기
//   flightWatch/{id} {dest, from, when, nights, pax, target, by, last:{low,airline,note,src,at}, hist:[{at,low}]}
//   서버(functions/agent.js runFlights)가 월요일 09:00마다 AI 웹검색으로 1인 왕복 가격을 확인
//   지난번보다 10% 이상 내리거나 목표가 이하면 알림. '지금 확인'은 바로 조회.
//   무료 항공권 API가 없어 검색 결과 기준 참고 가격 (예약 사이트 최저가와 다를 수 있음)
// ═══════════════════════════════════════════════════════════
let flWatch = [];
const flW = n => n ? Math.round(n).toLocaleString('ko-KR') + '원' : '-';
function flListen() { try { db.collection('flightWatch').onSnapshot(s => { flWatch = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0)); const sh = document.getElementById('fam-sheet'); if (document.getElementById('fl-sheet') && sh && sh.style.display === 'flex') flOpen(); }, () => {}); } catch (e) {} }

function flSpark(h) {
    const v = (h || []).filter(x => x.low > 0); if (v.length < 2) return '';
    const mx = Math.max(...v.map(x => x.low)), mn = Math.min(...v.map(x => x.low)), W = 90, H = 22;
    const pts = v.map((x, i) => `${Math.round(i / (v.length - 1) * W)},${Math.round(H - 2 - (mx === mn ? .5 : (x.low - mn) / (mx - mn)) * (H - 4))}`).join(' ');
    return `<svg width="${W}" height="${H}" style="vertical-align:middle"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
function flOpen() {
    famSheet(`<div class="fam-h" id="fl-sheet"><b>✈️ 항공권 지켜보기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        ${flWatch.length ? flWatch.map(w => {
            const l = w.last || {}, prev = (w.hist || []).filter(x => x.low > 0).slice(-2, -1)[0];
            return `<div class="fam-box" style="margin:0 0 8px;padding:10px 12px">
                <div style="display:flex;align-items:center;gap:6px"><b style="flex:1">${famEsc(w.from || '인천')} → ${famEsc(w.dest)}</b><small style="color:#64748b">${famEsc(w.when || '')}${w.nights ? ' · ' + w.nights + '박' : ''} · ${w.pax || 2}명</small></div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:4px"><span style="font-size:17px;font-weight:800">${l.low ? '1인 ' + flW(l.low) : (l.at ? '가격 못 찾음' : '확인 전')}</span>
                    ${prev && l.low ? `<small style="color:${l.low < prev.low ? '#047857' : l.low > prev.low ? '#b91c1c' : '#64748b'}">${l.low < prev.low ? '▼' : l.low > prev.low ? '▲' : ''}${flW(Math.abs(l.low - prev.low))}</small>` : ''}
                    <span style="margin-left:auto;color:#64748b">${flSpark(w.hist)}</span></div>
                ${l.at ? `<div class="fam-note" style="margin:4px 0 0">${famEsc([l.airline, l.note].filter(Boolean).join(' · '))}<br><small>${new Date(l.at).toLocaleDateString('ko-KR')} 확인${l.src ? ' · ' + famEsc(l.src) : ''}${w.target ? ' · 목표 ' + flW(w.target) : ''}</small></div>` : ''}
                <div class="fam-btns" style="margin-top:6px"><button class="fam-btn" onclick="flNow('${w.id}',this)">지금 확인</button><button class="fam-btn" onclick="flSearch('${w.id}')">검색 열기</button><button class="fam-btn" onclick="flForm('${w.id}')">수정</button></div>
            </div>`;
        }).join('') : '<div class="fam-note">가고 싶은 여행지를 넣어 두면 매주 월요일 아침 가격을 확인해, 많이 내리거나 목표가 아래로 오면 알려 드립니다.</div>'}
        <div class="fam-note">AI가 웹검색으로 찾은 참고 가격입니다. 예약 전에는 [검색 열기]로 실제 가격을 확인하세요.</div>
        <div class="fam-btns"><button class="fam-btn pri" onclick="flForm()">＋ 여행지 추가</button></div>`);
}
function flForm(id) {
    const w = flWatch.find(x => x.id === id) || { from: '인천', pax: 2 };
    famSheet(`<div class="fam-h"><b>${id ? '수정' : '여행지 추가'}</b><button class="fam-x" onclick="flOpen()">✕</button></div>
        <div class="ff-form">
            <div><label>출발</label><input id="fl-from" value="${famEsc(w.from || '인천')}" placeholder="인천·청주·김포"></div>
            <div><label>도착</label><input id="fl-dest" value="${famEsc(w.dest || '')}" placeholder="예: 로마, 다낭"></div>
            <div class="full"><label>여행 시기</label><input id="fl-when" value="${famEsc(w.when || '')}" placeholder="예: 2027년 5월 초, 추석 연휴"></div>
            <div><label>몇 박</label><input id="fl-nights" type="number" inputmode="numeric" value="${w.nights || ''}" placeholder="7"></div>
            <div><label>인원</label><input id="fl-pax" type="number" inputmode="numeric" value="${w.pax || 2}"></div>
            <div class="full"><label>목표가 (1인 왕복, 선택)</label><input id="fl-target" inputmode="numeric" value="${w.target || ''}" placeholder="이 가격 이하면 알림"></div>
        </div>
        <div class="fam-btns">${id ? `<button class="fam-btn" onclick="flDel('${id}')">삭제</button>` : ''}<button class="fam-btn pri" onclick="flSave('${id || ''}',this)">저장${id ? '' : ' · 바로 확인'}</button></div>`);
}
async function flSave(id, btn) {
    const g = k => document.getElementById('fl-' + k).value.trim();
    const v = { from: g('from') || '인천', dest: g('dest'), when: g('when'), nights: +g('nights') || 0, pax: +g('pax') || 2, target: +g('target').replace(/[^\d]/g, '') || 0 };
    if (!v.dest) return famToast('도착지를 넣어 주세요');
    btn.disabled = true;
    try {
        if (id) await db.collection('flightWatch').doc(id).update(v);
        else { id = 'fl_' + Date.now(); await db.collection('flightWatch').doc(id).set({ id, ...v, by: famUser(), at: Date.now(), hist: [] }); await flNow(id); }
        flOpen();
    } catch (e) { btn.disabled = false; famToast(e.message); }
}
async function flNow(id, btn) {
    if (btn) btn.disabled = true;
    await db.collection('briefReq').add({ owner: famUser(), type: 'flight', fid: id, at: Date.now() });
    famToast('가격 확인 중… 1분 안에 알림이 옵니다');
}
function flSearch(id) {
    const w = flWatch.find(x => x.id === id); if (!w) return;
    const url = 'https://www.google.com/travel/flights?q=' + encodeURIComponent(`${w.from || '인천'}에서 ${w.dest} 왕복 항공권 ${w.when || ''}`);
    const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    if (N && N.openUrl) N.openUrl({ url, pkg: '' }); else window.open(url, '_blank');
}
async function flDel(id) { if (!confirm('지울까요?')) return; await db.collection('flightWatch').doc(id).delete().catch(() => {}); flOpen(); }

(function () { famAuthGate(() => setTimeout(flListen, 1700)); })();
