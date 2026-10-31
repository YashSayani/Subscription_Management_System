import { prisma, Prisma } from '@brightloop/database';
import { AuditQueryInput } from './schema.js';

export const listAuditLogs = async (query: AuditQueryInput) => {
  const skip = (query.page - 1) * query.limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (query.entityType) {
    where.entityType = query.entityType;
  }

  if (query.entityId) {
    where.entityId = query.entityId;
  }

  if (query.action) {
    where.action = query.action;
  }

  if (query.actorId) {
    where.actorId = query.actorId;
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate && { gte: new Date(query.startDate) }),
      ...(query.endDate && { lte: new Date(query.endDate) }),
    };
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actor: log.actor,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      ipAddress: log.ipAddress,
      oldValues: log.oldValues,
      newValues: log.newValues,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};
