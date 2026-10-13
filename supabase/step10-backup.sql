-- 10단계: 침해 전 메모 사본(note_snapshots)과 덧붙이기만 하는 감사 기록(audit_log). SQL Editor에서 실행합니다.
-- 메모 테이블의 기존 행과 권한은 바꾸지 않고, 새 메모가 만들어질 때 사본을 남기는 트리거만 더합니다.

create table if not exists public.note_snapshots (
  note_id uuid primary key,
  owner_id uuid not null,
  title text not null,
  body text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  captured_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid not null,
  action text not null check (char_length(action) between 1 and 40),
  resource text not null check (char_length(resource) between 1 and 80),
  detail jsonb not null default '{}'::jsonb
);

alter table public.note_snapshots enable row level security;
alter table public.audit_log enable row level security;
revoke all on table public.note_snapshots from public, anon, authenticated, service_role;
revoke all on table public.audit_log from public, anon, authenticated, service_role;
-- 서버 함수는 사본을 읽기만 하고, 감사 기록은 읽고 덧붙이기만 합니다(고치거나 지울 수 없음).
grant select on table public.note_snapshots to service_role;
grant select, insert on table public.audit_log to service_role;

-- 내용 해시: 제목, 구분 문자(U+001F), 본문을 UTF-8로 이어 붙인 SHA-256. 서버(src/restore-api.mjs)와 같은 규칙입니다.
create or replace function public.capture_note_snapshot() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.owner_id is not null then
    insert into public.note_snapshots (note_id, owner_id, title, body, content_sha256)
    values (new.id, new.owner_id, new.title, new.body,
      encode(sha256(convert_to(new.title || chr(31) || new.body, 'UTF8')), 'hex'))
    on conflict (note_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_note_snapshot() from public, anon, authenticated;

drop trigger if exists notes_capture_snapshot on public.notes;
create trigger notes_capture_snapshot after insert on public.notes
  for each row execute function public.capture_note_snapshot();

-- 지금 있는 메모(주인이 있는 행)도 현재 내용을 침해 전 사본으로 남깁니다. 이미 있으면 그대로 둡니다.
insert into public.note_snapshots (note_id, owner_id, title, body, content_sha256)
select id, owner_id, title, body, encode(sha256(convert_to(title || chr(31) || body, 'UTF8')), 'hex')
from public.notes where owner_id is not null
on conflict (note_id) do nothing;

-- 확인: 메모 수와 사본 수, 역할별 권한(anon·authenticated는 모두 false여야 합니다).
select r.role, t.tbl,
  has_table_privilege(r.role, t.tbl, 'select') as sel,
  has_table_privilege(r.role, t.tbl, 'insert') as ins,
  has_table_privilege(r.role, t.tbl, 'update') as upd,
  has_table_privilege(r.role, t.tbl, 'delete') as del,
  (select count(*) from public.notes where owner_id is not null) as notes,
  (select count(*) from public.note_snapshots) as snapshots
from (values ('anon'), ('authenticated'), ('service_role')) as r(role),
  (values ('public.note_snapshots'), ('public.audit_log')) as t(tbl)
order by t.tbl, r.role;
