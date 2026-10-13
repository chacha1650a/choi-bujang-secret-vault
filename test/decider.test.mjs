import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

const { normal, suspicious } = fixtureRequests();
const variant = (base, changes) => ({ ...base, requestId: randomUUID(), ...changes });
const judge = (changes) => ({ source: 'judge_fixture', region: 'local', network: 'usual', hour: 14, ...changes });

test('6단계: 미등록이거나 값이 없는 기기는 거부한다', async () => {
  for (const deviceRegistered of [false, undefined, 'true', 1]) {
    const out = await decide(variant(normal, { deviceRegistered }));
    assert.equal(out.decision, 'deny');
    assert.equal(out.reasonCode, 'device_not_registered');
  }
});

test('7단계: 정상 접속은 허용하고, 실제 경로(source none)는 정상값으로 채우지 않고 그대로 허용한다', async () => {
  assert.equal((await decide(normal)).decision, 'allow');
  const real = variant(normal, { signals: { source: 'none', region: 'unknown', network: 'unknown', hour: null } });
  assert.equal((await decide(real)).decision, 'allow');
});

test('7단계: 지역 급변·새벽 시각·낯선 네트워크·대량 사건은 각각 추가 확인으로 보낸다', async () => {
  const cases = [
    { signals: judge({ region: 'foreign' }) },
    { signals: judge({ hour: 3 }) },
    { signals: judge({ network: 'unusual' }) },
    { recentEvents: [{ kind: 'note_update', ageSeconds: 30, count: 15 }] },
    suspicious,
  ];
  for (const changes of cases) {
    const out = await decide(variant(normal, changes));
    assert.equal(out.decision, 'step_up');
    assert.equal(out.reasonCode, 'step_up_required');
  }
});

test('7단계: 출처가 불명확하거나 형식이 틀린 접속 정보는 정상으로 승격하지 않는다', async () => {
  const cases = [
    { signals: { source: 'client_header', region: 'local', network: 'usual', hour: 14 } },
    { signals: undefined },
    { signals: judge({ hour: 25 }) },
    { recentEvents: 'none' },
    { recentEvents: [{ kind: 'x', ageSeconds: -1, count: 1 }] },
  ];
  for (const changes of cases) {
    assert.equal((await decide(variant(normal, changes))).decision, 'step_up');
  }
});

test('7단계: 최근에 다시 로그인했을 때만 이상 접속을 허용한다', async () => {
  const fresh = await decide(variant(suspicious, { stepUp: { verified: true, authAgeSeconds: 60 } }));
  assert.equal(fresh.decision, 'allow');
  for (const stepUp of [
    { verified: false, authAgeSeconds: null },
    { verified: true, authAgeSeconds: 900 },
    { verified: true, authAgeSeconds: null },
    undefined,
  ]) {
    assert.equal((await decide(variant(suspicious, { stepUp }))).decision, 'step_up');
  }
  // 미등록 기기는 다시 로그인해도 거부한다.
  const unregistered = await decide(variant(suspicious, {
    deviceRegistered: false, stepUp: { verified: true, authAgeSeconds: 10 } }));
  assert.equal(unregistered.decision, 'deny');
});
