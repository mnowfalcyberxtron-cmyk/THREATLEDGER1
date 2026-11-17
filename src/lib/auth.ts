import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';

export interface AuthSessionUser {
  id: string;
  profileId: string;
  email: string;
  role: UserRole;
  fullName: string;
  avatarUrl?: string | null;
  status: UserStatus;
}

const SESSION_COOKIE_NAME = 'threatledger_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Check if the system has been initialized with at least one Super Admin / Admin.
 * Used to conditionally route first-time setup.
 */
export async function isSystemInitialized(): Promise<boolean> {
  try {
    const userCount = await prisma.user.count({
      where: {
        status: { in: [UserStatus.ACTIVE, UserStatus.PENDING] },
      },
    });
    return userCount > 0;
  } catch (error) {
    // If DB is offline or table does not exist yet, allow setup check to report false safely
    console.error('[Auth] Failed to check system initialization:', error);
    return false;
  }
}

/**
 * Hash password securely with bcrypt salt.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 12);
}

/**
 * Verify password against bcrypt hash.
 */
export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

/**
 * Create an authenticated session record and set the secure HTTP-only cookie.
 */
export async function createSession(userId: string, reqIp?: string, userAgent?: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: {
      userId,
      sessionToken: token,
      expiresAt,
      ipAddress: reqIp,
      userAgent: userAgent,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return token;
}

/**
 * Invalidate current session and clear cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await prisma.session.deleteMany({
        where: { sessionToken: token },
      });
    } catch {
      // Ignored if already cleaned up
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Retrieve the current authenticated user and profile from session cookie.
 */
export async function getCurrentUser(): Promise<AuthSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!session || !session.user || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
      return null;
    }

    const { user } = session;
    if (user.status !== UserStatus.ACTIVE) {
      return null;
    }

    return {
      id: user.id,
      profileId: user.profile?.id || user.id,
      email: user.email,
      role: user.profile?.role || UserRole.ANALYST,
      fullName: user.profile?.fullName || user.email.split('@')[0],
      avatarUrl: user.profile?.avatarUrl,
      status: user.status,
    };
  } catch (error) {
    console.error('[Auth] getCurrentUser error:', error);
    return null;
  }
}

/**
 * Alias for getCurrentUser for session retrieval.
 */
export const getAuthSession = getCurrentUser;

/**
 * Server-side RBAC guard. Ensures caller is authenticated and possesses at least required role.
 */
export async function requireAuth(minimumRole?: UserRole): Promise<AuthSessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('UNAUTHORIZED');
  }

  if (minimumRole) {
    const roleHierarchy: Record<UserRole, number> = {
      ANALYST: 1,
      ADMIN: 2,
      SUPER_ADMIN: 3,
    };

    if (roleHierarchy[user.role] < roleHierarchy[minimumRole]) {
      throw new Error('FORBIDDEN');
    }
  }

  return user;
}
