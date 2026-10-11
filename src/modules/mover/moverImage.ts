import { unlink } from 'node:fs/promises';
import path from 'node:path';

/*=================================================
기사님 프로필 이미지 레거시 로컬 저장소
=================================================*/

const MOVER_IMAGE_DIRECTORY = path.resolve(process.cwd(), 'uploads', 'movers');

/*=================================================
기사님 레거시 로컬 이미지 삭제
=================================================*/

/*
@ deleteLegacyMoverImage

- S3 전환 전에 저장된 기사님 로컬 이미지를 교체 또는 삭제할 때 정리합니다.
- 새 CloudFront URL과 seed의 외부 이미지 URL은 삭제하지 않습니다.

@ 주의사항
- /uploads/movers/로 시작하는 로컬 이미지만 삭제합니다.
*/
export const deleteLegacyMoverImage = async (
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
