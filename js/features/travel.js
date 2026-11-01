        // ── 여행 & 여가 ──────────────────────────────────────────────────
        let travelFilter = 'all'; // 하위 호환 유지
        // 필터 상태
        const planFilters = { sort:'asc', period:'all', member:'all', area:'all', type:'all' };
        // 버튼 레이블 기본값
        const filterLabels = {
            sort:   { asc:'📅 정렬', desc:'📅 정렬' },
            period: { all:'🗓 기간' },   // 동적으로 채워짐
            member: { all:'👥 구성원', 공통:'👨‍👩‍👧 공통', 정우설:'👨 정우설', 한미연:'👩 한미연' },
            area:   { all:'🌐 지역', 국내:'🇰🇷 국내', 해외:'🌏 해외' },
            type:   { all:'🗂 유형', 여행:'✈️ 여행', 캠핑:'⛺ 캠핑', 골프:'⛳ 골프', 스크린골프:'🏌️ 스크린', 등산:'🏔️ 등산', 기타:'📌 기타' },
        };

        function togglePlanFilter(key) {
            const box = document.getElementById(`fbox-${key}`);
            if (!box) return;
            // 기간 박스 열 때 동적 옵션 생성
            if (key === 'period') buildPeriodOptions();
            const isOpen = box.style.display !== 'none';
            // 모든 박스 닫기
            ['sort','period','member','area','type'].forEach(k => {
                const b = document.getElementById(`fbox-${k}`);
                if (b) b.style.display = 'none';
                const btn = document.getElementById(`fbtn-${k}`);
                if (btn) btn.textContent = (filterLabels[k][planFilters[k]]||filterLabels[k].all) + (planFilters[k]==='all'?' ▾':' ✓');
            });
            // 클릭한 박스만 토글
            if (!isOpen) {
                box.style.display = 'block';
                document.getElementById(`fbtn-${key}`).textContent =
                    (filterLabels[key][planFilters[key]]||filterLabels[key].all) + ' ▴';
            }
            updateFilterButtons();
        }

        // 기간 필터 옵션 동적 생성 (데이터 기반)
        function buildPeriodOptions() {
            const allDates = (planData||[]).map(p=>p.start||'').filter(Boolean).sort();
            const years  = [...new Set(allDates.map(d=>d.slice(0,4)))].sort().reverse();
            const months = [...new Set(allDates.map(d=>d.slice(0,7)))].sort().reverse();

            // 주차 계산
            const weekSet = new Set();
            allDates.forEach(d => {
                const dt = new Date(d + 'T00:00:00');
                const dow = dt.getDay()||7;
                const mon = new Date(dt); mon.setDate(dt.getDate()-dow+1);
                const sun = new Date(mon); sun.setDate(mon.getDate()+6);
                const wn  = getWeekNumber(new Date(mon.getTime() + 3*86400000));
                const key = `W${mon.getFullYear()}-W${String(wn).padStart(2,'0')}~${famDs(mon)}~${famDs(sun)}`;
                weekSet.add(key);
            });
            const weeks = [...weekSet].sort().reverse();

            const cur = planFilters.period;
            const chip = (label, val) => {
                const isActive = cur === val;
                return `<span onclick="setPlanFilter('period','${val}')"
                    style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;
                    background:${isActive?'var(--month-header)':'#f1f5f9'};
                    color:${isActive?'white':'#374151'};">${label}</span>`;
            };

            const yEl = document.getElementById('fbox-period-years');
            const mEl = document.getElementById('fbox-period-months');
            const wEl = document.getElementById('fbox-period-weeks');
            if (yEl) yEl.innerHTML = years.map(y => chip(y+'년', 'Y'+y)).join('');
            if (mEl) mEl.innerHTML = months.map(m => {
                const [y,mo] = m.split('-');
                return chip(`${y.slice(2)}년 ${parseInt(mo)}월`, 'M'+m);
            }).join('');
            if (wEl) wEl.innerHTML = weeks.map(w => {
                const parts = w.split('~');
                const label = parts[0]; // W2026-W16 형태
                const wnLabel = 'W' + label.split('-W')[1];
                return chip(wnLabel, 'W'+parts[1]+'~'+parts[2]);
            }).join('');
        }

        function setPlanFilter(key, val) {
            planFilters[key] = val;
            // period 레이블 동적 업데이트
            if (key === 'period') {
                if (val === 'all') filterLabels.period.all = '🗓 기간';
                else if (val.startsWith('Y')) filterLabels.period[val] = '🗓 ' + val.slice(1)+'년';
                else if (val.startsWith('M')) { const [y,m]=val.slice(1).split('-'); filterLabels.period[val]='🗓 '+y.slice(2)+'년 '+parseInt(m)+'월'; }
                else if (val.startsWith('W')) { const wn=val.slice(1).split('~')[0]; filterLabels.period[val]='🗓 W'+wn.split('-W')[1]||wn; }
            }
            // 선택 시 박스 닫기
            const box = document.getElementById(`fbox-${key}`);
            if (box) box.style.display = 'none';
            // 버튼 텍스트 업데이트
            updateFilterButtons();
            // 선택된 옵션 표시
            document.querySelectorAll(`#fbox-${key} .plan-filter-option`).forEach(el => {
                el.classList.toggle('selected', el.onclick.toString().includes(`'${val}'`));
            });
            renderPlans();
        }

        function updateFilterButtons() {
            ['sort','period','member','area','type'].forEach(k => {
                const btn = document.getElementById(`fbtn-${k}`);
                if (!btn) return;
                const val = planFilters[k];
                const isActive = val !== 'all';
                const box = document.getElementById(`fbox-${k}`);
                const isOpen = box && box.style.display !== 'none';
                btn.className = 'plan-filter-btn' + (isActive ? ' active' : '');
                btn.textContent = (filterLabels[k][val] || filterLabels[k].all) + (isOpen ? ' ▴' : (isActive ? ' ✓' : ' ▾'));
            });
        }

        function filterPlans(btn) {
            document.querySelectorAll('.travel-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            travelFilter = btn.dataset.filter;
            renderPlans();
        }

        function getMemberBg(member) {
            return member === '정우설' ? '#dbeafe' : member === '한미연' ? '#fce7f3' : member === '공통' ? '#f0fdf4' : '#f1f5f9';
        }
        function getMemberColor(member) {
            return member === '정우설' ? '#1e40af' : member === '한미연' ? '#9d174d' : '#166534';
        }
        function getTypeIcon(type) {
            const map = { '여행':'✈️','캠핑':'⛺','골프':'⛳','스크린골프':'🏌️','등산':'🏔️','기타':'📌' };
            return map[type] || '📌';
        }
        function getDday(startDs) {
            const today = new Date(); today.setHours(0,0,0,0);
            const diff  = Math.ceil((new Date(startDs) - today) / 86400000);
            if (diff > 0)  return `D-${diff}`;
            if (diff === 0) return '🎉 D-Day!';
            return `D+${Math.abs(diff)}`;
        }

        // ── 여행 목록: 구성원·유형 체크 + 다가오는/지난 기록(최신순) ──
        const PLAN_TYPES = [['여행','✈️'],['캠핑','⛺'],['골프','⛳'],['스크린골프','🏌️'],['등산','🏔️'],['기타','📌']];
        const PLAN_F = (function(){ try { return JSON.parse(localStorage.getItem('planFilter2')||'null'); } catch(e){ return null; } })() || { m:'all', t:'all' };
        function planSet(g,v){ PLAN_F[g]=v; try{ localStorage.setItem('planFilter2',JSON.stringify(PLAN_F)); }catch(e){} renderPlans(); }
        function planChips(){
            const el=document.getElementById('plan-chips'); if(!el) return;
            el.innerHTML = `<div style="display:flex;gap:6px;">
                <select class="fam-mini-sel" style="flex:1" onchange="planSet('m',this.value)">${[['all','👥 구성원 전체'],['정우설','👨 정우설'],['한미연','👩 한미연'],['공통','👨‍👩‍👧 공통']].map(([k,n])=>`<option value="${k}" ${PLAN_F.m===k?'selected':''}>${n}</option>`).join('')}</select>
                <select class="fam-mini-sel" style="flex:1" onchange="planSet('t',this.value)"><option value="all">🗂 유형 전체</option>${PLAN_TYPES.map(([k,ic])=>`<option value="${k}" ${PLAN_F.t===k?'selected':''}>${ic} ${k}</option>`).join('')}</select></div>`;
        }
        function planCard(p){
            const card = document.createElement('div');
            card.className = 'travel-card';
            card.onclick = () => openTravelDetail(p);
            const mbg  = getMemberBg(p.member), mcol = getMemberColor(p.member), icon = getTypeIcon(p.subType);
            const dday = p.start ? getDday(p.start) : '';
            const nights = p.start && p.end ? Math.ceil((new Date(p.end)-new Date(p.start))/86400000) : 0;
            const duration = nights > 0 ? `${nights}박 ${nights+1}일` : '당일';
            card.innerHTML = `
                <div class="travel-card-header">
                    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                        <span style="font-size:18px;">${icon}</span>
                        <span style="font-weight:800;font-size:15px;color:#1e293b;">${escHtml(p.loc||'미정')}</span>
                        <span class="travel-card-badge" style="background:${mbg};color:${mcol};">${p.member||''}</span>
                        <span class="travel-card-badge" style="background:#f1f5f9;color:#64748b;">${p.subType||''}</span>
                    </div>
                    <span class="travel-dday">${dday}</span>
                </div>
                <div style="font-size:12px;color:#64748b;margin-bottom:5px;">📅 ${p.start||''} ~ ${p.end||''} &nbsp;·&nbsp; ${duration}</div>
                ${p.supplies ? `<div style="font-size:11px;color:#94a3b8;">🎒 ${escHtml(p.supplies)}</div>` : ''}
                ${typeof tripCardCost === 'function' ? tripCardCost(p) : ''}`;
            return card;
        }
        function renderPlans() {
            const c = document.getElementById('plan-list-container');
            if (!c) return;
            planChips();
            c.innerHTML = '';
            let data = [...(planData || [])];
            const mk = p => (p.member==='정우설'||p.member==='한미연') ? p.member : '공통';
            const tk = p => PLAN_TYPES.some(([k])=>k===p.subType) ? p.subType : '기타';
            data = data.filter(p => (PLAN_F.m==='all' || mk(p)===PLAN_F.m) && (PLAN_F.t==='all' || tk(p)===PLAN_F.t));
            if (planFilters.area !== 'all') data = data.filter(p => p.mType === planFilters.area);
            const fPeriod = planFilters.period;
            if (fPeriod !== 'all') {
                if (fPeriod.startsWith('Y'))      data = data.filter(p => (p.start||'').startsWith(fPeriod.slice(1)));
                else if (fPeriod.startsWith('M')) data = data.filter(p => (p.start||'').startsWith(fPeriod.slice(1)));
                else if (fPeriod.startsWith('W')) { const [ws, we] = fPeriod.slice(1).split('~'); data = data.filter(p => p.start >= ws && p.start <= we); }
            }
            if (!data.length) {
                c.innerHTML = `<div style="text-align:center;color:#cbd5e1;padding:30px 0;font-size:13px;">해당하는 계획이 없습니다.</div>`;
                return;
            }
            const t = new Date(), todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
            const upcoming = data.filter(p => (p.end||p.start||'') >= todayStr).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
            const past     = data.filter(p => (p.end||p.start||'') <  todayStr).sort((a,b)=>(b.start||'').localeCompare(a.start||''));
            const head = (txt) => { const h=document.createElement('div'); h.style.cssText='font-size:11px;font-weight:800;color:#64748b;letter-spacing:.5px;margin:6px 2px 8px;'; h.textContent=txt; return h; };
            if (upcoming.length) { c.appendChild(head(`다가오는 계획 ${upcoming.length}`)); upcoming.forEach(p => c.appendChild(planCard(p))); }
            if (past.length) {
                c.appendChild(head(`지난 기록 ${past.length} · 최신순`));
                const years = [...new Set(past.map(p => (p.start||'').slice(0,4) || '기타'))];
                years.forEach((y, i) => {
                    const items = past.filter(p => ((p.start||'').slice(0,4) || '기타') === y);
                    const d = document.createElement('details');
                    d.open = i === 0;
                    d.style.cssText = 'margin-bottom:8px;';
                    d.innerHTML = `<summary style="cursor:pointer;font-size:13px;font-weight:800;color:#1e293b;padding:8px 4px;">${y}년 · ${items.length}건</summary>`;
                    items.forEach(p => d.appendChild(planCard(p)));
                    c.appendChild(d);
                });
            }
        }

        // ── 여행 상세 모달 ──────────────────────────────────────────────
        let currentPlanId = null;

        function openTravelDetail(p) {
            currentPlanId = p.id;
            const icon = getTypeIcon(p.subType);
            const mbg  = getMemberBg(p.member);
            const mcol = getMemberColor(p.member);
            const nights = p.start && p.end ? Math.ceil((new Date(p.end)-new Date(p.start))/86400000) : 0;
            const duration = nights > 0 ? `${nights}박 ${nights+1}일` : '당일';

            document.getElementById('travel-detail-title').innerHTML =
                `${icon} ${escHtml(p.loc||'미정')} <span style="font-size:12px;font-weight:500;color:#94a3b8;">${p.subType||''}</span>`;

            let dayHtml = '';
            if (p.dayMemos && p.dayMemos.some(m => m)) {
                dayHtml = `<div style="margin-top:10px;border-top:1px solid #f1f5f9;padding-top:10px;">` +
                    p.dayMemos.map((m,i) => m ? `
                        <div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f8fafc;">
                            <span style="font-size:11px;font-weight:700;color:var(--month-accent);white-space:nowrap;min-width:48px;">Day ${i+1}</span>
                            <span style="font-size:12px;color:#374151;">${escHtml(m)}</span>
                        </div>` : ''
                    ).join('') + `</div>`;
            }

            document.getElementById('travel-detail-body').innerHTML = `
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
                    <span class="travel-card-badge" style="background:${mbg};color:${mcol};">${p.member||''}</span>
                    <span class="travel-card-badge" style="background:#f1f5f9;color:#64748b;">${p.mType||''}</span>
                </div>
                <div style="font-size:13px;color:#374151;margin-bottom:4px;">📅 ${p.start||''} ~ ${p.end||''} &nbsp;·&nbsp; <b>${duration}</b>
                ${(p.subType==='골프'||p.subType==='스크린골프')&&p.startTime ? `<span style="margin-left:8px;font-size:12px;color:#3b82f6;">⏰ ${p.startTime}</span>` : ''}
                </div>
                ${dayHtml}
                ${p.supplies ? `<div style="margin-top:10px;font-size:12px;color:#64748b;">🎒 <b>준비물</b>: ${escHtml(p.supplies)}</div>` : ''}
                ${p.memo     ? `<div style="margin-top:6px;font-size:12px;color:#64748b;">📝 <b>메모</b>: ${escHtml(p.memo)}</div>` : ''}
                ${typeof tripRecordHtml === 'function' ? tripRecordHtml(p) : ''}
            `;

            document.getElementById('travel-edit-btn').onclick = () => {
                closeTravelDetail();
                openPlanModal(p);
            };
            document.getElementById('travel-del-btn').onclick = async () => {
                if (!confirm('이 계획을 삭제할까요?')) return;
                await deletePlan(p.id);
                closeTravelDetail();
            };
            document.getElementById('travel-detail-modal').classList.remove('hidden');
            history.pushState({ modal: 'travel-detail' }, '', '');
        }

        function closeTravelDetail() {
            document.getElementById('travel-detail-modal').classList.add('hidden');
            currentPlanId = null;
        }

        // ── 여행 입력/수정 모달 ─────────────────────────────────────────
        function openPlanModal(data) {
            resetModal();
            const isEdit = !!(data && data.id);
            document.getElementById('modal-title').innerText = isEdit ? '✏️ 계획 수정' : '＋ 새 계획 추가';
            document.getElementById('btn-save').innerText = isEdit ? '수정 저장' : '저장';
            document.getElementById('plan-fields').classList.remove('hidden');

            resetChips('plan-member-group', '공통',   'plan-member');
            resetChips('plan-area-group',   '국내',   'plan-main-type');
            resetChips('plan-type-group',   '여행',   'plan-sub-type');

            if (isEdit) {
                document.getElementById('edit-id').value         = data.id;
                document.getElementById('plan-loc').value        = data.loc      || '';
                document.getElementById('plan-start-date').value = data.start    || '';
                document.getElementById('plan-end-date').value   = data.end      || '';
                document.getElementById('plan-supplies').value   = data.supplies || '';
                document.getElementById('plan-memo').value       = data.memo     || '';
                if (document.getElementById('plan-start-time')) document.getElementById('plan-start-time').value = data.startTime || '';
                if (document.getElementById('plan-end-time'))   document.getElementById('plan-end-time').value   = data.endTime   || '';
                resetChips('plan-member-group', data.member  || '공통', 'plan-member');
                resetChips('plan-area-group',   data.mType   || '국내', 'plan-main-type');
                resetChips('plan-type-group',   data.subType || '여행', 'plan-sub-type');
                togglePlanTimeSection(); // 골프/스크린골프면 시간 입력란 표시
                generateDayInputs();
                const dInputs = document.querySelectorAll('.day-input');
                (data.dayMemos || []).forEach((m, i) => { if (dInputs[i]) dInputs[i].value = m; });
                document.getElementById('btn-del').classList.remove('hidden');
            }

            document.getElementById('btn-save').onclick = savePlan;
            document.getElementById('btn-del').onclick = async () => {
                if (!confirm('이 계획을 삭제할까요?')) return;
                await deletePlan(document.getElementById('edit-id').value);
                closeModal();
            };
            openModal();
        }

        async function savePlan() {
            const planId  = document.getElementById('edit-id').value || 'p_' + Date.now();
            const member  = document.getElementById('plan-member').value;
            const mType   = document.getElementById('plan-main-type').value;
            const subType = document.getElementById('plan-sub-type').value;
            const loc     = document.getElementById('plan-loc').value.trim();
            const start   = document.getElementById('plan-start-date').value;
            const end     = document.getElementById('plan-end-date').value;
            const supplies= document.getElementById('plan-supplies').value.trim();
            const memo    = document.getElementById('plan-memo').value.trim();
            const dayMemos= Array.from(document.querySelectorAll('.day-input')).map(i => i.value);

            if (!loc)   { alert('목적지를 입력해주세요.'); return; }
            if (!start) { alert('시작일을 선택해주세요.'); return; }

            const schMember = member === '공통' ? '' : member;
            const startTime = document.getElementById('plan-start-time')?.value || '';
            const endTime   = document.getElementById('plan-end-time')?.value || '';
            const endDate   = end || start;
            const nights    = Math.ceil((new Date(endDate) - new Date(start)) / 86400000);
            const days      = Math.max(nights + 1, 1);

            const batch = db.batch();
            const oldSchs = await db.collection('schedules').where('planId','==',planId).get();
            oldSchs.docs.forEach(d => batch.delete(d.ref));

            const prevPlan = (planData || []).find(x => x.id === planId) || {};
            batch.set(db.collection('plans').doc(planId), {
                id: planId, member, mType, subType, loc,
                start, end: endDate, startTime, endTime, supplies, memo, dayMemos,
                albumId: prevPlan.albumId || '', currency: prevPlan.currency || ''
            });

            for (let i = 0; i < days; i++) {
                const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + i);
                const ds = famDs(d);
                const dayMemo = dayMemos[i] || '';
                const icon = getTypeIcon(subType);
                batch.set(db.collection('schedules').doc(`sch_${planId}_${i}`), {
                    id: `sch_${planId}_${i}`, planId,
                    date: ds, member: schMember,
                    category: '공통', priority: '일반', place: loc,
                    subType,
                    timeType:  (subType === '골프' || subType === '스크린골프') && startTime ? 'timed' : 'allday',
                    startTime: (subType === '골프' || subType === '스크린골프') ? (startTime || '') : '',
                    endTime:   '',
                    memo: `[${subType}] ${loc}${dayMemo ? ': '+dayMemo : ''}`,
                });
            }
            await batch.commit();
            closeModal();
        }

        function generateDayInputs() {
            const start = document.getElementById('plan-start-date').value;
            const end   = document.getElementById('plan-end-date').value;
            const wrap  = document.getElementById('day-schedule-wrap');
            wrap.innerHTML = '';
            if (!start) return;
            const endDate = end || start;
            const nights  = Math.ceil((new Date(endDate) - new Date(start)) / 86400000);
            const days    = Math.max(nights + 1, 1);
            if (days > 1) {
                wrap.innerHTML = `<div style="font-size:11px;font-weight:700;color:#64748b;margin:14px 0 6px;">📋 일별 일정 (${days}일)</div>`;
                for (let i = 1; i <= days; i++) {
                    const d = new Date(start); d.setDate(d.getDate() + i - 1);
                    const ds = `${d.getMonth()+1}/${d.getDate()}`;
                    wrap.innerHTML += `
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span style="font-size:11px;font-weight:700;color:var(--month-accent);white-space:nowrap;min-width:54px;">Day${i}(${ds})</span>
                            <input type="text" class="day-input" placeholder="일정 입력" style="flex:1;margin-top:0;padding:8px 10px;font-size:13px;">
                        </div>`;
                }
            }
        }

        async function deletePlan(id) {
            const batch = db.batch();
            const schs = await db.collection('schedules').where('planId','==',id).get();
            schs.docs.forEach(d => batch.delete(d.ref));
            batch.delete(db.collection('plans').doc(id));
            await batch.commit();
        }

