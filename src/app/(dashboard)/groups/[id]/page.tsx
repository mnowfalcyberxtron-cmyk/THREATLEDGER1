'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Database,
  Shield,
  Radio,
  ExternalLink,
  Users,
  Briefcase,
  Layers,
  Bug,
  Wrench,
  FileText,
  Clock,
  GitMerge,
  GitBranch,
  ArrowLeft,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

export default function GroupProfilePage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params?.id as string;

  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [secondaryGroupId, setSecondaryGroupId] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeNotice, setMergeNotice] = useState<string | null>(null);

  async function loadProfile() {
    if (!groupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Group not found');
      } else {
        setGroup(data.group);
      }
    } catch {
      setError('Connection failed while loading profile');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [groupId]);

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    setMerging(true);
    setMergeNotice(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secondaryGroupId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMergeNotice(data.error || 'Merge failed');
      } else {
        alert(data.message);
        setShowMergeModal(false);
        loadProfile();
      }
    } catch {
      setMergeNotice('Network error executing merge');
    } finally {
      setMerging(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <span className="animate-pulse">Loading intelligence dossier...</span>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-white font-bold">{error || 'Intelligence dossier not found'}</p>
        <Link href="/groups" className="text-emerald-400 hover:underline">
          Return to Group Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button and Meta */}
      <div className="flex items-center justify-between">
        <Link
          href="/groups"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Group Directory</span>
        </Link>

        <button
          onClick={() => setShowMergeModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium"
        >
          <GitMerge className="w-3.5 h-3.5 text-purple-400" />
          <span>Merge with Another Group</span>
        </button>
      </div>

      {/* Main Profile Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0a101f] border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                {group.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
                Provenance: {group.source}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                {group.discoveryStatus}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight">{group.name}</h1>

            {group.aliases && group.aliases.length > 0 && (
              <p className="text-xs text-slate-400">
                <strong className="text-slate-300">Known Aliases:</strong>{' '}
                {group.aliases.map((a: any) => a.alias).join(', ')}
              </p>
            )}

            {group.description && (
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed mt-2">
                {group.description}
              </p>
            )}
          </div>

          <div className="flex sm:flex-row lg:flex-col items-start lg:items-end gap-3 text-xs shrink-0">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left lg:text-right min-w-[140px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Claimed Victims</span>
              <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                {group.victimCount.toLocaleString()}
              </span>
            </div>

            {group.websiteUrl && (
              <a
                href={group.websiteUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-emerald-400"
              >
                <span>Onion Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto pb-1 text-xs font-semibold">
        {[
          { id: 'overview', label: 'Overview', icon: Database },
          { id: 'source-intelligence', label: `Source Intelligence (${group.sourceObservations?.length || 0})`, icon: GitBranch },
          { id: 'victims', label: `Victims (${group.victims?.length || 0})`, icon: Users },
          { id: 'ttps', label: `MITRE ATT&CK (${group.ttps?.length || 0})`, icon: Layers },
          { id: 'cves', label: `Vulnerabilities (${group.cves?.length || 0})`, icon: Bug },
          { id: 'tools', label: `Tools & Malware (${group.tools?.length || 0})`, icon: Wrench },
          { id: 'research', label: `Research & Tasks (${group.assignments?.length || 0})`, icon: Briefcase },
          { id: 'history', label: 'Activity & Discovery', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Observation & Discovery Timestamps
            </h3>
            <div className="divide-y divide-slate-800/80">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">First Observed by ThreatLedger</span>
                <span className="text-white font-mono">{formatIST(group.threatLedgerDetectedAt)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Source Addition Date</span>
                <span className="text-white font-mono">{group.sourceAddedAt ? formatIST(group.sourceAddedAt) : '—'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-400">Latest Synchronization</span>
                <span className="text-white font-mono">{formatIST(group.updatedAt)}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              CTI Provenance & Attribution
            </h3>
            <p className="text-slate-300 leading-relaxed">
              Record registered from source <strong className="text-white">{group.source}</strong> under discovery category{' '}
              <strong className="text-emerald-400">{group.discoveryStatus}</strong>.
            </p>
            <p className="text-slate-500 text-[11px]">
              Note: Attacker victim postings represent unverified adversary extortion claims unless corroborated by independent incident forensics.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Source Intelligence */}
      {activeTab === 'source-intelligence' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0a101f] border border-emerald-500/30 text-xs">
              <span className="text-slate-400 text-[11px] block">First Known Public Claim</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">
                {group.firstClaimAt ? formatIST(group.firstClaimAt) : 'Unknown / None'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Source: {group.firstClaimSource || 'N/A'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#0a101f] border border-cyan-500/30 text-xs">
              <span className="text-slate-400 text-[11px] block">Platform Ingestion Date</span>
              <span className="text-lg font-bold text-cyan-400 font-mono mt-1 block">
                {formatIST(group.firstObservedAt || group.threatLedgerDetectedAt)}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Recorded by ThreatLedger
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] block">Analyst Verification Status</span>
              <span className="text-lg font-bold text-white mt-1 block">
                {group.verificationStatus || 'PENDING'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {group.verifiedBy ? `Reviewed by ${group.verifiedBy.fullName}` : 'Awaiting review'}
              </span>
            </div>
          </div>

          {/* Observations Table */}
          <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white">Contributing Source Observations</span>
              <span className="text-[11px] text-slate-500">
                {group.sourceObservations?.length || 0} observations linked
              </span>
            </div>

            {(!group.sourceObservations || group.sourceObservations.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No external source observations linked yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Source ID</th>
                    <th className="py-2.5 px-4">Observed Name</th>
                    <th className="py-2.5 px-4">Lineage</th>
                    <th className="py-2.5 px-4">First Claim Date</th>
                    <th className="py-2.5 px-4">Last Claim Date</th>
                    <th className="py-2.5 px-4">Retrieval Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {group.sourceObservations.map((obs: any) => (
                    <tr key={obs.id || obs.sourceId + obs.externalId} className="hover:bg-slate-800/20">
                      <td className="py-2.5 px-4 font-bold text-white">{obs.sourceId}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-mono text-[11px]">{obs.observedName}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {obs.sourceLineage}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-emerald-400 font-mono text-[11px]">
                        {obs.firstClaimAt ? formatIST(obs.firstClaimAt) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                        {obs.lastClaimAt ? formatIST(obs.lastClaimAt) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[10px]">
                        {formatIST(obs.retrievedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Verification Audit Trail */}
          {group.verifications && group.verifications.length > 0 && (
            <div className="bg-[#0a101f] border border-slate-800 rounded-xl p-4 space-y-2">
              <span className="text-xs font-bold text-white block">Analyst Validation History</span>
              <div className="divide-y divide-slate-800/60 text-xs">
                {group.verifications.map((v: any) => (
                  <div key={v.id} className="py-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-emerald-400">{v.status}</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{v.notes}</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-500">
                      <div>{v.verifiedBy?.fullName || 'Analyst'}</div>
                      <div>{formatIST(v.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Victims */}
      {activeTab === 'victims' && (
        <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-800 text-xs font-bold text-white">
            Targeted Organizations & Extortion Claims ({group.victims?.length || 0})
          </div>
          {(!group.victims || group.victims.length === 0) ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No individual victim claims indexed for this syndicate.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 text-[10px] uppercase">
                    <th className="py-3 px-4">Victim Organization</th>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4">Domain</th>
                    <th className="py-3 px-4">Discovered Date (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {group.victims.map((v: any) => (
                    <tr key={v.id} className="hover:bg-slate-900/40">
                      <td className="py-3 px-4 font-semibold text-white">{v.victimName}</td>
                      <td className="py-3 px-4 text-slate-300">{v.country || 'Global'}</td>
                      <td className="py-3 px-4 text-slate-400">{v.sector || 'Unspecified'}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{v.domain || '—'}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{formatIST(v.discoveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: MITRE ATT&CK */}
      {activeTab === 'ttps' && (
        <div className="bg-[#0a101f] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm">MITRE ATT&CK Mapping (v14.1)</h3>
            <span className="text-[11px] text-slate-500">Publicly Documented Tactics & Techniques</span>
          </div>
          {(!group.ttps || group.ttps.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No ATT&CK techniques associated yet. Research checklists enable analysts to map documented behaviors.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.ttps.map((t: any) => (
                <div key={t.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-[10px] text-emerald-400 font-mono font-bold block">{t.mitreTechniqueId}</span>
                  <p className="font-semibold text-white mt-0.5">{t.mitreTechniqueName}</p>
                  <span className="text-[10px] text-slate-400 block mt-1">Tactic: {t.mitreTactic}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: CVEs */}
      {activeTab === 'cves' && (
        <div className="bg-[#0a101f] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm">Associated Vulnerabilities & Exploits</h3>
            <span className="text-[11px] text-slate-500">Known CVE Vectors</span>
          </div>
          {(!group.cves || group.cves.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No CVE vulnerabilities recorded for this group.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {group.cves.map((c: any) => (
                <div key={c.id} className="py-3 flex items-start justify-between text-xs gap-4">
                  <div>
                    <span className="font-bold font-mono text-rose-400 text-sm">{c.cveId}</span>
                    <p className="text-slate-300 mt-1">{c.description || 'Vulnerability exploited for initial access or privilege escalation.'}</p>
                  </div>
                  {c.cvssScore && (
                    <span className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-500/30 font-bold font-mono">
                      CVSS {c.cvssScore}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Tools & Malware */}
      {activeTab === 'tools' && (
        <div className="bg-[#0a101f] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm">Associated Tools & Malware Variants</h3>
          </div>
          {(!group.tools || group.tools.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No tooling or custom encryptors mapped yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.tools.map((tl: any) => (
                <div key={tl.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                  <p className="font-bold text-white">{tl.toolName}</p>
                  <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                    Category: {tl.category || 'Tooling'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Research & Assignments */}
      {activeTab === 'research' && (
        <div className="bg-[#0a101f] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm">Analyst Allocations & Research State</h3>
            <Link
              href={`/assignments?allocateGroupId=${group.id}`}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Allocate New Assignment
            </Link>
          </div>
          {(!group.assignments || group.assignments.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No active research assignments for this group yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 text-xs">
              {group.assignments.map((a: any) => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white">{a.title}</span>
                    <span className="text-slate-400 block text-[11px] mt-0.5">
                      Analyst: {a.primaryAnalyst?.fullName || 'Assigned'} | Reviewer: {a.reviewer?.fullName || 'Reviewer'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                      {a.status}
                    </span>
                    <Link
                      href={`/my-tasks/${a.id}`}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
                    >
                      Open Task
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: History */}
      {activeTab === 'history' && (
        <div className="bg-[#0a101f] border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-3">
            Discovery & Operational Events
          </h3>
          {(!group.discoveryEvents || group.discoveryEvents.length === 0) ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No historical discovery events recorded.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 text-xs">
              {group.discoveryEvents.map((e: any) => (
                <div key={e.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400">{e.discoveryType}</span>
                    <span className="text-slate-500 font-mono">{formatIST(e.detectedAt)}</span>
                  </div>
                  <p className="text-slate-300 mt-1">{e.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Merge Group Modal (Section 14) */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a101f] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Merge Ransomware Records</h3>
              </div>
              <button onClick={() => setShowMergeModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            {mergeNotice && (
              <div className="mt-4 p-3 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                {mergeNotice}
              </div>
            )}

            <form onSubmit={handleMerge} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-300">
                You are merging another group record into <strong className="text-emerald-400">{group.name}</strong>.
              </p>
              <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p>✓ All aliases from secondary group will be added to {group.name}.</p>
                <p>✓ All victims, assignments, reports, and evidence will transfer safely.</p>
                <p>✓ Secondary record will be archived with a merge pointer.</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Secondary Group ID *</label>
                <input
                  type="text"
                  required
                  value={secondaryGroupId}
                  onChange={(e) => setSecondaryGroupId(e.target.value)}
                  placeholder="Paste UUID of duplicate group"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={merging}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                >
                  {merging ? 'Merging...' : 'Confirm Permanent Merge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
