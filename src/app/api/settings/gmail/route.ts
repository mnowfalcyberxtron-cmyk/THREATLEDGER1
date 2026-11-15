import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { encryptCredential, decryptCredential } from '@/lib/crypto/encryption';
import { verifyGmailSmtpCredentials, sendReportEmailViaGmail } from '@/lib/email/gmail-service';
import { DEFAULT_TEMPLATES, interpolateTemplate, renderHtmlEmail } from '@/lib/email/report-templates';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ADMIN);

    const config = await prisma.emailConfiguration.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      return NextResponse.json({
        configured: false,
        status: 'NOT_CONFIGURED',
        senderEmail: '',
        senderDisplayName: 'ThreatLedger',
        replyToEmail: '',
        archiveBccEmail: '',
        maxAttachmentBytes: 18 * 1024 * 1024,
      });
    }

    return NextResponse.json({
      configured: Boolean(config.senderEmail && config.encryptedAppPassword),
      status: config.status,
      senderEmail: config.senderEmail,
      senderDisplayName: config.senderDisplayName,
      replyToEmail: config.replyToEmail || '',
      archiveBccEmail: config.archiveBccEmail || '',
      maxAttachmentBytes: config.maxAttachmentBytes,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      lastTestedAt: config.lastTestedAt,
      lastSuccessAt: config.lastSuccessAt,
      lastFailureAt: config.lastFailureAt,
      lastErrorMessage: config.lastErrorMessage,
      updatedAt: config.updatedAt,
      hasStoredPassword: Boolean(config.encryptedAppPassword),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Gmail Config GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve Gmail settings' }, { status: 500 });
  }
}

