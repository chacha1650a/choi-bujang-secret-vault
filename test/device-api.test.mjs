import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createDeviceApi, createDeviceCheck, deviceIdFrom } from '../src/device-api.mjs';
import { createNotesApi } from '../src/notes-api.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const NOTE = '22222222-2222-4222-8222-222222222222';
const DEVICE = '0123456789abcdef';
const hash = (id) => createHash('sha256').update(id, 'utf8').digest('hex');

function fakeSupabase(tables) {
  return {
    from(name) {
      tables[name] ??= [];
      const rows = tables[name];
      const state = { filters: {}, op: 'select', values: null };
      const run = () => {
        if (state.op === 'insert') { rows.push({ ...state.values }); return { data: null, error: null }; }
        const hit = rows.filter((row) => Object.entries(state.filters).every(([k, v]) => row[k] === v));
        return { data: state.single ? (hit[0] ?? null) : hit, error: null };
      };
      const chain = {
        select() { return chain; },
        insert(values) { state.op = 'insert'; state.values = values; return chain; },
        eq(key, value) { state.filters[key] = value; return chain; },
        order() { return Promise.resolve(run()); },
        maybeSingle() { state.single = true; return Promise.resolve(run()); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return chain;
    },
  };
}

function call(handler, { method = 'GET', authorization, cookie, query } = {}) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    const response = {
      setHeader: (key, value) => { out.headers[key.toLowerCase()] = value; },
      status(code) { out.status = code; return this; },
      json(value) { out.body = value; resolve(out); },
      end() { resolve(out); },
    };
    Promise.resolve(handler({ method, headers: { authorization, cookie, 'user-agent': 'test' }, query }, response));
  });
}

const verifyLogin = async (authorization) => ({
  'Bearer a': { kind: 'student', userId: A },
  'Bearer judge': { kind: 'judge', userId: A, identity: 'a' },
})[authorization] ?? null;

function setup(status) {
  const tables = {
    device_registrations: status ? [{ device_hash: hash(DEVICE), user_id: A, status }] : [],
    notes: [{ id: NOTE, owner_id: A, title: 'A의 메모', body: 'A만 봅니다', created_at: 1 }],
  };
  const supabase = fakeSupabase(tables);
  return { tables, device: createDeviceApi({ verifyLogin, supabase }),
    notes: createNotesApi({ verifyLogin, supabase, deviceCheck: createDeviceCheck(supabase) }) };
}
const cookie = `theme=dark; aleph_device=${DEVICE}`;

test('11단계: 기기 상태는 서버 명단으로만 정하고 자료를 넣지 않는다', async () => {
  assert.deepEqual((await call(setup().device.status, {})).body, { approved: false, reason: 'login_required' });
  assert.equal((await call(setup().device.status, {})).status, 200);
  assert.equal((await call(setup().device.status, { authorization: 'Bearer a' })).body.reason, 'device_not_registered');
  assert.equal((await call(setup('pending').device.status, { authorization: 'Bearer a', cookie })).body.reason, 'approval_pending');
  assert.equal((await call(setup('revoked').device.status, { authorization: 'Bearer a', cookie })).body.approved, false);
  const ok = await call(setup('approved').device.status, { authorization: 'Bearer a', cookie });
  assert.deepEqual(ok.body, { approved: true, reason: 'device_approved' });
  assert.equal(JSON.stringify(ok.body).includes('A만'), false);
  // 심판 시험 신원·다른 기기 ID는 승인된 기기가 아니다.
  assert.equal((await call(setup('approved').device.status, { authorization: 'Bearer judge', cookie })).body.approved, false);
  assert.equal((await call(setup('approved').device.status, { authorization: 'Bearer a',
    cookie: 'aleph_device=ffffffffffffffff' })).body.approved, false);
});

test('11단계: 승인 요청은 대기 상태만 만들고, 기기 ID는 HttpOnly 쿠키로만 준다', async () => {
  const { tables, device } = setup();
  assert.equal((await call(device.request, { method: 'POST' })).status, 401);
  const out = await call(device.request, { method: 'POST', authorization: 'Bearer a' });
  assert.equal(out.status, 201);
  assert.deepEqual([out.body.approved, out.body.status], [false, 'pending']);
  const setCookie = out.headers['set-cookie'];
  assert.match(setCookie, /^aleph_device=[0-9a-f]{16}; Path=\/api; HttpOnly; Secure; SameSite=Strict/u);
  const issued = setCookie.split(';')[0].split('=')[1];
  assert.equal(JSON.stringify(out.body).includes(issued), false);
  assert.equal(tables.device_registrations.length, 1);
  assert.equal(tables.device_registrations[0].device_hash, hash(issued));
  assert.equal(tables.device_registrations[0].status, 'pending');
  assert.equal((await call(device.request, { method: 'POST', authorization: 'Bearer judge' })).status, 403);
});

test('11단계: 승인 전에는 로그인해도 메모 API가 자료를 주지 않는다', async () => {
  for (const status of [undefined, 'pending', 'revoked']) {
    const { notes } = setup(status);
    const list = await call(notes.mine, { authorization: 'Bearer a', cookie });
    assert.equal(list.status, 403);
    assert.equal(list.body.error, 'DEVICE_NOT_APPROVED');
    assert.equal(JSON.stringify(list.body).includes('A만'), false);
    assert.equal((await call(notes.item, { authorization: 'Bearer a', cookie, query: { id: NOTE } })).status, 403);
  }
  const { notes } = setup('approved');
  const list = await call(notes.mine, { authorization: 'Bearer a', cookie });
  assert.equal(list.status, 200);
  assert.equal(list.body[0].title, 'A의 메모');
  assert.equal((await call(notes.mine, { authorization: 'Bearer a' })).status, 403);
  assert.equal((await call(notes.mine, { cookie })).status, 401);
});

test('11단계: 쿠키의 기기 ID는 형식이 맞을 때만 읽는다', () => {
  assert.equal(deviceIdFrom({ headers: { cookie } }), DEVICE);
  assert.equal(deviceIdFrom({ headers: { cookie: 'aleph_device=../../etc' } }), null);
  assert.equal(deviceIdFrom({ headers: {} }), null);
});

test('11단계: 설치형 웹앱 설정과 화면은 토큰·기기 키를 브라우저 저장소에 넣지 않는다', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.name && manifest.start_url && manifest.icons.length);
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="manifest"/u);
  assert.match(html, /persistSession: false/u);
  assert.doesNotMatch(html.replace(/\/\/.*$/gmu, ''), /localStorage|sessionStorage|indexedDB/u);
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sw.replace(/\/\/.*$/gmu, ''), /\/api/u);
});
