import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id: assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        reviewer: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const defaultReviewerEmail = assignment.reviewer?.user?.email || null;
    const isOverrideActive = Boolean(assignment.recipientOverrideEmail);
    const effectiveRecipientEmail = assignment.recipientOverrideEmail || defaultReviewerEmail;

    return NextResponse.json({
      reviewerName: assignment.reviewer?.fullName || 'Unassigned',
      defaultReviewerEmail,
      recipientOverrideEmail: assignment.recipientOverrideEmail,
      isOverrideActive,
      effectiveRecipientEmail,
      recipientOverrideReason: assignment.recipientOverrideReason,
      recipientOverrideAt: assignment.recipientOverrideAt,
      ccEmails: assignment.ccEmails || '',
      bccEmails: assignment.bccEmails || '',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Recipient GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve recipient details' }, { status: 500 });
  }
}

const updateRecipientSchema = z.object({
  recipientOverrideEmail: z.string().email().optional().or(z.literal('')),
  recipientOverrideReason: z.string().optional(),
  ccEmails: z.string().optional(),
  bccEmails: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only Administrators / Super Admins can set recipient overrides
    const caller = await requireAuth(UserRole.ADMIN);
    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = updateRecipientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid recipient payload' },
        { status: 400 }
      );
    }

    const {
      recipientOverrideEmail,
      recipientOverrideReason,
      ccEmails,
      bccEmails,
    } = parsed.data;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { reviewer: { include: { user: { select: { email: true } } } } },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const cleanOverride = recipientOverrideEmail && recipientOverrideEmail.trim().length > 0
      ? recipientOverrideEmail.trim()
      : null;

    const beforeJson = {
      recipientOverrideEmail: assignment.recipientOverrideEmail,
      recipientOverrideReason: assignment.recipientOverrideReason,
      ccEmails: assignment.ccEmails,
      bccEmails: assignment.bccEmails,
    };

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        recipientOverrideEmail: cleanOverride,
        recipientOverrideReason: cleanOverride ? (recipientOverrideReason || 'Administrative destination override') : null,
        recipientOverrideById: cleanOverride ? caller.id : null,
        recipientOverrideAt: cleanOverride ? new Date() : null,
        ccEmails: ccEmails !== undefined ? ccEmails.trim() : assignment.ccEmails,
        bccEmails: bccEmails !== undefined ? bccEmails.trim() : assignment.bccEmails,
      },
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'ASSIGNMENT_RECIPIENT_OVERRIDE_UPDATED',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      beforeJson,
      afterJson: {
        recipientOverrideEmail: updated.recipientOverrideEmail,
        reason: updated.recipientOverrideReason,
        ccEmails: updated.ccEmails,
        bccEmails: updated.bccEmails,
      },
    });

    return NextResponse.json({
      success: true,
      message: cleanOverride
        ? `Recipient override set to ${cleanOverride}`
        : 'Recipient override removed. Default reviewer will receive submission emails.',
      assignment: updated,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required to manage recipient overrides.' }, { status: 403 });
    }
    console.error('[Recipient PATCH Error]:', error);
    return NextResponse.json({ error: 'Failed to update recipient override' }, { status: 500 });
  }
}
