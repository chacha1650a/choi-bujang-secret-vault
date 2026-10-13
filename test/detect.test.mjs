import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect } from '../src/detect.mjs';

const START = Date.UTC(2026, 9, 1, 0, 0, 0);
const reads = (count, { sub = 'learner_fixture', intervalSeconds = 2, method = 'GET', ...extra } = {}) =>
  Array.from({ length: count }, (_, index) => ({
    at: new Date(START + index * intervalSeconds * 1000).toISOString(), method, identity: { sub }, ...extra,
  }));

test('9단계: 10분 안에 121건을 넘게 조회한 가명 사용자 한 명만 회수를 제안한다', () => {
  assert.deepEqual(detect(reads(121)), { action: 'propose_revocation', reasonCode: 'burst_read', subject: 'learner_fixture' });
  assert.deepEqual(detect(reads(120)), { action: 'observe' });
  assert.deepEqual(detect([...reads(100), ...reads(100, { sub: 'other' })]), { action: 'observe' });
  assert.deepEqual(detect(reads(200, { intervalSeconds: 7 })), { action: 'observe' });
});

test('9단계: 조회가 아닌 요청과 형식이 틀린 사건은 세지 않는다', () => {
  assert.deepEqual(detect(reads(200, { method: 'PUT' })), { action: 'observe' });
  assert.deepEqual(detect([...reads(100), null, 'x', { at: 'bad', method: 'GET', identity: { sub: 'learner_fixture' } }]),
    { action: 'observe' });
  assert.throws(() => detect('not events'));
});

test('9단계: 계약에 없는 네트워크 값은 판단에 쓰지 않는다', () => {
  assert.deepEqual(detect(reads(150, { network: 'usual' })), detect(reads(150)));
  assert.deepEqual(detect(reads(100, { network: 'unusual' })), { action: 'observe' });
});

test('9단계: 결과에는 메모 내용·토큰 같은 다른 값이 들어가지 않는다', () => {
  const events = reads(130, { body: '비밀 메모', token: 'secret-token' });
  const out = detect(events);
  assert.deepEqual(Object.keys(out).sort(), ['action', 'reasonCode', 'subject']);
  assert.equal(JSON.stringify(out).includes('비밀'), false);
});
