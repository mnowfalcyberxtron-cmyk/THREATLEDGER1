import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import {
  dispatchReportSubmittedNotification,
  dispatchReviewVerdictNotification,
} from '@/lib/email/mailer';
import { cancelTerminalReminders } from '@/lib/services/reminder-engine';
import { AssignmentStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

const statusTransitionSchema = z.object({
  status: z.enum([
    'ACCEPTED',
    'IN_PROGRESS',
    'ON_HOLD',
    'SUBMITTED_FOR_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED_COMPLETED',
    'REJECTED',
    'CANCELLED',
  ]),
  reason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = statusTransitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid status transition' },
        { status: 400 }
      );
    }

    const { status: targetStatus, reason } = parsed.data;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        primaryAnalyst: true,
        reviewer: true,
        group: { select: { name: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const isPrimaryAnalyst = assignment.primaryAnalystId === caller.id;
    const isReviewer = assignment.reviewerId === caller.id;
    const isAdmin = caller.role === UserRole.ADMIN || caller.role === UserRole.SUPER_ADMIN;

    // SECTION 35 & 34 STRICT ENFORCEMENT:
    // An analyst CANNOT approve their own work.
    if (targetStatus === 'APPROVED_COMPLETED') {
      if (isPrimaryAnalyst && !isAdmin) {
        return NextResponse.json(
          { error: 'Governance violation: Analysts are strictly forbidden from approving their own research.' },
          { status: 403 }
        );
      }
      if (!isReviewer && !isAdmin) {
        return NextResponse.json(
          { error: 'Only designated reviewers or administrators can approve research.' },
          { status: 403 }
        );
      }
    }

    // Changes Requested & Rejection require reviewer or admin authority
    if (targetStatus === 'CHANGES_REQUESTED' || targetStatus === 'REJECTED') {
      if (!isReviewer && !isAdmin) {
        return NextResponse.json(
          { error: 'Only the reviewer can request changes or reject a submission.' },
          { status: 403 }
        );
      }
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json(
          { error: 'Comments / feedback are mandatory when requesting changes or rejecting a submission.' },
          { status: 400 }
        );
      }
    }

    const oldStatus = assignment.status;
    const updateData: any = { status: targetStatus as AssignmentStatus };

    // Record lifecycle timestamps
    if (targetStatus === 'ACCEPTED' && !assignment.acceptedAt) {
      updateData.acceptedAt = new Date();
    } else if (targetStatus === 'SUBMITTED_FOR_REVIEW') {
      updateData.submittedAt = new Date();
      updateData.submittedById = caller.id;
    } else if (targetStatus === 'APPROVED_COMPLETED') {
      updateData.approvedAt = new Date();
      updateData.approvedById = caller.id;
      updateData.reviewedAt = new Date();
      updateData.reviewedById = caller.id;
    } else if (targetStatus === 'CHANGES_REQUESTED' || targetStatus === 'REJECTED') {
      updateData.reviewedAt = new Date();
      updateData.reviewedById = caller.id;
      updateData.rejectionReason = reason;
    }

    // Execute status transition and audit log atomically
    const updatedAssignment = await prisma.$transaction(async (tx) => {
      const res = await tx.assignment.update({
        where: { id: assignmentId },
        data: updateData,
      });

      await tx.assignmentEvent.create({
        data: {
          assignmentId,
          actorId: caller.id,
          eventType: `STATUS_CHANGE_TO_${targetStatus}`,
          oldStatus,
          newStatus: targetStatus as AssignmentStatus,
          reason: reason || `Status updated by ${caller.fullName}`,
        },
      });

      return res;
    });

    // Cancel pending reminders upon reaching terminal status (Section 8)
    if (targetStatus === 'APPROVED_COMPLETED' || targetStatus === 'CANCELLED') {
      cancelTerminalReminders(assignmentId).catch((e) =>
        console.error('[Cancel Reminders Error]:', e)
      );
    }

    // Dispatch operational notifications & Section 31 email with physical attachment
    if (targetStatus === 'SUBMITTED_FOR_REVIEW') {
      dispatchReportSubmittedNotification(assignmentId).catch((e) =>
        console.error('[Background Email Dispatch Error]:', e)
      );
    } else if (
      targetStatus === 'APPROVED_COMPLETED' ||
      targetStatus === 'CHANGES_REQUESTED' ||
      targetStatus === 'REJECTED'
    ) {
      const verdict =
        targetStatus === 'APPROVED_COMPLETED'
          ? 'APPROVED'
          : targetStatus === 'CHANGES_REQUESTED'
          ? 'CHANGES_REQUESTED'
          : 'REJECTED';
      dispatchReviewVerdictNotification(assignmentId, verdict, reason).catch((e) =>
        console.error('[Background Email Dispatch Error]:', e)
      );
    }

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: `ASSIGNMENT_STATUS_${targetStatus}`,
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      beforeJson: { oldStatus },
      afterJson: { newStatus: targetStatus, reason },
    });

    return NextResponse.json({
      success: true,
      message: `Assignment transitioned to ${targetStatus}`,
      assignment: updatedAssignment,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Assignment Status Transition POST] Error:', error);
    return NextResponse.json({ error: 'Failed to update assignment status' }, { status: 500 });
  }
}