const saveConfigSchema = z.object({
  action: z.enum(['SAVE_CONFIG', 'TEST_CONNECTION', 'SEND_TEST_EMAIL', 'DISCONNECT']),
  senderEmail: z.string().email().optional(),
  appPassword: z.string().min(1).optional(),
  senderDisplayName: z.string().optional(),
  replyToEmail: z.string().email().optional().or(z.literal('')),
  archiveBccEmail: z.string().email().optional().or(z.literal('')),
  testRecipient: z.string().email().optional(),
  maxAttachmentBytes: z.number().int().positive().max(25 * 1024 * 1024).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = saveConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid parameters' },
        { status: 400 }
      );
    }

    const {
      action,
      senderEmail,
      appPassword,
      senderDisplayName = 'ThreatLedger',
      replyToEmail,
      archiveBccEmail,
      testRecipient,
      maxAttachmentBytes = 18 * 1024 * 1024,
    } = parsed.data;

    const existingConfig = await prisma.emailConfiguration.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    // 1. SAVE CONFIGURATION
    if (action === 'SAVE_CONFIG') {
      if (!senderEmail) {
        return NextResponse.json({ error: 'Sender Gmail address is required' }, { status: 400 });
      }

      let encryptedAppPassword = existingConfig?.encryptedAppPassword || '';
      let encryptionIv = existingConfig?.encryptionIv || '';
      let encryptionTag = existingConfig?.encryptionTag || '';

      if (appPassword && appPassword.trim().length > 0) {
        // Encrypt with authenticated AES-256-GCM
        const encrypted = encryptCredential(appPassword.trim());
        encryptedAppPassword = encrypted.encrypted;
        encryptionIv = encrypted.iv;
        encryptionTag = encrypted.tag;
      } else if (!existingConfig?.encryptedAppPassword) {
        return NextResponse.json({ error: 'Gmail App Password is required' }, { status: 400 });
      }

      // Verify connection immediately
      let testPassword = appPassword;
      if (!testPassword && existingConfig) {
        testPassword = decryptCredential(existingConfig.encryptedAppPassword, existingConfig.encryptionIv, existingConfig.encryptionTag);
      }

      const verifyRes = await verifyGmailSmtpCredentials(senderEmail, testPassword || '');
      const newStatus = verifyRes.success ? 'CONNECTED' : 'CONNECTION_FAILED';
      const lastError = verifyRes.success ? null : verifyRes.error;

      let saved;
      if (existingConfig) {
        saved = await prisma.emailConfiguration.update({
          where: { id: existingConfig.id },
          data: {
            senderEmail: senderEmail.trim(),
            senderDisplayName: senderDisplayName.trim(),
            encryptedAppPassword,
            encryptionIv,
            encryptionTag,
            replyToEmail: replyToEmail ? replyToEmail.trim() : null,
            archiveBccEmail: archiveBccEmail ? archiveBccEmail.trim() : null,
            maxAttachmentBytes,
            status: newStatus,
            lastTestedAt: new Date(),
            lastSuccessAt: verifyRes.success ? new Date() : existingConfig.lastSuccessAt,
            lastFailureAt: verifyRes.success ? existingConfig.lastFailureAt : new Date(),
            lastErrorMessage: lastError,
            updatedById: caller.id,
          },
        });
      } else {
        saved = await prisma.emailConfiguration.create({
          data: {
            senderEmail: senderEmail.trim(),
            senderDisplayName: senderDisplayName.trim(),
            encryptedAppPassword,
            encryptionIv,
            encryptionTag,
            replyToEmail: replyToEmail ? replyToEmail.trim() : null,
            archiveBccEmail: archiveBccEmail ? archiveBccEmail.trim() : null,
            maxAttachmentBytes,
            status: newStatus,
            lastTestedAt: new Date(),
            lastSuccessAt: verifyRes.success ? new Date() : null,
            lastFailureAt: verifyRes.success ? null : new Date(),
            lastErrorMessage: lastError,
            updatedById: caller.id,
          },
        });
      }

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'GMAIL_CONFIG_UPDATED',
        targetType: 'SYSTEM_SETTING',
        targetId: saved.id,
        afterJson: {
          senderEmail,
          senderDisplayName,
          hasReplyTo: Boolean(replyToEmail),
          hasArchiveBcc: Boolean(archiveBccEmail),
          status: newStatus,
        },
      });

      return NextResponse.json({
        success: true,
        message: verifyRes.success
          ? 'Gmail sender configuration verified and saved successfully.'
          : `Configuration saved, but connection test failed: ${verifyRes.error}`,
        status: newStatus,
        error: lastError,
      });
    }

    // 2. TEST CONNECTION
    if (action === 'TEST_CONNECTION') {
      const emailToTest = senderEmail || existingConfig?.senderEmail;
      let passToTest = appPassword;

      if (!passToTest && existingConfig) {
        passToTest = decryptCredential(
          existingConfig.encryptedAppPassword,
          existingConfig.encryptionIv,
          existingConfig.encryptionTag
        );
      }

      if (!emailToTest || !passToTest) {
        return NextResponse.json({ error: 'Incomplete credentials to test connection' }, { status: 400 });
      }

      const verifyRes = await verifyGmailSmtpCredentials(emailToTest, passToTest);

      if (existingConfig) {
        await prisma.emailConfiguration.update({
          where: { id: existingConfig.id },
          data: {
            status: verifyRes.success ? 'CONNECTED' : 'CONNECTION_FAILED',
            lastTestedAt: new Date(),
            lastSuccessAt: verifyRes.success ? new Date() : existingConfig.lastSuccessAt,
            lastFailureAt: verifyRes.success ? existingConfig.lastFailureAt : new Date(),
            lastErrorMessage: verifyRes.success ? null : verifyRes.error,
          },
        });
      }

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'GMAIL_CONNECTION_TEST',
        targetType: 'SYSTEM_SETTING',
        afterJson: { success: verifyRes.success, error: verifyRes.error },
      });

      return NextResponse.json({
        success: verifyRes.success,
        message: verifyRes.success
          ? 'Gmail SMTP connection verified successfully (smtp.gmail.com:465 TLS).'
          : `Connection failed: ${verifyRes.error}`,
        error: verifyRes.error,
      });
    }

    // 3. SEND TEST EMAIL
    if (action === 'SEND_TEST_EMAIL') {
      const recipient = testRecipient || caller.email;
      const template = DEFAULT_TEMPLATES.GMAIL_TEST_EMAIL;

      const dateStr = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date());

      const context = {
        submitted_by: existingConfig?.senderEmail || 'threatledger.notifications@gmail.com',
        submission_date: `${dateStr} IST`,
      };

      const subject = interpolateTemplate(template.subject, context);
      const text = interpolateTemplate(template.bodyText, context);
      const html = renderHtmlEmail(subject, text);

      const sendResult = await sendReportEmailViaGmail({
        to: recipient,
        subject,
        text,
        html,
      });

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'GMAIL_TEST_EMAIL_SENT',
        targetType: 'SYSTEM_SETTING',
        afterJson: {
          recipient,
          success: sendResult.success,
          messageId: sendResult.messageId,
          mocked: sendResult.mocked,
          error: sendResult.error,
        },
      });

      if (!sendResult.success) {
        return NextResponse.json(
          { error: `Test email failed to dispatch: ${sendResult.error?.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Diagnostic test email sent successfully to ${recipient} via ${sendResult.senderAddress}${sendResult.mocked ? ' (Mock Dispatch Mode)' : ''}.`,
        messageId: sendResult.messageId,
        mocked: sendResult.mocked,
      });
    }

    // 4. DISCONNECT GMAIL
    if (action === 'DISCONNECT') {
      if (existingConfig) {
        await prisma.emailConfiguration.delete({
          where: { id: existingConfig.id },
        });
      }

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.fullName,
        actorEmail: caller.email,
        action: 'GMAIL_CONFIG_DISCONNECTED',
        targetType: 'SYSTEM_SETTING',
      });

      return NextResponse.json({
        success: true,
        message: 'Gmail sender account disconnected. Stored credentials removed.',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Gmail Config POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
