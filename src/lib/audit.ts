import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface AuditLogParams {
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId?: string;
  beforeJson?: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/**
 * Record an append-only audit trail entry.
 * Safe to call without breaking parent business logic if logging fails.
 */
export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  try {
    let resolvedActorProfileId: string | null = null;
    if (params.actorId) {
      const profile = await prisma.userProfile.findFirst({
        where: {
          OR: [
            { id: params.actorId },
            { userId: params.actorId },
          ],
        },
        select: { id: true },
      });
      if (profile) {
        resolvedActorProfileId = profile.id;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: resolvedActorProfileId,
        actorName: params.actorName,
        actorEmail: params.actorEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        beforeJson: params.beforeJson,
        afterJson: params.afterJson,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    // Non-blocking log to ensure audit failures are alerted without crashing main flow
    console.error('[AuditLog] Failed to record audit log:', error, params);
  }
}
