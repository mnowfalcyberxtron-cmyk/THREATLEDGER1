import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { VerificationStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
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
    });

    if (!group) {
      return NextResponse.json({ error: 'Threat group not found' }, { status: 404 });
    }

    let targetStatus: VerificationStatus = VerificationStatus.VERIFIED_DISTINCT;
    if (action === 'VERIFY') targetStatus = VerificationStatus.VERIFIED_DISTINCT;
    else if (action === 'REJECT') targetStatus = VerificationStatus.REJECTED_FALSE_POSITIVE;
    else if (action === 'LINK_ALIAS') targetStatus = VerificationStatus.LINKED_AS_ALIAS;
    else if (action === 'REBRAND_REVIEW') targetStatus = VerificationStatus.POSSIBLE_REBRAND;
    else {
      return NextResponse.json({ error: `Invalid verification action: ${action}` }, { status: 400 });
    }

    // If linking as alias to target group
    if (action === 'LINK_ALIAS' && aliasTargetId) {
      const targetGroup = await prisma.ransomwareGroup.findUnique({
        where: { id: aliasTargetId },
      });
      if (targetGroup) {
        await prisma.groupAlias.upsert({
          where: {
            groupId_alias: {
              groupId: aliasTargetId,
              alias: group.name,
            },
          },
          update: {},
          create: {
            groupId: aliasTargetId,
            alias: group.name,
          },
        });
      }
    }

    // Update canonical group
    const updatedGroup = await prisma.ransomwareGroup.update({
      where: { id: groupId },
      data: {
        verificationStatus: targetStatus,
        verificationNotes: notes || null,
        verifiedById: session.profileId,
        lastVerifiedAt: new Date(),
      },
    });

    // Create GroupVerification audit record
    const auditRecord = await prisma.groupVerification.create({
      data: {
        groupId,
        verifiedById: session.profileId,
        action,
        previousStatus: group.verificationStatus,
        newStatus: targetStatus,
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
