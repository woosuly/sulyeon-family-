// ═══════════════════════════════════════════════════════════
// 🚦 홈 입력 길목: 기능마다 "이 말은 내가 처리" 규칙을 여기에 등록
//   famRoute(이름, 순서, 함수): 함수가 true를 돌려주면 처리 끝. 순서 숫자가 작을수록 먼저 봄
//   한 기능에서 오류가 나도 다음 규칙으로 넘어감 (기능 하나 때문에 홈 입력 전체가 멈추지 않게)
//   어느 규칙도 처리하지 않으면 assistant.js famRun이 일정·가계부 카드나 비서 두뇌(famAgent)로 보냄
//   새 기능은 famRun·agRoute를 고치지 말고 자기 파일에서 famRoute(...)로 등록
// ═══════════════════════════════════════════════════════════
const famRoutes = [];
function famRoute(name, order, fn) {
    const i = famRoutes.findIndex(r => r.name === name); if (i >= 0) famRoutes.splice(i, 1);
    famRoutes.push({ name, order, fn }); famRoutes.sort((a, b) => a.order - b.order);
}
function famRouteRun(t) {
    for (const r of famRoutes) {
        try { if (r.fn(t)) return r.name; }
        catch (e) { console.warn('[입력 처리 오류]', r.name, e); }
    }
    return '';
}
