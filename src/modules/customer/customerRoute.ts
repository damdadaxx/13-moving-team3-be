import { Router } from 'express';
import { authenticate, requireCustomer } from '../../middlewares/authenticate';
import { uploadProfileImage } from '../../middlewares/upload';
import { validate } from '../../middlewares/validation';
import { customerController } from './customerController';
import { upsertProfileSchema } from './customerValidation';

const router = Router();

router.post(
  '/profile',
  authenticate,
  requireCustomer,
  uploadProfileImage,
  validate(upsertProfileSchema),
  customerController.createProfile
);

router.get(
  '/profile',
  authenticate,
  requireCustomer,
  customerController.getProfile
);

router.patch(
  '/profile',
  authenticate,
  requireCustomer,
  uploadProfileImage,
  validate(upsertProfileSchema),
  customerController.updateProfile
);

export default router;
