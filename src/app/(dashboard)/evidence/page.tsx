'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Search,
  Filter,
  Download,
  UploadCloud,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  Shield,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { formatIST } from '@/lib/utils';

const CATEGORIES = [
  'ALL',
  'Victim Dataset',
  'Screenshot',
  'Network Graph',
  'Raw IOC',
  'Darkweb Leak',
  'Binary Sample',
  'General Research Evidence',
];

export default function EvidencePage() {
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Screenshot');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  async function loadEvidence() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'ALL') params.set('category', category);
      if (search.trim()) params.set('q', search.trim());

      const res = await fetch(`/api/evidence?${params.toString()}`);
      const data = await res.json();
      setEvidenceList(data.items || []);
      setTotal(data.total || 0);
    } catch {
      console.error('Failed to load supporting evidence');
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments() {
    try {
      const res = await fetch('/api/assignments');
      const data = await res.json();
      setAssignments(data.assignments || []);
      if (data.assignments?.length > 0) {
        setSelectedAssignmentId(data.assignments[0].id);
      }
    } catch {
      console.error('Failed to load assignments');
    }
  }

  useEffect(() => {
    loadEvidence();
  }, [category]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvidence();
  };

  const copyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (fileId: string) => {
    try {
      const res = await fetch(`/api/files/download/${fileId}`);
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        alert(data.error || 'Failed to generate download URL');
      }
    } catch {
      alert('Network error downloading evidence');
    }
  };

  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedAssignmentId) {
      alert('Please select both a file and a target assignment.');
      return;
    }

    setUploading(true);
    setUploadProgress('1/3: Requesting signed direct upload session...');

    try {
      // 1. Request presigned PUT URL
      const presignRes = await fetch('/api/files/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: selectedAssignmentId,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
          fileCategory: 'EVIDENCE',
          evidenceCategory: uploadCategory,
          evidenceDescription: uploadDescription || undefined,
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.error || 'Failed to acquire upload authorization');
      }

      // 2. Direct binary PUT upload to R2
      setUploadProgress('2/3: Streaming bytes directly to private R2 storage...');
      const putRes = await fetch(presignData.presignedUploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': selectedFile.type || 'application/octet-stream',
        },
        body: selectedFile,
      });

      if (!putRes.ok && putRes.status !== 0) {
        throw new Error('Direct upload to R2 storage failed');
      }

      // 3. Verify upload & persist database record
      setUploadProgress('3/3: Verifying object signature and recording metadata...');
      const verifyRes = await fetch('/api/files/upload/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: selectedAssignmentId,
          objectKey: presignData.objectKey,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || 'application/octet-stream',
          fileCategory: 'EVIDENCE',
          evidenceCategory: uploadCategory,
          evidenceDescription: uploadDescription || undefined,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Failed to verify uploaded object');
      }

      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadDescription('');
      loadEvidence();
      alert('Supporting evidence securely archived in private R2 repository.');
    } catch (err: any) {
      alert(err.message || 'Upload process failed');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case 'Screenshot':
        return <ImageIcon className="w-5 h-5 text-indigo-400" />;
      case 'Victim Dataset':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'Raw IOC':
      case 'Binary Sample':
        return <FileCode className="w-5 h-5 text-amber-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <FolderArchive className="w-4 h-4" />
            Private Research Storage
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Supporting Evidence Archive</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Dedicated private repository for screenshots, victim datasets, raw network IOCs, and analyst telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadAssignments();
              setShowUploadModal(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Evidence</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file, hash, syndicate..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#0a101f] border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </form>
      </div>

      {/* Evidence Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-500">
          <span className="animate-pulse">Loading supporting evidence archive...</span>
        </div>
      ) : evidenceList.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-[#0a101f] border border-slate-800 space-y-3">
          <FolderArchive className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-white font-bold text-sm">No evidence files found</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Supporting evidence uploaded during analyst research or syndicate tracking will appear here with strict access control.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {evidenceList.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#0a101f] border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                      {getFileIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-white truncate" title={item.filename}>
                        {item.filename}
                      </h3>
                      <span className="text-[10px] text-slate-500 block">
                        {(item.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-emerald-400 shrink-0">
                    {item.category}
                  </span>
                </div>

                {item.description && (
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {item.assignment && (
                  <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Syndicate:</span>
                      <Link
                        href={`/groups/${item.assignment.group.id}`}
                        className="text-emerald-400 font-semibold hover:underline"
                      >
                        {item.assignment.group.name}
                      </Link>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 truncate">
                      <span>Task:</span>
                      <Link
                        href={`/my-tasks/${item.assignment.id}`}
                        className="text-slate-200 truncate hover:text-white"
                        title={item.assignment.title}
                      >
                        {item.assignment.title}
                      </Link>
                    </div>
                  </div>
                )}

                {/* SHA-256 Fingerprint */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                  <span className="truncate max-w-[200px]" title={item.sha256}>
                    SHA: {item.sha256.substring(0, 16)}...
                  </span>
                  <button
                    onClick={() => copyHash(item.sha256, item.id)}
                    className="text-slate-400 hover:text-white inline-flex items-center gap-1"
                    title="Copy SHA-256"
                  >
                    {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <Calendar className="w-3 h-3" />
                  {formatIST(item.createdAt)}
                </span>

                <button
                  onClick={() => handleDownload(item.id)}
                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[11px] inline-flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-[#0a101f] border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <UploadCloud className="w-4 h-4 text-emerald-400" />
                Upload Supporting Evidence
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                disabled={uploading}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDirectUpload} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Target Research Assignment *</label>
                <select
                  required
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.group?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Evidence Category *</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="Screenshot">Screenshot</option>
                  <option value="Victim Dataset">Victim Dataset</option>
                  <option value="Raw IOC">Raw IOC / Telemetry</option>
                  <option value="Network Graph">Network Graph</option>
                  <option value="Darkweb Leak">Darkweb Leak Proof</option>
                  <option value="Binary Sample">Binary Sample / Hashes</option>
                  <option value="General Research Evidence">General Research Evidence</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">File Artifact *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-slate-400 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Permitted formats: Images, PCAP, CSV, JSON, PDF, TXT, ZIP. Direct browser-to-R2 upload up to 100MB.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description / Notes</label>
                <textarea
                  rows={3}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Context regarding source, acquisition, or relevant victim..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>

              {uploadProgress && (
                <div className="p-3 rounded bg-slate-900 border border-emerald-500/30 text-emerald-400 font-mono text-[11px] animate-pulse">
                  {uploadProgress}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  {uploading ? 'Archiving...' : 'Upload Directly to R2'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
