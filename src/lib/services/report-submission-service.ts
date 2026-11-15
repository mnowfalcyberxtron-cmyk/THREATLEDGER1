import prisma from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';
import {
  getTemporaryFileBytes,
  deleteTemporaryFile,
  deleteTemporaryFiles,
  validateFileSafety,
} from '@/lib/storage/temp-storage';
import {
  sendReportEmailViaGmail,
  getActiveGmailConfig,
  GmailSendAttachment,
} from '@/lib/email/gmail-service';
import {
  DEFAULT_TEMPLATES,
  interpolateTemplate,
  renderHtmlEmail,
} from '@/lib/email/report-templates';
import { AssignmentStatus, ReviewStatus, UserRole } from '@prisma/client';
import crypto from 'crypto';

export interface StagedFileInput {
  filename: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  storagePath: string;
  fileCategory: 'REPORT' | 'EVIDENCE';
}

export interface SubmitReportParams {
  assignmentId: string;
  callerId: string;
  callerRole: UserRole;
  callerName: string;
  callerEmail: string;
  stagedFiles: StagedFileInput[];
  submissionNotes?: string;
}

const DEFAULT_MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024; // 18 MB conservative limit for consumer Gmail

/**
 * Validates, records, and dispatches a report submission with physical email attachments.
 */
