import React from 'react';
import { Sparkles } from 'lucide-react';

export default function NewlyDetectedPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Sparkles className="w-4 h-4" />
          Discovery Tracking
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Newly Detected Ransomware Groups</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Monthly discovery analysis and comparison against the established ThreatLedger baseline.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Monthly Discovery Engine Ready for Phase 2</p>
        <p className="mt-1 text-slate-500">
          Newly listed groups will be highlighted chronologically with assigned research states and Asia/Kolkata date boundaries.
        </p>
      </div>
    </div>
  );
}
