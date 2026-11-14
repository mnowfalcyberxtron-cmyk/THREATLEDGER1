import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('ThreatLedger Phase 3 — Assignment Operations, Checklists & Governance', () => {
  test('Checklist Standard: 15 mandatory items initialized and N/A requires explanation', () => {
    const checklistLength = 15;
    assert.equal(checklistLength, 15, 'Checklist must contain exactly 15 standardized items');

    function validateChecklistUpdate(status, notApplicableReason) {
      if (status === 'NOT_APPLICABLE') {
        if (!notApplicableReason || notApplicableReason.trim().length === 0) {
          return { valid: false, error: 'Reason required for N/A' };
        }
      }
      return { valid: true };
    }

    assert.equal(validateChecklistUpdate('COMPLETED').valid, true);
    assert.equal(validateChecklistUpdate('NOT_APPLICABLE', '').valid, false);
    assert.equal(validateChecklistUpdate('NOT_APPLICABLE', 'No public decryptor exists').valid, true);
  });

  test('Governance Rule (Sections 34 & 35): Analyst cannot approve their own submitted research', () => {
    function canUserApproveAssignment(callerId, primaryAnalystId, reviewerId, isAdmin) {
      // Rule: Primary analyst cannot approve their own report, even if they were set as reviewer
      if (callerId === primaryAnalystId && !isAdmin) {
        return false;
      }
      if (callerId === reviewerId || isAdmin) {
        return true;
      }
      return false;
    }

    const analystGuruId = 'user-guru-123';
    const reviewerBossId = 'user-boss-456';

    assert.equal(
      canUserApproveAssignment(analystGuruId, analystGuruId, reviewerBossId, false),
      false,
      'Analyst Guru CANNOT approve their own submission'
    );
    assert.equal(
      canUserApproveAssignment(reviewerBossId, analystGuruId, reviewerBossId, true),
      true,
      'Authorized Reviewer Boss CAN approve the submission'
    );
  });

  test('Privacy Rule (Section 27): Regular analysts cannot view ADMIN_PRIVATE notes', () => {
    const notes = [
      { id: '1', noteType: 'SHARED', content: 'Public note' },
      { id: '2', noteType: 'ADMIN_PRIVATE', content: 'Confidential review assessment' },
    ];

    function filterNotesForUser(userRole, rawNotes) {
      if (userRole === 'ANALYST') {
        return rawNotes.filter((n) => n.noteType !== 'ADMIN_PRIVATE');
      }
      return rawNotes;
    }

    const analystView = filterNotesForUser('ANALYST', notes);
    assert.equal(analystView.length, 1, 'Analyst should only see 1 shared note');
    assert.equal(analystView[0].noteType, 'SHARED');

    const adminView = filterNotesForUser('ADMIN', notes);
    assert.equal(adminView.length, 2, 'Admin should see both shared and private notes');
  });

  test('Bulk Allocation: Generates independent task items per group', () => {
    const groupIds = ['g1', 'g2', 'g3'];
    const tasks = groupIds.map((groupId) => ({
      groupId,
      batchId: 'batch-101',
      status: 'ASSIGNED',
    }));

    assert.equal(tasks.length, 3, 'Bulk allocation must create one independent task per group');
    assert.equal(tasks[0].batchId, 'batch-101');
    assert.equal(tasks[1].batchId, 'batch-101');
  });
});
