import { getNotesApi, notFoundConfig } from '../src/notes-runtime.mjs';

// GET /api/notes (내 메모 목록), POST /api/notes (메모 추가). 로그인 토큰이 필요합니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getNotesApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.collection(request, response);
}
