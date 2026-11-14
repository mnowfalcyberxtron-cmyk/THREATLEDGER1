import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { GroupSource, GroupStatus, UserRole } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const { id: primaryGroupId } = await params;
    const { secondaryGroupId } = await req.json();

    if (!secondaryGroupId || secondaryGroupId === primaryGroupId) {
      return NextResponse.json({ error: 'Valid secondary group ID is required for merge' }, { status: 400 });
    }

    const [primary, secondary] = await Promise.all([
      prisma.ransomwareGroup.findUnique({ where: { id: primaryGroupId }, include: { aliases: true } }),
      prisma.ransomwareGroup.findUnique({ where: { id: secondaryGroupId }, include: { aliases: true } }),
    ]);

    if (!primary || !secondary) {
      return NextResponse.json({ error: 'One or both groups could not be located' }, { status: 404 });
    }

    // Atomic merge transaction preserving all relationships
    await prisma.$transaction(async (tx) => {
      // 1. Move secondary group aliases to primary
      const existingPrimaryAliases = new Set(primary.aliases.map((a) => a.alias.toLowerCase()));
      existingPrimaryAliases.add(primary.name.toLowerCase());

      // Add secondary group's name as an alias if not already present
      if (!existingPrimaryAliases.has(secondary.name.toLowerCase())) {
        await tx.groupAlias.create({
          data: { groupId: primary.id, alias: secondary.name },
        });
      }

      for (const aliasObj of secondary.aliases) {
        if (!existingPrimaryAliases.has(aliasObj.alias.toLowerCase())) {
          await tx.groupAlias.create({
            data: { groupId: primary.id, alias: aliasObj.alias },
          });
        }
      }

      // 2. Transfer victims
      await tx.victim.updateMany({
        where: { groupId: secondary.id },
        data: { groupId: primary.id },
      });

      // 3. Transfer assignments
      await tx.assignment.updateMany({
        where: { groupId: secondary.id },
        data: { groupId: primary.id },
      });

      // 4. Transfer TTPs, CVEs, tools
      await tx.groupTTP.updateMany({
        where: { groupId: secondary.id },
        data: { groupId: primary.id },
      });
      await tx.groupCVE.updateMany({
        where: { groupId: secondary.id },
        data: { groupId: primary.id },
      });
      await tx.groupTool.updateMany({
        where: { groupId: secondary.id },
        data: { groupId: primary.id },
      });

      // 5. Update primary group victim count and status
      const totalVictims = await tx.victim.count({ where: { groupId: primary.id } });
      await tx.ransomwareGroup.update({
        where: { id: primary.id },
        data: {
          source: GroupSource.MERGED,
          victimCount: totalVictims,
        },
      });

      // 6. Archive secondary group with pointer
      await tx.ransomwareGroup.update({
        where: { id: secondary.id },
        data: {
          status: GroupStatus.ARCHIVED,
          description: `[MERGED INTO ${primary.name}] ${secondary.description || ''}`,
        },
      });
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'GROUP_MERGED',
      targetType: 'GROUP',
      targetId: primaryGroupId,
      afterJson: {
        primaryGroupName: primary.name,
        secondaryGroupId,
        secondaryGroupName: secondary.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully merged "${secondary.name}" into "${primary.name}". All intelligence, assignments, and evidence preserved.`,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Group Merge POST] Error:', error);
    return NextResponse.json({ error: 'Failed to execute group merge' }, { status: 500 });
  }
}
