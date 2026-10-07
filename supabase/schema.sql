-- 2단계 학습용 Supabase 테이블. SQL Editor에서 실행합니다.
-- 실제 개인정보·비밀번호·키는 넣지 않습니다. 가상 메모 본문은 이 파일에 두지 않습니다.
create table if not exists public.notes (
  id bigint generated always as identity primary key,
  -- 3단계 로그인 뒤 주인을 연결할 자리입니다. auth.users 외래키는 일부러 걸지 않습니다.
  owner_id uuid,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- 정책을 하나도 만들지 않으므로 브라우저용 공개 키(anon)와 로그인 사용자(authenticated)는 읽을 수 없습니다.
-- 서버 함수의 서버 전용 키(service role)만 RLS를 건너뛰고 읽습니다.
revoke all on table public.notes from anon, authenticated;
