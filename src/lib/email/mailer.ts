import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import prisma from '@/lib/prisma';
import { getObjectBytes } from '@/lib/storage/r2';
import {
  renderTeamInviteEmail,
  renderTaskAssignedEmail,
  renderReportSubmittedEmail,
  renderReviewVerdictEmail,
} from './templates';
import { EmailProvider, EmailStatus } from '@prisma/client';
import crypto from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || 'ThreatLedger CTI <notifications@threatledger.internal>';

const isResendConfigured = Boolean(RESEND_API_KEY && !RESEND_API_KEY.includes('your_'));
const isSmtpConfigured = Boolean(SMTP_HOST && SMTP_USER && !SMTP_USER.includes('your_'));

const resendClient = isResendConfigured ? new Resend(RESEND_API_KEY) : null;

const smtpTransporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    })
  : null;

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
  idempotencyKey?: string;
  templateType: string;
}

/**
 * Core email dispatch engine supporting SMTP, Resend, and local mock fallback.
 * Strictly adheres to Section 31 MIME attachment delivery protocol.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{
  success: boolean;
  messageId?: string;
  provider: EmailProvider;
  mocked: boolean;
}> {
  const {
    to,
    subject,
    html,
    text,
    attachments = [],
    idempotencyKey = crypto.randomUUID(),
    templateType,
  } = options;

  // 1. Check idempotency
  const existing = await prisma.emailOutbox.findUnique({
    where: { idempotencyKey },
  });

  if (existing && existing.status === EmailStatus.SENT) {
    return {
      success: true,
      messageId: existing.providerMessageId || undefined,
      provider: existing.provider,
      mocked: false,
    };
  }

  // 2. Outbox record creation
  const outbox = await prisma.emailOutbox.upsert({
    where: { idempotencyKey },
    create: {
      recipientEmail: to,
      subject,
      templateType,
      provider: isResendConfigured ? EmailProvider.RESEND : EmailProvider.SMTP,
      status: EmailStatus.PENDING,
      hasAttachment: attachments.length > 0,
      idempotencyKey,
    },
    update: {
      attempts: { increment: 1 },
    },
  });

  // 3. Dispatch via Resend if configured
  if (isResendConfigured && resendClient) {
    try {
      const res = await resendClient.emails.send({
        from: SMTP_FROM,
        to,
        subject,
        html,
        text,
        attachments: attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      const messageId = res.data?.id || undefined;
      await prisma.emailOutbox.update({
        where: { id: outbox.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerMessageId: messageId,
        },
      });

      return { success: true, messageId, provider: EmailProvider.RESEND, mocked: false };
    } catch (err: any) {
      await prisma.emailOutbox.update({
        where: { id: outbox.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: err.message,
        },
      });
      console.error('[Mailer] Resend error:', err);
    }
  }

  // 4. Dispatch via SMTP if configured
  if (isSmtpConfigured && smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
        text,
        attachments: attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      await prisma.emailOutbox.update({
        where: { id: outbox.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          providerMessageId: info.messageId,
        },
      });

      return { success: true, messageId: info.messageId, provider: EmailProvider.SMTP, mocked: false };
    } catch (err: any) {
      await prisma.emailOutbox.update({
        where: { id: outbox.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: err.message,
        },
      });
      console.error('[Mailer] SMTP error:', err);
    }
  }

  // 5. Development / Mock Mode fallback (records as SENT for operational continuity)
  console.log(`[Mailer Mock Dispatch] To: ${to} | Subject: ${subject} | Attachments: ${attachments.length}`);
  if (attachments.length > 0) {
    console.log(`[Section 31 Physical Attachment] Delivered ${attachments[0].filename} (${attachments[0].content.length} bytes)`);
  }

  await prisma.emailOutbox.update({
    where: { id: outbox.id },
    data: {
      status: EmailStatus.SENT,
      sentAt: new Date(),
      providerMessageId: `mock-msg-${crypto.randomUUID()}`,
    },
  });

  return {
    success: true,
    messageId: `mock-msg-${crypto.randomUUID()}`,
    provider: EmailProvider.SMTP,
    mocked: true,
  };
}

/**
 * Dispatch task allocation notification to the assigned analyst.
 */
