# Buck AI — BuckeyeLink AI Advising Assistant

Team 3 (Buck AI), BUSADM 2802, Fall 2026.

## What this is

An AI academic-advising tool embedded in a mock-up of Ohio State's BuckeyeLink
portal. It exists because OSU undergrads can't reach an advisor during peak
registration (appointments back up for weeks) and course details are scattered
across BuckeyeLink, the Registrar, PDFs, RateMyProfessors, and the OSU subreddit.
The app brings answers into one place, cites OSU rules, and routes anything
high-stakes to a human advisor.

- Stack: React + Vite front end, an Express server (`server.ts`), deployed on Vercel.
- AI: Claude (via `@anthropic-ai/sdk`) powers the advising chat and the 4-year
  roadmap. The server reads `ANTHROPIC_API_KEY`; without it, built-in fallback
  answers are served.
- Env var names are Vite-style: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  (public). `ANTHROPIC_API_KEY` and `SUPABASE_SECRET_KEY` are server-only and never
  get a `VITE_` prefix.

## Roles table — who can do what

These rules apply to every feature. Follow them on every request. Enforce them in
the database (Supabase row-level security), not just on the screen. A logged-out
user who opens a protected page is sent to sign in.

| Action | Student | Advisor | Logged out |
|---|---|---|---|
| View the BuckeyeLink dashboard (holds, profile, credits) | Own only | No | No → sign in |
| Ask the AI advising chat | Yes, as themselves | Yes, as themselves | No → sign in |
| View & rebalance the 4-year roadmap | Own only | No | No → sign in |
| Add / track seat alerts | Own only | No | No → sign in |
| Request after-hours building access | Own only | No | No → sign in |
| Book an advisor appointment | Own only | No | No → sign in |
| Escalate a high-stakes decision to an advisor | Own only (creates a request) | No | No → sign in |
| View faculty evaluations & peer tips | Yes | Yes | Yes, read-only (public) |
| View the advisor queue (requests routed in) | No | All requests, own advisees first and flagged | No |
| Act on a routed request (clear a hold, approve/deny) | No | Any request (own advisees, or others' when they have time) | No |
| Set own availability (calendar import, weekly hours, days off) | No | Own only | No |
| View a student's record | Own only | Through a request only | No |

Notes:
- Advisors land on their queue of routed student requests, not on a student
  dashboard. They see a student's details only through that student's request.
- Each student belongs to the advisor named on their Advising Report. The queue opens on
  "My advisees"; "Other students" shows everyone else's requests (flagged with whose advisee
  they are, or "Unassigned") so an advisor with time can answer them.
- Faculty evaluations are public (readable without signing in), like a shared link.
- The signed-in user's ID is saved with everything they create.

## Sign-in

Email magic links via Supabase Auth. No passwords, ever. Collect only an email,
never an OSU password or student ID. Sketch: `docs/wireframes/sign-in.png`.

Only @osu.edu / @buckeyemail.osu.edu addresses can create accounts (trigger `reject_non_osu_signup`
on `auth.users`, plus a check in `SignIn.tsx`); the two demo advisor Gmail logins are allowlisted in
`is_allowed_signup`. This only means something while Supabase "Confirm email" is on.

## Fisher curriculum data

The pilot is Fisher College of Business only. Degree requirements live in Supabase
(`programs`, `requirement_groups`, `requirement_courses`; public read-only) and come from
Fisher's published BSBA curriculum for students who entered Spring 2027 or earlier:
Business Foundation, Advanced Writing, Business Core, General Education, and each
specialization's major core (https://fisher.osu.edu/undergraduate/academics/curriculum-requirements).

- Edit `scripts/fisher_requirements.py`, regenerate the seed SQL in `supabase/migrations/`,
  and apply it. Don't hand-edit the generated SQL.
- Students can have more than one specialization (`student_profiles.specialization_ids`).
  Fisher doesn't publish a double-counting rule, so a course shared by two specializations
  counts for both and is flagged for the advisor. Tech Innovation (new Autumn 2026) comes from
  the OAA proposal's curriculum sheet.
- `src/lib/requirements.ts` checks a student's classes against those requirements (grades,
  "choose N" and credit-hour electives, prerequisites) and feeds the result to the AI.
