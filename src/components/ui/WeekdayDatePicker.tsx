'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, AlertCircle, Check, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import {
  isWeekendInIST,
  validateWorkingDayDeadline,
  getISTCalendarParts,
} from '@/lib/datetime/working-days';

interface WeekdayDatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string; // YYYY-MM-DD
  className?: string;
  id?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekdayDatePicker({
  value,
  onChange,
  label = 'Assignment Deadline',
  required = false,
  disabled = false,
  minDate,
  className = '',
  id = 'weekday-date-picker',
}: WeekdayDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [manualInput, setManualInput] = useState(value || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar view navigation (viewYear, viewMonth 0-11)
  const initialParts = value ? getISTCalendarParts(value) : getISTCalendarParts(new Date());
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month - 1);

  useEffect(() => {
    setManualInput(value || '');
    if (value) {
      const check = validateWorkingDayDeadline(value);
      if (!check.valid) {
        setErrorMsg(check.error || 'Weekends are prohibited.');
      } else {
        setErrorMsg(null);
      }
    } else {
      setErrorMsg(null);
    }
  }, [value]);

  // Close calendar on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    const check = validateWorkingDayDeadline(dateStr);
    if (!check.valid) {
      setErrorMsg(check.error || 'Weekends are disabled.');
      return;
    }
    setErrorMsg(null);
    setManualInput(dateStr);
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleManualBlur = () => {
    if (!manualInput.trim()) {
      if (!required) {
        onChange('');
        setErrorMsg(null);
      }
      return;
    }

    const check = validateWorkingDayDeadline(manualInput.trim());
    if (!check.valid) {
      setErrorMsg(check.error || 'Invalid date: Saturday and Sunday are non-working days.');
    } else {
      setErrorMsg(null);
      onChange(check.dateString!);
    }
  };

  // Generate calendar grid days
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun, 6 = Sat

  const days: Array<{ day: number; dateStr: string; isWeekend: boolean; isPast: boolean; isSelected: boolean }> = [];
  const todayStr = getISTCalendarParts(new Date()).dateString;

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${viewYear}-${mm}-${dd}`;
    const dayOfWeek = new Date(viewYear, viewMonth, d).getDay();
    const isWknd = dayOfWeek === 0 || dayOfWeek === 6;
    const isPast = minDate ? dateStr < minDate : dateStr < todayStr;
    const isSelected = dateStr === value;

    days.push({ day: d, dateStr, isWeekend: isWknd, isPast, isSelected });
  }

  return (
    <div ref={containerRef} className={`space-y-1 relative ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-xs font-semibold text-slate-300">
            {label} {required && <span className="text-rose-400">*</span>}
          </label>
          <span className="text-[10px] text-emerald-400 font-medium">Monday–Friday Only</span>
        </div>
      )}

      {/* Input container */}
      <div className="relative">
        <input
          id={id}
          type="text"
          value={manualInput}
          disabled={disabled}
          onChange={(e) => setManualInput(e.target.value)}
          onBlur={handleManualBlur}
          placeholder="YYYY-MM-DD"
          aria-invalid={Boolean(errorMsg)}
          aria-describedby={`${id}-desc`}
          className={`w-full pl-3 pr-10 py-2 bg-slate-900 border rounded-lg text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
            errorMsg
              ? 'border-rose-500 focus:ring-rose-500/40 text-rose-300'
              : 'border-slate-800 focus:ring-emerald-500/40 focus:border-emerald-500'
          }`}
        />

        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded"
          title="Toggle working-day date picker"
          aria-label="Open working-day calendar"
        >
          <CalendarIcon className="w-4 h-4 text-emerald-400" />
        </button>
      </div>

      {/* Working day explanation caption */}
      <div id={`${id}-desc`} className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
        <Info className="w-3 h-3 text-slate-400 shrink-0" />
        <span>Saturdays and Sundays are non-working days and cannot be selected.</span>
      </div>

      {/* Validation Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          className="p-2 rounded bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-300 flex items-start gap-1.5"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Dropdown Calendar Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-[#0c1427] border border-slate-800 rounded-xl shadow-2xl p-3 animate-in fade-in duration-150">
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60">
            {WEEKDAY_HEADERS.map((wh, idx) => (
              <span key={wh} className={idx === 0 || idx === 6 ? 'text-slate-600' : 'text-slate-300'}>
                {wh}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7 w-7" />
            ))}

            {days.map((item) => {
              if (item.isWeekend) {
                return (
                  <div
                    key={item.dateStr}
                    title="Weekend: Non-working day (disabled)"
                    aria-disabled="true"
                    className="h-7 w-7 flex items-center justify-center rounded text-[11px] font-mono text-slate-600 bg-slate-900/40 cursor-not-allowed select-none line-through"
                  >
                    {item.day}
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  key={item.dateStr}
                  onClick={() => handleSelectDate(item.dateStr)}
                  className={`h-7 w-7 flex items-center justify-center rounded text-[11px] font-mono font-medium transition-colors ${
                    item.isSelected
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                  aria-label={`${item.dateStr}, working day`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Footer Notice */}
          <div className="pt-2 mt-2 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
            Valid until 11:59 PM IST
          </div>
        </div>
      )}
    </div>
  );
}
