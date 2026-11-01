    // ═══════════════════════════════════════════════════════════
    // 📰 NEWS 브리프
    // ═══════════════════════════════════════════════════════════
    const NEWS_CATS = [['economy', '경제', '💹'], ['stock', '주식', '📈'], ['world', '세계', '🌍'], ['society', '사회', '🏛️'], ['ent', '연예', '🎬'], ['sports', '스포츠', '⚽']];
    let newsDate = null, newsUnsub = null, newsBusy = false;
    function newsTZ() { try { return (typeof userTimezone !== 'undefined' && userTimezone) || 'Asia/Seoul'; } catch (e) { return 'Asia/Seoul'; } }
    function newsKST(offsetDays) {
        const d = new Date(Date.now() + (offsetDays || 0) * 864e5);
        try {
            const f = new Intl.DateTimeFormat('en-CA', { timeZone: newsTZ(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
            const q = {}; f.formatToParts(d).forEach(x => q[x.type] = x.value);
            return { date: `${q.year}-${q.month}-${q.day}`, hour: +q.hour };
        } catch (e) { const k = new Date(d.getTime() + 9 * 3600e3); return { date: k.toISOString().slice(0, 10), hour: k.getUTCHours() }; }
    }
    function newsLocalGet(date) { try { return JSON.parse(famLS('newsBrief_' + date) || 'null'); } catch (e) { return null; } }
    function newsOnEnter() {
        try { db.collection('config').doc('newsBrief').set({ timezone: newsTZ(), city: (typeof userCityName !== 'undefined' && userCityName) || '', updatedAt: Date.now() }, { merge: true }); } catch (e) {}
        const t = newsKST(0);
        newsDate = t.hour >= 8 ? t.date : newsKST(-1).date;
        newsWatch();
    }
    function newsWatch() {
        if (newsUnsub) { try { newsUnsub(); } catch (e) {} newsUnsub = null; }
        const date = newsDate, local = newsLocalGet(date);
        newsRender(local, date);
        try {
            newsUnsub = db.collection('newsBriefs').doc(date).onSnapshot(doc => {
                const d = doc.exists ? doc.data() : null;
                if (d && d.status === 'done') { famLS('newsBrief_' + date, JSON.stringify(d)); newsRender(d, date); }
                else if (d && d.status === 'generating' && Date.now() - (d.startedAt || 0) < 4 * 60e3) newsRender(null, date, (d.by || '가족') + '님이 브리프를 만드는 중입니다…');
                else newsMaybeAuto(date);
            }, () => newsMaybeAuto(date));
        } catch (e) { newsMaybeAuto(date); }
    }
    function newsMaybeAuto(date) {
        if (newsLocalGet(date)) return;
        const t = newsKST(0);
        if (date === t.date && t.hour >= 8 && (famKeys()[famProv()] || '')) newsGenerate(false);
        else newsRender(null, date);
    }
    function newsNav(d) {
        const cur = new Date(newsDate + 'T00:00:00Z'); cur.setUTCDate(cur.getUTCDate() + d);
        const nd = cur.toISOString().slice(0, 10); if (nd > newsKST(0).date) return;
        newsDate = nd; newsWatch();
    }
    async function newsGenerate(force) {
        if (newsBusy) return;
        const date = newsDate, t = newsKST(0);
        if (date !== t.date) { famToast('지난 날짜는 새로 만들 수 없습니다'); return; }
        if (force && !confirm('오늘 브리프를 새로 만들까요? (1~2분 소요)')) return;
        if (!(famKeys()[famProv()] || '')) { newsRender(null, date); famOpenSettings(); return; }
        newsBusy = true;
        const who = (typeof localStorage !== 'undefined' && localStorage.getItem('chatUser')) || '가족';
        newsRender(null, date, 'AI가 오늘 뉴스를 검색하고 정리하는 중입니다… (1~2분)');
        try { await db.collection('newsBriefs').doc(date).set({ status: 'generating', startedAt: Date.now(), by: who }, { merge: true }); } catch (e) {}
        const sys = '너는 한국 독자를 위한 아침 뉴스 브리핑 편집자다. 반드시 웹 검색으로 확인한 최근 24시간 이내 실제 보도만 사용한다. 기억이나 추측으로 쓰지 않는다. 평이한 한국어로 사실 위주로 쓴다.';
        const user = `오늘은 ${date} (${newsTZ()} 기준)이다. 아래 분야별 최신 주요 뉴스를 웹 검색해 정리하라.
분야와 키: 경제(economy), 주식(stock: 코스피·코스닥 흐름과 전일 미국 증시 마감 포함), 세계(world), 사회(society), 연예(ent), 스포츠(sports).
각 분야마다 summary는 핵심을 한국어 2~3문장으로, items는 주요 기사 3개로 title(한국어 기사 제목), source(언론사), url(검색 결과에서 확인한 기사 원문 주소, 확인 못하면 빈 문자열).
headline은 오늘의 흐름을 한 문장으로.
출력은 JSON만: {"headline":"","sections":[{"key":"economy","summary":"","items":[{"title":"","source":"","url":""}]}]}`;
        try {
            const r = await famCallAI(sys, user, { search: true, maxTokens: 6000 });
            const txt = r.text || '', a = txt.indexOf('{'), b = txt.lastIndexOf('}');
            if (a < 0 || b < a) throw new Error('응답 형식을 읽지 못했습니다');
            const parsed = JSON.parse(txt.slice(a, b + 1));
            const seen = new Set(), sources = (r.sources || []).filter(s => /^https?:/.test(s.url) && !seen.has(s.url) && seen.add(s.url)).slice(0, 30);
            const sections = NEWS_CATS.map(([k]) => { const s = (parsed.sections || []).find(x => x.key === k) || {}; return { key: k, summary: s.summary || '', items: (s.items || []).slice(0, 4).map(i => ({ title: i.title || '', source: i.source || '', url: /^https?:\/\//.test(i.url || '') ? i.url : '' })) }; });
            const doc = { status: 'done', date, headline: parsed.headline || '', sections, sources, by: who, ai: FAM_NAMES[famProv()] + ' · ' + famModel(famProv()), createdAt: Date.now() };
            famLS('newsBrief_' + date, JSON.stringify(doc));
            try { await db.collection('newsBriefs').doc(date).set(doc); } catch (e) {}
            newsRender(doc, date);
        } catch (e) {
            try { await db.collection('newsBriefs').doc(date).set({ status: 'failed', startedAt: 0 }, { merge: true }); } catch (_) {}
            newsRender(null, date, null, '브리프 생성 실패: ' + e.message + ' — ⚙️ 설정에서 다른 AI로 바꿔 다시 시도해 보세요.');
        }
        newsBusy = false;
    }
    function newsRender(d, date, busyMsg, errMsg) {
        const body = document.getElementById('news-body'), meta = document.getElementById('news-meta'); if (!body) return;
        const t = newsKST(0), isToday = date === t.date;
        meta.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <button class="fam-btn" onclick="newsNav(-1)">◀</button>
            <div style="flex:1;text-align:center;font-weight:800;font-size:14px;color:#1e293b;">${date}${isToday ? ' · 오늘' : ''}</div>
            <button class="fam-btn" onclick="newsNav(1)" ${isToday ? 'disabled' : ''}>▶</button></div>`;
        if (busyMsg) { body.innerHTML = `<div class="fam-box" style="text-align:center;padding:28px 14px;"><span class="fam-spin"></span>${famEsc(busyMsg)}</div>`; return; }
        if (!d) {
            const hasKey = !!(famKeys()[famProv()] || '');
            let msg = isToday ? (t.hour >= 8 ? '오늘 브리프가 아직 없습니다.' : `오늘 브리프는 ${famEsc(newsTZ())} 기준 오전 8시에 만들어집니다.`) : '이 날짜의 브리프가 없습니다.';
            body.innerHTML = `${errMsg ? `<div class="fam-box" style="color:#b91c1c;font-size:13px;">${famEsc(errMsg)}</div>` : ''}
                <div class="fam-box" style="text-align:center;padding:24px 14px;font-size:13px;color:#64748b;">${msg}
                ${isToday && t.hour >= 8 ? (hasKey ? `<div class="fam-btns" style="justify-content:center"><button class="fam-btn pri" onclick="newsGenerate(false)">지금 만들기</button></div>` : `<div class="fam-btns" style="justify-content:center"><button class="fam-btn pri" onclick="famOpenSettings()">⚙️ AI 키 설정</button></div>`) : ''}
                ${isToday && t.hour < 8 ? `<div class="fam-btns" style="justify-content:center"><button class="fam-btn" onclick="newsNav(-1)">어제 브리프 보기</button></div>` : ''}</div>`;
            return;
        }
        let ct = ''; try { ct = d.createdAt ? new Date(d.createdAt).toLocaleTimeString('ko-KR', { timeZone: newsTZ(), hour: '2-digit', minute: '2-digit', hour12: false }) : ''; } catch (e) {}
        body.innerHTML = `${d.headline ? `<div class="news-head"><small>TODAY'S BRIEF</small><div>${famEsc(d.headline)}</div></div>` : ''}
            ${NEWS_CATS.map(([k, n, ic]) => { const s = (d.sections || []).find(x => x.key === k); if (!s || (!s.summary && !(s.items || []).length)) return ''; return `<div class="news-card"><h4>${ic} ${n}</h4>${s.summary ? `<p>${famEsc(s.summary)}</p>` : ''}${(s.items || []).map(i => i.url ? `<a class="news-item" href="${famEsc(i.url)}" target="_blank" rel="noopener"><b>${famEsc(i.title)}</b><span>${famEsc(i.source)} ↗</span></a>` : `<div class="news-item nolink"><b>${famEsc(i.title)}</b><span>${famEsc(i.source)}</span></div>`).join('')}</div>`; }).join('')}
            ${(d.sources || []).length ? `<details class="fam-box"><summary style="font-size:12px;font-weight:700;color:#64748b;cursor:pointer;">검색에 사용된 출처 ${d.sources.length}건</summary><div style="margin-top:8px">${d.sources.map(s => `<a href="${famEsc(s.url)}" target="_blank" rel="noopener" style="display:block;font-size:12px;padding:4px 0;color:#2563eb;word-break:break-all;">${famEsc(s.title)}</a>`).join('')}</div></details>` : ''}
            <div class="fam-note" style="text-align:center">${ct ? ct + ' 생성' : ''}${d.by ? ' · ' + famEsc(d.by) : ''}${d.ai ? ' · ' + famEsc(d.ai) : ''} · AI 요약이라 세부 내용은 원문 기사로 확인하세요</div>
            ${isToday ? `<div class="fam-btns" style="justify-content:center"><button class="fam-btn" onclick="newsGenerate(true)">다시 만들기</button></div>` : ''}`;
    }