- GE Foundations and Themes (requirement group kind `ge`) are checked against the registrar's
  GEN tags in `src/data/geCourses.json` (refresh each term with `python3 scripts/build_ge_data.py`).
  One course fills one GE category; a Theme is one 4-credit course or two 3-credit courses from
  different subjects; Citizenship plus one other Theme.
- `requirement_courses.offered_terms` (from the Autumn 2026/Spring 2027 schedule; `None` = not
  scheduled) and `min_standing` (30/60/90 earned hours) drive the plan's timing checks.
  Planned courses must be real course codes; only `ELECTIVE` is allowed as a placeholder.
- Fisher's Autumn 2027 redesigned curriculum isn't published yet; add it as new programs
  when it is.
- Fisher minors (kind `minor`) power the What-If Minor Audit. `excluded_programs` marks
  who can't take a minor (`fisher-bsba` = any BSBA student). Regenerate with
  `python3 scripts/fisher_requirements.py minors`.

## Entering class (cohort) and special programs

Requirements depend on when a student entered Ohio State. Students save `entry_term` and
`expected_graduation` (term ids like `autumn-2024`) on their profile; if `entry_term` is empty, their
earliest term on record is used (`entryTermOf`).

- `programs.entry_from` / `entry_through` give the entering terms a version applies to (null = open-ended).
  Other versions of a program point at it with `version_of`; students always save the base id, and
  `curriculumFor(library, degreeId, { entryTerm, specialProgramIds })` swaps in the matching version
  (keeping the base id). With no matching version it uses the closest one and adds a `cohortNotes` warning.
- Current versions: `fisher-bsba` (entered Autumn 2022–Spring 2027) and `fisher-bsba-gel` (before Autumn 2022,
  GE Legacy instead of the current GE). Entrants from Autumn 2027 on get a warning until Fisher publishes the
  redesigned curriculum (add it as a new version). Engineering degrees are the 2026-2027 sheets (`entry_from
  autumn-2026`), so earlier entrants see a "confirm your year's sheet" note.
- Special programs are `kind = 'special'` rows a student opts into (`student_profiles.special_program_ids`):
  Accounting Honors (Class of 2028+ from the program director's structure sheet; `-2027` version for earlier
  classes), Finance Honors, Honors Leadership, Honors Cohort, IBE Core and Software Innovation tracks,
  Honors Research Distinction, Accelerated BSBA/MAcc, and University Honors (`parent_id` null = any degree).
  Each adds requirement groups and can change the degree through `adjustments`
  (`substitute`: ACCTMIS 5200H for 4200; `waive`: BUSMHR 2292 for Accounting Honors, BUSOBA 2321 once
  ACCTMIS 3100H is on the plan, GENED 4001 for IBE). `requires_programs` names the specialization a program
  is for (warning only).
- An honors section always counts for the regular course (ACCTMIS 3200H for ACCTMIS 3200), including prerequisites.
- When the team sends an updated curriculum sheet (e.g. a new honors structure), add it to
  `SPECIAL_PROGRAMS` in `scripts/fisher_requirements.py` as a new version with its entry window, and
  regenerate with `python3 scripts/fisher_requirements.py degree`.

## College of Engineering curriculum data

All 14 College of Engineering BS degrees (2026-2027 admits) live in the same tables, with
`college = 'College of Engineering'`. Specializations name their degree in `programs.parent_id`
(ECE: Electrical/Computer; FABE: Food/Agricultural/Biological/Ecological; Engineering Physics: eight
concentrations; ISE: five tracks; Aviation: non-flight/flight). Each student picks a degree
(`student_profiles.degree_id`; empty = the Fisher BSBA), and `curriculumFor()` in
`src/lib/requirements.ts` gives them that degree's requirements.

- Edit `scripts/engineering_requirements.py` and regenerate
  `supabase/migrations/*_seed_engineering_requirements.sql` (`python3 scripts/engineering_requirements.py degree`).
  It only replaces Engineering rows; don't hand-edit the SQL.
