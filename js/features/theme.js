        // ══════════════════════════════════════════════════════
        // 🎨 테마 색상 편집
        // ══════════════════════════════════════════════════════
        const THEME_COLORS = [
            // ── 파스텔 단색 ──
            {name:'스카이블루',  h:'#2563eb', bg:'#eff6ff', ga:'#dbeafe', gb:'#bfdbfe', acc:'#3b82f6', txt:'#1e3a5f'},
            {name:'코발트',      h:'#1d4ed8', bg:'#eff6ff', ga:'#dbeafe', gb:'#93c5fd', acc:'#3b82f6', txt:'#1e3a5f'},
            {name:'네이비',      h:'#1e3a8a', bg:'#eff6ff', ga:'#dbeafe', gb:'#93c5fd', acc:'#1d4ed8', txt:'#1e3a5f'},
            {name:'아쿠아',      h:'#0e7490', bg:'#ecfeff', ga:'#cffafe', gb:'#a5f3fc', acc:'#06b6d4', txt:'#164e63'},
            {name:'시안',        h:'#0891b2', bg:'#ecfeff', ga:'#cffafe', gb:'#67e8f9', acc:'#22d3ee', txt:'#083344'},
            {name:'티파니',      h:'#0d9488', bg:'#f0fdfa', ga:'#ccfbf1', gb:'#99f6e4', acc:'#14b8a6', txt:'#134e4a'},
            {name:'에메랄드',    h:'#047857', bg:'#ecfdf5', ga:'#d1fae5', gb:'#6ee7b7', acc:'#059669', txt:'#064e3b'},
            {name:'민트',        h:'#059669', bg:'#f0fdf4', ga:'#dcfce7', gb:'#bbf7d0', acc:'#10b981', txt:'#14532d'},
            {name:'스프링',      h:'#15803d', bg:'#f0fdf4', ga:'#dcfce7', gb:'#4ade80', acc:'#22c55e', txt:'#14532d'},
            {name:'포레스트',    h:'#166534', bg:'#f0fdf4', ga:'#dcfce7', gb:'#86efac', acc:'#16a34a', txt:'#14532d'},
            {name:'딥그린',      h:'#14532d', bg:'#f0fdf4', ga:'#dcfce7', gb:'#4ade80', acc:'#15803d', txt:'#052e16'},
            {name:'올리브',      h:'#4d7c0f', bg:'#f7fee7', ga:'#ecfccb', gb:'#d9f99d', acc:'#65a30d', txt:'#365314'},
            {name:'레몬',        h:'#ca8a04', bg:'#fefce8', ga:'#fef9c3', gb:'#fef08a', acc:'#eab308', txt:'#713f12'},
            {name:'골든',        h:'#b45309', bg:'#fffbeb', ga:'#fef3c7', gb:'#fde68a', acc:'#f59e0b', txt:'#78350f'},
            {name:'선셋오렌지',  h:'#c2410c', bg:'#fff7ed', ga:'#ffedd5', gb:'#fed7aa', acc:'#f97316', txt:'#7c2d12'},
            {name:'석양',        h:'#9a3412', bg:'#fff7ed', ga:'#ffedd5', gb:'#fb923c', acc:'#ea580c', txt:'#431407'},
            {name:'코랄',        h:'#dc2626', bg:'#fef2f2', ga:'#fee2e2', gb:'#fecaca', acc:'#ef4444', txt:'#7f1d1d'},
            {name:'토마토',      h:'#b91c1c', bg:'#fff1f2', ga:'#ffe4e6', gb:'#fecdd3', acc:'#f43f5e', txt:'#881337'},
            {name:'체리',        h:'#9f1239', bg:'#fff1f2', ga:'#ffe4e6', gb:'#fca5a5', acc:'#f87171', txt:'#450a0a'},
            {name:'버건디',      h:'#7f1d1d', bg:'#fef2f2', ga:'#fee2e2', gb:'#fca5a5', acc:'#dc2626', txt:'#450a0a'},
            {name:'로즈',        h:'#be185d', bg:'#fdf2f8', ga:'#fce7f3', gb:'#fbcfe8', acc:'#ec4899', txt:'#831843'},
            {name:'핫핑크',      h:'#9d174d', bg:'#fff1f2', ga:'#ffe4e6', gb:'#fda4af', acc:'#fb7185', txt:'#881337'},
            {name:'핑크퍼플',    h:'#9333ea', bg:'#fdf4ff', ga:'#fae8ff', gb:'#f0abfc', acc:'#a855f7', txt:'#581c87'},
            {name:'라벤더',      h:'#7c3aed', bg:'#f5f3ff', ga:'#ede9fe', gb:'#ddd6fe', acc:'#8b5cf6', txt:'#2e1065'},
            {name:'바이올렛',    h:'#6d28d9', bg:'#f5f3ff', ga:'#ede9fe', gb:'#c4b5fd', acc:'#7c3aed', txt:'#2e1065'},
            {name:'보라빛',      h:'#581c87', bg:'#faf5ff', ga:'#f3e8ff', gb:'#d8b4fe', acc:'#9333ea', txt:'#3b0764'},
            {name:'인디고',      h:'#4338ca', bg:'#eef2ff', ga:'#e0e7ff', gb:'#c7d2fe', acc:'#6366f1', txt:'#1e1b4b'},
            {name:'슬레이트',    h:'#334155', bg:'#f8fafc', ga:'#f1f5f9', gb:'#e2e8f0', acc:'#475569', txt:'#0f172a'},
            {name:'차콜',        h:'#111827', bg:'#f9fafb', ga:'#f3f4f6', gb:'#e5e7eb', acc:'#374151', txt:'#030712'},
            {name:'다크',        h:'#1e293b', bg:'#f8fafc', ga:'#f1f5f9', gb:'#e2e8f0', acc:'#334155', txt:'#0f172a'},
            // ── 혼합 그라디언트 ── (헤더에 그라디언트 적용)
            {name:'라벤더핑크',  h:'linear-gradient(135deg,#a18cd1,#fbc2eb)', bg:'#fdf4ff', ga:'#fae8ff', gb:'#e9d5ff', acc:'#a855f7', txt:'#3b0764'},
            {name:'피치스카이',  h:'linear-gradient(135deg,#ffecd2,#fcb69f)', bg:'#fff7ed', ga:'#ffedd5', gb:'#fed7aa', acc:'#f97316', txt:'#7c2d12'},
            {name:'블루민트',    h:'linear-gradient(135deg,#a1c4fd,#c2e9fb)', bg:'#eff6ff', ga:'#dbeafe', gb:'#bfdbfe', acc:'#3b82f6', txt:'#1e3a5f'},
            {name:'선셋드림',    h:'linear-gradient(135deg,#f6d365,#fda085)', bg:'#fff7ed', ga:'#ffedd5', gb:'#fed7aa', acc:'#f97316', txt:'#7c2d12'},
            {name:'그린민트',    h:'linear-gradient(135deg,#84fab0,#8fd3f4)', bg:'#f0fdf4', ga:'#dcfce7', gb:'#bbf7d0', acc:'#10b981', txt:'#14532d'},
            {name:'로즈골드',    h:'linear-gradient(135deg,#fccb90,#d57eeb)', bg:'#fdf4ff', ga:'#fae8ff', gb:'#f0abfc', acc:'#a855f7', txt:'#581c87'},
            {name:'오로라',      h:'linear-gradient(135deg,#e0c3fc,#8ec5fc)', bg:'#eef2ff', ga:'#e0e7ff', gb:'#c7d2fe', acc:'#6366f1', txt:'#1e1b4b'},
            {name:'봄날',        h:'linear-gradient(135deg,#fddb92,#d1fdff)', bg:'#ecfeff', ga:'#cffafe', gb:'#a5f3fc', acc:'#06b6d4', txt:'#164e63'},
            {name:'겨울하늘',    h:'linear-gradient(135deg,#accbee,#e7f0fd)', bg:'#eff6ff', ga:'#dbeafe', gb:'#bfdbfe', acc:'#3b82f6', txt:'#1e3a5f'},
            {name:'가을낙엽',    h:'linear-gradient(135deg,#f5f7fa,#c3cfe2)', bg:'#f8fafc', ga:'#f1f5f9', gb:'#e2e8f0', acc:'#475569', txt:'#0f172a'},
            {name:'라임소다',    h:'linear-gradient(135deg,#d4fc79,#96e6a1)', bg:'#f0fdf4', ga:'#dcfce7', gb:'#bbf7d0', acc:'#10b981', txt:'#14532d'},
            {name:'코튼캔디',    h:'linear-gradient(135deg,#fbc2eb,#f5576c)', bg:'#fdf2f8', ga:'#fce7f3', gb:'#fbcfe8', acc:'#ec4899', txt:'#831843'},
            {name:'갤럭시',      h:'linear-gradient(135deg,#667eea,#764ba2)', bg:'#f5f3ff', ga:'#ede9fe', gb:'#ddd6fe', acc:'#8b5cf6', txt:'#2e1065'},
            {name:'오션딥',      h:'linear-gradient(135deg,#4facfe,#00f2fe)', bg:'#ecfeff', ga:'#cffafe', gb:'#a5f3fc', acc:'#06b6d4', txt:'#164e63'},
            {name:'네온그린',    h:'linear-gradient(135deg,#43e97b,#38f9d7)', bg:'#f0fdfa', ga:'#ccfbf1', gb:'#99f6e4', acc:'#14b8a6', txt:'#134e4a'},
            {name:'선라이즈',    h:'linear-gradient(135deg,#fa709a,#fee140)', bg:'#fff7ed', ga:'#ffedd5', gb:'#fed7aa', acc:'#f97316', txt:'#7c2d12'},
            {name:'딥오션',      h:'linear-gradient(135deg,#30cfd0,#330867)', bg:'#eef2ff', ga:'#e0e7ff', gb:'#c7d2fe', acc:'#6366f1', txt:'#1e1b4b'},
            {name:'미드나잇',    h:'linear-gradient(135deg,#1a1a2e,#16213e)', bg:'#f8fafc', ga:'#f1f5f9', gb:'#e2e8f0', acc:'#334155', txt:'#0f172a'},
            {name:'딥퍼플',      h:'linear-gradient(135deg,#0f3460,#533483)', bg:'#f5f3ff', ga:'#ede9fe', gb:'#ddd6fe', acc:'#8b5cf6', txt:'#2e1065'},
        ];
        let customThemeColor = localStorage.getItem('customThemeColor') || '';

        let headerOpacity = parseInt(localStorage.getItem('headerOpacity') || '100');

        function setHeaderOpacity(val) {
            headerOpacity = parseInt(val);
            localStorage.setItem('headerOpacity', headerOpacity);
            const valEl = document.getElementById('header-opacity-val');
            if (valEl) valEl.textContent = headerOpacity + '%';
            applyHeaderOpacity();
        }

        function applyHeaderOpacity(baseColor) {
            const op  = headerOpacity / 100;
            // baseColor 없으면 현재 CSS 변수에서 읽기
            let raw = baseColor;
            if (!raw) {
                raw = getComputedStyle(document.documentElement).getPropertyValue('--month-header').trim();
            }
            if (!raw) return;
            // 폰 상단 상태바·하단 내비 색을 헤더 색과 맞춤 (그라디언트는 첫 색)
            const solid = raw.includes('gradient') ? (raw.match(/#[0-9a-f]{6}/i) || [])[0] : raw;
            const tcMeta = document.querySelector('meta[name="theme-color"]');
            if (tcMeta && solid) tcMeta.setAttribute('content', solid);
            // 안드로이드 앱: 하단 내비게이션 바 영역도 같은 색으로 (위·아래 테두리)
            const nb = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
            if (nb && nb.setBars && solid) nb.setBars({ color: solid }).catch(() => {});
            // 그라디언트: 투명도 무시하고 그대로 적용
            if (raw.includes('gradient')) {
                document.documentElement.style.setProperty('--month-header', raw);
                return;
            }
            // hex → rgba
            const r2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(raw);
            if (r2) {
                const rgba = `rgba(${parseInt(r2[1],16)},${parseInt(r2[2],16)},${parseInt(r2[3],16)},${op.toFixed(2)})`;
                document.documentElement.style.setProperty('--month-header', rgba);
            } else {
                document.documentElement.style.setProperty('--month-header', raw);
            }
        }

        // 구 함수 호환용 alias
        function applyHeaderColor(c) { applyHeaderOpacity(c); }

        function openThemeColorModal() {
            const modal = document.getElementById('theme-color-modal');
            const grid  = document.getElementById('theme-swatch-grid');
            if (!grid) return;
            const solidEnd = 30; // 단색 30개
            let html = '<div style="font-size:11px;font-weight:700;color:#64748b;width:100%;margin-bottom:8px;">🎨 파스텔 단색</div>';
            THEME_COLORS.forEach((t, i) => {
                if (i === solidEnd) html += '<div style="font-size:11px;font-weight:700;color:#64748b;width:100%;margin:10px 0 8px;">🌈 혼합 그라디언트</div>';
                html += `<div class="theme-swatch${customThemeColor===t.h?' active':''}"
                    style="background:${t.h};" title="${t.name}"
                    onclick="applyThemeColor(${i})"></div>`;
            });
            grid.innerHTML = html;
            // 투명도 슬라이더 복원
            const range = document.getElementById('header-opacity-range');
            const val   = document.getElementById('header-opacity-val');
            if (range) range.value = headerOpacity;
            if (val)   val.textContent = headerOpacity + '%';
            modal.classList.remove('hidden');
        }

        function applyThemeColor(idx) {
            const t = THEME_COLORS[idx];
            customThemeColor = t.h;
            localStorage.setItem('customThemeColor', t.h);
            const r = document.documentElement.style;
            r.setProperty('--month-bg',     t.bg);
            r.setProperty('--month-grad-a', t.ga);
            r.setProperty('--month-grad-b', t.gb);
            r.setProperty('--month-accent', t.acc);
            r.setProperty('--month-header', t.h);   // 헤더 색상 직접 변경
            r.setProperty('--month-text',   t.txt);
            r.setProperty('--month-accent-rgb', hexToRgb(t.acc));
            document.body.style.background = t.bg;
            // 헤더 투명도 적용
            applyHeaderOpacity(t.h);
            document.querySelectorAll('.theme-swatch').forEach((el, i) => {
                el.classList.toggle('active', i === idx);
            });
        }

        function resetThemeColor() {
            customThemeColor = '';
            localStorage.removeItem('customThemeColor');
            applyMonthTheme();
            document.querySelectorAll('.theme-swatch').forEach(el => el.classList.remove('active'));
        }

        function hexToRgb(hex) {
            const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '59,130,246';
        }

