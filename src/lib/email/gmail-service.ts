import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';
import { decryptCredential } from '@/lib/crypto/encryption';

export interface GmailSendAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface GmailSendOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html: string;
  attachments?: GmailSendAttachment[];
  replyTo?: string;
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  response?: string;
  senderAddress: string;
  recipientAddress: string;
  mocked?: boolean;
  error?: {
    code: string;
    message: string;
    isTemporary: boolean;
  };
}

/**
 * Classifies Gmail SMTP errors into structured error codes and messages.
 */
export function classifyGmailError(err: any): {
  code: string;
  message: string;
  isTemporary: boolean;
} {
  const errMsg = err?.message || String(err);
  const response = err?.response || '';
  const responseCode = err?.responseCode;

  // 535 5.7.8 Username and Password not accepted / Bad credentials
  if (responseCode === 535 || errMsg.includes('535') || errMsg.includes('BadCredentials') || errMsg.includes('Username and Password not accepted')) {
    return {
      code: 'GMAIL_AUTH_FAILED',
      message: 'Gmail authentication failed: The provided App Password was rejected. Please verify 2-Step Verification and regenerate an App Password at myaccount.google.com/apppasswords.',
      isTemporary: false,
    };
  }

  // 552 5.3.4 Message size exceeds fixed maximum limit
  if (responseCode === 552 || errMsg.includes('552') || errMsg.includes('exceeds fixed maximum limit')) {
    return {
      code: 'ATTACHMENT_SIZE_EXCEEDED',
      message: 'Attachment payload exceeds Gmail SMTP size limit. Total MIME payload must remain below 25 MB.',
      isTemporary: false,
    };
  }

  // Rate limiting / Daily sending limit
  if (responseCode === 450 || responseCode === 452 || responseCode === 421 || errMsg.includes('452') || errMsg.includes('rate limit') || errMsg.includes('quota')) {
    return {
      code: 'GMAIL_RATE_LIMITED',
      message: 'Gmail sending quota or temporary rate limit reached. The system will automatically back off and retry.',
      isTemporary: true,
    };
  }

  // Connection timeout / DNS failure
  if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND') {
    return {
      code: 'GMAIL_CONNECTION_FAILED',
      message: `Failed to connect to smtp.gmail.com: ${err.code}. Check outbound network egress and port 465/587 permissions.`,
      isTemporary: true,
    };
  }

  return {
    code: 'GMAIL_SMTP_ERROR',
    message: errMsg.replace(/pass(word)?[:=]\s*\S+/gi, 'pass=••••••••'),
    isTemporary: false,
  };
}

/**
 * Retrieve active EmailConfiguration from database.
 */
export async function getActiveGmailConfig() {
  try {
    return await prisma.emailConfiguration.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error) {
    console.error('[GmailService] Error fetching EmailConfiguration:', error);
    return null;
  }
}

/**
 * Test an App Password connection against smtp.gmail.com directly.
 */
export async function verifyGmailSmtpCredentials(
  email: string,
  appPasswordPlain: string,
  host = 'smtp.gmail.com',
  port = 465
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: email.trim(),
        pass: appPasswordPlain.trim(),
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    const classified = classifyGmailError(err);
    return {
      success: false,
      error: classified.message,
    };
  }
}

/**
 * Dispatches an email through the configured ThreatLedger Gmail sender account.
 * Guarantees physical MIME attachments (not links) and archival in Gmail Sent folder.
 */
export async function sendReportEmailViaGmail(
  options: GmailSendOptions
): Promise<GmailSendResult> {
  const config = await getActiveGmailConfig();

  // If no Gmail configuration is saved in the database, check environment variables fallback
  let senderEmail = config?.senderEmail;
  let decryptedPassword = '';
  let fromName = config?.senderDisplayName || 'ThreatLedger';
  let host = config?.smtpHost || 'smtp.gmail.com';
  let port = config?.smtpPort || 465;
  let replyTo = options.replyTo || config?.replyToEmail || undefined;
  let archiveBcc = config?.archiveBccEmail;

  if (config) {
    try {
      decryptedPassword = decryptCredential(
        config.encryptedAppPassword,
        config.encryptionIv,
        config.encryptionTag
      );
    } catch (e: any) {
      return {
        success: false,
        senderAddress: config.senderEmail,
        recipientAddress: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        error: {
          code: 'CREDENTIAL_DECRYPTION_ERROR',
          message: 'Failed to decrypt stored Gmail App Password. Re-enter credentials in Settings.',
          isTemporary: false,
        },
      };
    }
  } else if (process.env.GMAIL_SENDER_EMAIL && process.env.GMAIL_APP_PASSWORD) {
    senderEmail = process.env.GMAIL_SENDER_EMAIL;
    decryptedPassword = process.env.GMAIL_APP_PASSWORD;
  }

  const recipientStr = Array.isArray(options.to) ? options.to.join(', ') : options.to;

  // If credentials are missing or still unconfigured, log and simulate in Mock Dev mode
  if (!senderEmail || !decryptedPassword || decryptedPassword.includes('placeholder')) {
    console.warn(`[GmailService] Gmail not fully configured. Mocking dispatch to ${recipientStr}`);
    const mockMessageId = `<threatledger-mock-${Date.now()}@threatledger.internal>`;
    
    return {
      success: true,
      messageId: mockMessageId,
      response: '250 2.0.0 OK (Mock Development Mode Dispatch)',
      senderAddress: senderEmail || 'threatledger.notifications@gmail.com',
      recipientAddress: recipientStr,
      mocked: true,
    };
  }

  // Construct combined BCC list including optional archive BCC
  const bccList: string[] = [];
  if (options.bcc) {
    if (Array.isArray(options.bcc)) bccList.push(...options.bcc);
    else bccList.push(options.bcc);
  }
  if (archiveBcc && !bccList.includes(archiveBcc)) {
    bccList.push(archiveBcc);
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: senderEmail,
        pass: decryptedPassword,
      },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
    });

    const mailOptions = {
      from: `"${fromName}" <${senderEmail}>`,
      to: options.to,
      cc: options.cc,
      bcc: bccList.length > 0 ? bccList : undefined,
      replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      senderAddress: senderEmail,
      recipientAddress: recipientStr,
      mocked: false,
    };
  } catch (err: any) {
    console.error('[GmailService] Send failed:', err);
    const classified = classifyGmailError(err);
    return {
      success: false,
      senderAddress: senderEmail,
      recipientAddress: recipientStr,
      error: classified,
    };
  }
}
