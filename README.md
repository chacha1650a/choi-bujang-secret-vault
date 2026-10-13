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
- 제작 2: 판정기에 `resource_zone` 규칙을 넣었습니다. 엔진이 확인한 사용자(`subjectId`)·기기(`deviceId`)·메서드·정확한 경로가 서비스(`notes`)가 내 메모 구역 표(메모 5개 경로)와 맞을 때만 다음 규칙으로 넘어가고, 표에 없는 경로·메서드와 경로 모양이 다른 요청, 다른 서비스, 쿼리가 붙은 요청은 `resource_zone_denied`로 거부합니다. 강사 공지 구역(`/notices`)은 강사 역할이 판정 계약에 없어서 판정기에서는 읽기·수정 모두 허용하지 않습니다. 기존 기기·추가 확인 규칙은 그대로입니다.
- 제작 3: 자료 API가 다시 확인합니다. 메모는 DB 소유자와 검증된 사용자가 다르면 403(`reason: not_owner`), 공지 구역은 읽기·수정 모두 검증된 학생 계정이 DB 강사 명단에 있을 때만 허용하고 아니면 403(`reason: instructor_only`)입니다. 화면 메뉴·요청 본문·토큰의 role은 믿지 않고, 심판 시험 신원은 강사가 될 수 없습니다.
- 확인 순서: `npm run test:decider`(구역 허용·거부), `npm run test:notes`(학생·심판의 공지 읽기·수정 거부, 강사 명단 계정만 공지 읽기·수정, B의 A 메모 거부). 토큰 없이 `/api/notices`를 부르면 401입니다.
- 첫 제출 판정(36점, `S08_OTHER_ZONE_ALLOWED`): 일반 학생이 강사 공지 구역을 읽을 수 있었습니다. 공지 구역을 판정기와 API 모두에서 강사 전용으로 좁혔습니다.
- 남은 약점: 강사 명단은 SQL Editor로만 관리합니다. 판정기와 자료 API의 경로 표를 두 곳에서 맞춰야 합니다.
