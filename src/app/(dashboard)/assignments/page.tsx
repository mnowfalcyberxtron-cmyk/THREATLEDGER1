import React from 'react';
import { Briefcase } from 'lucide-react';

export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Briefcase className="w-4 h-4" />
          Research Allocation
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Assignment Management</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Allocate ransomware groups to analysts individually or in bulk, assign reviewers, and configure deadlines.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Assignment Allocation Ready for Phase 3</p>
        <p className="mt-1 text-slate-500">
          Bulk selection, batch allocation, independent assignment tracking, and reviewer assignment.
        </p>
      </div>
    </div>
  );
}
