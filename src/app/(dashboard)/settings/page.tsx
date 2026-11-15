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
  ExternalLink,
  Eye,
  EyeOff,
  RotateCcw,
  Info,
  History,
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

  // Gmail & Email Architecture State (Section 4, 12, 15)
  const [emailSubTab, setEmailSubTab] = useState<'gmail' | 'recipients' | 'policy' | 'templates' | 'activity'>('gmail');
  const [gmailConfig, setGmailConfig] = useState<any>(null);
  const [gmailSender, setGmailSender] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gmailDisplayName, setGmailDisplayName] = useState('ThreatLedger');
  const [gmailReplyTo, setGmailReplyTo] = useState('');
  const [gmailArchiveBcc, setGmailArchiveBcc] = useState('');
  const [gmailMaxAttachmentMb, setGmailMaxAttachmentMb] = useState(18);
  const [savingGmail, setSavingGmail] = useState(false);
  const [testingGmailConn, setTestingGmailConn] = useState(false);
  const [sendingGmailTest, setSendingGmailTest] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);
  const [gmailTestEmailAddress, setGmailTestEmailAddress] = useState('');

  // Email Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingSubject, setEditingSubject] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Email Activity state
  const [emailActivity, setEmailActivity] = useState<any>({ submissions: [], outbox: [] });
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function loadGmailConfig() {
    try {
      const res = await fetch('/api/settings/gmail');
      const data = await res.json();
      setGmailConfig(data);
      if (data.senderEmail) setGmailSender(data.senderEmail);
      if (data.senderDisplayName) setGmailDisplayName(data.senderDisplayName);
      if (data.replyToEmail) setGmailReplyTo(data.replyToEmail);
      if (data.archiveBccEmail) setGmailArchiveBcc(data.archiveBccEmail);
      if (data.maxAttachmentBytes) setGmailMaxAttachmentMb(Math.round(data.maxAttachmentBytes / (1024 * 1024)));
    } catch {
      console.error('Failed to load Gmail settings');
    }
  }

  async function loadTemplates() {
    try {
      const res = await fetch('/api/settings/email-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
      if (data.templates && data.templates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data.templates[0]);
        setEditingSubject(data.templates[0].subject);
        setEditingBody(data.templates[0].bodyText);
      }
    } catch {
      console.error('Failed to load email templates');
    }
  }

  async function loadEmailActivity() {
    setLoadingActivity(true);
    try {
      const res = await fetch('/api/settings/email-activity');
      const data = await res.json();
      setEmailActivity(data);
    } catch {
      console.error('Failed to load email activity');
    } finally {
      setLoadingActivity(false);
    }
  }

  async function handleSaveGmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingGmail(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_CONFIG',
          senderEmail: gmailSender,
          appPassword: gmailAppPassword || undefined,
          senderDisplayName: gmailDisplayName,
          replyToEmail: gmailReplyTo || undefined,
          archiveBccEmail: gmailArchiveBcc || undefined,
          maxAttachmentBytes: gmailMaxAttachmentMb * 1024 * 1024,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to save Gmail configuration');
      } else {
        alert(data.message);
        setGmailAppPassword('');
        loadGmailConfig();
        loadSettings();
      }
    } catch {
      alert('Network failure saving Gmail configuration');
    } finally {
      setSavingGmail(false);
    }
  }

  async function handleTestGmailConnection() {
    setTestingGmailConn(true);
    try {
      const res = await fetch('/api/settings/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TEST_CONNECTION',
          senderEmail: gmailSender || undefined,
          appPassword: gmailAppPassword || undefined,
        }),
      });

      const data = await res.json();
      alert(data.message || (data.success ? 'Connected successfully' : 'Connection failed'));
      loadGmailConfig();
    } catch {
      alert('Network failure testing Gmail connection');
    } finally {
      setTestingGmailConn(false);
    }
  }

  async function handleSendGmailTest(e: React.FormEvent) {
    e.preventDefault();
    setSendingGmailTest(true);
    try {
      const res = await fetch('/api/settings/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_TEST_EMAIL',
          testRecipient: gmailTestEmailAddress || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to send test email');
      } else {
        alert(data.message);
        loadGmailConfig();
        loadEmailActivity();
      }
    } catch {
      alert('Network failure sending test email');
    } finally {
      setSendingGmailTest(false);
    }
  }

  async function handleDisconnectGmail() {
    if (!confirm('Are you sure you want to disconnect the ThreatLedger sender Gmail account? Stored App Password credentials will be removed.')) {
      return;
    }
    setDisconnectingGmail(true);
    try {
      const res = await fetch('/api/settings/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DISCONNECT' }),
      });
      const data = await res.json();
      alert(data.message);
      setGmailAppPassword('');
      loadGmailConfig();
      loadSettings();
    } catch {
      alert('Network failure disconnecting Gmail');
    } finally {
      setDisconnectingGmail(false);
    }
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;

    setSavingTemplate(true);
    try {
      const res = await fetch('/api/settings/email-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey: selectedTemplate.templateKey,
          subject: editingSubject,
          bodyText: editingBody,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to save template');
      } else {
        alert(data.message);
        loadTemplates();
      }
    } catch {
      alert('Network failure saving template');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleRetrySubmission(submissionId: string) {
    setRetryingId(submissionId);
    try {
      const res = await fetch('/api/settings/email-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETRY_SUBMISSION', submissionId }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Retry failed');
      else {
        alert(data.message);
        loadEmailActivity();
      }
    } catch {
      alert('Network failure retrying submission email');
    } finally {
      setRetryingId(null);
    }
  }

  async function handleRetryCleanup(submissionId: string) {
    setRetryingId(submissionId);
    try {
      const res = await fetch('/api/settings/email-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETRY_CLEANUP', submissionId }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || 'Cleanup retry failed');
      else {
        alert(data.message);
        loadEmailActivity();
      }
    } catch {
      alert('Network failure retrying temporary cleanup');
    } finally {
      setRetryingId(null);
    }
  }

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
    loadGmailConfig();
    loadTemplates();
    loadEmailActivity();
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

      {/* Tab 3: Email & Gmail Document Archive */}
      {activeTab === 'email' && (
        <div className="p-6 rounded-xl bg-[#0a101f] border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                Gmail Integration & Document Archive System
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Dedicated Gmail sender account, real MIME email attachments, and Sent mailbox archival.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                gmailConfig?.status === 'CONNECTED'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                  : gmailConfig?.status === 'CONNECTION_FAILED'
                  ? 'bg-rose-950/80 text-rose-400 border-rose-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {gmailConfig?.status === 'CONNECTED'
                  ? 'Gmail Connected'
                  : gmailConfig?.status === 'CONNECTION_FAILED'
                  ? 'Connection Failed'
                  : 'Not Configured'}
              </span>
            </div>
          </div>

          {/* Email Section Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 text-xs font-semibold overflow-x-auto scrollbar-none">
            <button
              onClick={() => setEmailSubTab('gmail')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                emailSubTab === 'gmail'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gmail Configuration
            </button>
            <button
              onClick={() => setEmailSubTab('recipients')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                emailSubTab === 'recipients'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Recipient Management
            </button>
            <button
              onClick={() => setEmailSubTab('policy')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                emailSubTab === 'policy'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Attachment & Archive Policy
            </button>
            <button
              onClick={() => setEmailSubTab('templates')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                emailSubTab === 'templates'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Notification Templates ({templates.length || 9})
            </button>
            <button
              onClick={() => {
                setEmailSubTab('activity');
                loadEmailActivity();
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                emailSubTab === 'activity'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Email Activity & Outbox
            </button>
          </div>

          {/* Subtab 1: Gmail Configuration */}
          {emailSubTab === 'gmail' && (
            <div className="space-y-6">
              {/* Setup Guide Card */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-400" />
                    How to Setup ThreatLedger Gmail Sender Account
                  </h3>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Google App Passwords Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-300">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Step 1 & 2</span>
                    <p className="text-slate-400">
                      Create a dedicated Gmail account (e.g. <code className="text-white">threatledger.notifications@gmail.com</code>) and turn on <strong>Google 2-Step Verification</strong>.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Step 3 & 4</span>
                    <p className="text-slate-400">
                      Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Google Security App Passwords</a>, name it &quot;ThreatLedger&quot;, and copy the generated 16-character password.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Step 5 & 6</span>
                    <p className="text-slate-400">
                      Enter the Gmail address and App Password below, click <strong>Save Configuration</strong>, and verify with <strong>Test Connection</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Card */}
              <form onSubmit={handleSaveGmail} className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Sender Gmail Address <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={gmailSender}
                      onChange={(e) => setGmailSender(e.target.value)}
                      placeholder="e.g. threatledger.notifications@gmail.com"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-300">
                        Gmail App Password {gmailConfig?.hasStoredPassword ? '(Stored — Leave blank to keep)' : <span className="text-rose-400">*</span>}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-slate-400 hover:text-white inline-flex items-center gap-1"
                      >
                        {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showPassword ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={gmailAppPassword}
                      onChange={(e) => setGmailAppPassword(e.target.value)}
                      placeholder={gmailConfig?.hasStoredPassword ? '•••••••••••••••• (Encrypted in AES-256-GCM)' : '16-character Google App Password'}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Sender Display Name</label>
                    <input
                      type="text"
                      value={gmailDisplayName}
                      onChange={(e) => setGmailDisplayName(e.target.value)}
                      placeholder="ThreatLedger"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Reply-To Address (Optional)</label>
                    <input
                      type="email"
                      value={gmailReplyTo}
                      onChange={(e) => setGmailReplyTo(e.target.value)}
                      placeholder="analysts@threatledger.internal"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Archive-Copy BCC Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={gmailArchiveBcc}
                      onChange={(e) => setGmailArchiveBcc(e.target.value)}
                      placeholder="e.g. cti-archive@threatledger.internal"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      If empty, the sender Gmail account&apos;s Sent folder remains the primary document archive.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Max Combined Attachment Size (MB)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      value={gmailMaxAttachmentMb}
                      onChange={(e) => setGmailMaxAttachmentMb(parseInt(e.target.value, 10) || 18)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Recommended: 18 MB to safely accommodate Base64 MIME encoding overhead under Gmail&apos;s 25 MB ceiling.
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={savingGmail}
                      className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {savingGmail ? 'Verifying & Saving...' : 'Save Configuration'}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestGmailConnection}
                      disabled={testingGmailConn || !gmailSender}
                      className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingGmailConn ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>Test Connection</span>
                    </button>
                  </div>

                  {gmailConfig?.configured && (
                    <button
                      type="button"
                      onClick={handleDisconnectGmail}
                      disabled={disconnectingGmail}
                      className="px-3.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold disabled:opacity-50"
                    >
                      Disconnect Gmail
                    </button>
                  )}
                </div>
              </form>

              {/* Diagnostic Test Email Sender */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  Dispatch Diagnostic Test Email
                </h3>
                <p className="text-xs text-slate-400">
                  Send a live probe message from the configured sender Gmail account. Does not modify any report statuses.
                </p>
                <form onSubmit={handleSendGmailTest} className="flex items-center gap-2 max-w-lg">
                  <input
                    type="email"
                    required
                    value={gmailTestEmailAddress}
                    onChange={(e) => setGmailTestEmailAddress(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    type="submit"
                    disabled={sendingGmailTest}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingGmailTest ? 'Sending...' : 'Send Test'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Subtab 2: Recipient Management */}
          {emailSubTab === 'recipients' && (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-xs text-slate-300">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                Reviewer Recipient Resolution & Override Governance
              </h3>
              <p className="text-slate-400 leading-relaxed text-xs">
                To guarantee strict peer-review governance, ThreatLedger separates the report submitter from the recipient:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Default Recipient</span>
                  <div className="text-white font-semibold">Assigned Reviewer Registered Email</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    When an analyst submits a report, the email is automatically addressed to the peer reviewer assigned to that task. The submitting analyst&apos;s email address is never used as the reviewer recipient.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Administrator Override</span>
                  <div className="text-white font-semibold">Authorised External / Alternate Destination</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Administrators can specify an alternative recipient email address on any specific assignment. Overrides are audited, visibly labeled in the UI, and inaccessible to ordinary analysts.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                <strong>Analyst Submission Confirmation:</strong> Upon successful dispatch, a separate confirmation receipt is automatically emailed to the submitting analyst without large attachments to confirm delivery.
              </div>
            </div>
          )}

          {/* Subtab 3: Attachment Policy */}
          {emailSubTab === 'policy' && (
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 text-xs text-slate-300">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Real Email Attachment Protocol & Temporary Lifecycle
              </h3>

              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-white font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Strict Real MIME Attachments (Zero Link Substitution)</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  The report and all supporting evidence are delivered as actual physical binary MIME attachments. Google Drive links, temporary signed URLs, and portal login links are strictly prohibited as attachment substitutes. Reviewers can download and inspect original files directly from the email.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Approved Document Formats</span>
                  <p className="text-white text-xs font-mono">
                    PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, LOG, JSON, XML, PNG, JPG, JPEG, WEBP
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Post-Dispatch Cleanup Rule</span>
                  <p className="text-slate-400 text-[11px]">
                    Temporary files staged in private storage are permanently wiped immediately after Gmail accepts the message. If sending fails, files are preserved for retry.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 4: Notification Templates */}
          {emailSubTab === 'templates' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1 border-r border-slate-800 pr-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Available Templates</span>
                  {templates.map((tpl) => (
                    <button
                      key={tpl.templateKey}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        setEditingSubject(tpl.subject);
                        setEditingBody(tpl.bodyText);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors block truncate ${
                        selectedTemplate?.templateKey === tpl.templateKey
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>

                {selectedTemplate && (
                  <form onSubmit={handleSaveTemplate} className="space-y-4 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{selectedTemplate.name}</h4>
                      <button
                        type="submit"
                        disabled={savingTemplate}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                      >
                        {savingTemplate ? 'Saving...' : 'Save Template'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
                      <input
                        type="text"
                        value={editingSubject}
                        onChange={(e) => setEditingSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Body Text</label>
                      <textarea
                        rows={8}
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      />
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                      <span className="font-semibold text-slate-300 block">Supported Variables:</span>
                      <p className="font-mono text-emerald-400/90">
                        &#123;&#123;report_id&#125;&#125;, &#123;&#123;report_name&#125;&#125;, &#123;&#123;submission_version&#125;&#125;, &#123;&#123;submitted_by&#125;&#125;, &#123;&#123;assigned_reviewer&#125;&#125;, &#123;&#123;reviewer_email&#125;&#125;, &#123;&#123;submission_date&#125;&#125;, &#123;&#123;submission_status&#125;&#125;, &#123;&#123;review_comments&#125;&#125;, &#123;&#123;approval_date&#125;&#125;
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Subtab 5: Email Activity & Outbox */}
          {emailSubTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  Recent Report Submissions & Outbox Archive
                </h4>
                <button
                  onClick={loadEmailActivity}
                  disabled={loadingActivity}
                  className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingActivity ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {emailActivity.submissions?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-slate-800/80 rounded-lg bg-slate-900/40">
                  No report submissions recorded yet. Once analysts submit reports, their Gmail archive references and delivery states will be tracked here.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-2.5">Syndicate / Task</th>
                        <th className="px-4 py-2.5">Version</th>
                        <th className="px-4 py-2.5">Recipient</th>
                        <th className="px-4 py-2.5">Delivery Status</th>
                        <th className="px-4 py-2.5">Cleanup Status</th>
                        <th className="px-4 py-2.5">Submitted</th>
                        <th className="px-4 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {emailActivity.submissions?.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-900/40">
                          <td className="px-4 py-3 font-semibold text-white">
                            {s.assignment?.group?.name || s.assignment?.title || 'Report'}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400 font-bold">
                            v{s.versionNumber}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {s.recipientEmail}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.emailStatus === 'ACCEPTED_BY_GMAIL'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : s.emailStatus === 'FAILED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {s.emailStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              s.cleanupStatus === 'CLEANED'
                                ? 'bg-slate-800 text-slate-300'
                                : s.cleanupStatus === 'FAILED'
                                ? 'bg-rose-950 text-rose-300'
                                : 'bg-slate-900 text-slate-400'
                            }`}>
                              {s.cleanupStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-400">
                            {formatIST(s.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.emailStatus === 'FAILED' && (
                              <button
                                onClick={() => handleRetrySubmission(s.id)}
                                disabled={retryingId === s.id}
                                className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-bold"
                              >
                                {retryingId === s.id ? 'Retrying...' : 'Retry Send'}
                              </button>
                            )}
                            {s.cleanupStatus === 'FAILED' && (
                              <button
                                onClick={() => handleRetryCleanup(s.id)}
                                disabled={retryingId === s.id}
                                className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold ml-1.5"
                              >
                                {retryingId === s.id ? 'Cleaning...' : 'Retry Cleanup'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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
