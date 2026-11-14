import React from 'react';
import { GitBranch } from 'lucide-react';

export default function SourceMonitorPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <GitBranch className="w-4 h-4" />
          Technical Source Telemetry
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Source Monitor (GitHub)</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Read-only commit, parser change, and release monitoring for official repository JMousqueton/ransomware.live.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">GitHub Source Telemetry Ready for Phase 2</p>
        <p className="mt-1 text-slate-500">
          Tracks parser updates, new group signature definitions, and upstream schema changes without executing untrusted code.
        </p>
      </div>
    </div>
  );
}
