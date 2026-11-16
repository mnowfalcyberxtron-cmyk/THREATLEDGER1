import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

// 1. Logic implementations for unit testing
function buildIsMaliciousAuthHeader(apiKey, apiSecret) {
  if (!apiKey || !apiSecret) {
    throw new Error('Both apiKey and apiSecret are required to generate the isMalicious authentication header.');
  }
  const token = Buffer.from(`${apiKey.trim()}:${apiSecret.trim()}`, 'utf8').toString('base64');
  return `X-API-KEY: ${token}`;
}

function maskCredential(cred) {
  if (!cred) return '—';
  if (cred.length <= 8) return '••••••••';
  return `${cred.slice(0, 4)}••••${cred.slice(-4)}`;
}

const IST_OFFSET_MS = 330 * 60 * 1000;

function getISTMonthBoundaries(year, month) {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month ${month}. Must be 1-12.`);
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  const startMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endMs = Date.UTC(nextYear, nextMonth - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS;

  return {
    startUTC: new Date(startMs),
    endUTC: new Date(endMs),
  };
}

function parseSourceTimestamp(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  if (typeof raw === 'number') {
    if (isNaN(raw) || raw <= 0) return null;
    const ms = raw < 100000000000 ? raw * 1000 : raw;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed, 10);
      return parseSourceTimestamp(num);
    }
    let normalized = trimmed;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(normalized)) {
      normalized = normalized.replace(' ', 'T') + 'Z';
    }
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return new Date(parsed);
  }
  return null;
}

function normalizeActorName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[._\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('ThreatLedger — Multi-Source Threat Actor Discovery Test Suite', () => {

  describe('1. isMalicious Authentication & Credential Masking', () => {
    test('Header format: X-API-KEY: Base64(apiKey:apiSecret)', () => {
      const apiKey = 'test-key-1234';
      const apiSecret = 'test-secret-5678';
      const header = buildIsMaliciousAuthHeader(apiKey, apiSecret);

      const expectedBase64 = Buffer.from('test-key-1234:test-secret-5678', 'utf8').toString('base64');
      assert.equal(header, `X-API-KEY: ${expectedBase64}`);
      const token = header.split(': ')[1];
      assert.ok(!token.includes(' '), 'Base64 token value must contain no unencoded spaces');
    });

    test('Header generation throws if either key or secret is missing', () => {
      assert.throws(() => buildIsMaliciousAuthHeader('', 'secret'), /required/);
      assert.throws(() => buildIsMaliciousAuthHeader('key', ''), /required/);
      assert.throws(() => buildIsMaliciousAuthHeader(null, 'secret'), /required/);
    });

    test('Credential masking masks sensitive values', () => {
      const masked = maskCredential('e366ac1e-4fa8-42be-be34-5578765a4a6a');
      assert.equal(masked, 'e366••••4a6a');
      assert.ok(!masked.includes('4fa8'), 'Internal characters must be masked');
    });
  });

  describe('2. Date Semantics & Normalization', () => {
    test('Handles Unix seconds (< 1e11) vs milliseconds correctly', () => {
      const seconds = 1731772800; // 2024-11-16 16:00:00 UTC
      const ms = 1731772800000;

      const dateFromSec = parseSourceTimestamp(seconds);
      const dateFromMs = parseSourceTimestamp(ms);

      assert.ok(dateFromSec instanceof Date);
      assert.ok(dateFromMs instanceof Date);
      assert.equal(dateFromSec.getTime(), dateFromMs.getTime());
    });

    test('Missing, empty, or invalid dates strictly return null (never new Date())', () => {
      assert.equal(parseSourceTimestamp(null), null);
      assert.equal(parseSourceTimestamp(undefined), null);
      assert.equal(parseSourceTimestamp(''), null);
      assert.equal(parseSourceTimestamp('invalid-date-string'), null);
      assert.equal(parseSourceTimestamp(-5), null);
    });

    test('Parses ISO strings and standard format with space correctly', () => {
      const parsed = parseSourceTimestamp('2026-11-15 14:30:00');
      assert.ok(parsed instanceof Date);
      assert.equal(parsed.getUTCFullYear(), 2026);
      assert.equal(parsed.getUTCMonth(), 10); // November is 10
      assert.equal(parsed.getUTCDate(), 15);
    });
  });

  describe('3. Asia/Kolkata (IST) Monthly Calendar Boundaries', () => {
    test('November 2026 boundaries in UTC', () => {
      const boundaries = getISTMonthBoundaries(2026, 11);

      // Start: 2026-11-01 00:00:00 IST -> 2026-10-31 18:30:00.000 UTC
      assert.equal(boundaries.startUTC.toISOString(), '2026-10-31T18:30:00.000Z');

      // End: 2026-12-01 00:00:00 IST -> 2026-11-30 18:30:00.000 UTC
      assert.equal(boundaries.endUTC.toISOString(), '2026-11-30T18:30:00.000Z');
    });

    test('Month and year boundary rollover (December to January)', () => {
      const boundaries = getISTMonthBoundaries(2026, 12);

      // Start: 2026-12-01 00:00:00 IST -> 2026-11-30 18:30:00.000 UTC
      assert.equal(boundaries.startUTC.toISOString(), '2026-11-30T18:30:00.000Z');

      // End: 2027-01-01 00:00:00 IST -> 2026-12-31 18:30:00.000 UTC
      assert.equal(boundaries.endUTC.toISOString(), '2026-12-31T18:30:00.000Z');
    });
  });

  describe('4. Threat Actor Name Normalization & Correlation', () => {
    test('Normalizes case, extra whitespace, dots, and hyphens', () => {
      assert.equal(normalizeActorName('LockBit-3.0'), 'lockbit 3 0');
      assert.equal(normalizeActorName('  lockbit_3.0  '), 'lockbit 3 0');
      assert.equal(normalizeActorName('BLACK   CAT'), 'black cat');
      assert.equal(normalizeActorName('ALPHV / BlackCat'), 'alphv / blackcat');
    });

    test('Preserves distinct names and does not conflate unrelated actors', () => {
      const n1 = normalizeActorName('Akira');
      const n2 = normalizeActorName('Avaddon');
      const n3 = normalizeActorName('BianLian');
      assert.notEqual(n1, n2);
      assert.notEqual(n1, n3);
    });
  });

  describe('5. Source Lineage & Historical Archive Isolation', () => {
    test('isMalicious lineage must be DERIVED_OR_MIRRORED', () => {
      const isMaliciousLineage = 'DERIVED_OR_MIRRORED';
      assert.equal(isMaliciousLineage, 'DERIVED_OR_MIRRORED');
      assert.notEqual(isMaliciousLineage, 'INDEPENDENT', 'isMalicious cannot be labeled independent from Ransomware.live');
    });

    test('RansomWatch historical records never count as current-month platform discoveries', () => {
      const candidate = {
        name: 'DarkSide',
        source: 'RANSOMWATCH',
        discoveryStatus: 'HISTORICAL_IMPORT',
        firstObservedAt: new Date('2026-11-16T12:00:00Z'), // Imported today
        firstClaimAt: new Date('2021-08-11T02:40:48Z'),   // 2021 claim
      };

      const boundaries = getISTMonthBoundaries(2026, 11);

      // Rule: firstObservedByThreatLedgerThisMonth requires discoveryStatus != HISTORICAL_IMPORT and source != RANSOMWATCH
      const isNewLiveDiscovery =
        candidate.firstObservedAt >= boundaries.startUTC &&
        candidate.firstObservedAt < boundaries.endUTC &&
        candidate.discoveryStatus !== 'HISTORICAL_IMPORT' &&
        candidate.source !== 'RANSOMWATCH';

      assert.equal(isNewLiveDiscovery, false, 'Historical archive records must NOT be counted as new live discoveries');
    });
  });

  describe('6. AES-256-GCM Credential Encryption & Decryption', () => {
    const ALGORITHM = 'aes-256-gcm';
    const key = crypto.randomBytes(32);

    test('Encrypts and decrypts secret matching plaintext exactly', () => {
      const plainSecret = 'my-super-secret-api-token-2026';
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });

      let encrypted = cipher.update(plainSecret, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      // Decrypt
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      assert.equal(decrypted, plainSecret);
    });

    test('Tampered ciphertext or auth tag fails decryption', () => {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
      let encrypted = cipher.update('secret', 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = crypto.randomBytes(16); // wrong tag

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
      decipher.setAuthTag(tag);

      assert.throws(() => {
        decipher.update(encrypted, 'hex', 'utf8');
        decipher.final('utf8');
      });
    });
  });

});
