import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { getISTDiscoveryMonth } from '@/lib/services/sync-engine';
import { DiscoveryStatus, GroupSource, GroupStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').trim(),
  description: z.string().optional(),
  websiteUrl: z.string().optional(),
  profileUrl: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'RENAMED']).default('ACTIVE'),
  aliases: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ANALYST);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.trim() || '';
    const discoveryStatus = searchParams.get('discoveryStatus') as DiscoveryStatus | null;
    const discoveryMonth = searchParams.get('month')?.trim() || null;
    const source = searchParams.get('source') as GroupSource | null;
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const offset = Number(searchParams.get('offset')) || 0;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { normalizedName: { contains: search, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (discoveryStatus) where.discoveryStatus = discoveryStatus;
    if (discoveryMonth) where.discoveryMonth = discoveryMonth;
    if (source) where.source = source;

    const [groups, total] = await Promise.all([
      prisma.ransomwareGroup.findMany({
        where,
        include: {
          aliases: true,
          assignments: {
            select: {
              id: true,
              status: true,
              priority: true,
              primaryAnalyst: { select: { fullName: true, role: true } },
            },
          },
          _count: {
            select: { victims: true },
          },
        },
        orderBy: { threatLedgerDetectedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.ransomwareGroup.count({ where }),
    ]);

    return NextResponse.json({
      groups,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to retrieve groups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = createGroupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid group details' },
        { status: 400 }
      );
    }

    const { name, description, websiteUrl, profileUrl, status, aliases } = parsed.data;
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Duplicate check
    const existing = await prisma.ransomwareGroup.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { normalizedName },
          { aliases: { some: { alias: { equals: name, mode: 'insensitive' } } } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Group or alias "${name}" already exists as ${existing.name}. Use merge or edit.` },
        { status: 409 }
      );
    }

    const currentMonth = getISTDiscoveryMonth();

    const group = await prisma.ransomwareGroup.create({
      data: {
        name,
        normalizedName,
        description,
        websiteUrl,
        profileUrl,
        status: status as GroupStatus,
        source: GroupSource.MANUAL,
        discoveryStatus: DiscoveryStatus.MANUALLY_ADDED,
        discoveryMonth: currentMonth,
        threatLedgerDetectedAt: new Date(),
        aliases: {
          create: aliases.map((alias) => ({ alias: alias.trim() })),
        },
      },
      include: {
        aliases: true,
      },
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'MANUAL_GROUP_CREATED',
      targetType: 'GROUP',
      targetId: group.id,
      afterJson: { name, aliases, source: 'MANUAL' },
    });

    return NextResponse.json({
      success: true,
      message: `Group "${name}" added manually.`,
      group,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Groups POST] Error:', error);
    return NextResponse.json({ error: 'Failed to add manual group' }, { status: 500 });
  }
}
