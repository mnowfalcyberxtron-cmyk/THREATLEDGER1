import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { retryReportSubmissionEmail } from '@/lib/services/report-submission-service';
import { deleteTemporaryFiles } from '@/lib/storage/temp-storage';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ADMIN);

    const [submissions, outbox] = await Promise.all([
      prisma.reportSubmission.findMany({
        take: 20,
        orderBy: { submittedAt: 'desc' },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              group: { select: { name: true } },
            },
          },
          submittedBy: {
            select: { fullName: true },
          },
          attachments: {
            select: { id: true, filename: true, fileSize: true, fileCategory: true, sha256: true, isCleanedUp: true },
          },
        },
      }),
      prisma.emailOutbox.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      submissions,
      outbox,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Email Activity GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve email activity' }, { status: 500 });
  }
}

const retrySchema = z.object({
  action: z.enum(['RETRY_SUBMISSION', 'RETRY_CLEANUP']),
  submissionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = retrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid retry payload' },
        { status: 400 }
      );
    }

    const { action, submissionId } = parsed.data;

    if (action === 'RETRY_SUBMISSION') {
      const res = await retryReportSubmissionEmail(submissionId, caller.id);

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'REPORT_SUBMISSION_MANUAL_RETRY',
        targetType: 'REPORT_SUBMISSION',
        targetId: submissionId,
        afterJson: { res },
      });

      return NextResponse.json({
        success: true,
        message: 'Report submission email retried and delivered successfully to Gmail archive.',
        result: res,
      });
    }

    if (action === 'RETRY_CLEANUP') {
      const submission = await prisma.reportSubmission.findUnique({
        where: { id: submissionId },
        include: { attachments: true },
      });

      if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }

      if (submission.emailStatus !== 'ACCEPTED_BY_GMAIL') {
        return NextResponse.json(
          { error: 'Cannot clean up temporary files: The email has not been confirmed as sent.' },
          { status: 400 }
        );
      }

      const paths = submission.attachments.map((a) => a.tempStoragePath!).filter(Boolean);
      const cleanupResult = await deleteTemporaryFiles(paths);

      if (cleanupResult.allSucceeded) {
        await prisma.reportSubmission.update({
          where: { id: submissionId },
          data: {
            cleanupStatus: 'CLEANED',
            cleanedAt: new Date(),
            cleanupErrorMessage: null,
          },
        });
        await prisma.submissionAttachment.updateMany({
          where: { submissionId },
          data: { isCleanedUp: true, tempStoragePath: null },
        });

        await recordAuditLog({
          actorId: caller.id,
          actorName: caller.fullName,
          actorEmail: caller.email,
          action: 'TEMPORARY_CLEANUP_MANUAL_RETRY_SUCCESS',
          targetType: 'REPORT_SUBMISSION',
          targetId: submissionId,
        });

        return NextResponse.json({
          success: true,
          message: 'Temporary staged files removed successfully.',
        });
      } else {
        return NextResponse.json(
          { error: `Cleanup partially failed for paths: ${cleanupResult.failedPaths.join(', ')}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Email Activity POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
