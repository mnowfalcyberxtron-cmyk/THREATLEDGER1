import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { NoteType, UserRole } from '@prisma/client';
import { z } from 'zod';

const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty').trim(),
  noteType: z.enum(['SHARED', 'ADMIN_PRIVATE']).default('SHARED'),
  parentNoteId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireAuth(UserRole.ANALYST);
    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid note content' },
        { status: 400 }
      );
    }

    const { content, noteType, parentNoteId } = parsed.data;

    // Strict security check: Analysts CANNOT post or view ADMIN_PRIVATE notes
    if (noteType === 'ADMIN_PRIVATE' && caller.role === UserRole.ANALYST) {
      return NextResponse.json(
        { error: 'Only administrators can create private administrative notes.' },
        { status: 403 }
      );
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        group: { select: { name: true } },
        primaryAnalyst: true,
        reviewer: true,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const note = await prisma.assignmentNote.create({
      data: {
        assignmentId,
        authorId: caller.id,
        noteType: noteType as NoteType,
        content,
        parentNoteId,
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Notify counterpart if shared note
    if (noteType === 'SHARED') {
      const recipientId =
        caller.id === assignment.primaryAnalystId
          ? assignment.reviewerId
          : assignment.primaryAnalystId;

      if (recipientId && recipientId !== caller.id) {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            title: `New Note on ${assignment.group.name}`,
            message: `${caller.fullName} posted a note: "${content.substring(0, 80)}..."`,
            type: 'NOTE',
            link: `/my-tasks/${assignmentId}`,
          },
        });
      }
    }

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to post note' }, { status: 500 });
  }
}
