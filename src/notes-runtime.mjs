import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import verifiedPolicy from '../policy/verified-policy.json' with { type: 'json' };
import { RULE_IDS } from './decider.mjs';
import { createNoticesApi, createNotesApi } from './notes-api.mjs';
import { createRestoreApi } from './restore-api.mjs';
import { createDeviceApi, createDeviceCheck } from './device-api.mjs';
import { createLoginVerifier } from './verify-login.mjs';

let cached;

// 서버 전용 키는 이 함수 안에서만 환경변수로 읽습니다. 응답·로그·브라우저 파일에는 넣지 않습니다.
function getApis(env) {
  if (cached) return cached;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verifyLogin = createLoginVerifier({ config, supabaseSecretKey: key });
  // 11단계: 보호 자료 API는 서버가 승인된 기기로 확인한 요청만 처리합니다.
  const deviceCheck = createDeviceCheck(supabase);
  cached = {
    notes: createNotesApi({ verifyLogin, supabase, deviceCheck }),
    notices: createNoticesApi({ verifyLogin, supabase, deviceCheck }),
    restore: createRestoreApi({ verifyLogin, supabase, deviceCheck,
      policy: { snapshot: verifiedPolicy, config, ruleIds: RULE_IDS } }),
    device: createDeviceApi({ verifyLogin, supabase }),
  };
  return cached;
}

export function getNotesApi(env = process.env) {
  return getApis(env)?.notes ?? null;
}

export function getNoticesApi(env = process.env) {
  return getApis(env)?.notices ?? null;
}

export function getRestoreApi(env = process.env) {
  return getApis(env)?.restore ?? null;
}

export function getDeviceApi(env = process.env) {
  return getApis(env)?.device ?? null;
}

export function notFoundConfig(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
}
