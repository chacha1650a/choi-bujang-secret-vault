import { createClient } from '@supabase/supabase-js';

// 2단계: 자료는 학습용 Supabase 테이블에 있고, 서버 전용 키는 이 함수만 읽습니다.
// 아직 로그인이 없어서 이 주소는 누구나 부를 수 있습니다. 3단계에서 막습니다.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    response.status(500).json({ error: 'SERVER_NOT_CONFIGURED' });
    return;
  }
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.from('notes').select('title, content').order('id');
    if (error) throw error;
    response.status(200).json({ notes: data });
  } catch {
    // 오류 내용에 주소·키가 섞일 수 있어서 응답과 로그에 자세히 남기지 않습니다.
    response.status(500).json({ error: 'NOTES_UNAVAILABLE' });
  }
}
