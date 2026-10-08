// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
async function probe(app, path, headers = {}) {
  const response = await fetch(new URL(path, app), {
    redirect: 'error', headers, signal: AbortSignal.timeout(10000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON response is not data.
  }
  return { status: response.status, body };
}

// Supabase 공개용(publishable) 키입니다. 브라우저 화면에도 들어가는 값이라 숨길 필요가 없습니다.
const PUBLIC_KEY = 'sb_publishable_0ob3zQmenT9MOOcxmrpaHw_ri91--ge';

const refused =(result) => [401, 403].includes(result.status)
  && typeof result.body?.error === 'string' && !Array.isArray(result.body);

export async function runAttackChecks(config) {
  if (![4, 5].includes(config.step)) throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
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
  const noToken = await probe(app, '/api/notes');
  // 서명 자리가 엉터리인 가짜 토큰입니다. 실제 토큰이 아닙니다.
  const forged = await probe(app, '/api/notes', { authorization: 'Bearer aaaa.bbbb.cccc' });
  const attempts = [
    { attackId: 'static_data_json_read', expected: '공개 /data.json에 메모가 없음',
      observed: Array.isArray(staticFile.body?.notes) && staticFile.body.notes.length > 0
        ? '비로그인 /data.json에서 메모가 보임'
        : `비로그인 /data.json에서 메모가 보이지 않음 (HTTP ${staticFile.status})` },
    { attackId: 'no_token_notes_list', expected: '로그인 토큰 없이 목록을 요청하면 401·403과 JSON 오류',
      observed: refused(noToken) ? `토큰 없는 요청이 거부됨 (HTTP ${noToken.status})`
        : `토큰 없는 요청이 거부되지 않음 (HTTP ${noToken.status})` },
    { attackId: 'forged_token_notes_list', expected: '엉터리 토큰으로 목록을 요청하면 401·403과 JSON 오류',
      observed: refused(forged) ? `엉터리 토큰 요청이 거부됨 (HTTP ${forged.status})`
        : `엉터리 토큰 요청이 거부되지 않음 (HTTP ${forged.status})` },
  ];
  if (config.step >= 5) {
    // 5단계: 원본 자료 API를 공개 키만으로 직접 부르면 메모가 나오면 안 됩니다. 공개 키는 화면에도 있는 값입니다.
    const original = await probeOriginal(config.originalApiUrl);
    attempts.push({
      attackId: 'direct_original_api_read', expected: '공개 키로 원본 자료 API를 직접 불러도 메모가 없음',
      observed: original.leaked ? '공개 키로 원본 API에서 메모가 보임'
        : `공개 키로 원본 API를 불러도 메모가 보이지 않음 (HTTP ${original.status})`,
    });
  }
  return attempts;
}

async function probeOriginal(originalApiUrl) {
  const url = new URL(originalApiUrl);
  if (url.protocol !== 'https:') throw new Error('aleph.config.json의 originalApiUrl은 HTTPS여야 합니다.');
  const response = await fetch(`${url.origin}${url.pathname}?select=id&limit=1`, {
    redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { apikey: PUBLIC_KEY, authorization: `Bearer ${PUBLIC_KEY}` },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON response is not data.
  }
  return { status: response.status, leaked: response.ok && Array.isArray(body) && body.length > 0 };
}
