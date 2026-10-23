import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import aiController from './aiController';

const router = Router();

/*
@ GET /ai/usage

- 로그인한 사용자의 오늘 남은 AI 사용 횟수를 조회합니다.
- 화면에 "오늘 남은 횟수 3/5"를 보여 주는 데 씁니다.
*/
router.get('/usage', authenticate, aiController.getUsage);

export default router;
