// 자료실 화면 코드입니다. 콘텐츠 보안 정책(CSP)으로 인라인 스크립트를 막기 위해 별도 파일로 둡니다.
// 5단계 가점: 이 화면 코드에는 Supabase 주소도 공개 키도 없습니다. 로그인·가입·갱신은 서버 함수(/api/auth/*)가 대신 보냅니다.
// 11단계: 로그인 토큰은 브라우저 저장소(localStorage 등)에 넣지 않고 이 창의 메모리에만 둡니다.
let session = null; // { accessToken, refreshToken, expiresAt, email }
let refreshing = null;
const $ = (id) => document.getElementById(id);
let editingId = null;

const say = (text) => { $('message').textContent = text; };

async function authCall(name, body, token) {
  const response = await fetch('/api/auth/' + name, {
    method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || '요청을 처리하지 못했습니다.');
  return result;
}

// 만료 1분 전이면 서버를 통해 갱신합니다. 갱신하지 못하면 로그아웃 상태로 돌아갑니다.
async function currentToken() {
  if (!session) return null;
  if (session.expiresAt - 60 > Date.now() / 1000) return session.accessToken;
  refreshing ??= authCall('refresh', { refreshToken: session.refreshToken })
    .then((next) => { session = { ...next, email: next.email ?? session?.email }; })
    .catch(() => { session = null; render(null); })
    .finally(() => { refreshing = null; });
  await refreshing;
  return session?.accessToken ?? null;
}

async function api(path, options = {}) {
  const token = await currentToken();
  const response = await fetch(path, {
    ...options,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  });
  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || `요청 실패 (HTTP ${response.status})`);
  return result;
}

function resetEditor() {
  editingId = null;
  $('editor').reset();
  $('save').textContent = '추가';
  $('cancel').hidden = true;
}

async function loadNotes() {
  const notes = await api('/api/my/notes');
  const items = notes.map((note) => {
    const li = document.createElement('li');
    li.className = 'card';
    const title = document.createElement('strong');
    const body = document.createElement('span');
    title.textContent = note.title;
    body.textContent = note.body;
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '수정';
    edit.addEventListener('click', () => {
      editingId = note.id;
      $('title').value = note.title;
      $('body').value = note.body;
      $('save').textContent = '저장';
      $('cancel').hidden = false;
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '삭제';
    remove.addEventListener('click', async () => {
      try { await api(`/api/notes/${note.id}`, { method: 'DELETE' }); await loadNotes(); say('삭제했습니다.'); }
      catch (error) { say(error.message); }
    });
    li.append(title, body, edit, remove);
    return li;
  });
  if (!items.length) {
    const empty = document.createElement('li');
    empty.textContent = '아직 메모가 없습니다. 위에서 추가해 보세요.';
    items.push(empty);
  }
  $('notes').replaceChildren(...items);
}

// 11단계: 서버가 이 기기를 승인된 기기로 확인한 뒤에만 자료실(메모)을 엽니다.
// 승인 여부는 서버 응답으로만 판단하고, 기기 ID는 자바스크립트가 읽을 수 없는 쿠키로만 서버와 주고받습니다.
async function checkDevice() {
  $('vault').hidden = true;
  $('notes').replaceChildren();
  const status = await api('/api/device/status');
  const messages = {
    device_approved: '서버가 이 기기를 승인했습니다. 자료실을 엽니다.',
    approval_pending: '승인 요청을 보냈습니다. 강사가 서버에서 승인하기 전에는 자료가 열리지 않습니다.',
    device_revoked: '이 기기의 승인이 회수됐습니다. 자료를 열 수 없습니다.',
    device_not_registered: '이 기기는 아직 승인되지 않았습니다. 승인 전에는 메모를 보여 주지 않습니다.',
  };
  $('device-state').textContent = messages[status.reason] ?? '이 기기의 승인 여부를 확인하지 못했습니다.';
  $('device-request').hidden = status.approved || status.reason !== 'device_not_registered';
  $('device-refresh').hidden = status.approved;
  if (!status.approved) return;
  $('vault').hidden = false;
  await loadNotes();
}

async function render(current) {
  const loggedIn = Boolean(current);
  $('login').hidden = loggedIn;
  $('session').hidden = !loggedIn;
  if (!loggedIn) { $('vault').hidden = true; $('notes').replaceChildren(); resetEditor(); return; }
  $('who').textContent = `${current.email ?? '내 계정'} 로 로그인했습니다.`;
  try { await checkDevice(); } catch (error) { say(error.message); }
}

$('device-request').addEventListener('click', async () => {
  try { await api('/api/device/request', { method: 'POST' }); await checkDevice(); }
  catch (error) { say(error.message); }
});
$('device-refresh').addEventListener('click', async () => {
  try { await checkDevice(); } catch (error) { say(error.message); }
});

$('login').addEventListener('submit', async (event) => {
  event.preventDefault();
  say('');
  try {
    session = await authCall('login', { email: $('email').value, password: $('password').value });
    await render(session);
  } catch (error) { say('로그인하지 못했습니다: ' + error.message); }
  $('password').value = '';
});
$('signup').addEventListener('click', async () => {
  say('');
  if (!$('login').reportValidity()) return;
  try {
    const result = await authCall('signup', { email: $('email').value, password: $('password').value });
    if (result.accessToken) { session = result; await render(session); }
    else say('가입했습니다. 확인 메일의 링크를 누른 뒤 로그인해 주세요.');
  } catch (error) { say('가입하지 못했습니다: ' + error.message); }
  $('password').value = '';
});
$('logout').addEventListener('click', async () => {
  const token = session?.accessToken;
  session = null;
  await render(null);
  if (token) authCall('logout', {}, token).catch(() => {});
  say('로그아웃했습니다.');
});
$('cancel').addEventListener('click', resetEditor);
$('editor').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = JSON.stringify({ title: $('title').value, body: $('body').value });
  try {
    if (editingId) await api(`/api/notes/${editingId}`, { method: 'PUT', body: payload });
    else await api('/api/notes', { method: 'POST', body: payload });
    resetEditor();
    await loadNotes();
    say('저장했습니다.');
  } catch (error) { say(error.message); }
});

