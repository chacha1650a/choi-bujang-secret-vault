-- 8단계: 강사 공지 구역과 강사 명단. SQL Editor에서 실행합니다. 메모 테이블은 건드리지 않습니다.
-- 두 테이블 모두 브라우저 역할(PUBLIC·anon·authenticated)에는 권한을 주지 않고, 서버 함수(service_role)만 씁니다.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_by uuid
);

-- 강사 권한은 화면·토큰의 role이 아니라 이 명단으로만 정합니다. 학생 시험 계정은 넣지 않습니다.
create table if not exists public.instructors (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.notices enable row level security;
alter table public.instructors enable row level security;
revoke all on table public.notices from public, anon, authenticated;
revoke all on table public.instructors from public, anon, authenticated;
grant select, update on table public.notices to service_role;
grant select on table public.instructors to service_role;

-- 공개 가능한 가상 공지 한 건(이미 있으면 만들지 않습니다).
insert into public.notices (title, body)
select '다음 수업 공지(가상)', '실습용 가상 공지입니다. 강사만 고칠 수 있습니다.'
where not exists (select 1 from public.notices);

-- 확인: 공지 수, 강사 수(0이어야 합니다), 역할별 권한.
select (select count(*) from public.notices) as notices,
  (select count(*) from public.instructors) as instructors;
select r.role, t.tbl,
  has_table_privilege(r.role, t.tbl, 'select') as sel,
  has_table_privilege(r.role, t.tbl, 'update') as upd
from (values ('anon'), ('authenticated'), ('service_role')) as r(role),
  (values ('public.notices'), ('public.instructors')) as t(tbl)
order by t.tbl, r.role;
