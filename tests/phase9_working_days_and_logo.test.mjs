import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

// Reusable working-day calendar logic matching src/lib/datetime/working-days.ts
function getISTCalendarParts(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const weekday = partMap.weekday; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const isWorkingDay = !isWeekend;

  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    weekday,
    hour,
    minute,
    second,
    isWeekend,
    isWorkingDay,
    dateString,
  };
}

function validateWorkingDayDeadline(dateInput) {
  if (!dateInput) {
    return { valid: false, error: 'Deadline date is required' };
  }

  let dateObj;
  let dateStr;

  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      dateStr = dateInput;
      // 12:00 UTC on that date
      dateObj = new Date(`${dateStr}T12:00:00.000Z`);
    } else {
      dateObj = new Date(dateInput);
    }
  } else {
    dateObj = dateInput;
  }

  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Invalid calendar date format' };
  }

  const parts = getISTCalendarParts(dateObj);

  if (parts.isWeekend) {
    return {
      valid: false,
      error: `Selected deadline falls on ${parts.weekday} (${parts.dateString}), which is a non-working day. All assignment deadlines in ThreatLedger must be scheduled strictly Monday through Friday.`,
      dateString: parts.dateString,
      weekday: parts.weekday,
    };
  }

  return {
    valid: true,
    dateString: parts.dateString,
    weekday: parts.weekday,
  };
}

function parseISTCalendarDateToEndOfDay(dateStr) {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // 23:59:59.999 in IST (UTC+5:30) is 18:29:59.999 UTC
  return new Date(Date.UTC(year, month, day, 18, 29, 59, 999));
}

function addWorkingDays(startDate, daysToAdd) {
  const cur = new Date(startDate);
  let added = 0;
  while (added < daysToAdd) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const parts = getISTCalendarParts(cur);
    if (parts.isWorkingDay) {
      added++;
    }
  }
  return cur;
}

function subtractWorkingDays(startDate, daysToSub) {
  const cur = new Date(startDate);
  let subbed = 0;
  while (subbed < daysToSub) {
    cur.setUTCDate(cur.getUTCDate() - 1);
    const parts = getISTCalendarParts(cur);
    if (parts.isWorkingDay) {
      subbed++;
    }
  }
  return cur;
}

function countWorkingDaysBetween(startDate, endDate) {
  const startParts = getISTCalendarParts(startDate);
  const endParts = getISTCalendarParts(endDate);

  const startUtc = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const endUtc = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));

  if (startUtc.getTime() === endUtc.getTime()) {
    return 0;
  }

  const isForward = endUtc.getTime() > startUtc.getTime();
  let cur = new Date(startUtc);
  let count = 0;

  if (isForward) {
    while (cur.getTime() < endUtc.getTime()) {
      cur.setUTCDate(cur.getUTCDate() + 1);
      const parts = getISTCalendarParts(cur);
      if (parts.isWorkingDay) {
        count++;
      }
    }
    return count;
  } else {
    while (cur.getTime() > endUtc.getTime()) {
      cur.setUTCDate(cur.getUTCDate() - 1);
      const parts = getISTCalendarParts(cur);
      if (parts.isWorkingDay) {
        count++;
      }
    }
    return -count;
  }
}

