-- 11단계: 기기 승인 명단(device_registrations). SQL Editor에서 실행합니다. 다른 테이블은 건드리지 않습니다.
-- 브라우저 역할에는 권한을 주지 않습니다. 서버는 명단을 읽고 새 승인 요청(pending)을 넣기만 하며,
-- 승인(approved)·회수(revoked)는 서버 코드가 아니라 강사가 SQL Editor에서만 바꿉니다.

create table if not exists public.device_registrations (
  device_hash text primary key check (device_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  label text not null default '' check (char_length(label) <= 80),
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists device_registrations_user on public.device_registrations (user_id);

alter table public.device_registrations enable row level security;
revoke all on table public.device_registrations from public, anon, authenticated, service_role;
grant select, insert on table public.device_registrations to service_role;

-- 확인: 역할별 권한(anon·authenticated 모두 false, service_role은 읽기·넣기만 true).
select r.role,
  has_table_privilege(r.role, 'public.device_registrations', 'select') as sel,
  has_table_privilege(r.role, 'public.device_registrations', 'insert') as ins,
  has_table_privilege(r.role, 'public.device_registrations', 'update') as upd,
  has_table_privilege(r.role, 'public.device_registrations', 'delete') as del
from (values ('anon'), ('authenticated'), ('service_role')) as r(role);

-- 강사용(필요할 때 따로 실행): 대기 중인 요청을 보고, 확인한 한 건만 승인하거나 회수합니다.
-- select left(device_hash, 12) as device, user_id, status, label, requested_at from public.device_registrations order by requested_at;
-- update public.device_registrations set status = 'approved', decided_at = now() where device_hash like '<앞 12자리>%' and status = 'pending';
-- update public.device_registrations set status = 'revoked', decided_at = now() where device_hash like '<앞 12자리>%';
