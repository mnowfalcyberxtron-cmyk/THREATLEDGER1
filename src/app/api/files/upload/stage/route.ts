import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { stageTemporaryFile, validateFileSafety } from '@/lib/storage/temp-storage';
import { UserRole } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);

    const formData = await req.formData();
    const assignmentId = formData.get('assignmentId') as string;
    const fileCategory = (formData.get('fileCategory') as string) || 'REPORT';
    const file = formData.get('file') as File | null;

    if (!assignmentId || !file) {
      return NextResponse.json(
        { error: 'Assignment ID and file are required.' },
        { status: 400 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Role check: Only assigned analyst or admin can upload
    const profileId = caller.profileId || caller.id;
    if (
      caller.role === UserRole.ANALYST &&
      assignment.primaryAnalystId !== profileId &&
      assignment.reviewerId !== profileId
    ) {
      return NextResponse.json(
        { error: 'Unauthorized to stage uploads for this assignment.' },
        { status: 403 }
      );
    }

    // Validate filename & MIME safety
    const safety = validateFileSafety(file.name, file.type);
    if (!safety.valid) {
      return NextResponse.json({ error: safety.error }, { status: 400 });
    }

    // Enforce 25 MB individual file ceiling (Gmail ceiling)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds maximum allowed individual file limit of 25 MB.` },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Stage into temporary private storage
    const staged = await stageTemporaryFile(
      assignmentId,
      file.name,
      bytes,
      file.type || 'application/octet-stream'
    );

    return NextResponse.json({
      success: true,
      storagePath: staged.storagePath,
      filename: staged.safeFilename,
      fileSize: staged.fileSize,
      mimeType: file.type || 'application/octet-stream',
      sha256: staged.sha256,
      fileCategory,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Upload Stage POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to stage upload' }, { status: 500 });
  }
}
