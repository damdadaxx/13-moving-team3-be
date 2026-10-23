/**
 * AI 기능(기사님 AI 검색 · 리뷰 초안) 공용 Swagger 문서입니다.
 *
 * @openapi
 * tags:
 *   - name: AI
 *     description: Gemini 기반 기능의 사용량 조회
 *
 * components:
 *   schemas:
 *     AiUsage:
 *       type: object
 *       description: 오늘 남은 사용 횟수. 한국시간 자정에 초기화됩니다. 실패한 요청은 차감하지 않습니다.
 *       properties:
 *         limit:
 *           type: integer
 *           example: 5
 *         remaining:
 *           type: integer
 *           example: 3
 *         resetAt:
 *           type: string
 *           format: date-time
 *           description: 다음 초기화 시각 (다음 한국시간 자정, UTC 표기)
 *           example: 2026-10-21T15:00:00.000Z
 *
 * /ai/usage:
 *   get:
 *     tags: [AI]
 *     summary: 오늘 남은 AI 사용 횟수 조회
 *     description: 조회만 하며 횟수를 차감하지 않습니다.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     moverSearch:
 *                       $ref: '#/components/schemas/AiUsage'
 *                     reviewDraft:
 *                       $ref: '#/components/schemas/AiUsage'
 *       401:
 *         description: 인증 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
