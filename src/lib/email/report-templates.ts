export interface TemplateContext {
  report_id?: string;
  report_name?: string;
  submission_id?: string;
  submission_version?: string | number;
  submitted_by?: string;
  assigned_reviewer?: string;
  reviewer_email?: string;
  submission_date?: string;
  submission_status?: string;
  review_comments?: string;
  approval_date?: string;
  [key: string]: any;
}

export interface DefaultTemplateDefinition {
  templateKey: string;
  name: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export const DEFAULT_TEMPLATES: Record<string, DefaultTemplateDefinition> = {
  REPORT_SUBMITTED_FOR_REVIEW: {
    templateKey: 'REPORT_SUBMITTED_FOR_REVIEW',
    name: 'Report Submitted for Review (To Reviewer)',
    subject: 'ThreatLedger — Report Submitted for Review — {{report_id}}',
    bodyText: `Dear Reviewer,

A research report has been submitted through ThreatLedger and is awaiting your evaluation.

Submission Details:
- Report ID: {{report_id}}
- Report Name: {{report_name}}
- Submitted By: {{submitted_by}}
- Assigned Reviewer: {{assigned_reviewer}}
- Submission Version: {{submission_version}}
- Submission Date: {{submission_date}}
- Status: {{submission_status}}

The final report document and all supporting evidence are attached directly to this email. You may download and inspect the original attachments without logging in.

Please review the submitted documents and log in to ThreatLedger to submit your formal approval or change request.

Regards,
ThreatLedger CTI Operations Team`,
  },

  SUBMISSION_CONFIRMATION_ANALYST: {
    templateKey: 'SUBMISSION_CONFIRMATION_ANALYST',
    name: 'Submission Confirmation to Analyst',
    subject: 'ThreatLedger — Report Submitted Confirmation — {{report_id}}',
    bodyText: `Dear {{submitted_by}},

Your research report has been successfully submitted and dispatched for evaluation.

Confirmation Details:
- Report ID: {{report_id}}
- Report Name: {{report_name}}
- Version: {{submission_version}}
- Submitted At: {{submission_date}}
- Assigned Reviewer: {{assigned_reviewer}} ({{reviewer_email}})
- Status: Under Review

The review package containing your report and supporting evidence has been delivered to your assigned reviewer. You will be notified once a verdict is rendered.

Regards,
ThreatLedger CTI Operations Team`,
  },

  REPORT_APPROVED: {
    templateKey: 'REPORT_APPROVED',
    name: 'Report Approved (To Analyst)',
    subject: 'ThreatLedger — Research Report Approved — {{report_id}}',
    bodyText: `Dear {{submitted_by}},

Congratulations. Your research report for {{report_name}} ({{report_id}}) has been formally APPROVED by {{assigned_reviewer}}.

Approval Details:
- Report ID: {{report_id}}
- Approved Version: {{submission_version}}
- Approver: {{assigned_reviewer}}
- Approved At: {{approval_date}}
- Status: Approved & Completed

Comments from Reviewer:
{{review_comments}}

The research has now entered the verified intelligence ledger.

Regards,
ThreatLedger CTI Operations Team`,
  },

  CHANGES_REQUESTED: {
    templateKey: 'CHANGES_REQUESTED',
    name: 'Changes Requested (To Analyst)',
    subject: 'ThreatLedger — Revisions Requested — {{report_id}}',
    bodyText: `Dear {{submitted_by}},

Your assigned reviewer, {{assigned_reviewer}}, has evaluated report {{report_id}} (v{{submission_version}}) and requested revisions before approval.

Reviewer Comments & Feedback:
{{review_comments}}

Next Steps:
1. Log in to your ThreatLedger analyst workbench.
2. Address the feedback above.
3. Upload the revised report document and updated evidence.
4. Click "Submit for Review" to dispatch version {{submission_version}} + 1.

Regards,
ThreatLedger CTI Operations Team`,
  },

  REPORT_REJECTED: {
    templateKey: 'REPORT_REJECTED',
    name: 'Report Rejected (To Analyst)',
    subject: 'ThreatLedger — Submission Rejected — {{report_id}}',
    bodyText: `Dear {{submitted_by}},

Your submission for {{report_name}} ({{report_id}}) has been rejected by {{assigned_reviewer}}.

Reason:
{{review_comments}}

Please consult with your team lead or reviewer for re-scoping.

Regards,
ThreatLedger CTI Operations Team`,
  },

  REVIEWER_ASSIGNED: {
    templateKey: 'REVIEWER_ASSIGNED',
    name: 'Reviewer Assignment Notification',
    subject: 'ThreatLedger — Assigned as Reviewer — {{report_id}}',
    bodyText: `Dear {{assigned_reviewer}},

You have been designated as the peer reviewer for {{report_name}} ({{report_id}}).
Primary Analyst: {{submitted_by}}.

You will receive an email containing the report and supporting evidence attachments as soon as the analyst completes their submission.

Regards,
ThreatLedger CTI Operations Team`,
  },

  REVISED_REPORT_SUBMITTED: {
    templateKey: 'REVISED_REPORT_SUBMITTED',
    name: 'Revised Report Submitted (To Reviewer)',
    subject: 'ThreatLedger — Revised Report v{{submission_version}} Submitted — {{report_id}}',
    bodyText: `Dear {{assigned_reviewer}},

Analyst {{submitted_by}} has uploaded and submitted a revised research report (v{{submission_version}}) for {{report_name}} ({{report_id}}).

The updated report and revised supporting evidence files are attached to this email.

Please review the revised attachments and submit your evaluation in ThreatLedger.

Regards,
ThreatLedger CTI Operations Team`,
  },

  GMAIL_TEST_EMAIL: {
    templateKey: 'GMAIL_TEST_EMAIL',
    name: 'Gmail Configuration Test Email',
    subject: 'ThreatLedger — Email Configuration Test',
    bodyText: `Dear Administrator,

Your ThreatLedger email integration is working successfully.

- Sender Account: {{submitted_by}}
- Tested At: {{submission_date}}
- Status: Active & Connected to Gmail SMTP

This is a test email sent from ThreatLedger Administrator Dashboard. No report statuses were modified.

Regards,
ThreatLedger System Diagnostics`,
  },

  EMAIL_SENDING_FAILURE: {
    templateKey: 'EMAIL_SENDING_FAILURE',
    name: 'Email Sending Failure Notification (To Admin)',
    subject: 'ThreatLedger [ALERT] — Report Email Delivery Failure — {{report_id}}',
    bodyText: `ATTENTION: ADMINISTRATOR

A report submission email could not be delivered to the reviewer.

Failure Details:
- Report ID: {{report_id}}
- Submitting Analyst: {{submitted_by}}
- Intended Recipient: {{reviewer_email}}
- Attempted Version: {{submission_version}}
- Error Summary: {{review_comments}}

Action Required:
The submitted files remain preserved in temporary staging. Please check the Gmail SMTP configuration in Settings, ensure App Password is valid, and trigger a manual retry from the Email Activity queue.

Regards,
ThreatLedger System Monitor`,
  },
};

/**
 * Replaces {{variable}} placeholders with context values.
 */
export function interpolateTemplate(templateStr: string, context: TemplateContext): string {
  return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }
    return '';
  });
}

