import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { fetchGroupFullIntel } from '@/lib/integrations/ransomware-live';
import { GroupStatus, UserRole } from '@prisma/client';

const groupDetailInclude = {
  aliases: true,
  ttps: true,
  cves: true,
  tools: true,
  victims: {
    orderBy: { discoveredAt: 'desc' as const },
  },
  discoveryEvents: {
    orderBy: { detectedAt: 'desc' as const },
  },
  sourceObservations: {
    include: { source: true },
    orderBy: { observedAt: 'desc' as const },
  },
  verifications: {
    include: { verifiedBy: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
  assignments: {
    include: {
      primaryAnalyst: { select: { fullName: true, role: true } },
      reviewer: { select: { fullName: true } },
      reports: {
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' as const },
          },
        },
      },
      evidence: true,
    },
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(UserRole.ANALYST);
    const { id } = await params;

    let group = await prisma.ransomwareGroup.findUnique({
      where: { id },
      include: groupDetailInclude,
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Hydrate full victim list, TTPs, CVEs, and Tools on demand when DB has fewer records than claimed
    const needsHydration =
      group.victims.length < group.victimCount ||
      (group.victimCount > 0 && group.ttps.length === 0 && group.tools.length === 0);

    if (needsHydration) {
      const intel = await fetchGroupFullIntel(group.name);
      if (intel) {
        if (intel.victims.length > 0) {
          await prisma.victim.createMany({
            data: intel.victims.map((v) => ({
              externalId: v.externalId || `${group!.name}-${v.victimName}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              groupId: group!.id,
              victimName: v.victimName,
              country: v.country,
              countryCode: v.countryCode,
              sector: v.sector,
              domain: v.domain,
              discoveredAt: v.discoveredAt ? new Date(v.discoveredAt) : new Date(),
              attackedAt: v.attackedAt ? new Date(v.attackedAt) : undefined,
              claimType: v.claimType || 'ATTACKER_CLAIM',
            })),
            skipDuplicates: true,
          });
        }

        if (group.ttps.length === 0 && intel.ttps.length > 0) {
          await prisma.groupTTP.createMany({
            data: intel.ttps.map((t) => ({
              groupId: group!.id,
              mitreTactic: t.tactic,
              mitreTechniqueId: t.techniqueId,
              mitreTechniqueName: t.techniqueName,
            })),
            skipDuplicates: true,
          });
        }

        if (group.cves.length === 0 && intel.cves.length > 0) {
          await prisma.groupCVE.createMany({
            data: intel.cves.map((c) => ({
              groupId: group!.id,
              cveId: c.cveId,
              description: c.description,
              cvssScore: c.cvssScore,
            })),
            skipDuplicates: true,
          });
        }

        if (group.tools.length === 0 && intel.tools.length > 0) {
          await prisma.groupTool.createMany({
            data: intel.tools.map((tool) => ({
              groupId: group!.id,
              toolName: tool.toolName,
              category: tool.category,
            })),
            skipDuplicates: true,
          });
        }

        const latestCount = Math.max(group.victimCount, intel.victimCount || 0, intel.victims.length);
        await prisma.ransomwareGroup.update({
          where: { id: group.id },
          data: {
            description: group.description || intel.description || undefined,
            websiteUrl: group.websiteUrl || intel.websiteUrl || undefined,
            victimCount: latestCount,
            firstClaimAt: group.firstClaimAt || (intel.firstSeenAt ? new Date(intel.firstSeenAt) : undefined),
            lastSeenAt: intel.lastSeenAt ? new Date(intel.lastSeenAt) : undefined,
          },
        });

        const refreshed = await prisma.ransomwareGroup.findUnique({
          where: { id },
          include: groupDetailInclude,
        });
        if (refreshed) group = refreshed;
      }
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
