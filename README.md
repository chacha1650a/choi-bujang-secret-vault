# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. 1단계에서는 `/data.json`에 같은 가상 메모가 공개되어 있었습니다(2단계에서 옮김). 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.

## 2단계 기록: 자료를 코드 밖으로 옮깁니다

현재 작동하는 기능:
- 가상 메모 네 건은 학습용 Supabase 테이블 `public.notes`에 있습니다. 테이블은 RLS가 켜져 있고 `anon`·`authenticated`에는 권한이 없습니다. `owner_id uuid` 칸은 3단계 로그인 뒤 주인을 연결할 자리이고 외래키는 걸지 않았습니다.
- 화면(`public/index.html`)은 서버 함수 `api/notes.js`를 통해 메모를 읽습니다. 함수는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`만 읽고, 키를 응답·로그·브라우저 파일에 넣지 않습니다.
- 저장소와 `public/`에는 메모 본문이 없습니다. 빌드(`scripts/build-public.mjs`)는 `public/data.json`을 만들지 않고 `public/aleph.json`만 기록합니다. `vercel.json`은 `X-Content-Type-Options: nosniff` 헤더를 붙입니다.

다시 실행하는 방법:
1. Supabase SQL Editor에서 `supabase/schema.sql`을 실행하고, 로컬 전용 시드(`supabase/seed.local.sql`, Git에 올리지 않음)로 가상 메모를 넣습니다.
2. Vercel 프로젝트의 Environment Variables에 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 직접 넣고 다시 배포합니다.
3. 로컬 시험: `npm run test:r5`, 화면 빌드: `npm run build -- --local`.

### 남은 약점 (해결됐다고 쓰지 않습니다)
- `/api/notes`는 아직 로그인 없이 누구나 부를 수 있습니다. 3단계에서 로그인으로 막습니다. 그 전까지 가상 메모만 둡니다.
- 1단계에서 이미 공개된 옛 커밋(`Initial commit`)과 옛 배포에는 메모 본문이 남아 있을 수 있습니다. 파일을 지워도 과거 노출이 해소된 것은 아닙니다. 이력을 지우려면 Git 이력 재작성과 옛 배포 삭제가 따로 필요합니다.

### 확인 절차 (메모 문장 검색)
```
# 현재 GitHub 최신 파일에 가상 메모 문장이 없는지 (시드 파일은 Git에 올라가지 않음)
git grep -nE "가상 .* 기록"
# 배포된 공개 파일에서 메모가 사라졌는지
curl -s -o /dev/null -w "%{http_code}\n" https://<내 배포 주소>/data.json
curl -s https://<내 배포 주소>/aleph.json
curl -sI https://<내 배포 주소>/ | grep -i x-content-type-options
# 서버 API는 남은 약점으로 따로 기록
curl -s https://<내 배포 주소>/api/notes
```
정상 결과: `git grep`은 결과 없음, `/data.json`은 404, `/aleph.json`은 열림, 헤더는 `nosniff`. `/api/notes`는 메모가 응답되며 이것이 남은 약점입니다.

## 3단계 기록: 진짜 로그인을 붙입니다

현재 작동하는 기능:
- 화면(`public/index.html`)에서 Supabase Auth 이메일·비밀번호로 가입·로그인·로그아웃합니다. 브라우저 파일에는 공개용 키(publishable)만 있고 서버 전용 키는 없습니다. 로그인 실패 이유는 화면에 보여 줍니다.
- 서버 함수(`api/notes.js`, `api/notes/[id].js`)는 요청의 `Authorization: Bearer` 토큰을 `src/verify-login.mjs`로 검사합니다. 토큰이 없거나 엉터리이거나 만료·위조·다른 서비스용이면 자료 없이 `401`과 JSON 오류(`{"error":"UNAUTHENTICATED"}`)를 돌려줍니다. 브라우저가 보낸 userId·role은 읽지 않습니다.
- 로그인한 사용자는 가상 메모를 추가·조회·수정·삭제합니다. 메모는 `{id, title, body}` 모양이고 추가할 때 서버가 확인한 사용자 ID를 `owner_id`로 저장합니다.
  - `GET /api/notes` 내 메모 목록, `POST /api/notes` 추가(`{id}` 반환, id가 없으면 서버가 UUID 생성)
  - `GET`·`PUT`·`DELETE /api/notes/:id` (지운 뒤 GET은 404)
- `aleph.config.json`의 `identityProvider`(발급자·대상·공개키 주소)와 `allowedRoutes`는 위 구현과 같습니다. 비밀 키는 들어 있지 않습니다.

다시 실행하는 방법:
1. 새 Supabase 프로젝트면 `supabase/schema.sql`을 실행합니다. 2단계 모양의 테이블이 이미 있으면 `supabase/migrate-step3.sql`을 한 번 실행합니다(`content`→`body`, `id`→UUID, `service_role` 권한).
2. Vercel 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`(서버 전용)를 넣고 배포합니다.
3. 로컬 시험: `npm run test:notes`, `npm run test:r5`.

