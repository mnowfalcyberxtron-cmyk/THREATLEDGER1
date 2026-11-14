import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { generateR2ObjectKey, getPresignedUploadUrl } from '@/lib/storage/r2';
import { canUploadFile } from '@/lib/storage/quota';
import { UploadStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

const PERMITTED_REPORT_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.txt'];
const PERMITTED_EVIDENCE_EXTENSIONS = [
  ...PERMITTED_REPORT_EXTENSIONS,
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.json',
  '.zip',
];

const presignSchema = z.object({
  assignmentId: z.string().min(1, 'Assignment ID required'),
  filename: z.string().min(1, 'Filename required'),
  fileSize: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type required'),
  fileCategory: z.enum(['REPORT', 'EVIDENCE']),
  evidenceCategory: z.string().optional(),
  evidenceDescription: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const body = await req.json();
    const parsed = presignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid upload parameters' },
        { status: 400 }
      );
    }

    const {
      assignmentId,
      filename,
      fileSize,
      mimeType,
      fileCategory,
      evidenceCategory,
      evidenceDescription,
    } = parsed.data;

    // Check assignment access
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { group: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (
      caller.role === UserRole.ANALYST &&
      assignment.primaryAnalystId !== caller.id &&
      assignment.reviewerId !== caller.id
    ) {
      return NextResponse.json({ error: 'Unauthorized to upload files to this assignment' }, { status: 403 });
    }

    // Validate extension
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    const allowedExtensions =
      fileCategory === 'REPORT' ? PERMITTED_REPORT_EXTENSIONS : PERMITTED_EVIDENCE_EXTENSIONS;

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: `File format "${ext}" is not permitted for ${fileCategory.toLowerCase()}s.` },
        { status: 400 }
      );
    }

    // Size limit guard: 50MB for reports, 100MB for evidence
    const maxSizeBytes = fileCategory === 'REPORT' ? 50 * 1024 * 1024 : 100 * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return NextResponse.json(
        { error: `File exceeds maximum allowed limit of ${maxSizeBytes / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    // Storage Quota Enforcement (Phase 7 Hardening)
    const quotaCheck = await canUploadFile(fileSize);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: quotaCheck.reason || 'Storage quota exceeded' },
        { status: 429 }
      );
    }

    // Generate safe opaque object key
    const prefix = fileCategory === 'REPORT' ? 'reports' : 'evidence';
    const { fileId, objectKey, safeFilename } = generateR2ObjectKey(prefix, assignmentId, filename);

    // If report, determine next version number
    let nextVersionNumber = 1;
    if (fileCategory === 'REPORT') {
      const existingReport = await prisma.researchReport.findFirst({
        where: { assignmentId },
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      });
      if (existingReport && existingReport.versions[0]) {
        nextVersionNumber = existingReport.versions[0].versionNumber + 1;
      }
    }

    // Generate short-lived presigned upload URL
    const presignedUploadUrl = await getPresignedUploadUrl(objectKey, mimeType, 900);

    return NextResponse.json({
      success: true,
      fileId,
      objectKey,
      safeFilename,
      presignedUploadUrl,
      versionNumber: fileCategory === 'REPORT' ? nextVersionNumber : undefined,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Upload Presign POST] Error:', error);
    return NextResponse.json({ error: 'Failed to authorize upload session' }, { status: 500 });
  }
}
