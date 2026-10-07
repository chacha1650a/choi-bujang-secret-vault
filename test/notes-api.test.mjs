import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNotesApi } from '../src/notes-api.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const NOTE = '22222222-2222-4222-8222-222222222222';

// 아주 작은 가짜 Supabase 클라이언트: 메모를 배열에 저장합니다.
function fakeSupabase(rows) {
  return {
    from() {
      const state = { filters: {}, op: 'select', values: null };
      const run = () => {
        let hit = rows.filter((row) => Object.entries(state.filters).every(([k, v]) => row[k] === v));
        if (state.op === 'insert') {
          if (rows.some((row) => row.id === state.values.id)) return { data: null, error: { code: '23505' } };
          rows.push({ ...state.values });
          return { data: null, error: null };
        }
        if (state.op === 'update') hit.forEach((row) => Object.assign(row, state.values));
        if (state.op === 'delete') hit.forEach((row) => rows.splice(rows.indexOf(row), 1));
        return { data: state.single ? (hit[0] ?? null) : hit, error: null };
      };
      const chain = {
        select() { return chain; },
        insert(values) { state.op = 'insert'; state.values = values; return Promise.resolve(run()); },
        update(values) { state.op = 'update'; state.values = values; return chain; },
        delete() { state.op = 'delete'; return chain; },
        eq(key, value) { state.filters[key] = value; return chain; },
        order() { return Promise.resolve(run()); },
        maybeSingle() { state.single = true; return Promise.resolve(run()); },
      };
      return chain;
    },
  };
}

function call(handler, { method = 'GET', authorization, body, query } = {}) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    const response = {
      setHeader: (key, value) => { out.headers[key.toLowerCase()] = value; },
      status(code) { out.status = code; return this; },
      json(value) { out.body = value; resolve(out); },
      end() { resolve(out); },
    };
    Promise.resolve(handler({ method, headers: { authorization }, body, query }, response));
  });
}

const verifyLogin = async (authorization) => (authorization === 'Bearer good'
  ? { kind: 'student', userId: A } : null);

test('로그인 토큰이 없거나 틀리면 JSON 오류와 401을 돌려준다', async () => {
  const api = createNotesApi({ verifyLogin, supabase: fakeSupabase([]) });
  for (const authorization of [undefined, 'Bearer aaaa.bbbb.cccc', 'Basic x']) {
    const out = await call(api.collection, { authorization });
    assert.equal(out.status, 401);
    assert.equal(out.body.error, 'UNAUTHENTICATED');
    assert.equal(out.headers['cache-control'], 'no-store');
  }
  assert.equal((await call(api.item, { authorization: undefined, query: { id: NOTE } })).status, 401);
});

test('로그인한 사용자는 메모를 추가·조회·수정·삭제하고 지운 뒤에는 404를 받는다', async () => {
  const rows = [{ id: 'other', owner_id: 'someone-else', title: '남의 것', body: 'x', created_at: 1 }];
  const api = createNotesApi({ verifyLogin, supabase: fakeSupabase(rows) });
  const headers = { authorization: 'Bearer good' };

  const created = await call(api.collection, { ...headers, method: 'POST', body: { id: NOTE, title: '제목', body: '내용' } });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { id: NOTE });
  assert.equal(rows.find((row) => row.id === NOTE).owner_id, A);

  const generated = await call(api.collection, { ...headers, method: 'POST', body: { title: 't', body: 'b' } });
  assert.match(generated.body.id, /^[0-9a-f-]{36}$/u);

  const list = await call(api.collection, headers);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((note) => note.id).sort(), [NOTE, generated.body.id].sort());
  assert.deepEqual(Object.keys(list.body[0]).sort(), ['body', 'id', 'title']);

  const one = await call(api.item, { ...headers, query: { id: NOTE } });
  assert.deepEqual(one.body, { id: NOTE, title: '제목', body: '내용' });

  const changed = await call(api.item, { ...headers, method: 'PUT', query: { id: NOTE }, body: { title: '새 제목' } });
  assert.deepEqual(changed.body, { id: NOTE, title: '새 제목', body: '내용' });

  assert.equal((await call(api.item, { ...headers, method: 'DELETE', query: { id: NOTE } })).status, 204);
  assert.equal((await call(api.item, { ...headers, query: { id: NOTE } })).status, 404);
});

test('잘못된 입력은 400, 같은 id 중복은 409, 알 수 없는 메서드는 405', async () => {
  const api = createNotesApi({ verifyLogin, supabase: fakeSupabase([]) });
  const headers = { authorization: 'Bearer good' };
  assert.equal((await call(api.collection, { ...headers, method: 'POST', body: { title: '', body: 'x' } })).status, 400);
  assert.equal((await call(api.collection, { ...headers, method: 'POST', body: { id: 'not-a-uuid', title: 't', body: 'b' } })).status, 400);
  assert.equal((await call(api.collection, { ...headers, method: 'POST', body: 'not json' })).status, 400);
  assert.equal((await call(api.item, { ...headers, method: 'PUT', query: { id: NOTE }, body: {} })).status, 400);
  await call(api.collection, { ...headers, method: 'POST', body: { id: NOTE, title: 't', body: 'b' } });
  assert.equal((await call(api.collection, { ...headers, method: 'POST', body: { id: NOTE, title: 't', body: 'b' } })).status, 409);
  assert.equal((await call(api.collection, { ...headers, method: 'PATCH' })).status, 405);
  assert.equal((await call(api.item, { ...headers, query: { id: 'zzz' } })).status, 404);
});
