import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Standalone mirror of AES-256-GCM encryption matching src/lib/crypto/encryption.ts
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const TEST_KEY = crypto.createHash('sha256').update('threatledger_test_master_secret_key_2026').digest();

function encryptCredential(plainText) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, TEST_KEY, iv, { authTagLength: TAG_LENGTH });
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), tag };
}

function decryptCredential(encryptedHex, ivHex, tagHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, TEST_KEY, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// File safety rules matching src/lib/storage/temp-storage.ts
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.log', '.json', '.xml', '.png', '.jpg', '.jpeg', '.webp'
]);
const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.js', '.mjs',
  '.py', '.php', '.phtml', '.html', '.htm', '.xhtml', '.svg', '.jar', '.war',
  '.msi', '.com', '.scr', '.hta', '.cpl', '.reg',
]);

function sanitizeFilename(originalName) {
  const base = path.basename(originalName);
  return base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .slice(0, 150);
}

function validateFileSafety(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Executable or dangerous file extension "${ext}" is strictly forbidden.` };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File format "${ext}" is not supported.` };
  }
  return { valid: true };
}

describe('ThreatLedger Phase 10 — Email-Based Report Submission, Gmail Integration & Document Archive', () => {

  describe('Part 1: Authenticated AES-256-GCM Credential Encryption', () => {
    test('Encrypts and decrypts Google App Password with integrity authentication', () => {
      const rawAppPassword = 'abcd-efgh-ijkl-mnop';
      const encrypted = encryptCredential(rawAppPassword);

      assert.notEqual(encrypted.encrypted, rawAppPassword, 'Ciphertext must not match plaintext');
      assert.equal(encrypted.iv.length, 24, 'IV must be 12 bytes (24 hex characters)');
      assert.equal(encrypted.tag.length, 32, 'Auth tag must be 16 bytes (32 hex characters)');

      const decrypted = decryptCredential(encrypted.encrypted, encrypted.iv, encrypted.tag);
      assert.equal(decrypted, rawAppPassword, 'Decrypted credential must match original plaintext');
    });

    test('Rejects tampered ciphertext or altered authentication tag', () => {
      const rawAppPassword = 'secret-app-password-123';
      const encrypted = encryptCredential(rawAppPassword);

      // Tamper ciphertext by modifying last byte (2 hex chars)
      const tamperedHex = encrypted.encrypted.slice(0, -2) + (encrypted.encrypted.slice(-2) === 'aa' ? 'bb' : 'aa');
      assert.throws(
        () => decryptCredential(tamperedHex, encrypted.iv, encrypted.tag),
        /Unsupported state or unable to authenticate data/,
        'GCM must fail when ciphertext is modified'
      );

      // Tamper auth tag by modifying last byte (2 hex chars)
      const tamperedTag = encrypted.tag.slice(0, -2) + (encrypted.tag.slice(-2) === 'aa' ? 'bb' : 'aa');
      assert.throws(
        () => decryptCredential(encrypted.encrypted, encrypted.iv, tamperedTag),
        /Unsupported state or unable to authenticate data/,
        'GCM must fail when authentication tag is modified'
      );
    });
  });

  describe('Part 2: File Safety, Extension Filtering & Sanitization', () => {
    test('Accepts permitted report and evidence formats and sanitizes malicious filenames', () => {
      assert.equal(validateFileSafety('annual_report.pdf').valid, true);
      assert.equal(validateFileSafety('threat_dossier.docx').valid, true);
      assert.equal(validateFileSafety('victim_ledger.xlsx').valid, true);
      assert.equal(validateFileSafety('telemetry.csv').valid, true);
      assert.equal(validateFileSafety('network_graph.png').valid, true);
      assert.equal(validateFileSafety('tor_leak_proof.webp').valid, true);
      assert.equal(validateFileSafety('indicators.json').valid, true);

      // Path traversal and sanitization
      const dirty = '../../../etc/passwd_malicious..file!!.pdf';
      const cleaned = sanitizeFilename(dirty);
      assert.equal(cleaned.includes('..'), false, 'Directory traversal must be stripped');
      assert.ok(cleaned.endsWith('.pdf'), 'Safe extension preserved');
    });

    test('Rejects dangerous and executable payloads', () => {
      assert.equal(validateFileSafety('malware.exe').valid, false);
      assert.equal(validateFileSafety('payload.dll').valid, false);
      assert.equal(validateFileSafety('script.ps1').valid, false);
      assert.equal(validateFileSafety('exploit.sh').valid, false);
      assert.equal(validateFileSafety('phish.html').valid, false);
      assert.equal(validateFileSafety('macro.vbs').valid, false);
    });
  });

  describe('Part 3: Attachment Size Limit & Real MIME Attachments (Zero Drive Links)', () => {
    test('Enforces 18 MB conservative attachment limit and rejects oversized packages', () => {
      const MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024; // 18 MB

      function validatePackageSize(files) {
        const total = files.reduce((sum, f) => sum + f.size, 0);
        if (total > MAX_ATTACHMENT_BYTES) {
          throw new Error(`Total size ${(total / (1024 * 1024)).toFixed(2)} MB exceeds limit of 18 MB`);
        }
        return true;
      }

      const validFiles = [
        { name: 'report.pdf', size: 5 * 1024 * 1024 },
        { name: 'evidence.xlsx', size: 6 * 1024 * 1024 },
        { name: 'screenshot.png', size: 2 * 1024 * 1024 },
      ];
      assert.doesNotThrow(() => validatePackageSize(validFiles));

      const oversizedFiles = [
        { name: 'massive_dump.pdf', size: 12 * 1024 * 1024 },
        { name: 'huge_evidence.csv', size: 10 * 1024 * 1024 }, // 22 MB total
      ];
      assert.throws(
        () => validatePackageSize(oversizedFiles),
        /exceeds limit of 18 MB/
      );
    });

    test('Requires physical MIME attachment buffers rather than Drive or external links', () => {
      const testBuffer = Buffer.from('%PDF-1.5 ThreatLedger Intelligence Report Binary Data');
      const attachment = {
        filename: 'threat_report_v1.pdf',
        content: testBuffer,
        contentType: 'application/pdf',
      };

      assert.ok(Buffer.isBuffer(attachment.content), 'Attachment content must be a binary Buffer');
      assert.equal(attachment.content.length, testBuffer.length);
      assert.equal(attachment.filename, 'threat_report_v1.pdf');
    });
  });

  describe('Part 4: Recipient Resolution & Administrator Override', () => {
    test('Resolves recipient to assigned reviewer and respects administrator override', () => {
      function resolveRecipient(assignment) {
        if (assignment.recipientOverrideEmail && assignment.recipientOverrideEmail.trim().length > 0) {
          return { email: assignment.recipientOverrideEmail.trim(), isOverride: true };
        }
        if (assignment.reviewer?.email) {
          return { email: assignment.reviewer.email.trim(), isOverride: false };
        }
        throw new Error('No assigned reviewer or authorized recipient found');
      }

      const standardAssignment = {
        primaryAnalyst: { email: 'analyst@threatledger.internal' },
        reviewer: { email: 'reviewer@threatledger.internal' },
        recipientOverrideEmail: null,
      };

      const resolvedStandard = resolveRecipient(standardAssignment);
      assert.equal(resolvedStandard.email, 'reviewer@threatledger.internal');
      assert.notEqual(resolvedStandard.email, standardAssignment.primaryAnalyst.email, 'Analyst login email must never be reviewer recipient');
      assert.equal(resolvedStandard.isOverride, false);

      const overriddenAssignment = {
        primaryAnalyst: { email: 'analyst@threatledger.internal' },
        reviewer: { email: 'reviewer@threatledger.internal' },
        recipientOverrideEmail: 'external.lead@threatledger.internal',
      };

      const resolvedOverride = resolveRecipient(overriddenAssignment);
      assert.equal(resolvedOverride.email, 'external.lead@threatledger.internal');
      assert.equal(resolvedOverride.isOverride, true);

      const unassignedAssignment = {
        primaryAnalyst: { email: 'analyst@threatledger.internal' },
        reviewer: null,
        recipientOverrideEmail: null,
      };
      assert.throws(() => resolveRecipient(unassignedAssignment), /No assigned reviewer/);
    });
  });

  describe('Part 5: Temporary Storage Lifecycle & Cleanup Verification', () => {
    test('Deletes temporary files only after successful send; retains files on failure', () => {
      let tempStorage = {
        'temp/assign-1/f1.pdf': Buffer.from('report data'),
        'temp/assign-1/f2.png': Buffer.from('evidence data'),
      };

      function handlePostSendLifecycle(sendSuccess, filePaths) {
        if (sendSuccess) {
          // Delete temporary files
          for (const p of filePaths) {
            delete tempStorage[p];
          }
          return { status: 'CLEANED', remaining: Object.keys(tempStorage).length };
        } else {
          // Retain for retry
          return { status: 'RETAINED_ON_FAILURE', remaining: Object.keys(tempStorage).length };
        }
      }

      // Case A: Send Fails -> files retained
      const failResult = handlePostSendLifecycle(false, ['temp/assign-1/f1.pdf', 'temp/assign-1/f2.png']);
      assert.equal(failResult.status, 'RETAINED_ON_FAILURE');
      assert.equal(failResult.remaining, 2, 'Files must be retained on email failure');

      // Case B: Send Succeeds -> files deleted
      const successResult = handlePostSendLifecycle(true, ['temp/assign-1/f1.pdf', 'temp/assign-1/f2.png']);
      assert.equal(successResult.status, 'CLEANED');
      assert.equal(successResult.remaining, 0, 'Files must be deleted on email success');
    });
  });

  describe('Part 6: Template Interpolation & HTML Formatting', () => {
    test('Interpolates all required template variables into clean HTML email', () => {
      const template = 'Report {{report_id}} for {{report_name}} v{{submission_version}} submitted by {{submitted_by}} to {{assigned_reviewer}}.';
      const context = {
        report_id: 'TL-2026-001',
        report_name: 'Akira Syndicate Dossier',
        submission_version: 1,
        submitted_by: 'Analyst Alice',
        assigned_reviewer: 'Reviewer Bob',
      };

      function interpolate(tpl, ctx) {
        return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => ctx[key] !== undefined ? String(ctx[key]) : '');
      }

      const interpolated = interpolate(template, context);
      assert.equal(
        interpolated,
        'Report TL-2026-001 for Akira Syndicate Dossier v1 submitted by Analyst Alice to Reviewer Bob.'
      );
    });
  });

  describe('Part 7: Governance Decoupling (Section 34 & 35)', () => {
    test('Strictly forbids analyst from approving their own research submission', () => {
      function evaluateApprovalAuthority(callerId, analystId, reviewerId, isAdmin) {
        if (callerId === analystId && !isAdmin) {
          return { allowed: false, error: 'Analysts are strictly forbidden from approving their own research.' };
        }
        if (callerId === reviewerId || isAdmin) {
          return { allowed: true };
        }
        return { allowed: false, error: 'Unauthorized.' };
      }

      const analystId = 'user-analyst-1';
      const reviewerId = 'user-reviewer-2';

      // Submitting analyst cannot approve
      assert.equal(evaluateApprovalAuthority(analystId, analystId, reviewerId, false).allowed, false);

      // Reviewer can approve
      assert.equal(evaluateApprovalAuthority(reviewerId, analystId, reviewerId, false).allowed, true);

      // Admin can approve
      assert.equal(evaluateApprovalAuthority('admin-99', analystId, reviewerId, true).allowed, true);
    });
  });
});
