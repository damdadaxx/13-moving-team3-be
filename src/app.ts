import './config/env';
import express from 'express';
import errorHandler from './middlewares/errorHandler';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
// import swaggerTestRouter from './docs/swaggertest.route';
import { ENV } from './config/env';
import authRouter from './modules/auth/authRoute';

const app = express();

// app.set('trust proxy', 1);

// 쿠키 기반 인증: 크로스 오리진에서 쿠키가 오가려면 origin 명시 + credentials 필요
app.use(cors({ origin: ENV.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 라우터는 여기에 추가 (반드시 errorHandler 위에)
// app.use('/swaggertest', swaggerTestRouter);
app.use('/auth', authRouter);

app.use(errorHandler);

export default app;