export async function executeReportSubmission(params: SubmitReportParams) {
  const {
    assignmentId,
    callerId,
    callerRole,
    callerName,
    callerEmail,
    stagedFiles,
    submissionNotes,
  } = params;

  // 1. Fetch assignment and relationship details
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      group: true,
      primaryAnalyst: { include: { user: true } },
      reviewer: { include: { user: true } },
      reportSubmissions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  });

  if (!assignment) {
    throw new Error('Assignment not found');
  }

  // 2. Validate user authority
  const isAnalyst = assignment.primaryAnalystId === callerId;
  const isAdmin = callerRole === UserRole.ADMIN || callerRole === UserRole.SUPER_ADMIN;

  if (!isAnalyst && !isAdmin) {
    throw new Error('Forbidden: Only the assigned primary analyst or an administrator may submit this report.');
  }

  // 3. Resolve email recipient
  let recipientEmail: string | undefined;
  let isOverrideActive = false;

  if (assignment.recipientOverrideEmail && assignment.recipientOverrideEmail.trim().length > 0) {
    recipientEmail = assignment.recipientOverrideEmail.trim();
    isOverrideActive = true;
  } else if (assignment.reviewer?.user?.email) {
    recipientEmail = assignment.reviewer.user.email.trim();
  }

  if (!recipientEmail) {
    throw new Error(
      'Submission blocked: No assigned reviewer or authorized recipient email found. An administrator must assign a reviewer or set a recipient override before submission.'
    );
  }

  // 4. Validate staged files
  if (!stagedFiles || stagedFiles.length === 0) {
    throw new Error('Submission blocked: At least one report document must be attached.');
  }

  const hasReport = stagedFiles.some((f) => f.fileCategory === 'REPORT');
  if (!hasReport) {
    throw new Error('Submission blocked: A primary report document (PDF, Word, or spreadsheet) is required.');
  }

  // Check file safety
  for (const f of stagedFiles) {
    const safety = validateFileSafety(f.filename, f.mimeType);
    if (!safety.valid) {
      throw new Error(`File "${f.filename}" rejected: ${safety.error}`);
    }
  }

  // Check attachment size limit
  const gmailConfig = await getActiveGmailConfig();
  const maxBytes = gmailConfig?.maxAttachmentBytes || DEFAULT_MAX_ATTACHMENT_BYTES;
  const totalAttachmentBytes = stagedFiles.reduce((sum, f) => sum + f.fileSize, 0);

  if (totalAttachmentBytes > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    const totalMb = (totalAttachmentBytes / (1024 * 1024)).toFixed(2);
    const fileList = stagedFiles.map((f) => `• ${f.filename} (${(f.fileSize / 1024).toFixed(1)} KB)`).join('\n');

    throw new Error(
      `Combined attachment size (${totalMb} MB) exceeds maximum permitted limit of ${maxMb} MB for email archiving. Please compress or reduce supporting evidence files.\nFiles:\n${fileList}`
    );
  }

  // 5. Determine version number
  const previousSubmission = assignment.reportSubmissions[0];
  const nextVersionNumber = previousSubmission ? previousSubmission.versionNumber + 1 : 1;
  const isRevision = nextVersionNumber > 1;

  // 6. Concurrency / Idempotency protection: ensure version hasn't been submitted already
  const existingVersion = await prisma.reportSubmission.findUnique({
    where: {
      assignmentId_versionNumber: {
        assignmentId,
        versionNumber: nextVersionNumber,
      },
    },
  });

  if (existingVersion && existingVersion.emailStatus === 'ACCEPTED_BY_GMAIL') {
    throw new Error(`Submission version ${nextVersionNumber} has already been accepted and archived.`);
  }

  // 7. Parse CC and BCC
  const ccList = assignment.ccEmails ? assignment.ccEmails.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const bccList = assignment.bccEmails ? assignment.bccEmails.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const submissionDateFormatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const templateKey = isRevision ? 'REVISED_REPORT_SUBMITTED' : 'REPORT_SUBMITTED_FOR_REVIEW';
  const templateDef = DEFAULT_TEMPLATES[templateKey];

  const templateContext = {
    report_id: assignment.group.name.toUpperCase().replace(/\s+/g, '-'),
    report_name: assignment.title,
    submission_version: nextVersionNumber,
    submitted_by: assignment.primaryAnalyst.fullName,
    assigned_reviewer: assignment.reviewer.fullName,
    reviewer_email: recipientEmail,
    submission_date: submissionDateFormatted,
    submission_status: 'Under Review',
    review_comments: submissionNotes || 'Initial submission ready for evaluation.',
  };

  const subject = interpolateTemplate(templateDef.subject, templateContext);
  const bodyText = interpolateTemplate(templateDef.bodyText, templateContext);
  const htmlBody = renderHtmlEmail(subject, bodyText, templateContext.report_id);

  // 8. Create Submission Record in PostgreSQL
  const submission = await prisma.reportSubmission.create({
    data: {
      assignmentId,
      versionNumber: nextVersionNumber,
      submittedById: callerId,
      senderEmail: gmailConfig?.senderEmail || 'threatledger.notifications@gmail.com',
      recipientEmail,
      recipientOverrideActive: isOverrideActive,
      ccEmails: assignment.ccEmails,
      bccEmails: assignment.bccEmails,
      emailSubject: subject,
      emailStatus: 'PENDING',
      cleanupStatus: 'PENDING',
      totalAttachmentBytes,
      reviewStatus: ReviewStatus.PENDING_REVIEW,
      reviewerComments: submissionNotes,
      attachments: {
        create: stagedFiles.map((f) => ({
          filename: f.filename,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          sha256: f.sha256,
          fileCategory: f.fileCategory,
          tempStoragePath: f.storagePath,
        })),
      },
    },
    include: {
      attachments: true,
    },
  });

  // 9. Fetch raw attachment bytes from temporary storage
  const emailAttachments: GmailSendAttachment[] = [];
  for (const f of stagedFiles) {
    const bytes = await getTemporaryFileBytes(f.storagePath);
    if (!bytes) {
      // If temporary file cannot be loaded, fail submission and preserve record
      await prisma.reportSubmission.update({
        where: { id: submission.id },
        data: {
          emailStatus: 'FAILED',
          lastErrorMessage: `Failed to retrieve temporary staged bytes for "${f.filename}"`,
        },
      });
      throw new Error(`Staged upload missing or corrupted for "${f.filename}". Please re-upload.`);
    }

    emailAttachments.push({
      filename: f.filename,
      content: bytes,
      contentType: f.mimeType,
    });
  }

  // 10. Dispatch Email via Gmail SMTP
  const sendResult = await sendReportEmailViaGmail({
    to: recipientEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    bcc: bccList.length > 0 ? bccList : undefined,
    subject,
    text: bodyText,
    html: htmlBody,
    attachments: emailAttachments,
  });

  // 11. Handle Send Result
  if (sendResult.success) {
    const acceptedAt = new Date();

    // A. Update submission record to ACCEPTED_BY_GMAIL
    await prisma.reportSubmission.update({
      where: { id: submission.id },
      data: {
        emailStatus: 'ACCEPTED_BY_GMAIL',
        emailMessageId: sendResult.messageId,
        providerMessageId: sendResult.response,
        emailAcceptedAt: acceptedAt,
        attemptCount: { increment: 1 },
      },
    });

    // B. Update Assignment status to SUBMITTED_FOR_REVIEW
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        status: AssignmentStatus.SUBMITTED_FOR_REVIEW,
        submittedAt: acceptedAt,
        submittedById: callerId,
      },
    });

    // C. Record Assignment Event
    await prisma.assignmentEvent.create({
      data: {
        assignmentId,
        actorId: callerId,
        eventType: 'REPORT_SUBMITTED',
        oldStatus: assignment.status,
        newStatus: AssignmentStatus.SUBMITTED_FOR_REVIEW,
        reason: `Report v${nextVersionNumber} submitted with ${stagedFiles.length} physical email attachments. Archived in Gmail Sent folder.`,
      },
    });

    // D. Clean up temporary uploaded files (Post-send lifecycle)
    const pathsToClean = stagedFiles.map((f) => f.storagePath);
    const cleanupResult = await deleteTemporaryFiles(pathsToClean);

    if (cleanupResult.allSucceeded) {
      await prisma.reportSubmission.update({
        where: { id: submission.id },
        data: {
          cleanupStatus: 'CLEANED',
          cleanedAt: new Date(),
        },
      });

      await prisma.submissionAttachment.updateMany({
        where: { submissionId: submission.id },
        data: {
          isCleanedUp: true,
          tempStoragePath: null, // Clear internal path once wiped
        },
      });
    } else {
      // If cleanup failed, log error and flag for retry WITHOUT resending email
      await prisma.reportSubmission.update({
        where: { id: submission.id },
        data: {
          cleanupStatus: 'FAILED',
          cleanupErrorMessage: `Failed to remove ${cleanupResult.failedPaths.length} temporary objects.`,
        },
      });
      console.warn('[ReportSubmission] Cleanup failed for some paths:', cleanupResult.failedPaths);
    }

    // E. Dispatch Analyst Submission Confirmation Email (asynchronous, without reattaching large files)
    const confirmationTemplate = DEFAULT_TEMPLATES.SUBMISSION_CONFIRMATION_ANALYST;
    const confSubject = interpolateTemplate(confirmationTemplate.subject, templateContext);
    const confBody = interpolateTemplate(confirmationTemplate.bodyText, templateContext);
    const confHtml = renderHtmlEmail(confSubject, confBody, templateContext.report_id);

    sendReportEmailViaGmail({
      to: callerEmail,
      subject: confSubject,
      text: confBody,
      html: confHtml,
    }).catch((err) => console.error('[Analyst Confirmation Email Failed]:', err));

    // F. In-App Notifications
    await prisma.notification.create({
      data: {
        userId: assignment.reviewer.id,
        title: `Report Submitted: ${assignment.group.name}`,
        message: `${assignment.primaryAnalyst.fullName} submitted report v${nextVersionNumber} with ${stagedFiles.length} email attachments for your review.`,
        type: 'SUBMISSION',
        link: `/review-queue`,
      },
    });

    await prisma.notification.create({
      data: {
        userId: assignment.primaryAnalyst.id,
        title: `Submission Dispatched: ${assignment.group.name}`,
        message: `Report v${nextVersionNumber} successfully sent to reviewer (${recipientEmail}). Archived in Gmail Sent folder.`,
        type: 'SUBMISSION',
        link: `/my-tasks/${assignmentId}`,
      },
    });

    // G. Audit Log
    await recordAuditLog({
      actorId: callerId,
      actorName: callerName,
      actorEmail: callerEmail,
      action: 'REPORT_SUBMITTED_GMAIL_ARCHIVED',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      afterJson: {
        submissionId: submission.id,
        versionNumber: nextVersionNumber,
        recipientEmail,
        isOverrideActive,
        attachmentCount: stagedFiles.length,
        totalBytes: totalAttachmentBytes,
        messageId: sendResult.messageId,
        mocked: sendResult.mocked,
      },
    });

    return {
      success: true,
      submissionId: submission.id,
      versionNumber: nextVersionNumber,
      messageId: sendResult.messageId,
      recipientEmail,
      attachmentCount: stagedFiles.length,
      totalBytes: totalAttachmentBytes,
      cleanupStatus: cleanupResult.allSucceeded ? 'CLEANED' : 'FAILED',
      mocked: sendResult.mocked,
    };
  } else {
    // 12. Handle Failure
    const errorDetail = sendResult.error?.message || 'SMTP transmission failure';

    await prisma.reportSubmission.update({
      where: { id: submission.id },
      data: {
        emailStatus: 'FAILED',
        cleanupStatus: 'RETAINED_ON_FAILURE',
        lastErrorMessage: errorDetail,
        attemptCount: { increment: 1 },
      },
    });

    // DO NOT transition assignment status to SUBMITTED_FOR_REVIEW on email failure!
    // Temporary files remain preserved for retry.

    await recordAuditLog({
      actorId: callerId,
      actorName: callerName,
      actorEmail: callerEmail,
      action: 'REPORT_SUBMISSION_EMAIL_FAILED',
      targetType: 'ASSIGNMENT',
      targetId: assignmentId,
      afterJson: {
        submissionId: submission.id,
        versionNumber: nextVersionNumber,
        recipientEmail,
        errorCode: sendResult.error?.code,
        errorMessage: errorDetail,
      },
    });

    throw new Error(`Report submission email failed: ${errorDetail}. Temporary files have been retained for retry.`);
  }
}

