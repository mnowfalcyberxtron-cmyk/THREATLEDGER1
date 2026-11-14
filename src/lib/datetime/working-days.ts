/**
 * ThreatLedger Working-Day Calculation Utility
 *
 * Enforces strict Monday-Friday working-day schedule across ThreatLedger.
 * Excludes Saturdays and Sundays from all assignment deadline calculations.
 * Timezone: Asia/Kolkata (IST, UTC+5:30).
 *
 * Rules:
 * 1. Monday - Friday are working days.
 * 2. Saturday and Sunday are NON-working days (NEVER valid as assignment deadlines).
 * 3. Deadlines remain valid until 23:59:59.999 IST on the selected calendar date.
 * 4. Overdue calculations start on the next working day following the deadline.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface ISTCalendarParts {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 31
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dateString: string; // "YYYY-MM-DD"
}

/**
 * Extracts year, month, day, and day-of-week strictly in the Asia/Kolkata timezone.
 */
export function getISTCalendarParts(inputDate: Date | string | number): ISTCalendarParts {
  const d = new Date(inputDate);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date provided to getISTCalendarParts');
  }

  // Format parts in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(d);
  let year = 0;
  let month = 0;
  let day = 0;
  let weekdayStr = '';

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayStr = p.value;
  }

  // Map weekday to 0-6 (0=Sun, 6=Sat)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateString = `${year}-${mm}-${dd}`;

  return { year, month, day, dayOfWeek, dateString };
}

/**
 * Checks if a given date falls on a weekend (Saturday or Sunday) in Asia/Kolkata.
 */
export function isWeekendInIST(date: Date | string | number): boolean {
  const parts = getISTCalendarParts(date);
  return parts.dayOfWeek === 0 || parts.dayOfWeek === 6;
}

/**
 * Checks if a given date is a working day (Monday through Friday) in Asia/Kolkata.
 */
export function isWorkingDayInIST(date: Date | string | number): boolean {
  return !isWeekendInIST(date);
}

/**
 * Creates a UTC Date representing 23:59:59.999 IST on the given calendar date (YYYY-MM-DD).
 * IST is UTC+05:30, so 23:59:59.999 IST is 18:29:59.999 UTC of the same day.
 */