### 남은 약점 (해결됐다고 쓰지 않습니다)
- 아직 소유자 검사를 하지 않습니다. 로그인한 B가 A 메모의 id를 알면 읽고 고치고 지울 수 있습니다. 4단계에서 고칩니다.
- 로그인은 신원 확인일 뿐이어서 권한(누가 무엇을 할 수 있는지)은 따로 만들지 않았습니다.
- 1단계에서 공개된 옛 커밋과 배포에는 메모가 남아 있을 수 있습니다.

### 확인 절차
```
# 로그인 없이 목록 요청: 401과 JSON 오류가 와야 합니다
curl -s -i https://<내 배포 주소>/api/notes
# 엉터리 토큰: 역시 거부되어야 합니다
curl -s -i -H "Authorization: Bearer aaaa.bbbb.cccc" https://<내 배포 주소>/api/notes
# 공개 파일에 메모가 없어야 합니다
curl -s -o /dev/null -w "%{http_code}\n" https://<내 배포 주소>/data.json
```
정상 로그인(A) 뒤에는 화면에서 메모를 추가·수정·삭제할 수 있어야 합니다.

## 4단계 기록: 로그인해도 내 자료만 보이게 합니다

현재 작동하는 기능:
- 메모 읽기·추가·수정·삭제는 서버가 검증한 사용자 ID와 DB의 `owner_id`가 같을 때만 허용합니다. 주소의 id, 본문의 `userId`·`owner_id`는 믿지 않습니다.
  - `GET /api/notes`는 내 메모만, `POST /api/notes`는 항상 검증된 ID를 `owner_id`로 저장합니다(본문의 `owner_id`는 무시).
  - `GET`·`PUT`·`DELETE /api/notes/:id`는 먼저 DB의 `owner_id`를 읽어 본인이 아니면 `403`(`FORBIDDEN`)으로 거부합니다. 주인이 없는 옛 행도 누구에게나 `403`입니다. 없는 id는 `404`입니다.
  - `PUT`은 `owner_id`를 쓰지 않고, 소유자를 다른 사람으로 바꾸려는 요청은 `403`으로 거부합니다. 수정·삭제 쿼리에도 `owner_id` 조건을 한 번 더 붙입니다.
- 허용 경로는 3단계와 같은 다섯 개입니다(`aleph.config.json`의 `allowedRoutes`).
- DB는 `supabase/rls-step4.sql`(새 프로젝트는 `schema.sql`)로 `anon`의 권한을 모두 회수하고 `authenticated`에 4가지 권한만 주며, RLS 정책은 `auth.uid() = owner_id`일 때만 허용합니다. 서버 함수의 서버 전용 키(`service_role`)는 그대로 쓰고 소유자 검사는 서버 코드가 합니다.

다시 실행하는 방법:
1. 이미 있는 DB에는 `supabase/rls-step4.sql`을 실행하고, 두 역할의 권한을 확인 쿼리로 대조합니다.
2. 기존 가상 메모의 주인 연결은 Git에 올리지 않는 로컬 SQL로 합니다(이메일이 들어 있어서). 소유자별 메모 수를 확인합니다.
3. 로컬 시험: `npm run test:notes`(A·B 교차 접근 시험 포함), `npm run test:r5`.

