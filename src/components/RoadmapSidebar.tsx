import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Flame,
  Award,
  Clock
} from 'lucide-react';
import { Semester, StudentProfile, INITIAL_ROADMAP } from '../data/sampleData';

interface RoadmapSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  roadmap: Semester[];
  onUpdateRoadmap: (promptText: string) => Promise<void>;
  isUpdating: boolean;
  profile: StudentProfile;
  isFullScreenMode?: boolean;
  onBackToChat?: () => void;
  onNextToScheduling?: () => void;
  lastAdjustmentSummary?: string | null;
  lastCitation?: string | null;
  lastConfidence?: string | null;
}

const ROADMAP_PROMPT_PRESETS = [
  'Add Summer 2028 Wall Street internship and balance Year 3',
  'Lighten Spring 2027 to 13 credits to focus on CSE 2231',
  'Ensure no two difficult quant courses (diff >= 4) in the same term',
  'Swap GE Theme elective to an online asynchronous course'
];

export const RoadmapSidebar: React.FC<RoadmapSidebarProps> = ({
  isOpen,
  onClose,
  roadmap,
  onUpdateRoadmap,
  isUpdating,
  profile,
  isFullScreenMode = false,
  onBackToChat,
  onNextToScheduling,
  lastAdjustmentSummary,
  lastCitation,
  lastConfidence
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [expandedSemester, setExpandedSemester] = useState<string | null>('sem-4'); // Spring 2027 expanded by default

  const totalCreditsPlanned = roadmap.reduce((sum, s) => sum + s.totalCredits, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim() || isUpdating) return;
    const prompt = promptInput;
    setPromptInput('');
    await onUpdateRoadmap(prompt);
  };

  if (!isOpen) return null;

  return (
    <div
      className={
        isFullScreenMode
          ? 'space-y-4 pb-12'
          : 'fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[620px] bg-white shadow-2xl flex flex-col border-l border-gray-300'
      }
    >
      {/* Step Navigation Bar for Screen 3 Full Mode */}
      {isFullScreenMode && (
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={onBackToChat}
              className="flex items-center space-x-1.5 text-xs text-gray-700 hover:text-black font-semibold bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to AI Advising Chat</span>
            </button>
            <span className="text-gray-300">|</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Screen 3 of 5:</span>
            <span className="text-sm font-bold text-gray-900">Dynamic 4-Year Degree Roadmap</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Prototype: sample data</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNextToScheduling}
              className="flex items-center space-x-2 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-4 py-2 rounded-md transition-all shadow-xs"
            >
              <span>Next Step: Mutual Advisor Scheduling (Screen 4)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className={`bg-white flex flex-col flex-1 overflow-hidden ${isFullScreenMode ? 'rounded-lg border border-gray-200 shadow-xs' : ''}`}>
        {/* Top Header */}
        <div className="bg-gray-900 text-white p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#ba0c2f] rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-base">Dynamic 4-Year Degree Roadmap</h2>
                <span className="text-[10px] bg-red-600 text-white font-semibold px-1.5 py-0.2 rounded">
                  Live Balanced
                </span>
              </div>
              <p className="text-xs text-gray-300">
                {profile.major} • {profile.minor}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded hidden sm:inline">
              Prototype: sample data
            </span>
            {!isFullScreenMode && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                title="Close Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Degree Progress Stats Banner */}
        <div className="bg-gray-50 border-b border-gray-200 p-4 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <div className="text-[11px] text-gray-500 uppercase font-semibold">Total Credits</div>
              <div className="text-base font-bold text-gray-900 mt-0.5">
                {totalCreditsPlanned} / {profile.totalRequiredCredits}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">On Track for 2029</div>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <div className="text-[11px] text-gray-500 uppercase font-semibold">Earned Credits</div>
              <div className="text-base font-bold text-gray-900 mt-0.5">{profile.earnedCredits} cr</div>
              <div className="text-[10px] text-gray-500">Year 1 Finished</div>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <div className="text-[11px] text-gray-500 uppercase font-semibold">Current GPA</div>
              <div className="text-base font-bold text-gray-900 mt-0.5">{profile.gpa}</div>
              <div className="text-[10px] text-emerald-600 font-medium">Dean&apos;s List</div>
            </div>
            <div className="bg-white p-2.5 rounded border border-gray-200">
              <div className="text-[11px] text-gray-500 uppercase font-semibold">Hold Impact</div>
              <div className="text-base font-bold text-red-700 mt-0.5">Registration</div>
              <div className="text-[10px] text-red-600 font-medium">Lock on Spring &apos;27</div>
            </div>
          </div>

          {/* AI Feedback Banner */}
          {lastAdjustmentSummary && (
            <div className="mt-3 p-3 bg-red-50/70 border border-red-200 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 font-bold text-[#ba0c2f]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Roadmap Rebalancing Applied via Claude</span>
              </div>
              <p className="text-gray-700">{lastAdjustmentSummary}</p>
              {lastCitation && (
                <div className="text-[11px] text-gray-500 pt-1 border-t border-red-100 flex items-center space-x-1">
                  <span className="font-semibold text-gray-700">Source:</span>
                  <span className="italic">{lastCitation}</span>
                  {lastConfidence && (
                    <span className="ml-1 bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-medium">
                      {lastConfidence} confidence
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Semesters Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gray-100/50">
          <div className="flex items-center justify-between text-xs text-gray-500 px-1">
            <span className="font-semibold uppercase tracking-wider text-[11px]">8-Semester Academic Pathway</span>
            <span className="text-[11px]">Click semester to view course details</span>
          </div>

          {roadmap.map((sem) => {
            const isExpanded = expandedSemester === sem.id;
            const isCurrent = sem.status === 'in-progress';
            const isCompleted = sem.status === 'completed';

            return (
              <div
                key={sem.id}
                className={`rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-white border-[#ba0c2f] shadow-md ring-1 ring-red-200'
                    : isCompleted
                    ? 'bg-white border-gray-200 shadow-xs opacity-95'
                    : 'bg-white border-gray-200 shadow-xs'
                }`}
              >
                {/* Semester Header */}
                <div
                  onClick={() => setExpandedSemester(isExpanded ? null : sem.id)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-500'
                          : isCurrent
                          ? 'bg-[#ba0c2f] animate-pulse'
                          : 'bg-blue-400'
                      }`}
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-gray-900">{sem.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                            Current Term
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                            Completed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center space-x-3">
                        <span>{sem.courses.length} courses</span>
                        <span>•</span>
                        <span>{sem.totalCredits} credit hours</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    {/* Workload Indicator Badge (Survey Request!) */}
                    <div
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center space-x-1 ${
                        sem.workloadRating === 'Heavy' || sem.workloadRating === 'Overload'
                          ? 'bg-orange-100 text-orange-900 border border-orange-200'
                          : sem.workloadRating === 'Balanced'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {sem.workloadRating === 'Heavy' ? (
                        <Flame className="w-3 h-3 text-orange-600" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      )}
                      <span>{sem.workloadRating} Workload</span>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Course List */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/40 space-y-2">
                    <div className="grid grid-cols-1 gap-2 pt-2">
                      {sem.courses.map((course, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-white p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors flex items-start justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-gray-900 text-xs font-mono">
                                {course.code}
                              </span>
                              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">
                                {course.type}
                              </span>
                              {course.prereqMet ? (
                                <span className="text-[10px] text-emerald-700 flex items-center space-x-0.5 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Prereq Met</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 flex items-center space-x-0.5 font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Prereq In-Progress</span>
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-medium text-gray-800">{course.name}</div>
                            {course.notes && (
                              <div className="text-[11px] text-gray-500 italic">{course.notes}</div>
                            )}
                            {course.prereqInfo && (
                              <div className="text-[10px] text-gray-500">{course.prereqInfo}</div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-gray-700">{course.credits} cr</span>
                            <div className="flex items-center space-x-1 mt-1 justify-end" title={`Difficulty: ${course.difficulty}/5`}>
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-1.5 h-2 rounded-xs ${
                                    i < course.difficulty
                                      ? course.difficulty >= 4
                                        ? 'bg-orange-500'
                                        : 'bg-emerald-500'
                                      : 'bg-gray-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[9px] text-gray-400 block mt-0.5">
                              Diff {course.difficulty}/5
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dynamic Prompt Bar at the Bottom (Student Preferences Adjustment) */}
        <div className="bg-white border-t border-gray-200 p-3 shrink-0 space-y-2">
          {/* Quick preset chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[10px] font-bold uppercase text-gray-400 shrink-0">AI Prompts:</span>
            {ROADMAP_PROMPT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                disabled={isUpdating}
                onClick={() => onUpdateRoadmap(p)}
                className="bg-gray-100 hover:bg-red-50 hover:text-[#ba0c2f] text-gray-700 text-[11px] px-2.5 py-1 rounded-full border border-gray-200 transition-colors whitespace-nowrap"
              >
                {p}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Adjust 4-year roadmap (e.g. 'Add a summer internship in 2028', 'Swap electives')..."
                disabled={isUpdating}
                className="w-full text-xs sm:text-sm pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f] focus:border-transparent placeholder-gray-400"
              />
              <Sparkles className="w-4 h-4 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={!promptInput.trim() || isUpdating}
              className="bg-[#ba0c2f] hover:bg-[#9d0a27] disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Balancing...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Update Plan</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
