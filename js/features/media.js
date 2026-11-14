// ═══════════════════════════════════════════════════════════
// 🎵 유튜브 · 유튜브 뮤직
//   "○○ 틀어줘"          → 유튜브 검색으로 곡을 찾아 유튜브 뮤직 앱에서 바로 재생
//   "좋아요 한 노래/내 믹스/최근 들은 노래" → 유튜브 뮤직의 해당 화면 (각자 폰의 로그인 계정 기준)
//   "○○ 영상 찾아줘"     → 영상 목록, 누르면 앱 안에서 재생 (유튜브 앱으로 보기도 가능)
//   검색 키: 설정의 유튜브 키(config/aiShared.youtube) → 없으면 Firebase 프로젝트 키
// ═══════════════════════════════════════════════════════════
const YTM_PKG = 'com.google.android.apps.youtube.music', YT_PKG = 'com.google.android.youtube';
function ytKey() {
    try { const k = (typeof famKeys === 'function' && famKeys().youtube) || ''; if (k) return k; } catch (e) {}
    try { return firebase.app().options.apiKey || ''; } catch (e) { return ''; }
}
// 다른 앱(유튜브 뮤직·유튜브)으로 열기: 앱 버전이면 해당 앱 지정, 아니면 새 창
function ytOpen(url, pkg) {
    const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    if (N && N.openUrl) return N.openUrl({ url, pkg: pkg || '' }).catch(() => { window.open(url, '_blank'); });
    window.open(url, '_blank');
}
async function ytSearch(q, opt) {
    opt = opt || {};
    const key = ytKey(); if (!key) throw new Error('유튜브 검색 키가 없습니다');
    const p = new URLSearchParams({ part: 'snippet', q, type: opt.type || 'video', maxResults: String(opt.n || 8), regionCode: 'KR', relevanceLanguage: 'ko', safeSearch: 'moderate', key });
    if (opt.music) p.set('videoCategoryId', '10');
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + p), j = await r.json();
    if (!r.ok) {
        const m = (j.error && j.error.message) || r.status;
        throw new Error(/not been used|disabled/i.test(m) ? '유튜브 API가 꺼져 있습니다' : /referer|blocked|restricted|API_KEY/i.test(m) ? '키가 유튜브 검색을 허용하지 않습니다' : /quota/i.test(m) ? '오늘 검색 한도를 다 썼습니다' : m);
    }
    return (j.items || []).map(it => ({ id: it.id.videoId || it.id.playlistId, kind: it.id.kind, title: ytTxt(it.snippet.title), ch: ytTxt(it.snippet.channelTitle), thumb: (it.snippet.thumbnails.medium || it.snippet.thumbnails.default || {}).url }));
}
const ytTxt = s => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };

