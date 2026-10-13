import { createHash, randomBytes } from 'node:crypto';
import { createGuard, send } from './notes-api.mjs';

// 11단계: 기기 승인 흐름. 승인 여부는 서버(DB의 device_registrations)만 정합니다.
// 기기 ID는 서버가 만든 16자리 소문자 16진수이고 개인키가 아닙니다. 브라우저에는 자바스크립트가 읽을 수 없는
// HttpOnly 쿠키로만 두고, DB에는 그 해시만 남깁니다. 화면의 버튼이나 앱 설치 표시는 승인 근거가 아닙니다.
// 승인은 강사가 SQL Editor에서 상태를 approved로 바꿀 때만 됩니다(supabase/step11-devices.sql 참고).

export const DEVICE_COOKIE = 'aleph_device';
const DEVICE_ID = /^[0-9a-f]{16}$/u;
const MAX_PENDING = 3;
const hashDevice = (deviceId) => createHash('sha256').update(deviceId, 'utf8').digest('hex');

export function deviceIdFrom(request) {
  const header = request.headers?.cookie;
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === DEVICE_COOKIE) {
      const value = rest.join('=');
      return DEVICE_ID.test(value) ? value : null;
    }
  }
  return null;
}

async function registration(supabase, who, deviceId) {
  if (!deviceId || who.kind !== 'student') return null;
  const { data, error } = await supabase.from('device_registrations').select('status')
    .eq('device_hash', hashDevice(deviceId)).eq('user_id', who.userId).maybeSingle();
  if (error) throw error;
  return data;
}

// 보호 자료 API가 쓰는 확인 함수: 로그인한 사용자와 이 기기가 승인된 짝일 때만 true입니다.
export function createDeviceCheck(supabase) {
  return async (request, who) => (await registration(supabase, who, deviceIdFrom(request)))?.status === 'approved';
}

export function createDeviceApi({ verifyLogin, supabase }) {
  const guarded = createGuard(verifyLogin);

  // GET /api/device/status: 서버가 확인한 승인 여부만 돌려줍니다. 로그인 없이도 200이지만 자료는 넣지 않습니다.
  async function status(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      send(response, 405, { error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    try {
      const who = await verifyLogin(request.headers?.authorization);
      if (!who) {
        send(response, 200, { approved: false, reason: 'login_required' });
        return;
      }
      const found = await registration(supabase, who, deviceIdFrom(request));
      if (!found) send(response, 200, { approved: false, reason: 'device_not_registered' });
      else if (found.status === 'approved') send(response, 200, { approved: true, reason: 'device_approved' });
      else send(response, 200, { approved: false, reason: found.status === 'pending' ? 'approval_pending' : 'device_revoked' });
    } catch {
      send(response, 500, { error: 'SERVER_ERROR' });
    }
  }

  // POST /api/device/request: 이 기기의 승인을 요청합니다. 요청만으로는 승인되지 않습니다(상태 pending).
  async function request(request, response) {
    await guarded(request, response, ['POST'], async (who) => {
      if (who.kind !== 'student') {
        send(response, 403, { error: 'FORBIDDEN', reason: 'student_login_required' });
        return;
      }
      let deviceId = deviceIdFrom(request);
      const existing = await registration(supabase, who, deviceId);
      if (existing) {
        send(response, 200, { approved: existing.status === 'approved', status: existing.status });
        return;
      }
      // 한 계정이 승인 대기 요청을 끝없이 만들지 못하게 대기 중인 요청 수를 제한합니다.
      const pending = await supabase.from('device_registrations').select('device_hash')
        .eq('user_id', who.userId).eq('status', 'pending');
      if (pending.error) throw pending.error;
      if ((pending.data?.length ?? 0) >= MAX_PENDING) {
        send(response, 429, { error: 'TOO_MANY_PENDING', message: '승인 대기 중인 요청이 많습니다. 강사의 승인을 기다려 주세요.' });
        return;
      }
      deviceId = randomBytes(8).toString('hex');
      const { error } = await supabase.from('device_registrations').insert({
        device_hash: hashDevice(deviceId), user_id: who.userId, status: 'pending',
        label: String(request.headers?.['user-agent'] ?? '').slice(0, 80),
      });
      if (error) throw error;
      response.setHeader('Set-Cookie',
        `${DEVICE_COOKIE}=${deviceId}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);
      send(response, 201, { approved: false, status: 'pending',
        message: '승인 요청을 보냈습니다. 강사가 서버에서 승인하기 전에는 자료가 열리지 않습니다.' });
    });
  }

  return { status, request };
}
