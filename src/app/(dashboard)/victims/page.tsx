'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Globe,
  Building2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

interface VictimItem {
  id: string;
  victimName: string;
  country?: string;
  sector?: string;
  domain?: string;
  discoveredAt?: string;
  attackedAt?: string;
  claimType: string;
  group: { id: string; name: string; discoveryStatus: string };
}

export default function VictimsPage() {
  const [victims, setVictims] = useState<VictimItem[]>([]);
  const [total, setTotal] = useState(0);
  const [topSectors, setTopSectors] = useState<any[]>([]);
  const [topCountries, setTopCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedSector, setSelectedSector] = useState('');

  async function loadVictims() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCountry) params.set('country', selectedCountry);
      if (selectedSector) params.set('sector', selectedSector);

      const res = await fetch(`/api/victims?${params.toString()}`);
      const data = await res.json();
      setVictims(data.victims || []);
      setTotal(data.total || 0);
      setTopSectors(data.analytics?.topSectors || []);
      setTopCountries(data.analytics?.topCountries || []);
    } catch {
      console.error('Failed to load victim telemetry');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVictims();
  }, [selectedCountry, selectedSector]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadVictims();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">
          <Users className="w-4 h-4" />
          Adversary Extortion Registry
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Victim Monitoring & Telemetry</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Real-time feed of claimed victim enterprises, sector distribution, and country targets across active ransomware operations.
        </p>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Sectors */}
        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              Targeted Industry Sectors
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Incident Volume</span>
          </div>
          {topSectors.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No sector aggregations available yet.</p>
          ) : (
            <div className="space-y-2">
              {topSectors.slice(0, 4).map((s: any) => (
                <div key={s.sector} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 truncate max-w-[220px]">{s.sector}</span>
                  <span className="font-mono font-bold text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Countries */}
        <div className="p-4 rounded-xl bg-[#0a101f] border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" />
              Geographical Spread
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Incident Volume</span>
          </div>
          {topCountries.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No geographical data available yet.</p>
          ) : (
            <div className="space-y-2">
              {topCountries.slice(0, 4).map((c: any) => (
                <div key={c.country} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{c.country}</span>
                  <span className="font-mono font-bold text-white px-2 py-0.5 bg-slate-900 rounded border border-slate-800">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#0a101f] border border-slate-800 rounded-xl">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search victim organization, domain..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Countries</option>
            {topCountries.map((c) => (
              <option key={c.country} value={c.country}>{c.country}</option>
            ))}
          </select>

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">All Sectors</option>
            {topSectors.map((s) => (
              <option key={s.sector} value={s.sector}>{s.sector}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Victims Table */}
      <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-white">Indexed Incidents ({total})</span>
          <span className="text-slate-500">Timestamps converted to Asia/Kolkata (IST)</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="animate-pulse">Loading victim telemetry...</span>
          </div>
        ) : victims.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No victim records match your current filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Victim Organization</th>
                  <th className="py-3 px-4">Threat Actor</th>
                  <th className="py-3 px-4">Sector</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4">Claim Verification</th>
                  <th className="py-3 px-4">Discovered Date (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {victims.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{v.victimName}</p>
                      {v.domain && (
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{v.domain}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/groups/${v.group.id}`}
                        className="font-semibold text-emerald-400 hover:underline"
                      >
                        {v.group.name}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{v.sector || 'Unspecified'}</td>
                    <td className="py-3 px-4 text-slate-300">{v.country || 'Global'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          v.claimType === 'INDIPENDENTLY_VERIFIED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        {v.claimType === 'INDIPENDENTLY_VERIFIED' ? (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                        )}
                        <span>{v.claimType === 'INDIPENDENTLY_VERIFIED' ? 'Verified Incident' : 'Attacker Claim'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {formatIST(v.discoveredAt)}
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
