-- 학습용 Supabase 테이블(3단계 이후 최종 모양). 새 프로젝트에서는 이 파일만 실행하면 됩니다.
-- 이미 2단계 모양의 테이블이 있으면 이 파일 대신 migrate-step3.sql을 실행합니다.
-- 실제 개인정보·비밀번호·키는 넣지 않습니다. 가상 메모 본문은 이 파일에 두지 않습니다.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  -- 서버가 확인한 로그인 사용자 ID를 저장합니다. auth.users 외래키는 일부러 걸지 않습니다.
  owner_id uuid,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- 정책을 하나도 만들지 않으므로 공개 키(anon)와 로그인 사용자(authenticated)는 읽을 수 없습니다.
revoke all on table public.notes from anon, authenticated;

-- "새 테이블 자동 공개"를 끈 프로젝트에서는 서버 전용 키(service_role)에도 권한이 자동으로 붙지 않습니다.
grant select, insert, update, delete on table public.notes to service_role;
