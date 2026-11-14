'use client';

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Shield,
  Sparkles,
  Users,
  Database,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

interface GroupItem {
  id: string;
  name: string;
  normalizedName: string;
  description?: string;
  source: string;
  status: string;
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

export default function MonitoringPage() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function loadGroups() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('discoveryStatus', statusFilter);

      const res = await fetch(`/api/groups?${params.toString()}`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      console.error('Failed to load ransomware groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadGroups();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/sync/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(`Sync completed: ${data.recordsCreated} added, ${data.newGroupsFound} newly discovered.`);
        loadGroups();
      } else {
        setSyncMessage(`Sync notice: ${data.error || 'Check API credentials'}`);
      }
    } catch {
      setSyncMessage('Network error during sync execution.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            Live Threat Landscape
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Ransomware Monitoring</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Active tracking of extortion syndicates, leak platforms, and operational status via Ransomware.live API PRO.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Synchronizing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {syncMessage && (
        <div className="p-3.5 rounded-lg bg-slate-900 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{syncMessage}</span>
          <button onClick={() => setSyncMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0a101f] border border-slate-800 rounded-xl">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search group name, alias, or keyword..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">All Discovery States</option>
            <option value="NEWLY_LISTED">Newly Listed</option>
            <option value="BASELINE">Baseline Records</option>
            <option value="MANUALLY_ADDED">Manually Added</option>
            <option value="REAPPEARED">Reappeared</option>
            <option value="RENAMED_UNDER_REVIEW">Renamed / Under Review</option>
          </select>
        </div>
      </div>

      {/* Groups Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Monitored Syndicates ({groups.length})</span>
          <span className="text-slate-500">Timestamps converted to Asia/Kolkata (IST)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading live telemetry...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-3">
            <p>No ransomware groups match the current query.</p>
            <button
              onClick={handleSyncNow}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run Initial Baseline Sync
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Group / Syndicates</th>
                  <th className="py-3 px-4">Discovery Status</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">First Observed (IST)</th>
                  <th className="py-3 px-4">Victim Count</th>
                  <th className="py-3 px-4">Analyst Allocation</th>
                  <th className="py-3 px-4 text-right">Intel Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {groups.map((g) => {
                  const assignment = g.assignments[0];
                  return (
                    <tr key={g.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link href={`/groups/${g.id}`} className="hover:text-emerald-400 transition-colors">
                          <p className="font-bold text-white text-sm">{g.name}</p>
                          {g.aliases.length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs">
                              aka: {g.aliases.map((a) => a.alias).join(', ')}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            g.discoveryStatus === 'NEWLY_LISTED'
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40 animate-pulse'
                              : g.discoveryStatus === 'BASELINE'
                              ? 'bg-slate-800 text-slate-300 border-slate-700'
                              : 'bg-purple-950 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          {g.discoveryStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        <span className="font-mono text-xs">{g.source}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-[11px] whitespace-nowrap">
                        {formatIST(g.threatLedgerDetectedAt)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {g.victimCount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {assignment ? (
                          <div className="flex flex-col">
                            <span className="text-white font-medium text-[11px]">
                              {assignment.primaryAnalyst?.fullName || 'Assigned'}
                            </span>
                            <span className="text-[10px] text-slate-500">{assignment.status}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/groups/${g.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors"
                        >
                          <span>View Profile</span>
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
    </div>
  );
}
