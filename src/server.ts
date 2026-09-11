import app from './app';
import { ENV } from './config/env';
import { startScheduler } from './scheduler';

app.listen(ENV.PORT, () => {
  console.log(`서버 포트 ${ENV.PORT} env 설정 : (${ENV.NODE_ENV})`);

  // 라우터가 아니라 여기서 띄운다. listen 이후여야 배치가 도는 동안에도
  // 헬스체크/요청 처리가 이미 가능한 상태가 된다.
  startScheduler();
});
