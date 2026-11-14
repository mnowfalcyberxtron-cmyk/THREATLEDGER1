import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ANALYST);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.trim() || '';
    const groupId = searchParams.get('groupId')?.trim() || '';
    const country = searchParams.get('country')?.trim() || '';
    const sector = searchParams.get('sector')?.trim() || '';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const offset = Number(searchParams.get('offset')) || 0;

    const where: any = {};

    if (search) {
      where.OR = [
        { victimName: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (groupId) where.groupId = groupId;
    if (country) where.country = { equals: country, mode: 'insensitive' };
    if (sector) where.sector = { equals: sector, mode: 'insensitive' };

    const [victims, total, sectorAgg, countryAgg] = await Promise.all([
      prisma.victim.findMany({
        where,
        include: {
          group: {
            select: { id: true, name: true, discoveryStatus: true },
          },
        },
        orderBy: { discoveredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.victim.count({ where }),
      prisma.victim.groupBy({
        by: ['sector'],
        _count: true,
        where: { sector: { not: null } },
        orderBy: { _count: { sector: 'desc' } },
        take: 8,
      }),
      prisma.victim.groupBy({
        by: ['country'],
        _count: true,
        where: { country: { not: null } },
        orderBy: { _count: { country: 'desc' } },
        take: 8,
      }),
    ]);

    return NextResponse.json({
      victims,
      total,
      limit,
      offset,
      analytics: {
        topSectors: sectorAgg.map((s) => ({ sector: s.sector, count: s._count })),
        topCountries: countryAgg.map((c) => ({ country: c.country, count: c._count })),
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to retrieve victim telemetry' }, { status: 500 });
  }
}
