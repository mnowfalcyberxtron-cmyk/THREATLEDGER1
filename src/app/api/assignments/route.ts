import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { dispatchTaskAssignedNotification } from '@/lib/email/mailer';
import { validateWorkingDayDeadline, parseISTCalendarDateToEndOfDay } from '@/lib/datetime/working-days';
import { rescheduleAssignmentReminders } from '@/lib/services/reminder-engine';
import { AssignmentPriority, AssignmentStatus, ChecklistStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

async function resolveProfileId(id: string): Promise<string> {
  const profile = await prisma.userProfile.findFirst({
    where: {
      OR: [
        { id: id },
        { userId: id },
      ],
    },
    select: { id: true },
  });
  return profile?.id || id;
}

const DEFAULT_CHECKLIST_ITEMS = [
  { itemKey: 'group_overview', title: '1. Group Overview & Origins', orderIndex: 1 },
  { itemKey: 'group_aliases', title: '2. Group Aliases & Rebranding History', orderIndex: 2 },
  { itemKey: 'first_observed', title: '3. First-Observed Intelligence & Timestamps', orderIndex: 3 },
  { itemKey: 'historical_activity', title: '4. Historical Campaign Activity', orderIndex: 4 },
  { itemKey: 'latest_victims', title: '5. Latest Victim Activity & Leak Posts', orderIndex: 5 },
  { itemKey: 'targeted_countries', title: '6. Targeted Geographical Regions', orderIndex: 6 },
  { itemKey: 'targeted_sectors', title: '7. Targeted Industry Sectors', orderIndex: 7 },
  { itemKey: 'victim_statistics', title: '8. Victim Statistics & Trend Verification', orderIndex: 8 },
  { itemKey: 'associated_malware', title: '9. Associated Ransomware Variants & Encryptors', orderIndex: 9 },
  { itemKey: 'associated_tools', title: '10. Associated Lateral & Exfiltration Tooling', orderIndex: 10 },
  { itemKey: 'associated_cves', title: '11. Exploited Vulnerabilities & CVEs', orderIndex: 11 },
  { itemKey: 'mitre_mapping', title: '12. MITRE ATT&CK Enterprise Matrix Mapping', orderIndex: 12 },
  { itemKey: 'source_references', title: '13. Source References & Technical Permalinks', orderIndex: 13 },
  { itemKey: 'verification_confidence', title: '14. Verification & Source Confidence Assessment', orderIndex: 14 },
  { itemKey: 'final_report_draft', title: '15. Final Research Report Document', orderIndex: 15 },
];

const createAssignmentSchema = z.object({
  groupIds: z.array(z.string()).min(1, 'At least one ransomware group must be selected'),
  primaryAnalystId: z.string().min(1, 'Primary analyst is required'),
  reviewerId: z.string().optional(),
  title: z.string().min(2, 'Title is required').trim(),
  instructions: z.string().optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).default('MEDIUM'),
  dueDate: z.string().optional(),
  individualDeadlines: z.record(z.string(), z.string()).optional(), // Map of groupId -> custom deadline
  recipientOverrideEmail: z.string().email().optional().or(z.literal('')),
  ccEmails: z.string().optional(),
  bccEmails: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as AssignmentStatus | null;
    const priority = searchParams.get('priority') as AssignmentPriority | null;
    const analystId = searchParams.get('analystId');
    const reviewerId = searchParams.get('reviewerId');
    const myTasksOnly = searchParams.get('myTasks') === 'true';

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (myTasksOnly) {
      where.primaryAnalystId = caller.profileId || caller.id;
    } else if (analystId) {
      where.primaryAnalystId = analystId;
    }

    if (reviewerId) where.reviewerId = reviewerId;

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        group: {
          select: { id: true, name: true, discoveryStatus: true, victimCount: true },
        },
        primaryAnalyst: {
          select: { id: true, fullName: true, role: true, user: { select: { email: true } } },
        },
        reviewer: {
          select: { id: true, fullName: true, role: true, user: { select: { email: true } } },
        },
        checklistItems: {
          select: { id: true, status: true },
        },
        reports: {
          include: {
            versions: {
              take: 1,
              orderBy: { versionNumber: 'desc' },
            },
          },
        },
        deadlineHistory: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { fullName: true } },
          },
        },
        _count: {
          select: { notes: true, evidence: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ assignments });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to retrieve assignments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid assignment payload' },
        { status: 400 }
      );
    }

    const {
      groupIds,
      primaryAnalystId,
      reviewerId,
      title,
      instructions,
      priority,
      dueDate,
      individualDeadlines,
    } = parsed.data;

    // 1. Mandatory Working-Day Validation (PART 1 - Section 1, 3, 4)
    // Validate common deadline if provided
    if (dueDate) {
      const check = validateWorkingDayDeadline(dueDate);
      if (!check.valid) {
        return NextResponse.json(
          {
            error: `Common deadline validation rejected: ${check.error}. Assignment deadlines are strictly restricted to Monday–Friday working days.`,
          },
          { status: 400 }
        );
      }
    }

    // Validate individual deadlines in bulk request
    if (individualDeadlines) {
      for (const [gId, customDate] of Object.entries(individualDeadlines)) {
        if (customDate) {
          const check = validateWorkingDayDeadline(customDate);
          if (!check.valid) {
            // Fetch group name for clear error diagnosis
            const targetGroup = await prisma.ransomwareGroup.findUnique({
              where: { id: gId },
              select: { name: true },
            });
            return NextResponse.json(
              {
                error: `Individual deadline validation rejected for syndicate "${targetGroup?.name || gId}": ${check.error}. The entire bulk batch has been aborted without creating partial assignments.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const callerProfileId = await resolveProfileId(caller.profileId || caller.id);
    const resolvedAnalystId = await resolveProfileId(primaryAnalystId);
    const resolvedReviewerId = reviewerId ? await resolveProfileId(reviewerId) : callerProfileId;
    const isBulk = groupIds.length > 1;

    let batchId: string | undefined = undefined;
    if (isBulk) {
      const batch = await prisma.assignmentBatch.create({
        data: {
          title: `Bulk Allocation: ${title} (${groupIds.length} groups)`,
          createdById: callerProfileId,
        },
      });
      batchId = batch.id;
    }

    const createdAssignments = [];

    for (const groupId of groupIds) {
      const group = await prisma.ransomwareGroup.findUnique({ where: { id: groupId } });
      const taskTitle = isBulk ? `${title} — ${group?.name || 'Group'}` : title;

      // Determine final deadline for this specific assignment
      const specificDueDateStr = individualDeadlines?.[groupId] || dueDate;
      let finalDueDate: Date | undefined = undefined;
      if (specificDueDateStr) {
        // Parse to end of calendar day in Asia/Kolkata (11:59:59.999 PM IST)
        const check = validateWorkingDayDeadline(specificDueDateStr);
        if (!check.valid) {
          throw new Error(check.error);
        }
        finalDueDate = parseISTCalendarDateToEndOfDay(check.dateString!);
      }

      const assignment = await prisma.assignment.create({
        data: {
          batchId,
          groupId,
          primaryAnalystId: resolvedAnalystId,
          assignerId: callerProfileId,
          reviewerId: resolvedReviewerId,
          title: taskTitle,
          instructions,
          priority: priority as AssignmentPriority,
          status: AssignmentStatus.ASSIGNED,
          dueDate: finalDueDate,
          deadlineVersion: 1,
          isLegacyWeekendDeadline: false,
          recipientOverrideEmail: parsed.data.recipientOverrideEmail && parsed.data.recipientOverrideEmail.trim().length > 0 ? parsed.data.recipientOverrideEmail.trim() : null,
          recipientOverrideById: parsed.data.recipientOverrideEmail ? callerProfileId : null,
          recipientOverrideAt: parsed.data.recipientOverrideEmail ? new Date() : null,
          ccEmails: parsed.data.ccEmails || null,
          bccEmails: parsed.data.bccEmails || null,
          checklistItems: {
            create: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
              itemKey: item.itemKey,
              title: item.title,
              orderIndex: item.orderIndex,
              status: ChecklistStatus.NOT_STARTED,
            })),
          },
          events: {
            create: {
              actorId: caller.id,
              eventType: 'ASSIGNED',
              newStatus: AssignmentStatus.ASSIGNED,
              reason: `Allocated by ${caller.fullName}${finalDueDate ? ` with working-day deadline ${specificDueDateStr}` : ''}`,
            },
          },
        },
        include: {
          group: { select: { name: true } },
        },
      });

      // Schedule durable working-day reminders
      if (finalDueDate) {
        await rescheduleAssignmentReminders({
          assignmentId: assignment.id,
          dueDate: finalDueDate,
          newDeadlineVersion: 1,
        });
      }

      // Create in-platform notification for assigned analyst
      await prisma.notification.create({
        data: {
          userId: primaryAnalystId,
          title: `New Research Assignment: ${assignment.group.name}`,
          message: `You have been assigned research on ${assignment.group.name} by ${caller.fullName}. Priority: ${priority}.`,
          type: 'ASSIGNMENT',
          link: `/my-tasks/${assignment.id}`,
        },
      });

      // Dispatch email notification to assigned analyst
      dispatchTaskAssignedNotification(assignment.id).catch((e) =>
        console.error('[Assignment Email Dispatch Error]:', e)
      );

      createdAssignments.push(assignment);
    }

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: isBulk ? 'BULK_ASSIGNMENTS_CREATED' : 'ASSIGNMENT_CREATED',
      targetType: 'ASSIGNMENT',
      targetId: createdAssignments[0]?.id,
      afterJson: {
        totalAllocated: groupIds.length,
        primaryAnalystId,
        reviewerId: finalReviewerId,
        priority,
        dueDate,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${createdAssignments.length} research assignment(s) with validated working-day schedules.`,
      assignments: createdAssignments,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Assignments POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create assignments' }, { status: 500 });
  }
}
