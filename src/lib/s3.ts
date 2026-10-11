import { S3Client } from '@aws-sdk/client-s3';
import { ENV } from '../config/env';

/*=================================================
S3 Client
=================================================*/

/*
@ 인증 방식

- access key와 secret key를 코드나 환경변수에 직접 넣지 않습니다.
- 배포 서버(EC2)에서는 AWS SDK가 EC2에 연결된 IAM Role을 자동으로 사용합니다.
- 로컬에서는 개발자가 설정한 AWS CLI profile을 자동으로 사용합니다.

@ 싱글톤

- 요청마다 새 연결 객체를 만들 필요가 없으므로 애플리케이션 전체에서
  하나의 S3Client를 재사용합니다.
*/
export const s3Client = new S3Client({
  region: ENV.AWS_REGION,
});
