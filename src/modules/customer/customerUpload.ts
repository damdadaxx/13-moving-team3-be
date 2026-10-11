import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../utils/error';

/*=================================================
  고객 프로필 이미지 업로드 설정
=================================================*/

// 프론트엔드 제한과 동일하게 맞춰 요청 단계에서 큰 파일을 바로 거절합니다.
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const CUSTOMER_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'customer');

const upload = multer({
  /*
    @ memoryStorage
    - 업로드된 파일을 먼저 메모리의 Buffer로 받습니다.
    - 요청 body 검증까지 성공한 뒤 Service에서 같은 Buffer를 S3로 전송합니다.
    - 이렇게 하면 잘못된 body와 함께 온 파일이 S3에 먼저 남지 않습니다.
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
  고객 프로필 이미지 업로드 미들웨어
=================================================*/

/*
  @ uploadCustomerProfileImage
  - Multer에서 발생한 오류를 프로젝트의 BadRequestError로 변환합니다.
  - 변환된 에러는 기존 errorHandler의 AppError 분기에서 400으로 처리됩니다.
*/
export const uploadCustomerProfileImage = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  singleProfileImage(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new BadRequestError(
            '프로필 이미지는 4MB 이하만 업로드할 수 있습니다.'
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

/*
@ deleteLegacyCustomerImage

- S3 전환 전에 저장된 고객 로컬 이미지를 새 이미지로 교체할 때 정리합니다.
- 새 CloudFront URL이나 seed 외부 URL은 이 함수에서 삭제하지 않습니다.
- 로컬 이미지가 이미 없어도 교체 작업은 정상 완료된 것으로 처리합니다.
*/
export const deleteLegacyCustomerImage = async (
  imgUrl: string | null
): Promise<void> => {
  if (!imgUrl || !imgUrl.startsWith('/uploads/customer/')) {
    return;
  }

  const fileName = path.basename(imgUrl);
  const filePath = path.join(CUSTOMER_UPLOAD_DIR, fileName);

  try {
    await fs.promises.unlink(filePath);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
};
