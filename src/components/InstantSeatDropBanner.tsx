import React, { useState } from 'react';
import {
  BellRing,
  Zap,
  X,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  Info,
  Clock,
  Smartphone
} from 'lucide-react';
import { WatchedCourse } from './SeatAlertsView';

interface InstantSeatDropBannerProps {
  course: WatchedCourse | null;
  isOpen: boolean;
  onClose: () => void;
  onQuickEnroll?: (course: WatchedCourse) => void;
}

export const InstantSeatDropBanner: React.FC<InstantSeatDropBannerProps> = ({
  course,
  isOpen,
  onClose,
  onQuickEnroll
}) => {
  const [enrolledSuccess, setEnrolledSuccess] = useState(false);
  const [smsSent, setSmsSent] = useState(true);

  if (!isOpen || !course) return null;

  const handleEnrollClick = () => {
    setEnrolledSuccess(true);
    if (onQuickEnroll) onQuickEnroll(course);
    setTimeout(() => {
      setEnrolledSuccess(false);
      onClose();
    }, 3500);
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 w-11/12 max-w-xl animate-bounce-short">
      <div className="bg-white border-2 border-[#ba0c2f] rounded-2xl shadow-2xl p-4 sm:p-5 ring-4 ring-red-100/80 text-gray-900 text-xs space-y-3">
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 border-b border-red-100 pb-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ba0c2f] text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#ba0c2f] px-2 py-0.5 rounded">
                  🚨 BuckeyeLink Instant Seat Drop Alert
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  Just Now
                </span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-gray-900 mt-0.5">
                Seat Opened: {course.code} ({course.section})
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-md"
            title="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: Concise, Non-Verbose */}
        <div className="bg-red-50/50 border border-red-200/70 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-900 font-medium">
            <span><strong>Instructor:</strong> {course.instructor}</span>
            <span><strong>Meeting:</strong> {course.meetingTime}</span>
          </div>
          <p className="text-xs text-gray-700 leading-snug">
            A registered student just dropped their seat in SIS. Because you are on the instant tracker, you can claim this seat before general waitlist nightly batch processing.
          </p>
        </div>

        {/* Expandable Dropdown: View Waitlist Velocity & SIS Details */}
        <details className="group border border-gray-200 rounded-lg p-2.5 bg-gray-50/70 cursor-pointer">
          <summary className="flex items-center justify-between font-semibold text-gray-700 text-[11px] select-none hover:text-gray-900">
            <span className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-[#ba0c2f]" />
              <span>View Course Location &amp; SIS Section Details</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2 pt-2 border-t border-gray-200 text-gray-600 text-[11px] space-y-1">
            <div><strong>Location:</strong> {course.location}</div>
            <div><strong>Enrolled Capacity:</strong> {course.capacity - 1} / {course.capacity} (1 seat currently available)</div>
            <div><strong>SMS Notification:</strong> Dispatch sent to verified mobile phone (614) 555-0194.</div>
          </div>
        </details>

        {/* Feedback Message */}
        {enrolledSuccess ? (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-emerald-900 flex items-center space-x-2 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Success! {course.code} Section {course.section} has been added directly to your BuckeyeLink enrollment cart!</span>
          </div>
        ) : (
          /* Action Buttons */
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center space-x-2 text-[11px] text-gray-500">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>SMS Alert dispatched to (614) 555-0194</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors"
              >
                Dismiss
              </button>

              <button
                onClick={handleEnrollClick}
                className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-bold text-xs px-4 py-2 rounded-lg transition-transform active:scale-95 flex items-center space-x-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>⚡ 1-Click Fast-Add to Cart</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
