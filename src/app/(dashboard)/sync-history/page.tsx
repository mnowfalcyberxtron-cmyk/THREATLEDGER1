'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatIST } from '@/lib/utils';

interface SyncRunItem {
  id: string;
  syncSource: string;
  status: string;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  newGroupsFound: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export default function SyncHistoryPage() {
  const [history, setHistory] = useState<SyncRunItem[]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSyncStatus() {
    setLoading(true);
    try {
      const res = await fetch('/api/sync/status');
      const data = await res.json();
      setHistory(data.history || []);
      setTotalGroups(data.totalGroups || 0);
      setHasBaseline(data.hasBaseline || false);
    } catch {
      console.error('Failed to load sync status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sync/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Synchronization completed successfully: ${data.recordsCreated} records created, ${data.newGroupsFound} new groups identified.`);
        loadSyncStatus();
      } else {
        setMessage(`Sync error: ${data.error || 'Failed to complete synchronization'}`);
      }
    } catch {
      setMessage('Network error during synchronization.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <History className="w-4 h-4" />
            Data Orchestration Engine
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Synchronization History</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Audit log of threat intelligence inventory runs, baseline status, and new group discovery events.
          </p>
        </div>

        <button
          onClick={handleSyncNow}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Executing Sync...' : 'Sync Now'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-lg bg-slate-900 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Baseline Status Card (Section 12) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 mt-0.5">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Baseline Repository State</span>
            <span className="text-lg font-bold text-white mt-0.5 block">
              {hasBaseline ? 'Baseline Established' : 'Baseline Pending'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              {hasBaseline
                ? 'Initial inventory indexed. Subsequent synchronization runs detect genuinely new groups.'
                : 'First synchronization will establish the initial baseline without marking every group as new.'}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Monitored Group Corpus</span>
            <span className="text-lg font-bold text-white mt-0.5 block font-mono">
              {totalGroups} Active Groups
            </span>
            <p className="text-xs text-slate-400 mt-1">
              Active ransomware profiles currently tracked across API PRO and manual registrations.
            </p>
          </div>
        </div>
      </div>

      {/* Sync Runs Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Execution Logs ({history.length})</span>
          <span className="text-slate-500">Asia/Kolkata (IST) Standard Time</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading execution history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <p>No synchronization runs recorded yet.</p>
            <p className="text-slate-600">Click &ldquo;Sync Now&rdquo; above to trigger initial baseline indexing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Job Run</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Records Fetched</th>
                  <th className="py-3 px-4">Created / Updated</th>
                  <th className="py-3 px-4">New Groups Found</th>
                  <th className="py-3 px-4">Started (IST)</th>
                  <th className="py-3 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {history.map((r) => {
                  const duration =
                    r.completedAt && r.startedAt
                      ? `${((new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime()) / 1000).toFixed(1)}s`
                      : '—';

                  return (
                    <tr key={r.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 font-sans font-medium text-white">{r.syncSource}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'SUCCESS'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                              : r.status === 'RUNNING'
                              ? 'bg-amber-950 text-amber-400 border border-amber-500/30 animate-pulse'
                              : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{r.recordsFetched}</td>
                      <td className="py-3 px-4 text-slate-300">
                        +{r.recordsCreated} / ~{r.recordsUpdated}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {r.newGroupsFound > 0 ? `+${r.newGroupsFound}` : '0'}
                      </td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {formatIST(r.startedAt)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{duration}</td>
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
