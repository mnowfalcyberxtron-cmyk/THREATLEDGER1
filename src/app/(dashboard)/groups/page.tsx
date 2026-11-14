import React from 'react';
import { Database } from 'lucide-react';

export default function GroupsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Database className="w-4 h-4" />
          Threat Actor Profiles
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Group Intelligence</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          In-depth intelligence profiles, MITRE ATT&CK techniques, CVEs, tools, and manual group management.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Group Intelligence Ready for Phase 2</p>
        <p className="mt-1 text-slate-500">
          Individual group profiles with tabbed views (Overview, Victims, TTPs, CVEs, Tools, Research, Reports, Evidence).
        </p>
      </div>
    </div>
  );
}
