import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Smartphone,
  Mail,
  Clock,
  Users,
  TrendingUp,
  Sparkles,
  ChevronDown,
  Info,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';

export interface WatchedCourse {
  id: string;
  code: string;
  title: string;
  instructor: string;
  section: string;
  meetingTime: string;
  location: string;
  enrolled: number;
  capacity: number;
  waitlistPosition: number;
  waitlistTotal: number;
  status: 'full_waitlist' | 'seat_opened' | 'monitoring';
  dropProbability: string;
  smsAlerts: boolean;
  emailAlerts: boolean;
  autoSnipeReady: boolean;
  notes?: string;
}

export const INITIAL_WATCHED_COURSES: WatchedCourse[] = [
  {
    id: 'watch-1',
    code: 'ACCTMIS 2300',
    title: 'Introductory Accounting II',
    instructor: 'Marc Smith',
    section: '0010 (Lecture)',
    meetingTime: 'MWF 10:20 AM – 11:15 AM',
    location: 'Schoenbaum Hall 105',
    enrolled: 180,
    capacity: 180,
    waitlistPosition: 4,
    waitlistTotal: 19,
    status: 'full_waitlist',
    dropProbability: '94% (Very High - avg 28 drops during syllabus week)',
    smsAlerts: true,
    emailAlerts: true,
    autoSnipeReady: true,
    notes: 'Heavy workload class; multiple students drop after the Sunday walkthrough quiz 1.'
  },
  {
    id: 'watch-2',
    code: 'CSE 2231',
    title: 'Software II: Software Development',
    instructor: 'Dr. Paolo Bucci',
    section: '0020 (Lecture + Lab)',
    meetingTime: 'TR 1:00 PM – 2:20 PM',
    location: 'Caldwell Lab 120',
    enrolled: 40,
    capacity: 40,
    waitlistPosition: 2,
    waitlistTotal: 8,
    status: 'full_waitlist',
    dropProbability: '98% (Extremely High - usually clears within 48 hrs)',
    smsAlerts: true,
    emailAlerts: true,
    autoSnipeReady: true,
    notes: 'Required prerequisite for CSE minor and CIS specializations.'
  },
  {
    id: 'watch-3',
    code: 'BUSFIN 3220',
    title: 'Business Finance',
    instructor: 'Tad Brinkerhoff',
    section: '0015 (Lecture)',
    meetingTime: 'MW 3:00 PM – 4:20 PM',
    location: 'Gerlach Hall 275',
    enrolled: 179,
    capacity: 180,
    waitlistPosition: 0,
    waitlistTotal: 0,
    status: 'seat_opened',
    dropProbability: '100% - Seat Open Right Now!',
    smsAlerts: true,
    emailAlerts: true,
    autoSnipeReady: true,
    notes: '1 seat opened at 2:14 PM today! Grab it before someone else claims it.'
  }
];

interface SeatAlertsViewProps {
  onSimulateSeatDrop: (course: WatchedCourse) => void;
  onQuickEnroll?: (course: WatchedCourse) => void;
  initialAddCourse?: string | null;
}

