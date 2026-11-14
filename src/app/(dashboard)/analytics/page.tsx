'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Users,
  Building,
  Globe2,
  HardDrive,
  Download,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

const CHART_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      const json = await res.json();
      setData(json);
    } catch {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const triggerExport = (type: 'groups' | 'victims', format: 'csv' | 'json') => {
    window.open(`/api/analytics/export?type=${type}&format=${format}`, '_blank');
  };

  if (loading || !data) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <span className="animate-pulse">Synthesizing threat intelligence metrics and charts...</span>
      </div>
    );
  }

  const { summary, monthlyTrends, topSectors, topCountries, analystWorkload } = data;
  const storagePercent = Math.min(
    100,
    ((summary.storageBytesUsed || 1024 * 1024 * 120) / summary.storageQuotaBytes) * 100
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <BarChart3 className="w-4 h-4" />
            Executive & Operational Threat Intelligence
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">CTI Analytics & Telemetry</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Aggregated metrics across threat groups, victim distributions, analyst research velocity, and storage quotas.
          </p>
        </div>

        {/* Export Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => triggerExport('groups', 'csv')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Groups CSV</span>
            </button>
            <button
              onClick={() => triggerExport('groups', 'json')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              <span>JSON</span>
            </button>
          </div>

          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => triggerExport('victims', 'csv')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Victims CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Total Groups</span>
          <p className="text-2xl font-black text-white">{summary.totalGroups}</p>
          <span className="text-[10px] text-emerald-400 font-semibold">{summary.activeGroups} currently active</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Newly Detected</span>
          <p className="text-2xl font-black text-emerald-400">{summary.newlyDetected}</p>
          <span className="text-[10px] text-slate-400">Current calendar month</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Known Victims</span>
          <p className="text-2xl font-black text-indigo-400">{summary.totalVictims}</p>
          <span className="text-[10px] text-slate-400">Verified breaches</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Research Tasks</span>
          <p className="text-2xl font-black text-white">{summary.totalTasks}</p>
          <span className="text-[10px] text-emerald-400">{summary.completedTasks} signed off</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Review Queue</span>
          <p className="text-2xl font-black text-amber-400">{summary.pendingReviewTasks}</p>
          <span className="text-[10px] text-slate-400">Awaiting QA verdict</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">R2 Storage Quota</span>
          <p className="text-2xl font-black text-white">{storagePercent.toFixed(1)}%</p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                storagePercent > 85 ? 'bg-rose-500' : storagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.max(2, storagePercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Row 1 Charts: Monthly Discovery Trend & Sector Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Discoveries Area/Bar Chart */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Monthly Syndicate Discoveries & Victim Spikes
              </h2>
              <span className="text-[11px] text-slate-500">6-month trend calibrated to Asia/Kolkata (IST)</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="groups"
                  name="New Syndicates"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#emeraldGrad)"
                />
                <Bar dataKey="victims" name="Victim Claims" fill="#3b82f6" opacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Target Sectors Distribution */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-400" />
                Target Industry / Sector Impact
              </h2>
              <span className="text-[11px] text-slate-500">Top targeted commercial & critical sectors</span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {topSectors.map((sector: any, idx: number) => {
              const maxVal = topSectors[0]?.count || 1;
              const pct = ((sector.count / maxVal) * 100).toFixed(0);
              return (
                <div key={sector.name} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-medium truncate max-w-[220px]">{sector.name}</span>
                    <span className="font-mono text-emerald-400 font-bold">{sector.count}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2: Top Countries & Analyst Workload Throughput */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Country Spread */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-emerald-400" />
                Geographic Incident Spread
              </h2>
              <span className="text-[11px] text-slate-500">Highest victim concentrations by nation</span>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCountries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="code" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="count" name="Victims" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analyst Workload & Velocity */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-[#0a101f] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Analyst Workload & Quality Pass Rate
              </h2>
              <span className="text-[11px] text-slate-500">Research pipeline throughput by analyst</span>
            </div>
          </div>

          {analystWorkload.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">
              No task allocations completed yet to compute velocity.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {analystWorkload.map((a: any) => (
                <div key={a.name} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{a.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">Total: {a.total}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{a.completed} Approved</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{a.inReview} in Review</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-indigo-400">
                      <span>{a.inProgress} Active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
