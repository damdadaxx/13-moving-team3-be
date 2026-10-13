-- Supabase SQL Editor에서 실행 (0001_init.sql 적용 후)
-- chat-images 버킷에 크기/타입 제한 추가. mover/customer 프로필 이미지 업로드(multer)와
-- 같은 기준(jpeg/png/webp, 5MB)으로 맞춘다. presigned URL로 직접 PUT하는 구조라
-- 서버는 파일 바이트를 보지 못하므로, 이 제약을 Storage(버킷) 쪽에서 강제해야 실제로 막힌다.
update storage.buckets
set file_size_limit = 5242880, -- 5MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'chat-images';

insert into schema_migrations (filename) values ('0002_bucket_limits.sql');
