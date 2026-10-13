import { randomUUID } from 'node:crypto';
import config from '../aleph.config.json' with { type: 'json' };

// 1~11단계 자기 점검(12단계 runner 규칙): 배포에 실제 요청을 보내 그 응답으로 observed를 만들고,
// 판정기·탐지 규칙·정책 사본은 배포의 /api/checks?case=... 로 고정된 가상 입력을 실행해 확인합니다.
// 고정 문자열로 「막음」을 적지 않습니다. 요청을 보내지 못한 점검은 result를 not_run으로 둡니다.
// 토큰·개인키·실명·메모 본문은 결과에 넣지 않습니다. 이 결과는 학생의 자기 점검이며 심판 판정이 아닙니다.

// Supabase 공개용(publishable) 키입니다. 브라우저 화면에도 들어가는 값이라 숨길 필요가 없습니다.
const PUBLIC_KEY = 'sb_publishable_0ob3zQmenT9MOOcxmrpaHw_ri91--ge';
const TEST_UUID = '00000000-0000-4000-8000-000000000001';
// 서명 자리가 엉터리인 가짜 토큰입니다. 실제 토큰이 아닙니다.
const FAKE_TOKEN = 'Bearer aaaa.bbbb.cccc';

async function probe(base, path, { method = 'GET', headers = {}, body, caseId } = {}) {
  const requestId = randomUUID();
  try {
    const response = await fetch(new URL(path, base), {
      method, redirect: 'manual', signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      // runner가 같은 요청을 사례와 이어서 관측할 수 있게 붙이는 메타데이터입니다(요청 헤더·주소에는 넣지 않음).
      alephEvidence: { caseId, requestKey: requestId },
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { ran: true, requestId, status: response.status, json,
      hasNotes: /"(title|body|content)"\s*:/u.test(text) };
  } catch (error) {
    return { ran: false, requestId, error: String(error?.message ?? error).slice(0, 60) };
  }
}

const denied = (r) => [401, 403, 404].includes(r.status) && !r.hasNotes;
const refusedJson = (r) => [401, 403].includes(r.status) && typeof r.json?.error === 'string' && !r.hasNotes;

function attempt(attackId, stage, expected, r, blockedWhen) {
  if (!r.ran) return { attackId, stage, expected, observed: `요청을 보내지 못함 (${r.error}); 요청 ID ${r.requestId}`, result: 'not_run' };
  const extra = typeof r.json?.ready === 'boolean' ? `; jsonReady=${r.json.ready}` : '';
  return { attackId, stage, expected, observed: `HTTP ${r.status}${extra}; 요청 ID ${r.requestId}`,
    result: blockedWhen(r) ? 'blocked' : 'breached' };
}

function appBase(target) {
  const url = typeof target === 'string' ? target : target?.publicAppUrl;
  let app;
  try {
    app = new URL(url);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  return app;
}

// 인자는 배포 주소(runner 규칙) 또는 예전처럼 aleph.config.json 객체 둘 다 받습니다.
export async function runAttackChecks(target = config.publicAppUrl) {
  const app = appBase(target);
  const originalApiUrl = (typeof target === 'object' && target?.originalApiUrl) || config.originalApiUrl;
  const out = [];
  const add = async (id, stage, expected, path, options, rule = denied) => {
    out.push(attempt(id, stage, expected, await probe(app, path, { ...options, caseId: id }), rule));
  };
  await add('s01-static-notes', 1, '/data.json에 메모가 없음', '/data.json');
  await add('s02-static-copy', 2, '다른 정적 사본(/notes.json)에 메모가 없음', '/notes.json');
  await add('s03-unauth-list', 3, '로그인 없는 내 메모 목록은 401·403과 JSON 오류', '/api/my/notes', {}, refusedJson);
  await add('s03-fake-token', 3, '엉터리 토큰은 401·403과 JSON 오류', '/api/my/notes', { headers: { authorization: FAKE_TOKEN } }, refusedJson);
  await add('s04-query-identity', 4, '쿼리로 넣은 신원·역할은 무시', `/api/my/notes?userId=${TEST_UUID}&role=instructor`, {}, refusedJson);
  await add('s04-header-identity', 4, '헤더로 넣은 신원·역할은 무시', '/api/my/notes',
    { headers: { 'x-user-id': TEST_UUID, 'x-role': 'instructor' } }, refusedJson);
  if (typeof originalApiUrl === 'string' && originalApiUrl.startsWith('https://')) {
    const original = new URL(originalApiUrl);
    out.push(attempt('s05-direct-table', 5, '공개 키로 원본 자료 API를 직접 불러도 메모가 없음',
      await probe(original.origin, `${original.pathname}?select=id&limit=1`,
        { headers: { apikey: PUBLIC_KEY, authorization: `Bearer ${PUBLIC_KEY}` }, caseId: 's05-direct-table' }),
      (r) => !(r.status === 200 && Array.isArray(r.json) && r.json.length > 0)));
  }
  await add('s08-other-zone', 8, '로그인 없는 강사 공지 조회 거부', '/api/notices', {}, refusedJson);
  await add('s10-restore-unauth', 10, '로그인 없는 복원 요청 거부', `/api/restore/${TEST_UUID}`,
    { method: 'POST', body: { confirm: true } }, refusedJson);
  await add('s11-device', 11, '로그인 없는 기기 상태는 승인 전·자료 없음', '/api/device/status', {},
    (r) => r.status === 200 && r.json?.approved === false && !r.hasNotes);
  await add('s11-unsigned-write', 11, '서명·승인 없는 수정 요청 거부', `/api/notes/${TEST_UUID}`,
    { method: 'PUT', headers: { authorization: FAKE_TOKEN }, body: { title: 'x' } }, refusedJson);

  // 고정된 가상 입력을 배포의 점검 API에서 실행하고, runner가 같은 HTTP 응답을 관측하게 합니다.
  for (const [id, stage, expected] of [
    ['s06-unregistered', 6, '미등록 기기 거부'], ['s07-compound', 7, '복합 이상 접속은 추가 확인'],
    ['s08-unknown-route', 8, '모르는 경로 거부'], ['s08-all-notes', 8, '전체 메모 목록 거부'],
    ['s08-write-notice', 8, '반 공지 쓰기 거부'], ['s09-burst-read', 9, '조회 폭주는 회수 제안'],
    ['s10-policy-verified', 10, '검증한 정책 사본과 지금 정책이 같음']]) {
    await add(id, stage, expected, `/api/checks?case=${id}`, {}, (r) => r.status === 200 && r.json?.ready === true);
  }
  out.sort((a, b) => a.stage - b.stage);
  return out;
}
