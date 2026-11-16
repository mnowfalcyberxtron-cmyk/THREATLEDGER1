'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radar,
  Sparkles,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitBranch,
  Database,
  History,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

interface SummaryMetrics {
  firstPublicClaimThisMonth: number;
  firstObservedByThreatLedgerThisMonth: number;
  pendingVerification: number;
  existingGroupsUpdated: number;
  historicalGroupsImported: number;
  sourcesWithSuccessfulSync: number;
  reportingMonth: string;
}

interface SourceStatus {
  sourceId: string;
  name: string;
  sourceType: string;
  sourceLineage: string;
  status: 'ONLINE' | 'STANDBY' | 'ERROR' | 'ARCHIVED';
  lastChecked: string | null;
  lastSuccessfulSync: string | null;
  recordsRetrieved: number;
  isHistorical: boolean;
  freshness: string;
  notes: string;
}

interface ThreatActorRecord {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  source: string;
  discoveryStatus: string;
  verificationStatus: string;
  verificationNotes: string | null;
  firstObservedAt: string | null;
  firstClaimAt: string | null;
  firstClaimSource: string | null;
  lastSeenAt: string | null;
  importedAt: string | null;
  sourceObservations?: Array<{
    sourceId: string;
    sourceLineage: string;
    firstClaimAt: string | null;
    lastClaimAt: string | null;
  }>;
  verifiedBy?: {
    fullName: string;
    user?: { email: string };
  };
}

