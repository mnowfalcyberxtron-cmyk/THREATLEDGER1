import { NextResponse } from 'next/server';
import { destroySession, getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await recordAuditLog({
        actorId: user.id,
        actorName: user.fullName,
        actorEmail: user.email,
        action: 'USER_LOGOUT',
        targetType: 'AUTH',
        targetId: user.id,
      });
    }

    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Logout POST] Error:', error);
    return NextResponse.json({ error: 'Failed to process logout' }, { status: 500 });
  }
}
