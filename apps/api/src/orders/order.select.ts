import { Prisma } from '@prisma/client';

export const orderDetailInclude = Prisma.validator<Prisma.OrderInclude>()({
  customer: true,
  tenant: { select: { businessName: true, phone: true, address: true } },
  items: { orderBy: { position: 'asc' }, include: { photos: { select: { id: true, category: true, contentType: true, sizeBytes: true, createdAt: true } } } },
  statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, displayName: true } } } },
  payments: { orderBy: { occurredAt: 'asc' }, include: { createdBy: { select: { id: true, displayName: true } } } },
  activities: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, displayName: true } } } },
  createdBy: { select: { id: true, displayName: true } },
});
