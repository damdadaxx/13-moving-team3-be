import swaggerJSDoc from 'swagger-jsdoc';
import { ENV } from './env';

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
        // accessToken은 accessToken 쿠키로 내려주고 검증합니다.
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
        },
      },
    },
    tags: [
      { name: 'Auth', description: '인증' },
      { name: 'Estimate', description: '견적 API' },
      { name: 'Review', description: '리뷰 관련 API' },
    ],
  },
  // @swagger 주석은 src/docs/{domain}Swagger.ts 에 모아둔다.
  //
  // dist가 아니라 src의 .ts를 읽는다.
  // 문서 파일은 주석만 있고 실행 코드가 없어서, tsc가 어떤 구문에도 붙지 않은
  // 주석을 버린다(빌드하면 블록 1개만 남는다). swagger-jsdoc은 파일을 텍스트로
  // 파싱하므로 컴파일 결과가 필요 없고, 원본을 직접 읽으면 유실이 없다.
  // 단, 배포 시 src/docs 가 함께 올라가야 한다.
  apis: ['./src/docs/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
