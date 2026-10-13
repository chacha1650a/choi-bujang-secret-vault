import { getDeviceApi, notFoundConfig } from '../../src/notes-runtime.mjs';

// POST /api/device/request: 로그인한 학생이 이 기기의 승인을 요청합니다. 요청만으로는 승인되지 않습니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getDeviceApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.request(request, response);
}
