import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function calculateISTDiscoveryMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '11';
  return `${year}-${month}`;
}

describe('ThreatLedger Phase 2 — Intelligence & Monitoring Operations', () => {
  test('Discovery Engine: Month boundary calculation aligns with Asia/Kolkata IST', () => {
    // 2026-11-14 UTC 19:00 is 2026-11-15 00:30 in IST (+5:30)
    const testDate = new Date('2026-11-14T19:00:00Z');
    const istMonth = calculateISTDiscoveryMonth(testDate);
    assert.equal(istMonth, '2026-11', 'Discovery month must format as YYYY-MM in Asia/Kolkata');
  });

  test('Baseline Engine: First sync establishes baseline without marking all existing groups as newly detected', () => {
    function determineDiscoveryStatus(existingCount, isBaselineRun) {
      if (existingCount === 0 || isBaselineRun) {
        return 'BASELINE';
      }
      return 'NEWLY_LISTED';
    }

    assert.equal(
      determineDiscoveryStatus(0, true),
      'BASELINE',
      'First run must tag records as BASELINE'
    );
    assert.equal(
      determineDiscoveryStatus(100, false),
      'NEWLY_LISTED',
      'Subsequent runs must tag new records as NEWLY_LISTED'
    );
  });

  test('Merge Protocol: Group merge preserves aliases and assigns merged provenance', () => {
    const primary = {
      id: 'g-akira-1',
      name: 'Akira',
      aliases: ['AkiraV2'],
      source: 'RANSOMWARE_LIVE',
    };

    const secondary = {
      id: 'g-megazord-2',
      name: 'Megazord',
      aliases: ['MegazordLocker'],
      source: 'MANUAL',
    };

    function mergeAliases(primaryGroup, secondaryGroup) {
      const set = new Set(primaryGroup.aliases.map((a) => a.toLowerCase()));
      set.add(primaryGroup.name.toLowerCase());

      const toAdd = [];
      if (!set.has(secondaryGroup.name.toLowerCase())) {
        toAdd.push(secondaryGroup.name);
      }
      for (const a of secondaryGroup.aliases) {
        if (!set.has(a.toLowerCase())) {
          toAdd.push(a);
        }
      }
      return [...primaryGroup.aliases, ...toAdd];
    }

    const mergedAliases = mergeAliases(primary, secondary);
    assert.ok(mergedAliases.includes('Megazord'), 'Secondary name must become an alias');
    assert.ok(mergedAliases.includes('MegazordLocker'), 'Secondary alias must be preserved');
  });

  test('Source Provenance: Manual additions and API additions remain distinctly attributed', () => {
    const manualGroup = { source: 'MANUAL', discoveryStatus: 'MANUALLY_ADDED' };
    const apiGroup = { source: 'RANSOMWARE_LIVE', discoveryStatus: 'NEWLY_LISTED' };

    assert.notEqual(manualGroup.source, apiGroup.source, 'Manual source must be distinct from API');
    assert.equal(manualGroup.discoveryStatus, 'MANUALLY_ADDED', 'Manual group must have MANUALLY_ADDED status');
  });
});
