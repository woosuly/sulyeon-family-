    // ═══════════════════════════════════════════════════════════
    // 📑 월간 AI 가계부 리포트
    // ═══════════════════════════════════════════════════════════
    const rpt = { ym: '', doc: null, unsub: null, busy: false };
    function rptPrevYM(n) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n || 1)); return famYmd(d).slice(0, 7); }
    function rptWatch(ym) {
        rpt.ym = ym; if (rpt.unsub) { try { rpt.unsub(); } catch (e) {} }
        try { rpt.unsub = db.collection('budgetReports').doc(ym).onSnapshot(d => { rpt.doc = d.exists ? d.data() : null; rptRender(); famHomeBanners(); }, () => { rpt.doc = null; rptRender(); }); } catch (e) { rptRender(); }
    }
    function rptMonthData(ym) {
        const all = anaAll().filter(e => e._ym === ym), sum = (arr, t) => arr.filter(e => e.type === t).reduce((a, e) => a + e.amt, 0);
        const byCat = {}; all.filter(e => e.type === '지출').forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amt);
        const byMem = {}; all.filter(e => e.type === '지출').forEach(e => byMem[e._m] = (byMem[e._m] || 0) + e.amt);
        return { ym, n: all.length, inc: sum(all, '수입'), exp: sum(all, '지출'), byCat, byMem, fixed: all.filter(e => e.fixedId).reduce((a, e) => a + e.amt, 0) };
    }
    function rptRender() {
        const el = document.getElementById('rpt-root'); if (!el) return;
        const opts = Array.from({ length: 12 }, (_, i) => rptPrevYM(i + 1)), d = rptMonthData(rpt.ym);
        el.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><select class="fam-sel" style="flex:1" onchange="rptWatch(this.value)">${opts.map(o => `<option value="${o}" ${o === rpt.ym ? 'selected' : ''}>${o.replace('-', '년 ')}월</option>`).join('')}</select>
            ${d.n ? `<button class="fam-btn ${rpt.doc ? '' : 'pri'}" onclick="rptMake()" ${rpt.busy ? 'disabled' : ''}>${rpt.doc ? '다시 만들기' : '리포트 만들기'}</button>` : ''}</div>
            <div class="fam-note" style="margin:0 0 8px">${d.n ? `수입 ${anaW(d.inc)} · 지출 ${anaW(d.exp)} · ${d.n}건${d.fixed ? ' · 고정지출 ' + anaW(d.fixed) : ''}` : '이 달의 가계부 내역이 없습니다.'}</div>
            ${rpt.busy ? '<div><span class="fam-spin"></span>리포트를 만드는 중…</div>' : rpt.doc ? `<div class="fam-ai">${famMd(rpt.doc.text || '')}</div><div class="fam-note">${famEsc(rpt.doc.by || '')} · ${famEsc(rpt.doc.ai || '')}</div>` : ''}`;
    }
    async function rptMake() {
        const ym = rpt.ym, cur = rptMonthData(ym), prev = rptMonthData(prevOf(ym)), p3 = [1, 2, 3].map(i => rptMonthData(prevOf(ym, i)));
        function prevOf(y, n) { const d = new Date(y + '-01T00:00:00'); d.setMonth(d.getMonth() - (n || 1)); return famYmd(d).slice(0, 7); }
        const bud = Object.entries(famBudget || {}).map(([k, v]) => k + ' ' + v).join(', '), sav = (svGoals || []).filter(g => !g.archived).map(g => `${g.name} ${svSaved(g.id)}${g.target ? '/' + g.target : ''}`).join(', ');
        const fmt = o => `${o.ym}: 수입 ${o.inc}, 지출 ${o.exp}, 항목 ${Object.entries(o.byCat).map(([k, v]) => k + ' ' + v).join(', ') || '없음'}, 구성원별 지출 ${Object.entries(o.byMem).map(([k, v]) => k + ' ' + v).join(', ') || '없음'}, 고정지출 ${o.fixed}`;
        rpt.busy = true; rptRender();
        try {
            const r = await famCallAI('너는 부부가 함께 보는 가족 가계부의 월간 리포트를 쓰는 재무 코치다. 주어진 숫자만 근거로, 평이한 한국어로 짧고 구체적으로 쓴다. 금액은 만원 단위로 반올림한다. 훈계하지 않는다.',
                `대상 월 ${fmt(cur)}\n전월 ${fmt(prev)}\n직전 3개월: ${p3.map(fmt).join(' / ')}\n항목별 월 예산: ${bud || '없음'}\n저축 목표(모은 금액/목표): ${sav || '없음'}\n\n예산이 있으면 예산 대비로 평가하라.\n형식:\n**한 줄 요약**\n**잘한 점** (1~2개)\n**늘어난 지출** (전월·3개월 평균 대비 숫자)\n**구성원별 한 줄**\n**다음 달 제안** (현실적인 2~3개)`, { maxTokens: 1500 });
            const doc = { ym, text: r.text || '', by: famUser() || '가족', ai: FAM_NAMES[famProv()] + ' · ' + famModel(famProv()), createdAt: Date.now() };
            try { await db.collection('budgetReports').doc(ym).set(doc); } catch (e) { rpt.doc = doc; }
        } catch (e) { famToast('리포트 실패: ' + e.message); }
        rpt.busy = false; rptRender();
    }

    // ═══════════════════════════════════════════════════════════
    // 🏠 홈 배너 (리포트 안내 · 장보기)
    // ═══════════════════════════════════════════════════════════
    let rptHomeDoc = undefined;
    function famHomeBanners() {
        const el = document.getElementById('fam-home-banners'); if (!el) return;
        let h = '';
        const pym = rptPrevYM(1);
        if (new Date().getDate() <= 10 && rptHomeDoc === null && typeof anaAll === 'function' && anaAll().some(e => e._ym === pym))
            h += `<div class="home-banner" onclick="showSection('asset-analysis-section')"><span>📑</span><b>${+pym.slice(5)}월 가계부 리포트를 만들 수 있어요</b><span style="color:#94a3b8">›</span></div>`;
        const gs = (typeof svGoals !== 'undefined' ? svGoals : []).filter(g => !g.archived && +g.target > 0).map(g => ({ g, p: Math.round(svSaved(g.id) / g.target * 100) })).filter(o => o.p < 100).sort((a, b) => (a.g.deadline || '9999').localeCompare(b.g.deadline || '9999'))[0];
        if (gs) h += `<div class="home-banner" onclick="showSection('save-section')"><span>🎯</span><b>${famEsc(gs.g.name)} ${gs.p}%</b><span style="color:#94a3b8;font-size:12px">${svW(svSaved(gs.g.id))} / ${svW(gs.g.target)}</span></div>`;
        el.innerHTML = h;
        famHomeToday();
    }
    function famHomeToday() {
        const el = document.getElementById('home-today'); if (!el) return;
        const now = new Date(), t = famYmd(now), ym = t.slice(0, 7), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const sch = (typeof schData !== 'undefined' ? schData : []).filter(x => x.date === t).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        const nx = sch.find(x => x.startTime && x.startTime >= hm) || sch.find(x => !x.startTime) || null;
        const exp = typeof anaAll === 'function' ? anaAll().filter(e => e._ym === ym && e.type === '지출').reduce((a, e) => a + e.amt, 0) : 0;
        const trip = (typeof planData !== 'undefined' ? planData : []).filter(p => p.start && (p.end || p.start) >= t).sort((a, b) => a.start.localeCompare(b.start))[0];
        const dd = trip ? Math.round((new Date(trip.start + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5) : null;
        const shop = (famShopItems || []).filter(i => !i.done);
        const man = n => n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만원` : `${n.toLocaleString('ko-KR')}원`;
        el.innerHTML = `
            <div class="ht-tile" onclick="showSection('schedule-section')"><small>${fi('calendar')}오늘 일정</small><b>${sch.length ? sch.length + '건' : '없음'}</b><span>${nx ? famEsc((nx.startTime ? nx.startTime + ' ' : '') + (nx.memo || '')) : '&nbsp;'}</span></div>
            <div class="ht-tile" onclick="showSection('asset-section')"><small>${fi('wallet')}${+ym.slice(5)}월 지출</small><b>${man(exp)}</b><span>${(() => { const bt = typeof budgetTotal === 'function' ? budgetTotal() : 0; if (!bt) return '&nbsp;'; const sp = budgetSpent(ym), used = Object.keys(famBudget).reduce((a, c) => a + (sp[c] || 0), 0), p = Math.round(used / bt * 100); return `<span style="color:${budgetColor(p)};font-weight:700">예산 ${p}%</span>`; })()}</span></div>
            <div class="ht-tile" onclick="showSection('travel-section')"><small>${fi('plane')}다음 여행</small><b>${trip ? (dd > 0 ? 'D-' + dd : '진행 중') : '없음'}</b><span>${trip ? famEsc(trip.loc || '') : '&nbsp;'}</span></div>
            <div class="ht-tile" onclick="showSection('shop-section')"><small>${fi('cart')}장보기</small><b>${shop.length ? shop.length + '개' : '없음'}</b><span>${shop.length ? famEsc(shop.slice(0, 3).map(i => i.text).join(', ')) : '&nbsp;'}</span></div>`;
    }
    function famHomeReportWatch() { try { db.collection('budgetReports').doc(rptPrevYM(1)).onSnapshot(d => { rptHomeDoc = d.exists ? d.data() : null; famHomeBanners(); }, () => {}); } catch (e) {} }

