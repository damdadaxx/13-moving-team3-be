import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';

/*=================================================
기사님 프로필 이미지 로컬 저장 설정
=================================================*/

const MOVER_IMAGE_DIRECTORY = path.resolve(process.cwd(), 'uploads', 'movers');

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/*=================================================
기사님 프로필 이미지 저장
=================================================*/

/*
@ saveMoverImage

- Multer의 memoryStorage에 보관된 Buffer를 로컬 파일로 저장합니다.
- DB에는 실제 로컬 경로가 아니라 외부에서 접근할 URL을 저장합니다.

@ 반환값 예시
- /uploads/movers/550e8400-e29b-41d4-a716.webp

@ 추후 S3 전환
- S3에 Buffer를 업로드하고 S3 URL을 반환하도록
  이 함수 내부만 교체할 수 있습니다.
*/
export const saveMoverImage = async (
  file: Express.Multer.File
): Promise<string> => {
  const extension = IMAGE_EXTENSION_BY_MIME_TYPE[file.mimetype];

  const fileName = `${randomUUID()}.${extension}`;
  const filePath = path.join(MOVER_IMAGE_DIRECTORY, fileName);

  await mkdir(MOVER_IMAGE_DIRECTORY, {
    recursive: true,
  });

  await writeFile(filePath, file.buffer);

  return `/uploads/movers/${fileName}`;
};

/*=================================================
기사님 프로필 이미지 삭제
=================================================*/

/*
@ deleteMoverImage

- 프로필 이미지 교체 또는 삭제 시 기존 로컬 파일을 제거합니다.
- seed의 외부 이미지 URL과 추후 S3 URL은 삭제하지 않습니다.

@ 주의사항
- /uploads/movers/로 시작하는 로컬 이미지만 삭제합니다.
*/
export const deleteMoverImage = async (
  imageUrl: string | null
): Promise<void> => {
  if (!imageUrl || !imageUrl.startsWith('/uploads/movers/')) {
    return;
  }

  const fileName = path.basename(imageUrl);
  const filePath = path.join(MOVER_IMAGE_DIRECTORY, fileName);

  try {
    await unlink(filePath);
  } catch (error: unknown) {
    /*
    @ ENOENT

    - 이미 파일이 없는 경우에는 삭제가 완료된 것으로 처리합니다.
    */
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
};
