import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AssignmentPriority, UserRole } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        group: {
          include: {
            aliases: true,
            ttps: true,
            cves: true,
            tools: true,
          },
        },
        primaryAnalyst: {
          select: { id: true, fullName: true, role: true, user: { select: { email: true } } },
        },
        assigner: {
          select: { id: true, fullName: true },
        },
        reviewer: {
          select: { id: true, fullName: true, role: true },
        },
        checklistItems: {
          orderBy: { orderIndex: 'asc' },
        },
        notes: {
          include: {
            author: { select: { id: true, fullName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        reports: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Role check: Admin/Super Admin can view all. Analyst can view if assigned to them or if they are reviewer.
    if (caller.role === UserRole.ANALYST && assignment.primaryAnalystId !== caller.id && assignment.reviewerId !== caller.id) {
      return NextResponse.json({ error: 'Access restricted to assigned personnel' }, { status: 403 });
    }

    // Filter out ADMIN_PRIVATE notes for regular analysts (Section 27)
    let filteredNotes = assignment.notes;
    if (caller.role === UserRole.ANALYST) {
      filteredNotes = assignment.notes.filter((n) => n.noteType !== 'ADMIN_PRIVATE');
    }

    return NextResponse.json({
      assignment: {
        ...assignment,
        notes: filteredNotes,
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to retrieve assignment' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: { primaryAnalyst: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const { priority, dueDate, instructions, primaryAnalystId, reviewerId } = body;

    const dataToUpdate: any = {};
    if (priority && Object.values(AssignmentPriority).includes(priority)) dataToUpdate.priority = priority;
    if (dueDate !== undefined) dataToUpdate.dueDate = dueDate ? new Date(dueDate) : null;
    if (instructions !== undefined) dataToUpdate.instructions = instructions;
    if (primaryAnalystId && primaryAnalystId !== existing.primaryAnalystId) {
      dataToUpdate.primaryAnalystId = primaryAnalystId;
      // Record reassignment event
      await prisma.assignmentEvent.create({
        data: {
          assignmentId: id,
          actorId: caller.id,
          eventType: 'REASSIGNED',
          oldStatus: existing.status,
          newStatus: existing.status,
          reason: `Reassigned from ${existing.primaryAnalyst.fullName} by ${caller.fullName}`,
        },
      });
    }
    if (reviewerId) dataToUpdate.reviewerId = reviewerId;

    const updated = await prisma.assignment.update({
      where: { id },
      data: dataToUpdate,
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'ASSIGNMENT_UPDATED',
      targetType: 'ASSIGNMENT',
      targetId: id,
      afterJson: dataToUpdate,
    });

    return NextResponse.json({ success: true, assignment: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}
