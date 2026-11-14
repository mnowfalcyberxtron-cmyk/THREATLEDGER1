'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckSquare,
  ArrowLeft,
  Clock,
  Briefcase,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  FileText,
  FolderArchive,
  Upload,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

export default function AnalystTaskWorkbench() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'SHARED' | 'ADMIN_PRIVATE'>('SHARED');
  const [postingNote, setPostingNote] = useState(false);

  // Status transition state
  const [transitioning, setTransitioning] = useState(false);
  const [transitionReason, setTransitionReason] = useState('');

  // Checklist NA state
  const [naItemId, setNaItemId] = useState<string | null>(null);
  const [naReason, setNaReason] = useState('');

  async function loadTask() {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load task workbench');
      } else {
        setAssignment(data.assignment);
      }
    } catch {
      setError('Connection failure loading task workbench');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const handleUpdateChecklist = async (itemId: string, status: string, explanation?: string) => {
    try {
      const res = await fetch(`/api/assignments/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistItemId: itemId,
          status,
          notApplicableReason: explanation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Checklist update rejected');
      } else {
        loadTask();
        setNaItemId(null);
        setNaReason('');
      }
    } catch {
      alert('Network error updating checklist item');
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setPostingNote(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent, noteType }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to post note');
      } else {
        setNewNoteContent('');
        loadTask();
      }
    } catch {
      alert('Network error posting note');
    } finally {
      setPostingNote(false);
    }
  };

  const handleStatusTransition = async (targetStatus: string, reasonText?: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, reason: reasonText }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Status transition rejected');
      } else {
        alert(data.message);
        loadTask();
      }
    } catch {
      alert('Network error processing transition');
    } finally {
      setTransitioning(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <span className="animate-pulse">Loading analyst research workbench...</span>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-white font-bold">{error || 'Task not found or access restricted'}</p>
        <Link href="/my-tasks" className="text-emerald-400 hover:underline">
          Return to My Tasks
        </Link>
      </div>
    );
  }

  const completedChecklistCount = assignment.checklistItems?.filter(
    (i: any) => i.status === 'COMPLETED' || i.status === 'NOT_APPLICABLE'
  ).length || 0;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/my-tasks"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Tasks</span>
        </Link>

        {/* Lifecycle Transitions Bar */}
        <div className="flex items-center gap-2">
          {assignment.status === 'ASSIGNED' && (
            <button
              onClick={() => handleStatusTransition('ACCEPTED', 'Analyst accepted task')}
              disabled={transitioning}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Accept Assignment
            </button>
          )}

          {(assignment.status === 'ACCEPTED' || assignment.status === 'ON_HOLD' || assignment.status === 'CHANGES_REQUESTED') && (
            <button
              onClick={() => handleStatusTransition('IN_PROGRESS', 'Analyst initiated active research')}
              disabled={transitioning}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Start / Resume Research
            </button>
          )}

          {assignment.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => handleStatusTransition('ON_HOLD', 'Task paused by analyst')}
                disabled={transitioning}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Put On Hold
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Confirm submission notes for reviewer:');
                  if (reason !== null) {
                    handleStatusTransition('SUBMITTED_FOR_REVIEW', reason);
                  }
                }}
                disabled={transitioning}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
              >
                Submit for Review
              </button>
            </>
          )}
        </div>
      </div>

      {/* Task Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0a101f] border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                {assignment.priority} Priority
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                {assignment.status}
              </span>
              <span className="text-xs text-slate-500">
                Due: <strong className="text-white font-mono">{assignment.dueDate ? formatIST(assignment.dueDate) : 'No Deadline'}</strong>
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">{assignment.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Syndicate:{' '}
              <Link href={`/groups/${assignment.group.id}`} className="text-emerald-400 font-bold hover:underline">
                {assignment.group.name}
              </Link>{' '}
              ({assignment.group.victimCount} known victims)
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Primary Analyst</span>
              <span className="text-white font-semibold">{assignment.primaryAnalyst?.fullName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Reviewer</span>
              <span className="text-white font-semibold">{assignment.reviewer?.fullName}</span>
            </div>
          </div>
        </div>

        {assignment.instructions && (
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white block mb-1">Research Scope & Instructions:</span>
            {assignment.instructions}
          </div>
        )}

        {assignment.rejectionReason && (
          <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
            <span className="font-bold text-rose-400 block mb-1">Reviewer Feedback / Changes Requested:</span>
            {assignment.rejectionReason}
          </div>
        )}
      </div>

      {/* Main Grid: Checklist (Left) & Two-Way Discussion Notes (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Standardized 15-Point Research Checklist (Section 26) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Standardized 15-Point Research Checklist
                </h2>
                <span className="text-[11px] text-slate-500">
                  Section 26 CTI Quality Control Standard
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                {completedChecklistCount} / 15
              </span>
            </div>

            <div className="space-y-2">
              {assignment.checklistItems.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">{item.title}</span>
                    {item.notApplicableReason && (
                      <span className="text-[10px] text-amber-400 block italic">
                        Reason: {item.notApplicableReason}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleUpdateChecklist(item.id, 'COMPLETED')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Done
                    </button>
                    <button
                      onClick={() => handleUpdateChecklist(item.id, 'IN_PROGRESS')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        item.status === 'IN_PROGRESS'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Mandatory explanation why this item is Not Applicable:');
                        if (reason) {
                          handleUpdateChecklist(item.id, 'NOT_APPLICABLE', reason);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        item.status === 'NOT_APPLICABLE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      N/A
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Two-Way Analyst Notes & Admin Private Notes (Section 27) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Analyst & Reviewer Discussion Thread
              </h2>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Two-Way Notes</span>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1">
              {assignment.notes.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No notes posted yet. Use this channel to coordinate research findings and questions with the reviewer.
                </div>
              ) : (
                assignment.notes.map((n: any) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      n.noteType === 'ADMIN_PRIVATE'
                        ? 'bg-purple-950/30 border-purple-500/30 text-purple-200'
                        : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        <span>{n.author?.fullName}</span>
                        {n.noteType === 'ADMIN_PRIVATE' && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-bold border border-purple-500/40">
                            ADMIN PRIVATE
                          </span>
                        )}
                      </div>
                      <span className="font-mono">{formatIST(n.createdAt)}</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{n.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Note Post Box */}
            <form onSubmit={handlePostNote} className="pt-3 border-t border-slate-800 space-y-2">
              <textarea
                rows={2}
                required
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Write a research note or inquiry..."
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />

              <div className="flex items-center justify-between">
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value="SHARED">Shared (Analyst & Reviewer)</option>
                  <option value="ADMIN_PRIVATE">Admin Only (Private Internal Note)</option>
                </select>

                <button
                  type="submit"
                  disabled={postingNote}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>{postingNote ? 'Posting...' : 'Post Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
