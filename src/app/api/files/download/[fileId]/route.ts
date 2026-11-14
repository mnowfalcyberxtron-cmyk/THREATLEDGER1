import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getPresignedDownloadUrl } from '@/lib/storage/r2';
import { UserRole } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { fileId } = await params;

    // Search ReportVersion first
    let objectKey: string | null = null;
    let filename: string | null = null;
    let fileType: string = 'REPORT';

    const reportVersion = await prisma.reportVersion.findUnique({
      where: { id: fileId },
      include: { report: { include: { assignment: true } } },
    });

    if (reportVersion) {
      objectKey = reportVersion.r2ObjectKey;
      filename = reportVersion.filename;
      fileType = 'REPORT';

      // Authorization guard: Analysts can only download reports for their assigned or reviewed tasks
      if (
        caller.role === UserRole.ANALYST &&
        reportVersion.report.assignment.primaryAnalystId !== caller.id &&
        reportVersion.report.assignment.reviewerId !== caller.id
      ) {
        return NextResponse.json({ error: 'Unauthorized to download this research report' }, { status: 403 });
      }
    } else {
      // Search SupportingEvidence
      const evidence = await prisma.supportingEvidence.findUnique({
        where: { id: fileId },
        include: { assignment: true },
      });

      if (evidence) {
        objectKey = evidence.r2ObjectKey;
        filename = evidence.filename;
        fileType = 'EVIDENCE';

        if (
          caller.role === UserRole.ANALYST &&
          evidence.assignment.primaryAnalystId !== caller.id &&
          evidence.assignment.reviewerId !== caller.id
        ) {
          return NextResponse.json({ error: 'Unauthorized to download this evidence file' }, { status: 403 });
        }
      }
    }

    if (!objectKey) {
      return NextResponse.json({ error: 'File record not found' }, { status: 404 });
    }

    // Generate short-lived presigned download URL (15 minutes TTL)
    const presignedDownloadUrl = await getPresignedDownloadUrl(objectKey, 900);

    // Record download audit event
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    await prisma.fileDownloadEvent.create({
      data: {
        fileType,
        fileId,
        userId: caller.id,
        ipAddress: ip,
      },
    });

    return NextResponse.json({
      success: true,
      filename,
      downloadUrl: presignedDownloadUrl,
      expiresIn: 900,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[File Download GET] Error:', error);
    return NextResponse.json({ error: 'Failed to authorize download' }, { status: 500 });
  }
}
