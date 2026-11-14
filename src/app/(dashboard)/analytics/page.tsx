import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <BarChart3 className="w-4 h-4" />
          Intelligence Aggregation & Reporting
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Reports & Analytics</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Monthly CTI analytics, discovery trends, analyst workload statistics, and PDF/Excel/CSV exports.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Monthly Analytics Ready for Phase 6</p>
        <p className="mt-1 text-slate-500">
          Executive reporting summaries with Asia/Kolkata date boundaries, country/sector charts, and formatted document exports.
        </p>
      </div>
    </div>
  );
}
