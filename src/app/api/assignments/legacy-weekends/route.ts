import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import {
  isWeekendInIST,
  validateWorkingDayDeadline,
  parseISTCalendarDateToEndOfDay,
} from '@/lib/datetime/working-days';
import { rescheduleAssignmentReminders } from '@/lib/services/reminder-engine';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ADMIN);

    const allWithDue = await prisma.assignment.findMany({
      where: {
        dueDate: { not: null },
      },
      include: {
        group: { select: { name: true } },
        primaryAnalyst: { select: { fullName: true } },
        deadlineHistory: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter assignments that fall on weekend in Asia/Kolkata or are explicitly flagged
    const legacyWeekendAssignments = allWithDue.filter(
      (a) => a.isLegacyWeekendDeadline || (a.dueDate && isWeekendInIST(a.dueDate))
    );

    return NextResponse.json({
      totalCount: legacyWeekendAssignments.length,
      assignments: legacyWeekendAssignments,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Legacy Weekends GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve legacy weekend deadlines' }, { status: 500 });
  }
}

const resolveLegacySchema = z.object({
  assignmentId: z.string().min(1),
  replacementDueDate: z.string().min(1),
  reason: z.string().min(3, 'Detailed operational reason is required'),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = resolveLegacySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid migration payload' },
        { status: 400 }
      );
    }

    const { assignmentId, replacementDueDate, reason } = parsed.data;

    // Validate that the replacement is strictly a weekday
    const check = validateWorkingDayDeadline(replacementDueDate);
    if (!check.valid) {
      return NextResponse.json(
        {
          error: `Replacement deadline rejected: ${check.error}. Legacy weekend deadlines must be resolved to a valid Monday–Friday working day.`,
        },
        { status: 400 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { group: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const finalDueDate = parseISTCalendarDateToEndOfDay(check.dateString!);
    const newVersion = assignment.deadlineVersion + 1;

    await prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          dueDate: finalDueDate,
          deadlineVersion: newVersion,
          isLegacyWeekendDeadline: false,
        },
      });

      await tx.assignmentDeadlineHistory.create({
        data: {
          assignmentId,
          oldDueDate: assignment.dueDate,
          newDueDate: finalDueDate,
          changedById: caller.profileId || caller.id,
          reason: `[Legacy Weekend Migration] ${reason}`,
        },
      });

      await tx.assignmentEvent.create({
        data: {
          assignmentId,
          actorId: caller.id,
          eventType: 'LEGACY_WEEKEND_DEADLINE_RESOLVED',
          oldStatus: assignment.status,
          newStatus: assignment.status,
          reason: `Legacy weekend deadline resolved to ${check.dateString} by administrator ${caller.fullName}: ${reason}`,
        },
      });
    });

    await rescheduleAssignmentReminders({
      assignmentId,
      dueDate: finalDueDate,
      newDeadlineVersion: newVersion,
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'LEGACY_WEEKEND_DEADLINE_RESOLVED',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      beforeJson: { oldDueDate: assignment.dueDate },
      afterJson: { replacementDueDate: finalDueDate, reason },
    });

    return NextResponse.json({
      success: true,
      message: `Legacy weekend deadline for ${assignment.group.name} successfully resolved to working day ${check.dateString}.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Legacy Weekends POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve legacy deadline' }, { status: 500 });
  }
}
