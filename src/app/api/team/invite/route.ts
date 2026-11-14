import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { UserRole, InvitationStatus } from '@prisma/client';
import crypto from 'crypto';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'ANALYST']),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid invitation data' },
        { status: 400 }
      );
    }

    const { email, role } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A team member with this email address already exists.' },
        { status: 409 }
      );
    }

    // Check if there is an active pending invitation
    const existingInvite = await prisma.invitation.findFirst({
      where: {
        email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An active invitation for this email has already been sent.' },
        { status: 409 }
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.invitation.create({
      data: {
        email,
        role: role as UserRole,
        token,
        invitedById: caller.id,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    // Record audit event
    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'TEAM_MEMBER_INVITED',
      targetType: 'INVITATION',
      targetId: invitation.id,
      afterJson: { email, role },
    });

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${token}`;

    return NextResponse.json({
      success: true,
      message: `Invitation generated for ${email}`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteLink,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }

    console.error('[Invite POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create team invitation' }, { status: 500 });
  }
}