- Sources are each major's 2026-2027 curriculum sheet (linked from
  advising.engineering.osu.edu/current-students/curriculum-sheets-major) plus department elective pages;
  each program's `source_url` names its page. Where a sheet allows two courses to replace one
  (CHEM 1206 + 1208 for CHEM 1210), the pair is an `equivalent` (counted, flagged "confirm with advisor").
- FABE electives and ISE "Connected Skills" lists exist only in the Buckeye Degree Planner, so those
  groups accept engineering/science courses by pattern and tell students to confirm.
- Engineering minors (16, `kind = 'minor'`, ids `minor-<name>`) come from the College of Engineering minors
  list (engineering.osu.edu/students/undergraduate-students/minors) and each minor's official advising sheet on
  the Arts and Sciences minors pages. That's the 14 "(ENG)" minors, including Knowlton's Architectural Studies,
  City and Regional Planning, and Landscape Architectural Studies, plus Computer Science and Computational
  Science. Regenerate `supabase/migrations/*_seed_engineering_minors.sql` with
  `python3 scripts/engineering_requirements.py minors`. Every student sees every minor, Fisher's included.
- Titles, hours, terms, and prerequisites the sheets leave out were filled from OSU Class Search (Autumn 2026,
  Spring 2027); courses on a sheet but on neither schedule are titled "Listed on the minor sheet" and marked
  not scheduled. Where a sheet is out of date, the current course is used and the group's notes say so
  (Humanitarian Engineering's FABENG 3201 is now 3210 + 3211; Global Capstone is CIVILEN 4011/4012).
- `excluded_programs` uses degree ids: Aviation (`eng-aviation`), BME (`eng-biomedical`), Computer Science
  (`eng-cse`), Environmental Engineering (`eng-environmental`), Signal Processing (`eng-ece`), and Engineering
  Sciences (every Engineering degree; it's for non-engineers). Course lists that can't be enumerated ("any
  AVIATN 2000-5000", "any CRPLAN course", "CSE 3000+") use `code_pattern`; capstone/project requirements a
  faculty member must verify are `manual` groups.
- Not covered yet: the Knowlton School's degrees (Architecture, CRP, Landscape Architecture).

## College of Arts and Sciences curriculum data

ASC programs live in the same tables with `college = 'College of Arts and Sciences'`, generated by
`scripts/asc_requirements.py` (`degree` → `supabase/migrations/*_seed_asc_requirements.sql`, `minors` →
`*_seed_asc_minors.sql`; each replaces only ASC rows; don't hand-edit the SQL).

- Model: the degree is the college degree (`asc-ba`, `asc-bs`, `asc-bfa`, `asc-bm`, `asc-bme`, `asc-bsd`, `asc-bae`) holding the
  college requirements (ARTSSCI 1100 survey, world language through 1103, BS calculus, BA extra arts/humanities/social science
  course for Autumn 2026+ entrants, full GE including Math and Natural Science foundations, Civic Literacy). Majors are
  `specialization` rows with `parent_id` = that degree (ids `asc-<major>-<deg>`); a second specialization is a double major
  (UI says "Major" / "Second major"; shared courses are flagged since each major needs 18 unique hours). Majors with tracks
  are one row per track ("Biology: Pre-Health Professions", Math tracks, Neuroscience, Communication, English, International
  Studies, Data Analytics...). C- in major courses and a 2.00 major GPA (the audit reports each major's GPA, like Fisher).
- Versions per degree: base (entered Autumn 2026+), `-gen22` (Autumn 2022–Summer 2026: no BA extra course; Civic Literacy only
  if graduating Spring 2030+), `-gel` (before Autumn 2022: GE Legacy manual group). Sources: ASC's BA/BS/PPA (new GE) and GE Legacy
  sheets (artsandsciences.osu.edu/advising/general-education-requirements/...).
- Course titles, credits, prerequisites and offered terms are filled from `src/data/ascFaculty.json` (OSU Class Search, every
  course under the "Arts and Sciences" academic program; `npm run build:asc-data`), so major lists are mostly codes. A course in
  an ASC/Engineering/Fisher subject on neither schedule is titled "Listed on the advising sheet" and marked not scheduled.
- Sources per major are each department's current sheet/page (`source_url`). Some department sites block scripts (CSE, Earth
  Sciences) or publish only partial lists (arts degrees, several language majors, Speech and Hearing): those majors check the
  core sequence plus subject-pattern electives and say to confirm with the advisor. Tighten them when a full sheet is available.
- Minors (122, ids `minor-asc-<slug>`): from each minor's official advising sheet on artsandsciences.osu.edu/academics/programs/minors.
  Each is one credit-hour group: the courses read from the sheet plus the minor's subjects at 2000+ (`ASC_MINOR_SHEETS`).
  `excluded_programs` lists the same-subject majors. Minors marked (BUS), (ENG), (FAES), etc. belong to other colleges.
- Special programs: ASC Honors (Autumn 2022+, with a pre-AU22 version), Research Distinction, ASC Scholars, the BA/BS + Fisher
  BSBA dual degree, combined BS/MS (Microbiology, Molecular Genetics, Mathematics) and BA/MA (History, Chinese), and pre-health
  prerequisites (open to every degree). `adjustments.colleges` limits a no-parent special program to those colleges' degrees
  (`specialProgramsFor`).
- Faculty Evaluations has an Arts and Sciences tab; its 2.6 MB data is loaded lazily (its own chunk) when the tab opens.
  Office hours and directory emails are still Fisher/Engineering only.

## Plan building (term picker)

Every plan build, from the main chat or the 4-Year Plan tab, first opens the term picker (`TermPlanModal`),
pre-filled from the saved `plan_terms` and anything the request says about summers ("only 1-2 online
classes over the summers"; `planPrefsFromText`). `plan_terms` also stores `summerMaxCourses` and
`summerOnline`. Online-only summers use `src/data/onlineCourses.ts` (courses with fully online sections,
from OSU Class Search; Summer 2026 stands in for future summers). Refresh it with
`npm run build:online-courses` when a new summer schedule is posted. Course names come from
`src/data/courseTitles.ts` (`npm run build:course-titles`, which also writes `src/data/courseCatalog.json`: credits and
Autumn/Spring offerings for every scheduled Fisher, Engineering and ASC course).

In the 4-Year Plan, each planned course shows what it's for: a GE course opens its GE alternatives (`geSlotFor`); a course
filling a major/specialization/special-program choice ("choose 2", "9 hours of ECON 3000+") opens that requirement's
alternatives (`choiceSlotFor` / `choiceAlternatives`: the group's own list plus every catalog course matching its
`code_pattern`, minus individual study/research/internships); a required course is tagged "Required for <program>".
An `ELECTIVE` placeholder opens every elective for the student's majors/specializations, minor, and special
programs (`electiveOptions`), each labeled with the requirement it fills, unfinished ones first. Picking an option swaps it into the plan (`handleReplaceCourse`). The AI's requirements text lists catalog options for
pattern-only groups too. After each draft, App.tsx checks the plan
against requirements, summer limits, workload balance, and extra credits, and sends problems back
(up to 3 passes).

## Chat intents (where a request goes)

`src/lib/chatIntents.ts` decides what a chat message is asking for, with plain patterns so it works even
when the AI is down; the AI's `openTab` / `bookingReason` and `highStakesDecision.actionType` fill gaps.

- Navigation, answered instantly without the AI: booking or moving an advisor appointment (opens Advisor
  Scheduling and pre-fills "What do you want to talk about?" from the message), seat alerts and full classes,
  after-hours building access, "open the X tab", viewing the 4-year plan, and editing classes/GPA/entry term
  (opens My classes). Questions about minors, professors, or remaining requirements go to the AI and get a
  button to the matching tab.
- Big decisions get a "This is a big decision" card (`HighStakesDecisionCard`): dropping a class in the
  current term, withdrawing or taking a term off, Pass/Non-Pass, more than 18 credit hours, taking a class at
  another school, and leaving the degree or college. The card is built by `buildDecision()` from the student's
  own data (their real credit load and full-time status, the requirements the class counts toward, planned
  classes it's a prerequisite for, single-season offerings), never from the AI's wording. The student picks
  "Confirm with my advisor first" (request goes to `advising_requests` and Advisor Scheduling opens with the
  topic filled in), "Go through with it" (after a checkbox, shows the BuckeyeLink steps and can remove the
  class from their BuckAI schedule), or "Never mind".
- Questions ("what happens if I drop…", "should I…") never trigger a card, and specialization or minor changes
  stay with `programChange`. Dropping a class in a planned term is a plan edit, not a big decision.
- A reply's `action` auto-opens its tab only when the reply is new, never when an old chat is reloaded.
- Everything is doable from the chat itself: "set a seat alert for BUSML 4254" adds it to the watch list
  (`newWatchedCourse`), "I need after-hours access to Gerlach Hall" drafts the request email to the granting office
  (with Outlook/mail-app links) and saves it, program changes cover specializations/majors, the minor, and special
  programs (`programChange.specialPrograms`).
- What the AI sees beyond the student's own data: `server.ts` adds "Course facts" for every course named in the
  conversation (`src/lib/courseFacts.ts`: Class Search title, credits, sections per term, instructors, prerequisites,
  description, BuckAI review averages; `vercel.json` `includeFiles` ships the `*Faculty.json` files), the browser adds
  the full requirements of any minor/special program/specialization the question names (`describeProgramsMentioned`)
  and Summer 2026 online options when a question mentions summer/online. The student's declared minor is part of the
  audit (`audit.minor`), so plans, gaps, and the chat cover it.
- Chat replies render light Markdown (`ChatText`: bold, links, bullets).
- The system prompt explains how BuckAI itself works (Advising Report upload, plans built on request, the declared
  minor in plans since 2026-11-14, the plan dropdowns, what the chat can do) so students can ask about the app in a
  normal conversation; the profile says when the report was uploaded (`reportImportedAt`).
- The chat sees every tab's data: requirements (`describeAudit`), instructors/office hours
  (`describeOfficeHours`), and advisor appointment, seat-alert watch list, and instructor reviews
  (`describeFeatures` in `src/lib/featureContext.ts`). Status questions ("do I have an advisor
  meeting?", "what am I watching?") go to the AI with that data plus a button, not a canned reply.
  The seat-alert watch list lives in `App.tsx` so it survives switching tabs.
- Tab order: Advising Assistant, 4-Year Degree Plan, What-If Minor Audit, Degree Requirements,
  Faculty Evaluations, Advisor Scheduling, Seat Alerts, Office Hours, After-Hours Study Access.

## Office hours (instructors per section)

`public.office_hours` holds who teaches each Fisher section, read from Ohio State's Simple Syllabus
library (Autumn 2026, 369 syllabi; most are visible only to the OSU community). RLS lets only signed-in
OSU accounts read it (`is_osu_user()`); nothing writes through the API. **The rows live only in
Supabase: never commit them to this public repo**, and re-collect them through a signed-in browser
session (Simple Syllabus blocks scripted downloads). OSU's syllabus template has no office-hours
section, so almost every row has `hours_text` null and the tab says to check Carmen; never invent
hours. Students mark their instructor (`student_profiles.office_hours_picks`).

## After-hours building access

The BuckID office issues cards but doesn't grant door access; the department or college that runs
a building does. `src/lib/buildingAccess.ts` maps every building in the After-Hours Study Access tab
to that office (contacts from official OSU pages, each with `sourceUrl`; `verified: false` means a
college fallback, shown as "Confirm with office"; unmapped buildings fall back to FOD card access).
BuckAI writes the request email and the student sends it from their own OSU email (Outlook web,
mail app, or copy). `building_access_requests` tracks each request (RLS: students see, update and
delete only their own). Never put the 19-digit BuckID number in an email (OSU restricted data).

## Advising requests and advisors

Student requests to advisors live in `advising_requests` (RLS: students see their own,
advisors see all and decide). There is no sample data.

- Advisors are rows in `public.advisors` (email, name, `osu_username`, `aliases`, `weekly_hours`). `is_advisor()`
  and `current_advisor_id()` read it, and the app's role comes from it (`resolveRole` in `src/lib/roles.ts`).
- Recruited advisors set themselves up: on sign-in, `/api/advisor-enroll` looks the name.#@osu.edu user up in
  Ohio State's public directory (`src/lib/osuDirectory.ts`, Find People JSON). If their job there is academic
  advising, `enroll_advisor()` (server token only, same as `record_event`) creates their row with the directory's
  name, title and office, and assigns them requests their students already sent. Being named on a student's
  report is not enough (students write their own profiles). Anyone else (a lecturer who advises, a non-OSU demo
  login) is added by hand: insert a row (email lowercase); non-OSU emails also need `is_allowed_signup`.
- Students: the advisor named on the Advising Report is looked up in the directory when the report is read
  (`student_profiles.advisor_directory`: username, email, name, title, office; `{username: null}` = not found).
  Older profiles are looked up once on sign-in (`/api/advisor-lookup`). The student sees that advisor's real
  title, office and email; with no advisor on the report they see their college's advising office, never a
  made-up person.
- Assignment: `advisor_for_student()` matches the report's advisor by OSU username (`advisor_directory.username`
  = `advisors.osu_username`), then `advisor_for_name()` matches `student_profiles.advisor_name` to an advisor's
  `full_name` or an alias by first + last name. Trigger `stamp_advising_request` sets
  `advisor_id` on insert (students can't choose), `handled_by` whenever an advisor updates a request, and
  `meeting_advisor_id` (whose calendar a meeting is on: the student's advisor when they book, the acting
  advisor when an advisor schedules). No match = unassigned; any advisor can pick it up and students book
  against standard hours. The demo login tylerrez3@gmail.com has the alias "Lindsay McGory" (the test
  students' advisor); Enzo's demo login has none, so it sees them as other advisors' students.
- Availability per advisor: `advisors.weekly_hours` (minutes, keyed 1=Mon..7=Sun), `advisor_days_off`,
  `advisor_closed_slots` (single 30-minute times), and `advisor_busy_blocks` imported from Google/Outlook.
  `buildWeek()` in `src/lib/advising.ts` combines them; `booked_slot_keys(advisor)` exposes taken times
  without names.
- Calendar import (`src/lib/ics.ts`): advisors paste Google's "Secret address in iCal format" or Outlook's
  published ICS link (`advisor_calendars.feed_url`, readable only by its owner; hosts allowlisted to Google
  and Outlook), or upload an exported .ics. `/api/calendar-sync` fetches feeds as the signed-in advisor
  (their token, so RLS applies); the browser re-syncs feeds older than 6 hours. Only start/end times are
  stored, 8 weeks ahead, never event titles.

## Chat log

Students keep separate chats, like ChatGPT/Claude: `chat_conversations` is the list shown in
the chat tab's sidebar, and each row in `chat_messages` belongs to one (RLS: students read, add,
rename and delete only their own; advisors can't see chats). A new chat isn't saved until its
first message; a trigger names it after the first question and bumps `updated_at`. Opening a
chat reloads its last 200 messages; temporary placeholders (`pending`) aren't saved.

## Funnel tracking (events)

`public.events` gets one row per `visit`, `sign_up`, and `core_action` (a question to the advising chat), each
with the time, a random browser ID (the account ID once signed in), the first-visit `?ref=` tag, and, on
`sign_up`, the "How did you hear about us?" answer. Never store names or emails there.

- RLS on, no policies: nobody reads it through the API. Rows are written only by the server
  (`/api/events`, `/api/advising-chat` in `server.ts`) through `record_event()`, which checks
  `EVENTS_WRITE_TOKEN` (server-only env; its SHA-256 lives in `private.settings`). Reset it with
  `zsh scripts/set-events-token.sh`.
- Visits are sent from `src/lib/tracking.ts` after the page's `load` event, so link previews and mail
  scanners (which don't run scripts) don't count; known bot user agents are dropped too.
- More steps: `plan_built` (a 4-year plan finished building) and `seat_alert_added` come from
  `trackAction()` in the browser, and the server saves them only for a verified signed-in account.
  `advisor_booked` (`advising_requests.category = 'appointment'`) and `advisor_escalated` (any other
  category) come from trigger `on_advising_request_record_event`. Track actions, not every click.
- The first `?ref=` tag is kept in localStorage and sent as sign-up metadata; trigger
  `on_auth_user_created_record_event` on `auth.users` writes the `sign_up` row, so the tag survives
  opening the confirmation email on another device.
