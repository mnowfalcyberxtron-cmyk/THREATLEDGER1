import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, createSession } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { UserRole, UserStatus } from '@prisma/client';
import { z } from 'zod';

const setupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function GET() {
  try {
    const existingCount = await prisma.user.count();
    return NextResponse.json({
      isInitialized: existingCount > 0,
    });
  } catch (error) {
    console.error('[Setup GET] Error checking initialization:', error);
    return NextResponse.json({ isInitialized: false }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = setupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid registration data' },
        { status: 400 }
      );
    }

    const { fullName, email, password } = parsed.data;

    // Atomic transaction: check if users exist and create first user with lock
    const result = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      if (userCount > 0) {
        throw new Error('SYSTEM_ALREADY_INITIALIZED');
      }

      const hashedPassword = await hashPassword(password);

      const user = await tx.user.create({
        data: {
          email,
          encryptedPassword: hashedPassword,
          status: UserStatus.ACTIVE,
          profile: {
            create: {
              fullName,
              role: UserRole.SUPER_ADMIN,
              timezone: 'Asia/Kolkata',
              lastLoginAt: new Date(),
            },
          },
        },
        include: {
          profile: true,
        },
      });

      return user;
    });

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || undefined;

    // Create session and set cookie
    await createSession(result.id, ip, userAgent);

    // Audit log
    await recordAuditLog({
      actorId: result.profile?.id,
      actorName: result.profile?.fullName,
      actorEmail: result.email,
      action: 'SYSTEM_INITIAL_BOOTSTRAP',
      targetType: 'SYSTEM',
      targetId: result.id,
      afterJson: { email: result.email, role: UserRole.SUPER_ADMIN },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: 'Initial Super Admin account created successfully',
      user: {
        id: result.id,
        email: result.email,
        fullName: result.profile?.fullName,
        role: result.profile?.role,
      },
    });
  } catch (error: any) {
    if (error.message === 'SYSTEM_ALREADY_INITIALIZED') {
      return NextResponse.json(
        { error: 'System is already initialized. Public registration is closed.' },
        { status: 403 }
      );
    }

    console.error('[Setup POST] Bootstrap error:', error);
    return NextResponse.json(
      { error: 'Failed to complete initial administrator setup' },
      { status: 500 }
    );
  }
}