// 12단계 탈환 작전실: 이 화면이 지금 실제로 보낸 요청의 응답과 서버의 고정 가상 입력 점검 결과만 보여 줍니다.
// 결과는 응답 상태로만 정하고, 보내지 못한 시험은 미실행으로 둡니다. 메모 본문·토큰은 표에 넣지 않습니다.
const TEST_UUID = '00000000-0000-4000-8000-000000000001';
const FAKE_TOKEN = 'Bearer aaaa.bbbb.cccc';
const hasNoteData = (text) => /"(title|body|content)"\s*:/u.test(text);

async function observe(path, { method = 'GET', headers = {}, body } = {}) {
  const requestId = crypto.randomUUID();
  try {
    const response = await fetch(path, {
      method, cache: 'no-store', credentials: 'same-origin', redirect: 'manual',
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { ran: true, requestId, at: new Date().toISOString(), status: response.status, json, leaked: hasNoteData(text) };
  } catch {
    return { ran: false, requestId, at: new Date().toISOString() };
  }
}

const refusedJson = (r) => [401, 403].includes(r.status) && typeof r.json?.error === 'string' && !r.leaked;

// 출처: 결과 한 줄이 어느 학생 작업에서 나왔는지, 또는 제공 엔진(ALEPH SDP 엔진) 몫인지 적습니다.
const SRC = {
  app: '학생 접속 앱(public/)', api: '학생 자료실 API(api/)', db: '학생 DB 권한(supabase/)', device: '학생 기기 승인 명단(api/device)',
  decider: '학생 판정기(src/decider.mjs)', detect: '학생 탐지 규칙(src/detect.mjs)', policy: '학생 정책 사본(policy/)',
  engine: '제공 엔진(ALEPH SDP 엔진)',
};

function row(stage, kind, request, expected, r, okWhen, source = SRC.api) {
  if (!r.ran) return { stage, kind, request, expected, actual: '요청을 보내지 못함', verdict: 'skip', source, requestId: r.requestId, at: r.at };
  const detail = r.json && typeof r.json === 'object' && !Array.isArray(r.json)
    ? ['error', 'reason', 'approved', 'ready'].filter((k) => k in r.json)
      .map((k) => `${k}=${typeof r.json[k] === 'object' && r.json[k] !== null ? (r.json[k].code ?? 'object') : r.json[k]}`).join(' ') : '';
  return { stage, kind, request, expected, actual: `HTTP ${r.status}${detail ? ` · ${detail}` : ''}`,
    verdict: okWhen(r) ? 'ok' : 'bad', source, requestId: r.requestId, at: r.at };
}

// 서버 점검 API의 고정 가상 입력 사례(src/rule-check.mjs와 같은 목록)입니다.
const RULE_CASES = [
  ['s06-registered', 6, '정상', '등록 기기의 내 메모 읽기 허용'], ['s06-unregistered', 6, '금지', '미등록 기기 거부'],
  ['s07-compound', 7, '금지', '복합 이상 접속은 추가 확인'], ['s07-stepped-up', 7, '정상', '다시 로그인한 복합 이상 접속 허용'],
  ['s08-unknown-route', 8, '금지', '모르는 경로 거부'], ['s08-all-notes', 8, '금지', '전체 메모 목록 거부'],
  ['s08-write-notice', 8, '금지', '반 공지 쓰기 거부'], ['s08-own-list', 8, '정상', '내 메모 목록 허용'],
  ['s09-burst-read', 9, '금지', '10분 안 121건 조회는 회수 제안'], ['s09-normal-read', 9, '정상', '10분 안 120건 조회는 유지'],
  ['s10-policy-verified', 10, '정상', '검증한 정책 사본과 지금 정책이 같음'],
];

const skipped = (stage, kind, request, expected, why, source = SRC.api) => ({ stage, kind, request, expected, actual: why, verdict: 'skip', source, requestId: '-', at: '-' });

async function runOps() {
  $('ops-run').disabled = true;
  $('live-meta').textContent = '점검 중입니다.';
  const rows = [];
  // 금지 요청: 이 화면에서 실제로 보냅니다.
  rows.push(row(1, '금지', 'GET /data.json', '메모 없음(404)', await observe('/data.json'), (r) => r.status === 404 && !r.leaked, SRC.app));
  rows.push(row(3, '금지', 'GET /api/my/notes (토큰 없음)', '401 JSON', await observe('/api/my/notes'), refusedJson));
  rows.push(row(3, '금지', 'GET /api/my/notes (엉터리 토큰)', '401 JSON', await observe('/api/my/notes', { headers: { authorization: FAKE_TOKEN } }), refusedJson));
  rows.push(row(4, '금지', 'GET /api/my/notes?userId=…&role=instructor', '쿼리 신원 무시, 401', await observe(`/api/my/notes?userId=${TEST_UUID}&role=instructor`), refusedJson));
  rows.push(row(4, '금지', 'GET /api/notes/:id (토큰 없음, 남의 메모)', '401 JSON', await observe(`/api/notes/${TEST_UUID}`), refusedJson));
  rows.push(row(8, '금지', 'GET /api/notices (토큰 없음)', '401 JSON', await observe('/api/notices'), refusedJson));
  rows.push(row(10, '금지', 'POST /api/restore/:id (토큰 없음)', '401 JSON', await observe(`/api/restore/${TEST_UUID}`, { method: 'POST', body: { confirm: true } }), refusedJson));
  rows.push(row(11, '금지', 'PUT /api/notes/:id (서명·승인 없음)', '401 JSON', await observe(`/api/notes/${TEST_UUID}`, { method: 'PUT', headers: { authorization: FAKE_TOKEN }, body: { title: 'x' } }), refusedJson));

  // 판정기·탐지 규칙·정책 사본: 서버가 고정된 가상 입력 하나씩을 지금 실행한 결과입니다.
  for (const [id, stage, kind, expected] of RULE_CASES) {
    const r = await observe(`/api/checks?case=${id}`);
    const j = r.json ?? {};
    const actual = j.decision ?? j.action ?? (j.policyRevision != null ? `정책 버전 ${j.policyRevision}` : '-');
    const fallback = stage === 9 ? SRC.detect : stage === 10 ? SRC.policy : SRC.decider;
    const source = typeof j.source === 'string' ? j.source : fallback;
    const item = row(stage, kind, `가상 입력 ${id}`, expected, r, (x) => x.status === 200 && x.json?.ready === true, source);
    if (r.ran && r.status === 200) item.actual = `${actual}${j.reasonCode ? ` (${j.reasonCode})` : ''}`;
    rows.push(item);
  }

  // 정상 요청: 로그인하고 이 기기가 승인된 경우에만 실제로 보냅니다. 아니면 미실행입니다.
  const token = await currentToken();
  if (!token) {
    rows.push(skipped(11, '정상', 'GET /api/device/status (로그인)', 'approved=true', '로그인 후 실행', SRC.device));
    rows.push(skipped(3, '정상', 'GET /api/my/notes (로그인·승인 기기)', '200, 내 메모만', '로그인·기기 승인 후 실행'));
  } else {
    const auth = { authorization: `Bearer ${token}` };
    const device = await observe('/api/device/status', { headers: auth });
    rows.push(row(11, '정상', 'GET /api/device/status (로그인)', 'approved=true', device, (r) => r.status === 200 && r.json?.approved === true, SRC.device));
    if (device.json?.approved === true) {
      const mine = await observe('/api/my/notes', { headers: auth });
      const count = Array.isArray(mine.json) ? mine.json.length : null;
      const shown = { ...mine, json: undefined, leaked: false };
      const result = row(3, '정상', 'GET /api/my/notes (로그인·승인 기기)', '200, 내 메모만', shown, (r) => r.status === 200 && count !== null);
      if (count !== null) result.actual += ` · 메모 ${count}건(본문 숨김)`;
      rows.push(result);
    } else {
      rows.push(skipped(3, '정상', 'GET /api/my/notes (로그인·승인 기기)', '200, 내 메모만', '이 기기가 승인되지 않아 미실행'));
    }
  }

  // 제공 엔진의 집행(판정 집행·회수 집행·요청 서명 확인)은 이 화면이 받지 않으므로 미실행으로 둡니다.
  rows.push(skipped('6~11', '엔진', 'ALEPH SDP 엔진의 판정 집행·회수 집행·요청 서명 확인', '엔진이 집행', '이 화면은 엔진 집행 결과를 받지 않음', SRC.engine));

  rows.sort((a, b) => Number(String(a.stage).split('~')[0]) - Number(String(b.stage).split('~')[0]));
  const labels = { ok: '확인함', bad: '뚫림', skip: '미실행' };
  $('ops-table').tBodies[0].replaceChildren(...rows.map((item) => {
    const tr = document.createElement('tr');
    for (const [key, value] of [['stage', item.stage], ['kind', item.kind], ['request', item.request], ['expected', item.expected],
      ['actual', item.actual], ['verdict', labels[item.verdict]], ['source', item.source], ['requestId', item.requestId], ['at', item.at]]) {
      const td = document.createElement('td');
      td.textContent = String(value);
      if (key === 'verdict') td.className = item.verdict;
      tr.append(td);
    }
    return tr;
  }));
  const count = (v) => rows.filter((item) => item.verdict === v).length;
  $('live-meta').textContent = `이 화면에서 보낸 점검 ${rows.length}건 · 확인함 ${count('ok')} · 뚫림 ${count('bad')} · 미실행 ${count('skip')} · 점검 시각 ${new Date().toISOString()}`;
  $('ops-run').disabled = false;
}

// 서버 점검 기록: /api/checks가 돌려준 수치를 계산하지 않고 그대로 옮깁니다. 읽지 못하면 비워 둡니다.
async function loadServerRecord() {
  const r = await observe('/api/checks');
  const record = r.ran && r.status === 200 && r.json && !Array.isArray(r.json) ? r.json : null;
  for (const dd of document.querySelectorAll('#ops-stats dd')) {
    const value = record?.[dd.dataset.k];
    dd.textContent = Number.isInteger(value) ? String(value) : '-';
  }
  $('ops-meta').textContent = record
    ? `기록 시각 ${record.checkedAt ?? '-'} · 검사한 커밋 ${record.commit ?? '-'} · 대상 ${record.target ?? '-'} · 정책 사본 버전 ${record.policyRevision ?? '-'}`
      + ` · 기록 출처 ${record.recordSource ?? '-'} · 제공 엔진 ${record.sources?.engine?.name ?? '-'}(집행 결과 없음)`
    : '서버 점검 기록을 읽지 못했습니다. 수치를 표시하지 않습니다.';
}

$('ops-run').addEventListener('click', () => { runOps().catch(() => { $('live-meta').textContent = '점검 중 오류가 났습니다.'; $('ops-run').disabled = false; }); });
loadServerRecord().catch(() => { $('ops-meta').textContent = '서버 점검 기록을 읽지 못했습니다. 수치를 표시하지 않습니다.'; });

// 설치형 웹앱: 서비스 워커는 오프라인 안내 화면만 저장합니다(메모·API 응답은 저장하지 않음).
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

render(null);
