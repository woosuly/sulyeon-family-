// ═══════════════════════════════════════════════════════════
// 📱 홈 화면 위젯 '설연 한눈에'에 보낼 후보 (안드로이드 앱)
//   고르는 순서(위젯이 매번 계산): 2시간 안 일정(1) > 답장 대기(2) > 오늘 챙길 것(3) > 오늘 일정·알림(4) > 내일(5) > 이번 주(6)
//   각 후보 {text, at, until, p, k}: at=시각(남은 시간 표시), until=이때까지 보임, k=누르면 열 화면
//   내 일정 + 공통 일정만 (와이프 개인 일정은 와이프 위젯에)
//   앱이 열려 있는 동안 2분마다, 화면을 떠날 때 한 번 보냄 (바뀐 게 없으면 안 보냄)
// ═══════════════════════════════════════════════════════════
const wgN = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
const wgG = n => { try { return eval(n); } catch (e) { return undefined; } };
let wgLast = '', wgLastAt = 0;

function wgWx() {
    const w = window.famWx; if (!w || w.temperature == null) return '';
    const c = +w.weathercode, d = c <= 0 ? '맑음' : c <= 2 ? '구름 조금' : c === 3 ? '흐림' : c <= 48 ? '안개' : c <= 67 ? '비' : c <= 77 ? '눈' : c <= 82 ? '소나기' : '뇌우';
    return `${Math.round(w.temperature)}° ${d}`;
}
function wgItems() {
    const me = famUser() || '정우설', now = Date.now(), out = [];
    const ymd = d => famYmd(d), today = ymd(new Date()), tmr = ymd(new Date(now + 864e5)), endOf = ds => new Date(ds + 'T23:59:59').getTime();
    const tm = hm => { const [h, m] = hm.split(':').map(Number); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(m).padStart(2, '0')}`; };
    const md = ds => { const d = new Date(ds + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}(${'일월화수목금토'[d.getDay()]})`; };
    // 일정 (7일 안)
    const in7 = ymd(new Date(now + 7 * 864e5));
    (wgG('schData') || []).filter(s => s.date >= today && s.date <= in7 && (!s.member || s.member === me || s.member === '공통')).forEach(s => {
        const memo = String(s.memo || '').replace(/^\[[^\]]*\]\s*/, '').trim(); if (!memo) return;
        const day = s.date === today ? '' : s.date === tmr ? '내일 ' : md(s.date) + ' ';
        if (s.startTime && /^\d{1,2}:\d{2}$/.test(s.startTime)) {
            const at = new Date(`${s.date}T${s.startTime.padStart(5, '0')}:00`).getTime(); if (at < now - 30 * 60e3) return;
            out.push({ text: `${day}${tm(s.startTime)} ${memo}`, at, until: at + 60 * 60e3, p: s.date === today ? 4 : s.date === tmr ? 5 : 6, k: '' });
        } else if (s.date === today || s.date === tmr) {
            out.push({ text: `${s.date === today ? '오늘' : '내일'} · ${memo}`, at: 0, until: endOf(s.date), p: s.date === today ? (/생일|생신|기념/.test(memo) ? 3 : 4) : 5, k: '' });
        }
    });
    // 예정된 알림 (24시간 안)
    (wgG('agRems') || []).filter(r => r.at > now && r.at < now + 864e5).forEach(r => out.push({ text: `${new Date(r.at).toDateString() === new Date().toDateString() ? '' : '내일 '}${tm(new Date(r.at).toTimeString().slice(0, 5))} ${r.title}`, at: r.at, until: r.at + 10 * 60e3, p: 4, k: '' }));
    // 답장 대기 · 가계부 확인
    const ib = (wgG('ibItems') || []).filter(x => x.status === 'pending' && (!x.owner || x.owner === me));
    ib.filter(x => x.reply).slice(0, 2).forEach(x => out.push({ text: `${x.name || x.room || x.from || ''}: ${String(x.summary || '').replace(/^[^:]*:\s*/, '').slice(0, 30)} · 답장 초안`, at: 0, until: now + 864e5, p: 2, k: 'card' }));
    const cards = ib.filter(x => x.kind === 'card').length; if (cards) out.push({ text: `가계부 확인 대기 ${cards}건`, at: 0, until: now + 864e5, p: 3, k: 'card' });
    // 택배 오늘 도착
    (wgG('parcels') || []).filter(p => !p.done && /배달\s*출발|배송\s*출발|오늘|도착\s*예정/.test(p.status || '')).forEach(p => out.push({ text: `택배 오늘 도착 예정 · ${p.item || p.company || ''}`, at: 0, until: endOf(today), p: 3, k: '' }));
    // 정기결제 오늘·내일
    (wgG('subsList') || []).filter(x => !x.hide && typeof subNext === 'function').forEach(x => { const n = subNext(x); if (n === today || n === tmr) out.push({ text: `${n === today ? '오늘' : '내일'} ${x.name} 결제 ${Math.round(x.amt).toLocaleString('ko-KR')}원`, at: 0, until: endOf(n), p: 3, k: '' }); });
    // 서류 만료 14일 안
    (wgG('lifeDocs') || []).filter(d => d.expire && d.expire >= today && d.expire <= ymd(new Date(now + 14 * 864e5))).forEach(d => out.push({ text: `${d.owner === '공통' ? '' : d.owner + ' '}${d.name} 만료 ${md(d.expire)}`, at: 0, until: endOf(d.expire), p: 3, k: '' }));
    return out.slice(0, 40);
}
function wgPush(force) {
    const N = wgN(); if (!N || !N.widgetSet || !famUser()) return;
    let items = []; try { items = wgItems(); } catch (e) { return; }
    const data = { wx: wgWx(), empty: '오늘은 챙길 일정이 없습니다', items };
    const key = JSON.stringify(data);
    if (!force && key === wgLast && Date.now() - wgLastAt < 10 * 60e3) return;
    wgLast = key; wgLastAt = Date.now();
    N.widgetSet(data).catch(() => {});
}
(function () {
    if (!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform())) return;
    window.addEventListener('load', () => { setTimeout(() => wgPush(true), 8000); setInterval(() => { if (document.visibilityState === 'visible') wgPush(false); }, 2 * 60e3); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') wgPush(false); });
})();
