import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { validateWorkingDayDeadline, parseISTCalendarDateToEndOfDay } from '@/lib/datetime/working-days';
import { rescheduleAssignmentReminders } from '@/lib/services/reminder-engine';
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
          select: { id: true, fullName: true, role: true, user: { select: { email: true } } },
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
        reportSubmissions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            submittedBy: { select: { id: true, fullName: true } },
            attachments: true,
          },
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
        deadlineHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { id: true, fullName: true, role: true } },
          },
        },
        reminders: {
          orderBy: { scheduledFor: 'asc' },
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
    const caller = await requireAuth(UserRole.ANALYST);
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.assignment.findUnique({
      where: { id },
      include: { primaryAnalyst: true, reviewer: true, assigner: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Role permission check for modifying deadline or reassignment (PART 1 - Section 13)
    const isAdmin = caller.role === UserRole.ADMIN || caller.role === UserRole.SUPER_ADMIN;
    const isAssigner = existing.assignerId === caller.id;
    const isReviewer = existing.reviewerId === caller.id;

    const {
      priority,
      dueDate,
      deadlineReason,
      instructions,
      primaryAnalystId,
      reviewerId,
    } = body;

    // Analysts are strictly forbidden from modifying deadlines or reassigning tasks
    if ((dueDate !== undefined || primaryAnalystId !== undefined) && !isAdmin && !isAssigner && !isReviewer) {
      return NextResponse.json(
        { error: 'Permission denied: Only administrators, assigners, or reviewers can modify deadlines or reassign tasks.' },
        { status: 403 }
      );
    }

    const dataToUpdate: any = {};
    if (priority && Object.values(AssignmentPriority).includes(priority)) {
      dataToUpdate.priority = priority;
    }
    if (instructions !== undefined) {
      dataToUpdate.instructions = instructions;
    }

    let isDeadlineChanged = false;
    let finalDueDate: Date | null = null;
    let newDeadlineVersion = existing.deadlineVersion;

    // Handle Deadline Modification with Mandatory Monday-Friday validation
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        // Clear deadline
        finalDueDate = null;
        isDeadlineChanged = existing.dueDate !== null;
      } else {
        // Validate working-day requirement
        const check = validateWorkingDayDeadline(dueDate);
        if (!check.valid) {
          return NextResponse.json(
            {
              error: `Invalid assignment deadline: ${check.error}. All deadlines throughout ThreatLedger must follow a strict Monday-to-Friday schedule.`,
            },
            { status: 400 }
          );
        }
        finalDueDate = parseISTCalendarDateToEndOfDay(check.dateString!);
        isDeadlineChanged = !existing.dueDate || existing.dueDate.getTime() !== finalDueDate.getTime();
      }

      if (isDeadlineChanged) {
        newDeadlineVersion = existing.deadlineVersion + 1;
        dataToUpdate.dueDate = finalDueDate;
        dataToUpdate.deadlineVersion = newDeadlineVersion;
        dataToUpdate.isLegacyWeekendDeadline = false; // Resolved
      }
    }

    // Handle Reassignment
    if (primaryAnalystId && primaryAnalystId !== existing.primaryAnalystId) {
      if (!isAdmin && !isAssigner) {
        return NextResponse.json({ error: 'Only administrators or the assigner can reassign tasks' }, { status: 403 });
      }
      dataToUpdate.primaryAnalystId = primaryAnalystId;
    }
    if (reviewerId && (isAdmin || isAssigner)) {
      dataToUpdate.reviewerId = reviewerId;
    }

    // Execute atomic update
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.assignment.update({
        where: { id },
        data: dataToUpdate,
      });

      // Record deadline history if modified
      if (isDeadlineChanged) {
        await tx.assignmentDeadlineHistory.create({
          data: {
            assignmentId: id,
            oldDueDate: existing.dueDate,
            newDueDate: finalDueDate,
            changedById: caller.id,
            reason: deadlineReason || 'Deadline updated in assignment workbench',
          },
        });

        await tx.assignmentEvent.create({
          data: {
            assignmentId: id,
            actorId: caller.id,
            eventType: 'DEADLINE_CHANGED',
            oldStatus: existing.status,
            newStatus: existing.status,
            reason: `Deadline changed by ${caller.fullName}: ${deadlineReason || 'Schedule updated'}.`,
          },
        });
      }

      // Record reassignment event if changed
      if (primaryAnalystId && primaryAnalystId !== existing.primaryAnalystId) {
        await tx.assignmentEvent.create({
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

      return res;
    });

    // Invalidate old reminder schedule and register new one
    if (isDeadlineChanged && finalDueDate) {
      await rescheduleAssignmentReminders({
        assignmentId: id,
        dueDate: finalDueDate,
        newDeadlineVersion,
      });
    }

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: isDeadlineChanged ? 'ASSIGNMENT_DEADLINE_MODIFIED' : 'ASSIGNMENT_UPDATED',
      targetType: 'ASSIGNMENT',
      targetId: id,
      beforeJson: { dueDate: existing.dueDate, primaryAnalystId: existing.primaryAnalystId },
      afterJson: { dueDate: finalDueDate, deadlineReason, primaryAnalystId },
    });

    return NextResponse.json({
      success: true,
      message: isDeadlineChanged ? 'Assignment deadline updated with working-day validation.' : 'Assignment updated.',
      assignment: updated,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Assignment PATCH Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update assignment' }, { status: 500 });
  }
}
