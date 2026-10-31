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
| View the advisor queue (requests routed in) | No | Own advisees only | No |
| Act on a routed request (clear a hold, approve/deny) | No | Own advisees only | No |
| View a student's record | Own only | Their advisees only | No |

Notes:
- Advisors land on their queue of routed student requests, not on a student
  dashboard. They see a student's details only through that student's request,
  and only for their own advisees.
- Faculty evaluations are public (readable without signing in), like a shared link.
- The signed-in user's ID is saved with everything they create.

## Sign-in

Email magic links via Supabase Auth. No passwords, ever. Collect only an email,
never an OSU password or student ID. Sketch: `docs/wireframes/sign-in.png`.

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

## Advising requests

Student requests to advisors live in `advising_requests` (RLS: students see their own,
advisors see all and decide) and advisor blocked-off times in `advisor_closed_slots`.
`booked_slot_keys()` exposes taken times without names. There is no sample data.

## Chat log

Each student's BuckAI conversation is saved in `chat_messages` (RLS: students read, add and
clear only their own; advisors can't see chats). The app reloads the last 200 messages and
saves each finished message; temporary placeholders (`pending`) aren't saved.
