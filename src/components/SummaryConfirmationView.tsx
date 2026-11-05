import React, { useState } from 'react';
import {
  CheckCircle2,
  Calendar,
  BookOpen,
  AlertTriangle,
  Download,
  Share2,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Award,
  ShieldCheck,
  Check,
  Clock,
  MapPin
} from 'lucide-react';
import { AdvisorSlot, StudentProfile, Semester, SURVEY_DATA_HIGHLIGHTS } from '../data/sampleData';

interface SummaryConfirmationViewProps {
  profile: StudentProfile;
  bookedSlot?: AdvisorSlot | null;
  format?: string;
  notes?: string;
  roadmap: Semester[];
  onBackToScheduling: () => void;
  onRestartWalkthrough: () => void;
  onReturnToDashboard: () => void;
}

export const SummaryConfirmationView: React.FC<SummaryConfirmationViewProps> = ({
  profile,
  bookedSlot,
  format = 'In-Person',
  notes,
  roadmap,
  onBackToScheduling,
  onRestartWalkthrough,
  onReturnToDashboard
}) => {
  const nextTerm = roadmap.find((s) => s.status === 'planned' && s.courses.length > 0);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const slot = bookedSlot || {
    id: 'slot-1',
    day: 'Wednesday',
    date: 'Oct 14, 2026',
    time: '1:30 PM - 2:00 PM',
    advisorAvailable: true,
    studentFree: true,
    mutualMatch: true,
    formatOptions: ['In-Person', 'Zoom Virtual']
  };

  const handleDownload = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Screen 5 Core Stepper Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBackToScheduling}
            className="flex items-center space-x-1.5 text-xs text-gray-700 hover:text-black font-semibold bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Mutual Scheduling</span>
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Screen 5 of 5:</span>
          <span className="text-sm font-bold text-gray-900">Action Plan & BuckeyeLink Sync Confirmation</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Prototype: sample data</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onReturnToDashboard}
            className="flex items-center space-x-1.5 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-4 py-2 rounded-md transition-all shadow-xs"
          >
            <span>Return to BuckeyeLink Home</span>
          </button>
          <button
            onClick={onRestartWalkthrough}
            className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-md transition-all"
            title="Restart the 5-screen flow"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Flow</span>
          </button>
        </div>
      </div>

      {/* Hero Success Card */}
      <div className="bg-white border border-emerald-200 rounded-xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Appointment Booked
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Prototype: sample data
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                Advising Session Confirmed & 4-Year Plan Synced!
              </h1>
              <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                Your mutual appointment with <strong>{profile.advisorName}</strong> has been logged into OnCourse and BuckeyeLink. Your 4-year degree roadmap has been saved to your BuckAI profile.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1.5 bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-colors"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Plan Saved (PDF)!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Advising Summary</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Details: Appointment & Roadmap Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confirmed Appointment Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="font-bold text-base text-gray-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#ba0c2f]" />
              <span>Confirmed Mutual Advising Appointment</span>
            </h2>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              OnCourse Confirmed
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2.5 text-xs text-gray-700">
            <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
              <span className="text-gray-500 font-medium">Advisor:</span>
              <span className="font-bold text-gray-900">{profile.advisorName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
              <span className="text-gray-500 font-medium">Date & Time:</span>
              <span className="font-bold text-gray-900">{slot.day}, {slot.date} ({slot.time})</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
              <span className="text-gray-500 font-medium">Format:</span>
              <span className="font-bold text-gray-900">{format} ({profile.advisorOffice})</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-gray-200/60">
              <span className="text-gray-500 font-medium">Holds:</span>
              <span className="font-bold text-gray-900">{profile.holds.length ? profile.holds.join(', ') : 'None reported'}</span>
            </div>
            <div className="pt-1">
              <span className="text-gray-500 font-medium block mb-1">Pre-Brief Notes Attached:</span>
              <p className="text-[11px] bg-white p-2.5 rounded border border-gray-200 italic text-gray-600">
                &ldquo;{notes || 'Review my 4-year roadmap and next term’s classes.'}&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* Next planned term from the student's roadmap */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="font-bold text-base text-gray-900 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#ba0c2f]" />
              <span>{nextTerm ? `${nextTerm.name} Planned Classes` : 'Next Term Plan'}</span>
            </h2>
            {nextTerm && (
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                {nextTerm.workloadRating}: {nextTerm.totalCredits} Credits
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs">
            {!nextTerm && (
              <div className="p-2.5 bg-gray-50 rounded border border-gray-100 text-gray-600">
                No planned classes yet. Ask BuckAI to build your roadmap, or add them under My classes.
              </div>
            )}
            {nextTerm?.courses.map((c) => (
              <div key={c.code} className="p-2.5 bg-gray-50 rounded border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900">{c.code}</span>
                  <span className="text-gray-600 ml-2">{c.name !== c.code ? `${c.name} ` : ''}({c.credits} cr)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Student Survey Validation Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Survey Alignment: How This Prototype Solves OSU Student Pain Points
            </h2>
            <p className="text-xs text-gray-500">
              Validated against data from {SURVEY_DATA_HIGHLIGHTS.sampleSize} ({SURVEY_DATA_HIGHLIGHTS.sourceUrl})
            </p>
          </div>
          <span className="text-xs bg-red-50 text-[#ba0c2f] font-bold px-3 py-1 rounded-full border border-red-200 self-start sm:self-auto">
            100% Student Priority Coverage
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {SURVEY_DATA_HIGHLIGHTS.metrics.map((m, idx) => (
            <div key={idx} className="bg-gray-50 p-3.5 rounded-lg border border-gray-200 space-y-1">
              <div className="text-xl font-black text-[#ba0c2f]">{m.stat}</div>
              <div className="text-xs font-bold text-gray-900 leading-tight">{m.label}</div>
              <p className="text-[11px] text-gray-600 leading-normal">{m.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
