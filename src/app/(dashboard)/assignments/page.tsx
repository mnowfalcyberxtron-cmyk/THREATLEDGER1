'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Users2,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { WeekdayDatePicker } from '@/components/ui/WeekdayDatePicker';
import { getWorkingDayDeadlineStatus } from '@/lib/datetime/working-days';

interface AssignmentRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  group: { id: string; name: string; victimCount: number };
  primaryAnalyst: { fullName: string; role: string };
  reviewer: { fullName: string };
  checklistItems: Array<{ id: string; status: string }>;
  _count: { notes: number; evidence: number };
}

export default function AssignmentsPage() {
  const searchParams = useSearchParams();
  const preselectedGroupId = searchParams.get('allocateGroupId');

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Allocate Modal state
  const [showModal, setShowModal] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedAnalystId, setSelectedAnalystId] = useState('');
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [individualDeadlines, setIndividualDeadlines] = useState<Record<string, string>>({});
  const [useSeparateDeadlines, setUseSeparateDeadlines] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function loadAssignments() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);

      const res = await fetch(`/api/assignments?${params.toString()}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch {
      console.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }

  async function loadModalData() {
    try {
      const [groupsRes, teamRes] = await Promise.all([
        fetch('/api/groups?limit=100'),
        fetch('/api/team/members'),
      ]);
      const groupsData = await groupsRes.json();
      const teamData = await teamRes.json();
      setAvailableGroups(groupsData.groups || []);
      setTeamMembers(teamData.members || []);

      if (preselectedGroupId) {
        setSelectedGroupIds([preselectedGroupId]);
        setShowModal(true);
      }
    } catch {
      console.error('Failed to load modal data');
    }
  }

  useEffect(() => {
    loadAssignments();
    loadModalData();
  }, [statusFilter, priorityFilter]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGroupIds.length === 0) {
      setModalError('Select at least one group to allocate.');
      return;
    }
    if (!selectedAnalystId) {
      setModalError('Select a primary analyst.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupIds: selectedGroupIds,
          primaryAnalystId: selectedAnalystId,
          reviewerId: selectedReviewerId || undefined,
          title: title || 'Comprehensive Threat Group Dossier',
          instructions,
          priority,
          dueDate: dueDate || undefined,
          individualDeadlines: useSeparateDeadlines ? individualDeadlines : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to create assignment(s)');
      } else {
        setShowModal(false);
        setSelectedGroupIds([]);
        setTitle('');
        setInstructions('');
        loadAssignments();
      }
    } catch {
      setModalError('Network error submitting assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Briefcase className="w-4 h-4" />
            Operational Research Dispatch
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Assignment Management</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Allocate individual or bulk ransomware research targets, assign independent reviewers, and enforce quality checklists.
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setModalError(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Allocate Research</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0a101f] border border-slate-800 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Assignment Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="SUBMITTED_FOR_REVIEW">Submitted for Review</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
            <option value="APPROVED_COMPLETED">Approved & Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Showing {assignments.length} assignments
        </span>
      </div>

      {/* Assignments Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Active Research Assignments ({assignments.length})</span>
          <span className="text-slate-500">Asia/Kolkata (IST) Standard Time</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading assignment pipeline...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <p>No research assignments match the current filter.</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-emerald-400 hover:underline font-semibold"
            >
              Allocate research on monitored groups
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Group & Assignment Title</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Primary Analyst</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4">Due Date (IST)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {assignments.map((a) => {
                  const completedChecklist = a.checklistItems.filter((i) => i.status === 'COMPLETED').length;
                  return (
                    <tr key={a.id} className="hover:bg-slate-900/40">
                      <td className="py-3.5 px-4">
                        <Link href={`/my-tasks/${a.id}`} className="hover:text-emerald-400">
                          <p className="font-bold text-white text-sm">{a.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Target: <span className="text-emerald-400 font-semibold">{a.group.name}</span> ({a.group.victimCount} victims)
                          </p>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.priority === 'CRITICAL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : a.priority === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-900 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {a.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            a.status === 'APPROVED_COMPLETED'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                              : a.status === 'SUBMITTED_FOR_REVIEW'
                              ? 'bg-amber-950 text-amber-300 border-amber-500/40 animate-pulse'
                              : a.status === 'CHANGES_REQUESTED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : 'bg-slate-900 text-slate-300 border border-slate-800'
                          }`}
                        >
                          {a.status}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                          Checklist: {completedChecklist}/15
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-white font-medium">
                        {a.primaryAnalyst?.fullName || 'Analyst'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {a.reviewer?.fullName || 'Reviewer'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {(() => {
                          const status = getWorkingDayDeadlineStatus(a.dueDate);
                          return (
                            <div className="space-y-0.5">
                              <span className="text-white font-mono text-xs block">{status.dueDateFormatted}</span>
                              {a.dueDate && (
                                <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  status.badgeVariant === 'rose'
                                    ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                                    : status.badgeVariant === 'amber'
                                    ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                                    : status.badgeVariant === 'emerald'
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                    : 'text-slate-500'
                                }`}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/my-tasks/${a.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Allocate Research Modal (Section 22: Bulk & Individual Allocation) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0a101f] border border-slate-800 rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Allocate Research Assignment</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAssignment} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Target Ransomware Groups * (Supports Bulk Allocation)
                </label>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg max-h-40 overflow-y-auto space-y-1.5">
                  {availableGroups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(g.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroupIds([...selectedGroupIds, g.id]);
                          } else {
                            setSelectedGroupIds(selectedGroupIds.filter((id) => id !== g.id));
                          }
                        }}
                        className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span className="font-medium text-white">{g.name}</span>
                      <span className="text-[10px] text-slate-500">({g.victimCount} victims, {g.discoveryStatus})</span>
                    </label>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 block mt-1">
                  Selected: <strong className="text-emerald-400">{selectedGroupIds.length}</strong> group(s). Bulk allocation will generate independent tasks linked via batch ID.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Primary Analyst *</label>
                  <select
                    required
                    value={selectedAnalystId}
                    onChange={(e) => setSelectedAnalystId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none"
                  >
                    <option value="">Select Analyst...</option>
                    {teamMembers.map((m) => (
                      <option key={m.profileId || m.id} value={m.profileId || m.id}>
                        {m.fullName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Reviewer</label>
                  <select
                    value={selectedReviewerId}
                    onChange={(e) => setSelectedReviewerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none"
                  >
                    <option value="">Default (Assigner)</option>
                    {teamMembers.filter((m) => m.role === 'ADMIN' || m.role === 'SUPER_ADMIN').map((m) => (
                      <option key={m.profileId || m.id} value={m.profileId || m.id}>
                        {m.fullName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Assignment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. In-Depth Technical & Victim Dossier"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none"
                  >
                    <option value="CRITICAL">Critical (Immediate Triage)</option>
                    <option value="HIGH">High (24-48 Hours)</option>
                    <option value="MEDIUM">Medium (Standard Sprint)</option>
                    <option value="LOW">Low (Background Monitoring)</option>
                  </select>
                </div>

                <div>
                  <WeekdayDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    label="Common Assignment Deadline"
                  />
                </div>
              </div>

              {/* Bulk Allocation: Optional Separate Deadlines */}
              {selectedGroupIds.length > 1 && (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">Individual Group Deadlines</span>
                      <span className="text-[10px] text-slate-400">Optionally configure separate working-day deadlines per syndicate</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseSeparateDeadlines((prev) => !prev)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        useSeparateDeadlines
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {useSeparateDeadlines ? 'Enabled' : 'Use Common Deadline'}
                    </button>
                  </div>

                  {useSeparateDeadlines && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      {selectedGroupIds.map((gId) => {
                        const grp = availableGroups.find((g) => g.id === gId);
                        return (
                          <div key={gId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded bg-slate-900 border border-slate-800/80">
                            <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                              {grp?.name || gId}
                            </span>
                            <div className="w-full sm:w-60">
                              <WeekdayDatePicker
                                value={individualDeadlines[gId] || dueDate}
                                onChange={(val) =>
                                  setIndividualDeadlines((prev) => ({ ...prev, [gId]: val }))
                                }
                                label=""
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Research Instructions & Scope</label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Specific requirements, targeted sectors, required IOC verification..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                The standard <strong className="text-white">15-Point Analyst Research Checklist</strong> will be provisioned automatically for each allocated task.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Allocating...' : 'Dispatch Assignment(s)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