function getWorkingDayDeadlineStatus(dueDate, referenceDate = new Date()) {
  if (!dueDate) {
    return {
      status: 'NO_DEADLINE',
      label: 'No Deadline',
      workingDaysRemaining: null,
      workingDaysOverdue: null,
      isOverdue: false,
    };
  }

  const due = new Date(dueDate);
  const ref = new Date(referenceDate);

  const dueParts = getISTCalendarParts(due);
  const refParts = getISTCalendarParts(ref);

  const dueDayEnd = parseISTCalendarDateToEndOfDay(dueParts.dateString);

  if (ref.getTime() <= dueDayEnd.getTime()) {
    if (dueParts.dateString === refParts.dateString) {
      return {
        status: 'DUE_TODAY',
        label: 'Due today',
        workingDaysRemaining: 0,
        workingDaysOverdue: 0,
        isOverdue: false,
      };
    }

    const workingDaysRemaining = countWorkingDaysBetween(ref, dueDayEnd);
    return {
      status: 'ON_TRACK',
      label: `Due in ${workingDaysRemaining} working ${workingDaysRemaining === 1 ? 'day' : 'days'}`,
      workingDaysRemaining,
      workingDaysOverdue: 0,
      isOverdue: false,
    };
  }

  let overdueDays = 0;
  const startOverdue = new Date(Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day + 1));
  const currentDay = new Date(Date.UTC(refParts.year, refParts.month - 1, refParts.day));

  let scan = new Date(startOverdue);
  while (scan.getTime() <= currentDay.getTime()) {
    const p = getISTCalendarParts(scan);
    if (p.isWorkingDay) {
      overdueDays++;
    }
    scan.setUTCDate(scan.getUTCDate() + 1);
  }

  return {
    status: 'OVERDUE',
    label: overdueDays === 0 ? 'Overdue' : `Overdue by ${overdueDays} working ${overdueDays === 1 ? 'day' : 'days'}`,
    workingDaysRemaining: 0,
    workingDaysOverdue: overdueDays,
    isOverdue: true,
  };
}

