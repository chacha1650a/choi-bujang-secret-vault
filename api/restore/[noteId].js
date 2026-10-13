import { getRestoreApi, notFoundConfig } from '../../src/notes-runtime.mjs';

// POST /api/restore/:noteId. 로그인한 본인의 메모 한 건을 검증한 사본에서 되살립니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getRestoreApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.restore(request, response);
}
