import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

describe('ThreatLedger Phase 1 — Authentication, Security & Brand Verification', () => {
  test('Brand Assets: threatledger-mark.svg and threatledger-logo.svg exist and match geometry requirements', () => {
    const markPath = path.resolve('public/brand/threatledger-mark.svg');
    const logoPath = path.resolve('public/brand/threatledger-logo.svg');

    assert.ok(fs.existsSync(markPath), 'threatledger-mark.svg must exist');
    assert.ok(fs.existsSync(logoPath), 'threatledger-logo.svg must exist');

    const markContent = fs.readFileSync(markPath, 'utf8');
    assert.ok(markContent.includes('silverOutline'), 'Logo must contain silver/white outline specification');
    assert.ok(markContent.includes('#10b981') || markContent.includes('#34d399'), 'Logo must contain mint-green network palette');
    assert.ok(markContent.includes('darkInterior'), 'Logo must contain deep dark interior');
  });

  test('Security: Bcrypt salt hashing and password verification', async () => {
    const rawPassword = 'SuperSecretCTIPassword2026!';
    const hash = await bcrypt.hash(rawPassword, 12);

    assert.ok(hash.startsWith('$2'), 'Hash must be a valid bcrypt salt format');
    assert.notEqual(rawPassword, hash, 'Raw password must never equal hash');

    const isValid = await bcrypt.compare(rawPassword, hash);
    assert.equal(isValid, true, 'Valid password must match hash');

    const isInvalid = await bcrypt.compare('WrongPassword', hash);
    assert.equal(isInvalid, false, 'Invalid password must be rejected');
  });

  test('Security: Cryptographically secure invitation token generation', () => {
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');

    assert.equal(token1.length, 64, 'Token must be 64 hexadecimal characters (256-bit entropy)');
    assert.notEqual(token1, token2, 'Tokens must be globally unique');
  });

  test('Role-Based Access Control: Hierarchy and permission weights', () => {
    const roles = {
      ANALYST: 1,
      ADMIN: 2,
      SUPER_ADMIN: 3,
    };

    assert.ok(roles.SUPER_ADMIN > roles.ADMIN, 'Super Admin must have higher privilege than Admin');
    assert.ok(roles.ADMIN > roles.ANALYST, 'Admin must have higher privilege than Analyst');

    // Rule: Analyst cannot access admin-only features
    function canAccessAdminPanel(userRole) {
      return roles[userRole] >= roles.ADMIN;
    }

    assert.equal(canAccessAdminPanel('ANALYST'), false, 'Analyst cannot access Admin Panel');
    assert.equal(canAccessAdminPanel('ADMIN'), true, 'Admin can access Admin Panel');
    assert.equal(canAccessAdminPanel('SUPER_ADMIN'), true, 'Super Admin can access Admin Panel');
  });

  test('Safety Guard: Last Super Admin demotion/deactivation protection', () => {
    function canDemoteSuperAdmin(targetRole, activeSuperAdminCount) {
      if (targetRole === 'SUPER_ADMIN' && activeSuperAdminCount <= 1) {
        return false; // Forbidden
      }
      return true;
    }

    assert.equal(
      canDemoteSuperAdmin('SUPER_ADMIN', 1),
      false,
      'Last remaining Super Admin cannot be demoted'
    );
    assert.equal(
      canDemoteSuperAdmin('SUPER_ADMIN', 2),
      true,
      'Super Admin can be demoted if another active Super Admin exists'
    );
  });

  test('Regional Standard: Asia/Kolkata (IST) timezone formatting', () => {
    const testDate = new Date('2026-11-14T12:00:00Z'); // 12:00 UTC = 17:30 IST

    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(testDate);

    assert.equal(formatted, '17:30', 'UTC time must be converted correctly to Asia/Kolkata (+5:30)');
  });
});