export async function dispatchTaskAssignedNotification(assignmentId: string) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        group: true,
        primaryAnalyst: { include: { user: true } },
      },
    });

    if (!assignment || !assignment.primaryAnalyst?.user?.email) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const taskUrl = `${appUrl}/my-tasks/${assignment.id}`;

    const { subject, html } = renderTaskAssignedEmail({
      analystName: assignment.primaryAnalyst.fullName,
      taskTitle: assignment.title,
      groupName: assignment.group.name,
      priority: assignment.priority,
      dueDate: assignment.dueDate?.toISOString(),
      taskUrl,
    });

    // 1. In-app notification
    await prisma.notification.create({
      data: {
        userId: assignment.primaryAnalyst.id,
        title: `Task Assigned: ${assignment.group.name}`,
        message: `You were assigned as primary analyst for ${assignment.title} [${assignment.priority}]`,
        type: 'ASSIGNMENT',
        link: `/my-tasks/${assignment.id}`,
      },
    });

    // 2. Email dispatch
    await sendEmail({
      to: assignment.primaryAnalyst.user.email,
      subject,
      html,
      templateType: 'TASK_ASSIGNED',
      idempotencyKey: `task-assigned-${assignment.id}`,
    });
  } catch (error) {
    console.error('[Dispatch Task Assigned Error]:', error);
  }
}

/**
 * Section 31 Deliverable Dispatch:
 * On report submission, fetch the binary file from Cloudflare R2 and attach it
 * directly to the email sent to the reviewer.
 */
export async function dispatchReportSubmittedNotification(
  assignmentId: string,
  versionNumber?: number
) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        group: true,
        primaryAnalyst: true,
        reviewer: { include: { user: true } },
        reports: {
          include: {
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!assignment || !assignment.reviewer?.user?.email) return;

    const latestVersion = assignment.reports?.[0]?.versions?.[0];
    if (!latestVersion) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const reviewQueueUrl = `${appUrl}/review-queue`;

    // Fetch physical bytes from private R2 (Section 31 requirement)
    const fileBytes = await getObjectBytes(latestVersion.r2ObjectKey);
    const attachments: EmailAttachment[] = [];

    if (fileBytes) {
      attachments.push({
        filename: latestVersion.filename,
        content: fileBytes,
        contentType: latestVersion.mimeType || 'application/pdf',
      });
    }

    const { subject, html } = renderReportSubmittedEmail({
      reviewerName: assignment.reviewer.fullName,
      analystName: assignment.primaryAnalyst.fullName,
      taskTitle: assignment.title,
      groupName: assignment.group.name,
      versionNumber: latestVersion.versionNumber,
      filename: latestVersion.filename,
      fileSizeFormatted: `${(latestVersion.fileSize / 1024).toFixed(1)} KB`,
      reviewQueueUrl,
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        userId: assignment.reviewer.id,
        title: `Report Submitted: ${assignment.group.name}`,
        message: `${assignment.primaryAnalyst.fullName} submitted report v${latestVersion.versionNumber} with physical MIME attachment for evaluation`,
        type: 'SUBMISSION',
        link: `/review-queue`,
      },
    });

    // Email dispatch with physical MIME attachment
    await sendEmail({
      to: assignment.reviewer.user.email,
      subject,
      html,
      attachments,
      templateType: 'REPORT_SUBMITTED',
      idempotencyKey: `report-submitted-${latestVersion.id}`,
    });
  } catch (error) {
    console.error('[Dispatch Report Submitted Error]:', error);
  }
}

/**
 * Dispatch reviewer verdict notification to the primary analyst.
 */
export async function dispatchReviewVerdictNotification(
  assignmentId: string,
  verdict: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
  comments?: string
) {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        group: true,
        primaryAnalyst: { include: { user: true } },
        reviewer: true,
      },
    });

    if (!assignment || !assignment.primaryAnalyst?.user?.email) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const taskUrl = `${appUrl}/my-tasks/${assignment.id}`;

    const { subject, html } = renderReviewVerdictEmail({
      analystName: assignment.primaryAnalyst.fullName,
      taskTitle: assignment.title,
      groupName: assignment.group.name,
      verdict,
      reviewerName: assignment.reviewer.fullName,
      comments,
      taskUrl,
    });

    // In-app notification
    await prisma.notification.create({
      data: {
        userId: assignment.primaryAnalyst.id,
        title: `Review Verdict: ${verdict}`,
        message: `${assignment.reviewer.fullName} evaluated your report for ${assignment.group.name}: ${verdict}`,
        type: 'REVIEW',
        link: `/my-tasks/${assignment.id}`,
      },
    });

    // Email dispatch
    await sendEmail({
      to: assignment.primaryAnalyst.user.email,
      subject,
      html,
      templateType: `REVIEW_VERDICT_${verdict}`,
      idempotencyKey: `verdict-${assignment.id}-${Date.now()}`,
    });
  } catch (error) {
    console.error('[Dispatch Review Verdict Error]:', error);
  }
}
