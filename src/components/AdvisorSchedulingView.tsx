import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Video,
  MapPin,
  Phone,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Check,
  Info
} from 'lucide-react';
import { AdvisorSlot, StudentProfile, MUTUAL_ADVISOR_SLOTS } from '../data/sampleData';

interface AdvisorSchedulingViewProps {
  profile: StudentProfile;
  onConfirmBooking: (slot: AdvisorSlot, format: string, notes: string) => void;
  onBackToRoadmap: () => void;
  onNextStep: () => void;
  isBooked: boolean;
  bookedSlot?: AdvisorSlot | null;
}

export const AdvisorSchedulingView: React.FC<AdvisorSchedulingViewProps> = ({
  profile,
  onConfirmBooking,
  onBackToRoadmap,
  onNextStep,
  isBooked,
  bookedSlot
}) => {
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-1');
  const [selectedFormat, setSelectedFormat] = useState<'In-Person' | 'Zoom Virtual' | 'Phone'>('In-Person');
  const [studentNotes, setStudentNotes] = useState(
    'Meeting to review draft 4-year roadmap and clear 2nd-Year Registration Lock hold for Spring 2027 enrollment.'
  );

  const selectedSlot = MUTUAL_ADVISOR_SLOTS.find((s) => s.id === selectedSlotId) || MUTUAL_ADVISOR_SLOTS[0];

  const handleBooking = () => {
    onConfirmBooking(selectedSlot, selectedFormat, studentNotes);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Screen 4 Core Stepper Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBackToRoadmap}
            className="flex items-center space-x-1.5 text-xs text-gray-700 hover:text-black font-semibold bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to 4-Year Roadmap</span>
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Screen 4 of 5:</span>
          <span className="text-sm font-bold text-gray-900">Human Advisor Mutual Schedule Matcher</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">Prototype: sample data</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={onNextStep}
            className="flex items-center space-x-2 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-4 py-2 rounded-md transition-all shadow-xs"
          >
            <span>Next Step: Confirmation & Action Plan (Screen 5)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Escalation Trigger & Survey Match Banner */}
      <div className="bg-white border-l-4 border-[#ba0c2f] border-y border-r border-gray-200 rounded-lg p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2 bg-gray-100 text-[#ba0c2f] rounded border border-gray-200 shrink-0 mt-0.5">
              <Calendar className="w-5 h-5 text-[#ba0c2f]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-[#ba0c2f] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                  Advising Escalation Active
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  SIS Mandatory 2nd-Year Review
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-1">
                Mutual Availability Scheduling with {profile.advisorName}
              </h2>
              <p className="text-xs text-gray-600 mt-1 max-w-3xl leading-relaxed">
                Because Tyler has an active <strong>Registration Lock hold</strong>, Ohio State policy requires human advising verification. This tool compares your enrolled lecture and lab schedule directly against Advisor Sarah Jenkins&apos; open advising calendar to display mutual open time windows.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Advisor Profile + Schedule Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Advisor Card & Meeting Details */}
        <div className="space-y-6">
          {/* Advisor Profile Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-12 h-12 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-lg font-bold text-[#ba0c2f] shrink-0">
                SJ
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">{profile.advisorName}</h3>
                <p className="text-xs text-gray-600 font-medium">{profile.advisorTitle}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{profile.advisorEmail}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-md text-xs space-y-2 border border-gray-100">
              <div className="flex items-center space-x-2 text-gray-700">
                <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span>Office: {profile.advisorOffice}</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span>Standard Appt: 20-30 Minutes</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Authorized to lift Registration Lock holds</span>
              </div>
            </div>

            {/* Auto-Prepared Advisor Pre-Brief */}
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-xs space-y-1.5">
              <div className="flex items-center space-x-1.5 font-bold text-gray-900">
                <Info className="w-3.5 h-3.5 text-[#ba0c2f]" />
                <span>OnCourse Student Dossier Pre-Loaded</span>
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Tyler&apos;s current GPA (3.68), in-progress coursework (ACCTMIS 2300, CSE 2221), and proposed Spring 2027 balanced cart are pre-loaded for Sarah Jenkins before the advising session begins.
              </p>
            </div>
          </div>

          {/* Tyler's Active Class Commitments */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-gray-900 flex items-center justify-between">
              <span>Tyler&apos;s Class Schedule Filter</span>
              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                Auto-Synced
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              Times when Tyler has lectures/labs are automatically blocked out:
            </p>
            <div className="space-y-1.5 text-xs text-gray-700">
              <div className="p-2 bg-gray-50 rounded border border-gray-100 flex justify-between">
                <span>MWF 8:00 AM - 8:55 AM</span>
                <span className="font-semibold text-gray-800">ACCTMIS 2300</span>
              </div>
              <div className="p-2 bg-gray-50 rounded border border-gray-100 flex justify-between">
                <span>TR 9:35 AM - 10:55 AM</span>
                <span className="font-semibold text-gray-800">CSE 2221</span>
              </div>
              <div className="p-2 bg-gray-50 rounded border border-gray-100 flex justify-between">
                <span>MWF 11:30 AM - 12:45 PM</span>
                <span className="font-semibold text-gray-800">MATH 1152</span>
              </div>
              <div className="p-2 bg-gray-50 rounded border border-gray-100 flex justify-between">
                <span>W 2:15 PM - 3:35 PM</span>
                <span className="font-semibold text-gray-800">BUSMHR 2292</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (2 cols): Mutual Calendar Slot Selector */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Select a Mutually Free Appointment Window
                </h3>
                <p className="text-xs text-gray-500">
                  Green indicates zero class overlap for you and an open slot for Sarah Jenkins.
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="flex items-center space-x-1 text-emerald-800 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Mutual Match</span>
                </span>
                <span className="flex items-center space-x-1 text-red-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>Class Conflict</span>
                </span>
              </div>
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MUTUAL_ADVISOR_SLOTS.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const isMutual = slot.mutualMatch;

                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      if (isMutual) setSelectedSlotId(slot.id);
                    }}
                    className={`p-4 rounded-xl border transition-all text-left ${
                      !isMutual
                        ? 'bg-red-50/40 border-red-200 opacity-75 cursor-not-allowed'
                        : isSelected
                        ? 'bg-red-50 border-[#ba0c2f] ring-2 ring-red-300 shadow-xs cursor-pointer'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 cursor-pointer shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-gray-900">{slot.day}</span>
                          <span className="text-xs text-gray-500">({slot.date})</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-800 mt-1 flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          <span>{slot.time}</span>
                        </div>
                      </div>

                      <div>
                        {isMutual ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Mutual Free
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <AlertCircle className="w-3 h-3 mr-1 text-red-600" />
                            Class Conflict
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-gray-100 text-xs">
                      {isMutual ? (
                        <div className="text-emerald-800 flex items-center justify-between">
                          <span>Both schedules free</span>
                          {isSelected && (
                            <span className="font-bold text-[#ba0c2f] flex items-center space-x-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Selected</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-700 text-[11px]">
                          Conflict: You have <strong>BUSMHR 2292 lecture</strong> at this time.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Meeting Format Selector */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Select Meeting Format:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'In-Person', label: 'In-Person', sub: 'Mason Hall 120', icon: MapPin },
                  { id: 'Zoom Virtual', label: 'Zoom Video', sub: 'Buckeye Link Link', icon: Video },
                  { id: 'Phone', label: 'Phone Call', sub: 'Direct Call', icon: Phone }
                ].map((fmt) => {
                  const Icon = fmt.icon;
                  const isChecked = selectedFormat === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setSelectedFormat(fmt.id as any)}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        isChecked
                          ? 'bg-red-50 border-[#ba0c2f] text-red-950 font-bold shadow-xs'
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mx-auto mb-1 ${isChecked ? 'text-[#ba0c2f]' : 'text-gray-500'}`} />
                      <div className="text-xs font-semibold">{fmt.label}</div>
                      <div className="text-[10px] text-gray-500">{fmt.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student Agenda & Notes */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Meeting Agenda & Pre-Authorization Notes:
              </label>
              <textarea
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
              />
            </div>

            {/* Confirmation Action Button */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-gray-900">Summary: </span>
                {selectedSlot.day}, {selectedSlot.date} at {selectedSlot.time} ({selectedFormat})
              </div>
              <button
                onClick={handleBooking}
                className="w-full sm:w-auto bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-bold py-2.5 px-6 rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Mutual Slot & Clear Hold</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
