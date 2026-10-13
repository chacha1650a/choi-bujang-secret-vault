import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { decide as studentDecide } from '../src/decider.mjs';
import { activeRule, buildDenyRules, isBlockableIp, withXdrGate } from '../src/xdr-gate.mjs';
import { MODULE_KEYS, syncModule } from '../scripts/xdr-sync.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = async (path) => import(pathToFileURL(join(root, path)).href);
const json = async (path) => JSON.parse(await readFile(join(root, path), 'utf8'));
// 시험 묶음의 Wazuh 수준으로 나눈 기대값입니다(10 이상 명확한 공격, 5~9 애매한 시도, 그 아래 정상).
const expected = (alert) => (alert.rule.level >= 10 ? 'block' : alert.rule.level >= 5 ? 'alert' : 'record');

test('XDR: decide.mjs 는 import·파일·네트워크 없이 혼자 계산하고, 패턴 상수는 patterns.json 과 같다', async () => {
  for (const key of MODULE_KEYS) {
    const source = await readFile(join(root, 'xdr', key, 'decide.mjs'), 'utf8');
    assert.doesNotMatch(source, /^\s*import\b|\bimport\s*\(|\brequire\s*\(|\bfetch\s*\(|\bprocess\.|node:/mu, key);
    assert.equal(await syncModule(key, { check: true }), true, `${key}: npm run xdr:sync 필요`);
    const spec = await json(`xdr/${key}/patterns.json`);
    const mod = await load(`xdr/${key}/decide.mjs`);
    assert.deepEqual(JSON.parse(JSON.stringify(mod.PATTERNS)), spec.patterns, key);
    for (const pattern of spec.patterns) {
      for (const field of ['name', 'condition', 'evidence']) assert.ok(pattern[field].trim().length > 3, `${key} ${pattern.id} ${field}`);
      assert.match(pattern.evidence, /MITRE ATT&CK T\d{4}|CVE-\d{4}-\d+|Wazuh/u, `${key} ${pattern.id} 근거`);
    }
  }
});

test('XDR: 시험 경보에서 명확한 공격은 block, 애매한 시도는 alert, 정상 이벤트는 record 이고 확신도와 행동이 맞는다', async () => {
  for (const key of MODULE_KEYS) {
    const { decide } = await load(`xdr/${key}/decide.mjs`);
    const fixture = await json(`xdr/fixtures/${key}.json`);
    for (const alert of fixture.alerts) {
      const started = Date.now();
      const out = decide(alert);
      assert.ok(Date.now() - started < 2000);
      assert.deepEqual(Object.keys(out).sort(), ['action', 'confidence', 'reason']);
      assert.equal(out.action, expected(alert), `${key} ${alert.id} ${out.reason}`);
      assert.ok(out.confidence >= 0 && out.confidence <= 1);
      assert.equal(out.action, out.confidence >= 0.85 ? 'block' : out.confidence >= 0.5 ? 'alert' : 'record', `${key} ${alert.id}`);
      assert.ok(out.reason.length > 0 && !out.reason.includes('\n'));
    }
    // 형식이 틀린 경보도 오류 없이 기록만 합니다.
    for (const bad of [null, {}, { rule: { level: 'x' } }, { data: { count: 'many' } }]) assert.equal(decide(bad).action, 'record');
  }
});

test('XDR: 경보 읽기 모듈은 다섯 값만 뽑고 건수가 같으며 비밀값처럼 보이는 값은 가린다', async () => {
  for (const key of MODULE_KEYS) {
    const mod = await load(`xdr/${key}/read-alerts.mjs`);
    const { total, rows } = await mod.readAlerts();
    assert.equal(rows.length, total, key);
    assert.ok(rows.every((row) => Object.keys(row).sort().join(',') === 'description,level,srcip,time,user'));
    // 저장소 비밀값 검사에 걸리지 않게 가짜 값은 실행할 때 이어 붙입니다.
    const fake = ['token=abcd1234', `${'Bear'}er ${'q'.repeat(20)}`, ['a', 'b.example'].join('@'), '정상'].join(' ');
    assert.equal(mod.maskSecrets(fake), '[가림] [가림] [가림] 정상');
  }
});

test('XDR: 차단 후보만 만료 시각·근거 경보가 붙은 주소 거부 규칙이 되고 정상 이벤트 주소는 막지 않는다', async () => {
  const now = new Date('2026-10-13T00:00:00Z');
  for (const key of MODULE_KEYS) {
    const { respond } = await load(`xdr/${key}/respond.mjs`);
    const { items, rules, lines } = await respond({ now, write: false });
    const ruled = new Set(rules.map((rule) => rule.sourceIp));
    for (const item of items) {
      if (item.decision.action === 'record') assert.equal(ruled.has(item.srcip), false, `${key} ${item.alertId} 정상 주소`);
      if (item.decision.action === 'block') assert.equal(ruled.has(item.srcip), true, `${key} ${item.alertId} 차단 누락`);
    }
    for (const rule of rules) {
      assert.equal(rule.action, 'deny');
      assert.ok(Date.parse(rule.expiresAt) > Date.parse(rule.createdAt));
      assert.ok(rule.evidenceAlertIds.length > 0);
      assert.ok(rule.evidenceAlertIds.every((id) => items.find((item) => item.alertId === id)?.decision.action === 'block'));
    }
    assert.equal(lines.length, items.filter((item) => item.decision.action !== 'record').length);
  }
  assert.equal(isBlockableIp('10.0.0.1'), false);
  assert.equal(isBlockableIp('203.0.113.10'), true);
});

test('XDR: 판정기 앞 확인 단계는 막힌 주소만 거부하고 정상 요청과 만료된 규칙은 원래 판정기로 넘긴다', async () => {
  const now = new Date('2026-10-13T00:00:00Z');
  const rules = buildDenyRules('brute-force', [
    { alertId: 'bf-01', srcip: '203.0.113.10', decision: { action: 'block', confidence: 0.92, reason: 'x' } },
    { alertId: 'bf-20', srcip: '192.0.2.60', decision: { action: 'record', confidence: 0.1, reason: 'y' } },
  ], { now, ttlMinutes: 60 });
  assert.deepEqual(rules.map((rule) => rule.sourceIp), ['203.0.113.10']);
  const gated = withXdrGate(studentDecide, rules);
  const request = {
    schema: 'aleph.decision.v1', requestId: '00000000-0000-4000-8000-000000000009', classId: 'c', projectId: 'p',
    subjectId: 'learner', deviceId: 'a'.repeat(16), service: 'notes', method: 'GET', path: '/api/notes/demo',
    route: 'GET /api/notes/:id', queryLength: 0, querySha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    at: '2026-10-13T00:10:00.000Z', policyRevision: 1, deviceRegistered: true, stepUp: { verified: false, authAgeSeconds: null },
    recentEvents: [], signals: { source: 'none', region: 'unknown', network: 'unknown', hour: null },
  };
  const blocked = await gated(request, { sourceIp: '203.0.113.10' });
  assert.equal(blocked.decision, 'deny');
  assert.deepEqual(blocked.ruleIds, ['xdr_block']);
  assert.equal(blocked.requestId, request.requestId);
  const normal = await gated(request, { sourceIp: '192.0.2.60' });
  assert.deepEqual(normal, await studentDecide(request));
  assert.equal(activeRule(rules, '203.0.113.10', '2026-10-13T02:00:00Z'), null);
});
