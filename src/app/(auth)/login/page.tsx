'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThreatLedgerLogo } from '@/components/brand/ThreatLedgerLogo';
import { Eye, EyeOff, ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if initial setup is needed
  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/auth/setup');
        const data = await res.json();
        if (data.isInitialized === false) {
          router.replace('/setup');
          return;
        }
      } catch (err) {
        console.error('Failed to check setup state', err);
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetup();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Authentication failed. Please verify credentials.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setErrorMessage('Network connection error. Please try again.');
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center p-6 text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <ThreatLedgerLogo variant="loading" animated />
          <span className="text-sm font-medium tracking-wide animate-pulse">Initializing ThreatLedger Gateway...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#060a12] text-slate-100">
      {/* Left Brand Hero Showcase (Desktop Split Screen) */}
      <div className="relative flex-1 hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#0b1329] via-[#070d1c] to-[#04070e] border-r border-slate-800/80 overflow-hidden">
        {/* Subtle background cyber grid */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #10b981 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Ambient Top Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Enterprise Operations Platform
          </div>
        </div>

        {/* Centerpiece Animated Brand Visual */}
        <div className="relative z-10 my-auto flex flex-col items-start max-w-lg">
          <ThreatLedgerLogo variant="login" animated />
          <h1 className="text-4xl font-extrabold tracking-tight mt-6 text-white leading-tight">
            Threat<span className="text-emerald-400">Ledger</span>
          </h1>
          <p className="text-slate-300 text-base font-normal mt-3 leading-relaxed">
            Centralized intelligence, evidence, assignments and historical records.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3.5 w-full text-xs text-slate-300">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Real-time ransomware syndicate baseline tracking</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Strict submission vs reviewer approval governance</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <Lock className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Private R2 object storage with physical email attachment dispatch</span>
            </div>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-6">
          <span>ThreatLedger v1.0.0 Enterprise</span>
          <span>Asia/Kolkata (IST) Standard Time</span>
        </div>
      </div>

      {/* Right Login Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Brand Banner */}
          <div className="lg:hidden flex flex-col items-center text-center">
            <ThreatLedgerLogo variant="loading" animated />
            <h2 className="text-2xl font-bold mt-4 text-white">
              Threat<span className="text-emerald-400">Ledger</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Centralized intelligence, evidence, assignments and historical records
            </p>
          </div>

          <div className="text-left hidden lg:block">
            <h2 className="text-2xl font-bold tracking-tight text-white">Analyst Sign In</h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter your credentials to access the intelligence operations workspace.
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@threatledger.local"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span>Remember session for 7 days</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Verifying Credentials...
                </span>
              ) : (
                <>
                  <span>Sign In to ThreatLedger</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              ThreatLedger is a private internal intelligence operations platform. Self-registration is disabled. Access is by administrator invitation only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
