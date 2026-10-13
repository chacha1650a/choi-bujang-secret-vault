import { getDeviceApi, notFoundConfig } from '../../src/notes-runtime.mjs';

// GET /api/device/status: 서버가 확인한 이 기기의 승인 여부만 돌려줍니다. 자료는 넣지 않습니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getDeviceApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.status(request, response);
}
