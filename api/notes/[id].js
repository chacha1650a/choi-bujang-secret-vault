import { getNotesApi, notFoundConfig } from '../../src/notes-runtime.mjs';

// GET·PUT·DELETE /api/notes/:id. 로그인 토큰이 필요합니다. 소유자 검사는 4단계에서 붙입니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getNotesApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.item(request, response);
}