### 남은 약점 (해결됐다고 쓰지 않습니다)
- 직접 Data API(`authenticated` 역할)의 접근은 RLS 정책으로 설계했지만, 심판이 재현할 수 없어 실제로 부르는 시험은 하지 않았습니다. 확인한 것은 권한 조회(`has_table_privilege`)뿐입니다.
- 서버 함수는 서버 전용 키로 DB에 접속하므로 RLS를 건너뜁니다. 소유자 검사가 서버 코드 한 곳에 있어서 이 코드가 틀리면 다른 보호가 없습니다. 5단계에서 요청 경로를 한곳으로 모읍니다.
- 1단계에서 공개된 옛 커밋과 배포에는 메모가 남아 있을 수 있습니다.

## 5단계 기록: 자료 요청을 서버 한곳으로 모읍니다

- 제작 1: 화면(`public/index.html`)은 메모를 `/api/notes`로만 읽고 쓰므로 Supabase 직접 호출은 없었습니다. Supabase 클라이언트는 로그인(Auth)에만 씁니다.
- 제작 2: `supabase/rls-step5.sql`로 메모 테이블의 PUBLIC·anon·authenticated 직접 권한을 모두 회수하고, 서버 전용 키(service_role)만 남겼습니다. 적용 전후 권한은 같은 파일의 확인 쿼리로 봅니다.
- `aleph.config.json`의 `originalApiUrl`에 쿼리 없는 원본 자료 주소(`/rest/v1/notes`)를 적었습니다. 공개 키만으로 불러도 메모가 나오면 안 됩니다.
- `src/attack-check.mjs`에 5단계 점검(공개 키로 원본 API 직접 조회)을 더했습니다.
- 남은 약점: 로그인용 공개 키가 화면 코드에 있습니다(가점 3은 로그인까지 서버로 옮겨야 해서 하지 않았습니다). 1단계에서 공개된 옛 커밋과 배포 이력에는 메모가 남아 있습니다.

## 6단계 기록: 등록한 기기만 자료실에 들어옵니다

- 제작 1: `docs/DECIDER_REQUEST.md`를 읽고 요청의 `deviceRegistered`(엔진이 확인한 기기 등록 여부)와 `subjectId`·`deviceId`(가명 ID, 개인키 아님)의 위치를 확인했습니다. 인증서·CA·서명 키는 만들지도 Git에 넣지도 않았습니다.
- 제작 2: `src/decider.mjs`에 `device_registered` 규칙 하나를 넣었습니다. `deviceRegistered`가 정확히 `true`일 때만 `allow`(`approved`)이고, 아니거나 값이 없으면 `deny`와 이유 코드 `device_not_registered`로 거부합니다. 다른 요청 항목은 읽지 않습니다.
- 제작 3 확인 순서: `npm run decider:test`를 실행해 「등록 기기의 정상 요청」은 통과(allow), 「미등록 기기의 가상 요청」은 deny·`device_not_registered`로 나오는지 봅니다. 가상 요청 연습이며 심판 판정이 아닙니다. 미등록 기기 공격은 심판이 확인합니다. 따로 설치하는 접속 프로그램은 없습니다.
- 기존 자료실 주소와 브라우저 화면, 서버 함수는 바꾸지 않았습니다.
- 남은 약점: 규칙이 기기 등록 여부 하나뿐입니다. 평소와 다른 접속 확인(7단계)과 구역 나누기(8단계)는 아직 없습니다.

## 7단계 기록: 평소와 다른 접속은 다시 확인합니다

