import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const profileId = caller.profileId || caller.id;
    const { searchParams } = new URL(req.url);

    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const where: any = { userId: profileId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({
        where: { userId: profileId, isRead: false },
      }),
      prisma.notification.count({
        where: { userId: profileId },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      total,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Notifications GET] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const profileId = caller.profileId || caller.id;
    const body = await req.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: profileId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (notificationId) {
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: profileId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Notifications PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update notification state' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const profileId = caller.profileId || caller.id;

    await prisma.notification.deleteMany({
      where: { userId: profileId, isRead: true },
    });

    return NextResponse.json({ success: true, message: 'Cleared read notifications' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 });
  }
}
