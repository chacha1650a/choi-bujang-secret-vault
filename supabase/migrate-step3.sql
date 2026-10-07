-- 3단계: API 모양({id,title,body}, id는 UUID)에 맞추는 변경. SQL Editor에서 한 번만 실행합니다.
-- 가상 메모 4건은 그대로 두고 칸만 바꿉니다.
alter table public.notes rename column content to body;
alter table public.notes alter column id drop identity if exists;
alter table public.notes alter column id type uuid using gen_random_uuid();
alter table public.notes alter column id set default gen_random_uuid();
-- 서버 전용 키(service_role)만 추가·수정·삭제합니다. anon·authenticated 권한은 계속 없습니다.
grant select, insert, update, delete on table public.notes to service_role;
