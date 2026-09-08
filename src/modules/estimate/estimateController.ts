import { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/error';
import { estimateService } from './estimateService';
import type {
  GetEstimateDetailParamsDto,
  GetEstimatesQueryDto,
} from './estimateSchema';

export const estimateController = {
  getEstimates: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const query = req.validatedData as GetEstimatesQueryDto;
    const result = await estimateService.getEstimates(
      req.auth.sub,
      req.auth.role,
      query
    );

    res.status(200).json({ success: true, data: result });
  },

  updateEstimateStatus: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as GetEstimateDetailParamsDto;
    const result = await estimateService.updateEstimateStatus(
      req.auth.sub,
      req.auth.role,
      estimateId,
      req.body
    );

    res.status(200).json({ success: true, data: result });
  },

  getEstimateDetail: async (req: Request, res: Response) => {
    if (!req.auth?.sub) throw new UnauthorizedError();

    const { estimateId } = req.validatedData as GetEstimateDetailParamsDto;
    const result = await estimateService.getEstimateDetail(
      req.auth.sub,
      req.auth.role,
      estimateId
    );

    res.status(200).json({ success: true, data: result });
  },
};
