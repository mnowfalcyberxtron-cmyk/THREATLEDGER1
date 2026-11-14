'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  Filter,
  PlusCircle,
  Shield,
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

interface GroupData {
  id: string;
  name: string;
  normalizedName: string;
  description?: string;
  source: string;
  status: string;
  discoveryStatus: string;
  victimCount: number;
  threatLedgerDetectedAt: string;
  aliases: Array<{ alias: string }>;
  _count: { victims: number };
}

export default function GroupsDirectoryPage() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Add Group Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAliases, setNewGroupAliases] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupWebsite, setNewGroupWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function loadGroups() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sourceFilter) params.set('source', sourceFilter);

      const res = await fetch(`/api/groups?${params.toString()}`);
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      console.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, [sourceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadGroups();
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    const aliases = newGroupAliases
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          aliases,
          description: newGroupDescription || undefined,
          websiteUrl: newGroupWebsite || undefined,
          status: 'ACTIVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'Failed to create group');
      } else {
        setShowAddModal(false);
        setNewGroupName('');
        setNewGroupAliases('');
        setNewGroupDescription('');
        setNewGroupWebsite('');
        loadGroups();
      }
    } catch {
      setModalError('Network error while creating group.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Database className="w-4 h-4" />
            Threat Actor Profiles
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Group Intelligence Directory</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Master repository of ransomware groups, historical alias mappings, and technical intelligence dossiers.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddModal(true);
            setModalError(null);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Group Manually</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0a101f] border border-slate-800 rounded-xl">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search group name, alias, or keyword..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="">All Intelligence Sources</option>
            <option value="RANSOMWARE_LIVE">Ransomware.live API PRO</option>
            <option value="MANUAL">Manually Added</option>
            <option value="MERGED">Merged Records</option>
          </select>
        </div>
      </div>

      {/* Groups Grid / Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Indexed Groups ({groups.length})</span>
          <span className="text-slate-500">Asia/Kolkata (IST) Standard Time</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading group directory...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No ransomware groups found matching the current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Group Name</th>
                  <th className="py-3 px-4">Source Provenance</th>
                  <th className="py-3 px-4">Discovery Status</th>
                  <th className="py-3 px-4">Claimed Victims</th>
                  <th className="py-3 px-4">ThreatLedger Detection</th>
                  <th className="py-3 px-4 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link href={`/groups/${g.id}`} className="hover:text-emerald-400">
                        <p className="font-bold text-white text-sm">{g.name}</p>
                        {g.aliases.length > 0 && (
                          <p className="text-[10px] text-slate-400 truncate max-w-sm">
                            Aliases: {g.aliases.map((a) => a.alias).join(', ')}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {g.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                        {g.discoveryStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      {g.victimCount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {formatIST(g.threatLedgerDetectedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/groups/${g.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold"
                      >
                        <span>Intel Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Group Creation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0a101f] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Add Ransomware Group Manually</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Fog Ransomware"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Aliases (Comma Separated)</label>
                <input
                  type="text"
                  value={newGroupAliases}
                  onChange={(e) => setNewGroupAliases(e.target.value)}
                  placeholder="e.g. FogLocker, Foggy"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Known Onion / Leak Site URL</label>
                <input
                  type="text"
                  value={newGroupWebsite}
                  onChange={(e) => setNewGroupWebsite(e.target.value)}
                  placeholder="http://example...onion"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Operational Description</label>
                <textarea
                  rows={3}
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Tactics, origin, target sectors, known extortion notes..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
                Manual groups are tagged with provenance <strong className="text-white">MANUAL</strong>. API synchronizations will not overwrite your manual research notes.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Register Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
