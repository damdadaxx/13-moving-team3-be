import { prisma } from '../../lib/prisma';

export const findByIdWithDetail = (id: string) => {
  return prisma.estimate.findUnique({
    where: { id },
    include: {
      mover: {
        select: {
          userId: true,
          nickname: true,
          imgUrl: true,
          careerMonths: true,
        },
      },
      estimateRequest: {
        include: {
          customer: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });
};