export function parseISTCalendarDateToEndOfDay(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date string "${dateStr}". Expected YYYY-MM-DD format.`);
  }

  // 23:59:59.999 in IST = (23 - 5.5 hours) UTC = 18:29:59.999 UTC
  return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
}

/**
 * Creates a UTC Date representing 09:00:00.000 IST on the given calendar date (YYYY-MM-DD).
 * 09:00:00.000 IST is 03:30:00.000 UTC of the same day.
 */
export function parseISTCalendarDateTo9AM(dateStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // 09:00 IST = 03:30 UTC
  return new Date(Date.UTC(year, month - 1, day, 3, 30, 0, 0));
}

/**
 * Validates that an assignment deadline is strictly Monday through Friday.
 * Throws a descriptive validation error if it falls on Saturday or Sunday.
 */
export function validateWorkingDayDeadline(date: Date | string | number | null | undefined): {
  valid: boolean;
  error?: string;
  dateString?: string;
} {
  if (!date) {
    return { valid: true };
  }

  try {
    const parts = getISTCalendarParts(date);
    if (parts.dayOfWeek === 6) {
      return {
        valid: false,
        error: `Invalid deadline (${parts.dateString}): Saturday is a non-working day. All assignment deadlines must be scheduled on Monday through Friday.`,
        dateString: parts.dateString,
      };
    }
    if (parts.dayOfWeek === 0) {
      return {
        valid: false,
        error: `Invalid deadline (${parts.dateString}): Sunday is a non-working day. All assignment deadlines must be scheduled on Monday through Friday.`,
        dateString: parts.dateString,
      };
    }

    return { valid: true, dateString: parts.dateString };
  } catch {
    return { valid: false, error: 'Invalid date format provided for assignment deadline.' };
  }
}

/**
 * Adds a specified number of working days to a calendar date, skipping weekends.
 */
export function addWorkingDays(startDate: Date | string, workingDaysToAdd: number): Date {
  const parts = getISTCalendarParts(startDate);
  let current = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  let added = 0;

  while (added < workingDaysToAdd) {
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    if (isWorkingDayInIST(current)) {
      added++;
    }
  }

  return current;
}

/**
 * Subtracts a specified number of working days from a calendar date, skipping weekends.
 */
export function subtractWorkingDays(startDate: Date | string, workingDaysToSubtract: number): Date {
  const parts = getISTCalendarParts(startDate);
  let current = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  let subtracted = 0;

  while (subtracted < workingDaysToSubtract) {
    current = new Date(current.getTime() - 24 * 60 * 60 * 1000);
    if (isWorkingDayInIST(current)) {
      subtracted++;
    }
  }

  return current;
}

/**
 * Counts the number of working days strictly between two dates, excluding weekends.
 *
 * Example:
 * If start = Friday (Nov 20) and end = Monday (Nov 23),
 * Friday is 1 working day before Monday.
 */
export function countWorkingDaysBetween(startDate: Date | string, endDate: Date | string): number {
  const startParts = getISTCalendarParts(startDate);
  const endParts = getISTCalendarParts(endDate);

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  if (startUtc === endUtc) {
    return 0;
  }

  const isForward = endUtc > startUtc;
  let count = 0;
  let current = new Date(startUtc);

  while (true) {
    current = new Date(current.getTime() + (isForward ? 1 : -1) * 24 * 60 * 60 * 1000);
    const curParts = getISTCalendarParts(current);
    const curUtc = Date.UTC(curParts.year, curParts.month - 1, curParts.day);

    if (curParts.dayOfWeek !== 0 && curParts.dayOfWeek !== 6) {
      count++;
    }

    if (curUtc === endUtc) {
      break;
    }
  }

  return isForward ? count : -count;
}

export interface WorkingDayDeadlineStatus {
  isOverdue: boolean;
  isDueToday: boolean;
  workingDaysRemaining: number;
  workingDaysOverdue: number;
  label: string;
  badgeVariant: 'emerald' | 'amber' | 'rose' | 'slate';
  dueDateFormatted: string;
}

/**
 * Evaluates the working-day status of an assignment deadline.
 *
 * Semantics:
 * - Deadline is valid until 23:59:59.999 IST on the deadline date.
 * - If today (in IST) is the deadline date: "Due today" (0 days remaining, not overdue).
 * - If today (in IST) is prior to the deadline date: "Due in X working day(s)".
 *   (e.g., Friday before Monday deadline = "Due in 1 working day").
 * - If today (in IST) is after the deadline date:
 *   Overdue status begins on the next working day.
 *   Weekend days (Sat/Sun) do NOT count toward overdue working days.
 *   (e.g., Deadline was Friday; on Monday it is "Overdue by 1 working day").
 */
export function getWorkingDayDeadlineStatus(
  dueDate: Date | string | null | undefined,
  referenceNow: Date = new Date()
): WorkingDayDeadlineStatus {
  if (!dueDate) {
    return {
      isOverdue: false,
      isDueToday: false,
      workingDaysRemaining: 0,
      workingDaysOverdue: 0,
      label: 'No Deadline',
      badgeVariant: 'slate',
      dueDateFormatted: 'Flexible Deadline',
    };
  }

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) {
    return {
      isOverdue: false,
      isDueToday: false,
      workingDaysRemaining: 0,
      workingDaysOverdue: 0,
      label: 'Invalid Date',
      badgeVariant: 'slate',
      dueDateFormatted: 'Invalid Date',
    };
  }

  const dueParts = getISTCalendarParts(due);
  const nowParts = getISTCalendarParts(referenceNow);

  // Formatted date
  const dueDateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  }).format(due);

  // End of deadline day in IST (23:59:59.999 IST)
  const deadlineEndOfDay = parseISTCalendarDateToEndOfDay(dueParts.dateString);

  // Same calendar date in IST
  if (dueParts.dateString === nowParts.dateString) {
    return {
      isOverdue: false,
      isDueToday: true,
      workingDaysRemaining: 0,
      workingDaysOverdue: 0,
      label: 'Due today',
      badgeVariant: 'amber',
      dueDateFormatted,
    };
  }

  // If now is strictly before the deadline end-of-day
  if (referenceNow.getTime() <= deadlineEndOfDay.getTime()) {
    // Count remaining working days from today to due date
    const remaining = countWorkingDaysBetween(nowParts.dateString, dueParts.dateString);
    const dayLabel = remaining === 1 ? '1 working day' : `${remaining} working days`;
    return {
      isOverdue: false,
      isDueToday: false,
      workingDaysRemaining: remaining,
      workingDaysOverdue: 0,
      label: `Due in ${dayLabel}`,
      badgeVariant: remaining <= 2 ? 'amber' : 'emerald',
      dueDateFormatted,
    };
  }

  // If now is after deadline end-of-day: overdue!
  // Overdue working days calculation begins on next working day after deadline.
  // We count working days from due date's calendar date to today's calendar date.
  // Note: if deadline was Friday, Saturday and Sunday are NOT working days.
  // On Saturday/Sunday, overdue working days count is 0 until Monday arrives (1 working day overdue).
  const daysDiff = countWorkingDaysBetween(dueParts.dateString, nowParts.dateString);
  const overdueCount = Math.max(1, daysDiff);
  const dayLabel = overdueCount === 1 ? '1 working day' : `${overdueCount} working days`;

  return {
    isOverdue: true,
    isDueToday: false,
    workingDaysRemaining: 0,
    workingDaysOverdue: overdueCount,
    label: `Overdue by ${dayLabel}`,
    badgeVariant: 'rose',
    dueDateFormatted,
  };
}

/**
 * Calculates the standard working-day reminder schedule for an assignment deadline:
 * 1. Two working days before deadline (9:00 AM IST)
 * 2. One working day before deadline (9:00 AM IST)
 * 3. On the deadline date (9:00 AM IST)
 *
 * Skips Saturdays and Sundays.
 */
export function calculateWorkingDayReminderSchedule(dueDate: Date | string): Array<{
  reminderType: 'TWO_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'ON_DUE_DATE';
  scheduledFor: Date;
  scheduledForISTString: string;
}> {
  const parts = getISTCalendarParts(dueDate);
  const deadlineBase = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));

  // 1. On due date at 09:00 AM IST
  const onDueDate = parseISTCalendarDateTo9AM(parts.dateString);

  // 2. One working day before
  const oneDayBeforeDate = subtractWorkingDays(deadlineBase, 1);
  const oneDayBeforeParts = getISTCalendarParts(oneDayBeforeDate);
  const oneDayBefore = parseISTCalendarToTime(oneDayBeforeParts.dateString, 9, 0);

  // 3. Two working days before
  const twoDaysBeforeDate = subtractWorkingDays(deadlineBase, 2);
  const twoDaysBeforeParts = getISTCalendarParts(twoDaysBeforeDate);
  const twoDaysBefore = parseISTCalendarToTime(twoDaysBeforeParts.dateString, 9, 0);

  return [
    {
      reminderType: 'TWO_DAYS_BEFORE',
      scheduledFor: twoDaysBefore,
      scheduledForISTString: `${twoDaysBeforeParts.dateString} 09:00 IST`,
    },
    {
      reminderType: 'ONE_DAY_BEFORE',
      scheduledFor: oneDayBefore,
      scheduledForISTString: `${oneDayBeforeParts.dateString} 09:00 IST`,
    },
    {
      reminderType: 'ON_DUE_DATE',
      scheduledFor: onDueDate,
      scheduledForISTString: `${parts.dateString} 09:00 IST`,
    },
  ];
}

function parseISTCalendarToTime(dateStr: string, hourIST: number, minuteIST: number): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Convert IST (UTC+5:30) to UTC
  // UTC hour = hourIST - 5.5
  const totalMinutesIST = hourIST * 60 + minuteIST;
  const totalMinutesUTC = totalMinutesIST - 330; // 5 hours 30 mins = 330 mins
  const utcHour = Math.floor(totalMinutesUTC / 60);
  const utcMinute = totalMinutesUTC % 60;

  return new Date(Date.UTC(year, month - 1, day, utcHour, utcMinute, 0, 0));
}
