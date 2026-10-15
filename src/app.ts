import './config/env';
import './config/zod';
import path from 'node:path';
import express from 'express';
import errorHandler from './middlewares/errorHandler';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { ENV } from './config/env';
import { registerSocialStrategies } from './modules/auth/authPassport';
import authRouter from './modules/auth/authRoute';
import estimateRequestRouter from './modules/estimate-request/estimateRequestRoute';
import moverRouter from './modules/mover/moverRoute';
import estimateRouter from './modules/estimate/estimateRoute';
import customerRouter from './modules/customer/customerRoute';
import likeRouter from './modules/like/likeRoute';
import reviewRouter from './modules/review/reviewRoute';
import notificationRouter from './modules/notification/notificationRoute';
import chatRouter from './modules/chat/chatRoute';

const app = express();

// DB 의 BigInt(견적 가격)는 JSON 으로 못 나가므로 number 로 내려준다 (FE 는 number)
// ponytail: 2^53 초과 시 정밀도 손실. 그만큼 큰 금액이 생기면 string 으로 전환
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
);

// 쿠키 기반 인증: 크로스 오리진에서 쿠키가 오가려면 origin 명시 + credentials 필요
app.use(cors({ origin: ENV.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// 소셜 로그인 전략 등록. 세션은 쓰지 않는다 (JWT 쿠키)
registerSocialStrategies();
app.use(passport.initialize());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/auth', authRouter);
app.use('/estimate-requests', estimateRequestRouter);
app.use('/mover', moverRouter);
app.use('/estimates', estimateRouter);
app.use('/customer', customerRouter);
app.use('/likes', likeRouter);
app.use('/reviews', reviewRouter);
app.use('/notifications', notificationRouter);
app.use('/chat/rooms', chatRouter);

// 라우터는 여기에 추가 (반드시 errorHandler 위에)
app.use(errorHandler);

export default app;
