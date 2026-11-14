'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  Briefcase,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadMyTasks() {
    setLoading(true);
    try {
      const res = await fetch('/api/assignments?myTasks=true');
      const data = await res.json();
      setTasks(data.assignments || []);
    } catch {
      console.error('Failed to load my tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyTasks();
  }, []);

  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED').length;
  const changesRequestedCount = tasks.filter((t) => t.status === 'CHANGES_REQUESTED').length;
  const submittedCount = tasks.filter((t) => t.status === 'SUBMITTED_FOR_REVIEW').length;
  const approvedCount = tasks.filter((t) => t.status === 'APPROVED_COMPLETED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <CheckSquare className="w-4 h-4" />
          Analyst Personal Workspace
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">My Research Tasks</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Your active threat intelligence research tasks, 15-point checklists, report submissions, and reviewer feedback.
        </p>
      </div>

      {/* Task Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Research</span>
          <span className="text-2xl font-extrabold text-white mt-1 block font-mono">{inProgressCount}</span>
          <span className="text-[11px] text-slate-500">In Progress / Accepted</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Changes Requested</span>
          <span className="text-2xl font-extrabold text-rose-400 mt-1 block font-mono">{changesRequestedCount}</span>
          <span className="text-[11px] text-slate-500">Reviewer revisions required</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted for Review</span>
          <span className="text-2xl font-extrabold text-amber-400 mt-1 block font-mono">{submittedCount}</span>
          <span className="text-[11px] text-slate-500">Awaiting reviewer sign-off</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Completed & Approved</span>
          <span className="text-2xl font-extrabold text-emerald-400 mt-1 block font-mono">{approvedCount}</span>
          <span className="text-[11px] text-slate-500">Signed off by reviewer</span>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">My Workload Queue ({tasks.length})</span>
          <span className="text-slate-500">Asia/Kolkata (IST) Standard Time</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading personal tasks...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <p>You have no research tasks assigned at this moment.</p>
            <p className="text-slate-600">Tasks allocated by administrators will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {tasks.map((t) => {
              const completedCount = t.checklistItems?.filter((i: any) => i.status === 'COMPLETED').length || 0;
              const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'APPROVED_COMPLETED';

              return (
                <div key={t.id} className="p-4 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priority === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                            : t.priority === 'HIGH'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {t.priority}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          t.status === 'APPROVED_COMPLETED'
                            ? 'bg-emerald-950 text-emerald-400'
                            : t.status === 'SUBMITTED_FOR_REVIEW'
                            ? 'bg-amber-950 text-amber-400 animate-pulse'
                            : t.status === 'CHANGES_REQUESTED'
                            ? 'bg-rose-950 text-rose-400'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        {t.status}
                      </span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    <Link href={`/my-tasks/${t.id}`} className="hover:text-emerald-400 transition-colors block">
                      <h3 className="font-bold text-white text-sm">{t.title}</h3>
                      <p className="text-xs text-slate-400">
                        Target Syndicate: <strong className="text-emerald-400">{t.group?.name}</strong> | Reviewer: {t.reviewer?.fullName}
                      </p>
                    </Link>
                  </div>

                  <div className="flex items-center gap-4 text-xs self-start sm:self-auto shrink-0">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block font-mono">
                        Checklist: <strong className="text-white">{completedCount}/15</strong>
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Due: {t.dueDate ? formatIST(t.dueDate) : 'No Deadline'}
                      </span>
                    </div>

                    <Link
                      href={`/my-tasks/${t.id}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1 shadow-sm"
                    >
                      <span>Workbench</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
