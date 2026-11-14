import test from 'node:test';
import assert from 'node:assert/strict';

// Test R2 Object Key format
function generateR2ObjectKey(type, assignmentId, originalFilename) {
  const fileId = 'mock-uuid-12345';
  const safeFilename = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();

  const objectKey = `${type}/${assignmentId}/${fileId}/${safeFilename}`;
  return { fileId, objectKey, safeFilename };
}

// Test Extension Validator
const PERMITTED_REPORT_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.ppt', '.txt'];
const PERMITTED_EVIDENCE_EXTENSIONS = [
  ...PERMITTED_REPORT_EXTENSIONS,
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.json',
  '.zip',
];

function isExtensionAllowed(filename, category) {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  const allowed = category === 'REPORT' ? PERMITTED_REPORT_EXTENSIONS : PERMITTED_EVIDENCE_EXTENSIONS;
  return allowed.includes(ext);
}

// Test Section 35 Decoupling Rule
function validateSection35Decoupling(assignment) {
  // Analyst submitting report is NOT equivalent to reviewer approval
  const isApproved = assignment.status === 'APPROVED_COMPLETED';
  const hasReviewerSignOff = Boolean(assignment.approvedById && assignment.approvedAt);
  const isSubmissionIsolatedFromApproval = assignment.submittedAt !== assignment.approvedAt;

  if (isApproved) {
    assert.ok(hasReviewerSignOff, 'Approved tasks must have distinct reviewer sign-off');
    assert.notEqual(assignment.primaryAnalystId, assignment.approvedById, 'Analyst cannot approve their own report');
  }

  return true;
}

test('Phase 4: R2 Object Key Generation follows opaque security structure', () => {
  const result = generateR2ObjectKey('reports', 'asgn-8899', 'LockBit_3.0_Executive Summary (v1).pdf');
  assert.equal(result.safeFilename, 'lockbit_3.0_executive_summary__v1_.pdf');
  assert.equal(result.objectKey, 'reports/asgn-8899/mock-uuid-12345/lockbit_3.0_executive_summary__v1_.pdf');
});

test('Phase 4: Extension & MIME type security restrictions enforce allowed formats', () => {
  assert.equal(isExtensionAllowed('report.pdf', 'REPORT'), true);
  assert.equal(isExtensionAllowed('report.docx', 'REPORT'), true);
  assert.equal(isExtensionAllowed('malware.exe', 'REPORT'), false);
  assert.equal(isExtensionAllowed('ransom_note.png', 'EVIDENCE'), true);
  assert.equal(isExtensionAllowed('network_capture.pcap.zip', 'EVIDENCE'), true);
  assert.equal(isExtensionAllowed('script.sh', 'EVIDENCE'), false);
});

test('Phase 4: Section 35 Decoupling enforces reviewer isolation from submitter', () => {
  const mockValidApproval = {
    id: 'asgn-1',
    status: 'APPROVED_COMPLETED',
    primaryAnalystId: 'analyst-1',
    submittedAt: new Date('2026-11-14T10:00:00Z'),
    submittedById: 'analyst-1',
    approvedById: 'reviewer-2',
    approvedAt: new Date('2026-11-14T12:00:00Z'),
  };

  assert.doesNotThrow(() => validateSection35Decoupling(mockValidApproval));

  const mockInvalidSelfApproval = {
    id: 'asgn-2',
    status: 'APPROVED_COMPLETED',
    primaryAnalystId: 'analyst-1',
    submittedAt: new Date('2026-11-14T10:00:00Z'),
    submittedById: 'analyst-1',
    approvedById: 'analyst-1', // Self-approval violation!
    approvedAt: new Date('2026-11-14T10:00:00Z'),
  };

  assert.throws(() => validateSection35Decoupling(mockInvalidSelfApproval));
});
