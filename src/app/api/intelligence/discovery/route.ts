import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import {
  getDiscoverySummaryMetrics,
  getSourcesStatusPanel,
  getDiscoveryRecords,
} from '@/lib/intelligence/discovery-engine';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month'); // e.g. "2026-11"
    let year: number | undefined;
    let month: number | undefined;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number);
      year = y;
      month = m;
    }

    const dateType = (searchParams.get('dateType') as any) || 'ALL';
    const source = searchParams.get('source') || 'ALL';
    const verificationStatus = (searchParams.get('verificationStatus') as any) || 'ALL';
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'firstObservedAt';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const [metrics, sourcesPanel, discoveryData] = await Promise.all([
      getDiscoverySummaryMetrics(year, month),
      getSourcesStatusPanel(),
      getDiscoveryRecords({
        year,
        month,
        dateType,
        source,
        verificationStatus,
        search,
        sortBy,
        sortOrder,
        page,
        limit,
      }),
    ]);

    return NextResponse.json({
      metrics,
      sourcesPanel,
      discoveryData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