// ── 음악 ─────────────────────────────────────────────────
const YTM_SPECIAL = [
    [/좋아요|좋아한|찜한/, 'https://music.youtube.com/playlist?list=LM', '좋아요 표시한 음악'],
    [/믹스|내\s*취향|추천\s*음악|알아서/, 'https://music.youtube.com/playlist?list=RTM', '내 슈퍼믹스'],
    [/최근|듣던|들었던|기록/, 'https://music.youtube.com/history', '최근 들은 음악'],
    [/보관함|라이브러리|내\s*음악/, 'https://music.youtube.com/library', '보관함'],
];
async function musicPlay(raw) {
    const q = String(raw || '').replace(/(을|를)?\s*(좀\s*)?(틀어\s*(줘|줄래|주세요)|들려\s*(줘|줄래|주세요)|재생\s*해?\s*(줘|주세요)?|켜\s*줘|플레이\s*해?\s*줘?)[.!]?$/, '').replace(/^(음악|노래)\s*/, '').trim();
    for (const [re, url, name] of YTM_SPECIAL) if (re.test(q)) { famFeedAdd(`🎵 유튜브 뮤직 <b>${name}</b>을 엽니다.`); return ytOpen(url, YTM_PKG); }
    if (!q) { famFeedAdd('🎵 유튜브 뮤직을 엽니다.'); return ytOpen('https://music.youtube.com/', YTM_PKG); }
    const c = famFeedAdd(`<span class="fam-spin"></span>"${famEsc(q)}" 찾는 중…`);
    try {
        // 곡 이름이면 곡, 분위기·장르면 플레이리스트
        const mood = /(잔잔|신나|조용|감성|드라이브|운동|카페|공부|잠|수면|재즈|클래식|팝|발라드|플레이리스트|모음|노동요|아침|저녁|비\s*오는)/.test(q) && !/[-–]/.test(q);
        let list = mood ? await ytSearch(q + ' 플레이리스트', { type: 'playlist', n: 5 }) : await ytSearch(q, { music: true, n: 5 });
        if (!list.length && mood) list = await ytSearch(q, { music: true, n: 5 });
        if (!list.length) throw new Error('찾지 못했습니다');
        const top = list[0], url = top.kind === 'youtube#playlist' ? `https://music.youtube.com/playlist?list=${top.id}` : `https://music.youtube.com/watch?v=${top.id}`;
        ytOpen(url, YTM_PKG);
        c.innerHTML = `🎵 <b>${famEsc(top.title)}</b> <span style="color:#94a3b8">${famEsc(top.ch)}</span> — 유튜브 뮤직에서 재생합니다.
            ${list.length > 1 ? `<div class="yt-alt">다른 곡: ${list.slice(1, 4).map(x => `<button onclick="ytOpen('${x.kind === 'youtube#playlist' ? 'https://music.youtube.com/playlist?list=' : 'https://music.youtube.com/watch?v='}${x.id}','${YTM_PKG}')">${famEsc(x.title.slice(0, 28))}</button>`).join('')}</div>` : ''}`;
    } catch (e) {
        c.innerHTML = `🎵 ${famEsc(e.message)} — 유튜브 뮤직 검색 화면으로 엽니다.`;
        ytOpen('https://music.youtube.com/search?q=' + encodeURIComponent(q), YTM_PKG);
    }
}

// ── 영상 ─────────────────────────────────────────────────
async function videoSearch(raw) {
    const q = String(raw || '').replace(/(유튜브|동영상|영상)(에서|으로|을|를)?\s*/g, ' ').replace(/(찾아\s*(줘|봐|줄래)|보여\s*(줘|줄래)|검색\s*해?\s*줘?|틀어\s*줘)[.!]?$/, '').replace(/\s+/g, ' ').trim();
    if (!q) return famFeedAdd('예) <b>제주 올레길 7코스 영상 찾아줘</b>');
    const c = famFeedAdd(`<span class="fam-spin"></span>"${famEsc(q)}" 영상 찾는 중…`);
    try {
        const list = await ytSearch(q, { n: 8 });
        if (!list.length) throw new Error('찾지 못했습니다');
        c.innerHTML = `<b>"${famEsc(q)}" 영상</b><div class="yt-list">${list.map(v => `<button class="yt-item" onclick="videoPlay('${v.id}',this.dataset.t)" data-t="${famEsc(v.title)}"><img src="${famEsc(v.thumb)}" alt="" loading="lazy"><span><b>${famEsc(v.title)}</b><small>${famEsc(v.ch)}</small></span></button>`).join('')}</div>`;
    } catch (e) {
        c.innerHTML = `${famEsc(e.message)} — 유튜브 앱 검색으로 엽니다.`;
        ytOpen('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), YT_PKG);
    }
}
// 앱 안에서 재생 (화면 아래 시트)
function videoPlay(id, title) {
    famSheet(`<div class="fam-h"><b style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${famEsc(title || '영상')}</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
        <div class="yt-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
        <div class="fam-btns"><button class="fam-btn" onclick="famSheetClose();ytOpen('https://www.youtube.com/watch?v=${id}','${YT_PKG}')">유튜브 앱에서 보기</button><button class="fam-btn" onclick="famShare('https://youtu.be/${id}')">공유</button></div>`);
}

// 말로 하는 요청 판단 (agent.js agRoute에서 먼저 호출)
function mediaRoute(t) {
    if (/(영상|동영상|유튜브)/.test(t) && /(찾아|보여|검색|틀어|볼래|보고\s*싶)/.test(t)) { videoSearch(t); return true; }
    if (/(틀어\s*(줘|줄래|주세요)|들려\s*(줘|줄래|주세요)|재생\s*해?\s*(줘|주세요)|노래\s*켜\s*줘|음악\s*켜\s*줘)[.!]?$/.test(t)) { musicPlay(t); return true; }
    return false;
}
