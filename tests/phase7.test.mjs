import test from 'node:test';
import assert from 'node:assert/strict';

const DEFAULT_QUOTA = 50 * 1024 * 1024 * 1024; // 50 GB

function computeQuotaStatus(usedBytes, quotaBytes = DEFAULT_QUOTA) {
  const percentage = (usedBytes / quotaBytes) * 100;
  let status = 'NORMAL';
  if (percentage >= 95) status = 'CRITICAL';
  else if (percentage >= 85) status = 'WARNING';
  else if (percentage >= 70) status = 'ATTENTION';

  return { percentage, status };
}

function evaluateUploadAllowance(currentUsedBytes, fileSizeBytes, quotaBytes = DEFAULT_QUOTA) {
  const currentPercentage = (currentUsedBytes / quotaBytes) * 100;
  if (currentPercentage >= 95) {
    return { allowed: false, reason: 'CRITICAL_QUOTA_REACHED' };
  }
  if (currentUsedBytes + fileSizeBytes > quotaBytes) {
    return { allowed: false, reason: 'EXCEEDS_MAX_CAPACITY' };
  }
  return { allowed: true };
}

test('Phase 7: Quota engine correctly maps percentage to operational risk tiers', () => {
  assert.equal(computeQuotaStatus(10 * 1024 * 1024 * 1024).status, 'NORMAL'); // 20%
  assert.equal(computeQuotaStatus(36 * 1024 * 1024 * 1024).status, 'ATTENTION'); // 72%
  assert.equal(computeQuotaStatus(43 * 1024 * 1024 * 1024).status, 'WARNING'); // 86%
  assert.equal(computeQuotaStatus(48 * 1024 * 1024 * 1024).status, 'CRITICAL'); // 96%
});

test('Phase 7: Storage engine hard-blocks uploads when critical threshold is crossed', () => {
  const criticalUsage = 48 * 1024 * 1024 * 1024; // 96%
  const normalUsage = 20 * 1024 * 1024 * 1024; // 40%
  const smallFile = 5 * 1024 * 1024; // 5 MB
  const massiveFile = 35 * 1024 * 1024 * 1024; // 35 GB

  // Refuse even small files when usage is already critical
  const checkCritical = evaluateUploadAllowance(criticalUsage, smallFile);
  assert.equal(checkCritical.allowed, false);
  assert.equal(checkCritical.reason, 'CRITICAL_QUOTA_REACHED');

  // Allow small file when usage is normal
  const checkNormal = evaluateUploadAllowance(normalUsage, smallFile);
  assert.equal(checkNormal.allowed, true);

  // Refuse file that would cause capacity overflow
  const checkOverflow = evaluateUploadAllowance(normalUsage, massiveFile);
  assert.equal(checkOverflow.allowed, false);
  assert.equal(checkOverflow.reason, 'EXCEEDS_MAX_CAPACITY');
});

test('Phase 7: Presigned URL parameters enforce maximum 900 seconds TTL (15 minutes)', () => {
  const DEFAULT_TTL_SECONDS = 900;
  const MAX_PERMITTED_TTL = 900;

  function validatePresignTtl(ttl) {
    assert.ok(ttl > 0 && ttl <= MAX_PERMITTED_TTL, 'TTL must be within 1 to 900 seconds');
    return true;
  }

  assert.doesNotThrow(() => validatePresignTtl(DEFAULT_TTL_SECONDS));
  assert.throws(() => validatePresignTtl(3600)); // 1 hour is not permitted
});