- 제작 1: 판정기가 접속 정보(`signals`)의 출처를 구분합니다. `none`(실제 경로)은 위치 정보 없음으로 보고 정상값으로 채우지 않습니다. `judge_fixture`(심판의 가상 사건)만 읽고, 이 값은 추가 확인을 요구하는 근거로만 쓰며 허용 근거로는 쓰지 않습니다. 그 밖의 출처나 형식이 틀린 값(`signals`, `recentEvents`)은 믿지 않고 추가 확인으로 보냅니다.
- 제작 2: `step_up_required` 규칙을 더했습니다. 다른 지역, 처음 보는 네트워크, 새벽 시각(0~5시), 최근 10분 안의 사건 10건 이상 중 하나라도 있으면 `step_up`(이유 코드 `step_up_required`)입니다. 영구 차단하지 않고, 기존 기기 규칙(`device_registered`)은 그대로 먼저 검사합니다.
- 제작 3: 제공 계약의 재로그인 정보는 엔진이 검증한 `stepUp {verified, authAgeSeconds}`입니다. `verified`가 true이고 다시 로그인한 지 300초 안일 때만 이상 접속을 허용합니다. 이 자료실의 Vercel 서버 함수는 판정기를 부르지 않으므로, 실제 자료의 재로그인 전 차단과 새 요청 허용은 **미실행**입니다(엔진이 연결된 환경에서만 실측). 토큰 원문은 기록하지 않습니다.
- 확인 순서: `npm run decider:test`(4건 통과), `npm run fixture:7`(정상 allow, 복합 이상 step_up), `npm run test:decider`(지역·시각·네트워크·대량 사건, 위조 출처, 재로그인 나이 검사). 모두 가상 요청 연습이며 심판 판정이 아닙니다.
- 남은 약점: 기준(새벽 시각, 10건)은 고정값이라 사용자별 평소 패턴을 배우지 않습니다. 실제 경로에는 위치 정보가 없어서 지역·네트워크 규칙은 심판의 가상 사건에서만 작동합니다.

## 8단계 기록: 자료마다 갈 수 있는 구역을 나눕니다

- 제작 1: 메모와 강사 공지를 서로 다른 자원 ID로 구분합니다. 응답 헤더 `X-Resource-Id`에 `note:<id>`·`notes:mine`(메모), `notice:<id>`·`notices:class`(공지)가 붙습니다. 기존 메모 주소와 자료는 그대로이고 화면 메뉴는 바꾸지 않았습니다.
- 공지 구역: `GET /api/notices`, `GET·PUT /api/notices/:id`(서버 함수 `api/notices.js`, `api/notices/[id].js`). DB는 `supabase/step8-notices.sql`로 `notices`(가상 공지 1건)와 `instructors`(강사 명단, 비어 있음)를 만들고, 두 테이블 모두 브라우저 역할 권한 없이 서버 전용 키만 씁니다.
- 제작 2: 판정기에 `resource_zone` 규칙을 넣었습니다. 엔진이 확인한 사용자(`subjectId`)·기기(`deviceId`)·서비스(`notes`)·메서드·정확한 경로가 내 메모 구역(`my-notes`) 표와 맞을 때만 다음 규칙으로 넘어갑니다. 표: `GET /api/my/notes`(본인 목록), `POST /api/notes`, `GET·PUT·DELETE /api/notes/:id`. 전체 목록 모양(`GET /api/notes`, `/api/notes/all`, `/api/admin/notes`), 표에 없는 경로·메서드, 경로 모양이 다른 요청, 다른 서비스, 쿼리가 붙은 요청은 `route_not_allowed`로 거부합니다. 강사 공지 구역(`/notices`)은 강사 역할이 판정 계약에 없어서 판정기에서는 읽기·수정 모두 허용하지 않습니다. 기존 기기·추가 확인 규칙은 그대로입니다.
- 제작 3: 자료 API가 다시 확인합니다. 메모는 DB 소유자와 검증된 사용자가 다르면 403(`reason: not_owner`), 공지 구역은 읽기·수정 모두 검증된 학생 계정이 DB 강사 명단에 있을 때만 허용하고 아니면 403(`reason: instructor_only`)입니다. 화면 메뉴·요청 본문·토큰의 role은 믿지 않고, 심판 시험 신원은 강사가 될 수 없습니다.
- 확인 순서: `npm run test:decider`(구역 허용·거부), `npm run test:notes`(학생·심판의 공지 읽기·수정 거부, 강사 명단 계정만 공지 읽기·수정, B의 A 메모 거부). 토큰 없이 `/api/notices`를 부르면 401입니다.
- 첫 제출 판정(36점, `S08_OTHER_ZONE_ALLOWED`): 일반 학생이 강사 공지 구역을 읽을 수 있었습니다. 공지 구역을 판정기와 API 모두에서 강사 전용으로 좁혔습니다.
- 두 번째 판정도 같은 코드로 실패해서, `:id` 자리에 `export`·`all`·`shared` 같은 기능 이름이 오면 자료 ID로 보지 않고 거부하도록 판정기를 좁혔습니다.
- 세 번째 판정도 같은 코드로 실패했습니다. 판정기가 `GET /api/notes`(전체 메모 목록 모양)를 내 메모 목록으로 허용한 것이 원인으로 보여, 본인 목록 전용 경로 `GET /api/my/notes`(서버 함수 `api/my/notes.js`)를 만들고 화면도 이 주소를 쓰게 바꿨습니다. `GET /api/notes`는 판정기에서 거부하고, 자료 API는 호환을 위해 본인 메모만 돌려줍니다. `aleph.config.json`의 `allowedRoutes`는 경로마다 서비스·메서드·경로·구역을 적은 객체로 바꿨습니다.
- 남은 약점: 강사 명단은 SQL Editor로만 관리합니다. 판정기와 자료 API의 경로 표를 두 곳에서 맞춰야 합니다. 기능 이름 목록은 고정값입니다.

