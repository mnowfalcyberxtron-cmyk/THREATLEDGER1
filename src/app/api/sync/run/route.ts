import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { runGroupInventorySync } from '@/lib/services/sync-engine';
import { UserRole } from '@prisma/client';

export const maxDuration = 60;

export async function POST() {
  try {
    await requireAuth(UserRole.ADMIN);
    const result = await runGroupInventorySync();
    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
