    // ═══════════════════════════════════════════════════════════
    // 🌤️ 시간대별 날씨 (좌우 스와이프)
    // ═══════════════════════════════════════════════════════════
    let famHW = null, famHDay = 0;
    async function famHourlyOpen(day) {
        famHDay = day || 0;
        famSheet('<div class="fam-h"><b>🌤️ 시간대별 날씨</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div style="text-align:center;color:#94a3b8;padding:24px">불러오는 중…</div>');
        try {
            if (!famHW || Date.now() - famHW.at > 30 * 60e3 || famHW.lat !== userLat || famHW.lon !== userLon) {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${userLat}&longitude=${userLon}&hourly=temperature_2m,apparent_temperature,weathercode,precipitation_probability,windspeed_10m,winddirection_10m,windgusts_10m,is_day&windspeed_unit=ms&timezone=auto&forecast_days=7`;
                const j = await (await fetch(url)).json(); if (!j.hourly) throw new Error();
                famHW = { at: Date.now(), lat: userLat, lon: userLon, h: j.hourly };
            }
            famHourlyRender();
        } catch (e) { famSheet('<div class="fam-h"><b>🌤️ 시간대별 날씨</b><button class="fam-x" onclick="famSheetClose()">✕</button></div><div style="text-align:center;color:#ef4444;padding:24px">날씨 정보를 불러올 수 없습니다.</div>'); }
    }
    function famHourlyRender() {
        const h = famHW.h, days = [...new Set(h.time.map(t => t.slice(0, 10)))], ds = days[famHDay] || days[0];
        const dn = '일월화수목금토', d = new Date(ds + 'T00:00:00'), label = famHDay === 0 ? '오늘' : famHDay === 1 ? '내일' : `${d.getMonth() + 1}/${d.getDate()}`;
        const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
        const nowKey = (() => { const n = h.time.find(t => t.slice(0, 10) === ds); return n; })();
        const curH = famHDay === 0 ? new Date().getHours() : -1;
        const idx = h.time.map((t, i) => [t, i]).filter(([t]) => t.slice(0, 10) === ds).map(([, i]) => i);
        const card = i => {
            const hr = +h.time[i].slice(11, 13), now = hr === curH, ws = h.windspeed_10m[i], wd = h.winddirection_10m[i];
            const wsTxt = ws < 4 ? '약함' : ws < 9 ? '보통' : ws < 14 ? '강함' : '매우 강함';
            return `<div class="hw-card${now ? ' now' : ''}"${now ? ' id="hw-now"' : ''}>
                <div class="hw-t">${now ? '지금' : (hr < 12 ? '오전 ' : '오후 ') + ((hr % 12) || 12) + '시'}</div>
                <div class="hw-e">${getWeatherEmoji(h.weathercode[i], h.is_day[i])}</div>
                <div class="hw-c">${Math.round(h.temperature_2m[i])}°</div>
                <div class="hw-s">체감 ${Math.round(h.apparent_temperature[i])}°</div>
                <div class="hw-s">💧 ${h.precipitation_probability[i] ?? 0}%</div>
                <div class="hw-w"><span style="display:inline-block;transform:rotate(${(wd + 180) % 360}deg)">↑</span> ${ws.toFixed(1)}<small>m/s</small></div>
                <div class="hw-s">${dirs[Math.round(wd / 45) % 8]}풍 · ${wsTxt}</div>
                ${h.windgusts_10m[i] >= 10 ? `<div class="hw-s" style="color:#dc2626">돌풍 ${Math.round(h.windgusts_10m[i])}m/s</div>` : ''}
            </div>`;
        };
        famSheet(`<div class="fam-h"><b>🌤️ ${label} (${dn[d.getDay()]}) 시간대별</b><button class="fam-x" onclick="famSheetClose()">✕</button></div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin:-2px 0 8px;font-size:12px;color:#64748b">
                <button class="fam-btn" style="padding:5px 12px" ${famHDay <= 0 ? 'disabled' : ''} onclick="famHDay--;famHourlyRender()">‹ 전날</button>
                <span>${famEsc(typeof userCityName !== 'undefined' ? userCityName : '')} · 좌우로 넘겨 보세요</span>
                <button class="fam-btn" style="padding:5px 12px" ${famHDay >= days.length - 1 ? 'disabled' : ''} onclick="famHDay++;famHourlyRender()">다음날 ›</button>
            </div>
            <div class="hw-strip" id="hw-strip">${idx.map(card).join('')}</div>
            <div class="fam-note">바람 화살표는 바람이 불어가는 방향입니다. 4m/s 미만 약함 · 9 미만 보통 · 14 미만 강함</div>`);
        setTimeout(() => { const st = document.getElementById('hw-strip'), nw = document.getElementById('hw-now'); if (st) st.scrollLeft = nw ? nw.offsetLeft - 8 : (famHDay === 0 ? 0 : (st.children[7] ? st.children[7].offsetLeft - 8 : 0)); }, 30);
    }

