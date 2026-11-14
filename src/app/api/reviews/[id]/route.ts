import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { dispatchReviewVerdictNotification } from '@/lib/email/mailer';
import { AssignmentStatus, ReviewStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

const reviewDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REQUEST_CHANGES', 'REJECT', 'REOPEN']),
  comments: z.string().optional(),
  approvedVersionNumber: z.number().int().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = reviewDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid review payload' },
        { status: 400 }
      );
    }

    const { action, comments, approvedVersionNumber } = parsed.data;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        primaryAnalyst: true,
        reviewer: true,
        group: true,
        reports: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // SECTION 35 & 34: Strict decoupling of submitter and approver
    if (caller.id === assignment.primaryAnalystId && caller.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Governance violation: Analysts are strictly forbidden from approving their own work.' },
        { status: 403 }
      );
    }

    const latestVersion = assignment.reports[0]?.versions[0];
    const finalVersionToApprove = approvedVersionNumber || latestVersion?.versionNumber || 1;

    let targetAssignmentStatus: AssignmentStatus;
    let targetReviewStatus: ReviewStatus;

    if (action === 'APPROVE') {
      targetAssignmentStatus = AssignmentStatus.APPROVED_COMPLETED;
      targetReviewStatus = ReviewStatus.APPROVED;
    } else if (action === 'REQUEST_CHANGES') {
      if (!comments || comments.trim().length === 0) {
        return NextResponse.json({ error: 'Comments are mandatory when requesting changes' }, { status: 400 });
      }
      targetAssignmentStatus = AssignmentStatus.CHANGES_REQUESTED;
      targetReviewStatus = ReviewStatus.CHANGES_REQUESTED;
    } else if (action === 'REJECT') {
      if (!comments || comments.trim().length === 0) {
        return NextResponse.json({ error: 'A formal reason is required to reject an assignment' }, { status: 400 });
      }
      targetAssignmentStatus = AssignmentStatus.REJECTED;
      targetReviewStatus = ReviewStatus.REJECTED;
    } else {
      // REOPEN
      targetAssignmentStatus = AssignmentStatus.IN_PROGRESS;
      targetReviewStatus = ReviewStatus.PENDING_REVIEW;
    }

    // Atomic transaction for decision and version updates
    const updated = await prisma.$transaction(async (tx) => {
      // Update ReportVersion if exists
      if (latestVersion) {
        await tx.reportVersion.update({
          where: { id: latestVersion.id },
          data: {
            reviewStatus: targetReviewStatus,
            reviewerComments: comments || undefined,
          },
        });
      }

      // Update Assignment with separate review/approval metadata
      const assignmentUpdateData: any = {
        status: targetAssignmentStatus,
        reviewedAt: new Date(),
        reviewedById: caller.id,
      };

      if (action === 'APPROVE') {
        assignmentUpdateData.approvedAt = new Date();
        assignmentUpdateData.approvedById = caller.id;
        assignmentUpdateData.approvedVersionNumber = finalVersionToApprove;
      } else if (action === 'REQUEST_CHANGES' || action === 'REJECT') {
        assignmentUpdateData.rejectionReason = comments;
      }

      const res = await tx.assignment.update({
        where: { id: assignmentId },
        data: assignmentUpdateData,
      });

      // Log event
      await tx.assignmentEvent.create({
        data: {
          assignmentId,
          actorId: caller.id,
          eventType: `REVIEW_DECISION_${action}`,
          oldStatus: assignment.status,
          newStatus: targetAssignmentStatus,
          reason: comments || `Decision: ${action} by reviewer ${caller.fullName}`,
        },
      });

      return res;
    });

    // Notify analyst of review decision
    if (action === 'APPROVE' || action === 'REQUEST_CHANGES' || action === 'REJECT') {
      dispatchReviewVerdictNotification(
        assignmentId,
        action as 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
        comments
      ).catch((e) => console.error('[Review Verdict Mailer Error]:', e));
    }

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: `REVIEW_DECISION_${action}`,
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      beforeJson: { oldStatus: assignment.status },
      afterJson: {
        newStatus: targetAssignmentStatus,
        action,
        comments,
        approvedVersionNumber: finalVersionToApprove,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Review decision "${action}" recorded successfully.`,
      assignment: updated,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Review Decision POST] Error:', error);
    return NextResponse.json({ error: 'Failed to record review decision' }, { status: 500 });
  }
}
