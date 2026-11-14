import React from 'react';
import { Radio } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Radio className="w-4 h-4 animate-pulse" />
          Ransomware Intelligence
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Ransomware Monitoring</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Continuous tracking of threat actor groups, operational leak sites, and extortion activity.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Monitoring Feed Ready for Phase 2</p>
        <p className="mt-1 text-slate-500">
          Ransomware.live API PRO baseline synchronization will populate active ransomware groups and real-time status.
        </p>
      </div>
    </div>
  );
}
