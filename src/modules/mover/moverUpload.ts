import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../utils/error';

/*=================================================
  기사님 프로필 이미지 업로드 설정
  =================================================*/

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  /*
    @ memoryStorage
  
    - 업로드된 파일을 먼저 메모리의 Buffer로 받습니다.
    - 현재는 로컬 파일로 저장하고 추후에는 같은 Buffer를 S3로 전송합니다.
    */
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      return callback(
        new BadRequestError('JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.')
      );
    }

    return callback(null, true);
  },
});

const singleProfileImage = upload.single('profileImage');

/*=================================================
  기사님 프로필 이미지 업로드 미들웨어
  =================================================*/

/*
  @ uploadMoverProfileImage
  
  - Multer에서 발생한 오류를 프로젝트의 BadRequestError로 변환합니다.
  - 변환된 에러는 기존 errorHandler의 AppError 분기에서 400으로 처리됩니다.
  */
export const uploadMoverProfileImage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  singleProfileImage(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError(
            '프로필 이미지는 5MB 이하만 업로드할 수 있습니다.'
          )
        );
      }

      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(
          new BadRequestError(
            '프로필 이미지 파일은 한 개만 업로드할 수 있습니다.'
          )
        );
      }

      return next(
        new BadRequestError('프로필 이미지 업로드 요청이 올바르지 않습니다.')
      );
    }

    if (error instanceof Error) {
      return next(error);
    }

    return next();
  });
};
