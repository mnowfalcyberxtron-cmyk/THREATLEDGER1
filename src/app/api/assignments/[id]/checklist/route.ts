import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ChecklistStatus, UserRole } from '@prisma/client';
import { z } from 'zod';

const updateItemSchema = z.object({
  checklistItemId: z.string().min(1, 'Item ID required'),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE']),
  notApplicableReason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = updateItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid checklist update' },
        { status: 400 }
      );
    }

    const { checklistItemId, status, notApplicableReason } = parsed.data;

    if (status === 'NOT_APPLICABLE' && (!notApplicableReason || notApplicableReason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'An explanation is mandatory when marking a checklist item as Not Applicable.' },
        { status: 400 }
      );
    }

    const item = await prisma.assignmentChecklistItem.findUnique({
      where: { id: checklistItemId },
      include: { assignment: true },
    });

    if (!item || item.assignmentId !== assignmentId) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    // Ensure only assigned analyst, reviewer, or admin can update checklist
    if (caller.role === UserRole.ANALYST && item.assignment.primaryAnalystId !== caller.id) {
      return NextResponse.json({ error: 'Only the assigned analyst can update checklist progress' }, { status: 403 });
    }

    const updated = await prisma.assignmentChecklistItem.update({
      where: { id: checklistItemId },
      data: {
        status: status as ChecklistStatus,
        notApplicableReason: status === 'NOT_APPLICABLE' ? notApplicableReason : null,
        updatedById: caller.id,
      },
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
  }
}
