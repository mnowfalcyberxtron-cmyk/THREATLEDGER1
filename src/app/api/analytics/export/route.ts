import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { DiscoveryStatus, UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ANALYST);
    const { searchParams } = new URL(req.url);

    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const type = (searchParams.get('type') || 'groups').toLowerCase();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (type === 'groups') {
      const groups = await prisma.ransomwareGroup.findMany({
        orderBy: { victimCount: 'desc' },
        include: {
          aliases: true,
          ttps: true,
          cves: true,
        },
      });

      if (format === 'json') {
        return new NextResponse(JSON.stringify(groups, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="threatledger-groups-${timestamp}.json"`,
          },
        });
      }

      // CSV format
      const headers = [
        'ID',
        'Group Name',
        'Status',
        'Victim Count',
        'Discovery Status',
        'Detected At (IST)',
        'Aliases',
        'Associated CVEs',
        'MITRE ATT&CK TTPs',
      ];

      const rows = groups.map((g) => [
        `"${g.id}"`,
        `"${g.name.replace(/"/g, '""')}"`,
        `"${g.status}"`,
        g.victimCount,
        `"${g.discoveryStatus}"`,
        `"${g.threatLedgerDetectedAt.toISOString()}"`,
        `"${g.aliases.map((a) => a.alias).join(', ')}"`,
        `"${g.cves.map((c) => c.cveId).join(', ')}"`,
        `"${g.ttps.map((t) => t.mitreTechniqueId).join(', ')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="threatledger-groups-${timestamp}.csv"`,
        },
      });
    }

    if (type === 'victims') {
      const victims = await prisma.victim.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          group: { select: { name: true } },
        },
        take: 500,
      });

      if (format === 'json') {
        return new NextResponse(JSON.stringify(victims, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="threatledger-victims-${timestamp}.json"`,
          },
        });
      }

      const headers = ['ID', 'Victim Name', 'Group Name', 'Country', 'Sector', 'Discovered At', 'Source URL'];
      const rows = victims.map((v) => [
        `"${v.id}"`,
        `"${v.victimName.replace(/"/g, '""')}"`,
        `"${v.group?.name?.replace(/"/g, '""') || 'Unknown'}"`,
        `"${v.country || 'N/A'}"`,
        `"${v.sector || 'N/A'}"`,
        `"${(v.discoveredAt || v.createdAt).toISOString()}"`,
        `"${v.sourceUrl || v.domain || ''}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="threatledger-victims-${timestamp}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid export parameters' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Analytics Export Error]:', error);
    return NextResponse.json({ error: 'Failed to generate export file' }, { status: 500 });
  }
}
