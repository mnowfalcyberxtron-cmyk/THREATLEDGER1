'use client';

import React, { useState, useEffect } from 'react';
import {
  Users2,
  UserPlus,
  Shield,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { formatIST } from '@/lib/utils';

interface TeamMember {
  id: string;
  profileId?: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  joinedAt: string;
  lastLoginAt?: string | null;
  metrics: {
    totalAssignments: number;
    pending: number;
    inProgress: number;
    submitted: number;
    approved: number;
    overdue: number;
  };
}

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'ANALYST'>('ANALYST');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadTeam() {
    setLoading(true);
    try {
      const res = await fetch('/api/team/members');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load team directory');
      } else {
        setMembers(data.members || []);
      }
    } catch {
      setError('Connection failure while loading team directory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, []);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    setError(null);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate invitation.');
      } else {
        setInviteResult(data.invitation.inviteLink);
        setInviteEmail('');
        loadTeam();
      }
    } catch {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateMember = async (userId: string, newRole?: string, newStatus?: string) => {
    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update member.');
      } else {
        loadTeam();
      }
    } catch {
      alert('Network error while updating member.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Users2 className="w-4 h-4" />
            Operations Personnel
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Team Management</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Manage analysts, configure administrative roles, monitor workload allocation, and issue secure invitations.
          </p>
        </div>

        <button
          onClick={() => {
            setShowInviteModal(true);
            setInviteResult(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Team Member</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Team Member Cards Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Active Personnel ({members.length})</h2>
          <span className="text-[11px] text-slate-500">Default Timezone: Asia/Kolkata (IST)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading intelligence personnel...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No team members found. Invite personnel to begin research assignments.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Member Name & Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Workload Metrics</th>
                  <th className="py-3 px-4">Joined & Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-emerald-400 shrink-0">
                          {m.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{m.fullName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          m.role === 'SUPER_ADMIN'
                            ? 'bg-purple-950/60 text-purple-300 border-purple-500/30'
                            : m.role === 'ADMIN'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span title="Total Assignments" className="text-white font-semibold">
                          {m.metrics.totalAssignments} total
                        </span>
                        <span className="text-slate-600">|</span>
                        <span title="In Progress" className="text-indigo-400">
                          {m.metrics.inProgress} active
                        </span>
                        <span className="text-slate-600">|</span>
                        <span title="Submitted for Review" className="text-amber-400">
                          {m.metrics.submitted} review
                        </span>
                        <span className="text-slate-600">|</span>
                        <span title="Approved" className="text-emerald-400 font-bold">
                          {m.metrics.approved} approved
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      <div>Joined: {formatIST(m.joinedAt)}</div>
                      <div className="text-[10px] text-slate-500">
                        Last Login: {m.lastLoginAt ? formatIST(m.lastLoginAt) : 'Never'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {m.role === 'ANALYST' && (
                          <button
                            onClick={() => handleUpdateMember(m.id, 'ADMIN')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                          >
                            Promote to Admin
                          </button>
                        )}
                        {m.role === 'ADMIN' && (
                          <button
                            onClick={() => handleUpdateMember(m.id, 'ANALYST')}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                          >
                            Demote to Analyst
                          </button>
                        )}
                        {m.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleUpdateMember(m.id, undefined, 'INACTIVE')}
                            className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[11px] font-medium transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateMember(m.id, undefined, 'ACTIVE')}
                            className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a101f] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {inviteResult ? (
              <div className="mt-4 space-y-4">
                <div className="p-3.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invitation Link Generated</span>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Share this unique single-use link with the analyst to complete registration:
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 rounded border border-slate-800">
                    <input
                      type="text"
                      readOnly
                      value={inviteResult}
                      className="w-full bg-transparent text-[11px] font-mono text-emerald-400 focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(inviteResult)}
                      className="px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteResult(null);
                  }}
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="analyst@threatledger.local"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assign Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="ANALYST">Analyst (Research, Reports, Evidence)</option>
                    <option value="ADMIN">Admin (Team, Assignments, Reviews, Settings)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {inviting ? 'Generating...' : 'Issue Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
