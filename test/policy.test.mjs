import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { RULE_IDS } from '../src/decider.mjs';
import { currentPolicy, diffPolicy, policyHash, restoreRoutes, verifySnapshot } from '../scripts/policy.mjs';

const snapshot = JSON.parse(await readFile(new URL('../policy/verified-policy.json', import.meta.url), 'utf8'));
const config = JSON.parse(await readFile(new URL('../aleph.config.json', import.meta.url), 'utf8'));

test('10단계: 검증한 정책 사본은 해시가 맞고 지금 시험 정책과 같다', () => {
  verifySnapshot(snapshot);
  assert.equal(diffPolicy(snapshot, currentPolicy(config, RULE_IDS, snapshot.policyRevision)).clean, true);
});

test('10단계: 사본이 없거나 고쳐졌으면 중단한다', () => {
  assert.throws(() => verifySnapshot(null));
  assert.throws(() => verifySnapshot({ ...snapshot, routes: snapshot.routes.slice(1) }), /해시/u);
  const forged = { ...snapshot, rules: [] };
  assert.throws(() => verifySnapshot({ ...forged, sha256: snapshot.sha256 }), /해시/u);
  assert.doesNotThrow(() => verifySnapshot({ ...forged, sha256: policyHash(forged) }));
});

test('10단계: 침해로 바뀐 경로만 차이로 보이고, 되돌리면 다른 서비스 경로는 남는다', () => {
  const attacked = { ...config, allowedRoutes: [
    ...config.allowedRoutes.filter((r) => r.pathPattern !== '/api/my/notes'),
    { service: 'notes', method: 'GET', pathPattern: '/api/notes', zone: 'my-notes' },
    { service: 'ai', method: 'POST', pathPattern: '/api/ai', zone: 'ai' },
  ] };
  const diff = diffPolicy(snapshot, currentPolicy(attacked, RULE_IDS, 1));
  assert.equal(diff.clean, false);
  assert.deepEqual(diff.routes.map((r) => `${r.change} ${r.method} ${r.pathPattern}`).sort(),
    ['add GET /api/my/notes', 'remove GET /api/notes']);
  const restored = restoreRoutes(attacked, snapshot);
  assert.equal(diffPolicy(snapshot, currentPolicy(restored, RULE_IDS, 1)).clean, true);
  assert.ok(restored.allowedRoutes.some((r) => r.pathPattern === '/api/ai'));
});

test('10단계: 규칙 이름이 빠지면 차이로 보인다', () => {
  const diff = diffPolicy(snapshot, currentPolicy(config, RULE_IDS.filter((id) => id !== 'resource_zone'), 1));
  assert.deepEqual(diff.rules.missing, ['resource_zone']);
});
