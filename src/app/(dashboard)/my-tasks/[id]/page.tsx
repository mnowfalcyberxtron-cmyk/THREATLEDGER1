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
  Calendar as CalendarIcon,
  History,
  Mail,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';
import { WeekdayDatePicker } from '@/components/ui/WeekdayDatePicker';
import { getWorkingDayDeadlineStatus } from '@/lib/datetime/working-days';

export default function AnalystTaskWorkbench() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'EVIDENCE' | 'NOTES'>('REPORTS');

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

  // Deadline Edit Modal state
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [deadlineReason, setDeadlineReason] = useState('');
  const [updatingDeadline, setUpdatingDeadline] = useState(false);

  // Email-Based Report Staging & Submission State (Section 3, 5, 7, 9)
  const [stagedFiles, setStagedFiles] = useState<any[]>([]);
  const [stagingUpload, setStagingUpload] = useState(false);
  const [stagingProgress, setStagingProgress] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [stageFileCategory, setStageFileCategory] = useState<'REPORT' | 'EVIDENCE'>('REPORT');

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

  const handleUpdateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadlineDate) return;

    setUpdatingDeadline(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dueDate: newDeadlineDate,
          deadlineReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update deadline');
      } else {
        alert(data.message || 'Deadline updated successfully');
        setShowDeadlineModal(false);
        setDeadlineReason('');
        loadTask();
      }
    } catch {
      alert('Network error updating deadline');
    } finally {
      setUpdatingDeadline(false);
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

  const handleStageFileUpload = async (file: File, category: 'REPORT' | 'EVIDENCE') => {
    const currentTotal = stagedFiles.reduce((sum, f) => sum + f.fileSize, 0);
    const maxBytes = 18 * 1024 * 1024;
    if (currentTotal + file.size > maxBytes) {
      alert(
        `Cannot add "${file.name}": Total combined attachments would exceed the 18 MB Gmail ceiling (${((currentTotal + file.size) / (1024 * 1024)).toFixed(1)} MB).`
      );
      return;
    }

    setStagingUpload(true);
    setStagingProgress(`Staging "${file.name}" for email dispatch...`);

    try {
      const formData = new FormData();
      formData.append('assignmentId', taskId);
      formData.append('fileCategory', category);
      formData.append('file', file);

      const res = await fetch('/api/files/upload/stage', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to stage file');
      }

      setStagedFiles((prev) => [
        ...prev,
        {
          filename: data.filename,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          sha256: data.sha256,
          storagePath: data.storagePath,
          fileCategory: category,
        },
      ]);
    } catch (err: any) {
      alert(err.message || 'Failed to stage file');
    } finally {
      setStagingUpload(false);
      setStagingProgress('');
    }
  };

  const handleRemoveStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReportForReview = async () => {
    if (stagedFiles.length === 0) {
      alert('Please upload and stage at least one final report document before submitting for review.');
      setActiveTab('REPORTS');
      return;
    }

    const hasReport = stagedFiles.some((f) => f.fileCategory === 'REPORT');
    if (!hasReport) {
      alert('A primary report document (PDF, Word, or Spreadsheet) is required in the staged package.');
      setActiveTab('REPORTS');
      return;
    }

    const confirmSubmit = confirm(
      `Submit report package with ${stagedFiles.length} file(s) for independent review?\n\nThis will send an email with physical attachments to your assigned reviewer and archive the message in the ThreatLedger sender Gmail Sent folder.`
    );
    if (!confirmSubmit) return;

    setSubmittingReport(true);
    try {
      const res = await fetch(`/api/assignments/${taskId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagedFiles,
          submissionNotes: submissionNotes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Submission failed');
      } else {
        alert(data.message);
        setStagedFiles([]);
        setSubmissionNotes('');
        loadTask();
      }
    } catch {
      alert('Network failure submitting report package');
    } finally {
      setSubmittingReport(false);
    }
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
                  if (stagedFiles.length === 0) {
                    setActiveTab('REPORTS');
                    alert('Please stage your report document and supporting evidence in the Deliverables tab before submitting.');
                    return;
                  }
                  handleSubmitReportForReview();
                }}
                disabled={transitioning || submittingReport}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {submittingReport ? 'Dispatching to Gmail...' : 'Submit for Review'}
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
              {(() => {
                const status = getWorkingDayDeadlineStatus(assignment.dueDate);
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">
                      Due: <strong className="text-white font-mono">{status.dueDateFormatted}</strong>
                    </span>
                    {assignment.dueDate && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        status.badgeVariant === 'rose'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          : status.badgeVariant === 'amber'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : status.badgeVariant === 'emerald'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'text-slate-500'
                      }`}>
                        {status.label}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewDeadlineDate(assignment.dueDate ? assignment.dueDate.split('T')[0] : '');
                        setShowDeadlineModal(true);
                      }}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium ml-1"
                    >
                      Modify Schedule
                    </button>
                  </div>
                );
              })()}
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

      {/* Tab 1: Research Reports Deliverables & Gmail Document Archive */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-6">
          {/* Destination & Recipient Verification Banner */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Designated Reviewer Destination
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white font-bold text-xs">
                  {assignment.recipientOverrideEmail || assignment.reviewer?.user?.email || 'reviewer@threatledger.internal'}
                </span>
                {assignment.recipientOverrideEmail ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                    Administrator Override Active
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                    Assigned Peer Reviewer
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-slate-400 sm:text-right">
              <span className="text-slate-500 block">Archive Destination</span>
              <span className="font-semibold text-white">Gmail Sent Folder (Real MIME Attachments)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Email Document Archive & Submission History */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    Email Document Archive & Submissions
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    Original submitted documents are retained in the sender Gmail Sent folder
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                  {assignment.reportSubmissions?.length || 0} Submissions
                </span>
              </div>

              {(!assignment.reportSubmissions || assignment.reportSubmissions.length === 0) ? (
                <div className="py-12 text-center text-xs text-slate-500 rounded-xl bg-slate-900/40 border border-slate-800/80 p-6 space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-white font-semibold">No report submissions recorded yet.</p>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    Stage your final research report and supporting evidence on the right, then submit for review.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignment.reportSubmissions.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                            Version v{sub.versionNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.emailStatus === 'ACCEPTED_BY_GMAIL'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : sub.emailStatus === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {sub.emailStatus}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                            Temporary: {sub.cleanupStatus}
                          </span>
                        </div>

                        <a
                          href={`https://mail.google.com/mail/u/0/#search/subject%3A${encodeURIComponent(sub.emailSubject)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                        >
                          <span>Open Gmail Archive</span>
                          <ExternalLink className="w-3 h-3 text-emerald-400" />
                        </a>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                        <div>
                          <span className="text-slate-500 block">Submitted At:</span>
                          <span className="text-white font-medium">{formatIST(sub.submittedAt)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Recipient:</span>
                          <span className="text-white font-mono">{sub.recipientEmail}</span>
                        </div>
                        {sub.emailMessageId && (
                          <div className="sm:col-span-2">
                            <span className="text-slate-500 block">SMTP Message-ID:</span>
                            <span className="text-emerald-400 font-mono text-[10px] break-all">{sub.emailMessageId}</span>
                          </div>
                        )}
                      </div>

                      {/* Attachment Manifest */}
                      <div className="pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                          Archived Attachment Manifest ({sub.attachments?.length || 0} Files • {((sub.totalAttachmentBytes || 0) / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                        <div className="space-y-1.5">
                          {sub.attachments?.map((att: any) => (
                            <div
                              key={att.id}
                              className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-white block truncate">{att.filename}</span>
                                <span className="font-mono text-[9px] text-slate-500 truncate block">
                                  SHA-256: {att.sha256}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] text-slate-400 block">
                                  {(att.fileSize / 1024).toFixed(1)} KB
                                </span>
                                <span className="text-[9px] text-emerald-400 font-mono">Real Attachment</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Explanatory Archival Notice */}
                      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                        <strong className="text-slate-300">Archive Retention Notice:</strong> Original submitted documents are retained in the ThreatLedger sender Gmail account&apos;s Sent folder. Temporary upload files have been purged from platform staging.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy Historical Records (if any old R2 files exist) */}
              {reportVersions.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Legacy Pre-Gmail File Records ({reportVersions.length})
                  </span>
                  <div className="space-y-2">
                    {reportVersions.map((v: any) => (
                      <div key={v.id} className="p-2.5 rounded bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-semibold text-white">v{v.versionNumber} — {v.filename}</span>
                          <span className="text-slate-500 text-[10px] block">Uploaded {formatIST(v.createdAt)}</span>
                        </div>
                        <button
                          onClick={() => handleDownloadFile(v.id)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-medium inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3 text-emerald-400" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Stage New Report & Supporting Evidence for Review */}
            <div className="lg:col-span-5 p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-5 text-xs">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  Stage Deliverables for Independent Review
                </h3>
                <p className="text-slate-400 leading-relaxed text-[11px] mt-1">
                  Upload your research report and supporting evidence. Files will be temporarily staged and dispatched as real email attachments to the reviewer.
                </p>
              </div>

              {/* Combined Attachment Size Meter (Max 18 MB) */}
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-300">Combined Email Attachment Payload:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(stagedFiles.reduce((sum, f) => sum + f.fileSize, 0) / (1024 * 1024)).toFixed(2)} MB / 18.0 MB
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all ${
                      stagedFiles.reduce((sum, f) => sum + f.fileSize, 0) > 18 * 1024 * 1024
                        ? 'bg-rose-500'
                        : stagedFiles.reduce((sum, f) => sum + f.fileSize, 0) > 14 * 1024 * 1024
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (stagedFiles.reduce((sum, f) => sum + f.fileSize, 0) / (18 * 1024 * 1024)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">
                  Strictly enforced: Google Drive links and temporary signed URLs are prohibited.
                </span>
              </div>

              {/* Upload Input */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-[11px]">Add Document to Staging</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStageFileCategory('REPORT')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stageFileCategory === 'REPORT'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Report Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setStageFileCategory('EVIDENCE')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stageFileCategory === 'EVIDENCE'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Evidence
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  disabled={stagingUpload}
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.log,.json,.xml,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleStageFileUpload(e.target.files[0], stageFileCategory);
                      e.target.value = '';
                    }
                  }}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                />

                {stagingProgress && (
                  <div className="p-2 rounded bg-slate-950 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] animate-pulse">
                    {stagingProgress}
                  </div>
                )}
              </div>

              {/* Staged Files Manifest Box */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-300 text-[11px] block">
                  Staged Files for Next Submission ({stagedFiles.length})
                </span>

                {stagedFiles.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80 text-center text-[11px] text-slate-500">
                    No files staged yet. Add primary report and supporting files above.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {stagedFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-semibold text-white block truncate">{f.filename}</span>
                          <span className="text-[10px] text-slate-400">
                            {f.fileCategory} • {(f.fileSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStagedFile(idx)}
                          className="text-rose-400 hover:text-rose-300 text-xs px-1.5 py-0.5 rounded hover:bg-rose-950/40"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1 text-[11px]">
                  Submission Notes for Reviewer (Optional)
                </label>
                <textarea
                  rows={2}
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Key research findings, indicators of compromise, or methodology summary..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              {/* Submit for Review Action Button */}
              <button
                type="button"
                onClick={handleSubmitReportForReview}
                disabled={submittingReport || stagedFiles.length === 0}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submittingReport ? 'Dispatching to Gmail...' : `Submit for Review (v${(assignment.reportSubmissions?.[0]?.versionNumber || 0) + 1})`}
                </span>
              </button>
            </div>
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

      {/* Deadline Modification History Card (Section 9) */}
      {assignment.deadlineHistory && assignment.deadlineHistory.length > 0 && (
        <div className="p-5 rounded-xl bg-[#0a101f] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Assignment Deadline Modification History (Section 9 Compliance)</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              Version {assignment.deadlineVersion}
            </span>
          </div>

          <div className="space-y-2">
            {assignment.deadlineHistory.map((h: any) => (
              <div
                key={h.id}
                className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Previous:</span>
                    <span className="text-slate-300 font-mono line-through">
                      {h.oldDueDate ? formatIST(h.oldDueDate) : 'None'}
                    </span>
                    <span className="text-emerald-400 font-bold">➔</span>
                    <span className="text-emerald-300 font-mono font-bold">
                      {h.newDueDate ? formatIST(h.newDueDate) : 'Cleared'}
                    </span>
                  </div>
                  {h.reason && (
                    <p className="text-[11px] text-slate-400 italic">
                      Reason: "{h.reason}"
                    </p>
                  )}
                </div>

                <div className="text-right text-[10px] text-slate-500 shrink-0">
                  <span className="block text-slate-300 font-medium">{h.changedBy?.fullName}</span>
                  <span className="font-mono">{formatIST(h.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadline Edit Modal */}
      {showDeadlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-[#0a101f] border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                <span>Modify Working-Day Deadline</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeadlineModal(false)}
                disabled={updatingDeadline}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateDeadline} className="space-y-4 text-xs">
              <WeekdayDatePicker
                value={newDeadlineDate}
                onChange={setNewDeadlineDate}
                label="New Working-Day Deadline (IST)"
                required
              />

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Reason for Deadline Change *
                </label>
                <textarea
                  rows={3}
                  required
                  value={deadlineReason}
                  onChange={(e) => setDeadlineReason(e.target.value)}
                  placeholder="Operational justification for deadline modification or extension..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              <div className="p-3 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                Modifying the deadline automatically invalidates pending reminder dispatches and generates a new working-day reminder schedule.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeadlineModal(false)}
                  disabled={updatingDeadline}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingDeadline || !newDeadlineDate}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {updatingDeadline ? 'Updating...' : 'Save Working-Day Deadline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