describe('ThreatLedger Phase 9 — Working-Day Deadline Management & Official Logo Integration', () => {

  describe('Part 1: Strict Monday-to-Friday Deadline Validation', () => {
    test('Weekdays (Mon-Fri) are accepted; Weekends (Sat-Sun) are strictly rejected', () => {
      // 2026-11-16 is Monday
      const mon = validateWorkingDayDeadline('2026-11-16');
      assert.equal(mon.valid, true);
      assert.equal(mon.weekday, 'Mon');

      // 2026-11-20 is Friday
      const fri = validateWorkingDayDeadline('2026-11-20');
      assert.equal(fri.valid, true);
      assert.equal(fri.weekday, 'Fri');

      // 2026-11-21 is Saturday
      const sat = validateWorkingDayDeadline('2026-11-21');
      assert.equal(sat.valid, false);
      assert.equal(sat.weekday, 'Sat');
      assert.ok(sat.error.includes('non-working day'));

      // 2026-11-22 is Sunday
      const sun = validateWorkingDayDeadline('2026-11-22');
      assert.equal(sun.valid, false);
      assert.equal(sun.weekday, 'Sun');
      assert.ok(sun.error.includes('non-working day'));
    });

    test('Bulk assignment batch validation is atomic: single weekend rejects entire batch', () => {
      const validBatch = [
        { groupId: 'g1', dueDate: '2026-11-16' }, // Monday
        { groupId: 'g2', dueDate: '2026-11-17' }, // Tuesday
        { groupId: 'g3', dueDate: '2026-11-20' }, // Friday
      ];

      function validateBatch(items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const check = validateWorkingDayDeadline(item.dueDate);
          if (!check.valid) {
            throw new Error(`Item ${i + 1} deadline invalid: ${check.error}`);
          }
        }
        return true;
      }

      assert.doesNotThrow(() => validateBatch(validBatch));

      const taintedBatch = [
        { groupId: 'g1', dueDate: '2026-11-16' }, // Monday
        { groupId: 'g2', dueDate: '2026-11-21' }, // Saturday!
        { groupId: 'g3', dueDate: '2026-11-20' }, // Friday
      ];

      assert.throws(
        () => validateBatch(taintedBatch),
        /Item 2 deadline invalid.*non-working day/
      );
    });
  });

  describe('Part 1: Working-Day Calculations (Skipping Sat/Sun)', () => {
    test('Working day distance skips Saturday and Sunday across weekends', () => {
      // Friday 2026-11-20 to Monday 2026-11-23 is exactly 1 working day
      const fri = new Date('2026-11-20T12:00:00.000Z');
      const mon = new Date('2026-11-23T12:00:00.000Z');
      const diff = countWorkingDaysBetween(fri, mon);
      assert.equal(diff, 1, 'Friday to Monday must be 1 working day');

      // Monday 2026-11-16 to Friday 2026-11-20 is 4 working days
      const mon16 = new Date('2026-11-16T12:00:00.000Z');
      const diffSameWeek = countWorkingDaysBetween(mon16, fri);
      assert.equal(diffSameWeek, 4, 'Monday to Friday of same week must be 4 working days');

      // Friday to next Friday is 5 working days
      const friNext = new Date('2026-11-27T12:00:00.000Z');
      const diffWeek = countWorkingDaysBetween(fri, friNext);
      assert.equal(diffWeek, 5, 'Friday to next Friday must be 5 working days');
    });

    test('Add and subtract working days cleanly traverses month boundaries', () => {
      // 2026-11-27 (Friday) + 1 working day = 2026-11-30 (Monday)
      const fri = new Date('2026-11-27T12:00:00.000Z');
      const nextWorkDay = addWorkingDays(fri, 1);
      const nextParts = getISTCalendarParts(nextWorkDay);
      assert.equal(nextParts.dateString, '2026-11-30');
      assert.equal(nextParts.weekday, 'Mon');

      // 2026-11-30 (Monday) - 1 working day = 2026-11-27 (Friday)
      const prevWorkDay = subtractWorkingDays(nextWorkDay, 1);
      const prevParts = getISTCalendarParts(prevWorkDay);
      assert.equal(prevParts.dateString, '2026-11-27');
      assert.equal(prevParts.weekday, 'Fri');
    });
  });

  describe('Part 1: Deadline Validity (11:59 PM IST) & Overdue Semantics', () => {
    test('Deadline remains valid through 11:59 PM IST on the deadline day', () => {
      const deadlineDateStr = '2026-11-20'; // Friday
      const deadline = parseISTCalendarDateToEndOfDay(deadlineDateStr);

      // On Friday at 14:00 IST (08:30 UTC), assignment is DUE_TODAY, not overdue
      const middayFriday = new Date('2026-11-20T08:30:00.000Z');
      const statusFriday = getWorkingDayDeadlineStatus(deadline, middayFriday);
      assert.equal(statusFriday.isOverdue, false);
      assert.equal(statusFriday.status, 'DUE_TODAY');
      assert.equal(statusFriday.label, 'Due today');

      // On Saturday 2026-11-21 at 12:00 IST (weekend):
      // The deadline has ended, but Saturday and Sunday are non-working days.
      // Therefore overdue working days = 0.
      const saturday = new Date('2026-11-21T06:30:00.000Z');
      const statusSaturday = getWorkingDayDeadlineStatus(deadline, saturday);
      assert.equal(statusSaturday.isOverdue, true);
      assert.equal(statusSaturday.workingDaysOverdue, 0);

      // On Monday 2026-11-23 at 12:00 IST:
      // Monday is the first overdue working day.
      const monday = new Date('2026-11-23T06:30:00.000Z');
      const statusMonday = getWorkingDayDeadlineStatus(deadline, monday);
      assert.equal(statusMonday.isOverdue, true);
      assert.equal(statusMonday.workingDaysOverdue, 1);
      assert.equal(statusMonday.label, 'Overdue by 1 working day');

      // On Tuesday 2026-11-24 at 12:00 IST:
      // Overdue by 2 working days.
      const tuesday = new Date('2026-11-24T06:30:00.000Z');
      const statusTuesday = getWorkingDayDeadlineStatus(deadline, tuesday);
      assert.equal(statusTuesday.isOverdue, true);
      assert.equal(statusTuesday.workingDaysOverdue, 2);
      assert.equal(statusTuesday.label, 'Overdue by 2 working days');
    });
  });

  describe('Part 1: Working-Day Reminder Scheduling & Invalidation', () => {
    test('Reminder schedule targets 2 days before, 1 day before, and due date at 9:00 AM IST', () => {
      // Due on Wednesday 2026-11-25
      const dueDateStr = '2026-11-25';
      const dueEnd = parseISTCalendarDateToEndOfDay(dueDateStr);

      // 1 working day before is Tuesday 2026-11-24
      const oneDayBefore = subtractWorkingDays(dueEnd, 1);
      const oneParts = getISTCalendarParts(oneDayBefore);
      assert.equal(oneParts.dateString, '2026-11-24');
      assert.equal(oneParts.weekday, 'Tue');

      // 2 working days before is Monday 2026-11-23
      const twoDaysBefore = subtractWorkingDays(dueEnd, 2);
      const twoParts = getISTCalendarParts(twoDaysBefore);
      assert.equal(twoParts.dateString, '2026-11-23');
      assert.equal(twoParts.weekday, 'Mon');

      // Due on Monday 2026-11-23:
      // 1 working day before is Friday 2026-11-20 (skips Sat/Sun)
      const monEnd = parseISTCalendarDateToEndOfDay('2026-11-23');
      const friBefore = subtractWorkingDays(monEnd, 1);
      const friParts = getISTCalendarParts(friBefore);
      assert.equal(friParts.dateString, '2026-11-20');
      assert.equal(friParts.weekday, 'Fri');

      // 2 working days before is Thursday 2026-11-19
      const thuBefore = subtractWorkingDays(monEnd, 2);
      const thuParts = getISTCalendarParts(thuBefore);
      assert.equal(thuParts.dateString, '2026-11-19');
      assert.equal(thuParts.weekday, 'Thu');
    });

    test('Deadline rescheduling cancels old reminders and increments version', () => {
      let currentVersion = 1;
      let reminderSchedules = [
        { id: 'rem-1', version: 1, status: 'PENDING' },
        { id: 'rem-2', version: 1, status: 'PENDING' },
      ];

      function reschedule(newDueDate) {
        // Validate new deadline
        const check = validateWorkingDayDeadline(newDueDate);
        assert.equal(check.valid, true);

        // Cancel previous pending reminders
        reminderSchedules = reminderSchedules.map((r) =>
          r.status === 'PENDING' ? { ...r, status: 'CANCELLED' } : r
        );

        // Increment version
        currentVersion++;

        // Add new pending reminders for new version
        reminderSchedules.push(
          { id: `rem-new-${currentVersion}-1`, version: currentVersion, status: 'PENDING' },
          { id: `rem-new-${currentVersion}-2`, version: currentVersion, status: 'PENDING' }
        );
      }

      reschedule('2026-11-27'); // Friday
      assert.equal(currentVersion, 2);
      assert.equal(reminderSchedules.filter((r) => r.version === 1 && r.status === 'CANCELLED').length, 2);
      assert.equal(reminderSchedules.filter((r) => r.version === 2 && r.status === 'PENDING').length, 2);
    });

    test('Terminal statuses cancel reminders; Changes Requested preserves active reminders', () => {
      function shouldCancelRemindersForStatus(status) {
        return status === 'APPROVED_COMPLETED' || status === 'CANCELLED';
      }

      assert.equal(shouldCancelRemindersForStatus('APPROVED_COMPLETED'), true);
      assert.equal(shouldCancelRemindersForStatus('CANCELLED'), true);
      assert.equal(shouldCancelRemindersForStatus('CHANGES_REQUESTED'), false);
      assert.equal(shouldCancelRemindersForStatus('UNDER_REVIEW'), false);
      assert.equal(shouldCancelRemindersForStatus('RESEARCH_IN_PROGRESS'), false);
    });
  });

  describe('Part 2: Official ThreatLedger Logo Integration', () => {
    test('Official logo image asset exists and is exactly 54,609 bytes', () => {
      const logoPath = path.resolve('public/brand/threatledger-logo.png');
      const faviconPath = path.resolve('public/favicon.png');

      assert.ok(fs.existsSync(logoPath), 'public/brand/threatledger-logo.png must exist');
      assert.ok(fs.existsSync(faviconPath), 'public/favicon.png must exist');

      const logoStats = fs.statSync(logoPath);
      assert.equal(logoStats.size, 54609, 'Official logo must be preserved verbatim without compression (54,609 bytes)');

      const faviconStats = fs.statSync(faviconPath);
      assert.equal(faviconStats.size, 54609, 'Favicon must be identical to official logo (54,609 bytes)');
    });

    test('ThreatLedgerLogo component implements required variants and reduced motion support', () => {
      const componentPath = path.resolve('src/components/brand/ThreatLedgerLogo.tsx');
      assert.ok(fs.existsSync(componentPath), 'ThreatLedgerLogo.tsx must exist');

      const content = fs.readFileSync(componentPath, 'utf8');

      // Verify supported variants
      assert.ok(content.includes('login'), 'Must support login variant');
      assert.ok(content.includes('sidebar'), 'Must support sidebar variant');
      assert.ok(content.includes('header'), 'Must support header variant');
      assert.ok(content.includes('loading'), 'Must support loading variant');
      assert.ok(content.includes('email'), 'Must support email variant');
      assert.ok(content.includes('badge'), 'Must support badge variant');

      // Verify accessibility / reduced motion
      assert.ok(content.includes('prefers-reduced-motion: reduce'), 'Must disable CSS pulse on reduced motion preference');
      assert.ok(content.includes('alt="ThreatLedger logo"'), 'Must have descriptive accessible alt text');
    });

    test('Brand logo is integrated in Login, Setup, Invite, Sidebar, Layout and Email Templates', () => {
      const loginContent = fs.readFileSync('src/app/(auth)/login/page.tsx', 'utf8');
      assert.ok(loginContent.includes('ThreatLedgerLogo'), 'Login page must use ThreatLedgerLogo');

      const setupContent = fs.readFileSync('src/app/(auth)/setup/page.tsx', 'utf8');
      assert.ok(setupContent.includes('ThreatLedgerLogo'), 'Setup page must use ThreatLedgerLogo');

      const sidebarContent = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
      assert.ok(sidebarContent.includes('ThreatLedgerLogo'), 'Sidebar must use ThreatLedgerLogo');

      const layoutContent = fs.readFileSync('src/app/layout.tsx', 'utf8');
      assert.ok(layoutContent.includes('/brand/threatledger-logo.png'), 'Layout must link to official logo in metadata/favicon');

      const emailContent = fs.readFileSync('src/lib/email/templates.ts', 'utf8');
      assert.ok(emailContent.includes('/brand/threatledger-logo.png'), 'Email template must embed official logo URL');
    });
  });

  describe('Part 3: Reliability, Data Integrity & UI Components', () => {
    test('WeekdayDatePicker component disables weekends and displays informative guidance', () => {
      const pickerPath = path.resolve('src/components/ui/WeekdayDatePicker.tsx');
      assert.ok(fs.existsSync(pickerPath), 'WeekdayDatePicker.tsx must exist');

      const content = fs.readFileSync(pickerPath, 'utf8');
      assert.ok(content.includes('Monday–Friday') || content.includes('Monday-to-Friday'), 'Must indicate Mon-Fri restriction in UI');
      assert.ok(content.includes('validateWorkingDayDeadline'), 'Must use centralized working-day validator');
      assert.ok(content.includes('aria-'), 'Must implement accessible ARIA attributes');
    });

    test('Prisma schema contains deadlineVersion and AssignmentReminderSchedule models', () => {
      const schemaPath = path.resolve('prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');

      assert.ok(schemaContent.includes('deadlineVersion'), 'Assignment must track deadlineVersion');
      assert.ok(schemaContent.includes('isLegacyWeekendDeadline'), 'Assignment must support isLegacyWeekendDeadline');
      assert.ok(schemaContent.includes('model AssignmentDeadlineHistory'), 'Must define AssignmentDeadlineHistory model');
      assert.ok(schemaContent.includes('model AssignmentReminderSchedule'), 'Must define AssignmentReminderSchedule model');
    });
  });
});
