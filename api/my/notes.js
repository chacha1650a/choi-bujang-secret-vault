import { getNotesApi, notFoundConfig } from '../../src/notes-runtime.mjs';

// GET /api/my/notes (로그인한 본인의 메모 목록). 로그인 토큰이 필요합니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getNotesApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.mine(request, response);
}
