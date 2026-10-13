import { getNoticesApi, notFoundConfig } from '../../src/notes-runtime.mjs';

// GET·PUT /api/notices/:id. 로그인 토큰이 필요하고, 수정은 DB의 강사 명단에 있는 계정만 합니다.
export default async function handler(request, response) {
  let api;
  try {
    api = getNoticesApi();
  } catch {
    api = null;
  }
  if (!api) return notFoundConfig(response);
  return api.item(request, response);
}
