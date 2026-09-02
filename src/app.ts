import './config/env';
import express from 'express';
import errorHandler from './middlewares/errorHandler';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { ENV } from './config/env';
import { registerPassportStrategies } from './modules/auth/passport';
import authRouter from './modules/auth/authRoute';

registerPassportStrategies();

const app = express();

app.use(
  cors({
    origin: ENV.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // TODO: 배포 시 제거

app.use('/auth', authRouter);

app.use(errorHandler);

export default app;
