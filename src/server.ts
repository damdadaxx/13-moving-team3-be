import { createServer } from 'node:http';
import app from './app';
import { ENV } from './config/env';
import { startScheduler } from './scheduler';
import { initSocket } from './lib/socket';
import { registerChatSocket } from './modules/chat/chatSocket';

// app.listen 대신 http 서버를 직접 만든다 — Socket.IO가 Express랑 같은 HTTP 서버에
// 붙어야(포트 하나로 같이) 떠서, ALB/nginx 쪽에 포트를 추가로 열 필요가 없다.
const httpServer = createServer(app);

const io = initSocket(httpServer);
registerChatSocket(io);

httpServer.listen(ENV.PORT, () => {
  console.log(`서버 포트 ${ENV.PORT} env 설정 : (${ENV.NODE_ENV})`);

  // 라우터가 아니라 여기서 띄운다. listen 이후여야 배치가 도는 동안에도
  // 헬스체크/요청 처리가 이미 가능한 상태가 된다.
  startScheduler();
});
