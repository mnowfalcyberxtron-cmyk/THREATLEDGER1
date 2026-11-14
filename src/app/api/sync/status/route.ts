import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export async function GET() {
  try {
    await requireAuth(UserRole.ANALYST);

    const [latestRuns, totalGroups, baselineExists] = await Promise.all([
      prisma.apiSyncRun.findMany({
        take: 10,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.ransomwareGroup.count(),
      prisma.ransomwareGroup.findFirst({
        where: { discoveryStatus: 'BASELINE' },
      }),
    ]);

    return NextResponse.json({
      totalGroups,
      hasBaseline: !!baselineExists,
      latestRun: latestRuns[0] || null,
      history: latestRuns,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to retrieve sync status' }, { status: 500 });
  }
}
