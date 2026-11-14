import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, createSession } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { UserStatus } from '@prisma/client';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid credentials' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || !user.encryptedPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Account is deactivated or pending invitation approval. Contact administrator.' },
        { status: 403 }
      );
    }

    const passwordValid = await verifyPassword(password, user.encryptedPassword);
    if (!passwordValid) {
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
      await recordAuditLog({
        actorEmail: email,
        action: 'USER_LOGIN_FAILED',
        targetType: 'AUTH',
        targetId: user.id,
        ipAddress: ip,
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || undefined;

    // Establish session cookie
    await createSession(user.id, ip, userAgent);

    // Update lastLoginAt
    if (user.profile) {
      await prisma.userProfile.update({
        where: { id: user.profile.id },
        data: { lastLoginAt: new Date() },
      });
    }

    // Record audit event
    await recordAuditLog({
      actorId: user.profile?.id,
      actorName: user.profile?.fullName,
      actorEmail: user.email,
      action: 'USER_LOGIN_SUCCESS',
      targetType: 'AUTH',
      targetId: user.id,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.profile?.fullName,
        role: user.profile?.role,
      },
    });
  } catch (error) {
    console.error('[Login POST] Error:', error);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred' },
      { status: 500 }
    );
  }
}
