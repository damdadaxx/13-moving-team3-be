// 채팅 DB(schema.chat.prisma)용 Prisma 설정. 메인 DB는 prisma7.config.ts(기본 자동 인식)를 그대로 쓰고,
// 이 파일은 명령어에 --config=prisma.chat.config.ts를 붙였을 때만 쓰인다.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.chat.prisma',
  migrations: {
    path: 'prisma/migrations-chat',
  },
  datasource: {
    url: process.env['CHAT_DATABASE_URL'],
  },
});
