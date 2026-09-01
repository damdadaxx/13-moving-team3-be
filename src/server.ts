import app from './app';
import { ENV } from './config/env';

app.listen(ENV.PORT, () => {
  console.log(`서버 포트 ${ENV.PORT} env 설정 : (${ENV.NODE_ENV})`);
});
