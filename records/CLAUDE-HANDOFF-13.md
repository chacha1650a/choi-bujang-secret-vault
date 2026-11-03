# Claude 인수인계 — 방어전13단계

작성일: 2026-11-03 / Asia/Seoul. 사용자가 Codex 작업을 저장하고13단계를 Claude에게 넘기도록 요청했다. Codex의 다음 단계 진행은 여기서 멈춘다.

## 저장소와 저장된 작업

- 로컬: `C:\gov\team-project\choi-bujang-secret-vault`
- 원격: https://github.com/chacha1650a/choi-bujang-secret-vault
- 브랜치: `codex/defense-stage13`, 원격에도 push 완료.
- 기존 main 기준: `078c0db228f9d18f6fb19bfc6a09129711421153`. main 병합/배포는 하지 않았다.
- 공식 시작 틀 추가: `e5c8388` (`chore(defense): add official on-client starter 0.2.21`). 제공 원본76개를 먼저 저장한 커밋이다.
- **13단계 기능 커밋: `24c57aed93e64d414b4d0e84f558d5cd05a15bb2`**. 포털 입력란에도 이 실제40자리 값을 준비했다. 이 인수인계를 저장한 뒤의 HEAD는 문서 커밋일 수 있으므로 기능 확인에는 이 커밋을 쓴다.

## 수행한 변경

기존 저장소는1~12단계/XDR 자료실이며 `student/extension.mjs`가 없었다. 공식 [0.2.21 시작 틀 안내](https://aleph-workbench-downloads.vercel.app/alekov-connect-0.2.21.html)의 ZIP을 받고 공개 `.zip.sha256`과 비교했다.

- 원본 ZIP: `C:\gov\team-project\defense-materials\alekov-starter-0.2.21.zip`
- SHA256: `289a109cfc38e7963b9f973a381cf81aec552c0f1ffca59c9a354585e7c511da`
- 같은 Git 저장소에 새 `on-client/`로 추가했다. 기존 파일은 덮어쓰지 않았다.
- 실제 앱 수정은 `on-client/student/extension.mjs`의 **renderIdentity 하나**다. me/devices/sessions 독립 loading/ok/error, 모드 안내, 실제 전달 label/id와 상태 번역, 매번 새 DOM 반환, 오류 시 옛 자료 미표시를 구현했다.
- `renderDecision` 이후 다른 함수들은 제공본 그대로다. 제공 서버·public/app.js·인증·판정 코드는 변경하지 않았다.
- `on-client/test/student-identity.test.mjs`는 학생의 합성 DOM 계약 검사다. 공식 판정 코드를 수정하거나 공식 통과 결과를 만든 것이 아니다.
- 작업 설명: [DEFENSE-13.md](DEFENSE-13.md).

## 직접 확인한 결과

| 검사 | 결과 |
| --- | --- |
| `node --check student/extension.mjs` | 통과 |
| `node --test test/student-identity.test.mjs` | **17 passed** |
| 실제 브라우저 예제 화면 | 사용자/기기/세션 ID와 상태, 예제 표시 확인 |
| 메뉴 | 1366px에서 마우스로 보호 현황/업무 앱 이동, Shift+Tab으로 메뉴 복귀 후 방향키/Enter로 보안 기록 이동 확인 |
| 다시 불러오기 | 새 확인 시각과 표시 재그리기 확인 |
| 예제 서버 중단 후 다시 불러오기 | 세 자료 모두 연결 실패. 학생 영역의 옛 연습 사용자/practice-user/practice-session 없음 확인 |
| 재시작 | 예제 모드 재시작·화면 복구 확인 |
| 보존 검사 | 제공 파일76개 중 수정된 것은 student/extension.mjs뿐. 다른 학생 함수와 기존 저장소 파일 보존 |
| 신규 파일 비밀값 패턴 검사 | 개인키/JWT/Bearer 리터럴/로그인 계정 값 발견 없음 |

가상 사용자 A→B 교체·여러 위험/오류 상태는 합성 입력 검사이며 실제 회사 서버/다른 사용자 상태를 변경하지 않았다. 화면에서 업무 앱의 **예제 접속 요청1회**가 확인 중 실행됐다. 실제 회사 앱·보안 조치·유료 모델 호출은 하지 않았다.

스크린샷(저장소 밖 로컬 증적):

- `C:\gov\team-project\defense-materials\stage13-evidence\stage13-demo.png`
- `C:\gov\team-project\defense-materials\stage13-evidence\stage13-server-stopped.png`
- `C:\gov\team-project\defense-materials\stage13-evidence\stage13-ready-to-submit.png`

## 실행 상태

Node.js24.19.0. on-client에는 외부 npm 의존성이 없다. 기존 루트 패키지는 별도1~12단계 앱이므로 그 실행 명령과 혼동하지 않는다.

```powershell
cd C:\gov\team-project\choi-bujang-secret-vault\on-client
npm run demo
```

현재 Codex가 켜둔 **예제 서버**가 `127.0.0.1:5189`에서 실행 중이다(인계 직전 조회 PID22936). PID는 재사용될 수 있으므로 중지할 때 현재 소유 프로세스와 실행 명령을 먼저 확인한다. 다른 앱/프로세스를 종료하지 않는다. 외부 서버 계정 연결/AI 승인은 하지 않았다.

## ALEPH 제출 상태 — 가장 중요

- 로그인된 포털은 `/defense`, 13단계 **제출 전**, 14~22는 앞 단계 통과 전 미개방이었다.
- 13단계 저장소 입력: `https://github.com/chacha1650a/choi-bujang-secret-vault`
- 커밋 입력: `24c57aed93e64d414b4d0e84f558d5cd05a15bb2`
- **「13단계 제출」 버튼은 누르지 않았다.** 공식 AI 판정·통과·14단계 개방은 아직 없다.
- 사용자는 지금13단계 인계를 요청했으며, Codex가 임의로 제출하거나14단계로 넘어가지 않았다. 제출은 사용자 의사를 확인한 후 진행한다. 비밀번호/토큰/개인키를 요구하거나 출력하지 않는다.
- Codex IAB 로그인은 Claude의 브라우저와 공유된다고 가정하지 않는다. Claude의 실제 로그인·제출 결과는 직접 확인해야 한다.

## Claude 첫 행동

1. AGENTS.md와 이 문서, 기능 커밋의 변경3개를 읽는다: `git show --stat 24c57ae`.
2. 위17개 검사와 예제 화면을 필요한 범위에서 독립 검토한다. 제공 서버/인증/판정·다른 단계 함수는 바꾸지 않는다.
3. 사용자가 제출을 지시하면13단계의 저장소/커밋 값을 다시 대조하고 제출한다. 서버의 실제 판정과 시각·미확인 항목을 기록한다. 접수와 통과를 같은 것으로 처리하지 않는다.
4. 통과 후14단계 공식 안내를 새로 읽고 같은 프로젝트에서 이어 간다. 코드 검토/합성 검사/실제 화면/공식 AI 판정을 계속 구분한다.
