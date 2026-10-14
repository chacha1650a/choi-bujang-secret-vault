import { getAuthApi } from '../../src/notes-runtime.mjs';

// POST /api/auth/login · signup · refresh · logout: 로그인 관련 요청을 서버가 대신 Supabase에 보냅니다(5단계 가점: 화면 코드에 공개 키 없음).
// Vercel 함수 개수 제한(무료 12개) 때문에 네 동작을 함수 하나로 합쳤습니다.
const ACTIONS = new Set(['login', 'signup', 'refresh', 'logout']);

export default function handler(request, response) {
  const action = request.query?.action;
  if (typeof action !== 'string' || !ACTIONS.has(action)) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(404).json({ error: 'NOT_FOUND' });
  }
  return getAuthApi()[action](request, response);
}
