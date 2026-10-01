import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import moverService from './moverService';
import type {
  CreateMoverProfileInput,
  GetMoverListQuery,
  GetMoverParams,
  UpdateMoverProfileInput,
} from './moverValidation';

/*
@ getValidated

- validate 미들웨어가 req.validatedData에 저장한 값을 가져옵니다.
- 원본 타입은 unknown이므로 각 API의 Zod 추론 타입으로 단언합니다.
*/
const getValidated = <T>(req: Request): T => {
  return req.validatedData as T;
};

/*
@ getAuthenticatedUser

- authenticate가 검증한 JWT payload에서 사용자 ID와 역할을 가져옵니다.
- 라우터에서 인증 미들웨어가 누락된 경우도 401로 안전하게 처리합니다.
*/
const getAuthenticatedUser = (req: Request) => {
  const userId = req.auth?.sub;
  const role = req.auth?.role;

  if (!userId || !role) {
    throw new UnauthorizedError();
  }

  return {
    userId,
    role,
  };
};

/*=================================================
기사님 Controller
=================================================*/

const moverController = {
  /*
  @ createProfile

  - 검증된 등록 데이터와 Multer 이미지를 Service에 전달합니다.
  - 성공 응답은 공통 형식인 { success: true, data }를 사용합니다.
  */
  createProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = getAuthenticatedUser(req);
      const input = getValidated<CreateMoverProfileInput>(req);

      const profile = await moverService.createProfile({
        userId,
        role,
        input,
        profileImage: req.file,
      });

      return res.status(201).json({
        success: true,
        data: profile,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },

  /*
  @ getMyProfile

  - 로그인한 기사님 본인의 프로필을 조회합니다.
  - body, query, params가 없으므로 validation 데이터를 사용하지 않습니다.
  */
  getMyProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = getAuthenticatedUser(req);

      const profile = await moverService.getMyProfile({
        userId,
        role,
      });

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },

  /*
  @ updateProfile

  - 검증된 수정값과 선택적으로 업로드된 이미지를 Service에 전달합니다.
  */
  updateProfile: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, role } = getAuthenticatedUser(req);
      const input = getValidated<UpdateMoverProfileInput>(req);

      const profile = await moverService.updateProfile({
        userId,
        role,
        input,
        profileImage: req.file,
      });

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },

  /*
  @ getMovers

  - 공개 기사님 목록의 검증된 query를 Service에 전달합니다.
  - 인증이 필요하지 않으므로 req.auth를 확인하지 않습니다.
  */
  getMovers: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = getValidated<GetMoverListQuery>(req);
      const result = await moverService.getMovers(query);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },

  /*
  @ getMoverById

  - 검증된 path parameter의 기사님 ID로 공개 상세 정보를 조회합니다.
  */
  getMoverById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = getValidated<GetMoverParams>(req);
      const profile = await moverService.getMoverById(id);

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error: unknown) {
      return next(error);
    }
  },
};

export default moverController;
