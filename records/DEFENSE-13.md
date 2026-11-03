# 13단계 — 로그인 사용자·기기·세션 표시

확인일: 2026-11-03 / Asia/Seoul. 공식 판정 전의 학생 구현·직접 확인 기록이다.

## 작업 위치와 출처

- 기존 1~12단계와 XDR 프로젝트를 보존하고 같은 저장소의 `on-client/`에 공식 시작 틀을 추가했다.
- [공식 0.2.21 안내](https://aleph-workbench-downloads.vercel.app/alekov-connect-0.2.21.html)에서 받은 ZIP의 SHA256은 `289a109cfc38e7963b9f973a381cf81aec552c0f1ffca59c9a354585e7c511da`이며, 같은 사이트의 `.zip.sha256`과 일치한다.
- 제공 파일76개 중 학생이 바꾼 앱 코드는 `on-client/student/extension.mjs`의 `renderIdentity` 하나다. 제공 서버·`on-client/public/app.js`·판정·인증 설정은 원본과 바이트 단위로 일치한다. 다른 학생 표시 함수도 시작 틀 그대로다.
- 추가한 검사: `on-client/test/student-identity.test.mjs`. 이것은 공식 판정 코드가 아닌 로컬 합성 검사다.

## 구현

`renderIdentity({ me, devices, sessions })`가 각 자료의 loading/ok/error를 독립적으로 표시한다. 사용자·기기·세션의 label과 ID를 입력에서 읽고 기기 compliant/noncompliant/unknown, 세션 active/expired/revoked/unknown을 한국어로 구분한다.

demo/연결 없음/확인 불가 안내는 loading과 error에도 유지한다. 매번 새 DOM을 반환하므로 호스트의 기존 `setChildren` 동선에서 이전 계정 표시가 교체된다. error에는 전달받은 옛 data를 그리지 않고 서버 message를 글자로 표시한다. `document.createElement`와 `textContent`를 사용한다.

## 실행과 확인

앱 폴더에서 실행한다. 예제 모드는 실제 서버 연결이 아니다.

```powershell
cd C:\gov\team-project\choi-bujang-secret-vault\on-client
npm run demo
```

브라우저 `http://127.0.0.1:5189/`에서 **보호 현황 → 학생 구현 표시(renderIdentity)**를 확인한다. 중지는 실행한 창의 Ctrl+C다.

```powershell
node --test test/student-identity.test.mjs
```

| 확인 | 직접 확인한 결과 | 범위 |
| --- | --- | --- |
| `node --check student/extension.mjs` | 통과 | 문법 |
| 합성 DOM 계약 검사 | 17개 통과 | 정상/위험/미확정 상태·모드·독립 오류·재그리기·외부 문자열의 텍스트 표시 |
| 예제 화면 | 연습 사용자/practice-user, 연습 PC/practice-pc, practice-session과 예제 표시 확인 | 실제 브라우저, 예제 자료 |
| 넓은 화면·메뉴 | 1366px에서 보호 현황/업무 앱 마우스 이동, Shift+Tab으로 메뉴 복귀 후 방향키·Enter로 보안 기록 이동 확인 | 제공 메뉴를 유지한 실제 브라우저 |
| 다시 불러오기 | 새 확인 시각과 사용자·기기·세션 표시 확인 | 실제 브라우저, 예제 자료 |
| 서버 중단 후 다시 불러오기 | 세 자료 각각 연결 실패 표시; 학생 영역의 옛 연습 사용자/practice-user/practice-session 없음 확인 | 실제 브라우저·로컬 서버 중단 |
| 재시작 | 같은 예제 서버 재시작 후 최신 화면 복구 확인 | 실제 브라우저 |
| 학생 함수 보존 | renderDecision 이후의 나머지 함수가 원본과 동일 | 소스 대조 |
| 비밀값 검사 | 개인키/JWT/Bearer 리터럴·로그인 계정 값 패턴 발견 없음 | 커밋 전 신규 파일 검사 |

메뉴의 기본 키보드 동선은 Tab/Shift+Tab으로 메뉴에 진입한 뒤 방향키로 탭을 이동하고 Enter로 확인하는 방식이다. 제공 메뉴를 수정하지 않았다. 업무 앱의 예제 접속 요청 한 번도 확인 중 실행됐으며, 실제 회사 업무 앱/보안 조치 요청은 아니다.

## 미확인과 다음 작업

실제 회사 서버 연결·본인 기기 승인·실제 다른 사용자/장애 상태는 만들거나 확인하지 않았다. 상태별 변화는 합성 입력으로, 로컬 서버 중단은 실제 브라우저로 확인했다. 악성코드 검사·치료 기능을 구현한 것이 아니다.

13단계 공식 AI 코드 판정·통과 기록은 아직 요청하지 않았다. 제출할 때 이 저장소의 실제40자리 기능 커밋을 사용한다. 14단계 이후는 포털의 앞 단계 판정과 해당 단계의 공식 입력 계약을 확인한 뒤 같은 프로젝트에서 진행한다.
