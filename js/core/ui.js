        // ── 라이트박스 ──────────────────────────────────────────────────
        function openLightbox(src) {
            const lb = document.getElementById('lightbox');
            const img = document.getElementById('lightbox-img');
            img.src = src;
            lb.style.display = 'flex';
            history.pushState({ modal: 'lightbox' }, '', '');
        }

        // ── 이미지 압축 ──────────────────────────────────────────────────
        function compressImage(base64, size = 600, quality = 0.4) {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = base64;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > size) { h *= size / w; w = size; } }
                    else { if (h > size) { w *= size / h; h = size; } }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
            });
        }

        // ── 모달 공통 ──────────────────────────────────────────────────
        function resetModal() {
            // 모든 field-group 숨김
            document.querySelectorAll('.field-group').forEach(g => g.classList.add('hidden'));
            // 텍스트/숫자/날짜/textarea 초기화 (range 제외)
            document.querySelectorAll('#master-modal input[type="text"], #master-modal input[type="number"], #master-modal input[type="date"], #master-modal textarea').forEach(i => i.value = '');
            // select 초기화
            document.querySelectorAll('#master-modal select').forEach(s => s.selectedIndex = 0);
            // hidden input 초기화 (칩 연동값)
            const hiddenDefaults = {
                'edit-id': '',
                'sch-priority': '일반',
                'sch-member':   '정우설',
                'sch-category': '개인',
            };
            Object.entries(hiddenDefaults).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            });
            // 칩 버튼 active 초기화
            resetChips('sch-priority-group', '일반',   'sch-priority');
            resetChips('sch-member-group',   '정우설', 'sch-member');
            resetChips('sch-category-group', '개인',   'sch-category');
            // plan 칩 초기화 (plan-fields용)
            // asset 칩 초기화
            const amg = document.getElementById('as-member-group');
            if (amg) {
                resetChips('as-member-group',     '정우설', 'as-member');
                resetChips('as-type-group',       '수입',   'as-type');
                resetChips('as-income-cat-group', '급여',   'as-income-cat');
                resetChips('as-pay-group',        '카드',   'as-pay');
                const incSec = document.getElementById('as-income-section');
                const expSec = document.getElementById('as-expense-section');
                if (incSec) incSec.style.display = '';
                if (expSec) expSec.style.display = 'none';
            }
            const pmg = document.getElementById('plan-member-group');
            if (pmg) resetChips('plan-member-group', '공통',  'plan-member');
            const pag = document.getElementById('plan-area-group');
            if (pag) resetChips('plan-area-group',   '국내',  'plan-main-type');
            const ptg = document.getElementById('plan-type-group');
            if (ptg) resetChips('plan-type-group',   '여행',  'plan-sub-type');
            // day-schedule-wrap 초기화
            const dsw = document.getElementById('day-schedule-wrap');
            if (dsw) dsw.innerHTML = '';
            // 반복 체크박스 초기화
            const repChk = document.getElementById('sch-repeat-chk');
            if (repChk) { repChk.checked = false; }
            const repBox = document.getElementById('sch-repeat-box');
            if (repBox) { repBox.style.display = 'none'; }
            const repEnd = document.getElementById('sch-repeat-end');
            if (repEnd) { repEnd.value = ''; }
            // 삭제 버튼 숨김
            document.getElementById('btn-del').classList.add('hidden');
            document.getElementById('btn-save').innerText = '저장';
        }

        function openModal() {
            const m = document.getElementById('master-modal');
            m.style.display = 'flex';
            history.pushState({ modal: 'master' }, '', '');
        }

        // ── 메인 대시보드 렌더 ──────────────────────────────────────────

