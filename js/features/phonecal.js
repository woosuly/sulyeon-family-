// ═══════════════════════════════════════════════════════════
// 📆 폰 캘린더 가져오기 (안드로이드 앱): 삼성·구글 등 이 폰에 연결된 캘린더 → 설연 일정
//   · 폰마다 각자: 남편 폰 일정은 '정우설', 와이프 폰 일정은 '한미연'으로 들어감
//   · 한 방향(폰 → 설연). 지난 30일 ~ 앞으로 6개월, 앱을 열 때 맞춤(30분 간격)
//   · 가져올 캘린더는 고를 수 있음 (회사 계정 캘린더는 빼기). 고른 목록은 이 폰에만 저장
//   · 가져온 일정은 schedules/{pc_…} {src:'phone', srcKey, cal}. 수정·삭제는 폰 캘린더에서 (다음 맞춤 때 반영)
// ═══════════════════════════════════════════════════════════
const pcN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
const pcLS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
const pcYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const pcHm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
let pcBusy = false;

function pcSetHtml() {
    const N = pcN(); if (!N || !N.calList) return '';
    const ids = pcLS('pcalIds') || [], last = pcLS('pcalLast');
    return `<div class="fs-row"><div><b>폰 캘린더 가져오기</b><small id="pc-sum">${ids.length ? `캘린더 ${ids.length}개 · ${last ? '마지막 ' + new Date(last.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ` (${last.n}건)` : '아직 안 맞춤'}` : '삼성·구글 캘린더 일정을 설연 달력으로'}</small></div><button class="fam-btn" onclick="pcOpen()">설정</button></div>`;
}
async function pcOpen() {
    const N = pcN(); if (!N || !N.calList) return famToast('설연 앱(APK)에서 됩니다');
    const r = await N.calList({ ask: true }).catch(e => ({ err: e.message }));
    if (!r.granted) return famSheet(`<div class="fam-h"><b>폰 캘린더</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div class="fam-note">캘린더 권한이 없습니다. 폰 설정 → 애플리케이션 → 설연 → 권한 → 캘린더 → 허용 후 다시 눌러 주세요.</div>`);
    const sel = new Set((pcLS('pcalIds') || []).map(String)), cals = r.calendars || [];
    // 계정별로 묶어서 보여 줌
    const byAcc = {}; cals.forEach(c => (byAcc[c.account || '기타'] = byAcc[c.account || '기타'] || []).push(c));
    famSheet(`<div class="fam-h"><b>📆 가져올 캘린더</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:0 0 8px">체크한 캘린더 일정을 설연 달력에 <b>${famEsc(famUser() || '')}</b> 일정으로 넣습니다. 회사 계정 캘린더는 체크하지 마세요. 이 폰에만 저장됩니다.</div>
        <div style="max-height:50vh;overflow-y:auto">${Object.entries(byAcc).map(([acc, list]) => `<span class="fam-lbl">${famEsc(acc)}</span>` + list.map(c => `<label class="fs-tog" style="margin-top:6px"><div><b><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${famEsc(c.color)};margin-right:6px"></span>${famEsc(c.name || '(이름 없음)')}</b></div><input type="checkbox" class="pc-chk" value="${c.id}" ${sel.has(String(c.id)) ? 'checked' : ''}></label>`).join('')).join('') || '<div class="fam-note">폰에 캘린더가 없습니다.</div>'}</div>
        <div class="fam-btns">${sel.size ? '<button class="fam-btn" onclick="pcOff()">가져오기 끄기</button>' : ''}<button class="fam-btn pri" onclick="pcSaveSel(this)">저장하고 지금 맞추기</button></div>`);
}
async function pcSaveSel(btn) {
    const ids = [...document.querySelectorAll('.pc-chk:checked')].map(x => x.value);
    pcLS('pcalIds', ids); btn.disabled = true; btn.textContent = '맞추는 중…';
    const n = await pcSync(true).catch(e => { famToast('실패: ' + e.message); return -1; });
    famSheetClose(); if (n >= 0) famToast(`폰 캘린더 일정 ${n}건을 맞췄습니다`);
    if (typeof famRenderSettings === 'function' && document.getElementById('pc-sum')) famRenderSettings();
}
async function pcOff() {
    if (!confirm('폰 캘린더 가져오기를 끄고, 가져온 일정을 설연에서 지울까요? (폰 캘린더 원본은 그대로)')) return;
    pcLS('pcalIds', []); await pcSync(true).catch(() => {}); famSheetClose(); famToast('껐습니다');
}

// 맞추기: 고른 캘린더의 일정 ↔ 설연의 '폰에서 온 내 일정' 차이만 쓰고 지움
async function pcSync(force) {
    const N = pcN(), me = famUser(); if (!N || !N.calEvents || !me || pcBusy) return 0;
    const ids = pcLS('pcalIds') || [], last = pcLS('pcalLast');
    if (!force && (!ids.length || (last && Date.now() - last.at < 30 * 60e3))) return 0;
    pcBusy = true;
    try {
        const from = Date.now() - 30 * 864e5, to = Date.now() + 183 * 864e5;
        const evs = ids.length ? ((await N.calEvents({ from, to, ids })).events || []) : [];
        const want = new Map(), tag = me === '한미연' ? 'h' : 'j';
        for (const e of evs) {
            const s = new Date(e.start), en = new Date(e.end);
            // 종일 일정은 UTC 자정 기준으로 옴 → 날짜만 사용
            const days = [];
            if (e.allDay) { for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())); d.getTime() < e.end && days.length < 14; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10)); if (!days.length) days.push(s.toISOString().slice(0, 10)); }
            else { for (let d = new Date(s.getFullYear(), s.getMonth(), s.getDate()); d < en && days.length < 14; d.setDate(d.getDate() + 1)) days.push(pcYmd(d)); if (!days.length) days.push(pcYmd(s)); }
            const gid = `pc_${tag}_${String(e.key).replace(/[^\w]/g, '_')}`;
            days.forEach((ds, i) => {
                const id = i === 0 ? gid : `${gid}_d${i}`;
                want.set(id, { id, date: ds, priority: '일반', member: me, category: '개인', timeType: e.allDay ? 'allday' : 'timed',
                    startTime: e.allDay || i > 0 ? '' : pcHm(s), endTime: e.allDay || i < days.length - 1 ? '' : pcHm(en), place: e.loc || '', memo: e.title || '(제목 없음)',
                    repeat: null, span: days.length > 1 ? { groupId: gid, start: days[0], end: days[days.length - 1], idx: i, n: days.length } : null,
                    src: 'phone', srcKey: String(e.key), cal: String(e.cal), by: '폰 캘린더' });
            });
        }
        let have = []; try { have = (schData || []).filter(x => x.src === 'phone' && x.member === me); } catch (e) {}
        const ops = [];
        have.forEach(x => { if (!want.has(x.id)) ops.push(['del', x.id]); });
        want.forEach((v, id) => { const o = have.find(x => x.id === id); if (!o || o.date !== v.date || o.memo !== v.memo || o.startTime !== v.startTime || o.endTime !== v.endTime || o.place !== v.place) ops.push(['set', id, v]); });
        for (let i = 0; i < ops.length; i += 400) {
            const b = db.batch();
            ops.slice(i, i + 400).forEach(([k, id, v]) => k === 'del' ? b.delete(db.collection('schedules').doc(id)) : b.set(db.collection('schedules').doc(id), v));
            await b.commit();
        }
        pcLS('pcalLast', { at: Date.now(), n: want.size });
        return want.size;
    } finally { pcBusy = false; }
}

(function () {
    const go = () => { if (pcN() && pcN().calEvents && (pcLS('pcalIds') || []).length) pcSync(false).catch(() => {}); };
    const wait = () => { if (window.firebase && firebase.auth) firebase.auth().onAuthStateChanged(u => { if (u) setTimeout(go, 6000); }); else setTimeout(wait, 1000); };
    window.addEventListener('load', () => setTimeout(wait, 900));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(go, 2500); });
})();
