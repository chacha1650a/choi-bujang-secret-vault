import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentHash, createRestoreApi } from '../src/restore-api.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '33333333-3333-4333-8333-333333333333';
const NOTE_A = '22222222-2222-4222-8222-222222222222';
const NOTE_B = '44444444-4444-4444-8444-444444444444';

// 테이블 이름을 구분하고 insert·update 뒤 select까지 흉내 내는 작은 가짜 Supabase 클라이언트입니다.
function fakeSupabase(tables) {
  return {
    from(name) {
      tables[name] ??= [];
      const rows = tables[name];
      const state = { filters: {}, op: 'select', values: null };
      const run = () => {
        if (state.op === 'insert') {
          rows.push({ ...state.values });
          return { data: { ...state.values }, error: null };
        }
        const hit = rows.filter((row) => Object.entries(state.filters).every(([k, v]) => row[k] === v));
        if (state.op === 'update') hit.forEach((row) => Object.assign(row, state.values));
        return { data: state.single ? (hit[0] ?? null) : hit, error: null };
      };
      const chain = {
        select() { return chain; },
        insert(values) { state.op = 'insert'; state.values = values; return chain; },
        update(values) { state.op = 'update'; state.values = values; return chain; },
        eq(key, value) { state.filters[key] = value; return chain; },
        maybeSingle() { state.single = true; return Promise.resolve(run()); },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      return chain;
    },
  };
}

function call(handler, { method = 'POST', authorization, query } = {}) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    const response = {
      setHeader: (key, value) => { out.headers[key.toLowerCase()] = value; },
      status(code) { out.status = code; return this; },
      json(value) { out.body = value; resolve(out); },
      end() { resolve(out); },
    };
    Promise.resolve(handler({ method, headers: { authorization }, query }, response));
  });
}

const verifyLogin = async (authorization) => ({
  'Bearer a': { kind: 'student', userId: A },
  'Bearer b': { kind: 'judge', userId: B, identity: 'b' },
})[authorization] ?? null;

const snapshot = (id, owner, title, body) => ({ note_id: id, owner_id: owner, title, body,
  content_sha256: contentHash(title, body) });

function setup() {
  const tables = {
    notes: [
      { id: NOTE_A, owner_id: A, title: 'A의 메모', body: 'A 원본' },
      { id: NOTE_B, owner_id: B, title: 'B의 메모', body: 'B 원본' },
    ],
    note_snapshots: [snapshot(NOTE_A, A, 'A의 메모', 'A 원본'), snapshot(NOTE_B, B, 'B의 메모', 'B 원본')],
    audit_log: [{ actor: A, action: 'old_entry', resource: 'note:x', detail: {} }],
  };
  return { tables, api: createRestoreApi({ verifyLogin, supabase: fakeSupabase(tables) }) };
}

test('10단계: B가 변조한 자기 메모를 사본으로 되살리고 ID·소유자·해시를 대조한다', async () => {
  const { tables, api } = setup();
  tables.notes[1].body = '변조됨';
  const out = await call(api.restore, { authorization: 'Bearer b', query: { noteId: NOTE_B } });
  assert.equal(out.status, 200);
  assert.equal(out.body.before, 'modified');
  assert.deepEqual(out.body.matches, { id: true, owner: true, contentSha256: true });
  assert.equal(tables.notes[1].body, 'B 원본');
  assert.equal(tables.notes[0].body, 'A 원본');
  // 기존 감사 기록은 그대로 두고 복원 한 줄만 더한다. 본문은 기록하지 않는다.
  assert.equal(tables.audit_log.length, 2);
  assert.equal(tables.audit_log[0].action, 'old_entry');
  assert.equal(tables.audit_log[1].action, 'restore_note');
  assert.equal(JSON.stringify(tables.audit_log).includes('B 원본'), false);
});

test('10단계: B가 지운 자기 메모를 같은 ID·소유자로 다시 만든다', async () => {
  const { tables, api } = setup();
  tables.notes.splice(1, 1);
  const out = await call(api.restore, { authorization: 'Bearer b', query: { noteId: NOTE_B } });
  assert.equal(out.status, 200);
  assert.equal(out.body.before, 'deleted');
  const back = tables.notes.find((row) => row.id === NOTE_B);
  assert.deepEqual(back, { id: NOTE_B, owner_id: B, title: 'B의 메모', body: 'B 원본' });
  assert.equal(tables.notes.length, 2);
});

test('10단계: 로그인 없음 401, 남의 메모 복원 403, 사본 없음 404, 사본 변조 409', async () => {
  const { tables, api } = setup();
  assert.equal((await call(api.restore, { query: { noteId: NOTE_B } })).status, 401);
  const other = await call(api.restore, { authorization: 'Bearer b', query: { noteId: NOTE_A } });
  assert.equal(other.status, 403);
  assert.equal(other.body.reason, 'not_owner');
  assert.equal(tables.notes[0].body, 'A 원본');
  assert.equal((await call(api.restore, { authorization: 'Bearer b',
    query: { noteId: '55555555-5555-4555-8555-555555555555' } })).status, 404);
  assert.equal((await call(api.restore, { authorization: 'Bearer b', query: { noteId: 'export' } })).status, 404);
  tables.note_snapshots[1].body = '사본 변조';
  tables.notes[1].body = '변조됨';
  const bad = await call(api.restore, { authorization: 'Bearer b', query: { noteId: NOTE_B } });
  assert.equal(bad.status, 409);
  assert.equal(tables.notes[1].body, '변조됨');
  assert.equal((await call(api.restore, { authorization: 'Bearer b', method: 'GET', query: { noteId: NOTE_B } })).status, 405);
});
