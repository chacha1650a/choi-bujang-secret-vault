import { getNoticesApi, notFoundConfig } from '../src/notes-runtime.mjs';

// GET /api/notices (반 공지 목록). 로그인 토큰이 필요합니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getNoticesApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.collection(request, response);
}
