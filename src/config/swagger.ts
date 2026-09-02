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
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
        },
      },
    },
  },
  apis: isProd ? ['./dist/modules/**/*.js'] : ['./src/modules/**/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