export default function ThreatActorDiscoveryPage() {
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [sourcesPanel, setSourcesPanel] = useState<SourceStatus[]>([]);
  const [records, setRecords] = useState<ThreatActorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [dateType, setDateType] = useState('ALL');
  const [verificationFilter, setVerificationFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Verification modal state
  const [verifyModalGroup, setVerifyModalGroup] = useState<ThreatActorRecord | null>(null);
  const [verifyAction, setVerifyAction] = useState<'VERIFY' | 'REJECT' | 'LINK_ALIAS' | 'REBRAND_REVIEW'>('VERIFY');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        month: selectedMonth,
        dateType,
        verificationStatus: verificationFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/intelligence/discovery?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load discovery data: HTTP ${res.status}`);
      }
      const data = await res.json();
      setMetrics(data.metrics);
      setSourcesPanel(data.sourcesPanel || []);
      setRecords(data.discoveryData?.records || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load threat actor discovery data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, dateType, verificationFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerifySubmit = async () => {
    if (!verifyModalGroup) return;
    try {
      setVerifySubmitting(true);
      const res = await fetch('/api/intelligence/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: verifyModalGroup.id,
          action: verifyAction,
          notes: verifyNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit verification');
      }
      setVerifyModalGroup(null);
      setVerifyNotes('');
      fetchData();
    } catch (err: any) {
      alert(`Verification error: ${err.message}`);
    } finally {
      setVerifySubmitting(false);
    }
  };

  const formatIST = (isoString: string | null | undefined) => {
    if (!isoString) return 'Unknown';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Unknown';
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d) + ' IST';
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Radar className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Threat Actor Discovery
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              Asia/Kolkata (IST)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Multi-source threat actor identification, earliest public claim tracking, and monthly new-actor reporting with auditable source lineage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#0c1324] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>Reporting Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="2026-11" className="bg-[#0c1324]">November 2026</option>
              <option value="2026-10" className="bg-[#0c1324]">October 2026</option>
              <option value="2026-09" className="bg-[#0c1324]">September 2026</option>
              <option value="2026-08" className="bg-[#0c1324]">August 2026</option>
            </select>
          </div>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Semantics Callout */}
      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300/90 flex items-start gap-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        <div>
          <span className="font-semibold text-emerald-300">Auditable Date Architecture: </span>
          ThreatLedger strictly separates <strong className="text-white">First Public Claim</strong> (earliest documented victim claim by the threat actor) from <strong className="text-white">First Observed by ThreatLedger</strong> (when the platform first ingested the record). Historical archive imports from RansomWatch and mirrored feeds (isMalicious) never inflate live current-month discovery counts.
        </div>
      </div>

      {/* 6 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: First Public Claim This Month */}
        <div className="p-4 rounded-xl bg-[#0c1324] border border-emerald-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>First Public Claim</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-400">
              {metrics?.firstPublicClaimThisMonth ?? '—'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">In {metrics?.reportingMonth} (IST)</div>
          </div>
        </div>

        {/* Card 2: First Observed by ThreatLedger */}
        <div className="p-4 rounded-xl bg-[#0c1324] border border-cyan-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>First Observed</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-cyan-400">
              {metrics?.firstObservedByThreatLedgerThisMonth ?? '—'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">Platform detections</div>
          </div>
        </div>

        {/* Card 3: Pending Verification */}
        <div className="p-4 rounded-xl bg-[#0c1324] border border-amber-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Pending Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-400">
              {metrics?.pendingVerification ?? '—'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">Awaiting analyst</div>
          </div>
        </div>

        {/* Card 4: Existing Groups Updated */}
        <div className="p-4 rounded-xl bg-[#0c1324] border border-indigo-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Groups Updated</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-indigo-400">
              {metrics?.existingGroupsUpdated ?? '—'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">Active this month</div>
          </div>
        </div>

        {/* Card 5: Historical Groups Imported */}
        <div className="p-4 rounded-xl bg-[#0c1324] border border-slate-700 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Historical Archive</span>
            <History className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-slate-300">
              {metrics?.historicalGroupsImported ?? '—'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">RansomWatch (2021–26)</div>
          </div>
        </div>

        {/* Card 6: Sources with Successful Sync */}
        <div className="p-4 rounded-xl bg-[#0c1324] border border-teal-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Sources</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-teal-400">
              {metrics?.sourcesWithSuccessfulSync ?? '—'}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">Operational feeds</div>
          </div>
        </div>
      </div>

      {/* Intelligence Source Status Panel */}
      <div className="p-4 rounded-xl bg-[#0c1324] border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Multi-Source Intelligence Status & Lineage
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Auto-correlated across 4 primary & secondary feeds
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {sourcesPanel.map((src) => (
            <div
              key={src.sourceId}
              className="p-3 rounded-lg bg-[#090f1d] border border-slate-800/80 flex flex-col justify-between space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-white">{src.name}</div>
                  <span
                    className={`inline-block text-[9px] px-1.5 py-0.5 rounded mt-1 font-semibold ${
                      src.sourceLineage === 'INDEPENDENT'
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40'
                        : src.sourceLineage === 'DERIVED_OR_MIRRORED'
                        ? 'bg-amber-950/50 text-amber-400 border border-amber-800/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {src.sourceLineage === 'DERIVED_OR_MIRRORED' ? 'DERIVED / MIRRORED' : src.sourceLineage}
                  </span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    src.status === 'ONLINE'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : src.status === 'ARCHIVED'
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {src.status}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Freshness:</span>
                  <span className="text-slate-300 font-mono text-[10px]">{src.freshness}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Observations:</span>
                  <span className="text-slate-200 font-mono">{src.recordsRetrieved}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800/60">
                {src.notes}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Discovery Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-lg bg-[#0c1324] border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search threat actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#090f1d] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-52"
            />
          </div>

          {/* Date Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">View:</span>
            <select
              value={dateType}
              onChange={(e) => setDateType(e.target.value)}
              className="bg-[#090f1d] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Records</option>
              <option value="FIRST_CLAIM_THIS_MONTH">First Public Claim This Month</option>
              <option value="FIRST_OBSERVED_THIS_MONTH">First Observed by Platform This Month</option>
              <option value="HISTORICAL_ONLY">Historical Archive Only</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Status:</span>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="bg-[#090f1d] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="VERIFIED">Verified Distinct Actor</option>
              <option value="REJECTED">Rejected False Discovery</option>
              <option value="ALIAS_LINKED">Alias Linked</option>
              <option value="REBRAND_REVIEW">Rebrand Review</option>
            </select>
          </div>
        </div>

        <div className="text-slate-400 text-[11px]">
          Showing <span className="font-semibold text-emerald-400">{records.length}</span> threat actors
        </div>
      </div>

      {/* Main Discovery Table */}
      <div className="rounded-xl bg-[#0c1324] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#090f1d] text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Threat Actor</th>
                <th className="py-3 px-4">First Public Claim (Source)</th>
                <th className="py-3 px-4">First Observed (ThreatLedger)</th>
                <th className="py-3 px-4">Primary Source & Lineage</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading multi-source threat actor discoveries...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No threat actors matching the selected filters.
                  </td>
                </tr>
              ) : (
                records.map((group) => {
                  const isHistorical = group.discoveryStatus === 'HISTORICAL_IMPORT' || group.source === 'RANSOMWATCH';
                  return (
                    <tr key={group.id} className="hover:bg-slate-800/20 transition-colors">
                      {/* Threat Actor Name & Aliases */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/groups/${group.id}`}
                            className="font-bold text-white hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                          >
                            {group.name}
                            <ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100" />
                          </Link>
                          {isHistorical && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              ARCHIVE
                            </span>
                          )}
                        </div>
                        {group.aliases && group.aliases.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            aka: {group.aliases.slice(0, 3).join(', ')}
                          </div>
                        )}
                      </td>

                      {/* First Public Claim */}
                      <td className="py-3 px-4">
                        {group.firstClaimAt ? (
                          <div>
                            <div className="font-mono text-emerald-400 text-[11px]">
                              {formatIST(group.firstClaimAt)}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              via {group.firstClaimSource || 'Feed'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">Unknown</span>
                        )}
                      </td>

                      {/* First Observed by ThreatLedger */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 text-[11px]">
                          {formatIST(group.firstObservedAt)}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {isHistorical ? 'Import Date' : 'Detection Date'}
                        </span>
                      </td>

                      {/* Primary Source & Lineage */}
                      <td className="py-3 px-4">
                        <div className="text-slate-300 font-medium">
                          {group.source}
                        </div>
                        <span className="text-[9px] text-slate-500">
                          {group.source === 'ISMALICIOUS'
                            ? 'Derived (Ransomware.live)'
                            : group.source === 'RANSOMWATCH'
                            ? 'Historical Archive'
                            : 'Primary Feed'}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {formatIST(group.lastSeenAt)}
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            group.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : group.verificationStatus === 'REJECTED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : group.verificationStatus === 'ALIAS_LINKED'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : group.verificationStatus === 'REBRAND_REVIEW'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {group.verificationStatus === 'VERIFIED' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {group.verificationStatus === 'REJECTED' && <XCircle className="w-2.5 h-2.5" />}
                          {group.verificationStatus === 'PENDING' && <AlertTriangle className="w-2.5 h-2.5" />}
                          {group.verificationStatus}
                        </span>
                        {group.verifiedBy && (
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            by {group.verifiedBy.fullName}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setVerifyModalGroup(group);
                            setVerifyAction('VERIFY');
                            setVerifyNotes('');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
                        >
                          Verify / Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analyst Verification Modal */}
      {verifyModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0c1324] border border-slate-700 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  Analyst Validation: {verifyModalGroup.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm intelligence verification status and record evidence.
                </p>
              </div>
              <button
                onClick={() => setVerifyModalGroup(null)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Decision / Action:</label>
                <select
                  value={verifyAction}
                  onChange={(e) => setVerifyAction(e.target.value as any)}
                  className="w-full bg-[#090f1d] border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="VERIFY">Verify as Distinct Threat Actor</option>
                  <option value="REJECT">Reject as False Discovery</option>
                  <option value="LINK_ALIAS">Link as Alias to Existing Group</option>
                  <option value="REBRAND_REVIEW">Flag for Rebrand / Affiliation Review</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Analyst Justification / Evidence:</label>
                <textarea
                  rows={3}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Enter notes on leak site infrastructure, sample hashes, press corroboration..."
                  className="w-full bg-[#090f1d] border border-slate-800 rounded-lg p-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setVerifyModalGroup(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifySubmit}
                disabled={verifySubmitting}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {verifySubmitting && <RefreshCw className="w-3 h-3 animate-spin" />}
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
