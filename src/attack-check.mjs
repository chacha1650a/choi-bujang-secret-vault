// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
async function probe(app, path) {
  const response = await fetch(new URL(path, app), {
    redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON response is not data.
  }
  return { status: response.status, body };
}

export async function runAttackChecks(config) {
  if (config.step !== 2) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  if (app.protocol !== 'https:' || app.username || app.password || app.search || app.hash
      || app.pathname !== '/' || app.hostname.endsWith('.example')) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }
  const staticFile = await probe(app, '/data.json');
  const staticLeak = Array.isArray(staticFile.body?.notes) && staticFile.body.notes.length > 0;
  const api = await probe(app, '/api/notes');
  const apiOpen = Array.isArray(api.body?.notes) && api.body.notes.length > 0;
  return [
    { attackId: 'static_data_json_read', expected: '공개 /data.json에 메모가 없음',
      observed: staticLeak ? '비로그인 /data.json에서 메모가 보임'
        : `비로그인 /data.json에서 메모가 보이지 않음 (HTTP ${staticFile.status})` },
    { attackId: 'anonymous_notes_api_read', expected: '3단계 전이라 서버 API는 아직 누구나 부를 수 있음(남은 약점)',
      observed: apiOpen ? '비로그인 /api/notes 요청에 메모가 응답됨 (아직 막지 않은 약점)'
        : `비로그인 /api/notes 요청에 메모가 보이지 않음 (HTTP ${api.status})` },
  ];
}