## 9단계 기록: 도플갱어를 찾고 권한을 거둡니다

- 제작 1: 판정기는 이미 계약에 있는 가명 사용자(`subjectId`)·기기(`deviceId`)·요청 종류(메서드·경로)·판정 값만 읽고 메모 내용·토큰·실명은 다루지 않습니다. 탐지기(`src/detect.mjs`)도 사건 계약(`docs/DETECT_EVENTS.md`)대로 시각(`at`)·요청 종류(`method`)·가명 사용자(`identity.sub`) 세 값만 읽습니다. 형식이 틀린 사건과 조회가 아닌 사건은 세지 않습니다.
- 제작 2: 같은 가명 사용자의 `GET`이 어느 10분 구간에서든 120건을 넘으면 폭주 조회로 봅니다(정확히 120건은 아님). 다른 사용자의 사건은 합산하지 않고, 계약에 없는 지역·네트워크 값은 근거로 쓰지 않으며 지역 하나만으로는 확정하지 않습니다. 평소와 다른 접속(시각·네트워크·지역)은 7단계 판정기의 추가 확인 규칙이 맡습니다.
- 제작 3: 의심이면 접속 허용/거부 응답과 별도의 결과로 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject }`를 냅니다. 대상은 의심 사용자 한 명(가명)이고, 회수 API를 만들거나 기기 권한을 바꾸지 않습니다. 실제 회수와 경과 시간은 심판이 확인합니다. 정상이면 `{ action: 'observe' }`입니다.
- 확인 순서: `npm run detect:test`(6건: 정상 30건·120건 유지, 121건·200건 회수 제안, 서로 다른 사용자·10분 밖 흩어짐 유지), `npm run test:detect`(조회 외 요청, 형식 오류, 계약 밖 값 무시, 결과에 다른 값이 없는지). 가상 사건 연습이며 실제 접속 회수나 심판 판정이 아닙니다.
- 남은 약점: 기준(10분·120건)이 고정값입니다. 회수 제안을 실제로 집행하고 회수된 세션의 재시도를 막는 일은 반 엔진 몫이라 이 저장소에서는 확인하지 않았습니다.

## 10단계 기록: 백업에서 자료실을 되살립니다

- 제작 1(정책 차이): `policy/verified-policy.json`은 침해 전에 검증한 안전 정책 사본입니다(정책 버전, 판정기 규칙 이름, 경로·구역 표, SHA-256). `npm run policy:diff`는 사본을 다시 읽어 해시를 검증한 뒤 복원할 정책 버전과 지금 시험 정책(`aleph.config.json`의 `allowedRoutes` + `src/decider.mjs`의 `RULE_IDS`)과의 차이만 보여 줍니다. 사본이 없거나 형식·해시가 틀리면 중단합니다. 실제 운영 정책(반 엔진·Supabase)은 건드리지 않습니다.
- 제작 2(정책 되돌리기): `npm run policy:restore`는 바뀔 항목만 보여 주고 멈추며, `npm run policy:restore -- --apply`일 때만 사본의 서비스(notes·notices) 경로 표를 되돌립니다. 사본에 없는 다른 서비스 경로는 그대로 두고, `policy/audit.jsonl`에 한 줄을 덧붙입니다(기존 줄은 고치지 않음). 규칙 이름이 다르면 코드 변경이라 자동으로 고치지 않고 멈춥니다(git으로 `src/decider.mjs`를 되돌림).
- 제작 3(메모 한 건 복원): 서비스 `notes`, 경로 `POST /api/restore/:noteId`(서버 함수 `api/restore/[noteId].js`, `aleph.config.json`의 `restoreRoute`). 시험 계정 B의 메모로만 확인합니다.

### 10단계 복원 절차

**1) 복원 전에 사본을 다시 읽어 검증합니다.** 요청마다 아래를 순서대로 하고, 하나라도 실패하면 아무것도 쓰지 않고 멈춥니다. 검증 실패는 감사 기록에 `restore_refused`로 남기고 성공으로 적지 않습니다.
1. 안전 정책 사본(`policy/verified-policy.json`)을 다시 읽어 해시를 검증하고, 지금 시험 정책과 차이가 없는지 봅니다. 사본이 없거나 해시가 틀리거나 정책이 바뀌었으면 409 `POLICY_UNVERIFIED`.
2. 메모 사본(`note_snapshots`)을 다시 읽습니다. 없으면 404 `NO_SNAPSHOT`, 사본 소유자가 본인이 아니면 403 `not_owner`, 사본 내용 해시가 맞지 않으면 409 `SNAPSHOT_INVALID`.
3. 지금 메모가 다른 사람 소유로 바뀌어 있으면 403으로 멈춥니다.

**2) 실행 전에 버전과 바뀔 항목을 보여 줍니다.** 본문 없이(또는 `confirm` 없이) 부르면 미리 보기만 하고 쓰지 않습니다.
- 응답: `200 { id, dryRun: true, restored: false, before: 'modified'|'deleted'|'unchanged', changes: ['title','body'] 등, version: { policyRevision, policySha256, snapshotSha256, capturedAt } }`.
- 바뀐 내용이 없으면(`unchanged`) 확인해도 쓰지 않습니다.

**3) 확인한 뒤 지정한 한 건만 되돌립니다.** 같은 경로에 `{ "confirm": true }`를 보내면 그 한 건만 사본 내용으로 되돌립니다(지워졌으면 같은 ID·소유자로 다시 만듦). 다른 메모와 다른 서비스 규칙은 건드리지 않습니다.

**4) 복원한 한 건을 사본과 대조합니다.** 다시 읽은 값의 ID·소유자·내용 해시(제목+U+001F+본문의 SHA-256, DB와 같은 규칙)를 사본과 비교합니다. 하나라도 다르면 500 `RESTORE_MISMATCH`로 실패를 알리고 성공으로 적지 않습니다. 결과는 `audit_log`에 한 줄 덧붙입니다(기존 기록은 고치거나 지우지 않음, 본문·토큰은 넣지 않음).

- 사본: `supabase/step10-backup.sql`의 트리거가 메모가 처음 만들어질 때 ID·소유자·제목·본문·내용 해시를 `note_snapshots`에 남깁니다. 서버는 사본을 읽기만 하고(고치기·지우기 권한 없음), 감사 기록은 읽기·덧붙이기만 합니다. 기존 메모 5건도 실행 시점 내용으로 사본을 남겼고, 5건 모두 해시 검증을 통과했습니다.
- 제작 4(복구 뒤 재시험 순서): 아래 순서대로 다시 실행합니다. 결과 칸은 실제로 실행한 것만 적습니다.

| 순서 | 요청 | 기대 | 결과 |
|---|---|---|---|
| 1 | `npm run policy:diff` | 차이 없음 | 실행: 차이 없음 |
| 2 | 로컬 시험 `npm run test:restore`·`test:decider`·`test:notes`·`test:detect`·`decider:test`·`detect:test` | 모두 통과 | 실행: 모두 통과 |
| 3 | 토큰 없이 `GET /api/my/notes`, `GET /api/notes`, `POST /api/restore/:noteId` | 401 JSON | 실행(cfc6aa7 배포): 모두 401, 복원 경로 GET은 405 |
| 4 | 엉터리 토큰으로 `POST /api/restore/:noteId` | 401 JSON | 실행(cfc6aa7 배포): 401 `UNAUTHENTICATED` |
| 5 | `/data.json`, 공개 키로 원본 `/rest/v1/notes`·`note_snapshots`·`audit_log` | 404 / 권한 오류 | 실행(cfc6aa7 배포): 404, 세 테이블 모두 401 |
| 6 | A로 로그인해 내 메모 목록·추가·수정·삭제 | 정상 | 미실행(학생 직접 확인) |
| 7 | B로 A의 메모 읽기·고치기·지우기·복원 | 403 | 미실행(심판 공격으로 확인) |
| 8 | B로 자기 메모를 고치거나 지운 뒤 `POST /api/restore/:id`(미리 보기) → `{ "confirm": true }` | 미리 보기 200(버전·바뀔 항목), 확인 후 200(사본과 같은 ID·소유자·해시) | 미실행(심판 공격으로 확인, 로컬 test:restore는 통과) |
| 9 | 판정기: 미등록 기기 거부, 복합 이상 추가 확인, 전체 목록·공지 거부 | deny / step_up / deny | 실행: test:decider 통과 |

- 첫 제출 판정(28be121, 48점, `S10_BACKUP_UNVERIFIED`): 메모 복원 경로가 실행 전에 버전과 바뀔 항목을 보여 주지 않고 바로 덮어썼고, 복원 전에 안전 정책 사본을 다시 검증하지 않았습니다. 미리 보기 → 확인(`confirm`) 두 단계로 바꾸고 요청마다 정책 사본을 다시 검증하게 했습니다.
- 남은 약점: 사본은 메모가 처음 만들어질 때 한 번만 남기므로, 정상적으로 고친 내용도 복원하면 처음 내용으로 돌아갑니다. 사본 테이블 자체의 백업과 정기 복원 시험은 아직 없습니다.

## 11단계 기록: 나만의 접속 앱을 완성합니다

- 제작 1(설치형 웹앱): `public/manifest.json`(앱 이름 「최부장의 비밀창고 자료실」, standalone, 아이콘 `public/icon.svg`)과 오프라인 안내(`public/offline.html`, 서비스 워커 `public/sw.js`)를 붙였습니다. 서비스 워커는 화면 이동이 네트워크에서 실패할 때 오프라인 안내만 보여 주고, 메모·API 응답·토큰은 저장하지 않습니다. 화면에 「앱 설치 표시만으로는 기기 확인이 끝나지 않는다」고 적었습니다. 따로 설치하는 접속 프로그램은 없습니다.
- 제작 2(기기 승인 흐름):
  - `POST /api/device/request`(로그인한 학생): 서버가 무작위 기기 ID(16자리 16진수, 개인키 아님)를 만들어 **HttpOnly·Secure·SameSite=Strict 쿠키**(`Path=/api`)로만 주고, DB(`device_registrations`, `supabase/step11-devices.sql`)에는 그 해시와 `pending` 상태만 남깁니다. 요청만으로는 승인되지 않습니다.
  - 승인·회수는 서버 코드가 아니라 강사가 SQL Editor에서 상태를 `approved`/`revoked`로 바꿀 때만 됩니다(서버 전용 키에는 읽기·넣기 권한만 있음).
  - `GET /api/device/status`: 서버가 확인한 승인 여부만 돌려줍니다. 로그인 없이도 200 `{ approved: false }`이고 자료는 넣지 않습니다.
  - 보호 자료 API(`/api/my/notes`, `/api/notes`, `/api/notes/:id`, `/api/notices*`, `/api/restore/:noteId`)는 로그인한 학생 계정과 이 기기가 **서버 명단에서 승인된 짝**일 때만 처리하고, 아니면 403 `DEVICE_NOT_APPROVED`입니다. 그래서 기기 쿠키가 없는 직접 요청(서명·승인 없이 보내는 보호 요청)에는 자료가 나가지 않습니다.
  - 화면은 로그인 뒤 서버에 승인 여부를 묻고, 승인된 경우에만 자료실(메모 목록·편집)을 엽니다. 승인 전에는 메모를 요청하지도 보여 주지도 않습니다.
  - 로그인 토큰은 브라우저 저장소에 넣지 않고 창의 메모리에만 둡니다(`persistSession: false`). 새로고침하면 다시 로그인합니다. 기기 ID 쿠키는 자바스크립트가 읽을 수 없습니다.
- 요청 서명: 설치형 앱의 요청 서명(경로·본문 변경 탐지)은 반 엔진의 mTLS 릴레이가 검증합니다. 이 저장소에는 엔진의 서명·기기 승인 계약이 없어서(`docs/DECIDER_REQUEST.md`) 서명을 직접 검증하지 않고, 승인되지 않은 기기의 요청에는 자료를 주지 않는 것으로 막습니다. 판정기에는 `GET /api/device/status`, `POST /api/device/request` 두 경로만 `device` 구역으로 더했습니다.
- 정책 사본: 경로 표가 바뀌어 `npm run policy:diff`가 차이 두 줄을 보였고, 검토 후 `npm run policy:snapshot -- 2`로 버전 2 사본을 새로 남겼습니다(같거나 낮은 버전으로는 덮어쓰지 않음, `policy/audit.jsonl`에 기록).
- 확인 순서: `npm run test:device`(상태 응답, 승인 요청·쿠키, 승인 전 자료 없음, 승인 후 정상, manifest·저장소 미사용), 기존 `test:notes`·`test:restore`·`test:decider`. 배포 후: 로그인 없이 `GET /api/device/status` → 200 `approved: false`, A로 로그인 → 승인 요청 → (SQL로 승인) → 「승인 상태 다시 확인」 → 자료실 열림.
- 남은 약점: 기기 ID는 쿠키라서 같은 브라우저 프로필을 복사하면 따라갈 수 있습니다. 요청 서명은 엔진에 맡겼고, 승인은 SQL로만 합니다.

### 11단계 제출 전 보안 점검

| 점검 | 결과 | 조치 |
|---|---|---|
| 의존성(`npm audit --omit=dev`) | 취약점 0건 | 없음 |
| 저장소·커밋 이력의 비밀값(서버 전용 키·토큰·개인키) | 없음 | 없음. 커밋 작성자 정보에는 GitHub 계정 메일이 보임(비밀값 아님) |
| 인라인 스크립트·다른 사이트의 틀 안 표시 | CSP·frame 제한이 없었음 | 화면 코드를 `public/app.js`로 옮기고 `vercel.json`에 CSP(`script-src 'self' https://cdn.jsdelivr.net`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`)·`X-Frame-Options: DENY`·`Referrer-Policy: no-referrer`·`Permissions-Policy` 추가 |
| 기기 승인 요청 남발 | 한 계정이 대기 요청을 무제한으로 만들 수 있었음 | 계정당 대기 요청 3건까지, 넘으면 429 |
| 지워진 메모 ID 재사용 | 다른 사람이 지워진 메모의 ID로 새 메모를 만들면 원래 주인이 복원할 수 없었음 | 사본에 남은 ID로는 새 메모를 만들 수 없게 409 |
| 쿠키만으로 하는 요청 위조(CSRF) | 해당 없음 | 보호 API는 Bearer 토큰과 기기 쿠키가 둘 다 있어야 하고, 쿠키는 SameSite=Strict |
| 화면 출력(XSS) | 메모·상태 문구는 모두 `textContent`로 넣음, `innerHTML` 없음 | 없음 |
| 오류 응답 | 내부 오류 내용·키를 내보내지 않고 `SERVER_ERROR`만 응답 | 없음 |
| DB 직접 접근 | 공개 키로 `notes`·`note_snapshots`·`audit_log`·`device_registrations` 모두 거부 | 없음 |
