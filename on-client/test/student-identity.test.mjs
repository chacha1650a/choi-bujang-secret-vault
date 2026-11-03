import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStudentView } from '../student/extension.mjs';

// Minimal DOM contract test, not a replacement for the real browser check.
class TestElement {
  constructor(tag) { this.tagName = tag; this.children = []; this.ownText = ''; }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.ownText = ''; this.children = [...children]; }
}
globalThis.document = { createElement: tag => new TestElement(tag) };

const resource = (data, mode = 'connected') => ({ status: 'ok', mode, data });
const identity = (name = '가상 사용자 A', device = 'compliant', session = 'active') => ({
  me: resource({ user: { id: 'synthetic-user', label: name },
    device: { id: 'synthetic-device', label: '가상 기기', status: device },
    session: { id: 'synthetic-session', status: session } }),
  devices: resource([{ id: 'synthetic-device', label: '가상 기기', status: device }]),
  sessions: resource([{ id: 'synthetic-session', status: session }]),
});
const render = input => createStudentView().renderIdentity(input);

test('renders the passed user, device and session labels and IDs', () => {
  const output = render(identity());
  assert.ok(output instanceof TestElement);
  for (const expected of ['가상 사용자 A', 'synthetic-user', '가상 기기', 'synthetic-device',
    'synthetic-session', '보안 기준 충족', '활성']) assert.ok(output.textContent.includes(expected));
});

for (const [device, session, expected] of [
  ['noncompliant', 'expired', ['보안 기준 미충족', '만료']],
  ['unknown', 'revoked', ['확인 불가', '철회됨']],
  ['constructor', '__proto__', ['확인 불가']],
]) test(`distinguishes device ${device} and session ${session}`, () => {
  const output = render(identity('가상 사용자', device, session));
  for (const text of expected) assert.ok(output.textContent.includes(text));
  assert.ok(!output.textContent.includes('보안 기준 충족'));
  assert.ok(!output.textContent.includes('활성'));
});

for (const mode of ['demo', 'disconnected', 'unknown']) {
  for (const status of ['loading', 'error', 'ok']) test(`${mode} remains visible during ${status}`, () => {
    const input = identity();
    for (const name of ['me', 'devices', 'sessions']) {
      input[name] = { ...input[name], status, mode, error: { message: '가상 연결 오류' } };
    }
    const text = render(input).textContent;
    const expected = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' }[mode];
    assert.equal(text.split(expected).length - 1, 3);
    if (status !== 'ok') assert.ok(!text.includes('가상 사용자 A'));
    if (status === 'error') assert.ok(text.includes('연결 실패: 가상 연결 오류'));
    if (status === 'loading') assert.ok(text.includes('불러오는 중'));
  });
}

test('each resource has its own loading/error/ok branch', () => {
  const input = identity();
  input.devices = { status: 'error', mode: 'disconnected', error: { message: '기기 연결 실패' }, data: [{ label: '이전 기기' }] };
  input.sessions = { status: 'loading', mode: 'unknown', data: [{ id: 'previous-session' }] };
  const text = render(input).textContent;
  assert.ok(text.includes('가상 사용자 A'));
  assert.ok(text.includes('기기 연결 실패') && text.includes('불러오는 중'));
  assert.ok(!text.includes('이전 기기') && !text.includes('previous-session'));
});

test('replacement on reload drops old identity even when error input carries stale data', () => {
  const host = new TestElement('div');
  const view = createStudentView();
  const first = view.renderIdentity(identity());host.replaceChildren(first);
  const second = view.renderIdentity(identity('가상 사용자 B'));host.replaceChildren(second);
  assert.notEqual(first, second);
  assert.ok(host.textContent.includes('가상 사용자 B') && !host.textContent.includes('가상 사용자 A'));
  const failed = identity('stale-user');
  for (const name of ['me', 'devices', 'sessions']) failed[name] = {
    ...failed[name], status: 'error', mode: 'disconnected', error: { message: '가상 서버 중단' },
  };
  host.replaceChildren(view.renderIdentity(failed));
  assert.ok(host.textContent.includes('연결 실패: 가상 서버 중단'));
  assert.ok(!host.textContent.includes('stale-user') && !host.textContent.includes('synthetic-session'));
});

test('untrusted labels and server messages remain literal text', () => {
  const marker = '<img src=x onerror=alert(1)>';
  assert.ok(render(identity(marker)).textContent.includes(marker));
  const output = render({ me: { status: 'error', mode: 'unknown', error: { message: marker } } });
  assert.ok(output.textContent.includes(marker));
  const tags = node => [node.tagName, ...node.children.flatMap(tags)];
  assert.ok(!tags(output).includes('img'));
});

test('missing resources, malformed lists and empty lists do not claim a healthy state', () => {
  assert.ok(render().textContent.includes('확인 불가'));
  const malformed = render({ devices: resource({}), sessions: resource({}) }).textContent;
  assert.ok(malformed.includes('기기 목록 확인 불가') && malformed.includes('세션 목록 확인 불가'));
  const empty = render({ devices: resource([]), sessions: resource([]) }).textContent;
  assert.ok(empty.includes('표시할 기기가 없습니다.') && empty.includes('표시할 세션이 없습니다.'));
});
