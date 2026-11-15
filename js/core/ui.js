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


// ── 공통: 테마 색 (차트·요약 칸이 같은 색을 쓰도록) ──
function famThemeHex() { return (getComputedStyle(document.documentElement).getPropertyValue('--month-header') || '#2b3a55').trim() || '#2b3a55'; }
function famChartColor(kind, a) {
    if (kind === 'exp') return `rgba(225,86,107,${a ?? .7})`;
    const raw = famThemeHex(), m = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return `rgba(${m[1]},${m[2]},${m[3]},${a ?? .8})`;
    const h = ((raw.match(/#[0-9a-f]{3,6}/i) || ['#2b3a55'])[0]).replace('#', ''), f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(f, 16); if (isNaN(n)) return `rgba(43,58,85,${a ?? .8})`;
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a ?? .8})`;
}
// ── 공통: 작은 드롭다운 메뉴 (버튼 여러 줄 대신) — famMenu(버튼, [['이름', 함수], ...]) ──
function famMenu(anchor, items) {
    document.querySelectorAll('.fam-menu').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'fam-menu';
    items.forEach(([label, fn]) => { const b = document.createElement('button'); b.textContent = label; b.onclick = e => { e.stopPropagation(); m.remove(); fn(); }; m.appendChild(b); });
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(), w = m.offsetWidth;
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 10) + 'px';
    m.style.left = Math.max(10, Math.min(r.right - w, innerWidth - w - 10)) + 'px';
    setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off, true); } }, true), 0);
}

// ── 달력 좌우 넘기기: 왼쪽으로 밀면 다음 달, 오른쪽으로 밀면 이전 달 (일정·가계부 달력) ──
function famSwipe(el, go) {
    if (!el || el.dataset.swipe) return; el.dataset.swipe = '1';
    let x0 = 0, y0 = 0, t0 = 0, sx = null;
    el.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
        sx = e.target.closest && e.target.closest('[data-hscroll], .cal-scroll-area'); }, { passive: true });
    el.addEventListener('touchend', e => {
        const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        if (Date.now() - t0 > 700 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
        // 가로로 스크롤되는 영역이면 끝에 닿았을 때만 넘김
        if (sx && sx.scrollWidth > sx.clientWidth + 2) { const atL = sx.scrollLeft <= 1, atR = sx.scrollLeft + sx.clientWidth >= sx.scrollWidth - 2; if ((dx < 0 && !atR) || (dx > 0 && !atL)) return; }
        const dir = dx < 0 ? 1 : -1;
        el.style.transition = 'transform .16s ease, opacity .16s ease'; el.style.transform = `translateX(${dir > 0 ? -28 : 28}px)`; el.style.opacity = '.35';
        setTimeout(() => { go(dir); el.style.transition = 'none'; el.style.transform = `translateX(${dir > 0 ? 28 : -28}px)`;
            requestAnimationFrame(() => { el.style.transition = 'transform .18s ease, opacity .18s ease'; el.style.transform = ''; el.style.opacity = ''; }); }, 150);
    }, { passive: true });
}
document.addEventListener('DOMContentLoaded', () => {
    famSwipe(document.getElementById('sch-grid'), d => typeof schNavigate === 'function' && schNavigate(d));
    famSwipe(document.getElementById('asset-cal-grid'), d => typeof assetCalNavigate === 'function' && assetCalNavigate(d));
});

