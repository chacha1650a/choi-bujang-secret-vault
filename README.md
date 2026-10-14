# 최부장의 비밀창고 자료실 (BYTE BACK 방어전)

BYTE BACK 방어전 1~12단계에서 학생이 만든 가상 자료실입니다. 로그인한 사용자가 승인된 기기에서 자기 메모만 다루고, 판정기·탐지 규칙·복구·탈환 작전실로 공격을 막습니다. 메모는 모두 실습용 가상 자료이며 실제 학생 자료, 토큰, 비밀키는 넣지 않습니다.

- 배포 주소: https://choi-bujang-secret-vault-delta.vercel.app
- 저장소: https://github.com/chacha1650a/choi-bujang-secret-vault

이 저장소는 교육용 실습 결과물입니다. 상용 제품이 아니고, 운영 방어가 끝났다는 뜻도 아닙니다. 단계별 작업 기록은 [records/STAGES.md](records/STAGES.md), 1~12단계와 XDR 풀이 과정은 [records/PORTFOLIO.md](records/PORTFOLIO.md)에 있습니다.

## 무엇을 누가 만들었나

출처를 두 갈래로 나눕니다.

| 출처 | 들어 있는 것 |
|---|---|
| 학생이 만든 것 | 판정기(`src/decider.mjs`), 탐지 규칙(`src/detect.mjs`), 접속 앱 화면(`public/`), 자료실 서버 함수(`api/`), 점검 코드(`src/attack-check.mjs`, `src/rule-check.mjs`), 정책 사본 도구(`scripts/policy.mjs`), DB 설정(`supabase/*.sql`), XDR 판정(`xdr/*/decide.mjs`) |
| 제공 엔진 | ALEPH SDP 엔진. 요청마다 신원·기기 등록·재로그인을 확인한 뒤 학생 판정기를 부르고 결과를 집행합니다. 학생 탐지 규칙의 회수 제안 집행, 요청 서명 확인, 엔진 감사 기록 보관도 엔진이 맡습니다. 이 저장소에는 엔진 코드가 없습니다. |

제공 엔진: ALEPH SDP 엔진 사용(이 저장소에 없음). 비밀값(서버 전용 키 등)은 저장소와 이 안내에 넣지 않고 Vercel 비밀 입력란에만 둡니다.

## 설치·실행·중지·복구

모든 절차는 검사한 커밋을 기준으로 합니다. 검사한 커밋은 `npm run bundle` 결과(`artifacts/submission.json`)의 `commit` 값입니다.

