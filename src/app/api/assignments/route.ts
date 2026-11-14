import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AssignmentPriority, AssignmentStatus, ChecklistStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

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
      where.primaryAnalystId = caller.id;
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
          select: { id: true, fullName: true, role: true },
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

    const { groupIds, primaryAnalystId, reviewerId, title, instructions, priority, dueDate } = parsed.data;

    const finalReviewerId = reviewerId || caller.id;
    const isBulk = groupIds.length > 1;

    let batchId: string | undefined = undefined;
    if (isBulk) {
      const batch = await prisma.assignmentBatch.create({
        data: {
          title: `Bulk Allocation: ${title} (${groupIds.length} groups)`,
          createdById: caller.id,
        },
      });
      batchId = batch.id;
    }

    const createdAssignments = [];

    for (const groupId of groupIds) {
      const group = await prisma.ransomwareGroup.findUnique({ where: { id: groupId } });
      const taskTitle = isBulk ? `${title} — ${group?.name || 'Group'}` : title;

      const assignment = await prisma.assignment.create({
        data: {
          batchId,
          groupId,
          primaryAnalystId,
          assignerId: caller.id,
          reviewerId: finalReviewerId,
          title: taskTitle,
          instructions,
          priority: priority as AssignmentPriority,
          status: AssignmentStatus.ASSIGNED,
          dueDate: dueDate ? new Date(dueDate) : undefined,
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
              reason: `Allocated by ${caller.fullName}`,
            },
          },
        },
        include: {
          group: { select: { name: true } },
        },
      });

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
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully allocated ${createdAssignments.length} research assignment(s).`,
      assignments: createdAssignments,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Assignments POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create assignments' }, { status: 500 });
  }
}
