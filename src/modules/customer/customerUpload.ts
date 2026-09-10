import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { BadRequestError } from '../../utils/error';

/*=================================================
  고객 프로필 이미지 업로드 설정
=================================================*/

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const CUSTOMER_UPLOAD_DIR = path.join(UPLOAD_DIR, 'customer');

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

export const saveCustomerProfileImage = async (file: Express.Multer.File) => {
  const ext = EXT_BY_MIME[file.mimetype];
  if (!ext) {
    throw new BadRequestError('JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.');
  }

  await fs.promises.mkdir(CUSTOMER_UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  await fs.promises.writeFile(
    path.join(CUSTOMER_UPLOAD_DIR, filename),
    file.buffer
  );
  return `/uploads/customer/${filename}`;
};

export const deleteLocalUpload = (imgUrl: string) => {
  if (!imgUrl.startsWith('/uploads/')) {
    return;
  }

  const relative = imgUrl.replace(/^\/uploads\//, '');
  const filePath = path.join(UPLOAD_DIR, relative);
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
    return;
  }

  void fs.promises.unlink(filePath).catch(() => undefined);
};