1. 설치: `git clone https://github.com/chacha1650a/choi-bujang-secret-vault && cd choi-bujang-secret-vault && git checkout <검사한 커밋> && npm ci` (Node.js 22 이상).
2. DB 준비: Supabase SQL Editor에서 `supabase/schema.sql` → `migrate-step3.sql` → `rls-step4.sql` → `rls-step5.sql` → `step8-notices.sql` → `step10-backup.sql` → `step11-devices.sql`을 순서대로 실행합니다. 시험 계정 SQL은 저장소에 넣지 않습니다.
3. 실행: Vercel 새 프로젝트에 이 저장소를 연결하고, 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`(서버 전용 키)의 값은 Vercel 비밀 입력란에만 넣은 뒤 배포합니다(빌드 `npm run build`, 공개 폴더 `public`). 화면은 `public/`, 서버 함수는 `api/`입니다.
4. 점검: 작업을 커밋한 뒤, 커밋하지 않는 `bundle-notes.json`에 이번에 한 일을 적고 `npm run bundle` → `npm run checks:table`을 실행합니다. 로컬 시험은 `node --test test/*.test.mjs`, 판정기·탐지 규칙 연습은 `npm run decider:test`, `npm run detect:test`입니다(가상 요청 연습이며 심판 판정이 아닙니다).
5. 접속 앱: 배포 주소에서 로그인 → 「이 기기 승인 요청」 → 강사가 `supabase/step11-devices.sql`의 안내대로 그 한 건만 승인 → 「승인 상태 다시 확인」.
6. 중지: Vercel 프로젝트에서 배포를 내리거나(Instant Rollback 또는 일시 중지), 기기 승인을 `revoked`로 바꿉니다. 엔진 쪽 경로 허용을 끄는 일은 ALEPH SDP 엔진 몫입니다.
7. 복구: 검사한 커밋으로 되돌려 다시 배포합니다(`git checkout <검사한 커밋>` 뒤 재배포). 복구 뒤에는 아래 「백업과 한 건 복원」의 재시험을 다시 합니다.

## 백업과 한 건 복원 (10단계)

1. 복원 전 검증: `policy/verified-policy.json`(침해 전에 검증한 정책 사본, SHA-256 포함)을 다시 읽어 해시와 정책 버전을 확인합니다. `npm run policy:diff`는 지금 시험 정책과의 차이만 보여 주고, 사본이 없거나 형식·해시가 틀리면 멈춥니다.
2. 정책 되돌리기: `npm run policy:restore`는 바뀔 항목만 보여 주고, `npm run policy:restore -- --apply`일 때만 사본의 경로 표를 되돌리며 `policy/audit.jsonl`에 한 줄을 덧붙입니다.
3. 메모 한 건 복원: `POST /api/restore/:noteId`는 먼저 미리 보기만 하고, `{ "confirm": true }`를 보낼 때만 그 한 건을 사본 내용으로 되돌립니다. 되돌린 뒤 ID·소유자·내용 해시를 사본과 비교하고, 다르면 실패로 기록합니다. 다른 메모와 감사 기록은 고치거나 지우지 않습니다.
4. 복원 뒤 재시험: 아래 점검을 다시 실행해 정상 요청 허용과 금지 요청 거부를 실측으로 확인합니다. 실행하지 않은 시험은 미실행으로 둡니다.

## 점검 기록과 작전실 화면 (12단계)

- 탈환 작전실(배포 주소 첫 화면 아래)은 맨 위 「출처」에 학생이 만든 것과 제공 엔진(ALEPH SDP 엔진)을 나눠 적습니다.
- 화면 수치는 서버 점검 기록(`GET /api/checks`)을 계산하지 않고 그대로 옮깁니다. 서버는 `npm run bundle`과 같은 점검 코드(`src/attack-check.mjs`)를 이 배포에 실제로 보내 점검 항목·막은 공격·뚫린 공격·실행하지 않은 점검을 셉니다. 기록을 읽지 못하면 수치를 비워 둡니다.
- 「점검 실행」은 금지 요청과 (로그인·승인 기기면) 정상 요청을 지금 보내고, 판정기·탐지 규칙·정책 사본은 고정 가상 입력(`/api/checks?case=…`)으로 실행해 줄마다 출처·요청 ID·확인 시각과 함께 보여 줍니다. 엔진의 판정 집행·회수 집행·요청 서명 확인은 이 화면이 받지 않으므로 미실행입니다. 메모 본문은 표시하지 않습니다.
- 제출 묶음의 점검 코드는 import 없는 한 파일이며 배포 주소에 GET 요청만 보냅니다. 쓰기 요청이 필요한 점검 2건(복원 `POST`, 수정 `PUT`)은 보내지 않고 `observed`와 `result`를 `not_run`으로 둡니다. `observed`에는 HTTP 상태와 jsonReady 같은 대조 가능한 값만 적습니다.
- 41종 공격 전체는 심판이 보내며 이 저장소에서는 실행하지 않았습니다. 아래 표에 없는 공격을 통과로 적지 않습니다.

### 실측 결과 (`npm run bundle` → `npm run checks:table`)

점검 시각 2026-10-13T06:40:50.937Z · 커밋 975a4cf1e59f · 단계 12

| 단계 | 점검 | 기대 | 실제 응답(observed) | 결과 |
|---|---|---|---|---|
| 1 | s01-static-notes | /data.json에 메모가 없음 | HTTP 404 | 막음(기대대로) |
| 2 | s02-static-copy | 다른 정적 사본(/notes.json)에 메모가 없음 | HTTP 404 | 막음(기대대로) |
| 3 | s03-unauth-list | 로그인 없는 내 메모 목록은 401·403과 JSON 오류 | HTTP 401 | 막음(기대대로) |
| 3 | s03-fake-token | 엉터리 토큰은 401·403과 JSON 오류 | HTTP 401 | 막음(기대대로) |
| 4 | s04-query-identity | 쿼리로 넣은 신원·역할은 무시 | HTTP 401 | 막음(기대대로) |
| 4 | s04-header-identity | 헤더로 넣은 신원·역할은 무시 | HTTP 401 | 막음(기대대로) |
| 4 | s04-other-note | 로그인 없이 남의 메모 한 건 조회 거부 | HTTP 401 | 막음(기대대로) |
| 5 | s05-direct-table | 배포 주소로 원본 표(/rest/v1/notes)를 직접 읽을 수 없음 | HTTP 404 | 막음(기대대로) |
| 6 | s06-unregistered | 미등록 기기 거부 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 7 | s07-compound | 복합 이상 접속은 추가 확인 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 8 | s08-other-zone | 로그인 없는 강사 공지 조회 거부 | HTTP 401 | 막음(기대대로) |
| 8 | s08-unknown-route | 모르는 경로 거부 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 8 | s08-all-notes | 전체 메모 목록 거부 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 8 | s08-write-notice | 반 공지 쓰기 거부 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 9 | s09-burst-read | 조회 폭주는 회수 제안 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 10 | s10-restore-unauth | 로그인 없는 복원 요청 거부 | not_run | 미실행 |
| 10 | s10-policy-verified | 검증한 정책 사본과 지금 정책이 같음 | HTTP 200; jsonReady=true | 막음(기대대로) |
| 11 | s11-device | 로그인 없는 기기 상태는 승인 전·자료 없음 | HTTP 200 | 막음(기대대로) |
| 11 | s11-unsigned-write | 서명·승인 없는 수정 요청 거부 | not_run | 미실행 |
| 11 | s11-unsigned-read | 서명·승인 없는 읽기 요청 거부 | HTTP 401 | 막음(기대대로) |

막음 18 · 뚫림 0 · 미실행 2

미실행 2건은 쓰기 요청이라 제출 묶음 규칙(GET·HEAD만)에 따라 보내지 않은 것입니다. 같은 배포의 서버 점검 기록도 점검 항목 20 · 막은 공격 18 · 뚫린 공격 0 · 실행하지 않은 점검 2입니다. 측정한 커밋 이후로는 문서와 XDR 모듈만 바꿨습니다.

## XDR 보너스 (xdr-01~06)

`xdr/<모듈>/decide.mjs`는 `patterns.json`(MITRE ATT&CK 근거가 붙은 패턴)을 맨 위 상수로 옮겨 적고, 경보가 패턴과 맞는 정도와 Wazuh 수준으로 확신도를 매겨 block(0.85 이상)·alert(0.5 이상)·record를 돌려줍니다. import는 없습니다. `respond.mjs`는 block만 출발 주소 거부 규칙(만료 시각·근거 경보 번호)으로 넣고 알림을 `xdr/alerts.log`에 쌓습니다. 판정기의 기존 규칙은 고치지 않습니다. 실행: `npm run xdr:run -- <모듈>`, 시험: `npm run test:xdr`. 자세한 설명은 [xdr/README.md](xdr/README.md)에 있습니다.
