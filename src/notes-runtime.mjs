import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createNotesApi } from './notes-api.mjs';
import { createLoginVerifier } from './verify-login.mjs';

let cached;

// 서버 전용 키는 이 함수 안에서만 환경변수로 읽습니다. 응답·로그·브라우저 파일에는 넣지 않습니다.
export function getNotesApi(env = process.env) {
  if (cached) return cached;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verifyLogin = createLoginVerifier({ config, supabaseSecretKey: key });
  cached = createNotesApi({ verifyLogin, supabase });
  return cached;
}

export function notFoundConfig(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
}
