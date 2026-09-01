import './config/env';
import express from 'express';
import errorHandler from './middlewares/errorHandler';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import swaggerTestRouter from './docs/swaggertest.route';

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 라우터는 여기에 추가 (반드시 errorHandler 위에)
app.use('/swaggertest', swaggerTestRouter);

app.use(errorHandler);

export default app;