/**
 * Format plain text into clean, safe HTML email with ThreatLedger branding.
 */
export function renderHtmlEmail(
  title: string,
  bodyText: string,
  reportId?: string
): string {
  const formattedParagraphs = bodyText
    .split('\n\n')
    .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #cbd5e1; font-size: 13px;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #070b14; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #0d1527; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background-color: #090f1d; border-bottom: 1px solid #1e293b;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display: inline-block; vertical-align: middle;">
                      <span style="font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Threat<span style="color: #10b981;">Ledger</span></span>
                      <span style="display: block; font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-top: 2px;">CTI Operations Platform</span>
                    </div>
                  </td>
                  ${reportId ? `
                  <td align="right">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: monospace; background-color: #064e3b; color: #34d399; border: 1px solid #059669;">${escapeHtml(reportId)}</span>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <!-- TLP Amber Operational Notice -->
          <tr>
            <td style="padding: 8px 32px; background-color: #1e1b4b; border-bottom: 1px solid #312e81;">
              <span style="font-size: 10px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.5px;">TLP:AMBER+STRICT — AUTHORIZED CTI PERSONNEL ONLY</span>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              ${formattedParagraphs}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #090f1d; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">
                Original documents archived in ThreatLedger Gmail Outbox. Download files directly from email attachments.
              </p>
              <p style="margin: 0; font-size: 10px; color: #475569;">
                ThreatLedger CTI Platform • Automated Document Pipeline
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
