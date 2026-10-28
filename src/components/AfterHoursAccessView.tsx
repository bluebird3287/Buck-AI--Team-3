import React, { useState } from 'react';
import {
  Building2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Check,
  Send,
  X,
  BookOpen,
  CreditCard,
  MapPin,
  ChevronRight,
  Filter,
  Sparkles
} from 'lucide-react';
import { StudentProfile } from '../data/sampleData';
import campusData from '../data/osuBuildings.json';

type OsuBuilding = (typeof campusData.buildings)[number];
type HoursDay = OsuBuilding['libraries'][number]['week'][number];

export type CampusBuilding = Omit<OsuBuilding, 'code'> & {
  code: string;
  area: string;
  isLibrary: boolean;
  locksAt: string;
  weekendStatus: string;
  notes: string;
};

const LIBRARY_WEEK = campusData.libraryWeek;

// Date in Columbus as YYYY-MM-DD, to find today's column in the scraped weekly library hours
function columbusDate(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Library hours are a one-week snapshot; once that week has passed, point students to the live page
export function isLibraryWeekCurrent(): boolean {
  return LIBRARY_WEEK.some((d) => d.date === columbusDate());
}

function hoursFor(week: HoursDay[], dayName: string): string | null {
  return week.find((d) => d.day === dayName)?.hours ?? null;
}

// "Mon–Thu 24 Hours · Fri 7:30am - 10:00pm · …": groups consecutive days with the same hours
export function summarizeWeek(week: HoursDay[]): string {
  const groups: { from: string; to: string; hours: string }[] = [];
  for (const { day, hours } of week) {
    const label = hours ?? 'Not listed';
    const last = groups[groups.length - 1];
    if (last && last.hours === label) last.to = day;
    else groups.push({ from: day, to: day, hours: label });
  }
  return groups
    .map((g) => `${g.from.slice(0, 3)}${g.from === g.to ? '' : `–${g.to.slice(0, 3)}`} ${g.hours}`)
    .join(' · ');
}

function describeLocks(b: OsuBuilding): string {
  const library = b.libraries[0];
  if (library) {
    const today = library.week.find((d) => d.date === columbusDate());
    return today ? `Today: ${today.hours ?? 'not listed'}` : 'See this week’s library hours';
  }
  const buildingSpot = b.studySpots.find((s) => s.scope === 'building');
  if (buildingSpot) return buildingSpot.hours[0];
  if (b.studySpots.length) return 'Building hours not published (lab hours below)';
  return 'Hours not published';
}

function describeWeekend(b: OsuBuilding): string {
  const library = b.libraries[0];
  if (library) return `Sat ${hoursFor(library.week, 'Saturday') ?? '—'} · Sun ${hoursFor(library.week, 'Sunday') ?? '—'}`;
  if (b.studySpots.length) return 'See study spot hours';
  return 'Ask the departments in this building';
}

// Every Columbus and Medical Center building from the OSU buildings directory (see scripts/build-campus-data.mjs)
export const ALL_CAMPUS_BUILDINGS: CampusBuilding[] = campusData.buildings.map((b) => ({
  ...b,
  code: b.code ?? b.id,
  area: b.campus === 'Medical Center' ? 'Medical Center' : 'Columbus campus',
  isLibrary: b.category === 'Libraries',
  locksAt: describeLocks(b),
  weekendStatus: describeWeekend(b),
  notes: b.departments.length ? b.departments.join(' · ') : 'No departments listed',
}));

const BUILDINGS_WITH_HOURS = ALL_CAMPUS_BUILDINGS.filter((b) => b.libraries.length || b.studySpots.length);

const CATEGORY_ORDER = [
  'Libraries',
  'Business',
  'Engineering',
  'Arts & Humanities',
  'Sciences & Math',
  'Social Sciences & Education',
  'Agriculture & Environment',
  'Health & Medicine',
  'Student Life & Housing',
  'Athletics & Recreation',
  'Administration & Other',
  'Parking & Operations',
];

const BuildingDetails: React.FC<{ building: CampusBuilding }> = ({ building }) => {
  const amenities = [
    building.accessibleEntrances.length > 0 && `Accessible entrances: ${building.accessibleEntrances.join(', ')}`,
    building.wellnessRooms > 0 && `${building.wellnessRooms} wellness room${building.wellnessRooms === 1 ? '' : 's'}`,
    building.genderInclusiveRestrooms > 0 &&
      `${building.genderInclusiveRestrooms} gender-inclusive restroom${building.genderInclusiveRestrooms === 1 ? '' : 's'}`,
    building.lactationRooms > 0 && `${building.lactationRooms} lactation room${building.lactationRooms === 1 ? '' : 's'}`,
  ].filter(Boolean) as string[];
  const hasHours = building.libraries.length > 0 || building.studySpots.length > 0;

  return (
    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3 text-[11px] text-gray-700">
      {building.libraries.map((lib) => (
        <div key={lib.name} className="space-y-1">
          <div className="font-bold text-gray-900">
            {lib.name} — week of {lib.week[0]?.date}{' '}
            <a href={lib.url} target="_blank" rel="noreferrer" className="font-normal text-[#ba0c2f] hover:underline">upcoming hours ↗</a>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-0.5">
            {lib.week.map((d) => (
              <React.Fragment key={d.day}>
                <span className="text-gray-500">{d.day}</span>
                <span>{d.hours ?? 'Not listed'}</span>
              </React.Fragment>
            ))}
          </div>
          {lib.studyRooms.map((room) => (
            <div key={room.name}>
              <strong>{room.name}:</strong> {summarizeWeek(room.week)}
            </div>
          ))}
        </div>
      ))}

      {building.studySpots.map((spot) => (
        <div key={spot.name} className="space-y-0.5">
          <div className="font-bold text-gray-900">
            {spot.name} <span className="font-normal text-gray-500">· {spot.who}</span>
          </div>
          {spot.hours.map((line) => (
            <div key={line}>{line}</div>
          ))}
          <div className="text-gray-600">{spot.access}</div>
          {'closures' in spot && spot.closures && <div className="text-amber-800">{spot.closures}</div>}
          <a href={spot.sourceUrl} target="_blank" rel="noreferrer" className="text-[#ba0c2f] hover:underline">Source ↗</a>
        </div>
      ))}

      {!hasHours && (
        <div className="flex items-start gap-1.5 text-gray-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            OSU doesn’t publish hours for this building. Many academic buildings lock outside business hours and then open only
            for BuckIDs a department has approved — ask {building.departments.length ? 'one of the departments listed above' : 'the building’s main office'} or request access here.
          </span>
        </div>
      )}

      {amenities.length > 0 && <div><strong>Amenities:</strong> {amenities.join(' · ')}</div>}

      <a href={building.mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#ba0c2f] hover:underline">
        <MapPin className="w-3 h-3" /> {building.address ?? 'View'} on the OSU campus map ↗
      </a>
    </div>
  );
};

export interface UserAccessItem {
  id: string;
  buildingName: string;
  code: string;
  hours: string;
  term: string;
  status: 'active' | 'waiting';
  notes: string;
}

interface AfterHoursAccessViewProps {
  profile: StudentProfile;
}

export const AfterHoursAccessView: React.FC<AfterHoursAccessViewProps> = ({ profile }) => {
  // Simple view switcher: 'request' | 'my-access' | 'all-buildings'
  const [activeTab, setActiveTab] = useState<'request' | 'my-access' | 'all-buildings'>('request');

  // Libraries every student can use during posted hours, plus the prototype's demo BuckID pass
  const [myAccess, setMyAccess] = useState<UserAccessItem[]>(() => [
    ...ALL_CAMPUS_BUILDINGS.filter((b) => b.id === '005' || b.id === '050').flatMap((b) =>
      b.libraries
        .filter((lib) => lib.name !== 'Research Commons')
        .map((lib) => ({
          id: `lib-${b.id}-${lib.name}`,
          buildingName: lib.name,
          code: b.code,
          hours: `This week: ${summarizeWeek(lib.week)}`,
          term: 'Open to all students',
          status: 'active' as const,
          notes: 'No request needed during library hours. Bring your BuckID; some hours require a current OSU ID.',
        }))
    ),
    {
      id: 'acc-3',
      buildingName: 'Mason Hall (Fisher College)',
      code: 'MH',
      hours: 'Demo pass: evening access',
      term: 'Autumn 2026 Semester',
      status: 'active',
      notes: 'Sample approval for this prototype. Real after-hours access is granted by Fisher.'
    }
  ]);

  // Pending requests waiting for approval (sample data for the prototype)
  const [pendingRequests, setPendingRequests] = useState<UserAccessItem[]>([
    {
      id: 'req-1',
      buildingName: 'Dreese Laboratories',
      code: 'DL',
      hours: 'Weekends (Saturday & Sunday study sessions)',
      term: 'Autumn 2026 Semester',
      status: 'waiting',
      notes: 'Sample request sent to Computer Science and Engineering.'
    }
  ]);

  // Request form state
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('279');
  const [formFilterQuery, setFormFilterQuery] = useState<string>('');
  const [formCategoryFilter, setFormCategoryFilter] = useState<string>('All');
  const [selectedTimeOption, setSelectedTimeOption] = useState<string>('Evenings (Tonight & weeknights after building locks)');
  const [selectedDuration, setSelectedDuration] = useState<string>('The whole semester');
  const [selectedReason, setSelectedReason] = useState<string>('Studying for exams');
  const [requestSentSuccess, setRequestSentSuccess] = useState<string | null>(null);

  // Search & filter state for building directory tab
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);

  const selectedBuildingObj = ALL_CAMPUS_BUILDINGS.find((b) => b.id === selectedBuildingId) || ALL_CAMPUS_BUILDINGS[0];

  // Buildings available in the form dropdown based on form filter
  const dropdownBuildings = ALL_CAMPUS_BUILDINGS.filter((b) => {
    const matchesText =
      b.name.toLowerCase().includes(formFilterQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(formFilterQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(formFilterQuery.toLowerCase());
    const matchesCategory = formCategoryFilter === 'All' || b.category === formCategoryFilter;
    return matchesText && matchesCategory;
  });

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedBuildingObj.isLibrary) {
      alert('Libraries are open to students during their posted hours, so no request is needed.');
      return;
    }

    const newReq: UserAccessItem = {
      id: `req-${Date.now()}`,
      buildingName: selectedBuildingObj.name,
      code: selectedBuildingObj.code,
      hours: selectedTimeOption,
      term: selectedDuration,
      status: 'waiting',
      notes: selectedBuildingObj.departments.length
        ? `Sent for approval to: ${selectedBuildingObj.departments.join(', ')}.`
        : 'Sent to the building’s facilities staff for approval.'
    };

    setPendingRequests((prev) => [newReq, ...prev]);
    setRequestSentSuccess(selectedBuildingObj.name);

    setTimeout(() => {
      setActiveTab('my-access');
      setRequestSentSuccess(null);
    }, 1500);
  };

  const handleCancelRequest = (reqId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  // Filtered building list for the directory tab
  const filteredBuildings = ALL_CAMPUS_BUILDINGS.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || b.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoriesList = ['All', ...CATEGORY_ORDER];

  // Today's library hours only make sense while the scraped week is still this week
  const libraryWeekCurrent = isLibraryWeekCurrent();
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-gray-900 pb-10">
      
      {/* 1. Super-Simple Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ba0c2f]" />
              <h2 className="text-xl font-bold tracking-tight text-gray-900">
                After-Hours Study Access
              </h2>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Find somewhere to get work done. Libraries and the spots below are open to students during their posted hours. After hours, most academic buildings only open for BuckIDs that the building’s department has approved, so you can request access to any of the <strong>{ALL_CAMPUS_BUILDINGS.length} campus buildings</strong> here.
            </p>
          </div>

          <div className="text-xs bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg shrink-0">
            <span className="text-gray-500">Cardholder:</span>{' '}
            <strong className="text-gray-900">{profile.name}</strong> •{' '}
            <span className="font-mono text-gray-600">ID #{profile.osuId}</span>
          </div>
        </div>

        {/* Where to study today: real library hours and hand-checked study spots */}
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-2">
          <div className="flex items-start space-x-2.5">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-emerald-950">
                {libraryWeekCurrent ? `Library hours today (${todayName})` : 'Library hours'}
              </strong>{' '}
              — no request needed.{' '}
              {!libraryWeekCurrent && (
                <>
                  These hours are from the week of {LIBRARY_WEEK[0]?.date}; check{' '}
                  <a href="https://library.osu.edu/hours" target="_blank" rel="noreferrer" className="underline">library.osu.edu/hours</a> for this week.
                </>
              )}
            </div>
          </div>
          {libraryWeekCurrent && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pl-6">
              {BUILDINGS_WITH_HOURS.flatMap((b) =>
                b.libraries.map((lib) => (
                  <div key={`${b.id}-${lib.name}`} className="flex justify-between gap-2">
                    <a href={lib.url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{lib.name}</a>
                    <span className="text-right text-emerald-800">{lib.week.find((d) => d.day === todayName)?.hours ?? 'Not listed'}</span>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="pl-6 text-[11px] text-emerald-800">
            More study spots with posted hours: {BUILDINGS_WITH_HOURS.flatMap((b) => b.studySpots.map((s) => s.name)).join(' · ')}. Find them under Campus Buildings.
          </div>
        </div>
      </div>

      {/* 2. Dead-Simple Navigation (3 Tabs) */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-2 pt-2 gap-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('request')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'request'
              ? 'bg-[#ba0c2f] text-white'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Request Access</span>
        </button>

        <button
          onClick={() => setActiveTab('my-access')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'my-access'
              ? 'bg-[#ba0c2f] text-white'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>My BuckID Access</span>
          {pendingRequests.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'my-access' ? 'bg-white text-[#ba0c2f]' : 'bg-[#ba0c2f] text-white'
            }`}>
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('all-buildings')}
          className={`px-4 py-2.5 rounded-t-lg transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
            activeTab === 'all-buildings'
              ? 'bg-[#ba0c2f] text-white'
              : 'text-gray-600 hover:text-black hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Campus Buildings Database ({ALL_CAMPUS_BUILDINGS.length})</span>
        </button>
      </div>

      {/* TAB 1: SIMPLE REQUEST ACCESS FORM */}
      {activeTab === 'request' && (
        <div className="bg-white rounded-b-xl border border-gray-200 p-5 sm:p-6 shadow-xs space-y-5">
          {requestSentSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Request sent for {requestSentSuccess}!</strong> We routed it to the building staff. Taking you to your tracking list...
              </div>
            </div>
          )}

          <div>
            <h3 className="text-base font-bold text-gray-900">
              Pick any building on campus to unlock
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose from all {ALL_CAMPUS_BUILDINGS.length} Ohio State buildings. Your request goes to the departments in that building; once approved, your BuckID will let you in.
            </p>
          </div>

          <form onSubmit={handleSendRequest} className="space-y-5">
            {/* Step 1: Pick the building with instant search & filter */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  1. Which building do you need? ({dropdownBuildings.length} available)
                </label>

                {/* Quick search input to find any building in seconds */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Type building (e.g. Scott, Arps)..."
                    value={formFilterQuery}
                    onChange={(e) => setFormFilterQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-gray-300 focus:border-[#ba0c2f] outline-none"
                  />
                  {formFilterQuery && (
                    <button
                      type="button"
                      onClick={() => setFormFilterQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Quick Chips for Form */}
              <div className="flex gap-1 overflow-x-auto pb-2 text-[11px]">
                {['All', 'Business', 'Engineering', 'Arts & Humanities', 'Sciences & Math', 'Social Sciences & Education', 'Agriculture & Environment', 'Health & Medicine'].map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setFormCategoryFilter(cat)}
                    className={`px-2.5 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                      formCategoryFilter === cat
                        ? 'bg-gray-800 text-white font-bold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <select
                value={selectedBuildingId}
                onChange={(e) => setSelectedBuildingId(e.target.value)}
                className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-[#ba0c2f] focus:ring-1 focus:ring-[#ba0c2f] outline-none"
              >
                {dropdownBuildings.length === 0 ? (
                  <option disabled>No buildings matching &quot;{formFilterQuery}&quot;</option>
                ) : (
                  dropdownBuildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) — {b.locksAt}
                    </option>
                  ))
                )}
              </select>

              {/* Instant Building Summary Info */}
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-gray-900 flex items-center justify-between">
                  <span>{selectedBuildingObj.name}</span>
                  <span className="text-[11px] text-gray-500 font-normal">{selectedBuildingObj.area} • {selectedBuildingObj.category}</span>
                </div>
                <div className="text-gray-600 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span><strong>Hours:</strong> {selectedBuildingObj.locksAt}</span>
                  <span>•</span>
                  <span><strong>Weekends:</strong> {selectedBuildingObj.weekendStatus}</span>
                  {selectedBuildingObj.address && (
                    <>
                      <span>•</span>
                      <a href={selectedBuildingObj.mapUrl} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" /> {selectedBuildingObj.address}
                      </a>
                    </>
                  )}
                </div>
                <p className="text-gray-500 text-[11px] pt-0.5">
                  {selectedBuildingObj.notes}
                </p>
                {selectedBuildingObj.isLibrary && (
                  <div className="mt-1 text-emerald-700 font-bold text-[11px]">
                    ✓ This library is open to students during its posted hours. No request is needed.
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: When do you need it? */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                2. When do you need access?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { title: 'Evenings', desc: 'Tonight & weeknights after building locks' },
                  { title: 'Weekends', desc: 'Saturday & Sunday study sessions' },
                  { title: 'Full Semester', desc: 'All evenings and weekends this semester' }
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.title}
                    onClick={() => setSelectedTimeOption(opt.title + ' (' + opt.desc + ')')}
                    className={`p-3 rounded-xl border text-left transition-all text-xs ${
                      selectedTimeOption.startsWith(opt.title)
                        ? 'border-[#ba0c2f] bg-red-50/60 ring-1 ring-[#ba0c2f]'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="font-bold text-gray-900">{opt.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Why do you need it? */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                3. What are you using the space for?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  'Studying for exams',
                  'Group project',
                  'Using computer labs',
                  'Quiet individual study'
                ].map((reason) => (
                  <button
                    type="button"
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={`p-2.5 rounded-lg border text-center transition-all text-xs font-medium ${
                      selectedReason === reason
                        ? 'border-[#ba0c2f] bg-red-50 text-[#ba0c2f] font-bold'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Access is assigned directly to your <strong>BuckID</strong>.
              </span>
              <button
                type="submit"
                disabled={selectedBuildingObj.isLibrary}
                className="bg-[#ba0c2f] hover:bg-[#9d0a27] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <span>Send Request</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: MY BUCKID ACCESS & TRACKING */}
      {activeTab === 'my-access' && (
        <div className="space-y-5">
          {/* Active Access List */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Buildings you can enter right now ({myAccess.length})</span>
                </h3>
                <p className="text-xs text-gray-500">
                  Just tap your BuckID at the outside door scanner to enter.
                </p>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                Active on BuckID
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {myAccess.map((item) => (
                <div key={item.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-gray-900 text-sm">{item.buildingName}</div>
                    <span className="font-mono text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-600 font-bold">
                      {item.code}
                    </span>
                  </div>
                  <div className="text-gray-700 font-medium">
                    {item.hours}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {item.notes}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Requests waiting for approval ({pendingRequests.length})</span>
                </h3>
                <p className="text-xs text-gray-500">
                  The building staff is reviewing your request.
                </p>
              </div>
              {pendingRequests.length > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                  In Review
                </span>
              )}
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs">
                You have no pending requests right now.
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-gray-900 text-sm flex items-center space-x-1.5">
                        <span>{req.buildingName}</span>
                        <span className="text-[10px] font-mono text-gray-500">({req.code})</span>
                      </div>
                      <div className="text-gray-700 font-medium">{req.hours}</div>
                      <div className="text-[11px] text-gray-500">{req.notes}</div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] text-amber-800 bg-amber-100 font-semibold px-2.5 py-1 rounded-lg">
                        Waiting on Department
                      </span>
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors text-xs"
                        title="Cancel this request"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETE CAMPUS BUILDINGS DATABASE (80 BUILDINGS) */}
      {activeTab === 'all-buildings' && (
        <div className="bg-white rounded-b-xl border border-gray-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                All Ohio State Campus Buildings ({ALL_CAMPUS_BUILDINGS.length})
              </h3>
              <p className="text-xs text-gray-500">
                Every Columbus and Medical Center building in the{' '}
                <a href="https://maps.osu.edu" target="_blank" rel="noreferrer" className="underline">OSU buildings directory</a>.
                Hours are shown only where OSU publishes them ({BUILDINGS_WITH_HOURS.length} buildings); study spot details checked {campusData.studySpotsVerifiedOn}.
              </p>
            </div>

            {/* Simple Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, code, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:border-[#ba0c2f] outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {categoriesList.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#ba0c2f] text-white font-bold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results Summary */}
          <div className="text-[11px] text-gray-500 flex items-center justify-between">
            <span>Showing {filteredBuildings.length} of {ALL_CAMPUS_BUILDINGS.length} campus buildings</span>
            {selectedCategory !== 'All' && (
              <button
                onClick={() => setSelectedCategory('All')}
                className="text-[#ba0c2f] hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {/* Building Cards List */}
          <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto pr-1">
            {filteredBuildings.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                No buildings found matching &quot;{searchQuery}&quot;. Try searching by name or building code.
              </div>
            ) : (
              filteredBuildings.map((building) => (
                <div key={building.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-gray-50/80 px-2 rounded-lg transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 text-sm">{building.name}</span>
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-semibold">
                        {building.code}
                      </span>
                      {building.isLibrary && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                          Open to students
                        </span>
                      )}
                      {building.studySpots.length > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                          Study spot
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span><strong>Hours:</strong> {building.locksAt}</span>
                      <span>•</span>
                      <span><strong>Weekends:</strong> {building.weekendStatus}</span>
                      <span>•</span>
                      <span className="text-gray-500 font-medium">{building.area}</span>
                      <span>•</span>
                      <span className="text-gray-400">{building.category}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {building.notes}
                    </div>
                    <button
                      onClick={() => setExpandedBuildingId(expandedBuildingId === building.id ? null : building.id)}
                      className="text-[11px] font-semibold text-[#ba0c2f] hover:underline"
                    >
                      {expandedBuildingId === building.id ? 'Hide details' : 'Hours, access & amenities'}
                    </button>
                    {expandedBuildingId === building.id && <BuildingDetails building={building} />}
                  </div>

                  {!building.isLibrary && (
                    <button
                      onClick={() => {
                        setSelectedBuildingId(building.id);
                        setActiveTab('request');
                      }}
                      className="self-start sm:self-center text-xs font-bold text-[#ba0c2f] hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Request Access ➔
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
