import React from 'react';
import { X, Sparkles, CheckCircle2, ExternalLink, BarChart3, Users } from 'lucide-react';
import { SURVEY_DATA_HIGHLIGHTS } from '../data/sampleData';

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SurveyModal: React.FC<SurveyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-gray-200">
        {/* Header */}
        <div className="bg-[#ba0c2f] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BarChart3 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-bold text-lg">OSU Undergrad Advising Survey Data</h2>
              <p className="text-xs text-white/80">
                Source: <span className="underline">{SURVEY_DATA_HIGHLIGHTS.sourceUrl}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-950 flex items-start space-x-3">
            <Users className="w-5 h-5 text-[#ba0c2f] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Sample: {SURVEY_DATA_HIGHLIGHTS.sampleSize}</div>
              <p className="text-xs text-red-800 mt-1">
                Survey conducted across Fisher College of Business, Arts and Sciences, and Engineering undergraduates regarding pain points with BuckeyeLink, degree audits, prerequisite bottlenecks, and human advisor access.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-gray-900 uppercase tracking-wider text-xs">
              Top 5 Demands Implemented in This Prototype:
            </h3>

            {SURVEY_DATA_HIGHLIGHTS.metrics.map((item, idx) => (
              <div key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-start space-x-3">
                <div className="w-12 text-center shrink-0">
                  <span className="text-lg font-black text-[#ba0c2f]">{item.stat}</span>
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-gray-900">{item.label}</div>
                  <p className="text-xs text-gray-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs space-y-2">
            <div className="font-bold text-sm flex items-center space-x-1.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>How This Prototype Satisfies Every Feature:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-emerald-800 text-xs">
              <li><strong>Native BuckeyeLink Entry:</strong> Floating Chat button in lower right corner + instant hold resolution link.</li>
              <li><strong>Live Claude Reasoning:</strong> Grounded in official OSU Bulletins & DARS rules with transparent source citations.</li>
              <li><strong>Uncertainty Honesty:</strong> Flags when department policy requires human advisor sign-off.</li>
              <li><strong>Dynamic 4-Year Roadmap:</strong> Rebalances credit hours and prevents triple weed-out overload.</li>
              <li><strong>Mutual Availability Matcher:</strong> Scans student class lectures vs advisor open hours to book instantly without email tag.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs">
          <span className="text-gray-500 italic">Prototype: sample data</span>
          <button
            onClick={onClose}
            className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Close Survey Data
          </button>
        </div>
      </div>
    </div>
  );
};
