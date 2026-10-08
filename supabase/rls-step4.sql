-- 4단계 제작 3: 메모 테이블의 최소 권한과 RLS. 이미 있는 테이블에 SQL Editor에서 실행합니다.
-- 다른 테이블은 건드리지 않습니다.
revoke all on table public.notes from public, anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;
-- 서버 함수의 서버 전용 키(service_role)는 RLS를 건너뛰고 권한만 유지합니다. 소유자 검사는 서버 코드가 합니다.
grant select, insert, update, delete on table public.notes to service_role;

alter table public.notes enable row level security;

drop policy if exists notes_select_own on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own on public.notes;
drop policy if exists notes_delete_own on public.notes;

create policy notes_select_own on public.notes for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy notes_insert_own on public.notes for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy notes_update_own on public.notes for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy notes_delete_own on public.notes for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- 확인: 두 역할의 실제 권한. anon은 모두 false, authenticated는 네 가지만 true여야 합니다.
select r.role,
  has_table_privilege(r.role, 'public.notes', 'select') as sel,
  has_table_privilege(r.role, 'public.notes', 'insert') as ins,
  has_table_privilege(r.role, 'public.notes', 'update') as upd,
  has_table_privilege(r.role, 'public.notes', 'delete') as del,
  has_table_privilege(r.role, 'public.notes', 'truncate') as trunc
from (values ('anon'), ('authenticated')) as r(role);
