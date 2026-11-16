/**
 * Date Normalization & Timezone Utilities
 * Timezone: Asia/Kolkata (IST, UTC+05:30)
 *
 * Enforces strict date semantics:
 * - Distinguishes seconds vs milliseconds
 * - Missing or invalid timestamps stay NULL
 * - Computes Asia/Kolkata calendar month boundaries in UTC
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

// IST is UTC+5:30 (+330 minutes)
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

export interface ISTMonthRange {
  year: number;
  month: number; // 1 - 12
  monthKey: string; // "YYYY-MM"
  startUTC: Date; // e.g. 2026-10-31T18:30:00.000Z for 2026-11-01 00:00:00 IST
  endUTC: Date;   // exclusive e.g. 2026-11-30T18:30:00.000Z for 2026-12-01 00:00:00 IST
}

/**
 * Computes exact IST month boundaries in UTC.
 * @param year e.g. 2026
 * @param month 1-12 (e.g. 11 for November)
 */
export function getISTMonthBoundaries(year: number, month: number): ISTMonthRange {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month ${month}. Must be 1-12.`);
  }

  // Next month calculation
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  // Month starts at 00:00:00.000 IST
  // In UTC: Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS
  const startMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endMs = Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;

  const monthStr = month.toString().padStart(2, '0');

  return {
    year,
    month,
    monthKey: `${year}-${monthStr}`,
    startUTC: new Date(startMs),
    endUTC: new Date(endMs),
  };
}

/**
 * Returns the IST month range for a given date or current time.
 */
export function getCurrentISTMonthBoundaries(referenceDate: Date = new Date()): ISTMonthRange {
  // Convert referenceDate to IST parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
  });

  const parts = formatter.formatToParts(referenceDate);
  let year = referenceDate.getUTCFullYear();
  let month = referenceDate.getUTCMonth() + 1;

  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
  }

  return getISTMonthBoundaries(year, month);
}

/**
 * Safely parses any date input (string, number, Date).
 * - Distinguishes unix seconds (< 1e11) vs ms
 * - Handles malformed strings gracefully
 * - Returns null on any parse failure (never substitutes new Date())
 */
export function parseSourceTimestamp(raw: string | number | Date | null | undefined): Date | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }

  if (typeof raw === 'number') {
    if (isNaN(raw) || raw <= 0) return null;
    // If raw < 1e11, it's Unix seconds (up to year 5138)
    const ms = raw < 100000000000 ? raw * 1000 : raw;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Numeric string check
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      return parseSourceTimestamp(num);
    }

    // Try standard ISO / Date parse
    // Handle 'YYYY-MM-DD HH:mm:ss' by replacing space with 'T' if missing
    let normalized = trimmed;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }

    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      return d;
    }

    // Direct fallback for Date.parse
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      return new Date(parsed);
    }
  }

  return null;
}

/**
 * Formats a Date in Asia/Kolkata (IST) display format: "DD MMM YYYY, HH:mm IST"
 * Returns "Unknown" if null/undefined/invalid.
 */
export function formatISTDisplay(date: Date | string | number | null | undefined): string {
  if (!date) return 'Unknown';
  const d = parseSourceTimestamp(date);
  if (!d) return 'Unknown';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${formatter.format(d)} IST`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Formats a Date in Asia/Kolkata (IST) date-only format: "DD MMM YYYY"
 */
export function formatISTDateOnly(date: Date | string | number | null | undefined): string {
  if (!date) return 'Unknown';
  const d = parseSourceTimestamp(date);
  if (!d) return 'Unknown';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return formatter.format(d);
  } catch {
    return 'Unknown';
  }
}

/**
 * Checks if a given timestamp falls within an IST calendar month.
 */
export function isDateInISTMonth(date: Date | string | number | null | undefined, year: number, month: number): boolean {
  const d = parseSourceTimestamp(date);
  if (!d) return false;
  const range = getISTMonthBoundaries(year, month);
  const time = d.getTime();
  return time >= range.startUTC.getTime() && time < range.endUTC.getTime();
}
