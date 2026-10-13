import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../api/checks.js';
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

test('12단계: 점검 API는 고정된 가상 입력만 실행하고 모든 사례가 기대대로 나온다', async () => {
  const summary = await call({});
  assert.equal(summary.status, 200);
  assert.equal(summary.headers['cache-control'], 'no-store');
  assert.equal(summary.body.total, CHECK_CASES.length);
  assert.equal(summary.body.ready, CHECK_CASES.length);
  assert.ok(summary.body.cases.some((item) => item.kind === '정상'));
  assert.ok(summary.body.cases.some((item) => item.kind === '금지'));
  for (const item of CHECK_CASES) {
    const one = await call({ case: item.id });
    assert.equal(one.status, 200);
    assert.equal(one.body.ready, true, item.id);
  }
});

test('12단계: 모르는 사례·배열 입력·GET 외 요청은 실행하지 않는다', async () => {
  assert.equal((await call({ case: 'constructor' })).status, 400);
  assert.equal((await call({ case: ['s06-unregistered'] })).status, 400);
  assert.equal((await call({}, 'POST')).status, 405);
  const text = JSON.stringify((await call({})).body);
  assert.equal(/"(title|body|content)"\s*:/u.test(text), false);
});
