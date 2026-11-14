import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { UserRole, UserStatus, AssignmentStatus } from '@prisma/client';

export async function GET() {
  try {
    await requireAuth(UserRole.ANALYST); // All authenticated members can view team directory

    const members = await prisma.user.findMany({
      include: {
        profile: {
          include: {
            assignedTasks: {
              select: {
                id: true,
                status: true,
                dueDate: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();

    const formatted = members.map((m) => {
      const tasks = m.profile?.assignedTasks || [];
      const total = tasks.length;
      const pending = tasks.filter((t) => t.status === AssignmentStatus.ASSIGNED || t.status === AssignmentStatus.ACCEPTED).length;
      const inProgress = tasks.filter((t) => t.status === AssignmentStatus.IN_PROGRESS).length;
      const submitted = tasks.filter((t) => t.status === AssignmentStatus.SUBMITTED_FOR_REVIEW).length;
      const approved = tasks.filter((t) => t.status === AssignmentStatus.APPROVED_COMPLETED).length;
      const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== AssignmentStatus.APPROVED_COMPLETED).length;

      return {
        id: m.id,
        profileId: m.profile?.id,
        email: m.email,
        fullName: m.profile?.fullName || m.email.split('@')[0],
        role: m.profile?.role || UserRole.ANALYST,
        status: m.status,
        timezone: m.profile?.timezone || 'Asia/Kolkata',
        joinedAt: m.createdAt,
        lastLoginAt: m.profile?.lastLoginAt,
        metrics: {
          totalAssignments: total,
          pending,
          inProgress,
          submitted,
          approved,
          overdue,
        },
      };
    });

    return NextResponse.json({ members: formatted });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.error('[Team Members GET] Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve team members' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const { userId, role, status } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Safety check: protect the last active Super Admin from demotion or deactivation
    if (
      (targetUser.profile?.role === UserRole.SUPER_ADMIN && role && role !== UserRole.SUPER_ADMIN) ||
      (targetUser.profile?.role === UserRole.SUPER_ADMIN && status === UserStatus.INACTIVE)
    ) {
      const superAdminCount = await prisma.userProfile.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          user: { status: UserStatus.ACTIVE },
        },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote or deactivate the last remaining active Super Admin.' },
          { status: 400 }
        );
      }
    }

    // Only Super Admin can change someone to or from Super Admin
    if ((role === UserRole.SUPER_ADMIN || targetUser.profile?.role === UserRole.SUPER_ADMIN) && caller.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json(
        { error: 'Only a Super Admin can promote to or modify Super Admin privileges.' },
        { status: 403 }
      );
    }

    const beforeState = {
      role: targetUser.profile?.role,
      status: targetUser.status,
    };

    if (status && Object.values(UserStatus).includes(status)) {
      await prisma.user.update({
        where: { id: userId },
        data: { status },
      });
    }

    if (role && Object.values(UserRole).includes(role) && targetUser.profile) {
      await prisma.userProfile.update({
        where: { id: targetUser.profile.id },
        data: { role },
      });
    }

    // Audit log
    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'TEAM_MEMBER_UPDATED',
      targetType: 'USER',
      targetId: userId,
      beforeJson: beforeState,
      afterJson: { role, status },
    });

    return NextResponse.json({
      success: true,
      message: 'Team member privileges updated successfully',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Team Members PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}
