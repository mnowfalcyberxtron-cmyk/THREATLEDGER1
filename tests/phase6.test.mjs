import test from 'node:test';
import assert from 'node:assert/strict';

// Test 1: Monthly Grouping in Asia/Kolkata
function calculateMonthlyTrends(events) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    year: 'numeric',
  });

  const map = new Map();
  events.forEach((evt) => {
    const key = formatter.format(new Date(evt.timestamp));
    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries()).map(([month, count]) => ({ month, count }));
}

// Test 2: CSV Generation and Escaping
function generateGroupsCsv(groups) {
  const headers = ['ID', 'Group Name', 'Victims', 'Newly Detected'];
  const rows = groups.map((g) => [
    `"${g.id}"`,
    `"${g.name.replace(/"/g, '""')}"`,
    g.victimCount,
    g.isNewlyDetected ? 'YES' : 'NO',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

// Test 3: Storage Quota Warnings (70%, 85%, 95%)
function evaluateStorageThreshold(usedBytes, quotaBytes) {
  const percent = (usedBytes / quotaBytes) * 100;
  if (percent >= 95) return 'CRITICAL';
  if (percent >= 85) return 'WARNING';
  if (percent >= 70) return 'ATTENTION';
  return 'NORMAL';
}

test('Phase 6: Monthly CTI trend aggregation groups timestamps in Asia/Kolkata correctly', () => {
  const sampleEvents = [
    { timestamp: '2026-11-01T01:00:00Z' },
    { timestamp: '2026-11-10T14:30:00Z' },
    { timestamp: '2026-10-15T12:00:00Z' },
  ];

  const trends = calculateMonthlyTrends(sampleEvents);
  assert.equal(trends.length, 2);

  const nov = trends.find((t) => t.month.includes('Nov'));
  const oct = trends.find((t) => t.month.includes('Oct'));

  assert.equal(nov?.count, 2);
  assert.equal(oct?.count, 1);
});

test('Phase 6: CSV Export generates RFC 4180 compliant escaping for quotes and commas', () => {
  const groups = [
    { id: '1', name: 'LockBit 3.0', victimCount: 150, isNewlyDetected: false },
    { id: '2', name: 'BlackCat / ALPHV, Inc. "Dark"', victimCount: 88, isNewlyDetected: true },
  ];

  const csv = generateGroupsCsv(groups);
  assert.match(csv, /ID,Group Name,Victims,Newly Detected/);
  assert.match(csv, /"BlackCat \/ ALPHV, Inc\. ""Dark"""/);
  assert.match(csv, /88,YES/);
});

test('Phase 6: Storage quota thresholds trigger progressive alerts at 70%, 85%, and 95%', () => {
  const quota = 100 * 1024 * 1024 * 1024; // 100 GB

  assert.equal(evaluateStorageThreshold(50 * 1024 * 1024 * 1024, quota), 'NORMAL');
  assert.equal(evaluateStorageThreshold(72 * 1024 * 1024 * 1024, quota), 'ATTENTION');
  assert.equal(evaluateStorageThreshold(86 * 1024 * 1024 * 1024, quota), 'WARNING');
  assert.equal(evaluateStorageThreshold(96 * 1024 * 1024 * 1024, quota), 'CRITICAL');
});
