// ═══════════════════════════════════════════════════════════
// 🗺 여행 노트 — 지도 · 통계 · 가볼 곳(이달의 추천 포함)
//   지도: Leaflet(열 때만 불러옴) + OpenStreetMap 지도 / 좌표: OpenStreetMap Nominatim(키 불필요, 초당 1회)
//   좌표는 plans.geo · hikeLogs.geo · wishes.geo 에 저장 {lat,lng,q,cc,country,sido,city} → 두 폰 공유
//   wishes/{id}: name, note, kind(국내|해외), type, from, by, at
//   travelRecs/{YYYY-MM}: items[], at, by, ai  (이달의 추천, 한 달에 한 번 만들어 두 폰이 같이 봄)
// ═══════════════════════════════════════════════════════════
const MAP_LIB = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const MAP_KIND = [['all', '전체'], ['여행', '✈️ 여행'], ['캠핑', '⛺ 캠핑'], ['등산', '⛰️ 등산'], ['출장', '💼 출장'], ['기타', '📌 기타'], ['wish', '⭐ 가볼 곳']];
const mapKind = p => ['여행', '캠핑', '등산', '출장'].includes(p.subType) ? p.subType : '기타';   // 출장(국내·해외)은 💼 보라색 핀으로 따로
const MAP_COLOR = { 여행: '#2563eb', 캠핑: '#16a34a', 등산: '#a16207', 출장: '#7c3aed', 기타: '#64748b', wish: '#f59e0b' };
const SIDO = [['서울', /서울/], ['부산', /부산/], ['대구', /대구/], ['인천', /인천/], ['광주', /광주광역/], ['대전', /대전/], ['울산', /울산/], ['세종', /세종/], ['경기', /경기/], ['강원', /강원/],
    ['충북', /충청북|충북/], ['충남', /충청남|충남/], ['전북', /전라북|전북/], ['전남', /전라남|전남/], ['경북', /경상북|경북/], ['경남', /경상남|경남/], ['제주', /제주/]];
// 시·도 타일 배치 (실제 위치를 대략 따름)
const SIDO_GRID = { 인천: [1, 1], 서울: [2, 1], 경기: [3, 1], 강원: [4, 1], 충남: [1, 2], 세종: [2, 2], 충북: [3, 2], 경북: [4, 2], 전북: [1, 3], 대전: [2, 3], 대구: [3, 3], 울산: [4, 3], 광주: [1, 4], 전남: [2, 4], 경남: [3, 4], 부산: [4, 4], 제주: [1, 5] };
const ABROAD_RE = /(일본|도쿄|오사카|후쿠오카|교토|홋카이도|삿포로|오키나와|중국|베이징|상하이|대만|타이베이|홍콩|마카오|베트남|다낭|하노이|나트랑|태국|방콕|치앙마이|푸켓|필리핀|세부|보라카이|싱가포르|말레이시아|발리|인도네시아|괌|사이판|하와이|미국|캐나다|호주|뉴질랜드|유럽|영국|런던|프랑스|파리|이탈리아|로마|스위스|독일|스페인|포르투갈|체코|프라하|오스트리아|크로아티아|그리스|튀르키예|터키|몽골|라오스|캄보디아)/;
let mapObj = null, mapLayer = null, mapF = { kind: 'all', year: 'all', plan: false }, mapBusy = false, mapTab = 'map';
let wishes = [], wishUnsub = null, recDoc = null, recBusy = false;
const mapNoGeo = new Set();   // 이번에 못 찾은 곳 (같은 곳을 반복 검색하지 않음)
const flag = cc => cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1A5 + c.charCodeAt(0))) : '🏳️';

function mapLoadLib() {
    if (window.L) return Promise.resolve();
    return new Promise((ok, no) => {
        const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = MAP_LIB + 'leaflet.css'; document.head.appendChild(css);
        const s = document.createElement('script'); s.src = MAP_LIB + 'leaflet.js'; s.onload = ok; s.onerror = () => no(new Error('지도를 불러오지 못했습니다 (인터넷 연결 확인)')); document.head.appendChild(s);
    });
}

