import prisma from '../lib/prisma';

export async function checkConflict(
  resourceId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string,
  quantity: number = 1,
  capacity: number = 1
): Promise<boolean> {
  const overlapWhere = {
    resourceId,
    status: 'CONFIRMED' as const,
    id: excludeBookingId ? { not: excludeBookingId } : undefined,
    AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
  };

  if (capacity > 1) {
    // Shared capacity resource: sum existing quantities
    const bookings = await prisma.booking.findMany({
      where: overlapWhere,
      select: { quantity: true },
    });
    const usedQty = bookings.reduce((sum, b) => sum + b.quantity, 0);
    return usedQty + quantity > capacity;
  }

  // Single-capacity resource: any booking = conflict
  const conflict = await prisma.booking.findFirst({ where: overlapWhere });
  return !!conflict;
}
