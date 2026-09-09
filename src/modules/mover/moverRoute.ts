import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validation';
import moverController from './moverController';
import { uploadMoverProfileImage } from './moverUpload';
import {
  createMoverProfileSchema,
  getMoverListQuerySchema,
  getMoverParamsSchema,
  updateMoverProfileSchema,
} from './moverValidation';

const router = Router();

/*=================================================
로그인한 기사님의 본인 프로필 API
=================================================*/

/*
@ GET /mover/profile

- accessToken의 userId로 기사님 본인의 프로필을 조회합니다.
- 요청 body, query, params가 없으므로 validate는 사용하지 않습니다.

@ 라우트 순서
- 고정 경로 /profile은 동적 경로 /:id보다 먼저 등록해야 합니다.
- 그렇지 않으면 Express가 profile을 기사님 ID로 해석할 수 있습니다.
*/
router.get('/profile', authenticate, moverController.getMyProfile);

/*
@ POST /mover/profile

- 기사님 프로필을 최초 등록합니다.
- Multer가 multipart body를 먼저 만들어야 하므로
  이미지 업로드 미들웨어를 validate보다 앞에 둡니다.
*/
router.post(
  '/profile',
  authenticate,
  uploadMoverProfileImage,
  validate(createMoverProfileSchema),
  moverController.createProfile
);

/*
@ PATCH /mover/profile

- 로그인한 기사님의 프로필에서 전달된 값만 수정합니다.
- JSON 요청과 multipart/form-data 요청을 모두 지원합니다.
*/
router.patch(
  '/profile',
  authenticate,
  uploadMoverProfileImage,
  validate(updateMoverProfileSchema),
  moverController.updateProfile
);

/*=================================================
공개 기사님 조회 API
=================================================*/

/*
@ GET /mover

- 별명 검색, 지역·서비스 필터, 정렬, 페이지네이션을 지원합니다.
- 비회원도 이용할 수 있으므로 authenticate를 사용하지 않습니다.
*/
router.get(
  '/',
  validate(getMoverListQuerySchema, 'query'),
  moverController.getMovers
);

/*
@ GET /mover/:id

- 특정 기사님의 공개 프로필과 집계 정보를 조회합니다.
- UUID 형식이 아닌 ID는 Zod 검증 에러로 처리합니다.
*/
router.get(
  '/:id',
  validate(getMoverParamsSchema, 'params'),
  moverController.getMoverById
);

export default router;
