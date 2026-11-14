'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  ExternalLink,
  MessageSquare,
  Clock,
  ShieldCheck,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

export default function ReviewQueuePage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED_FOR_REVIEW');

  // Decision Modal state
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'REJECT'>('APPROVE');
  const [comments, setComments] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  async function loadReviewQueue() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch {
      console.error('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviewQueue();
  }, [statusFilter]);

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/reviews/${selectedAssignment.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: decisionAction,
          comments: comments || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to submit review decision');
      } else {
        alert(data.message);
        setSelectedAssignment(null);
        setComments('');
        loadReviewQueue();
      }
    } catch {
      alert('Network error submitting review decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleDownloadReport = async (versionId: string, filename: string) => {
    try {
      const res = await fetch(`/api/files/download/${versionId}`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert('Failed to generate authorized download URL');
      }
    } catch {
      alert('Network error downloading file');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <ClipboardCheck className="w-4 h-4" />
            CTI Governance & Quality Assurance
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Review Queue</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Independent reviewer sign-off workspace. Evaluate submitted final research reports and deliver formal verdicts.
          </p>
        </div>

        {/* Section 35 Decoupling Banner */}
        <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-400 font-semibold self-start sm:self-auto">
          Section 35: Submission ≠ Approval
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold overflow-x-auto">
        {[
          { id: 'SUBMITTED_FOR_REVIEW', label: 'Awaiting Review' },
          { id: 'CHANGES_REQUESTED', label: 'Changes Requested' },
          { id: 'APPROVED_COMPLETED', label: 'Approved Research' },
          { id: 'REJECTED', label: 'Rejected' },
          { id: '', label: 'All Reviews' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === tab.id
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Review Queue Submissions List */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Submissions Requiring Evaluation ({submissions.length})</span>
          <span className="text-slate-500">Asia/Kolkata (IST) Standard Time</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading review submissions...</span>
          </div>
        ) : submissions.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-1">
            <p>No research assignments currently in this review status.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {submissions.map((s) => {
              const latestReport = s.reports[0];
              const latestVersion = latestReport?.versions[0];
              const completedChecklist = s.checklistItems?.filter((i: any) => i.status === 'COMPLETED').length || 0;

              return (
                <div key={s.id} className="p-5 hover:bg-slate-900/40 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300">
                        {s.priority}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === 'APPROVED_COMPLETED'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                            : s.status === 'SUBMITTED_FOR_REVIEW'
                            ? 'bg-amber-950 text-amber-300 border-amber-500/40 animate-pulse'
                            : 'bg-rose-950 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {s.status}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Target: <strong className="text-emerald-400">{s.group.name}</strong>
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">{s.title}</h3>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span>Submitted by: <strong className="text-white">{s.primaryAnalyst?.fullName}</strong></span>
                      <span>•</span>
                      <span>Submitted: <strong className="text-white font-mono">{s.submittedAt ? formatIST(s.submittedAt) : 'Pending'}</strong></span>
                      <span>•</span>
                      <span>Checklist: <strong className="text-white font-mono">{completedChecklist}/15</strong></span>
                    </div>

                    {/* Attached Report Version Card */}
                    {latestVersion && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 inline-flex items-center gap-3 text-xs">
                        <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-white">
                            {latestVersion.filename}{' '}
                            <span className="text-emerald-400 font-mono">(Version {latestVersion.versionNumber})</span>
                          </p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {(latestVersion.fileSize / 1024).toFixed(1)} KB | SHA-256: {latestVersion.sha256.substring(0, 12)}...
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadReport(latestVersion.id, latestVersion.filename)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 ml-2"
                          title="Authorized Secure Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Review Actions */}
                  <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
                    <Link
                      href={`/my-tasks/${s.id}`}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                    >
                      Inspect Task
                    </Link>

                    {s.status === 'SUBMITTED_FOR_REVIEW' && (
                      <button
                        onClick={() => {
                          setSelectedAssignment(s);
                          setDecisionAction('APPROVE');
                          setComments('');
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20"
                      >
                        Evaluate & Sign Off
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Decision Modal (Section 34) */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a101f] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Reviewer Decision & Sign-off</h3>
              </div>
              <button onClick={() => setSelectedAssignment(null)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleDecisionSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Evaluating Target:</span>
                <p className="font-bold text-white text-sm">
                  {selectedAssignment.title} ({selectedAssignment.group.name})
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Analyst: <strong className="text-white">{selectedAssignment.primaryAnalyst?.fullName}</strong>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">Reviewer Verdict *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionAction('APPROVE')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs text-center transition-all ${
                      decisionAction === 'APPROVE'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ✓ Approve Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('REQUEST_CHANGES')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs text-center transition-all ${
                      decisionAction === 'REQUEST_CHANGES'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ✎ Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('REJECT')}
                    className={`py-2 px-3 rounded-lg border font-bold text-xs text-center transition-all ${
                      decisionAction === 'REJECT'
                        ? 'bg-rose-500 text-white border-rose-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    ✕ Reject Report
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Reviewer Feedback / Comments {decisionAction !== 'APPROVE' ? '*' : '(Optional)'}
                </label>
                <textarea
                  rows={4}
                  required={decisionAction !== 'APPROVE'}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={
                    decisionAction === 'APPROVE'
                      ? 'Formal sign-off comments (optional)...'
                      : 'Specific revisions requested from analyst...'
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                Approval records your reviewer identity, timestamp, and locks the approved report version. The assignment transitions to <strong className="text-white">APPROVED_COMPLETED</strong>.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {submittingDecision ? 'Executing Verdict...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
