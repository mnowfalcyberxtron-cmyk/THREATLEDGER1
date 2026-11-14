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
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'api' | 'email' | 'storage' | 'general'>('api');
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');

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

  useEffect(() => {
    loadSettings();
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
    </div>
  );
}
