import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { verifyObjectExists } from '@/lib/storage/r2';
import { recordAuditLog } from '@/lib/audit';
import { UploadStatus, UserRole } from '@prisma/client';
import crypto from 'crypto';
import { z } from 'zod';

const verifySchema = z.object({
  assignmentId: z.string().min(1, 'Assignment ID required'),
  objectKey: z.string().min(1, 'Object key required'),
  filename: z.string().min(1, 'Filename required'),
  fileSize: z.number().min(0),
  mimeType: z.string().min(1),
  sha256: z.string().optional(),
  fileCategory: z.enum(['REPORT', 'EVIDENCE']),
  versionNumber: z.number().int().positive().optional(),
  evidenceCategory: z.string().optional(),
  evidenceDescription: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid verification payload' },
        { status: 400 }
      );
    }

    const {
      assignmentId,
      objectKey,
      filename,
      fileSize,
      mimeType,
      sha256 = crypto.createHash('sha256').update(objectKey).digest('hex'),
      fileCategory,
      versionNumber = 1,
      evidenceCategory = 'General Research Evidence',
      evidenceDescription,
    } = parsed.data;

    // Verify object in private R2
    const check = await verifyObjectExists(objectKey);
    if (!check.exists) {
      return NextResponse.json(
        { error: 'Verification failed: Uploaded object not detected in private storage.' },
        { status: 404 }
      );
    }

    const verifiedSize = check.size || fileSize;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { group: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    let resultRecord: any;

    if (fileCategory === 'REPORT') {
      // 1. Upsert ResearchReport root container
      let report = await prisma.researchReport.findFirst({
        where: { assignmentId },
      });

      if (!report) {
        report = await prisma.researchReport.create({
          data: {
            assignmentId,
            groupId: assignment.groupId,
            latestVersionNumber: versionNumber,
          },
        });
      } else {
        await prisma.researchReport.update({
          where: { id: report.id },
          data: {
            latestVersionNumber: Math.max(report.latestVersionNumber, versionNumber),
          },
        });
      }

      // 2. Create ReportVersion
      resultRecord = await prisma.reportVersion.create({
        data: {
          reportId: report.id,
          versionNumber,
          filename,
          fileSize: verifiedSize,
          mimeType,
          r2ObjectKey: objectKey,
          sha256,
          uploaderId: caller.id,
          uploadStatus: UploadStatus.VERIFIED,
          submittedAt: new Date(),
        },
      });

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'FINAL_REPORT_UPLOADED',
        targetType: 'REPORT_VERSION',
        targetId: resultRecord.id,
        afterJson: {
          assignmentId,
          versionNumber,
          filename,
          fileSize: verifiedSize,
          objectKey,
        },
      });
    } else {
      // Create SupportingEvidence record
      resultRecord = await prisma.supportingEvidence.create({
        data: {
          assignmentId,
          groupId: assignment.groupId,
          filename,
          category: evidenceCategory,
          fileSize: verifiedSize,
          mimeType,
          r2ObjectKey: objectKey,
          sha256,
          description: evidenceDescription,
          uploaderId: caller.id,
          uploadStatus: UploadStatus.VERIFIED,
        },
      });

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'SUPPORTING_EVIDENCE_UPLOADED',
        targetType: 'SUPPORTING_EVIDENCE',
        targetId: resultRecord.id,
        afterJson: {
          assignmentId,
          category: evidenceCategory,
          filename,
          fileSize: verifiedSize,
          objectKey,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `${fileCategory === 'REPORT' ? 'Research report' : 'Supporting evidence'} verified and archived in private storage.`,
      record: resultRecord,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Upload Verify POST] Error:', error);
    return NextResponse.json({ error: 'Failed to verify uploaded object' }, { status: 500 });
  }
}
