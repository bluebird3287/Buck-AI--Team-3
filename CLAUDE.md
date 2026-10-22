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
