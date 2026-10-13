-- Supabase SQL Editor에서 실행
-- 전제: 프로젝트 Settings > API > JWT Settings 의 JWT Secret을
--      본 서비스(BE) JWT 서명 시크릿과 동일하게 맞춰야 auth.uid()가 our userId로 채워짐.
--      (claim "sub" = User.id uuid, HS256 동일 알고리즘)
-- role claim은 Supabase/PostgREST가 SET ROLE 대상으로 예약해서 "authenticated" 고정값만 들어온다.
-- 비즈니스 role(CUSTOMER/MOVER)이 RLS에서 필요해지면 auth.jwt() ->> 'app_role'로 참조할 것 —
-- role claim으로 참조하면 안 된다 (src/modules/auth/authService.ts의 signAccessToken 참고).

-- 이 폴더의 파일을 어디까지 실행했는지 추적한다. 한 번만 생성.
-- 적용 여부 확인: select * from schema_migrations order by filename;
create table if not exists schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);

create table chat_messages (
  id          bigint generated always as identity primary key,
  estimate_id uuid not null,        -- 기존 DB Estimate.id 참조 (채팅방 키)
  customer_id uuid not null,        -- 기존 DB CustomerProfile.userId (참여자, RLS용 비정규화)
  mover_id    uuid not null,        -- 기존 DB MoverProfile.userId (참여자, RLS용 비정규화)
  sender_id   uuid not null,        -- 메시지 보낸 사람 (customer_id 또는 mover_id)
  content     text,
  image_url   text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),

  constraint sender_is_participant check (sender_id in (customer_id, mover_id)),
  constraint content_or_image check (content is not null or image_url is not null)
);

-- 커서 페이지네이션 (estimate_id 기준 최신순 조회)
create index chat_messages_room_cursor_idx
  on chat_messages (estimate_id, created_at desc, id desc);

-- 미읽음 수 집계용
create index chat_messages_unread_idx
  on chat_messages (estimate_id, is_read)
  where is_read = false;

alter table chat_messages enable row level security;

-- SELECT만 정책 추가. INSERT/UPDATE/DELETE는 정책 없음 = RLS가 기본 전면 차단.
-- 모든 쓰기(POST/PATCH)는 BE REST API가 service_role key로 처리 (RLS 우회).
-- 이 SELECT 정책은 FE의 Supabase Realtime(postgres_changes) 직접 구독용.
create policy "참여자만 조회"
  on chat_messages for select
  using (auth.uid() = customer_id or auth.uid() = mover_id);

-- Realtime publication에 등록 (postgres_changes 구독 대상)
alter publication supabase_realtime add table chat_messages;

-- 이미지 첨부용 Storage 버킷 (private, 업로드는 presigned URL 통해서만)
-- 업로드/다운로드 전부 presigned URL(BE가 service_role로 발급)로만 처리.
-- 버킷 자체는 익명 접근 불가 (RLS 정책 없음 = 기본 차단, public=false로 이중 차단).
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

insert into schema_migrations (filename) values ('0001_init.sql');
