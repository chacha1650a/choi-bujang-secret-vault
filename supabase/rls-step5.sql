-- 5단계 제작 2: 메모 테이블을 공개 키·로그인 토큰으로 직접 부르는 길을 닫습니다. SQL Editor에서 실행합니다.
-- 이 테이블만 바꾸고 다른 테이블은 건드리지 않습니다.

-- 적용 전 권한(참고용): anon은 모두 false, authenticated는 select/insert/update/delete가 true입니다.
select r.role,
  has_table_privilege(r.role, 'public.notes', 'select') as sel,
  has_table_privilege(r.role, 'public.notes', 'insert') as ins,
  has_table_privilege(r.role, 'public.notes', 'update') as upd,
  has_table_privilege(r.role, 'public.notes', 'delete') as del
from (values ('anon'), ('authenticated'), ('service_role')) as r(role);

-- 브라우저가 쓰는 역할(PUBLIC·anon·authenticated)의 직접 권한을 모두 거둡니다.
revoke all on table public.notes from public, anon, authenticated;

-- 서버 함수의 서버 전용 키(service_role)는 계속 읽고 쓸 수 있어야 합니다. 소유자 검사는 서버 코드가 합니다.
grant select, insert, update, delete on table public.notes to service_role;

-- 적용 후 확인: anon·authenticated는 모두 false, service_role만 네 가지 true여야 합니다.
select r.role,
  has_table_privilege(r.role, 'public.notes', 'select') as sel,
  has_table_privilege(r.role, 'public.notes', 'insert') as ins,
  has_table_privilege(r.role, 'public.notes', 'update') as upd,
  has_table_privilege(r.role, 'public.notes', 'delete') as del
from (values ('anon'), ('authenticated'), ('service_role')) as r(role);
