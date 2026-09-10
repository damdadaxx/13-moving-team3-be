import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { BadRequestError } from '../utils/error';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const CUSTOMER_UPLOAD_DIR = path.join(UPLOAD_DIR, 'customer');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

fs.mkdirSync(CUSTOMER_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CUSTOMER_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] ?? '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

// 배포 전 로컬 디스크. S3로 바꿀 때는 storage만 교체하면 된다.
export const uploadProfileImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new BadRequestError('이미지 파일만 업로드할 수 있습니다.'));
      return;
    }
    cb(null, true);
  },
}).single('image');

export const toPublicUploadPath = (file: Express.Multer.File) =>
  `/uploads/customer/${file.filename}`;

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
