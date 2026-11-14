        // ── 가계부 ──────────────────────────────────────────────────
        // 달력 칸이 좁아 만 단위로 줄여 표시 (520만, 3.9만, 8,790)
        function asShort(n) { n = Math.abs(Number(n) || 0); if (n >= 1e6) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만'; if (n >= 1e4) return (Math.round(n / 1e3) / 10) + '만'; return n.toLocaleString('ko-KR'); }
        function renderAssetCal() {
            const grid = document.getElementById('asset-cal-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const y = assetCalViewDate.getFullYear();
            const m = assetCalViewDate.getMonth();

            // 요일 헤더
            ['일','월','화','수','목','금','토'].forEach((d, i) => {
                const hd = document.createElement('div');
                hd.className = 'cal-day-header';
                hd.style.color = i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : '';
                hd.textContent = d;
                grid.appendChild(hd);
            });

            // 빈 셀
            const first = new Date(y, m, 1).getDay();
            const last  = new Date(y, m + 1, 0).getDate();
            for (let i = 0; i < first; i++) {
                const empty = document.createElement('div');
                empty.className = 'cal-cell';
                grid.appendChild(empty);
            }

            // 날짜 셀
            const today = new Date();
            const data  = getAssetData(); // assetMemberFilter 적용된 데이터

            for (let d = 1; d <= last; d++) {
                const ds   = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isToday = (y === today.getFullYear() && m === today.getMonth() && d === today.getDate());
                const dow  = new Date(y, m, d).getDay();

                const cell = document.createElement('div');
                cell.className = 'cal-cell';
                if (isToday) cell.style.background = 'var(--month-grad-a)';

                // 날짜 숫자
                const dn = document.createElement('strong');
                dn.style.fontSize = '11px';
                dn.style.color = isToday ? 'var(--month-header)' : (dow === 0 || famHoli(ds)) ? '#ef4444' : dow === 6 ? '#3b82f6' : ''; if (famHoli(ds)) dn.title = famHoli(ds);
                dn.textContent = d;
                cell.appendChild(dn);

                // 해당 날짜 항목
                const dayItems = data.filter(e => e.date === ds);
                const inc = dayItems.filter(e => e.type === '수입').reduce((s,e) => s+Number(e.amt), 0);
                const exp = dayItems.filter(e => e.type === '지출').reduce((s,e) => s+Number(e.amt), 0);

                if (inc > 0) {
                    const b = document.createElement('div');
                    b.style.cssText = 'font-size:10px;font-weight:700;color:#166534;background:#f0fdf4;border-radius:4px;padding:1px 3px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                    b.textContent = '+' + asShort(inc); b.title = inc.toLocaleString() + '원';
                    b.onclick = ev => { ev.stopPropagation(); openAssetDayModal(ds); };
                    cell.appendChild(b);
                }
                if (exp > 0) {
                    const b = document.createElement('div');
                    b.style.cssText = 'font-size:10px;font-weight:700;color:#991b1b;background:#fef2f2;border-radius:4px;padding:1px 3px;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                    b.textContent = '-' + asShort(exp); b.title = exp.toLocaleString() + '원';
                    b.onclick = ev => { ev.stopPropagation(); openAssetDayModal(ds); };
                    cell.appendChild(b);
                }

                cell.onclick = () => openAssetDayModal(ds);
                grid.appendChild(cell);
            }
        }

        // ── 입력 도우미: 금액 쉼표, 빠른 금액, 내용 보고 분류 자동 선택 ──
        let asCatTouched = false;
        function asAmtFmt(el) { const v = String(el.value).replace(/[^\d]/g, ''); el.value = v ? Number(v).toLocaleString('ko-KR') : ''; }
        function asAmtAdd(n) { const el = document.getElementById('as-amt'); const v = Number(String(el.value).replace(/[^\d]/g, '')) || 0; el.value = n ? (v + n).toLocaleString('ko-KR') : ''; }
        function asMemoCat(memo) {
            if (asCatTouched || document.getElementById('as-type').value !== '지출' || !memo.trim()) return;
            const c = (typeof famHistCat === 'function' && famHistCat(memo, '지출')) || (typeof famGuessCat === 'function' ? famGuessCat(memo, '지출') : '');
            if (!c || c === '기타지출') return;
            resetChips('as-expense-cat-group', c, 'as-expense-cat');
            document.getElementById('as-cat-hint').textContent = '· 내용 보고 자동 선택';
        }

        function openAssetEntryModal(data, date) {
            // 일별 모달 닫기
            const dm = document.getElementById('asset-day-modal');
            if (dm && !dm.classList.contains('hidden')) dm.classList.add('hidden');
            resetModal();

            document.getElementById('modal-title').innerText = data ? '가계부 수정' : '가계부 입력';
            document.getElementById('btn-save').innerText     = data ? '수정' : '저장';
            document.getElementById('asset-entry-fields').classList.remove('hidden');
            activeDateStr = date;

            if (data) {
                // 수정 시: 기존값 복원
                document.getElementById('edit-id').value = data.id || '';

                // 구성원 칩 복원
                resetChips('as-member-group', data.member || '정우설', 'as-member');

                // 수입/지출 칩 복원
                const typeVal = data.type === '지출' ? '지출' : '수입';
                resetChips('as-type-group', typeVal, 'as-type');

                // 카테고리/결제수단 복원
                if (typeVal === '수입') {
                    document.getElementById('as-income-section').style.display  = '';
                    document.getElementById('as-expense-section').style.display = 'none';
                    resetChips('as-income-cat-group', data.category || '급여', 'as-income-cat');
                } else {
                    document.getElementById('as-income-section').style.display  = 'none';
                    document.getElementById('as-expense-section').style.display = '';
                    resetChips('as-expense-cat-group', data.category || '생활비', 'as-expense-cat');
                    resetChips('as-pay-group', data.pay || '카드', 'as-pay');
                }

                document.getElementById('as-amt').value  = data.amt ? Number(data.amt).toLocaleString('ko-KR') : '';
                document.getElementById('as-memo').value = data.memo || '';
                document.getElementById('btn-del').classList.remove('hidden');
                asCatTouched = true;
            } else {
                // 신규 입력: 지출이 기본 (대부분 지출), 구성원은 입력하는 사람
                const me = (typeof famUser === 'function' && famUser()) || '정우설';
                resetChips('as-member-group',    ['정우설', '한미연'].includes(me) ? me : '정우설', 'as-member');
                resetChips('as-type-group',      '지출',    'as-type');
                resetChips('as-income-cat-group','급여',    'as-income-cat');
                resetChips('as-expense-cat-group','생활비', 'as-expense-cat');
                resetChips('as-pay-group',       '카드',    'as-pay');
                document.getElementById('as-income-section').style.display  = 'none';
                document.getElementById('as-expense-section').style.display = '';
                document.getElementById('as-amt').value  = '';
                document.getElementById('as-memo').value = '';
                asCatTouched = false;
            }
            document.getElementById('as-date').value = (data && data.date) || date;
            document.getElementById('as-cat-hint').textContent = '';
            document.getElementById('as-expense-cat-group').onclick = () => { asCatTouched = true; document.getElementById('as-cat-hint').textContent = ''; };
            if (!data) setTimeout(() => { const a = document.getElementById('as-amt'); if (a) a.focus(); }, 250);

            document.getElementById('btn-save').onclick = async () => {
                const id       = document.getElementById('edit-id').value || 'as_' + Date.now();
                const member   = document.getElementById('as-member').value   || '정우설';
                const type     = document.getElementById('as-type').value     || '수입';
                const amt      = Number(String(document.getElementById('as-amt').value).replace(/[^\d-]/g, '')) || 0;
                const dsave    = document.getElementById('as-date').value || activeDateStr;
                const memo     = document.getElementById('as-memo').value     || '';
                const category = type === '수입'
                    ? (document.getElementById('as-income-cat').value  || '급여')
                    : (document.getElementById('as-expense-cat').value || '생활비');
                const pay = type === '지출'
                    ? (document.getElementById('as-pay').value || '카드')
                    : '';

                if (!amt) { alert('금액을 입력해주세요.'); return; }

                await db.collection('assets').doc(id).set({
                    id, member, date: dsave,
                    type, category, pay, amt, memo,
                    ...(typeof famTripVals === 'function' ? famTripVals('as') : {})
                });
                closeModal();
            };

            document.getElementById('btn-del').onclick = async () => {
                if (confirm('이 항목을 삭제할까요?')) {
                    await db.collection('assets').doc(document.getElementById('edit-id').value).delete();
                    closeModal();
                }
            };

            if (typeof famTripAssetInit === 'function') famTripAssetInit(data, date);
            openModal();
            history.pushState({ modal: 'asset-entry' }, '', '');
        }

        // initAssetCharts → 하단 개선판 사용

