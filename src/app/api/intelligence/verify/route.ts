import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { VerificationStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { groupId, action, notes, aliasTargetId } = body;

    if (!groupId || !action) {
      return NextResponse.json({ error: 'groupId and action are required' }, { status: 400 });
    }

    const group = await prisma.ransomwareGroup.findUnique({
      where: { id: groupId },
      include: { verifiedBy: true },
    });

    if (!group) {
      return NextResponse.json({ error: 'Threat group not found' }, { status: 404 });
    }

    // Resolve profileId for foreign key relation
    let userProfile = await prisma.userProfile.findUnique({
      where: { userId: session.id },
    });
    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: {
          userId: session.id,
          fullName: session.name || session.email,
        },
      });
    }

    let targetStatus: VerificationStatus = 'VERIFIED';
    if (action === 'VERIFY') targetStatus = 'VERIFIED';
    else if (action === 'REJECT') targetStatus = 'REJECTED';
    else if (action === 'LINK_ALIAS') targetStatus = 'ALIAS_LINKED';
    else if (action === 'REBRAND_REVIEW') targetStatus = 'REBRAND_REVIEW';
    else {
      return NextResponse.json({ error: `Invalid verification action: ${action}` }, { status: 400 });
    }

    // If linking as alias to target group
    if (action === 'LINK_ALIAS' && aliasTargetId) {
      const targetGroup = await prisma.ransomwareGroup.findUnique({
        where: { id: aliasTargetId },
      });
      if (targetGroup) {
        const existingAliases = targetGroup.aliases || [];
        if (!existingAliases.includes(group.name)) {
          await prisma.ransomwareGroup.update({
            where: { id: aliasTargetId },
            data: {
              aliases: [...existingAliases, group.name],
            },
          });
        }
      }
    }

    // Update canonical group
    const updatedGroup = await prisma.ransomwareGroup.update({
      where: { id: groupId },
      data: {
        verificationStatus: targetStatus,
        verificationNotes: notes || null,
        verifiedById: userProfile.id,
        lastVerifiedAt: new Date(),
      },
    });

    // Create GroupVerification audit record
    const auditRecord = await prisma.groupVerification.create({
      data: {
        groupId,
        verifiedById: userProfile.id,
        status: targetStatus,
        notes: notes || `Action ${action} executed by ${session.email}`,
      },
    });

    return NextResponse.json({
      success: true,
      group: updatedGroup,
      audit: auditRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
