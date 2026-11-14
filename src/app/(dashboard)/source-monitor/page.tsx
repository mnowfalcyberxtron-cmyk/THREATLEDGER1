'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Code2,
} from 'lucide-react';
import { formatIST } from '@/lib/utils';

interface CommitItem {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  committedAt: string;
  commitUrl: string;
  filesChangedCount: number;
}

export default function SourceMonitorPage() {
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [repository, setRepository] = useState('JMousqueton/ransomware.live');
  const [loading, setLoading] = useState(true);

  async function loadSourceTelemetry() {
    setLoading(true);
    try {
      const res = await fetch('/api/source-monitor');
      const data = await res.json();
      setCommits(data.commits || []);
      if (data.repository) setRepository(data.repository);
    } catch {
      console.error('Failed to load GitHub source telemetry');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSourceTelemetry();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <GitBranch className="w-4 h-4" />
            Upstream Technical Telemetry
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Official GitHub Source Monitor</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Read-only change tracking of parsers, signatures, and schemas on official repository{' '}
            <code className="text-emerald-400 font-mono">{repository}</code>.
          </p>
        </div>

        <button
          onClick={loadSourceTelemetry}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Commits</span>
        </button>
      </div>

      {/* Safety Notice: Section 18 */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1.5">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <ShieldAlert className="w-4 h-4" />
          <span>Section 18 Operational Boundary:</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          Upstream repository changes represent technical collector updates and parser evolutions, not legal proof that an adversary syndicate was newly formed. ThreatLedger never executes upstream parser code or scrapes Tor onion infrastructure directly; Ransomware.live API PRO remains the primary intelligence authority.
        </p>
      </div>

      {/* Commits Feed */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Recent Parser & Collector Commits</span>
          <a
            href={`https://github.com/${repository}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-emerald-400 hover:underline inline-flex items-center gap-1 font-mono text-[11px]"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Inspecting GitHub commits and parser diffs...</span>
          </div>
        ) : commits.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No recent commit events indexed.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {commits.map((c) => (
              <div key={c.hash} className="p-4 hover:bg-slate-900/40 transition-colors flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 mt-0.5">
                    <GitCommit className="w-4 h-4" />
                  </div>
                  <div>
                    <a
                      href={c.commitUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>{c.message}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </a>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                      <span>Authored by: <strong className="text-slate-300 font-sans">{c.author}</strong></span>
                      <span>•</span>
                      <span className="text-slate-500">{formatIST(c.committedAt)}</span>
                    </div>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                  {c.shortHash}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
