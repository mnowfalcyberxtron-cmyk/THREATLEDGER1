'use client';

import React from 'react';
import { Bell, Clock, ShieldCheck, RefreshCw, User } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  userFullName?: string;
  userRole?: string;
  onSyncNow?: () => void;
  syncing?: boolean;
}

export function Header({ userFullName, userRole, onSyncNow, syncing = false }: HeaderProps) {
  // Format current time in Asia/Kolkata
  const [istTime, setIstTime] = React.useState('');
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    function updateClock() {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      setIstTime(formatted);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    async function checkUnread() {
      try {
        const res = await fetch('/api/notifications?limit=1');
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // quiet fallback
      }
    }
    checkUnread();
    const poll = setInterval(checkUnread, 30000);
    return () => clearInterval(poll);
  }, []);

  return (
    <header className="h-16 px-6 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Operational Status / Timezone */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Clock className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono">{istTime || '--:--:--'}</span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase">IST (Asia/Kolkata)</span>
        </div>

        {/* Live Source Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-[11px]">Ransomware.live API PRO Active</span>
        </div>
      </div>

      {/* Right: Actions & User Meta */}
      <div className="flex items-center gap-3">
        {onSyncNow && (
          <button
            onClick={onSyncNow}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        )}

        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          title="Notification Center"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-slate-950">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-white leading-tight">{userFullName || 'Analyst'}</span>
            <span className="text-[10px] text-slate-400 uppercase font-medium">{userRole || 'ANALYST'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
