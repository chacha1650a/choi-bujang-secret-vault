import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { createAuthApi } from '../src/auth-api.mjs';

const root = new URL('..', import.meta.url);
const KEY = 'sb_publishable_test_key_for_unit_tests';

function call(handler, { method = 'POST', body, headers = {} } = {}) {
  return new Promise((resolve) => {
    const out = { headers: {} };
    handler({ method, body, headers }, {
      setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
      status(code) { out.status = code; return this; },
      json(value) { out.body = value; resolve(out); },
    });
  });
}

function setup(reply) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url: String(url), init });
    const r = typeof reply === 'function' ? reply(String(url), init) : reply;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  };
  return { seen, api: createAuthApi({ authUrl: 'https://project.supabase.example/auth/v1/', publishableKey: KEY, fetchImpl }) };
}

const goodSession = { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 2000000000, user: { id: 'u', email: 'a@b.example', role: 'authenticated', app_metadata: { x: 1 } } };

test('5단계 가점: 로그인은 서버가 대신 보내고 화면에는 토큰·만료·이메일만 돌려준다', async () => {
  const { api, seen } = setup({ body: goodSession });
  const out = await call(api.login, { body: { email: 'a@b.example', password: 'secret123' } });
  assert.equal(out.status, 200);
  assert.deepEqual(out.body, { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 2000000000, email: 'a@b.example' });
  assert.equal(out.headers['cache-control'], 'no-store');
  assert.equal(seen[0].url, 'https://project.supabase.example/auth/v1/token?grant_type=password');
  assert.equal(seen[0].init.headers.apikey, KEY);
  assert.deepEqual(JSON.parse(seen[0].init.body), { email: 'a@b.example', password: 'secret123' });
  assert.equal(JSON.stringify(out.body).includes('app_metadata'), false);
});

test('5단계 가점: 틀린 로그인·잘못된 입력·GET·연결 실패는 원문 오류 없이 거절한다', async () => {
  const bad = setup({ status: 400, body: { error_description: 'Invalid login credentials', msg: 'internal detail' } });
  const wrong = await call(bad.api.login, { body: { email: 'a@b.example', password: 'wrong-pass' } });
  assert.equal(wrong.status, 401);
  assert.equal(JSON.stringify(wrong.body).includes('internal'), false);
  const { api, seen } = setup({ body: goodSession });
  assert.equal((await call(api.login, { body: { email: 'not-an-email', password: 'secret123' } })).status, 400);
  assert.equal((await call(api.login, { body: { email: 'a@b.example', password: '123' } })).status, 400);
  assert.equal((await call(api.login, { body: { email: 'a@b.example', password: 'x'.repeat(201) } })).status, 400);
  assert.equal((await call(api.login, { body: null })).status, 400);
  const get = await call(api.login, { method: 'GET' });
  assert.equal(get.status, 405);
  assert.equal(get.headers.allow, 'POST');
  assert.equal(seen.length, 0);
  const down = createAuthApi({ authUrl: 'https://x.example/auth/v1', fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await call(down.login, { body: { email: 'a@b.example', password: 'secret123' } })).status, 502);
});

test('5단계 가점: 가입·갱신·로그아웃도 서버를 거친다', async () => {
  const { api, seen } = setup((url) => (url.endsWith('/signup') ? { body: { user: { email: 'n@b.example' } } } : { body: goodSession }));
  const signup = await call(api.signup, { body: { email: 'n@b.example', password: 'secret123' } });
  assert.deepEqual(signup.body, { confirmationRequired: true });
  const refresh = await call(api.refresh, { body: { refreshToken: 'refresh-1' } });
  assert.equal(refresh.body.accessToken, 'access-1');
  assert.equal(seen[1].url.endsWith('/token?grant_type=refresh_token'), true);
  assert.equal((await call(api.refresh, { body: { refreshToken: '' } })).status, 400);
  const logout = await call(api.logout, { headers: { authorization: 'Bearer access-1' } });
  assert.equal(logout.status, 200);
  assert.equal(seen.at(-1).url.endsWith('/logout'), true);
  assert.equal(seen.at(-1).init.headers.authorization, 'Bearer access-1');
});

test('5단계 가점: 화면 코드(public/)에는 Supabase 주소·공개 키·클라이언트가 없고 CSP도 외부 사이트를 허용하지 않는다', async () => {
  const dir = new URL('public/', root);
  const names = (await readdir(dir)).filter((n) => /\.(js|mjs|html|json|webmanifest|svg)$/u.test(n));
  assert.ok(names.includes('app.js'));
  for (const name of names) {
    const text = await readFile(join(dir.pathname.replace(/^\/([A-Za-z]:)/u, '$1'), name), 'utf8');
    assert.doesNotMatch(text, /sb_publishable|sb_secret|supabase\.co|supabase-js|createClient|jsdelivr/iu, name);
  }
  const vercel = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
  const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /script-src 'self'; connect-src 'self';/u);
});
