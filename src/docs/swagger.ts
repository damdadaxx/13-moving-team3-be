/**
 * 도메인 공통으로 쓰는 Swagger 스키마입니다.
 * 도메인별 문서는 src/docs/{domain}.route.ts에 나눠서 작성합니다 (예: estimate.route.ts).
 *
 * @openapi
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             code:
 *               type: string
 *               example: NOT_FOUND
 *             message:
 *               type: string
 *               example: 요청한 데이터를 찾을 수 없습니다.
 *             fields:
 *               type: array
 *               description: Zod 검증 실패(code가 VALIDATION_ERROR)일 때만 내려옵니다.
 *               items:
 *                 type: object
 *                 properties:
 *                   field:
 *                     type: string
 *                     example: status
 *                   message:
 *                     type: string
 *                     example: status 값이 올바르지 않습니다.
 */
