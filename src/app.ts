import './config/env';
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

const app = express();

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

// 라우터는 여기에 추가 (반드시 errorHandler 위에)
app.use(errorHandler);

export default app;