// ── 장소 → 좌표·나라·시도 ──
const MAP_TRIM = /\s*(오토캠핑장|캠핑장|글램핑|야영장|리조트|호텔|펜션|휴양림|CC|컨트리클럽|골프장|여행|투어|일대|근처)\s*$/;
function mapAddr(a, disp) {
    a = a || {}; const cc = (a.country_code || '').toLowerCase(), all = [a.state, a.province, a.city, a.region, disp].filter(Boolean).join(' ');
    const s = cc === 'kr' ? (SIDO.find(([, re]) => re.test(all)) || [''])[0] : '';
    return { cc, country: a.country || '', sido: s, city: a.city || a.town || a.county || a.village || a.municipality || a.state || '' };
}
const mapWait = () => new Promise(r => setTimeout(r, 1100));      // Nominatim 이용 규칙: 초당 1회
// ── 위치 찾기 (2단계) ──
//   ① AI가 여행 제목("다낭 가족여행 3박", "홍천 비발디 캠핑")을 장소·도시·나라로 정리 (여러 건을 한 번에)
//   ② 도시 좌표는 GeoNames(Open-Meteo 지오코딩: 전 세계 도시, 한글 이름) → 국내 캠핑장·산처럼 구체적인 곳은 OSM에서 찾아 도시 근처일 때만 씀
//   도시를 못 찾으면 예전 방식(OSM 첫 결과)
const mapKm = (a, b) => { const R = 6371, d = x => x * Math.PI / 180, dl = d(b.lat - a.lat), dg = d(b.lng - a.lng); return 2 * R * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(d(a.lat)) * Math.cos(d(b.lat)) * Math.sin(dg / 2) ** 2)); };
async function mapNorm(list) {   // list: [{k, text, kr}] → { k: {place, city, cityKo, cc} }
    const out = {}; if (!list.length || typeof famCallAI !== 'function') return out;
    for (let i = 0; i < list.length; i += 25) {
        const part = list.slice(i, i + 25);
        try {
            const r = await famCallAI('너는 여행 기록 제목에서 실제 장소를 뽑는 도우미다. 모르면 지어내지 말고 도시까지만 쓴다. JSON만 출력.',
                `각 줄은 "번호|국내/해외|제목". 제목에서 여행·캠핑·출장 같은 말과 박수·인원은 빼고 장소만.
${part.map((x, n) => `${n}|${x.kr ? '국내' : '해외'}|${x.text}`).join('\n')}
[{"i":번호,"place":"구체적인 장소(캠핑장·산·호텔·관광지, 없으면 빈칸). 해외는 영어 이름","city":"도시 영어 이름 (국내도 영어: Hongcheon, Jeju City, Seoul)","cityKo":"도시 한글 (홍천, 제주, 다낭)","cc":"나라 ISO 2자리 소문자 (kr, vn, jp)"}]`, { maxTokens: 2500 });
            const t = r.text || '', a = JSON.parse(t.slice(t.indexOf('['), t.lastIndexOf(']') + 1));
            a.forEach(o => { const x = part[+o.i]; if (x && o && o.city) out[x.k] = { place: String(o.place || ''), city: String(o.city), cityKo: String(o.cityKo || o.city), cc: String(o.cc || '').toLowerCase().slice(0, 2) }; });
        } catch (e) {}
    }
    return out;
}
async function mapCity(name, cc, n) {   // GeoNames 도시 후보
    try {
        const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${n || 5}&language=ko&format=json${cc ? '&countryCode=' + cc.toUpperCase() : ''}`)).json();
        return (j.results || []).map(r => ({ lat: r.latitude, lng: r.longitude, cc: String(r.country_code || '').toLowerCase(), country: r.country || '', city: r.name, admin: r.admin1 || '', pop: r.population || 0 }));
    } catch (e) { return []; }
}
async function mapOsm(q, kr, n) {   // OSM 장소 후보
    try {
        const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=${n || 1}&addressdetails=1&accept-language=ko${kr ? '&countrycodes=kr' : ''}&q=${encodeURIComponent(q)}`)).json();
        return (j || []).map(r => ({ lat: +r.lat, lng: +r.lon, label: r.display_name, ...mapAddr(r.address, r.display_name) }));
    } catch (e) { return []; }
}
const mapSido = (cc, txt) => cc === 'kr' ? (SIDO.find(([, re]) => re.test(txt || '')) || [''])[0] : '';
async function mapResolve(q, kr, nm) {
    if (nm && nm.city) {
        const cs = (await mapCity(nm.city, nm.cc)).concat(nm.cityKo && nm.cityKo !== nm.city ? await mapCity(nm.cityKo, nm.cc) : []);
        const c = cs.sort((a, b) => b.pop - a.pop)[0];
        if (c) {
            let g = { lat: c.lat, lng: c.lng, q, cc: c.cc, country: c.country, sido: mapSido(c.cc, c.admin + ' ' + c.city), city: nm.cityKo || c.city, v: 2 };
            if (nm.place) {   // 구체적인 장소가 도시에서 60km 안이면 그 좌표
                const o = (await mapOsm(nm.place + (kr ? '' : ' ' + nm.city), kr, 1))[0];
                if (o && mapKm(o, g) < 60) g = { ...g, lat: o.lat, lng: o.lng, sido: g.sido || o.sido };
                await mapWait();
            }
            return g;
        }
    }
    const tries = [q, q.replace(MAP_TRIM, ''), q.split(/[\s,·]+/)[0]].map(s => s.trim()).filter((s, i, a) => s && a.indexOf(s) === i);
    for (const t of tries) { const o = (await mapOsm(t, kr, 1))[0]; if (o) return { lat: o.lat, lng: o.lng, q: t, cc: o.cc, country: o.country, sido: o.sido, city: o.city, v: 1 }; await mapWait(); }
    return null;
}
async function mapGeocode(q, kr) { const nm = (await mapNorm([{ k: 'q', text: q, kr }])).q; return mapResolve(q, kr, nm); }
async function mapReverse(g) {
    try {
        const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&accept-language=ko&lat=${g.lat}&lon=${g.lng}`)).json();
        if (j && j.address) return { ...g, ...mapAddr(j.address, j.display_name) };
    } catch (e) {}
    return null;
}

// ── 지도에 올릴 항목 ──
function mapAll() {
    const today = famYmd(new Date()), out = [];
    (typeof planData !== 'undefined' ? planData : []).forEach(p => {
        if (!p.loc || !p.start) return;
        out.push({ kind: mapKind(p), src: 'plan', col: 'plans', id: p.id, name: p.loc, date: p.start, geo: p.geo, kr: p.mType !== '해외', future: p.start > today, obj: p });
    });
    (typeof hikeLogs !== 'undefined' ? hikeLogs : []).forEach(h => {
        if (h.planId && (planData || []).some(p => p.id === h.planId)) return;      // 계획 핀과 중복이면 생략
        out.push({ kind: '등산', src: 'hike', col: 'hikeLogs', id: h.id, name: typeof hikeMt === 'function' ? hikeMt(h.place) : h.place, full: h.place, date: h.date, geo: h.geo, kr: true, obj: h });
    });
    wishes.forEach(w => out.push({ kind: 'wish', src: 'wish', col: 'wishes', id: w.id, name: w.name, date: '', geo: w.geo, kr: w.kind !== '해외', obj: w }));
    out.forEach(x => x.noGeo = mapNoGeo.has(x.src + x.id));
    return out;
}
const yearOk = x => mapF.year === 'all' || String(x.date).startsWith(mapF.year);
function mapItems() {
    return mapAll().filter(x => x.src === 'wish' ? (mapF.kind === 'all' || mapF.kind === 'wish')
        : (mapF.kind === 'all' || x.kind === mapF.kind) && yearOk(x) && (mapF.plan || !x.future));
}
const visited = () => mapAll().filter(x => x.src !== 'wish' && !x.future && yearOk(x));
async function mapSaveGeo(x, g) {
    x.geo = g; x.obj.geo = g;
    try { await db.collection(x.col).doc(x.id).update({ geo: g }); } catch (e) {}
}
// 좌표 없는 곳 찾기 (needCc: 통계용으로 나라·시도 정보가 없는 기존 좌표도 보완)
async function mapFill(list, needCc) {
    if (mapBusy) return; mapBusy = true;
    const need = list.filter(x => !x.noGeo && (!x.geo || (needCc && !x.geo.cc)));
    const stEl = () => document.getElementById(mapTab === 'stat' ? 'stat-st' : 'map-st');
    if (need.some(x => !x.geo) && stEl()) stEl().textContent = `장소 정리 중… (${need.filter(x => !x.geo).length}곳)`;
    const NM = await mapNorm(need.filter(x => !x.geo).map(x => ({ k: x.src + x.id, text: x.name, kr: x.kr })));
    let n = 0;
    for (const x of need) {
        const st = stEl();
        if (st) st.textContent = `위치 찾는 중 ${++n}/${need.length} · ${x.name}`;
        const rev = !!x.geo, g = rev ? await mapReverse(x.geo) : await mapResolve(x.name, x.kr, NM[x.src + x.id]);
        if (!g) { if (!rev) mapNoGeo.add(x.src + x.id); x.noGeo = !rev; }
        else await mapSaveGeo(x, g);
        if (rev) await mapWait();
        if (mapTab === 'map') mapDraw(false);
    }
    mapBusy = false;
    if (mapTab === 'map') mapDraw(need.length > 0); else if (mapTab === 'stat') statRender(false);
}

// ── 🗺 지도 ──
function mapPopup(x) {
    if (x.src === 'hike') return `<b>⛰️ ${famEsc(x.full)}</b><br><small>${famEsc(x.date)} · ${famEsc(x.obj.by || '')}${x.obj.mins ? ' · ' + hikeDur(+x.obj.mins) : ''}</small>`;
    if (x.src === 'wish') return `<b>⭐ ${famEsc(x.name)}</b>${x.obj.note ? `<br><small>${famEsc(x.obj.note)}</small>` : ''}<div class="map-pop-btns"><button onclick="wishToPlan('${famEsc(x.id)}')">계획으로 만들기</button><button onclick="mapFix('${famEsc(x.id)}')">📍 위치 고치기</button></div>`;
    const p = x.obj, cost = typeof tripCost === 'function' ? tripCost(p.id) : 0, f = typeof tripFolder === 'function' ? tripFolder(p) : null, ph = f && (f.photos || [])[0];
    return `${ph ? `<img src="${famEsc(ph)}" class="map-ph">` : ''}<b>${getTypeIcon(p.subType)} ${famEsc(p.loc)}</b><br><small>${famEsc(p.start)}${p.end && p.end !== p.start ? ' ~ ' + famEsc(p.end.slice(5)) : ''}${cost ? ' · 💰 ' + svW(cost) : ''}</small>
        <div class="map-pop-btns"><button onclick="mapClose();famGoPlan('${famEsc(p.id)}')">기록 보기</button><button onclick="mapFix('${famEsc(p.id)}')">📍 위치 고치기</button></div>`;
}
function mapDraw(fit) {
    if (!mapObj) return;
    const list = mapItems(), pts = [];
    if (mapLayer) mapLayer.remove();
    mapLayer = L.layerGroup().addTo(mapObj);
    list.filter(x => x.geo).forEach(x => {
        const ic = x.src === 'hike' ? '⛰️' : x.src === 'wish' ? '⭐' : getTypeIcon(x.obj.subType);
        const icon = L.divIcon({ className: 'map-pin' + (x.src === 'wish' ? ' wish' : ''), html: `<span style="background:${MAP_COLOR[x.kind]}">${ic}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
        L.marker([x.geo.lat, x.geo.lng], { icon, opacity: x.future ? .55 : 1 }).bindPopup(mapPopup(x), { maxWidth: 220 }).addTo(mapLayer);
        pts.push([x.geo.lat, x.geo.lng]);
    });
    const got = list.filter(x => x.geo && x.src !== 'wish'), dom = got.filter(x => x.kr).length, wn = list.filter(x => x.src === 'wish').length, miss = list.filter(x => x.noGeo && x.src === 'plan');
    const st = document.getElementById('map-st');
    if (st && !mapBusy) st.innerHTML = `${got.length}곳 · 국내 ${dom} · 해외 ${got.length - dom}${wn ? ` · ⭐ 가볼 곳 ${wn}` : ''}${miss.length ? ` · <a onclick="mapMissing()">위치 못 찾은 곳 ${miss.length}</a>` : ''}`;
    if (fit) { if (pts.length > 1) mapObj.fitBounds(pts, { padding: [40, 40], maxZoom: 11 }); else if (pts.length) mapObj.setView(pts[0], 10); }
    return list;
}
async function mapInitMap() {
    const box = document.getElementById('map-box'); if (!box) return;
    try { await mapLoadLib(); } catch (e) { box.innerHTML = `<div class="tk-empty">⚠️ ${famEsc(e.message)}</div>`; return; }
    box.innerHTML = '';
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapObj = L.map(box, { zoomControl: true }).setView([36.4, 127.8], 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapObj);
    mapObj.on('click', e => { if (mapPickFor) mapPickAt(e.latlng); });
    mapRefresh();
}
function mapRefresh() { const list = mapDraw(true); if (list && list.some(x => !x.geo && !x.noGeo)) mapFill(list, false); }

