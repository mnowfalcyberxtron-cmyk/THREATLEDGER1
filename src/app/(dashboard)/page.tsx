import React from 'react';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatIST } from '@/lib/utils';
import {
  ShieldAlert,
  Sparkles,
  Users,
  Briefcase,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Database,
  Radio,
  FileCheck,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { AssignmentStatus, DiscoveryStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Retrieve genuine database intelligence metrics
  const [
    totalGroups,
    newlyDetectedCount,
    manualGroupsCount,
    totalVictims,
    assignmentsStats,
    teamCount,
    recentGroups,
    recentVictims,
  ] = await Promise.all([
    prisma.ransomwareGroup.count().catch(() => 0),
    prisma.ransomwareGroup.count({
      where: { discoveryStatus: DiscoveryStatus.NEWLY_LISTED },
    }).catch(() => 0),
    prisma.ransomwareGroup.count({
      where: { source: 'MANUAL' },
    }).catch(() => 0),
    prisma.victim.count().catch(() => 0),
    prisma.assignment.groupBy({
      by: ['status'],
      _count: true,
    }).catch(() => []),
    prisma.user.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.ransomwareGroup.findMany({
      take: 5,
      orderBy: { threatLedgerDetectedAt: 'desc' },
      select: {
        id: true,
        name: true,
        discoveryStatus: true,
        threatLedgerDetectedAt: true,
        victimCount: true,
      },
    }).catch(() => []),
    prisma.victim.findMany({
      take: 5,
      orderBy: { discoveredAt: 'desc' },
      include: { group: { select: { name: true } } },
    }).catch(() => []),
  ]);

  const assignmentsByStatus = (assignmentsStats as any[]).reduce((acc, curr) => {
    acc[curr.status] = curr._count;
    return acc;
  }, {} as Record<string, number>);

  const totalAssignments = (Object.values(assignmentsByStatus) as number[]).reduce((a, b) => a + b, 0);
  const submittedForReview = assignmentsByStatus[AssignmentStatus.SUBMITTED_FOR_REVIEW] || 0;
  const approvedCompleted = assignmentsByStatus[AssignmentStatus.APPROVED_COMPLETED] || 0;
  const inProgress = assignmentsByStatus[AssignmentStatus.IN_PROGRESS] || 0;

  return (
    <div className="space-y-8">
      {/* Top Welcome & Operational Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            CTI Operations Command Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Threat Intelligence Overview
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time ransomware landscape, victim telemetry, and analyst research pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/newly-detected"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Newly Detected Groups ({newlyDetectedCount})</span>
          </Link>
          <Link
            href="/my-tasks"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-700 transition-colors"
          >
            <Briefcase className="w-4 h-4 text-emerald-400" />
            <span>My Research Tasks</span>
          </Link>
        </div>
      </div>

      {/* Primary Intelligence Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monitored Groups</span>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalGroups}</span>
            <span className="text-xs text-slate-400 font-medium">active tracking</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span className="text-emerald-400 font-semibold">{manualGroupsCount}</span> manual additions
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Newly Listed Groups</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">{newlyDetectedCount}</span>
            <span className="text-xs text-slate-400 font-medium">discovered this period</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Ransomware.live API PRO discovery comparison</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Victim Telemetry</span>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalVictims}</span>
            <span className="text-xs text-slate-400 font-medium">indexed claims</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Sector & geographical distribution</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Research Pipeline</span>
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalAssignments}</span>
            <span className="text-xs text-slate-400 font-medium">assignments</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span><strong className="text-emerald-400">{approvedCompleted}</strong> approved</span>
            <span><strong className="text-amber-400">{submittedForReview}</strong> under review</span>
          </div>
        </div>
      </div>

      {/* Critical Separation Banner: Section 35 */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 shrink-0">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white">CTI Governance Standard:</span>{' '}
            <span className="text-slate-400">
              Analyst submission is strictly decoupled from reviewer approval. Reviewers physically receive report files via email MIME attachments and evaluate findings independently.
            </span>
          </div>
        </div>
        <Link
          href="/review-queue"
          className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 shrink-0"
        >
          <span>Open Review Queue</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Bottom Grids: Recent Discoveries & Recent Victims */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Ransomware Discoveries */}
        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Recently Detected Groups</h3>
              </div>
              <Link href="/groups" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors">
                View All
              </Link>
            </div>

            {recentGroups.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                <p>No ransomware groups indexed yet.</p>
                <p className="mt-1">Execute initial synchronization via Admin Settings or API integration.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {recentGroups.map((g: any) => (
                  <div key={g.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-white">{g.name}</span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {formatIST(g.threatLedgerDetectedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/20">
                        {g.discoveryStatus}
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">{g.victimCount} victims</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Victim Telemetry */}
        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Latest Victim Activity</h3>
              </div>
              <Link href="/victims" className="text-xs text-slate-400 hover:text-rose-400 transition-colors">
                View All
              </Link>
            </div>

            {recentVictims.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                <p>No victim incidents indexed yet.</p>
                <p className="mt-1">Telemetry will populate automatically on next synchronization run.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {recentVictims.map((v: any) => (
                  <div key={v.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="truncate max-w-[200px]">
                      <span className="font-semibold text-white">{v.victimName}</span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        Targeted by {v.group?.name || 'Unknown Group'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                        {v.country || 'Global'}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {formatIST(v.discoveredAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
