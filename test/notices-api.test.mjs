import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNoticesApi, createNotesApi } from '../src/notes-api.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '33333333-3333-4333-8333-333333333333';
const T = '55555555-5555-4555-8555-555555555555';
const NOTICE = '66666666-6666-4666-8666-666666666666';
const NOTE = '22222222-2222-4222-8222-222222222222';

// 테이블 이름을 구분하는 아주 작은 가짜 Supabase 클라이언트입니다.
function fakeSupabase(tables) {
  return {
    from(name) {
      const rows = tables[name] ?? [];
      const state = { filters: {}, op: 'select', values: null };
      const run = () => {
        const hit = rows.filter((row) => Object.entries(state.filters).every(([k, v]) => row[k] === v));
        if (state.op === 'update') hit.forEach((row) => Object.assign(row, state.values));
        return { data: state.single ? (hit[0] ?? null) : hit, error: null };
      };
      const chain = {
        select() { return chain; },
        update(values) { state.op = 'update'; state.values = values; return chain; },
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

const verifyLogin = async (authorization) => ({
  'Bearer a': { kind: 'student', userId: A },
  'Bearer b': { kind: 'student', userId: B },
  'Bearer teacher': { kind: 'student', userId: T },
  'Bearer judge': { kind: 'judge', userId: T, identity: 'a' },
})[authorization] ?? null;

const setup = () => {
  const tables = {
    notices: [{ id: NOTICE, title: '공지', body: '가상 공지', created_at: 1 }],
    instructors: [{ user_id: T }],
    notes: [{ id: NOTE, owner_id: A, title: 'A의 메모', body: 'A만 봅니다', created_at: 1 }],
  };
  const supabase = fakeSupabase(tables);
  return { tables, notices: createNoticesApi({ verifyLogin, supabase }),
    notes: createNotesApi({ verifyLogin, supabase }) };
};

test('8단계: 공지 구역은 강사 명단 계정만 읽고, 메모와 다른 자원 ID를 갖는다', async () => {
  const { notices, notes } = setup();
  assert.equal((await call(notices.collection, {})).status, 401);
  for (const authorization of ['Bearer a', 'Bearer b', 'Bearer judge']) {
    const list = await call(notices.collection, { authorization });
    assert.equal(list.status, 403);
    assert.equal(list.body.reason, 'instructor_only');
    assert.equal(JSON.stringify(list.body).includes('가상 공지'), false);
    const one = await call(notices.item, { authorization, query: { id: NOTICE } });
    assert.equal(one.status, 403);
    assert.equal(JSON.stringify(one.body).includes('가상 공지'), false);
  }
  const list = await call(notices.collection, { authorization: 'Bearer teacher' });
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.headers['x-resource-id'], 'notices:class');
  const one = await call(notices.item, { authorization: 'Bearer teacher', query: { id: NOTICE } });
  assert.equal(one.status, 200);
  assert.equal(one.headers['x-resource-id'], `notice:${NOTICE}`);
  const mine = await call(notes.item, { authorization: 'Bearer a', query: { id: NOTE } });
  assert.equal(mine.headers['x-resource-id'], `note:${NOTE}`);
  assert.equal((await call(notices.item, { authorization: 'Bearer a', method: 'DELETE', query: { id: NOTICE } })).status, 405);
});

test('8단계: 학생 시험 계정과 심판 신원은 본문에 role을 넣어도 공지를 고칠 수 없다', async () => {
  const { tables, notices } = setup();
  for (const authorization of ['Bearer a', 'Bearer b', 'Bearer judge']) {
    const out = await call(notices.item, { authorization, method: 'PUT', query: { id: NOTICE },
      body: { title: '탈취', role: 'instructor', isInstructor: true } });
    assert.equal(out.status, 403);
    assert.equal(out.body.reason, 'instructor_only');
  }
  assert.equal(tables.notices[0].title, '공지');
});

test('8단계: DB 강사 명단에 있는 계정만 공지를 고친다', async () => {
  const { tables, notices } = setup();
  const out = await call(notices.item, { authorization: 'Bearer teacher', method: 'PUT',
    query: { id: NOTICE }, body: { title: '새 공지' } });
  assert.equal(out.status, 200);
  assert.equal(tables.notices[0].title, '새 공지');
  assert.equal(tables.notices[0].updated_by, T);
});

test('8단계: 다른 구역 메모는 API에서 거부 사유와 함께 막힌다', async () => {
  const { notes } = setup();
  const out = await call(notes.item, { authorization: 'Bearer b', query: { id: NOTE } });
  assert.equal(out.status, 403);
  assert.equal(out.body.reason, 'not_owner');
  assert.equal(JSON.stringify(out.body).includes('A만 봅니다'), false);
});
