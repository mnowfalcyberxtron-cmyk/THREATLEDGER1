import React from 'react';
import { CheckSquare } from 'lucide-react';

export default function MyTasksPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <CheckSquare className="w-4 h-4" />
          Analyst Workspace
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">My Tasks</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Your active ransomware research assignments, standardized 15-point checklists, shared notes, and report submission.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Analyst Research Workspace Ready for Phase 3</p>
        <p className="mt-1 text-slate-500">
          Accept assignments, update checklists, write two-way notes, upload supporting evidence, and submit final research reports.
        </p>
      </div>
    </div>
  );
}
