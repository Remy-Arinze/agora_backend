import { Prisma } from '@prisma/client';

/** Enrollments that count toward caps and can participate in teaching/learning flows. */
export const operationalEnrollmentWhere: Prisma.EnrollmentWhereInput = {
  isActive: true,
  billingLocked: false,
};
