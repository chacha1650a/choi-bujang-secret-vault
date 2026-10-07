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

test('stage 3 attack check sends no token and a forged token', async () => {
  const originalFetch = globalThis.fetch;
  const seen = [];
  try {
    globalThis.fetch = async (url, init) => {
      seen.push([String(url), init?.headers?.authorization]);
      if (String(url).endsWith('/data.json')) return new Response('not found', { status: 404 });
      return new Response(JSON.stringify({ error: 'UNAUTHENTICATED' }), { status: 401 });
    };
    const results = await runAttackChecks({ ...config, step: 3 });
    assert.deepEqual(seen, [
      ['https://student-defense.vercel.app/data.json', undefined],
      ['https://student-defense.vercel.app/api/notes', undefined],
      ['https://student-defense.vercel.app/api/notes', 'Bearer aaaa.bbbb.cccc'],
    ]);
    assert.match(results[1].observed, /거부됨/u);
    assert.match(results[2].observed, /거부됨/u);
    globalThis.fetch = async () => new Response(JSON.stringify([{ id: 'x' }]), { status: 200 });
    const open = await runAttackChecks({ ...config, step: 3 });
    assert.match(open[1].observed, /거부되지 않음/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
