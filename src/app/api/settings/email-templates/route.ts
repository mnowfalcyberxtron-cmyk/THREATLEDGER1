import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { DEFAULT_TEMPLATES } from '@/lib/email/report-templates';
import { UserRole } from '@prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(UserRole.ADMIN);

    const storedTemplates = await prisma.emailTemplateConfig.findMany();
    const storedMap = new Map(storedTemplates.map((t) => [t.templateKey, t]));

    const templates = Object.values(DEFAULT_TEMPLATES).map((def) => {
      const custom = storedMap.get(def.templateKey);
      return {
        templateKey: def.templateKey,
        name: def.name,
        subject: custom?.subject || def.subject,
        bodyText: custom?.bodyText || def.bodyText,
        enabled: custom ? custom.enabled : true,
        isCustomized: Boolean(custom),
        availableVariables: [
          '{{report_id}}',
          '{{report_name}}',
          '{{submission_id}}',
          '{{submission_version}}',
          '{{submitted_by}}',
          '{{assigned_reviewer}}',
          '{{reviewer_email}}',
          '{{submission_date}}',
          '{{submission_status}}',
          '{{review_comments}}',
          '{{approval_date}}',
        ],
      };
    });

    return NextResponse.json({ templates });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Email Templates GET Error]:', error);
    return NextResponse.json({ error: 'Failed to retrieve templates' }, { status: 500 });
  }
}

const updateTemplateSchema = z.object({
  templateKey: z.string().min(1),
  subject: z.string().min(1),
  bodyText: z.string().min(1),
  enabled: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAuth(UserRole.ADMIN);
    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid template payload' },
        { status: 400 }
      );
    }

    const { templateKey, subject, bodyText, enabled = true } = parsed.data;
    const defaultDef = DEFAULT_TEMPLATES[templateKey];

    if (!defaultDef) {
      return NextResponse.json({ error: `Unknown template key "${templateKey}"` }, { status: 404 });
    }

    const updated = await prisma.emailTemplateConfig.upsert({
      where: { templateKey },
      create: {
        templateKey,
        name: defaultDef.name,
        subject,
        bodyText,
        enabled,
      },
      update: {
        subject,
        bodyText,
        enabled,
      },
    });

    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.fullName,
      actorEmail: caller.email,
      action: 'EMAIL_TEMPLATE_UPDATED',
      targetType: 'SYSTEM_SETTING',
      targetId: updated.id,
      afterJson: { templateKey, subject },
    });

    return NextResponse.json({
      success: true,
      message: `Template "${defaultDef.name}" updated successfully.`,
      template: updated,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    console.error('[Email Templates POST Error]:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}
