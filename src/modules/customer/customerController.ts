import { Request, Response } from 'express';
import { getUserId } from '../../utils/authUser';
import { customerService } from './customerService';
import { UpsertProfileInput } from './customerValidation';

const getValidated = <T>(req: Request) => req.validatedData as T;

export const customerController = {
  createProfile: async (req: Request, res: Response) => {
    const input = getValidated<UpsertProfileInput>(req);
    const profile = await customerService.create(
      getUserId(req),
      input,
      req.file
    );
    res.status(201).json({ success: true, data: profile });
  },

  getProfile: async (req: Request, res: Response) => {
    const profile = await customerService.get(getUserId(req));
    res.status(200).json({ success: true, data: profile });
  },

  updateProfile: async (req: Request, res: Response) => {
    const input = getValidated<UpsertProfileInput>(req);
    const profile = await customerService.update(
      getUserId(req),
      input,
      req.file
    );
    res.status(200).json({ success: true, data: profile });
  },
};
