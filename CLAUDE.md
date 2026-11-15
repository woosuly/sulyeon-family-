# 설연 Family — 작업 규칙

- 고치기 전후로 `node tests/smoke.mjs` 실행 (playwright 필요). 실패하면 올리지 않는다. GitHub도 같은 점검을 통과해야 웹 배포·APK 빌드가 된다.
- 홈 입력 처리 규칙은 `famRun`/`agRoute`를 고치지 말고 각 기능 파일에서 `famRoute(이름, 순서, 함수)`로 등록 (js/core/route.js).
- 음성 입력은 `window.SpeechRecognition` 하나로만 (js/core/voice.js: 새 앱은 Ears 네이티브, 예전 앱은 플러그인). 기능 파일에서 음성 플러그인을 직접 부르지 않는다.
- 받은 메시지(카톡·문자·위챗 등)는 `ibDrain` 하나로만 들어온다 (js/features/inbox.js). 원문은 msgLog(30일), 정리본은 inbox.
- 새 스크립트를 index.html에 넣으면 sw.js 캐시 목록에도 넣고 CACHE_NAME 숫자를 올린다 (점검이 확인함).
- 새 동작을 넣으면 tests/smoke.mjs에 점검 한 줄을 같이 넣는다.
