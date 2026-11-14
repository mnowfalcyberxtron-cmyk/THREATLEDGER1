import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, createSession } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { InvitationStatus, UserStatus } from '@prisma/client';
import { z } from 'zod';

const acceptSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        invitedBy: {
          include: { profile: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      return NextResponse.json({ error: 'This invitation has already been used or revoked' }, { status: 410 });
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy?.profile?.fullName || 'Administrator',
    });
  } catch (error) {
    console.error('[Invite Token GET] Error:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid details' },
        { status: 400 }
      );
    }

    const { fullName, password } = parsed.data;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation || invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Atomic transaction: create user and mark invitation accepted
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          encryptedPassword: hashedPassword,
          status: UserStatus.ACTIVE,
          profile: {
            create: {
              fullName,
              role: invitation.role,
              timezone: 'Asia/Kolkata',
              lastLoginAt: new Date(),
            },
          },
        },
        include: {
          profile: true,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return newUser;
    });

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || undefined;

    // Establish authenticated session
    await createSession(user.id, ip, userAgent);

    // Record audit event
    await recordAuditLog({
      actorId: user.profile?.id,
      actorName: user.profile?.fullName,
      actorEmail: user.email,
      action: 'TEAM_INVITATION_ACCEPTED',
      targetType: 'USER',
      targetId: user.id,
      afterJson: { email: user.email, role: user.profile?.role },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Account successfully registered and activated',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName,
        role: user.profile?.role,
      },
    });
  } catch (error) {
    console.error('[Invite Token POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    );
  }
}
