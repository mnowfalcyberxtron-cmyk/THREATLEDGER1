'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckSquare,
  ArrowLeft,
  Clock,
  Briefcase,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  FileText,
  FolderArchive,
  Upload,
  Download,
  ExternalLink,
  ChevronDown,
  Layers,
  Paperclip,
  Check,
  Copy,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

export default function AnalystTaskWorkbench() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CHECKLIST' | 'REPORTS' | 'EVIDENCE' | 'NOTES'>('CHECKLIST');

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'SHARED' | 'ADMIN_PRIVATE'>('SHARED');
  const [postingNote, setPostingNote] = useState(false);

  // Status transition state
  const [transitioning, setTransitioning] = useState(false);

  // Direct Report Upload state
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reportUploadProgress, setReportUploadProgress] = useState('');

  // Direct Evidence Upload state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceCategory, setEvidenceCategory] = useState('Screenshot');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [evidenceUploadProgress, setEvidenceUploadProgress] = useState('');

  // Copy hash state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadTask() {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load task workbench');
      } else {
        setAssignment(data.assignment);
      }
    } catch {
      setError('Connection failure loading task workbench');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const handleUpdateChecklist = async (itemId: string, status: string, notApplicableReason?: string) => {
    try {
      const res = await fetch(`/api/assignments/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, status, notApplicableReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update checklist item');
      } else {
        setAssignment((prev: any) => ({
          ...prev,
          checklistItems: prev.checklistItems.map((item: any) =>
            item.id === itemId ? data.item : item
          ),
        }));
      }
    } catch {
      alert('Network error updating checklist');
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setPostingNote(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent, noteType }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to post note');
      } else {
        setNewNoteContent('');
        loadTask();
      }
    } catch {
      alert('Network error posting note');
    } finally {
      setPostingNote(false);
    }
  };

  const handleStatusTransition = async (targetStatus: string, reasonText?: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, reason: reasonText }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Status transition rejected');
      } else {
        alert(data.message);
        loadTask();
      }
    } catch {
      alert('Network error processing transition');
    } finally {
      setTransitioning(false);
    }
  };

  const handleDirectReportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportFile) return;

    setUploadingReport(true);
    setReportUploadProgress('Step 1/3: Authorizing direct R2 presigned session...');

    try {
      // 1. Presign
      const presignRes = await fetch('/api/files/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: taskId,
          filename: reportFile.name,
          fileSize: reportFile.size,
          mimeType: reportFile.type || 'application/pdf',
          fileCategory: 'REPORT',
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || 'Failed to authorize upload session');

      // 2. Direct PUT to R2
      setReportUploadProgress('Step 2/3: Streaming bytes directly to Cloudflare R2 bucket...');
      const putRes = await fetch(presignData.presignedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': reportFile.type || 'application/pdf' },
        body: reportFile,
      });

      if (!putRes.ok && putRes.status !== 0) throw new Error('Direct R2 transmission failed');

      // 3. Verify
      setReportUploadProgress('Step 3/3: Verifying SHA-256 and indexing report version...');
      const verifyRes = await fetch('/api/files/upload/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: taskId,
          objectKey: presignData.objectKey,
          filename: reportFile.name,
          fileSize: reportFile.size,
          mimeType: reportFile.type || 'application/pdf',
          fileCategory: 'REPORT',
          versionNumber: presignData.versionNumber,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');

      setReportFile(null);
      loadTask();
      alert(`Report Version v${presignData.versionNumber} successfully archived.`);
    } catch (err: any) {
      alert(err.message || 'Upload error');
    } finally {
      setUploadingReport(false);
      setReportUploadProgress('');
    }
  };

  const handleDirectEvidenceUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceFile) return;

    setUploadingEvidence(true);
    setEvidenceUploadProgress('Step 1/3: Authorizing direct R2 presigned session...');

    try {
      const presignRes = await fetch('/api/files/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: taskId,
          filename: evidenceFile.name,
          fileSize: evidenceFile.size,
          mimeType: evidenceFile.type || 'application/octet-stream',
          fileCategory: 'EVIDENCE',
          evidenceCategory,
          evidenceDescription: evidenceDesc || undefined,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || 'Authorization failed');

      setEvidenceUploadProgress('Step 2/3: Streaming bytes to Cloudflare R2...');
      const putRes = await fetch(presignData.presignedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': evidenceFile.type || 'application/octet-stream' },
        body: evidenceFile,
      });

      if (!putRes.ok && putRes.status !== 0) throw new Error('Transmission failed');

      setEvidenceUploadProgress('Step 3/3: Registering evidence in research database...');
      const verifyRes = await fetch('/api/files/upload/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: taskId,
          objectKey: presignData.objectKey,
          filename: evidenceFile.name,
          fileSize: evidenceFile.size,
          mimeType: evidenceFile.type || 'application/octet-stream',
          fileCategory: 'EVIDENCE',
          evidenceCategory,
          evidenceDescription: evidenceDesc || undefined,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');

      setEvidenceFile(null);
      setEvidenceDesc('');
      loadTask();
      alert('Supporting evidence archived successfully.');
    } catch (err: any) {
      alert(err.message || 'Evidence upload error');
    } finally {
      setUploadingEvidence(false);
      setEvidenceUploadProgress('');
    }
  };

  const handleDownloadFile = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/download/${fileId}`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error || 'Failed to acquire download URL');
      }
    } catch {
      alert('Network error downloading file');
    }
  };

  const copyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <span className="animate-pulse">Loading analyst research workbench...</span>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <p className="text-white font-bold">{error || 'Task not found or access restricted'}</p>
        <Link href="/my-tasks" className="text-emerald-400 hover:underline">
          Return to My Tasks
        </Link>
      </div>
    );
  }

  const completedChecklistCount = assignment.checklistItems?.filter(
    (i: any) => i.status === 'COMPLETED' || i.status === 'NOT_APPLICABLE'
  ).length || 0;

  const reportVersions = assignment.reports?.[0]?.versions || [];
  const evidenceItems = assignment.evidence || [];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/my-tasks"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Tasks</span>
        </Link>

        {/* Section 35 Decoupled Lifecycle Transitions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {assignment.status === 'ASSIGNED' && (
            <button
              onClick={() => handleStatusTransition('ACCEPTED', 'Analyst accepted task')}
              disabled={transitioning}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Accept Assignment
            </button>
          )}

          {(assignment.status === 'ACCEPTED' || assignment.status === 'ON_HOLD' || assignment.status === 'CHANGES_REQUESTED') && (
            <button
              onClick={() => handleStatusTransition('IN_PROGRESS', 'Analyst initiated active research')}
              disabled={transitioning}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Start / Resume Research
            </button>
          )}

          {assignment.status === 'IN_PROGRESS' && (
            <>
              <button
                onClick={() => handleStatusTransition('ON_HOLD', 'Task paused by analyst')}
                disabled={transitioning}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Put On Hold
              </button>
              <button
                onClick={() => {
                  if (reportVersions.length === 0) {
                    alert('Please upload at least one final research report version before submitting for review.');
                    return;
                  }
                  const reason = prompt('Confirm submission notes for reviewer:');
                  if (reason !== null) {
                    handleStatusTransition('SUBMITTED_FOR_REVIEW', reason);
                  }
                }}
                disabled={transitioning}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20"
              >
                Submit for Review
              </button>
            </>
          )}

          {assignment.status === 'SUBMITTED_FOR_REVIEW' && (
            <span className="px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              Pending Independent Reviewer Sign-off (Section 35)
            </span>
          )}

          {assignment.status === 'APPROVED_COMPLETED' && (
            <span className="px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved & Locked
            </span>
          )}
        </div>
      </div>

      {/* Task Header Banner */}
      <div className="p-6 rounded-2xl bg-[#0a101f] border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                {assignment.priority} Priority
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                {assignment.status}
              </span>
              <span className="text-xs text-slate-500">
                Due: <strong className="text-white font-mono">{assignment.dueDate ? formatIST(assignment.dueDate) : 'No Deadline'}</strong>
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">{assignment.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Syndicate:{' '}
              <Link href={`/groups/${assignment.group.id}`} className="text-emerald-400 font-bold hover:underline">
                {assignment.group.name}
              </Link>{' '}
              ({assignment.group.victimCount} known victims)
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Primary Analyst</span>
              <span className="text-white font-semibold">{assignment.primaryAnalyst?.fullName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Reviewer</span>
              <span className="text-white font-semibold">{assignment.reviewer?.fullName}</span>
            </div>
          </div>
        </div>

        {assignment.instructions && (
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white block mb-1">Research Scope & Instructions:</span>
            {assignment.instructions}
          </div>
        )}

        {assignment.rejectionReason && (
          <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
            <span className="font-bold text-rose-400 block mb-1">Reviewer Feedback / Changes Requested:</span>
            {assignment.rejectionReason}
          </div>
        )}
      </div>

      {/* Workbench Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('CHECKLIST')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2 ${
            activeTab === 'CHECKLIST'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Research Checklist ({completedChecklistCount}/15)</span>
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2 ${
            activeTab === 'REPORTS'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Deliverable Reports ({reportVersions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('EVIDENCE')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2 ${
            activeTab === 'EVIDENCE'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          <span>Supporting Evidence ({evidenceItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('NOTES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2 ${
            activeTab === 'NOTES'
              ? 'bg-emerald-500 text-slate-950'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Discussion Notes ({assignment.notes?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Standardized 15-Point Research Checklist (Section 26) */}
      {activeTab === 'CHECKLIST' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Standardized 15-Point Research Checklist
                </h2>
                <span className="text-[11px] text-slate-500">
                  Section 26 CTI Quality Control Standard
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                {completedChecklistCount} / 15
              </span>
            </div>

            <div className="space-y-2">
              {assignment.checklistItems.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-white block">{item.title}</span>
                    {item.notApplicableReason && (
                      <span className="text-[10px] text-amber-400 block italic">
                        Reason: {item.notApplicableReason}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleUpdateChecklist(item.id, 'COMPLETED')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Done
                    </button>
                    <button
                      onClick={() => handleUpdateChecklist(item.id, 'IN_PROGRESS')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        item.status === 'IN_PROGRESS'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Mandatory explanation why this item is Not Applicable:');
                        if (reason) {
                          handleUpdateChecklist(item.id, 'NOT_APPLICABLE', reason);
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                        item.status === 'NOT_APPLICABLE'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      N/A
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm">Quality Assurance Notes</h3>
            <p className="text-slate-400 leading-relaxed">
              Every checklist item represents a verification stage required by Section 26. Items marked N/A require documented operational justification for audit defense.
            </p>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 space-y-2">
              <div className="flex items-center justify-between font-semibold">
                <span>Completed / NA:</span>
                <span className="text-emerald-400">{completedChecklistCount}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Remaining:</span>
                <span className="text-amber-400">{15 - completedChecklistCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Research Reports Deliverables (Multi-versioning & Section 31 R2 archive) */}
      {activeTab === 'REPORTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Research Deliverables & Version History
                </h2>
                <span className="text-[11px] text-slate-500">
                  Direct-to-R2 private storage with automatic version progression
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                {reportVersions.length} Versions
              </span>
            </div>

            {reportVersions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No formal report versions uploaded yet. Upload version 1 below.
              </div>
            ) : (
              <div className="space-y-3">
                {reportVersions.map((v: any) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-bold font-mono text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                          v{v.versionNumber}
                        </span>
                        <span className="font-bold text-white">{v.filename}</span>
                        <span className="text-[11px] text-slate-500">
                          ({(v.fileSize / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>Uploaded: {formatIST(v.createdAt)}</span>
                        <span className="font-mono text-slate-500">
                          SHA: {v.sha256?.substring(0, 16)}...
                        </span>
                      </div>
                      {v.reviewerComments && (
                        <p className="text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-500/30 mt-1">
                          Reviewer feedback: {v.reviewerComments}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.reviewStatus === 'APPROVED'
                          ? 'bg-emerald-500 text-slate-950'
                          : v.reviewStatus === 'CHANGES_REQUESTED'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {v.reviewStatus}
                      </span>
                      <button
                        onClick={() => handleDownloadFile(v.id)}
                        className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium inline-flex items-center gap-1.5 transition-colors"
                        title="Download authorized copy"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload New Version Box */}
          <div className="lg:col-span-4 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              Upload New Report Version
            </h3>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Directly upload PDF, DOCX, or Excel report deliverables to private Cloudflare R2 bucket.
            </p>

            <form onSubmit={handleDirectReportUpload} className="space-y-3">
              <div>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setReportFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                />
              </div>

              {reportUploadProgress && (
                <div className="p-2.5 rounded bg-slate-900 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] animate-pulse">
                  {reportUploadProgress}
                </div>
              )}

              <button
                type="submit"
                disabled={uploadingReport || !reportFile}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {uploadingReport ? 'Uploading to R2...' : `Upload Deliverable (v${reportVersions.length + 1})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 3: Supporting Evidence */}
      {activeTab === 'EVIDENCE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-emerald-400" />
                  Attached Supporting Evidence
                </h2>
                <span className="text-[11px] text-slate-500">
                  Screenshots, IOC lists, victim sheets, and raw telemetry
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                {evidenceItems.length} Artifacts
              </span>
            </div>

            {evidenceItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No supporting evidence attached to this task yet.
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceItems.map((e: any) => (
                  <div
                    key={e.id}
                    className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-emerald-400 border border-slate-800">
                          {e.category}
                        </span>
                        <span className="font-bold text-white">{e.filename}</span>
                        <span className="text-[11px] text-slate-500">
                          ({(e.fileSize / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      {e.description && (
                        <p className="text-[11px] text-slate-300">{e.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <span>SHA: {e.sha256?.substring(0, 16)}...</span>
                        <button
                          onClick={() => copyHash(e.sha256, e.id)}
                          className="hover:text-white"
                        >
                          {copiedId === e.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadFile(e.id)}
                      className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Evidence Box */}
          <div className="lg:col-span-4 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-emerald-400" />
              Attach Evidence Artifact
            </h3>

            <form onSubmit={handleDirectEvidenceUpload} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Category</label>
                <select
                  value={evidenceCategory}
                  onChange={(e) => setEvidenceCategory(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                >
                  <option value="Screenshot">Screenshot</option>
                  <option value="Victim Dataset">Victim Dataset</option>
                  <option value="Raw IOC">Raw IOC / Telemetry</option>
                  <option value="Darkweb Leak">Darkweb Leak Proof</option>
                  <option value="Binary Sample">Binary Sample</option>
                  <option value="General Research Evidence">General Research Evidence</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">File</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setEvidenceFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={evidenceDesc}
                  onChange={(e) => setEvidenceDesc(e.target.value)}
                  placeholder="Context..."
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white"
                />
              </div>

              {evidenceUploadProgress && (
                <div className="p-2.5 rounded bg-slate-900 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] animate-pulse">
                  {evidenceUploadProgress}
                </div>
              )}

              <button
                type="submit"
                disabled={uploadingEvidence || !evidenceFile}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {uploadingEvidence ? 'Archiving...' : 'Attach Evidence'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Discussion Notes */}
      {activeTab === 'NOTES' && (
        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-4 max-w-4xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Analyst & Reviewer Discussion Thread
            </h2>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Two-Way Notes</span>
          </div>

          {/* Notes List */}
          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {assignment.notes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No notes posted yet. Use this channel to coordinate research findings and questions with the reviewer.
              </div>
            ) : (
              assignment.notes.map((n: any) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-lg border text-xs space-y-1 ${
                    n.noteType === 'ADMIN_PRIVATE'
                      ? 'bg-purple-950/30 border-purple-500/30 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span>{n.author?.fullName}</span>
                      {n.noteType === 'ADMIN_PRIVATE' && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-bold border border-purple-500/40">
                          ADMIN PRIVATE
                        </span>
                      )}
                    </div>
                    <span className="font-mono">{formatIST(n.createdAt)}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{n.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Note Post Box */}
          <form onSubmit={handlePostNote} className="pt-3 border-t border-slate-800 space-y-2">
            <textarea
              rows={2}
              required
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write a research note or inquiry..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />

            <div className="flex items-center justify-between">
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 focus:outline-none"
              >
                <option value="SHARED">Shared (Analyst & Reviewer)</option>
                <option value="ADMIN_PRIVATE">Admin Only (Private Internal Note)</option>
              </select>

              <button
                type="submit"
                disabled={postingNote}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{postingNote ? 'Posting...' : 'Post Note'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
