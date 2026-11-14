import React from 'react';
import { Users } from 'lucide-react';

export default function VictimsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">
          <Users className="w-4 h-4" />
          Extortion Telemetry
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Victim Monitoring</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Comprehensive victim listings, sector breakdowns, geographical distributions, and attack claim tracking.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Victim Telemetry Module Ready for Phase 2</p>
        <p className="mt-1 text-slate-500">
          Normalized victim records from Ransomware.live API PRO with domain, sector, and country analytics.
        </p>
      </div>
    </div>
  );
}
