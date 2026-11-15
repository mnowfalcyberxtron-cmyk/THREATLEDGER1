import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { AssignmentStatus, UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const { searchParams } = new URL(req.url);

    const filterStatus = searchParams.get('status') as AssignmentStatus | null;

    const where: any = {};
    if (filterStatus) {
      where.status = filterStatus;
    } else {
      where.status = {
        in: [
          AssignmentStatus.SUBMITTED_FOR_REVIEW,
          AssignmentStatus.CHANGES_REQUESTED,
          AssignmentStatus.APPROVED_COMPLETED,
          AssignmentStatus.REJECTED,
        ],
      };
    }

    const submissions = await prisma.assignment.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, victimCount: true } },
        primaryAnalyst: { select: { id: true, fullName: true, role: true } },
        reviewer: { select: { id: true, fullName: true, role: true } },
        reports: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
        evidence: true,
        checklistItems: true,
        reportSubmissions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            attachments: true,
            submittedBy: { select: { fullName: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ submissions });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to retrieve review queue' }, { status: 500 });
  }
}
