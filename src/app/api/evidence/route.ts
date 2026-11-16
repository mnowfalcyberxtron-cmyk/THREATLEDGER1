import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { searchParams } = new URL(req.url);

    const category = searchParams.get('category');
    const groupId = searchParams.get('groupId');
    const q = searchParams.get('q');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (groupId) {
      where.groupId = groupId;
    }

    if (q) {
      where.OR = [
        { filename: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { assignment: { group: { name: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    // Role-based visibility
    if (caller.role === UserRole.ANALYST) {
      const pid = caller.profileId || caller.id;
      where.OR = [
        { uploaderId: caller.id },
        { assignment: { primaryAnalystId: pid } },
        { assignment: { reviewerId: pid } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supportingEvidence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              group: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.supportingEvidence.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Evidence GET] Error:', error);
    return NextResponse.json({ error: 'Failed to query supporting evidence' }, { status: 500 });
  }
}
