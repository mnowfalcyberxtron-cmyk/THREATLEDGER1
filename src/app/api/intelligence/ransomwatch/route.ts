import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  getRansomWatchImportStatus,
  runRansomWatchHistoricalImport,
  RANSOMWATCH_GROUPS_URL,
  RANSOMWATCH_POSTS_URL,
} from '@/lib/intelligence/sources/ransomwatch';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getRansomWatchImportStatus();

    return NextResponse.json({
      repositoryUrl: 'https://github.com/joshhighet/ransomwatch',
      isArchived: true,
      archiveDate: '2026-03-03',
      sourceType: 'HISTORICAL_ARCHIVE',
      sourceLineage: 'INDEPENDENT',
      datasets: [
        { name: 'groups.json', url: RANSOMWATCH_GROUPS_URL },
        { name: 'posts.json', url: RANSOMWATCH_POSTS_URL },
      ],
      hasImported: status.hasImported,
      lastRun: status.lastRun,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN role
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only administrators can run historical repository imports' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const forceRerun = body.forceRerun === true;

    const result = await runRansomWatchHistoricalImport(forceRerun);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
