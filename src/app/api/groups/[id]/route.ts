import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { GroupStatus, UserRole } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(UserRole.ANALYST);
    const { id } = await params;

    const group = await prisma.ransomwareGroup.findUnique({
      where: { id },
      include: {
        aliases: true,
        ttps: true,
        cves: true,
        tools: true,
        victims: {
          take: 50,
          orderBy: { discoveredAt: 'desc' },
        },
        discoveryEvents: {
          orderBy: { detectedAt: 'desc' },
        },
        assignments: {
          include: {
            primaryAnalyst: { select: { fullName: true, role: true } },
            reviewer: { select: { fullName: true } },
            reports: {
              include: {
                versions: {
                  orderBy: { versionNumber: 'desc' },
                },
              },
            },
            evidence: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to retrieve group profile' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.ransomwareGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const { description, websiteUrl, profileUrl, status } = body;

    const updated = await prisma.ransomwareGroup.update({
      where: { id },
      data: {
        description: description !== undefined ? description : existing.description,
        websiteUrl: websiteUrl !== undefined ? websiteUrl : existing.websiteUrl,
        profileUrl: profileUrl !== undefined ? profileUrl : existing.profileUrl,
        status: status && Object.values(GroupStatus).includes(status) ? status : existing.status,
      },
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'GROUP_PROFILE_UPDATED',
      targetType: 'GROUP',
      targetId: id,
      beforeJson: {
        description: existing.description,
        status: existing.status,
      },
      afterJson: {
        description: updated.description,
        status: updated.status,
      },
    });

    return NextResponse.json({ success: true, group: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update group profile' }, { status: 500 });
  }
}
