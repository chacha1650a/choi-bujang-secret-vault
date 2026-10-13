import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../api/checks.js';
import { runAttackChecks } from '../src/attack-check.mjs';
import { CHECK_CASES } from '../src/rule-check.mjs';

function call(query, method = 'GET') {
  return new Promise((resolve) => {
    const out = { headers: {} };
    handler({ method, query }, {
      setHeader: (key, value) => { out.headers[key.toLowerCase()] = value; },
      status(code) { out.status = code; return this; },
      json(value) { out.body = value; resolve(out); },
    });
  });
}

// 배포를 흉내 내는 가짜 fetch: /api/checks?case=… 는 실제 점검 API 처리기로 응답합니다.
async function fakeDeployment(url) {
  const u = new URL(String(url));
  if (u.pathname === '/api/checks' && u.searchParams.has('case')) {
    const out = await call({ case: u.searchParams.get('case') });
    return new Response(JSON.stringify(out.body), { status: out.status });
  }
  if (u.pathname === '/api/device/status') return new Response(JSON.stringify({ approved: false }), { status: 200 });
  if (u.pathname.endsWith('.json') || u.pathname.startsWith('/rest/')) return new Response('not found', { status: 404 });
  return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
}

test('12단계: 고정 가상 입력 사례는 모두 기대대로 나오고 모르는 입력은 실행하지 않는다', async () => {
  for (const item of CHECK_CASES) {
    const one = await call({ case: item.id });
    assert.equal(one.status, 200);
    assert.equal(one.body.ready, true, item.id);
  }
  assert.equal((await call({ case: 'constructor' })).status, 400);
  assert.equal((await call({ case: ['s06-unregistered'] })).status, 400);
  assert.equal((await call({}, 'POST')).status, 405);
});

test('12단계: 서버 점검 기록의 수치는 bundle과 같은 점검을 실제로 보낸 결과를 그대로 센다', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = fakeDeployment;
    const record = await call({});
    assert.equal(record.status, 200);
    assert.equal(record.headers['cache-control'], 'no-store');
    const direct = await runAttackChecks('https://choi-bujang-secret-vault-delta.vercel.app');
    assert.equal(record.body.total, direct.length);
    assert.equal(record.body.blocked, direct.filter((a) => a.result === 'blocked').length);
    assert.equal(record.body.failed, 0);
    assert.equal(record.body.notRun, 0);
    assert.equal(record.body.total, record.body.blocked + record.body.failed + record.body.notRun);
    assert.deepEqual(record.body.attempts.map((a) => a.attackId), direct.map((a) => a.attackId));
    assert.equal(/"(title|body|content)"\s*:/u.test(JSON.stringify(record.body)), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