export const SeatAlertsView: React.FC<SeatAlertsViewProps> = ({
  onSimulateSeatDrop,
  onQuickEnroll,
  initialAddCourse
}) => {
  const [courses, setCourses] = useState<WatchedCourse[]>(INITIAL_WATCHED_COURSES);
  const [phoneNumber, setPhoneNumber] = useState('(614) 555-0194');
  const [emailAddress, setEmailAddress] = useState('rez.4@osu.edu');
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [newCode, setNewCode] = useState(initialAddCourse || '');
  const [newSection, setNewSection] = useState('0010');
  const [newInstructor, setNewInstructor] = useState('');
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);

  const handleToggleSms = (id: string) => {
    setCourses(prev =>
      prev.map(c => (c.id === id ? { ...c, smsAlerts: !c.smsAlerts } : c))
    );
  };

  const handleToggleEmail = (id: string) => {
    setCourses(prev =>
      prev.map(c => (c.id === id ? { ...c, emailAlerts: !c.emailAlerts } : c))
    );
  };

  const handleToggleAutoSnipe = (id: string) => {
    setCourses(prev =>
      prev.map(c => (c.id === id ? { ...c, autoSnipeReady: !c.autoSnipeReady } : c))
    );
  };

  const handleRemoveCourse = (id: string) => {
    setCourses(prev => prev.filter(c => c.id !== id));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;

    const newEntry: WatchedCourse = {
      id: `watch-${Date.now()}`,
      code: newCode.trim().toUpperCase(),
      title: 'Added Course (SIS Auto-Lookup)',
      instructor: newInstructor.trim() || 'Staff / Section Chair',
      section: newSection.trim() || '0010',
      meetingTime: 'TBD • BuckeyeLink Schedule',
      location: 'Columbus Campus',
      enrolled: 40,
      capacity: 40,
      waitlistPosition: 3,
      waitlistTotal: 6,
      status: 'full_waitlist',
      dropProbability: '88% (Good probability based on historical SIS drop velocity)',
      smsAlerts: true,
      emailAlerts: true,
      autoSnipeReady: true,
      notes: 'Monitored continuously via BuckeyeLink Instant Alert.'
    };

    setCourses([newEntry, ...courses]);
    setIsAddingCourse(false);
    setNewCode('');
    setNewInstructor('');
    setAddSuccessMsg(`Now monitoring ${newEntry.code}! SMS alerts enabled for ${phoneNumber}.`);
    setTimeout(() => setAddSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-5 text-[#202124]">
      {/* Top Banner: Real-Time Status & Instant Simulation (Google Workspace Header Aesthetic) */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#ba0c2f] text-white flex items-center justify-center shrink-0 shadow-xs">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#137333] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                  <span>Polling Active (15s SIS Cycle)</span>
                </span>
                <span className="text-xs text-[#5f6368] font-medium">
                  {courses.length} courses watched
                </span>
              </div>
              <h3 className="font-bold text-base text-[#202124] mt-0.5">
                Instant Waitlist &amp; Seat Drop Alert Engine
              </h3>
            </div>
          </div>

          {/* Test / Simulate Button (Google Pill Buttons with OSU Scarlet) */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSimulateSeatDrop(courses[0] || INITIAL_WATCHED_COURSES[0])}
              className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-semibold px-4 py-2 rounded-full transition-all active:scale-95 flex items-center space-x-1.5 shadow-xs"
              title="Click to simulate an immediate seat drop alert"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Simulate Instant Seat Drop</span>
            </button>
            <button
              onClick={() => setIsAddingCourse(!isAddingCourse)}
              className="border border-gray-300 hover:bg-gray-50 text-[#3c4043] text-xs font-semibold px-3.5 py-2 rounded-full transition-colors flex items-center space-x-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Course</span>
            </button>
          </div>
        </div>

        {/* Channels & Notification Config Bar */}
        <div className="pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-red-50 text-[#ba0c2f] flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-[#5f6368] uppercase font-bold block">Instant SMS Destination</span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="font-medium text-xs text-[#202124] bg-transparent border-b border-gray-300 focus:border-[#ba0c2f] focus:outline-none"
                  placeholder="(614) 555-0194"
                />
              </div>
            </div>
            <span className="text-[10px] text-[#137333] bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
              Verified
            </span>
          </div>

          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-[#006699] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-[#5f6368] uppercase font-bold block">Ohio State Email</span>
                <input
                  type="text"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="font-medium text-xs text-[#202124] bg-transparent border-b border-gray-300 focus:border-[#006699] focus:outline-none"
                  placeholder="name.#@osu.edu"
                />
              </div>
            </div>
            <span className="text-[10px] text-[#137333] bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
              Active
            </span>
          </div>
        </div>

        {addSuccessMsg && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{addSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* Course Add Form (Expandable) */}
      {isAddingCourse && (
        <form onSubmit={handleAddSubmit} className="bg-white border border-gray-200 rounded-xl p-5 text-xs space-y-3.5 shadow-xs">
          <div className="font-bold text-[#202124] text-sm flex items-center space-x-2">
            <Plus className="w-4 h-4 text-[#ba0c2f]" />
            <span>Watch a New Course or Closed Section in BuckeyeLink</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5f6368] mb-1">
                Course Subject &amp; Number
              </label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. ACCTMIS 2300 or BUSMHR 2292"
                className="w-full bg-[#f8f9fa] border border-gray-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5f6368] mb-1">
                Preferred Instructor (Optional)
              </label>
              <input
                type="text"
                value={newInstructor}
                onChange={(e) => setNewInstructor(e.target.value)}
                placeholder="e.g. Marc Smith or Any"
                className="w-full bg-[#f8f9fa] border border-gray-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5f6368] mb-1">
                Section (Optional)
              </label>
              <input
                type="text"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                placeholder="0010"
                className="w-full bg-[#f8f9fa] border border-gray-300 rounded-lg px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ba0c2f]"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingCourse(false)}
              className="px-4 py-2 border border-gray-300 rounded-full text-[#5f6368] hover:bg-gray-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-semibold rounded-full shadow-xs"
            >
              Start Watching Section
            </button>
          </div>
        </form>
      )}

      {/* Monitored Course Cards */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-xs text-[#5f6368] px-1">
          <span className="font-bold uppercase tracking-wider text-[11px]">
            Currently Monitored Sections ({courses.length})
          </span>
          <span className="text-[11px]">
            Average drop notification latency: <strong className="text-[#202124]">~2.4 seconds</strong>
          </span>
        </div>

        {courses.map((course) => {
          const isSeatOpen = course.status === 'seat_opened';
          return (
            <div
              key={course.id}
              className={`bg-white rounded-xl border transition-all p-5 text-xs space-y-3.5 ${
                isSeatOpen
                  ? 'border-emerald-500 bg-emerald-50/10 shadow-md ring-2 ring-emerald-200/50'
                  : 'border-gray-200 hover:border-gray-300 shadow-2xs'
              }`}
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="font-bold text-sm text-[#202124]">{course.code}</span>
                    <span className="text-gray-300">•</span>
                    <span className="font-medium text-[#3c4043]">{course.title}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-[#5f6368] font-mono font-semibold">{course.section}</span>
                  </div>
                  <div className="text-[#5f6368] text-[11px] mt-1">
                    Instructor: <strong className="text-[#202124]">{course.instructor}</strong> • {course.meetingTime} • {course.location}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center space-x-2 shrink-0">
                  {isSeatOpen ? (
                    <span className="inline-flex items-center space-x-1.5 bg-emerald-600 text-white font-bold text-xs px-3.5 py-1 rounded-full shadow-xs animate-pulse">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>1 SEAT OPEN NOW!</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[11px] px-3 py-1 rounded-full">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>Waitlist Pos #{course.waitlistPosition} of {course.waitlistTotal}</span>
                    </span>
                  )}

                  <button
                    onClick={() => handleRemoveCourse(course.id)}
                    className="text-[#5f6368] hover:text-[#ba0c2f] p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    title="Remove from watch list"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Enrollment Metrics & Velocity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-[#f8f9fa] border border-gray-200 rounded-lg p-2.5">
                  <div className="text-[#5f6368] uppercase text-[10px] font-bold">Enrollment Capacity</div>
                  <div className="font-semibold text-[#202124] mt-0.5">
                    {course.enrolled} / {course.capacity} Students{' '}
                    <span className={course.enrolled >= course.capacity ? 'text-[#c5221f]' : 'text-[#137333]'}>
                      ({course.capacity - course.enrolled} open)
                    </span>
                  </div>
                </div>

                <div className="bg-[#f8f9fa] border border-gray-200 rounded-lg p-2.5">
                  <div className="text-[#5f6368] uppercase text-[10px] font-bold">Historical Drop Velocity</div>
                  <div className="font-semibold text-[#202124] mt-0.5 flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3 text-[#137333] shrink-0" />
                    <span className="truncate">{course.dropProbability}</span>
                  </div>
                </div>

                <div className="bg-[#f8f9fa] border border-gray-200 rounded-lg p-2.5">
                  <div className="text-[#5f6368] uppercase text-[10px] font-bold">Active Alert Routing</div>
                  <div className="font-semibold text-[#202124] mt-0.5 flex items-center space-x-1.5">
                    {course.smsAlerts && <span className="text-[#ba0c2f] font-bold">SMS</span>}
                    {course.smsAlerts && course.emailAlerts && <span>+</span>}
                    {course.emailAlerts && <span className="text-[#006699] font-bold">Email</span>}
                    {course.autoSnipeReady && <span className="text-[#137333] font-bold">• 1-Click Ready</span>}
                  </div>
                </div>
              </div>

              {/* Course Note / Student Strategy */}
              {course.notes && (
                <div className="text-[11px] text-[#5f6368] bg-[#fef7e0] border border-[#fce8b2] rounded-lg p-2.5 flex items-start space-x-2">
                  <Info className="w-3.5 h-3.5 text-[#b06000] shrink-0 mt-0.5" />
                  <span className="text-[#7c4a03]">{course.notes}</span>
                </div>
              )}

              {/* Bottom Actions Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-gray-100">
                <div className="flex items-center space-x-3 text-[11px] text-[#5f6368]">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={course.smsAlerts}
                      onChange={() => handleToggleSms(course.id)}
                      className="rounded border-gray-300 text-[#ba0c2f] focus:ring-[#ba0c2f] h-3.5 w-3.5"
                    />
                    <span>SMS Alert</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={course.emailAlerts}
                      onChange={() => handleToggleEmail(course.id)}
                      className="rounded border-gray-300 text-[#ba0c2f] focus:ring-[#ba0c2f] h-3.5 w-3.5"
                    />
                    <span>OSU Email Alert</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={course.autoSnipeReady}
                      onChange={() => handleToggleAutoSnipe(course.id)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 h-3.5 w-3.5"
                    />
                    <span>1-Click Auto-Cart</span>
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSimulateSeatDrop(course)}
                    className="text-xs text-[#3c4043] hover:text-[#202124] border border-gray-300 px-3 py-1.5 rounded-full bg-white hover:bg-gray-50 transition-colors shadow-2xs font-medium"
                  >
                    Test Alert
                  </button>

                  {isSeatOpen ? (
                    <button
                      onClick={() => onQuickEnroll && onQuickEnroll(course)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-full transition-transform active:scale-95 flex items-center space-x-1.5 shadow-xs"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>⚡ 1-Click Enroll in BuckeyeLink</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onSimulateSeatDrop(course)}
                      className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-semibold text-xs px-3.5 py-1.5 rounded-full transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Bell className="w-3 h-3" />
                      <span>Monitor Active</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable FAQs / OSU Waitlist Regulations */}
      <div className="space-y-1.5 pt-2">
        <details className="group bg-white border border-gray-200 rounded-xl p-3.5 text-xs">
          <summary className="flex items-center justify-between font-semibold text-[#202124] text-[11px] cursor-pointer select-none">
            <span className="flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-[#ba0c2f]" />
              <span>How BuckeyeLink Waitlists &amp; Seat Drops Work at Ohio State</span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5f6368] transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-2.5 pt-2 border-t border-gray-100 text-[#5f6368] text-[11px] leading-relaxed space-y-1.5">
            <p>
              • <strong>Nightly Auto-Enroll Batch:</strong> BuckeyeLink runs an automated waitlist process overnight that automatically enrolls eligible students if prerequisites and time conflicts are clear.
            </p>
            <p>
              • <strong>Instant Seat Drops During the Day:</strong> When students drop during the day or if reserve-caps release, seats temporarily become available for immediate registration before the next nightly batch runs. This tracker alerts your phone immediately so you don&apos;t miss the window.
            </p>
            <p>
              • <strong>Syllabus Week (1st Friday Deadline):</strong> Over 15% of business and computer science students adjust their schedules during the first week of class. Waitlist positions #1 through #5 virtually always secure a seat before the Friday 5:00 PM deadline.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
};
