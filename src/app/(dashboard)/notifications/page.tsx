'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Trash2,
  ExternalLink,
  Briefcase,
  FileText,
  ShieldCheck,
  Radio,
  MessageSquare,
  Clock,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatIST } from '@/lib/utils';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterUnread, setFilterUnread] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?unreadOnly=${filterUnread}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      console.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [filterUnread]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      loadNotifications();
    } catch {
      alert('Error marking notifications as read');
    }
  };

  const handleMarkOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      loadNotifications();
    } catch {
      console.error('Error marking read');
    }
  };

  const handleClearRead = async () => {
    if (!confirm('Clear all read notifications?')) return;
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
      loadNotifications();
    } catch {
      alert('Error clearing read notifications');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ASSIGNMENT':
        return <Briefcase className="w-4 h-4 text-emerald-400" />;
      case 'SUBMISSION':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'REVIEW':
        return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      case 'DISCOVERY':
        return <Radio className="w-4 h-4 text-purple-400" />;
      case 'NOTE':
        return <MessageSquare className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Bell className="w-4 h-4" />
            CTI Operational Dispatch Center
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Notifications</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time operational alerts for task allocations, review requests, verdicts, and intelligence updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={handleClearRead}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear read</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterUnread(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            !filterUnread
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All Dispatches
        </button>

        <button
          onClick={() => setFilterUnread(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5 ${
            filterUnread
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <span>Unread Only</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-500">
          <span className="animate-pulse">Loading operational notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-[#0a101f] border border-slate-800 space-y-3">
          <Bell className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-white font-bold text-sm">No notifications</p>
          <p className="text-xs text-slate-500">
            {filterUnread
              ? 'You have caught up with all operational alerts.'
              : 'No operational dispatch history recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.link) {
                  router.push(item.link);
                }
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                !item.isRead
                  ? 'bg-[#0c1427] border-emerald-500/40 shadow-sm'
                  : 'bg-[#0a101f] border-slate-800/80 hover:border-slate-700 opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                  {getTypeIcon(item.type)}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-white truncate">{item.title}</h3>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatIST(item.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!item.isRead && (
                  <button
                    onClick={(e) => handleMarkOneRead(item.id, e)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] font-medium"
                    title="Mark as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                )}
                {item.link && (
                  <span className="p-1.5 text-slate-500 hover:text-white">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
