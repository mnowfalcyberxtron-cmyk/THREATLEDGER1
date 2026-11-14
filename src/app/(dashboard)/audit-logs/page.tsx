import React from 'react';
import { FileText } from 'lucide-react';
import prisma from '@/lib/prisma';
import { formatIST } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const logs = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
  }).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <FileText className="w-4 h-4" />
          Governance & Compliance
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Audit Logs</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Immutable, append-only security logs of logins, role adjustments, assignments, uploads, and reviewer decisions.
        </p>
      </div>

      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Recent Audit Events ({logs.length})</h2>
          <span className="text-[11px] text-slate-500">Append-Only Cryptographic Trail</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No audit records captured yet. Platform events will log automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Timestamp (IST)</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                      {formatIST(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 text-white font-sans font-medium">
                      {log.actorName || log.actorEmail || 'System'}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800 font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {log.targetType} {log.targetId ? `(${log.targetId.substring(0, 8)}...)` : ''}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
