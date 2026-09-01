import swaggerJSDoc from 'swagger-jsdoc';
import { ENV } from './env';

const isProd = ENV.NODE_ENV === 'production';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Moving API',
      version: '1.0.0',
      description: '이사 서비스 매칭 플랫폼 API 문서',
    },
    servers: [{ url: `http://localhost:${ENV.PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // 개발은 src의 .ts, 프로덕션은 빌드된 dist의 .js를 읽음
  apis: isProd
    ? ['./dist/routes/*.js', './dist/swaggertest/*.js']
    : ['./src/routes/*.ts', './src/swaggertest/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
