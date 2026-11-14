'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'api' | 'email' | 'storage' | 'general'>('api');

  return (
    <div className="space-y-6">
      <div className="pb-6 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
          <Settings className="w-4 h-4" />
          System Administration
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Control Panel</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Configure intelligence source APIs, email delivery providers, Cloudflare R2 private storage, and access controls.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            activeTab === 'api'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Ransomware.live API PRO</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            activeTab === 'storage'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Cloudflare R2 Storage</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            activeTab === 'email'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email & Attachments (SMTP/Resend)</span>
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            activeTab === 'general'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>General & Timezone</span>
        </button>
      </div>

      {/* Tab 1: API Integration */}
      {activeTab === 'api' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-emerald-400" />
                Primary Intelligence: Ransomware.live API PRO
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Authenticates with <code className="text-emerald-400 font-mono">https://api-pro.ransomware.live</code> via{' '}
                <code className="text-slate-300 font-mono">X-API-KEY</code>.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              Ready for Phase 2 Integration
            </span>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Ransomware.live PRO API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  disabled
                  value="••••••••••••••••••••••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 uppercase font-semibold">
                  Server Encrypted
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Key is stored server-side with AES-256-GCM encryption at rest and never exposed to the client bundle.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                disabled
                className="px-4 py-2 rounded-lg bg-emerald-500/50 text-slate-950 font-bold text-xs cursor-not-allowed"
              >
                Validate Connection
              </button>
              <span className="text-xs text-slate-400">Configured via environment variables</span>
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
                Direct-to-R2 presigned upload architecture. Document bytes bypass serverless functions.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              Ready for Phase 4 Integration
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Bucket Privacy</span>
              <span className="text-white font-bold">100% Private (No Public URLs)</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Presigned URL TTL</span>
              <span className="text-white font-bold">15 Minutes (Short-Lived Expiry)</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Final Reports Prefix</span>
              <span className="text-emerald-400 font-mono font-bold">reports/&#123;assignmentId&#125;/...</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Supporting Evidence Prefix</span>
              <span className="text-emerald-400 font-mono font-bold">evidence/&#123;assignmentId&#125;/...</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Email */}
      {activeTab === 'email' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              Email Delivery & Physical MIME Report Attachments
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Supports SMTP and Resend with strict requirement: actual report binary bytes must be physically attached to outgoing notification emails to reviewers.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Section 31 Compliance Guaranteed</span>
            </div>
            <p className="text-slate-400">
              When an analyst submits research, ThreatLedger server code streams the report bytes directly from private R2 storage into the email MIME payload. No public storage links or temporary download URLs are ever substituted.
            </p>
          </div>
        </div>
      )}

      {/* Tab 4: General */}
      {activeTab === 'general' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              General Platform & Regional Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Timezone enforcement, audit retention, and system branding.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Standard Timezone</span>
              <span className="text-emerald-400 font-bold font-mono">Asia/Kolkata (IST, UTC+5:30)</span>
            </div>
            <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase font-semibold block mb-1">Audit Trail Policy</span>
              <span className="text-white font-bold">Immutable Append-Only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
