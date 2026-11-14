'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThreatLedgerLogo } from '@/components/brand/ThreatLedgerLogo';
import { UserRole } from '@prisma/client';
import {
  LayoutDashboard,
  Radio,
  Sparkles,
  Database,
  Users,
  Briefcase,
  CheckSquare,
  Users2,
  ClipboardCheck,
  FolderArchive,
  Bell,
  BarChart3,
  GitBranch,
  History,
  FileText,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  userRole?: UserRole;
  userFullName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole?: UserRole;
  badge?: string;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Ransomware Monitoring', href: '/monitoring', icon: Radio },
  { title: 'Newly Detected Groups', href: '/newly-detected', icon: Sparkles },
  { title: 'Group Intelligence', href: '/groups', icon: Database },
  { title: 'Victim Monitoring', href: '/victims', icon: Users },
  { title: 'Assignments', href: '/assignments', icon: Briefcase, minRole: UserRole.ADMIN },
  { title: 'My Tasks', href: '/my-tasks', icon: CheckSquare },
  { title: 'Team Management', href: '/team', icon: Users2, minRole: UserRole.ADMIN },
  { title: 'Review Queue', href: '/review-queue', icon: ClipboardCheck, minRole: UserRole.ADMIN },
  { title: 'Supporting Evidence', href: '/evidence', icon: FolderArchive },
  { title: 'Notifications', href: '/notifications', icon: Bell },
  { title: 'Reports & Analytics', href: '/analytics', icon: BarChart3 },
  { title: 'Source Monitor', href: '/source-monitor', icon: GitBranch },
  { title: 'Synchronization History', href: '/sync-history', icon: History, minRole: UserRole.ADMIN },
  { title: 'Audit Logs', href: '/audit-logs', icon: FileText, minRole: UserRole.ADMIN },
  { title: 'Admin Settings', href: '/settings', icon: Settings, minRole: UserRole.ADMIN },
];

export function Sidebar({ userRole = UserRole.ANALYST, userFullName, userEmail, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const roleWeights: Record<UserRole, number> = {
    ANALYST: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  const userWeight = roleWeights[userRole] || 1;

  const visibleNav = navItems.filter((item) => {
    if (!item.minRole) return true;
    return userWeight >= roleWeights[item.minRole];
  });

  return (
    <aside className="w-64 shrink-0 bg-[#070b14] border-r border-slate-800/80 flex flex-col h-screen select-none">
      {/* Brand Header with Official Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800/80 bg-[#090f1d]/50">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <ThreatLedgerLogo variant="sidebar" animated />
          <div className="flex flex-col">
            <span className="font-extrabold text-white text-sm tracking-tight leading-none group-hover:text-emerald-400 transition-colors">
              Threat<span className="text-emerald-400">Ledger</span>
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase mt-0.5">
              CTI Operations
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          CTI Operations
        </div>

        {visibleNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.title}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User Session Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#090f1d]/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
              {userFullName?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userFullName || 'Analyst'}</p>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <Shield className="w-3 h-3" />
                  {userRole}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign out of ThreatLedger"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
