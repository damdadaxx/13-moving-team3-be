import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import * as estimateService from './estimateService';
import { GetEstimatesQueryDto } from './estimateDto';

export const getEstimates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) throw new UnauthorizedError();

    const query = req.validatedData as GetEstimatesQueryDto;
    const result = await estimateService.getEstimates(
      req.user.id,
      req.user.role,
      query
    );

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    next(error);
  }
};
