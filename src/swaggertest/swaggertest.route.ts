import { Router } from 'express';
import { BadRequestError, NotFoundError } from '../utils/error';

/**
 * Swagger 동작 확인용 예시 라우터입니다.
 * DB를 사용하지 않고 메모리 배열로만 동작하며, 문서 작성 패턴 참고용입니다.
 *
 * @openapi
 * components:
 *   schemas:
 *     Mover:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: 김기사
 *         serviceType:
 *           type: string
 *           enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *           example: SMALL_MOVE
 *     MoverCreate:
 *       type: object
 *       required: [name, serviceType]
 *       properties:
 *         name:
 *           type: string
 *           example: 박기사
 *         serviceType:
 *           type: string
 *           enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *           example: HOME_MOVE
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         path:
 *           type: string
 *           example: /swaggertest/movers/99
 *         method:
 *           type: string
 *           example: GET
 *         message:
 *           type: string
 *           example: 요청한 데이터를 찾을 수 없습니다.
 *         date:
 *           type: string
 *           format: date-time
 */

const router = Router();

interface Mover {
  id: number;
  name: string;
  serviceType: 'SMALL_MOVE' | 'HOME_MOVE' | 'OFFICE_MOVE';
}

const movers: Mover[] = [
  { id: 1, name: '김기사', serviceType: 'SMALL_MOVE' },
  { id: 2, name: '이기사', serviceType: 'HOME_MOVE' },
];

/**
 * @openapi
 * /swaggertest/movers:
 *   get:
 *     tags: [SwaggerTest]
 *     summary: 기사 목록 조회
 *     description: 쿼리 파라미터와 배열 응답을 문서화하는 예시입니다.
 *     parameters:
 *       - in: query
 *         name: serviceType
 *         required: false
 *         description: 서비스 유형으로 필터링
 *         schema:
 *           type: string
 *           enum: [SMALL_MOVE, HOME_MOVE, OFFICE_MOVE]
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Mover'
 */
router.get('/movers', (req, res) => {
  const { serviceType } = req.query;
  const result = serviceType
    ? movers.filter((m) => m.serviceType === serviceType)
    : movers;
  res.json(result);
});

/**
 * @openapi
 * /swaggertest/movers/{id}:
 *   get:
 *     tags: [SwaggerTest]
 *     summary: 기사 단건 조회
 *     description: 경로 파라미터와 404 에러 응답을 문서화하는 예시입니다. 없는 id를 넣으면 errorHandler가 응답합니다.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 기사 id
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mover'
 *       404:
 *         description: 해당 기사를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/movers/:id', (req, res) => {
  const mover = movers.find((m) => m.id === Number(req.params.id));
  if (!mover) throw new NotFoundError('해당 기사를 찾을 수 없습니다.');
  res.json(mover);
});

/**
 * @openapi
 * /swaggertest/movers:
 *   post:
 *     tags: [SwaggerTest]
 *     summary: 기사 등록
 *     description: requestBody와 인증(bearerAuth) 표기를 문서화하는 예시입니다.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MoverCreate'
 *     responses:
 *       201:
 *         description: 등록 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mover'
 *       400:
 *         description: 필수 값 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/movers', (req, res) => {
  const { name, serviceType } = req.body ?? {};
  if (!name || !serviceType)
    throw new BadRequestError('name과 serviceType은 필수입니다.');

  const created: Mover = { id: movers.length + 1, name, serviceType };
  movers.push(created);
  res.status(201).json(created);
});

export default router;
