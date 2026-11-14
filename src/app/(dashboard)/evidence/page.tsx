import React from 'react';
import { FolderArchive } from 'lucide-react';

export default function EvidencePage() {
  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <FolderArchive className="w-4 h-4" />
          Private Research Repository
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Supporting Evidence Archive</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Dedicated private storage for datasets, victim sheets, screenshots, IOCs, and raw research artifacts.
        </p>
      </div>

      <div className="p-8 rounded-xl bg-[#0a101f] border border-slate-800 text-center text-xs text-slate-400">
        <p className="font-semibold text-white text-sm">Supporting Evidence Storage Ready for Phase 4</p>
        <p className="mt-1 text-slate-500">
          Strictly decoupled from email submission attachments. Stored securely in private Cloudflare R2 object storage.
        </p>
      </div>
    </div>
  );
}
