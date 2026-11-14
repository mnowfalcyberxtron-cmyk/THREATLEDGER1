import React from 'react';
import { ClipboardCheck } from 'lucide-react';

export default function ReviewQueuePage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <ClipboardCheck className="w-4 h-4" />
          Quality Assurance & Governance
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Review Queue</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Independent reviewer evaluation: approve reports, request revisions, or record formal review comments.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Review Queue Ready for Phase 4</p>
        <p className="mt-1 text-slate-500">
          Strict separation of submission and approval records. Evaluates submitted reports and manages version history.
        </p>
      </div>
    </div>
  );
}
