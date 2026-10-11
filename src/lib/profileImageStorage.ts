import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from '../config/env';
import { BadRequestError } from '../utils/error';
import { s3Client } from './s3';

type ProfileImageOwner = 'customers' | 'movers';

interface ImageTypeConfig {
  contentType: string;
  extension: string;
  matches: (buffer: Buffer) => boolean;
}

export interface StoredProfileImage {
  key: string;
  url: string;
}

/*
@ 실제 파일 형식 검사

- 브라우저가 보내는 Content-Type만 믿으면 이미지가 아닌 파일도 확장자만 바꿔
  업로드할 수 있습니다.
- 파일 시작 부분의 고유한 바이트(signature)까지 확인하여 JPEG/PNG/WEBP만
  S3에 저장합니다.
*/
const IMAGE_TYPE_CONFIGS: ImageTypeConfig[] = [
  {
    contentType: 'image/jpeg',
    extension: 'jpg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    contentType: 'image/png',
    extension: 'png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    contentType: 'image/webp',
    extension: 'webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

const getVerifiedImageType = (file: Express.Multer.File) => {
  const imageType = IMAGE_TYPE_CONFIGS.find(
    (config) =>
      config.contentType === file.mimetype && config.matches(file.buffer)
  );

  if (!imageType) {
    throw new BadRequestError(
      '파일 내용이 올바른 JPEG, PNG, WEBP 이미지가 아닙니다.'
    );
  }

  return imageType;
};

/*=================================================
프로필 이미지 S3 저장
=================================================*/

/*
@ uploadProfileImage

- Multer memoryStorage가 만든 Buffer를 비공개 S3 버킷에 저장합니다.
- 고객과 기사님 경로를 나누면 AWS 콘솔에서 파일 용도를 쉽게 구분할 수 있습니다.
- UUID 파일명을 사용하므로 같은 이름의 이미지를 올려도 기존 파일을 덮어쓰지
  않습니다. 따라서 CloudFront 캐시에도 이전 이미지가 섞이지 않습니다.
- ACL을 지정하지 않습니다. S3 직접 공개는 막고 CloudFront OAC만 읽게 합니다.
*/
export const uploadProfileImage = async (
  file: Express.Multer.File,
  owner: ProfileImageOwner
): Promise<StoredProfileImage> => {
  const imageType = getVerifiedImageType(file);
  const key = `profiles/${owner}/${randomUUID()}.${imageType.extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: ENV.S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: imageType.contentType,
      // 파일명이 매번 바뀌므로 장기 캐시해도 교체된 이미지와 충돌하지 않습니다.
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    key,
    // DB에는 S3 주소가 아니라 사용자가 열 수 있는 CloudFront 주소를 저장합니다.
    url: `${ENV.CLOUDFRONT_BASE_URL}/${key}`,
  };
};

/*
@ deleteProfileImageByKey

- S3 업로드 뒤 DB 저장이 실패했을 때 새 파일을 되돌리는 용도입니다.
- DB에 URL이 기록되기 전이므로 업로드 당시 만든 정확한 key를 사용합니다.
*/
export const deleteProfileImageByKey = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: ENV.S3_BUCKET_NAME,
      Key: key,
    })
  );
};

/*
@ getManagedProfileImageKey

- DB에는 예전 로컬 URL이나 seed의 외부 URL도 남아 있을 수 있습니다.
- 현재 CloudFront 도메인이면서 profiles/customers 또는 profiles/movers 경로인
  URL만 우리 S3 객체로 판단합니다. 외부 파일을 실수로 삭제하지 않습니다.
*/
const getManagedProfileImageKey = (imageUrl: string): string | null => {
  let url: URL;

  try {
    url = new URL(imageUrl);
  } catch {
    return null;
  }

  if (url.origin !== ENV.CLOUDFRONT_BASE_URL) {
    return null;
  }

  const key = url.pathname.replace(/^\/+/, '');
  const isManagedKey =
    key.startsWith('profiles/customers/') || key.startsWith('profiles/movers/');

  return isManagedKey ? key : null;
};

/*
@ deleteProfileImageByUrl

- 프로필 교체 또는 삭제가 DB에 성공한 뒤 이전 S3 객체를 정리합니다.
- 관리 대상이 아닌 로컬/외부 URL이면 아무 작업도 하지 않습니다.
*/
export const deleteProfileImageByUrl = async (
  imageUrl: string | null
): Promise<void> => {
  if (!imageUrl) {
    return;
  }

  const key = getManagedProfileImageKey(imageUrl);
  if (!key) {
    return;
  }

  await deleteProfileImageByKey(key);
};
