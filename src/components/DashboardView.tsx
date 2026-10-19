import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Paperclip,
  Calendar,
  Lightbulb,
  Link as LinkIcon,
  Megaphone,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  HelpCircle,
  Phone,
  Building,
  Smartphone,
  ExternalLink,
  Shield,
  Heart,
  UserCheck,
  Clock
} from 'lucide-react';
import { OhioStateLogo } from './OhioStateLogo';

interface DashboardViewProps {
  onOpenChat: () => void;
  onOpenChatWithPrompt: (prompt: string) => void;
  onOpenRoadmap: () => void;
  onOpenScheduling: () => void;
  onNextStep?: () => void;
  onOpenSeatAlerts?: () => void;
  onOpenStudyAccess?: () => void;
  onSimulateSeatDrop?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenChat,
  onOpenChatWithPrompt,
  onOpenRoadmap,
  onOpenScheduling,
  onNextStep,
  onOpenSeatAlerts,
  onOpenStudyAccess,
  onSimulateSeatDrop
}) => {
  // Accordion state
  const [searchQuery, setSearchQuery] = useState('');
  const [holdsOpen, setHoldsOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [carmenOpen, setCarmenOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [buckeyeLearnOpen, setBuckeyeLearnOpen] = useState(false);
  const [buckIdOpen, setBuckIdOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [netPayOpen, setNetPayOpen] = useState(false);
  const [timesheetOpen, setTimesheetOpen] = useState(false);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [resourceTab, setResourceTab] = useState<'Wellness' | 'Social'>('Wellness');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="w-full space-y-6 pb-24">
      {/* 1. Large Buckeye Link Search Input Card (Screenshot 1) */}
      <div className="bg-white rounded-lg shadow-2xs border border-gray-200 p-4">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Buckeye Link"
            className="w-full text-sm sm:text-base pl-4 pr-12 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder-gray-500 font-normal"
          />
          <button
            type="submit"
            className="absolute right-3.5 text-gray-500 hover:text-gray-900 transition-colors"
            title="Search"
          >
            <Search className="w-5 h-5 text-[#006699]" />
          </button>
        </form>
      </div>

      {/* 2. Main 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Hi Tyler, Learning, Accounts, Work, Resources */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* CARD 1: Hi, Tyler! (Holds + To-Do List) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 overflow-hidden">
            <div className="p-6">
              <h2 className="text-3xl font-medium text-gray-900 tracking-tight">Hi, Tyler!</h2>
            </div>

            {/* Row 1: Holds */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setHoldsOpen(!holdsOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5 flex-wrap gap-y-2">
                  <div className="w-8 h-8 rounded-full bg-[#990000] text-white flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 fill-white text-[#990000]" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">Holds</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Registration Lock
                  </span>
                </div>
                <div className="text-gray-600">
                  {holdsOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* Holds Dropdown Details */}
              {holdsOpen && (
                <div className="px-6 pb-5 pt-2 bg-gray-50 border-t border-gray-100 text-xs space-y-3">
                  <div className="p-3 bg-white rounded border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">Hold: Registration Lock</div>
                      <div className="text-gray-600 mt-0.5">
                        Reason: Mandatory 2nd-Year Advising Plan Review before Spring 2027 enrollment.
                      </div>
                      <div className="text-gray-500 mt-0.5">Amount: $0.00 • Originator: Fisher Undergraduate Advising</div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={onOpenScheduling}
                        className="bg-[#990000] hover:bg-[#800000] text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
                      >
                        Match Advisor Schedule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: To-Do List */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setTodoOpen(!todoOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#c05621] text-white flex items-center justify-center shrink-0">
                    <CheckSquare className="w-4 h-4 fill-white text-[#c05621]" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">To-Do List</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Incomplete: 4
                  </span>
                </div>
                <div className="text-gray-600">
                  {todoOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* To-Do Dropdown Details */}
              {todoOpen && (
                <div className="px-6 pb-5 pt-2 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
                  {[
                    { task: 'Financial Responsibility Statement', due: 'Autumn 2026', dept: 'Bursar' },
                    { task: 'Direct Deposit Authorization Verification', due: 'Immediate', dept: 'Payroll' },
                    { task: 'Selective Service Registration Verification', due: 'Autumn 2026', dept: 'Registrar' },
                    { task: 'Update Emergency Contact Information', due: 'Annual', dept: 'Student Life' }
                  ].map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-white rounded border border-gray-200 flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-gray-900">{item.task}</span>
                        <div className="text-gray-500 text-[11px]">Due: {item.due} • {item.dept}</div>
                      </div>
                      <span className="text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-medium">
                        Pending
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CARD 2: Learning (Assignments, Calendar, BuckeyeLearn, Links) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Learning</h2>
            </div>

            {/* Row 1: Carmen Assignments */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setCarmenOpen(!carmenOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">Carmen Assignments</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Due Today: 1
                  </span>
                </div>
                <div className="text-gray-600">
                  {carmenOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {carmenOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
                  <div className="p-2.5 bg-white rounded border border-gray-200 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-900">ACCTMIS 2300 - Chapter 6 Quiz</div>
                      <div className="text-gray-500">Due tonight at 11:59 PM • 20 points</div>
                    </div>
                    <span className="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded text-[11px]">Due Today</span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Class Calendar */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5 flex-wrap gap-y-2">
                  <div className="w-8 h-8 rounded-full bg-[#b7791f] text-white flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">Class Calendar</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Today: 2 Classes
                  </span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Up Next: BUSADM 2801 - TechInnovation1
                  </span>
                </div>
                <div className="text-gray-600">
                  {calendarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {calendarOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
                  <div className="p-2.5 bg-white rounded border border-gray-200 flex justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">BUSADM 2801: TechInnovation1</div>
                      <div className="text-gray-500">1:00 PM - 2:15 PM • Gerlach Hall 265</div>
                    </div>
                    <span className="text-emerald-700 font-semibold">In 45 Mins</span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-gray-200 flex justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">CSE 2221: Software Components Lab</div>
                      <div className="text-gray-500">3:55 PM - 5:15 PM • Caldwell Lab 112</div>
                    </div>
                    <span className="text-gray-500">Upcoming</span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 3: BuckeyeLearn */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setBuckeyeLearnOpen(!buckeyeLearnOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#742a2a] text-white flex items-center justify-center shrink-0">
                    <Lightbulb className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">BuckeyeLearn</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    2 Assigned
                  </span>
                </div>
                <div className="text-gray-600">
                  {buckeyeLearnOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {buckeyeLearnOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
                  <div className="p-2.5 bg-white rounded border border-gray-200">
                    <div className="font-semibold text-gray-900">Annual Institutional Data Security Training</div>
                    <div className="text-gray-500">Status: In Progress • 45 mins</div>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Learning Links (Screenshot 1 & 2) */}
            <div className="border-t border-gray-200 p-6 bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Learning Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-[13px] text-gray-800">
                <a href="#carmen" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    <FileText className="w-3 h-3 text-white" />
                  </div>
                  <span>My Carmen Courses</span>
                </a>
                <a href="#grades" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                    A+
                  </div>
                  <span>Final Grades</span>
                </a>
                <a href="#schedule-planner" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Schedule Planner</span>
                </a>
                <a href="#add-class" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Add a Class</span>
                </a>
                <a href="#drop-class" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Drop a Class</span>
                </a>
                <a href="#class-search" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Class Search (SIS)</span>
                </a>
                <a href="#academic-calendar" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Academic Calendar Full and Filterable View</span>
                </a>
                <a href="#degree-planner" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Degree Audit - Buckeye Degree Planner</span>
                </a>
                <a href="#my-academics" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>My Academics</span>
                </a>
              </div>
            </div>
          </div>

          {/* CARD 3: Accounts (BuckID Account, Statement of Account, Links) (Screenshot 2) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Accounts</h2>
            </div>

            {/* Row 1: BuckID Account */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setBuckIdOpen(!buckIdOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5 flex-wrap gap-1.5">
                  <div className="w-8 h-8 rounded-full bg-[#2f855a] text-white flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">BuckID Account</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    BuckID: <strong className="font-semibold">$60.94</strong>
                  </span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Dining Dollars: <strong className="font-semibold">$98.93</strong>
                  </span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    NoCharge Business: <strong className="font-semibold">$39.22</strong>
                  </span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Traditions: <strong className="font-semibold">44</strong>
                  </span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Traditions Grubhub: <strong className="font-semibold">47</strong>
                  </span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Traditions Plus: <strong className="font-semibold">1</strong>
                  </span>
                </div>
                <div className="text-gray-600">
                  {buckIdOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {buckIdOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-semibold text-gray-900">Recent BuckID Transactions:</div>
                    <div className="text-gray-600 mt-1">10/06 - Scott Traditions Dining (-1 Swipe)</div>
                    <div className="text-gray-600">10/05 - GrubHub Mirror Lake Eatery ($8.40 Dining Dollars)</div>
                  </div>

                  <div className="p-3 bg-white rounded border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-gray-900 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>After-Hours Building Access: <strong>Mason Hall Active</strong></span>
                      </div>
                      <div className="text-gray-500 text-[11px] mt-0.5">
                        Doors unlock via your student BuckID tap (7 PM–2 AM). Request access across 80 campus academic buildings.
                      </div>
                    </div>
                    {onOpenStudyAccess && (
                      <button
                        onClick={onOpenStudyAccess}
                        className="px-3 py-1.5 bg-[#ba0c2f] hover:bg-[#9d0a27] text-white font-bold rounded-lg text-xs transition-colors shrink-0 flex items-center space-x-1"
                      >
                        <span>Manage / Request Access</span>
                        <span>➔</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Statement of Account */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setStatementOpen(!statementOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#702459] text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">Statement of Account</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Balance Due: <strong className="font-semibold">$0.00</strong>
                  </span>
                </div>
                <div className="text-gray-600">
                  {statementOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {statementOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs">
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <span className="text-emerald-700 font-semibold">Account in Good Standing: </span>
                    Autumn 2026 tuition and fees fully covered by scholarship and TOPP payment.
                  </div>
                </div>
              )}
            </div>

            {/* Section: Accounts Links */}
            <div className="border-t border-gray-200 p-6 bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Accounts Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-[13px] text-gray-800">
                {onOpenStudyAccess && (
                  <button
                    onClick={onOpenStudyAccess}
                    className="flex items-center space-x-2.5 text-left hover:text-[#ba0c2f] group cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full border border-[#ba0c2f] text-[#ba0c2f] flex items-center justify-center shrink-0 group-hover:bg-[#ba0c2f] group-hover:text-white transition-colors">
                      <LinkIcon className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-semibold text-gray-900 group-hover:underline">
                      After-Hours Study Building Access (BuckID)
                    </span>
                    <span className="bg-[#ba0c2f]/10 text-[#ba0c2f] text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0">
                      80 Buildings
                    </span>
                  </button>
                )}
                <a href="#payer" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Authorized Payer Setup</span>
                </a>
                <a href="#account-info" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Student Account Information</span>
                </a>
                <a href="#topp" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Tuition Option Payment Plan (TOPP) Deadlines</span>
                </a>
                <a href="#finaid" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>My Financial Aid</span>
                </a>
                <a href="#scholarship-universe" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>ScholarshipUniverse</span>
                </a>
                <a href="#fafsa" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Free Application for Federal Student Aid</span>
                </a>
              </div>
            </div>
          </div>

          {/* CARD 4: Work (Net Pay, Weekly Timesheet, Links) (Screenshot 2 & 3) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Work</h2>
            </div>

            {/* Row 1: Net Pay */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setNetPayOpen(!netPayOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#38a169] text-white flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">Net Pay</span>
                  <span className="px-3 py-0.5 rounded-full border border-gray-300 text-xs text-gray-700 bg-white">
                    Payment Date: <strong className="font-semibold">08/21/2026</strong>
                  </span>
                </div>
                <div className="text-gray-600">
                  {netPayOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {netPayOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs">
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-semibold text-gray-900">Direct Deposit: Ohio State Payroll</div>
                    <div className="text-gray-600">Department: Fisher Student Academic Services • Paystub available in Workday</div>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Weekly Timesheet */}
            <div className="border-t border-gray-200">
              <div
                onClick={() => setTimesheetOpen(!timesheetOpen)}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/70 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#702459] text-white flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base text-gray-900 font-normal">Weekly Timesheet</span>
                </div>
                <div className="text-gray-600">
                  {timesheetOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
              {timesheetOpen && (
                <div className="px-6 pb-4 pt-1 bg-gray-50 border-t border-gray-100 text-xs">
                  <div className="p-3 bg-white rounded border border-gray-200">
                    Current Period: 12.5 Hours Logged • Status: Approved by Supervisor
                  </div>
                </div>
              )}
            </div>

            {/* Section: Work Links */}
            <div className="border-t border-gray-200 p-6 bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Work Links</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-[13px] text-gray-800">
                <a href="#hr-connection" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>HR Connection</span>
                </a>
                <a href="#work-study" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Federal Work Study Job Board</span>
                </a>
                <a href="#holiday" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Holiday Calendar</span>
                </a>
                <a href="#benefits" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Student Employee Benefits</span>
                </a>
                <a href="#tax" className="flex items-center space-x-2.5 hover:text-[#006699] hover:underline">
                  <div className="w-5 h-5 rounded-full border border-gray-400 text-gray-600 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-2.5 h-2.5" />
                  </div>
                  <span>Tax Information</span>
                </a>
              </div>
            </div>
          </div>

          {/* CARD 5: Resources (Wellness, Social) (Screenshot 3 & 4) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Resources</h2>
              
              {/* Tab Navigation: Wellness | Social */}
              <div className="flex space-x-8 mt-4 text-sm font-medium">
                <button
                  onClick={() => setResourceTab('Wellness')}
                  className={`flex flex-col items-center pb-2 border-b-2 transition-colors ${
                    resourceTab === 'Wellness'
                      ? 'border-[#006699] text-[#006699] font-semibold'
                      : 'border-transparent text-gray-600 hover:text-black'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mb-1">
                    <Heart className="w-4 h-4 text-[#006699]" />
                  </div>
                  <span>Wellness</span>
                </button>
                <button
                  onClick={() => setResourceTab('Social')}
                  className={`flex flex-col items-center pb-2 border-b-2 transition-colors ${
                    resourceTab === 'Social'
                      ? 'border-[#006699] text-[#006699] font-semibold'
                      : 'border-transparent text-gray-600 hover:text-black'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mb-1">
                    <UserCheck className="w-4 h-4 text-gray-600" />
                  </div>
                  <span>Social</span>
                </button>
              </div>
            </div>

            {/* Resources Content (Wellness) */}
            <div className="p-6 space-y-6">
              <h3 className="text-xl font-medium text-gray-900">Wellness</h3>

              {/* Exact Purple Crisis Box from Screenshot 3 & 4 */}
              <div className="border border-[#702459]/50 rounded-lg p-5 space-y-4 text-xs sm:text-[13px] text-gray-800 leading-relaxed">
                <div className="border-b border-[#702459]/30 pb-3">
                  <h4 className="text-base font-bold text-[#702459]">
                    How to Get Help in a Mental Health Crisis or Emergency
                  </h4>
                  <div className="text-sm font-medium text-[#702459] mt-0.5">
                    Get Help Now.
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-semibold text-gray-900">How to Get Help in a Crisis or Emergency</div>
                  <p>
                    If you or someone you know is an imminent danger to themselves or someone else, go to the nearest emergency department or call <strong className="text-[#990000] underline">9-1-1</strong>.
                  </p>
                  <p>
                    If you are thinking of harming yourself or if you are worried about someone else and need advice about what to do, call the suicide prevention lifeline at <strong className="text-[#990000] underline">614-221-5445</strong> or <strong className="text-[#990000] underline">988</strong> or reach the Crisis Text Line by texting <strong className="text-[#990000] underline">988</strong>.
                  </p>
                  <div className="pt-2">
                    <p>If you have experienced sexual assault, relationship violence, or stalking, consider the following:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-1 text-gray-700">
                      <li>Go to a safe place or call <strong className="text-[#990000] underline">9-1-1</strong>.</li>
                      <li>Call someone you trust.</li>
                      <li>Go to an emergency department for a free sexual assault exam.</li>
                    </ul>
                  </div>
                  <p className="pt-1">
                    You can also contact the 24/7 Helpline at <strong className="text-[#990000] underline">614-267-7020</strong> or <strong className="text-[#990000] underline">844-OHIO-HELP</strong>.
                  </p>
                  <p className="pt-1 text-gray-700">
                    Additional crisis resources are available through Student Life <strong className="text-black underline cursor-pointer">Counseling and Consultation Service</strong>.
                  </p>
                </div>
              </div>

              {/* Exact Get Support for Mental Health & Wellness Box (Screenshot 4) */}
              <div className="border border-gray-200 rounded-lg p-5 space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900">
                    Get Support for Mental Health &amp; Wellness
                  </h4>
                  <div className="text-xs text-gray-600 mt-0.5">We&apos;re Here to Help</div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-4 text-xs">
                  <div>
                    <a href="#hazing" className="text-[#006699] font-semibold hover:underline block">
                      Hazing Prevention
                    </a>
                    <p className="text-gray-600 mt-0.5">
                      Ohio State has a zero tolerance policy for hazing, but it&apos;s important to understand what hazing is to be able to prevent or report it.
                    </p>
                  </div>

                  <div className="flex items-start space-x-3 pt-2">
                    <div className="w-8 h-8 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <a href="#anxiety" className="text-[#006699] font-semibold hover:underline block">
                        Anxiety
                      </a>
                      <p className="text-gray-600 mt-0.5">
                        Anxiety is very common in college, but when this natural response to stress becomes intense or debilitating there are resources to help.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Announcements, Quick Links, Resources, Contact, Mobile Apps */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* CARD 1: Announcements (Screenshot 1) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Announcements</h2>
              <div className="w-7 h-7 rounded-full bg-[#ba0c2f] text-white flex items-center justify-center shadow-xs">
                <Megaphone className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-xs text-gray-700">You&apos;re in the clear! No new announcements!</p>
            <div className="flex justify-end pt-2">
              <button className="px-4 py-1.5 border border-gray-900 text-xs font-semibold uppercase tracking-wider text-gray-900 hover:bg-gray-50 rounded">
                VIEW ALL
              </button>
            </div>
          </div>

          {/* CARD 2: Quick Links (Screenshot 1) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Quick Links</h2>
              <div className="w-7 h-7 rounded-full bg-[#006699] text-white flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <div className="space-y-2.5 text-sm text-[#006699]">
              <div>
                <a href="#my-buckeye-link" className="hover:underline">My Buckeye Link</a>
              </div>
              <div>
                <a href="#my-todo" className="hover:underline">My To-Do List</a>
              </div>
              <div>
                <a href="#carmen" className="hover:underline">CarmenCanvas</a>
              </div>
              <div>
                <a
                  href="#oncourse"
                  onClick={onOpenScheduling}
                  className="hover:underline"
                >
                  Advising Appointments and Notes (OnCourse)
                </a>
              </div>
              <div>
                <a href="#financial-aid" className="hover:underline">My Financial Aid</a>
              </div>
              <div>
                <a href="#workday" className="hover:underline">Workday</a>
              </div>
              <div>
                <a href="#it-service" className="hover:underline">IT Self-Service</a>
              </div>
              {onOpenStudyAccess && (
                <div className="pt-1 border-t border-gray-100">
                  <button
                    onClick={onOpenStudyAccess}
                    className="hover:underline font-semibold text-[#ba0c2f] flex items-center space-x-1.5 text-left cursor-pointer"
                  >
                    <span>After-Hours Study Access (BuckID)</span>
                    <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold">New</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button className="px-4 py-1.5 border border-gray-900 text-xs font-semibold uppercase tracking-wider text-gray-900 hover:bg-gray-50 rounded">
                EDIT
              </button>
            </div>
          </div>

          {/* CARD 3: Important Resources (Screenshot 2) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Important Resources</h2>
              <div className="w-7 h-7 rounded-full bg-[#990000] text-white flex items-center justify-center text-xs font-bold">
                0
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {/* Item 1: Safety Resources */}
              <div className="flex items-start space-x-3 text-xs">
                <div className="w-16 h-12 bg-[#ba0c2f] rounded flex items-center justify-center text-white text-[9px] font-bold text-center p-1 shrink-0">
                  SAFETY RESOURCES AT OHIO STATE
                </div>
                <div>
                  <a href="#safety" className="font-semibold text-[#006699] hover:underline block">
                    Safety Resources
                  </a>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Watch Videos, View Tips and Access Resources
                  </p>
                </div>
              </div>

              {/* Item 2: Add Non-Emergency OSU Police */}
              <div className="flex items-start space-x-3 text-xs">
                <div className="w-16 h-12 bg-gray-800 rounded flex items-center justify-center text-white text-[9px] font-bold text-center p-1 shrink-0">
                  <Smartphone className="w-5 h-5 text-gray-300" />
                </div>
                <div>
                  <a href="#police" className="font-semibold text-[#006699] hover:underline block leading-snug">
                    Add the Non-Emergency OSU Police Number to Your Phone
                  </a>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    Your Safety Is Our Number One Priority
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button className="px-4 py-1.5 border border-gray-900 text-xs font-semibold uppercase tracking-wider text-gray-900 hover:bg-gray-50 rounded">
                VIEW ALL
              </button>
            </div>
          </div>

          {/* CARD 4: Contact Buckeye Link (Screenshot 2 & 3) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Contact Buckeye Link</h2>
              <div className="w-7 h-7 rounded-full bg-[#702459] text-white flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-[#006699] text-white flex items-center justify-center shrink-0">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center space-x-1">
                  <span>Request help at</span>
                  <a href="https://help.osu.edu" target="_blank" rel="noreferrer" className="text-[#006699] font-semibold hover:underline flex items-center space-x-0.5">
                    <span>help.osu.edu</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span>Phone: </span>
                  <a href="tel:6142920300" className="text-[#006699] font-semibold hover:underline">
                    614-292-0300
                  </a>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-2">
                <div
                  onClick={() => setOfficeOpen(!officeOpen)}
                  className="flex items-center justify-between cursor-pointer py-1"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-gray-900">Buckeye Link Office</span>
                  </div>
                  {officeOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>

                {officeOpen && (
                  <div className="pl-9 pt-1 text-[11px] text-gray-600 space-y-1">
                    <div>Student Academic Services Building, Lobby</div>
                    <div>281 W. Lane Ave., Columbus, OH 43210</div>
                    <div>Hours: Monday - Thursday 9am - 5pm, Friday 9am - 4pm</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CARD 5: Mobile Apps (Screenshot 3 & 4) */}
          <div className="bg-white rounded-lg shadow-2xs border border-gray-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-medium text-gray-900 tracking-tight">Mobile Apps</h2>
              <div className="w-7 h-7 rounded-full bg-gray-600 text-white flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* App 1: Ohio State App */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-base font-bold text-gray-900">Ohio State</h3>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-white border border-gray-200 rounded flex items-center justify-center p-1 shrink-0 shadow-2xs">
                  <OhioStateLogo className="w-8 h-8 object-contain" />
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  The Ohio State app is a must-have for all Buckeyes. Use it to catch the next bus, find your way around campus or grab a bite to eat. Don&apos;t forget to sign in for personalized features including grades and account balances, personalized news, wellness resources and more.
                </p>
              </div>

              {/* App Store & Google Play Badges */}
              <div className="flex items-center space-x-2 pt-1">
                <div className="bg-black text-white px-2.5 py-1 rounded flex items-center space-x-1.5 cursor-pointer text-[10px]">
                  <span>🍏</span>
                  <div>
                    <div className="text-[7px] uppercase leading-none">Download on the</div>
                    <div className="font-bold text-[9px] leading-tight">App Store</div>
                  </div>
                </div>
                <div className="bg-black text-white px-2.5 py-1 rounded flex items-center space-x-1.5 cursor-pointer text-[10px]">
                  <span>▶</span>
                  <div>
                    <div className="text-[7px] uppercase leading-none">GET IT ON</div>
                    <div className="font-bold text-[9px] leading-tight">Google Play</div>
                  </div>
                </div>
              </div>
            </div>

            {/* App 2: Ohio State: Wellness App */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h3 className="text-base font-bold text-gray-900">Ohio State: Wellness</h3>
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-[#702459] rounded flex items-center justify-center text-white shrink-0">
                  <Heart className="w-5 h-5 text-white" />
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Find resources, connect to support, set goals and build healthy habits. The Ohio State: Wellness app supports your mental health and well-being on campus. Whether you&apos;re looking to find resources for yourself or someone you care about, the Wellness app is a great place to start.
                </p>
              </div>

              {/* App Store & Google Play Badges */}
              <div className="flex items-center space-x-2 pt-1">
                <div className="bg-black text-white px-2.5 py-1 rounded flex items-center space-x-1.5 cursor-pointer text-[10px]">
                  <span>🍏</span>
                  <div>
                    <div className="text-[7px] uppercase leading-none">Download on the</div>
                    <div className="font-bold text-[9px] leading-tight">App Store</div>
                  </div>
                </div>
                <div className="bg-black text-white px-2.5 py-1 rounded flex items-center space-x-1.5 cursor-pointer text-[10px]">
                  <span>▶</span>
                  <div>
                    <div className="text-[7px] uppercase leading-none">GET IT ON</div>
                    <div className="font-bold text-[9px] leading-tight">Google Play</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
