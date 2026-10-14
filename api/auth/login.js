import { getAuthApi } from '../../src/notes-runtime.mjs';

// POST /api/auth/login: 로그인 관련 요청을 서버가 대신 Supabase에 보냅니다(5단계 가점: 화면 코드에 공개 키 없음).
export default function handler(request, response) {
  return getAuthApi().login(request, response);
}
