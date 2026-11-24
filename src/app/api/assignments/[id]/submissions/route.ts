import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { executeReportSubmission } from '@/lib/services/report-submission-service';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id: assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        reportSubmissions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            submittedBy: {
              select: { id: true, fullName: true, role: true },
            },
            attachments: {
              select: {
                id: true,
                filename: true,
                fileSize: true,
                mimeType: true,
                sha256: true,
                fileCategory: true,
                isCleanedUp: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (
      caller.role === UserRole.ANALYST &&
      assignment.primaryAnalystId !== caller.id &&
      assignment.reviewerId !== caller.id
    ) {
      return NextResponse.json({ error: 'Unauthorized to view assignment submissions' }, { status: 403 });
    }

    return NextResponse.json({
      submissions: assignment.reportSubmissions,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Submissions GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve submissions' }, { status: 500 });
  }
}

const submitSchema = z.object({
  stagedFiles: z.array(
    z.object({
      filename: z.string().min(1),
      fileSize: z.number().min(0, 'File size cannot be negative'),
      mimeType: z.string().min(1),
      sha256: z.string().min(1),
      storagePath: z.string().min(1),
      fileCategory: z.enum(['REPORT', 'EVIDENCE']),
    })
  ).min(1, 'At least one file must be submitted.'),
  submissionNotes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid submission payload' },
        { status: 400 }
      );
    }

    const { stagedFiles, submissionNotes } = parsed.data;

    const result = await executeReportSubmission({
      assignmentId,
      callerId: caller.profileId || caller.id,
      callerRole: caller.role,
      callerName: caller.fullName,
      callerEmail: caller.email,
      stagedFiles,
      submissionNotes,
    });

    return NextResponse.json({
      success: true,
      message: `Report v${result.versionNumber} successfully submitted to ${result.recipientEmail} and archived in Gmail Sent folder.`,
      result,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Submissions POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 400 });
  }
}
