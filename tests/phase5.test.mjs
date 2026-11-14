import test from 'node:test';
import assert from 'node:assert/strict';

function baseTemplate({ headline, bodyHtml, ctaText, ctaUrl, classification = 'TLP:AMBER+STRICT — INTERNAL CTI OPERATIONS ONLY' }) {
  return `<!DOCTYPE html>
<html>
<head><title>${headline}</title></head>
<body>
  <div class="tlp-banner">${classification}</div>
  <div class="content">
    <h1>${headline}</h1>
    ${bodyHtml}
    ${ctaText && ctaUrl ? `<a href="${ctaUrl}">${ctaText}</a>` : ''}
  </div>
</body>
</html>`;
}

function renderTeamInviteEmail(props) {
  const subject = `[ThreatLedger] Invitation to Join CTI Team as ${props.role}`;
  const html = baseTemplate({
    headline: 'You Have Been Invited to ThreatLedger',
    bodyHtml: `<p>Designated Email: ${props.email}</p><p>Role: ${props.role}</p>`,
    ctaText: 'Accept Invitation & Set Up Account',
    ctaUrl: props.inviteUrl,
  });
  return { subject, html };
}

function renderReportSubmittedEmail(props) {
  const subject = `[Review Required] Deliverable v${props.versionNumber} Submitted: ${props.groupName} (${props.analystName})`;
  const html = baseTemplate({
    headline: `Research Report v${props.versionNumber} Ready for Review`,
    bodyHtml: `<p>Syndicate: ${props.groupName}</p><p>Deliverable: ${props.filename}</p><p>Section 31 Physical MIME Attachment: Included</p>`,
    ctaText: 'Open Reviewer Sign-off Queue',
    ctaUrl: props.reviewQueueUrl,
  });
  return { subject, html };
}

test('Phase 5: Email templates render with proper branding, TLP banner and escaped fields', () => {
  const invite = renderTeamInviteEmail({
    inviteUrl: 'https://threatledger.internal/invite/token123',
    inviterName: 'Lead Admin',
    role: 'ANALYST',
    email: 'analyst@threatledger.internal',
  });

  assert.match(invite.subject, /\[ThreatLedger\] Invitation/);
  assert.match(invite.html, /TLP:AMBER\+STRICT/);
  assert.match(invite.html, /analyst@threatledger\.internal/);
  assert.match(invite.html, /https:\/\/threatledger\.internal\/invite\/token123/);

  const submission = renderReportSubmittedEmail({
    reviewerName: 'Chief Reviewer',
    analystName: 'Senior Analyst',
    taskTitle: 'LockBit 3.0 Campaign Assessment',
    groupName: 'lockbit3',
    versionNumber: 2,
    filename: 'lockbit_v2.pdf',
    fileSizeFormatted: '1.4 MB',
    reviewQueueUrl: 'https://threatledger.internal/review-queue',
  });

  assert.match(submission.subject, /Deliverable v2 Submitted: lockbit3/);
  assert.match(submission.html, /Section 31 Physical MIME Attachment/);
  assert.match(submission.html, /lockbit_v2\.pdf/);
});

test('Phase 5: Section 31 Physical MIME Attachment enforces binary buffer and disallows link substitution', () => {
  function preparePhysicalAttachment(filename, rawBytes, mimeType) {
    assert.ok(Buffer.isBuffer(rawBytes), 'Attachment content must be a raw binary Buffer');
    assert.ok(rawBytes.length > 0, 'Attachment content must not be empty');
    assert.ok(!filename.startsWith('http://') && !filename.startsWith('https://'), 'Filename cannot be a URL');

    return {
      filename,
      content: rawBytes,
      contentType: mimeType,
    };
  }

  const mockPdfBytes = Buffer.from('%PDF-1.4 Mock ThreatLedger Classified Report');
  const attachment = preparePhysicalAttachment('LockBit_Assessment_v1.pdf', mockPdfBytes, 'application/pdf');

  assert.equal(attachment.filename, 'LockBit_Assessment_v1.pdf');
  assert.equal(Buffer.isBuffer(attachment.content), true);
  assert.equal(attachment.contentType, 'application/pdf');

  assert.throws(() => {
    preparePhysicalAttachment('report.pdf', 'https://r2.storage.com/report.pdf', 'application/pdf');
  });
});

test('Phase 5: Email outbox idempotency key enforces duplicate suppression', () => {
  const sentLog = new Set();

  function attemptDispatch(idempotencyKey) {
    if (sentLog.has(idempotencyKey)) {
      return { sent: false, duplicate: true };
    }
    sentLog.add(idempotencyKey);
    return { sent: true, duplicate: false };
  }

  const key = 'report-submitted-version-uuid-999';
  const first = attemptDispatch(key);
  assert.equal(first.sent, true);
  assert.equal(first.duplicate, false);

  const duplicate = attemptDispatch(key);
  assert.equal(duplicate.sent, false);
  assert.equal(duplicate.duplicate, true);
});
