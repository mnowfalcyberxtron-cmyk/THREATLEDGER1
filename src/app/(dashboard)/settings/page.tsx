'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Shield,
  Mail,
  HardDrive,
  GitBranch,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Database,
  Lock,
  Send,
  RefreshCw,
  Server,
  FileCheck,
  CalendarCheck,
  Calendar,
} from 'lucide-react';
import { WeekdayDatePicker } from '@/components/ui/WeekdayDatePicker';
import { formatIST } from '@/lib/utils';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'api' | 'email' | 'storage' | 'general' | 'migration'>('api');
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

  // Legacy Weekend Migration Review state (Section 10)
  const [legacyAssignments, setLegacyAssignments] = useState<any[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);
  const [selectedLegacyAssignment, setSelectedLegacyAssignment] = useState<any>(null);
  const [replacementDate, setReplacementDate] = useState('');
  const [migrationReason, setMigrationReason] = useState('');
  const [resolvingLegacy, setResolvingLegacy] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch {
      console.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function loadLegacyWeekends() {
    setLoadingLegacy(true);
    try {
      const res = await fetch('/api/assignments/legacy-weekends');
      const data = await res.json();
      setLegacyAssignments(data.assignments || []);
    } catch {
      console.error('Failed to load legacy weekend assignments');
    } finally {
      setLoadingLegacy(false);
    }
  }

  const handleResolveLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLegacyAssignment || !replacementDate) return;

    setResolvingLegacy(true);
    try {
      const res = await fetch('/api/assignments/legacy-weekends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: selectedLegacyAssignment.id,
          replacementDueDate: replacementDate,
          reason: migrationReason || 'Legacy weekend deadline resolved to verified working day',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to resolve legacy deadline');
      } else {
        alert(data.message);
        setSelectedLegacyAssignment(null);
        setReplacementDate('');
        setMigrationReason('');
        loadLegacyWeekends();
      }
    } catch {
      alert('Network failure resolving legacy deadline');
    } finally {
      setResolvingLegacy(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadLegacyWeekends();
  }, []);

  const handleAction = async (action: string, extra?: any) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Action failed');
      } else {
        setTestResult(data.message);
      }
    } catch {
      alert('Network failure processing test action');
    } finally {
      setTesting(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <span className="animate-pulse">Loading system configuration and security vaults...</span>
      </div>
    );
  }

  const { integrations, regional } = settings;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Settings className="w-4 h-4" />
          System Administration & Vault
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Control Panel</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Configure intelligence sources, email delivery providers, Cloudflare R2 private storage, and regional standards.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            setActiveTab('api');
            setTestResult(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'api'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Intelligence APIs & Feeds</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('storage');
            setTestResult(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'storage'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Cloudflare R2 Private Storage</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('email');
            setTestResult(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'email'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email & Section 31 Deliverables</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('general');
            setTestResult(null);
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Regional & Operational Policies</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('migration');
            setTestResult(null);
            loadLegacyWeekends();
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'migration'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Legacy Weekend Review</span>
          {legacyAssignments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 font-bold text-[10px]">
              {legacyAssignments.length}
            </span>
          )}
        </button>
      </div>

      {testResult && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <span>{testResult}</span>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Tab 1: API Integrations */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  Primary Intelligence: Ransomware.live API PRO
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Authenticates with <code className="text-emerald-400 font-mono">{integrations.ransomwareLive.endpoint}</code> via{' '}
                  <code className="text-slate-300 font-mono">{integrations.ransomwareLive.authHeader}</code>.
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                integrations.ransomwareLive.configured
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-950 text-amber-400 border border-amber-500/30'
              }`}>
                {integrations.ransomwareLive.configured ? 'Key Configured' : 'Using Fallback Seed'}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleAction('TEST_SOURCE')}
                disabled={testing}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>Test Live Connection</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-emerald-400" />
                  Secondary Monitor: GitHub Repository
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tracks upstream data updates from <code className="text-slate-300 font-mono">{integrations.githubMonitor.repo}</code>.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                Poll Interval: 60 min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Storage */}
      {activeTab === 'storage' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                Cloudflare R2 Private Object Storage
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Direct-to-R2 presigned upload architecture. Bucket is strictly private with zero public read ACLs.
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
              integrations.cloudflareR2.configured
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                : 'bg-indigo-950 text-indigo-400 border border-indigo-500/30'
            }`}>
              {integrations.cloudflareR2.configured ? 'Live R2 Connected' : 'Local Fallback Storage Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Target Bucket</span>
              <span className="text-white font-mono font-bold">{integrations.cloudflareR2.bucketName}</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Public Access</span>
              <span className="text-emerald-400 font-bold">Hard Blocked (Private Only)</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Presign TTL</span>
              <span className="text-white font-bold">900s (15 minutes)</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Storage Quota</span>
              <span className="text-white font-bold">50 GB Allocated</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleAction('TEST_R2')}
              disabled={testing}
              className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>Probe R2 Bucket Health</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Email */}
      {activeTab === 'email' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                Email Delivery & Section 31 Physical MIME Attachments
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Active Provider: <strong className="text-white font-mono">{integrations.email.primaryProvider}</strong>.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              Section 31 Guaranteed
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <FileCheck className="w-4 h-4" />
              <span>Strict Section 31 Compliance Protocol</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              When an analyst submits a report, ThreatLedger retrieves the exact document bytes from private storage and includes it as a physical MIME binary attachment in the reviewer dispatch email. Public or temporary download links are prohibited.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-slate-300">Send Test Operational Probe</label>
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="analyst@threatledger.internal"
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={() => handleAction('TEST_EMAIL', { testEmailRecipient: testEmail || undefined })}
                disabled={testing}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: General Policies */}
      {activeTab === 'general' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Operational & Regional Standards
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Timezone calibration, calendar month boundaries, and immutable audit policies.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Standard Regional Timezone</span>
              <span className="text-emerald-400 font-bold font-mono">{regional.timezone} ({regional.offset})</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Timestamp Format</span>
              <span className="text-white font-bold font-mono">{regional.dateFormat}</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Audit Policy</span>
              <span className="text-white font-bold">Append-Only / SHA-256 Signatures</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Reviewer Sign-off Rule</span>
              <span className="text-emerald-400 font-bold">Section 35 Decoupling Enforced</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Legacy Weekend Migration Review */}
      {activeTab === 'migration' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
                Legacy Weekend Deadline Migration Review
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Inspect and safely resolve legacy assignment deadlines that fall on weekends. No deadlines are silently modified.
              </p>
            </div>
            <button
              onClick={loadLegacyWeekends}
              disabled={loadingLegacy}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLegacy ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span>Refresh Queue</span>
            </button>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Working-Day Compliance Rule (Section 10)</span>
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Historical assignments with Saturday or Sunday deadlines are preserved intact to maintain complete audit fidelity. Administrators must review flagged records and explicitly assign replacement Monday–Friday working-day deadlines with logged justification.
            </p>
          </div>

          {loadingLegacy ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Scanning database for weekend assignment records...
            </div>
          ) : legacyAssignments.length === 0 ? (
            <div className="p-8 rounded-lg bg-slate-900/60 border border-slate-800/80 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-white">All Assignment Deadlines Comply with Working-Day Policy</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                No active or historical assignments currently possess unreviewed Saturday or Sunday deadlines. All operational deadlines conform to Monday–Friday schedules.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 font-semibold">
                Flagged Records Requiring Review: <span className="text-amber-400 font-bold">{legacyAssignments.length}</span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Threat Actor Group</th>
                      <th className="px-4 py-3">Primary Analyst</th>
                      <th className="px-4 py-3">Legacy Due Date (IST)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {legacyAssignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-slate-900/40">
                        <td className="px-4 py-3 font-semibold text-white">
                          {assignment.group?.name || 'Unassigned Group'}
                        </td>
                        <td className="px-4 py-3">
                          {assignment.primaryAnalyst?.fullName || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {formatIST(assignment.dueDate)} (Weekend)
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                            {assignment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedLegacyAssignment(assignment);
                              setReplacementDate('');
                              setMigrationReason('');
                            }}
                            className="px-3 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold"
                          >
                            Resolve to Working Day
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal / Panel for Resolution */}
          {selectedLegacyAssignment && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    Resolve Legacy Weekend Deadline
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select a replacement Monday–Friday working-day deadline for{' '}
                    <span className="text-white font-semibold">
                      {selectedLegacyAssignment.group?.name || 'Assignment'}
                    </span>
                    .
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <div className="text-slate-400">
                    Current Legacy Deadline:{' '}
                    <span className="text-rose-400 font-mono font-bold">
                      {formatIST(selectedLegacyAssignment.dueDate)}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Deadline Version: <span className="text-white font-mono">{selectedLegacyAssignment.deadlineVersion}</span>
                  </div>
                </div>

                <form onSubmit={handleResolveLegacy} className="space-y-4">
                  <WeekdayDatePicker
                    label="Replacement Working-Day Deadline"
                    value={replacementDate}
                    onChange={setReplacementDate}
                    required
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Migration / Justification Reason
                    </label>
                    <textarea
                      value={migrationReason}
                      onChange={(e) => setMigrationReason(e.target.value)}
                      placeholder="e.g. Migrated historical weekend deadline to valid working Monday per Working-Day Policy."
                      rows={3}
                      required
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLegacyAssignment(null)}
                      disabled={resolvingLegacy}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resolvingLegacy || !replacementDate}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {resolvingLegacy ? 'Recording Migration...' : 'Confirm Weekday Resolution'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