// ── 여행 노트 화면 ──
function mapOpen(tab) {
    let o = document.getElementById('map-ov');
    if (!o) { o = document.createElement('div'); o.id = 'map-ov'; document.body.appendChild(o); }
    wishListen();
    const years = [...new Set((planData || []).map(p => String(p.start || '').slice(0, 4)).concat((typeof hikeLogs !== 'undefined' ? hikeLogs : []).map(h => String(h.date || '').slice(0, 4))).filter(Boolean))].sort().reverse();
    o.innerHTML = `<div class="map-top"><button class="fam-x" onclick="mapClose()">✕</button><b>🗺 여행 노트</b>
            <select class="fam-mini-sel" id="map-year" onchange="mapF.year=this.value;mapTabGo(mapTab,true)"><option value="all">전체 기간</option>${years.map(y => `<option value="${y}" ${mapF.year === y ? 'selected' : ''}>${y}년</option>`).join('')}</select></div>
        <div class="tk-seg map-seg">${[['map', '🗺 지도'], ['stat', '📊 통계'], ['wish', '⭐ 가볼 곳']].map(([k, n]) => `<button data-t="${k}" onclick="mapTabGo('${k}')">${n}</button>`).join('')}</div>
        <div class="mv" id="mv-map">
            <div class="map-chips">${MAP_KIND.map(([k, n]) => `<button class="${mapF.kind === k ? 'on' : ''}" onclick="mapF.kind='${k}';document.querySelectorAll('.map-chips button').forEach(b=>b.classList.toggle('on',b===this));mapDraw(true)">${n}</button>`).join('')}
                <label><input type="checkbox" ${mapF.plan ? 'checked' : ''} onchange="mapF.plan=this.checked;mapRefresh()"> 예정 포함</label>
                <button onclick="mapRegeoAll()" title="직접 고친 곳은 그대로">📍 위치 다시 찾기</button></div>
            <div id="map-box"><div class="tk-empty"><span class="fam-spin"></span>지도를 불러오는 중…</div></div>
            <div class="map-st" id="map-st"></div>
        </div>
        <div class="mv mv-scroll" id="mv-stat"></div>
        <div class="mv mv-scroll" id="mv-wish"></div>`;
    o.style.display = 'flex'; history.pushState({ mapOv: 1 }, '', '');
    if (mapObj) { mapObj.remove(); mapObj = null; }
    mapTabGo(tab || 'map', true);
}
function mapTabGo(t, force) {
    mapTab = t;
    document.querySelectorAll('.map-seg button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    ['map', 'stat', 'wish'].forEach(k => { const el = document.getElementById('mv-' + k); if (el) el.style.display = k === t ? 'flex' : 'none'; });
    const ys = document.getElementById('map-year'); if (ys) ys.style.visibility = t === 'wish' ? 'hidden' : '';
    if (t === 'map') { if (!mapObj) mapInitMap(); else { setTimeout(() => mapObj.invalidateSize(), 50); if (force) mapRefresh(); } }
    if (t === 'stat') statRender(true);
    if (t === 'wish') wishRender();
}
function mapClose() { const o = document.getElementById('map-ov'); if (o) o.style.display = 'none'; }

// ── 📊 통계 ──
function statRender(fill) {
    const el = document.getElementById('mv-stat'); if (!el) return;
    const v = visited(), withCc = v.filter(x => x.geo && x.geo.cc), pend = v.filter(x => !x.noGeo && (!x.geo || !x.geo.cc));
    const ctry = {}; withCc.forEach(x => { const c = x.geo.cc; const o = ctry[c] || (ctry[c] = { name: x.geo.country, cities: new Set(), n: 0 }); o.n++; o.cities.add(x.geo.city || x.name); });
    const sido = {}; withCc.filter(x => x.geo.cc === 'kr' && x.geo.sido).forEach(x => { sido[x.geo.sido] = (sido[x.geo.sido] || 0) + 1; });
    const cities = new Set(withCc.map(x => x.geo.cc + '|' + (x.geo.city || x.name)));
    const plans = v.filter(x => x.src === 'plan').map(x => x.obj), nights = p => Math.max(0, Math.round((new Date((p.end || p.start) + 'T00:00:00') - new Date(p.start + 'T00:00:00')) / 864e5));
    const trip = plans.filter(p => p.subType !== '출장'), biz = plans.filter(p => p.subType === '출장');
    const days = trip.reduce((a, p) => a + nights(p) + 1, 0), bizDays = biz.reduce((a, p) => a + nights(p) + 1, 0), camp = plans.filter(p => p.subType === '캠핑').reduce((a, p) => a + Math.max(1, nights(p)), 0);
    const hl = (typeof hikeLogs !== 'undefined' ? hikeLogs : []);
    const hikes = hl.filter(h => mapF.year === 'all' || String(h.date).startsWith(mapF.year)).length + plans.filter(p => p.subType === '등산' && !hl.some(h => h.planId === p.id)).length;
    const abroad = Object.keys(ctry).filter(c => c !== 'kr'), sidoN = Object.keys(sido).length;
    const byYear = {}; plans.forEach(p => { const y = p.start.slice(0, 4); const o = byYear[y] || (byYear[y] = { n: 0, d: 0 }); o.n++; o.d += nights(p) + 1; });
    const ys = Object.keys(byYear).sort(), maxD = Math.max(1, ...ys.map(y => byYear[y].d));
    const notYet = SIDO.map(s => s[0]).filter(s => !sido[s]);
    const per = mapF.year === 'all' ? '' : `${mapF.year}년 `;
    el.innerHTML = `<div class="st-tiles">
            <div><b>${Object.keys(ctry).length}</b><span>${per}다녀온 나라</span></div>
            <div><b>${cities.size}</b><span>도시·지역</span></div>
            <div><b>${sidoN}<small>/17</small></b><span>국내 시·도</span></div>
            <div><b>${days}<small>일</small></b><span>여행·여가 일수</span></div>
            <div><b>${camp}<small>박</small></b><span>캠핑</span></div>
            <div><b>${hikes}<small>회</small></b><span>산행</span></div>${biz.length ? `
            <div><b>${biz.length}<small>회</small></b><span>출장 ${bizDays}일</span></div>` : ''}</div>
        <div class="map-st" id="stat-st"></div>
        <div class="st-sec"><h5>국내 시·도 <small>${sidoN}곳 다녀옴</small></h5>
            <div class="sido-grid">${Object.entries(SIDO_GRID).map(([s, [c, r]]) => `<div class="sido ${sido[s] ? 'on' : ''}" style="grid-column:${c};grid-row:${r}">${s}${sido[s] ? `<i>${sido[s]}</i>` : ''}</div>`).join('')}</div>
            ${notYet.length && notYet.length < 17 ? `<div class="fam-note">아직 안 가 본 곳: ${notYet.join(' · ')}</div>` : ''}</div>
        ${abroad.length ? `<div class="st-sec"><h5>다녀온 나라 <small>${abroad.length}개국 · 세계 ${Math.round(abroad.length / 195 * 1000) / 10}%</small></h5>${abroad.sort((a, b) => ctry[b].n - ctry[a].n).map(c => `<div class="st-row"><span class="st-flag">${flag(c)}</span><span style="flex:1;min-width:0"><b>${famEsc(ctry[c].name)}</b><br><small>${[...ctry[c].cities].map(famEsc).join(' · ')}</small></span><b>${ctry[c].n}회</b></div>`).join('')}</div>` : ''}
        ${ys.length > 1 || (ys.length && mapF.year === 'all') ? `<div class="st-sec"><h5>연도별</h5>${ys.map(y => `<div class="bd-row"><span class="bd-n">${y}</span><div class="sv-bar" style="flex:1;margin:0"><i style="width:${byYear[y].d / maxD * 100}%"></i></div><span class="bd-v">${byYear[y].n}회 · ${byYear[y].d}일</span></div>`).join('')}</div>` : ''}
        ${!v.length ? '<div class="tk-empty">이 기간에 다녀온 기록이 없습니다</div>' : ''}`;
    if (fill && pend.length) mapFill(v, true);
}

// ── ⭐ 가볼 곳 + 이달의 추천 ──
function wishListen() {
    if (wishUnsub) return;
    try { wishUnsub = db.collection('wishes').onSnapshot(s => { wishes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.at || 0) - (a.at || 0)); if (mapTab === 'wish') wishRender(); }, () => {}); } catch (e) {}
}
const recKey = () => famYmd(new Date()).slice(0, 7);
async function recLoad() {
    if (recDoc && recDoc.key === recKey()) return recDoc;
    try { const d = await db.collection('travelRecs').doc(recKey()).get(); recDoc = d.exists ? { key: recKey(), ...d.data() } : false; } catch (e) { recDoc = false; }
    return recDoc;
}
const SEASON_IC = m => ['❄️', '❄️', '🌱', '🌸', '🌿', '☀️', '🏖', '🏖', '🌾', '🍁', '🍂', '❄️'][m - 1];
function wishRender() {
    const el = document.getElementById('mv-wish'); if (!el) return;
    const R = recDoc && recDoc.key === recKey() ? recDoc : null, m = +recKey().slice(5);
    el.innerHTML = `<div class="st-sec"><h5>⭐ 가볼 곳 <small>둘이 같이 쓰는 목록</small></h5>
            <div class="chk-add"><input id="wish-new" placeholder="가고 싶은 곳 (예: 지리산 노고단, 스위스 체르마트)" onkeydown="if(event.key==='Enter'){event.preventDefault();wishAdd()}"><button onclick="wishAdd()">추가</button></div>
            ${wishes.length ? wishes.map(w => `<div class="wish-row"><span class="wish-ic">${w.type ? getTypeIcon(w.type) : (w.kind === '해외' ? '🌏' : '📍')}</span><span style="flex:1;min-width:0"><b>${famEsc(w.name)}</b>${w.note ? `<br><small>${famEsc(w.note)}</small>` : ''}<br><small class="wish-by">${famEsc(w.by || '')}${w.from ? ' · ' + famEsc(w.from) : ''}</small></span>
                <button class="fam-btn" onclick="wishToPlan('${famEsc(w.id)}')">계획으로</button><button class="fam-x wish-x" onclick="wishDel('${famEsc(w.id)}')">✕</button></div>`).join('') : '<div class="fam-note">아직 없습니다. 이야기하다 나온 곳을 바로 적어 두세요.</div>'}</div>
        <div class="st-sec"><h5>${SEASON_IC(m)} ${m}월 추천 여행지 <small>청주 출발 기준</small>${R ? `<button class="trip-edit" onclick="recMake(true)">다시 추천</button>` : ''}</h5>
            <div id="rec-box">${R ? recHtml(R) : recBusy ? '<div class="tk-empty"><span class="fam-spin"></span>이번 달 정보를 검색하는 중… (30초~1분)</div>' : `<div class="tk-empty"><p style="margin:0 0 10px">이번 달 계절·절기와 요즘 정보를 검색해서,<br>다녀온 곳은 빼고 두 분 취향에 맞춰 추천합니다.</p><button class="fam-btn pri" onclick="recMake(false)">이달의 추천 받기</button></div>`}</div></div>`;
    if (recDoc === null && !recBusy) recLoad().then(d => { if (d && mapTab === 'wish') wishRender(); });
}
function recHtml(R) {
    window._recItems = R.items || [];
    return (R.items || []).map((x, i) => `<div class="rec-card">
            <div class="rec-h"><b>${getTypeIcon(x.type)} ${famEsc(x.name)}</b><span class="rec-k ${x.kind === '해외' ? 'ab' : ''}">${famEsc(x.kind || '')}</span></div>
            ${x.why ? `<div class="rec-why">${famEsc(x.why)}</div>` : ''}
            <div class="rec-meta">${[x.when ? `🗓 ${famEsc(x.when)}` : '', x.move ? `🚗 ${famEsc(x.move)}` : ''].filter(Boolean).join(' · ')}</div>
            ${x.tip ? `<div class="rec-tip">💡 ${famEsc(x.tip)}</div>` : ''}
            <div class="rec-btns">${wishes.some(w => w.name === x.name) ? '<span class="fam-note" style="margin:0">⭐ 가볼 곳에 있음</span>' : `<button class="fam-btn pri" onclick="recToWish(${i})">⭐ 가볼 곳에 추가</button>`}${/^https?:/.test(x.url || '') ? `<a class="fam-btn" href="${famEsc(x.url)}" target="_blank" rel="noopener">자세히 ↗</a>` : ''}</div>
        </div>`).join('') + `<div class="fam-note">${famEsc(R.by || '')}${R.ai ? ' · ' + famEsc(R.ai) : ''} · 축제 날짜 등은 '자세히'에서 한 번 더 확인하세요</div>`;
}
async function recMake(force) {
    if (recBusy) return;
    if (!(famKeys()[famProv()] || '')) { famToast('설정에서 AI 키를 먼저 넣어 주세요'); famOpenSettings(); return; }
    if (force && !confirm('이번 달 추천을 새로 받을까요?')) return;
    recBusy = true; recDoc = force ? false : recDoc; wishRender();
    const today = famYmd(new Date()), all = mapAll().filter(x => x.src !== 'wish' && !x.future);
    const cnt = k => (planData || []).filter(p => p.subType === k).length;
    const user = `오늘은 ${today}이다. 우리는 충북 청주에 사는 부부다.
지금까지 기록: 캠핑 ${cnt('캠핑')}회, 등산 ${cnt('등산') + ((typeof hikeLogs !== 'undefined' ? hikeLogs : []).length)}회, 여행 ${cnt('여행')}회(해외 ${(planData || []).filter(p => p.mType === '해외').length}회).
이미 다녀온 곳: ${[...new Set(all.map(x => x.name))].slice(0, 40).join(', ') || '없음'}
가보고 싶은 곳: ${wishes.map(w => w.name).join(', ') || '없음'}

웹 검색으로 이번 달(${+today.slice(5, 7)}월) 실제 정보(제철, 절기, 단풍·꽃 시기, 축제, 요즘 많이 찾는 곳)를 확인하고 여행지 4곳을 추천하라.
국내 3곳(청주에서 주말에 다녀올 수 있는 곳, 캠핑·등산·여행을 섞어서) + 해외 1곳(이번 달에 가기 좋은 곳). 이미 다녀온 곳과 가보고 싶은 곳에 있는 곳은 빼라.
JSON만 출력: {"items":[{"name":"지역+장소","kind":"국내|해외","type":"캠핑|등산|여행","why":"지금 가야 하는 이유 한 문장","when":"적기(예: 11월 둘째 주까지)","move":"청주에서 이동 시간(해외는 비행시간)","tip":"한 줄 팁","url":"확인한 출처 주소 또는 빈 문자열"}]}`;
    try {
        const r = await famCallAI('너는 부부의 여행 계획을 돕는 여행 큐레이터다. 웹 검색으로 확인한 정보만 쓰고, 날짜나 사실을 지어내지 않는다. 담백한 한국어로 짧게 쓴다.', user, { search: true, maxTokens: 3000 });
        const t = (r && r.text) || String(r || ''), a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0) throw new Error('추천을 읽지 못했습니다');
        const j = JSON.parse(t.slice(a, b + 1));
        const items = (j.items || []).filter(x => x && x.name).slice(0, 5).map(x => ({ name: String(x.name), kind: x.kind === '해외' ? '해외' : '국내', type: ['캠핑', '등산', '여행'].includes(x.type) ? x.type : '여행', why: String(x.why || ''), when: String(x.when || ''), move: String(x.move || ''), tip: String(x.tip || ''), url: /^https?:\/\//.test(x.url || '') ? x.url : '' }));
        if (!items.length) throw new Error('추천 결과가 비어 있습니다');
        const doc = { items, at: Date.now(), by: famUser() || '', ai: (typeof FAM_NAMES !== 'undefined' && FAM_NAMES[famProv()]) || '' };
        recDoc = { key: recKey(), ...doc };
        db.collection('travelRecs').doc(recKey()).set(doc).catch(() => {});
    } catch (e) { famToast('추천 실패: ' + e.message); }
    recBusy = false; if (mapTab === 'wish') wishRender();
}
async function wishAddObj(o) {
    const id = 'wish_' + Date.now();
    try { await db.collection('wishes').doc(id).set({ id, name: o.name, note: o.note || '', kind: o.kind || (ABROAD_RE.test(o.name) || !/[가-힣]/.test(o.name) ? '해외' : '국내'), type: o.type || '', from: o.from || '', by: famUser() || '', at: Date.now() }); return true; }
    catch (e) { famToast(e.message); return false; }
}
async function wishAdd() { const el = document.getElementById('wish-new'), v = (el.value || '').trim(); if (!v) return; el.value = ''; if (await wishAddObj({ name: v })) famToast('⭐ 가볼 곳에 넣었습니다'); }
async function recToWish(i) { const x = (window._recItems || [])[i]; if (!x) return; if (await wishAddObj({ name: x.name, note: [x.why, x.when].filter(Boolean).join(' · '), kind: x.kind, type: x.type, from: `${+recKey().slice(5)}월 추천` })) famToast('⭐ 가볼 곳에 넣었습니다'); }
function wishDel(id) { if (confirm('목록에서 지울까요?')) db.collection('wishes').doc(id).delete().catch(e => famToast(e.message)); }
function wishToPlan(id) {
    const w = wishes.find(x => x.id === id); if (!w) return;
    mapClose(); showSection('travel-section');
    setTimeout(() => {
        openPlanModal(null);
        document.getElementById('plan-loc').value = w.name;
        document.getElementById('plan-memo').value = w.note || '';
        resetChips('plan-area-group', w.kind === '해외' ? '해외' : '국내', 'plan-main-type');
        if (w.type) { resetChips('plan-type-group', w.type, 'plan-sub-type'); togglePlanTimeSection(); }
        famToast('날짜를 넣고 저장하세요');
    }, 300);
}

// ── 위치 고치기 ──
function mapMissing() {
    const miss = mapItems().filter(x => x.noGeo && x.src === 'plan');
    famSheet(`<div class="fam-h"><b>📍 위치 못 찾은 곳</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:-4px 0 10px">지도 검색에 나오는 이름(예: 홍천 → 강원 홍천군)으로 바꿔 찾아 보세요.</div>
        <div class="fam-box">${miss.map(x => `<div class="fam-row"><span style="flex:1">${getTypeIcon(x.obj.subType)} ${famEsc(x.name)} <small style="color:#94a3b8">${famEsc(x.date)}</small></span><button class="fam-btn" style="padding:5px 10px;font-size:12px" onclick="mapFix('${famEsc(x.id)}')">찾기</button></div>`).join('') || '<div class="fam-note">없습니다</div>'}</div>`);
}
// 위치 고치기: 이름으로 찾은 후보(도시·장소)에서 고르기, 또는 지도에서 직접 누르기 — 고친 위치는 '직접 고침'으로 남아 다시 찾기에서 건드리지 않음
let mapPickFor = null, mapCands = [];
function mapFixTarget(id) {
    const x = mapAll().find(y => y.id === id && (y.src === 'plan' || y.src === 'wish'));
    return x || null;
}
function mapFix(id) {
    const x = mapFixTarget(id); if (!x) return;
    famSheet(`<div class="fam-h"><b>📍 위치 고치기</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="fam-note" style="margin:-4px 0 8px">${famEsc(x.name)} · ${x.kr ? '국내' : '해외'}</div>
        <div style="display:flex;gap:6px"><input id="mf-q" class="fam-in" style="flex:1" value="${famEsc(x.name.replace(MAP_TRIM, ''))}" placeholder="도시·장소 이름 (다낭, 오사카 난바, 홍천 비발디파크)" onkeydown="if(event.key==='Enter')mapFixSearch('${famEsc(id)}')"><button class="fam-btn pri" onclick="mapFixSearch('${famEsc(id)}')">찾기</button></div>
        <div id="mf-list" style="margin-top:8px"></div>
        <div class="fam-btns"><button class="fam-btn" onclick="mapPickStart('${famEsc(id)}')">🗺 지도에서 직접 고르기</button></div>`);
    mapFixSearch(id);
}
async function mapFixSearch(id) {
    const x = mapFixTarget(id), el = document.getElementById('mf-list'), q = (document.getElementById('mf-q') || {}).value || ''; if (!x || !el || !q.trim()) return;
    el.innerHTML = '<div class="fam-note"><span class="fam-spin"></span> 찾는 중…</div>';
    const nm = (await mapNorm([{ k: 'q', text: q, kr: x.kr }])).q;
    const [cs, os] = await Promise.all([mapCity(nm ? nm.city : q, nm && nm.cc, 5), mapOsm(nm && nm.place ? nm.place + (x.kr ? '' : ' ' + nm.city) : q, x.kr, 4)]);
    if (nm && nm.cityKo && !cs.length) cs.push(...await mapCity(nm.cityKo, nm.cc, 5));
    mapCands = [...os.map(o => ({ lat: o.lat, lng: o.lng, cc: o.cc, country: o.country, sido: o.sido, city: o.city || (nm && nm.cityKo) || '', label: o.label.split(',').slice(0, 3).join(','), sub: '장소' })),
        ...cs.map(c => ({ lat: c.lat, lng: c.lng, cc: c.cc, country: c.country, sido: mapSido(c.cc, c.admin + ' ' + c.city), city: c.city, label: [c.city, c.admin, c.country].filter(Boolean).join(', '), sub: '도시' }))];
    el.innerHTML = mapCands.length ? mapCands.map((c, i) => `<div class="fam-row" style="cursor:pointer" onclick="mapFixPick('${famEsc(id)}',${i})"><span style="flex:1;min-width:0">${flag(c.cc)} ${famEsc(c.label)}</span><small style="color:#94a3b8">${c.sub}</small></div>`).join('')
        : '<div class="fam-note">찾지 못했습니다. 이름을 바꾸거나 지도에서 직접 고르세요.</div>';
}
async function mapFixSave(id, g) {
    const x = mapFixTarget(id); if (!x) return;
    g = { ...g, q: x.name, manual: true }; delete g.label; delete g.sub;
    try { await mapSaveGeo(x, g); mapNoGeo.delete(x.src + x.id); famToast('위치를 고쳤습니다'); } catch (e) { famToast(e.message); return; }
    if (mapObj) { mapDraw(false); mapObj.setView([g.lat, g.lng], 11); }
    if (mapTab === 'stat') statRender(false);
}
function mapFixPick(id, i) { const c = mapCands[i]; if (!c) return; famSheetClose(); mapFixSave(id, c); }
// 지도에서 직접: 지도를 옮기고 확대해서 그 자리를 한 번 누름
function mapPickStart(id) {
    famSheetClose(); mapPickFor = id;
    if (mapTab !== 'map') mapTabGo('map');
    const st = document.getElementById('map-st'); if (st) st.innerHTML = '👆 지도를 옮기고 확대해서 <b>그 자리를 누르세요</b> <button class="fam-btn" style="padding:3px 8px;font-size:12px" onclick="mapPickFor=null;this.parentElement.textContent=\'\'">취소</button>';
    famToast('지도에서 위치를 누르세요');
}
async function mapPickAt(ll) {
    const id = mapPickFor; if (!id) return false; mapPickFor = null;
    const st = document.getElementById('map-st'); if (st) st.textContent = '주소 확인 중…';
    const g = (await mapReverse({ lat: ll.lat, lng: ll.lng })) || { lat: ll.lat, lng: ll.lng };
    if (st) st.textContent = '';
    await mapFixSave(id, g); return true;
}
// 전체 다시 찾기: 직접 고친 곳은 그대로 두고 나머지를 새 방식으로
async function mapRegeoAll() {
    if (mapBusy) return famToast('위치를 찾는 중입니다');
    const L = mapAll().filter(x => (x.src === 'plan' || x.src === 'wish') && !(x.geo && x.geo.manual));
    if (!confirm(`직접 고친 곳을 빼고 ${L.length}곳의 위치를 다시 찾을까요? (몇 분 걸릴 수 있음)`)) return;
    L.forEach(x => { x.geo = null; x.obj.geo = null; mapNoGeo.delete(x.src + x.id); });
    await mapFill(L, false);
    famToast('다시 찾았습니다. 그래도 틀린 곳은 핀을 눌러 📍 위치 고치기');
}
