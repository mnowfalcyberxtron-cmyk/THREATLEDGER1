import prisma from '@/lib/prisma';
import {
  calculateWorkingDayReminderSchedule,
  getWorkingDayDeadlineStatus,
  getISTCalendarParts,
  isWorkingDayInIST,
  IST_TIMEZONE,
} from '@/lib/datetime/working-days';
import { sendEmail } from '@/lib/email/mailer';

export interface RescheduleReminderOptions {
  assignmentId: string;
  dueDate: Date | string;
  newDeadlineVersion: number;
}

/**
 * Invalidate previously scheduled pending reminders and schedule a new working-day reminder set.
 */
export async function rescheduleAssignmentReminders(options: RescheduleReminderOptions) {
  const { assignmentId, dueDate, newDeadlineVersion } = options;

  // 1. Invalidate any pending reminders for previous deadline versions
  await prisma.assignmentReminderSchedule.updateMany({
    where: {
      assignmentId,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
    },
  });

  // If no deadline set, we're done
  if (!dueDate) return;

  // 2. Generate new working-day schedule (2 days before, 1 day before, on deadline day at 9 AM IST)
  const schedule = calculateWorkingDayReminderSchedule(dueDate);

  // 3. Persist reminder records
  for (const item of schedule) {
    await prisma.assignmentReminderSchedule.create({
      data: {
        assignmentId,
        deadlineVersion: newDeadlineVersion,
        reminderType: item.reminderType,
        scheduledFor: item.scheduledFor,
        status: 'PENDING',
      },
    });
  }
}

/**
 * Cancel all active reminders when assignment reaches terminal status (APPROVED_COMPLETED, CANCELLED).
 */
export async function cancelTerminalReminders(assignmentId: string) {
  await prisma.assignmentReminderSchedule.updateMany({
    where: {
      assignmentId,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
    },
  });
}

/**
 * Processes pending working-day reminders due at or before now.
 * Idempotent: checks status and updates atomically.
 */
export async function processPendingReminders(referenceNow: Date = new Date()): Promise<{
  processedCount: number;
  sentCount: number;
  skippedCount: number;
}> {
  const pending = await prisma.assignmentReminderSchedule.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: referenceNow },
    },
    include: {
      assignment: {
        include: {
          group: { select: { name: true } },
          primaryAnalyst: { include: { user: { select: { email: true } } } },
        },
      },
    },
  });

  let sentCount = 0;
  let skippedCount = 0;

  for (const reminder of pending) {
    const { assignment } = reminder;

    // Check terminal status: if assignment is APPROVED_COMPLETED or CANCELLED, cancel and skip
    if (
      assignment.status === 'APPROVED_COMPLETED' ||
      assignment.status === 'CANCELLED'
    ) {
      await prisma.assignmentReminderSchedule.update({
        where: { id: reminder.id },
        data: { status: 'CANCELLED' },
      });
      skippedCount++;
      continue;
    }

    // Check if reminder deadlineVersion matches current assignment deadlineVersion
    if (reminder.deadlineVersion !== assignment.deadlineVersion) {
      await prisma.assignmentReminderSchedule.update({
        where: { id: reminder.id },
        data: { status: 'CANCELLED' },
      });
      skippedCount++;
      continue;
    }

    const analystEmail = assignment.primaryAnalyst?.user?.email;
    const analystName = assignment.primaryAnalyst?.fullName || 'Analyst';
    const groupName = assignment.group?.name || 'Syndicate';

    const deadlineStatus = getWorkingDayDeadlineStatus(assignment.dueDate, referenceNow);

    let reminderSubject = `[Deadline Reminder] ${groupName}: ${assignment.title}`;
    let reminderBody = '';

    if (reminder.reminderType === 'TWO_DAYS_BEFORE') {
      reminderSubject = `[Due in 2 Working Days] ${groupName}: ${assignment.title}`;
      reminderBody = `Your research assignment for ${groupName} is due in 2 working days (${deadlineStatus.dueDateFormatted}). Please ensure research checklist items are in progress.`;
    } else if (reminder.reminderType === 'ONE_DAY_BEFORE') {
      reminderSubject = `[Due in 1 Working Day] ${groupName}: ${assignment.title}`;
      reminderBody = `Your research assignment for ${groupName} is due tomorrow (${deadlineStatus.dueDateFormatted}). Review your research deliverables before submission.`;
    } else if (reminder.reminderType === 'ON_DUE_DATE') {
      reminderSubject = `[Due Today] ${groupName}: ${assignment.title}`;
      reminderBody = `Your research assignment for ${groupName} is due today (${deadlineStatus.dueDateFormatted}, valid until 11:59 PM IST).`;
    }

    try {
      // 1. In-app notification
      await prisma.notification.create({
        data: {
          userId: assignment.primaryAnalystId,
          title: reminderSubject,
          message: reminderBody,
          type: 'ASSIGNMENT',
          link: `/my-tasks/${assignment.id}`,
        },
      });

      // 2. Email dispatch if email exists
      if (analystEmail) {
        await sendEmail({
          to: analystEmail,
          subject: reminderSubject,
          html: `<div style="font-family: sans-serif; background: #0a101f; color: #e2e8f0; padding: 24px; border-radius: 8px;">
            <h2 style="color: #10b981;">Working-Day Deadline Alert</h2>
            <p>Hello <strong>${analystName}</strong>,</p>
            <p>${reminderBody}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/my-tasks/${assignment.id}" style="display: inline-block; background: #10b981; color: #022c22; padding: 10px 20px; font-weight: bold; text-decoration: none; border-radius: 6px;">Open Task Workbench</a></p>
          </div>`,
          templateType: `DEADLINE_REMINDER_${reminder.reminderType}`,
          idempotencyKey: `rem-${reminder.id}`,
        });
      }

      await prisma.assignmentReminderSchedule.update({
        where: { id: reminder.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      sentCount++;
    } catch (err: any) {
      await prisma.assignmentReminderSchedule.update({
        where: { id: reminder.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
    }
  }

  return {
    processedCount: pending.length,
    sentCount,
    skippedCount,
  };
}