/**
 * Retries dispatching an existing failed report submission without duplicate file uploads.
 */
export async function retryReportSubmissionEmail(submissionId: string, callerId: string) {
  const submission = await prisma.reportSubmission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          group: true,
          primaryAnalyst: true,
          reviewer: true,
        },
      },
      attachments: true,
    },
  });

  if (!submission) {
    throw new Error('Submission record not found');
  }

  if (submission.emailStatus === 'ACCEPTED_BY_GMAIL') {
    return { success: true, message: 'This submission has already been accepted and archived.' };
  }

  // Load physical attachment bytes
  const emailAttachments: GmailSendAttachment[] = [];
  for (const att of submission.attachments) {
    if (!att.tempStoragePath) {
      throw new Error(`Cannot retry: Staged file path for "${att.filename}" is missing.`);
    }

    const bytes = await getTemporaryFileBytes(att.tempStoragePath);
    if (!bytes) {
      throw new Error(`Cannot retry: Staged file bytes for "${att.filename}" are no longer available in temporary storage.`);
    }

    emailAttachments.push({
      filename: att.filename,
      content: bytes,
      contentType: att.mimeType,
    });
  }

  const sendResult = await sendReportEmailViaGmail({
    to: submission.recipientEmail,
    cc: submission.ccEmails ? submission.ccEmails.split(',').map((s) => s.trim()) : undefined,
    bcc: submission.bccEmails ? submission.bccEmails.split(',').map((s) => s.trim()) : undefined,
    subject: submission.emailSubject,
    html: renderHtmlEmail(submission.emailSubject, 'A research report was submitted and is attached to this email.', submission.assignment.group.name),
    attachments: emailAttachments,
  });

  if (sendResult.success) {
    const acceptedAt = new Date();

    await prisma.reportSubmission.update({
      where: { id: submission.id },
      data: {
        emailStatus: 'ACCEPTED_BY_GMAIL',
        emailMessageId: sendResult.messageId,
        providerMessageId: sendResult.response,
        emailAcceptedAt: acceptedAt,
        attemptCount: { increment: 1 },
      },
    });

    await prisma.assignment.update({
      where: { id: submission.assignmentId },
      data: {
        status: AssignmentStatus.SUBMITTED_FOR_REVIEW,
        submittedAt: acceptedAt,
      },
    });

    // Cleanup temporary files
    const paths = submission.attachments.map((a) => a.tempStoragePath!).filter(Boolean);
    const cleanupResult = await deleteTemporaryFiles(paths);

    if (cleanupResult.allSucceeded) {
      await prisma.reportSubmission.update({
        where: { id: submission.id },
        data: { cleanupStatus: 'CLEANED', cleanedAt: new Date() },
      });
      await prisma.submissionAttachment.updateMany({
        where: { submissionId: submission.id },
        data: { isCleanedUp: true, tempStoragePath: null },
      });
    }

    return {
      success: true,
      messageId: sendResult.messageId,
      cleanupStatus: cleanupResult.allSucceeded ? 'CLEANED' : 'FAILED',
    };
  } else {
    await prisma.reportSubmission.update({
      where: { id: submission.id },
      data: {
        lastErrorMessage: sendResult.error?.message,
        attemptCount: { increment: 1 },
      },
    });
    throw new Error(`Retry failed: ${sendResult.error?.message}`);
  }
}
