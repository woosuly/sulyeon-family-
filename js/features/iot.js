// ═══════════════════════════════════════════════════════════
// 🏠 집 기기: 스마트싱스 앱 바로 열기
//   스마트싱스 외부 연동은 '26.11부터 유료(Developer Plan)라 직접 제어는 하지 않음.
//   "에어컨 켜줘", "거실 불 꺼줘", "외출 모드" → 스마트싱스 앱을 열어 줌
//   (무료 음성 제어는 빅스비: "하이 빅스비, 에어컨 켜줘")
//   로봇청소기는 life.js 로보락 열기로 넘김
// ═══════════════════════════════════════════════════════════
const ST_PKG = 'com.samsung.android.oneconnect';
function stSetHtml() { return ''; }
function stStateRefresh() {}
async function stOpen(what) {
    const N = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SeolyeonNative;
    if (!N || !N.openApp) return famFeedAdd('스마트싱스 앱 열기는 설연 앱(APK)에서 됩니다.');
    const r = await N.openApp({ pkg: ST_PKG }).catch(() => ({}));
    famFeedAdd(r.opened === false ? '스마트싱스 앱이 없어 설치 화면을 열었습니다.'
        : `🏠 스마트싱스를 열었습니다.${what ? ` <b>${famEsc(what)}</b>을(를) 눌러 주세요.` : ''} <span style="color:#94a3b8">(말로 제어는 "하이 빅스비, ${famEsc(what || '에어컨 켜줘')}")</span>`);
}
function iotRoute(t) {
    if (/(로봇\s*청소기|청소기|로보락)/.test(t)) return false;   // 로보락 열기(life.js)
    const m = t.match(/(에어컨|불|조명|전등|티비|TV|tv|공기청정기|청정기|제습기|가습기|선풍기|보일러|세탁기|건조기|플러그|커튼|스마트싱스|외출\s*모드|귀가\s*모드|취침\s*모드|집\s*상태)/);
    if (m && /(켜|꺼|틀어|끄|온도|도로|낮춰|올려|실행|모드|상태|돌려|멈춰|열어|닫아|어때)/.test(t)) { stOpen(m[1]); return true; }
    return false;
}
