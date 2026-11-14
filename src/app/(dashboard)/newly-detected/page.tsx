'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Filter,
  Users,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

interface NewlyDetectedGroup {
  id: string;
  name: string;
  source: string;
  discoveryStatus: string;
  discoveryMonth?: string;
  victimCount: number;
  threatLedgerDetectedAt: string;
  aliases: Array<{ alias: string }>;
  assignments: Array<{
    id: string;
    status: string;
    primaryAnalyst?: { fullName: string };
  }>;
}

export default function NewlyDetectedPage() {
  const [groups, setGroups] = useState<NewlyDetectedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('2026-11');

  async function loadNewlyDetected() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups?discoveryStatus=NEWLY_LISTED&month=${selectedMonth}`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      console.error('Failed to load newly detected groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNewlyDetected();
  }, [selectedMonth]);

  const assignedCount = groups.filter((g) => g.assignments.length > 0).length;
  const unassignedCount = groups.length - assignedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Sparkles className="w-4 h-4" />
            Emerging Threat Intelligence
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Newly Detected Ransomware Groups</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Groups observed for the first time by ThreatLedger during the selected monthly discovery period.
          </p>
        </div>

        {/* Month Selector with Asia/Kolkata alignment */}
        <div className="flex items-center gap-2 bg-[#0a101f] border border-slate-800 rounded-lg p-1">
          <Calendar className="w-4 h-4 text-emerald-400 ml-2" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-xs font-bold text-white pr-2 py-1.5 focus:outline-none"
          >
            <option value="2026-11" className="bg-slate-900 text-white">November 2026 (Current)</option>
            <option value="2026-10" className="bg-slate-900 text-white">October 2026</option>
            <option value="2026-09" className="bg-slate-900 text-white">September 2026</option>
            <option value="2026-08" className="bg-slate-900 text-white">August 2026</option>
          </select>
        </div>
      </div>

      {/* Monthly Discovery Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Newly Listed ({selectedMonth})
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-400">{groups.length}</span>
            <span className="text-xs text-slate-500">syndicates discovered</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Research Allocated
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-indigo-400">{assignedCount}</span>
            <span className="text-xs text-slate-500">assigned to analysts</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Pending Assignment
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-400">{unassignedCount}</span>
            <span className="text-xs text-slate-500">require analyst triage</span>
          </div>
        </div>
      </div>

      {/* Newly Detected Groups Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Discovery Registry for {selectedMonth}</span>
          <span className="text-slate-500">Timezone: Asia/Kolkata (IST)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading newly detected records...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <p>No new ransomware groups detected in this calendar month.</p>
            <p className="text-slate-600">Previous known groups remain in the baseline repository.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Group Name</th>
                  <th className="py-3 px-4">ThreatLedger Detection (IST)</th>
                  <th className="py-3 px-4">Victim Count</th>
                  <th className="py-3 px-4">Assigned Analyst</th>
                  <th className="py-3 px-4">Research Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {groups.map((g) => {
                  const assignment = g.assignments[0];
                  return (
                    <tr key={g.id} className="hover:bg-slate-900/40">
                      <td className="py-3.5 px-4">
                        <Link href={`/groups/${g.id}`} className="hover:text-emerald-400">
                          <p className="font-bold text-white text-sm">{g.name}</p>
                          {g.aliases.length > 0 && (
                            <p className="text-[10px] text-slate-400">
                              aka: {g.aliases.map((a) => a.alias).join(', ')}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        {formatIST(g.threatLedgerDetectedAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {g.victimCount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {assignment ? (
                          <span className="text-white font-medium">
                            {assignment.primaryAnalyst?.fullName || 'Assigned'}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {assignment ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                            {assignment.status}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-500/30">
                            Action Required
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!assignment && (
                            <Link
                              href={`/assignments?allocateGroupId=${g.id}`}
                              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
                            >
                              Assign
                            </Link>
                          )}
                          <Link
                            href={`/groups/${g.id}`}
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
