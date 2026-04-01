import { prisma } from "@/lib/prisma";
import { TRANSACTION_TYPE } from "@/lib/constants";

/**
 * Atomically deduct credits from an organization and write an audit Transaction row.
 * Returns the new balance, or `null` if insufficient credits.
 */
export async function deductOrgCredits(
  orgId: string,
  userId: string,
  cost: number,
  description: string,
): Promise<number | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
        select: { credits: true },
      });

      await tx.transaction.create({
        data: {
          organizationId: orgId,
          userId,
          type: TRANSACTION_TYPE.GENERATION_DEDUCT,
          credits: -cost,
          balanceAfter: updated.credits,
          description,
        },
      });

      return updated.credits;
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return null;
    throw e;
  }
}

/**
 * Atomically refund credits to an organization and write an audit Transaction row.
 * Returns the new balance.
 */
export async function refundOrgCredits(
  orgId: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.organization.update({
      where: { id: orgId },
      data: { credits: { increment: amount } },
      select: { credits: true },
    });

    await tx.transaction.create({
      data: {
        organizationId: orgId,
        userId,
        type: TRANSACTION_TYPE.GENERATION_REFUND,
        credits: amount,
        balanceAfter: updated.credits,
        description: reason,
      },
    });

    return updated.credits;
  });
}
