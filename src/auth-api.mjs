// 5단계 가점: 로그인을 서버 함수로 옮겨, 브라우저 화면 코드(public/)에 Supabase 공개 키가 하나도 없게 합니다.
// 화면은 이 서버 함수에 이메일·비밀번호를 보내고, 서버가 Supabase 로그인 주소에 대신 보냅니다.
// 서버는 비밀번호를 저장하거나 기록하지 않고, 응답에는 로그인 토큰·만료 시각·이메일만 담습니다(Supabase 원문 오류는 돌려주지 않음).
// 이 키는 원래 브라우저에 넣어도 되는 공개용(sb_publishable)입니다. 서버에서도 환경변수 SUPABASE_PUBLISHABLE_KEY가 있으면 그 값을 먼저 씁니다.
export const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_0ob3zQmenT9MOOcxmrpaHw_ri91--ge';

const MAX_EMAIL = 254;
const MAX_PASSWORD = 200;
const MAX_TOKEN = 4096;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function createAuthApi({ authUrl, publishableKey = DEFAULT_PUBLISHABLE_KEY, fetchImpl = globalThis.fetch }) {
  const base = String(authUrl).replace(/\/+$/u, '');
  const send = (response, status, body) => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(body);
  };

  async function call(path, { token, body } = {}) {
    const reply = await fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: publishableKey, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await reply.json().catch(() => ({}));
    return { ok: reply.ok, status: reply.status, data };
  }

  // 화면에 줄 세션 모양: 토큰·만료 시각·이메일만.
  const sessionOf = (data) => (typeof data?.access_token === 'string' && typeof data?.refresh_token === 'string'
    ? { accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: Number.isFinite(data.expires_at) ? data.expires_at : Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
      email: typeof data.user?.email === 'string' ? data.user.email : null }
    : null);

  const credentials = (request) => {
    const { email, password } = request.body && typeof request.body === 'object' ? request.body : {};
    if (typeof email !== 'string' || typeof password !== 'string' || !EMAIL.test(email) || email.length > MAX_EMAIL
        || password.length < 6 || password.length > MAX_PASSWORD) return null;
    return { email: email.trim(), password };
  };

  const guard = (request, response) => {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      send(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      return false;
    }
    return true;
  };

  const upstream = async (response, work) => {
    try { await work(); } catch { send(response, 502, { error: 'AUTH_UNAVAILABLE', message: '로그인 서버에 연결하지 못했습니다.' }); }
  };

  return {
    async login(request, response) {
      if (!guard(request, response)) return;
      const input = credentials(request);
      if (!input) return send(response, 400, { error: 'BAD_REQUEST', message: '이메일과 비밀번호(6자 이상)를 확인해 주세요.' });
      await upstream(response, async () => {
        const result = await call('/token?grant_type=password', { body: input });
        const session = result.ok ? sessionOf(result.data) : null;
        if (!session) return send(response, result.status === 400 || result.status === 401 ? 401 : 502,
          { error: 'LOGIN_FAILED', message: '이메일 또는 비밀번호가 맞지 않습니다.' });
        send(response, 200, session);
      });
    },
    async signup(request, response) {
      if (!guard(request, response)) return;
      const input = credentials(request);
      if (!input) return send(response, 400, { error: 'BAD_REQUEST', message: '이메일과 비밀번호(6자 이상)를 확인해 주세요.' });
      await upstream(response, async () => {
        const result = await call('/signup', { body: input });
        if (!result.ok) return send(response, result.status === 422 || result.status === 400 ? 400 : 502,
          { error: 'SIGNUP_FAILED', message: '가입하지 못했습니다. 이미 가입했거나 비밀번호가 약합니다.' });
        send(response, 200, sessionOf(result.data) ?? { confirmationRequired: true });
      });
    },
    async refresh(request, response) {
      if (!guard(request, response)) return;
      const token = request.body?.refreshToken;
      if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return send(response, 400, { error: 'BAD_REQUEST' });
      await upstream(response, async () => {
        const result = await call('/token?grant_type=refresh_token', { body: { refresh_token: token } });
        const session = result.ok ? sessionOf(result.data) : null;
        if (!session) return send(response, 401, { error: 'SESSION_EXPIRED', message: '다시 로그인해 주세요.' });
        send(response, 200, session);
      });
    },
    async logout(request, response) {
      if (!guard(request, response)) return;
      const header = request.headers?.authorization;
      const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
      if (token && token.length <= MAX_TOKEN) await call('/logout', { token }).catch(() => null);
      send(response, 200, { ok: true });
    },
  };
}
