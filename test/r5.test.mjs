import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';

const config = {
  step: 1,
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  sampleMarker: 'SAMPLE_NOTE_1',
  publicAppUrl: 'https://student-defense.vercel.app',
};
const env = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

test('build identity uses Vercel Git and deployment metadata', () => {
  assert.deepEqual(deploymentIdentity(env, config), {
    schema: 'aleph.defense.deployment.v1',
    step: 1,
    repoUrl: 'https://github.com/student-a/aleph-defense',
    commit: 'a'.repeat(40),
    publicAppUrl: 'https://student-defense-123.vercel.app',
    judgeIssuer: config.judgeIssuer,
    sampleMarker: config.sampleMarker,
  });
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_PROVIDER: undefined }, config));
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_COMMIT_SHA: 'short' }, config));
});

test('12단계 runner 규칙: 점검 항목은 다섯 값만 갖고 실제 응답으로 blocked·breached·not_run을 정한다', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  try {
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      seen.push([init?.method ?? 'GET', u]);
      if (u.includes('/api/checks?case=')) return new Response(JSON.stringify({ ready: true }), { status: 200 });
      if (u.endsWith('/api/device/status')) return new Response(JSON.stringify({ approved: false }), { status: 200 });
      if (u.includes('/rest/v1/')) return new Response(JSON.stringify({ message: 'permission denied' }), { status: 401 });
      if (u.endsWith('.json')) return new Response('not found', { status: 404 });
      return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
    };
    const results = await runAttackChecks('https://student-defense.vercel.app');
    assert.ok(results.length >= 15 && results.length <= 20);
    for (const item of results) {
      assert.deepEqual(Object.keys(item).sort(), ['attackId', 'expected', 'observed', 'result', 'stage']);
      assert.equal(item.result, 'blocked', item.attackId);
      assert.match(item.observed, /^HTTP \d{3}.*요청 ID [0-9a-f-]{36}$/u);
    }
    assert.deepEqual(results.map((item) => item.stage), [...results.map((item) => item.stage)].sort((a, b) => a - b));
    assert.ok(seen.some(([method, url]) => method === 'POST' && url.includes('/api/restore/')));
    // 예전처럼 설정 객체를 넘겨도 같은 점검을 한다.
    assert.equal((await runAttackChecks({ ...config, step: 12 })).length, results.length);

    globalThis.fetch = async (url) => (String(url).includes('/api/my/notes')
      ? new Response(JSON.stringify([{ id: 'x', title: 'leak' }]), { status: 200 })
      : new Response(JSON.stringify({ error: 'x', ready: false }), { status: 401 }));
    const open = await runAttackChecks('https://student-defense.vercel.app');
    assert.equal(open.find((item) => item.attackId === 's03-unauth-list').result, 'breached');
    assert.equal(open.find((item) => item.attackId === 's06-unregistered').result, 'breached');

    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.ok((await runAttackChecks('https://student-defense.vercel.app')).every((item) => item.result === 'not_run'));
    await assert.rejects(runAttackChecks('http://student-defense.vercel.app'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
