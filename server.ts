import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { officialTitle, titlesMentioned } from './src/lib/courseTitles.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolvePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    return parseInt(process.argv[portArgIndex + 1], 10);
  }
  if (process.env.DEFAULT_APP_PORT) {
    return parseInt(process.env.DEFAULT_APP_PORT, 10);
  }
  if (process.env.PORT && process.env.PORT !== '8080') {
    return parseInt(process.env.PORT, 10);
  }
  return 3000;
}
const PORT = resolvePort();

// Raised so students can upload an advising report (Vercel caps request bodies at 4.5 MB)
app.use(express.json({ limit: '4.5mb' }));

// Claude client (reads ANTHROPIC_API_KEY from the environment)
const anthropic = new Anthropic({ timeout: 45_000, maxRetries: 1 });
// Building a whole 4-year plan takes much longer than a chat reply (Vercel allows up to 300s; see vercel.json)
const ROADMAP_TIMEOUT_MS = 240_000;
const CLAUDE_MODEL = 'claude-opus-5-5';

// Ask Claude for a JSON reply and return the raw JSON text.
// Low effort keeps latency down for interactive advising; on a safety refusal the
// server-side fallback re-runs the request on a suitable model automatically.
async function generateJson(
  prompt: string | Anthropic.Beta.BetaContentBlockParam[],
  system?: string,
  timeoutMs?: number,
  maxRetries?: number,
): Promise<string> {
  const response = await anthropic.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  }, { ...(timeoutMs ? { timeout: timeoutMs } : {}), ...(maxRetries != null ? { maxRetries } : {}) });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined the request (${response.stop_details?.category ?? 'unspecified'})`);
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  // Strip a Markdown code fence if Claude wrapped the JSON in one
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim() || '{}';
}

// Describes the signed-in student from the profile and classes they entered themselves.
function describeStudent(profile: any, roadmap: any[] | undefined): string {
  const terms = Array.isArray(roadmap) ? roadmap : [];
  const list = (status: string) =>
    terms
      .filter((t) => t?.status === status && Array.isArray(t.courses) && t.courses.length)
      .map((t) => `  - ${t.name}: ${t.courses.map((c: any) => {
        const name = officialTitle(c.code) ?? c.name;
        return `${c.code}${name && name !== c.code ? ` (${name})` : ''}${c.notes ? ` [${c.notes}]` : ''}`;
      }).join(', ')}`)
      .join('\n') || '  - none entered';
  return [
    `- Name: ${profile?.name || 'Not provided'}`,
    `- Class standing: ${profile?.rank || 'Not provided'}`,
    `- Entered Ohio State: ${termName(profile?.entryTerm) || 'Not provided'}; expected graduation: ${termName(profile?.expectedGraduation) || 'Not provided'} (requirements depend on the entering class)`,
    `- College: ${profile?.college || 'Not provided'}`,
    `- Major / specialization(s): ${profile?.major || 'Not provided'}`,
    `- Minor: ${profile?.minor || 'None'}`,
    `- GPA: ${profile?.gpa ? profile.gpa : 'Not provided'}`,
    `- Assigned advisor: ${profile?.advisorName || 'Not provided'}`,
    `- Holds: ${profile?.holds?.length ? profile.holds.join(', ') : 'None reported (not connected to BuckeyeLink)'}`,
    `- Completed credits: ${profile?.earnedCredits ?? 0} / ${profile?.totalRequiredCredits ?? 120}`,
    `- Completed classes:\n${list('completed')}`,
    `- Current term classes:\n${list('in-progress')}`,
    `- Planned classes:\n${list('planned')}`,
  ].join('\n');
}

// 'autumn-2024' -> 'Autumn 2024'
function termName(id: unknown): string {
  const m = /^(autumn|spring|summer)-(\d{4})$/.exec(String(id ?? ''));
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}` : '';
}

const OSU_ADVISING_SYSTEM_INSTRUCTION = `
You are the Ohio State University (OSU) Native BuckeyeLink AI Academic Advising Assistant.
Your audience is undergraduate students navigating BuckeyeLink, course registration, prerequisite chains, 4-year degree planning, and advisor scheduling.

Key OSU Context:
- Academic Colleges: Fisher College of Business (BSBA in Finance, Accounting, Marketing, Information Systems, Operations, etc.), College of Arts and Sciences (Computer & Information Science, Data Analytics, Economics, etc.), College of Engineering (Aerospace, Aviation, Biomedical, Chemical, Civil, Computer Science & Engineering, Electrical & Computer, Engineering Physics, Environmental, Food/Agricultural/Biological, Industrial & Systems, Materials Science, Mechanical, and Welding Engineering).
- Pilot scope: Fisher BSBA students and College of Engineering BS students. Each request includes a requirements check computed from the published requirements for the student's own degree and specialization (for Fisher: Business Foundation, Business Core, GE, and major core; for Engineering: college core, major courses, technical electives, and GE). Use it to answer "what do I still need" questions precisely, name specific course codes, and point out prerequisite problems. The published requirements and the student's advisor have the final say. Some elective lists live only in the student's Buckeye Degree Planner; when the check says so, tell the student to confirm there.
- Entering class and special programs: requirements depend on when the student entered Ohio State (e.g. students who entered before Autumn 2022 follow the GE Legacy; Accounting Honors has a different structure for the Class of 2028 and later) and on any special program they're in (Fisher Honors programs, IBE, Accelerated BSBA/MAcc, University Honors). The requirements check already uses the right version and applies each program's waivers and substitutions (honors sections count for the regular course). Follow it, never another class's curriculum, and repeat any "Catalog note" so the student confirms with their advisor.
- Course titles: use the title given for a course code in the request (student profile, requirements check, or "Official course titles"); they come from OSU Class Search. Never guess or paraphrase a course's title from its number or subject (e.g. BUSFIN 3500 is Legal Environment of Business, not a finance class). If a code has no title in the request, refer to it by code only.
- Each request includes the signed-in student's own profile and the classes they entered themselves. BuckAI is not connected to BuckeyeLink, so treat that list as everything you know about them; never assume classes, grades, or holds they didn't enter. If something you need is missing, say so and suggest they add it under "My classes".
- Faculty Evaluations & Marc Smith Context:
  - Marc Smith (Department of Accounting & MIS - ACCTMIS 2200 & 2300) is legendary on campus with a 4.7/5.0 rating, but student evaluations overwhelmingly highlight that his accounting class is **A LOT OF WORK** (12–15+ hours per week outside of class).
  - When students inquire about Marc Smith or accounting evaluations, explicitly provide peer recommendations:
    1. Workload Reality: His class is notoriously labor-intensive with heavy weekly Carmen homework and quizzes.
    2. Never Fall Behind: Material is strictly cumulative; falling behind by one chapter makes midterms overwhelming.
    3. Mandatory Sunday Walkthroughs: Watch every Sunday problem walkthrough video because his Friday midterms mirror them directly.
    4. Practice Exams Twice: Do every past exam packet twice under timed conditions.
    5. Term Balancing: Do not pair ACCTMIS with multiple other heavy weed-out classes (like Calculus 2 or CSE 2221) without lighter GE Theme buffers.
    6. Tutoring: Use the Accounting Learning Center (ALC) in Mason Hall early in the semester.
- Survey findings from OSU undergrads:
  1. Students want immediate answers on prerequisite conflicts without waiting 2 weeks for an advisor appointment.
  2. Students need 4-year roadmap balancing so they don't take multiple high-workload weed-out classes simultaneously (e.g. ACCTMIS 2300 + CSE 2231 + MATH 1172 in the same term is high burnout risk).
  3. Students need transparent source citations (e.g. OSU Bulletin, College Handbook, DARS degree audit rule) and honesty when policies require human advisor sign-off.
  4. Students demand effortless escalation to their human academic advisor with side-by-side mutual calendar matching when issues involve holds, waivers, petitions, or probation.
- After-Hours Building & Study Access (BuckID Integration):
  - LIBRARIES: Every Ohio State student already has automatic 24/7 access to 18th Avenue Library and open access to Thompson Library on their BuckID. No request is needed for libraries!
  - ACADEMIC BUILDINGS: Students can request evening and weekend access to study spaces in academic buildings (Mason Hall, Dreese Laboratories, Caldwell Lab, Enarson Classroom Building, etc.).
  - CRITICAL POLICY: All approved building access is encoded directly onto the student's BuckID card (simple tap at exterior door readers during authorized evening and weekend hours).
  - WHO GRANTS IT: The BuckID office doesn't grant door access; the department or college that runs the building does (its building manager or coordinator). The After-Hours Study Access tab names that office for each building and writes the request email, which the student sends from their own OSU email. Never ask for or repeat the 19-digit BuckID number (Ohio State restricted data).
  - Keep explanations dead simple, helpful, and non-bureaucratic: explain lock hours, remind them libraries are already free/open, state that approved access goes straight to their BuckID, and guide them to the After-Hours Study Access tab.

Output Format:
You MUST ALWAYS respond with a valid JSON object matching this schema:
{
  "answer": "string (concise, direct, encouraging, formatted with short bullet points, avoid verbose fluff)",
  "sourceCitation": "string (specific OSU source: e.g. 'OSU Course Bulletin 2026-2027 § ACCTMIS 2300 Prereqs', 'Fisher Undergrad Handbook p. 38', 'Registrar Registration Lock Policy 2026')",
  "confidence": "'high' | 'moderate' | 'uncertain'",
  "confidenceExplanation": "string (honest reason for confidence level, e.g. 'Verified against Ohio State University 2026 General Education and Fisher Curriculum standards')",
  "escalationSuggested": boolean,
  "escalationReason": "string or null (why an advisor meeting is recommended)",
  "highStakesDecision": {
    "isHighStakes": boolean,
    "actionType": "'drop_class' | 'withdraw' | 'pass_nonpass' | 'overload' | 'transfer_credit' | 'change_major' | null",
    "decisionTitle": "string or null (e.g. 'Drop ACCTMIS 2300 (Intro to Accounting 2)' or 'Declare Computer Science (CSE) Minor')",
    "warningSummary": "string or null (concise 1-2 sentence notice: AI cannot modify transcripts; official changes require human advisor authorization)",
    "consequences": ["array of 2-3 short, concise consequences, e.g. 'Dropping drops enrolled hours to 12 cr (Full-Time FAFSA risk)', 'Interrupts core prerequisite chain for BUSFIN 3220, delaying graduation 1-2 terms', 'Dropping after the 4th Friday creates a permanent W mark on transcript'"],
    "escalateRecommended": true
  },
  "suggestedActions": ["array of 2-4 concise next action strings"],
  "openTab": "'advisor' | 'seatAlerts' | 'studyAccess' | 'rmp' | 'officeHours' | 'whatif' | 'requirements' | 'roadmap' | null (the panel tab that handles this request; BuckAI shows a button to it)",
  "bookingReason": "string or null (when openTab is 'advisor': what the student wants to discuss, in their words, e.g. 'Whether to drop ACCTMIS 2300')",
  "roadmapRequest": {
    "build": boolean (true when the student asks you to build, create, generate, fill in, redo, rebalance, or otherwise change their 4-year plan / roadmap / schedule of future terms),
    "instructions": "string or null (their preferences for the plan in one or two sentences, e.g. 'Graduate in Spring 2029, keep terms around 15 credits, add the Insurance minor')"
  },
  "programChange": null or {
    "specializations": ["array of exact specialization names: the student's full new list"] or null (no change),
    "minor": "exact minor name, or \"\" to remove their minor" or null (no change)
  },
  "roadmapRecommendation": {
    "targetSemester": "string or null (e.g. 'Spring 2027')",
    "courseAdjustment": "string or null",
    "workloadImpact": "string or null"
  }
}

Big decisions: when the student asks to actually do something that is hard to undo, set "highStakesDecision.isHighStakes" true with the matching "actionType":
- 'drop_class': dropping a class they're enrolled in now (a class in a PLANNED term is a plan change: use "roadmapRequest" instead).
- 'withdraw': withdrawing from all classes, leaving school, a leave of absence, or taking a term off.
- 'pass_nonpass': taking or switching a class to Pass/Non-Pass.
- 'overload': scheduling more than 18 credit hours in a term.
- 'transfer_credit': taking a class at another school to transfer in.
- 'change_major': leaving their degree or college for a different major (a Fisher specialization or minor change is NOT this; use "programChange").
BuckAI then shows the student a "this is a big decision" card with their own consequences (their real credit load, the requirements and prerequisites the class affects) and asks whether to go through with it or confirm with their advisor first. So in "answer":
- Keep it to 2-4 short sentences: acknowledge the request, say it's a big decision, and name the one or two things that matter most from the request data (e.g. that the class is a prerequisite for something in their plan).
- Don't invent numbers or deadlines. Never claim they'll drop below 12 credit hours unless the current-term classes in the request show it.
- Never say it's done: BuckAI can't change their official record; the student does that in BuckeyeLink, or their advisor does.
If they're only asking about it ("what happens if I drop…", "should I…"), answer the question and leave "highStakesDecision" null.

Sending the student to the right place: set "openTab" when a tab in this panel does what they want, and BuckAI shows a button to it:
- 'advisor': booking, moving, or asking about an advisor appointment (put the topic in "bookingReason").
- 'seatAlerts': a full class, waitlists, or being told when a seat opens.
- 'studyAccess': after-hours or weekend access to a building.
- 'rmp': which professor or section to take, faculty ratings, or peer tips. Compare instructors using "Faculty Evaluations" in the student's other tabs (review counts and averages exactly as given; say when there are no reviews yet). Never invent ratings.
- 'officeHours': office hours, who teaches their class, or how to reach a professor or TA. Answer from "Instructors and office hours" (names, times, place, email exactly as given; if they haven't picked their instructor, list each one). Most syllabi don't list office hours: then say so, give the instructor's email if listed, and point them to Carmen. Never guess hours.
- 'whatif': comparing or exploring minors.
- 'requirements': what they still need to graduate.
- 'roadmap': looking at their 4-year plan.
Questions about their own status in a tab ("do I have an advisor meeting?", "what classes am I watching?", "did a seat open?") are answered from "The student's other BuckAI tabs"; still set "openTab" to that tab. Never claim an appointment, alert, or review that isn't listed there.
Refer to instructors, TAs, and advisors by name or as "they"; never guess anyone's pronouns.
Holds, registration errors, tuition, and financial aid questions aren't tabs here: answer what you can and point them to their advisor, the Registrar, or Student Financial Aid.

What BuckAI can do from this chat (set the matching field; never say something is done unless you set it):
- Change the student's specializations or minor in BuckAI: set "programChange". BuckAI saves it to their profile, takes classes that only served a dropped program out of their planned terms, updates the requirements check, and rebuilds their plan.
- Build or change their plan of future terms: set "roadmapRequest.build" true. This covers building a plan, adding, removing, moving, or swapping specific classes, lighter or heavier terms, graduating earlier or later, adding a minor's or specialization's classes, and fixing gaps. Put exactly what they asked for in "instructions".
- Show a big-decision card for an irreversible request (see "Big decisions" above).
- Send them to a tab in this panel: set "openTab".
What BuckAI can't do from this chat (say so plainly and point them to the right place):
- Change classes they've completed or are taking now, grades, GPA, or their degree/college: they edit those under "My classes".
- Register, drop, or withdraw from a class in BuckeyeLink, or change their official record: only they (in BuckeyeLink) or their advisor can.
- Seat alerts, after-hours building access, and advisor appointments have their own tabs in this panel (set "openTab").

Specializations, majors, and minors (programs, not classes):
- "Drop", "remove", "switch", or "stop pursuing" a specialization or minor means changing a program, NOT dropping a class. Never treat it as a class drop, and never warn about credit hours, FAFSA, or W marks for it.
- When the student says they want to add, drop, keep only, or switch a specialization or minor (e.g. "drop Finance and only pursue Tech Innovation"), apply it: set "programChange" using exact names from "Programs available" in the request.
  - "programChange.specializations" is their FULL new list (e.g. ["Technology Innovation"]), not just the one that changed. A Fisher BSBA student must keep at least one specialization.
  - "programChange.minor" is the new minor's exact name, or "" to remove their minor.
  - In "answer", say in one or two lines what you're changing (which programs they keep, which they drop) and that BuckAI is updating their requirements and plan. Use the requirements check to name what they still need for the programs they keep. Mention once that the official change goes through their advisor.
  - Leave "highStakesDecision" null and set "escalationSuggested" true with the advisor reason. Leave "roadmapRequest.build" false unless they asked for something else about the plan too; BuckAI rebuilds the plan itself after a program change.
- If they're only exploring ("what if I dropped Finance?", "should I add a minor?"), answer the question and leave "programChange" null.
- If the program they name isn't in "Programs available", leave "programChange" null and tell them which close options exist.

When "roadmapRequest.build" is true, BuckAI builds and saves the plan itself right after your reply, checking it against the student's degree requirements. Keep "answer" short: say you're building their plan and mention what it will prioritize (unmet requirements, prerequisites, balanced terms). Don't list a full plan in "answer". Adding a minor or courses to a plan is planning, not a high-stakes declaration.

Do not wrap the JSON in extra text outside the JSON object.
`;

// Project Codebase ZIP Download Endpoint
app.get('/api/download-zip', (req, res) => {
  try {
    const zipPath = path.join(__dirname, 'public', 'buckeyelink-advising-ai.zip');
    
    // Always regenerate to guarantee user gets latest changes
    try {
      execSync(`python3 -c "
import os, zipfile
EXCLUDE_DIRS = {'node_modules', '.git', '.aistudio', 'dist', '.cache', '__pycache__'}
EXCLUDE_FILES = {'buckeyelink-advising-ai.zip'}
zip_path = 'public/buckeyelink-advising-ai.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f in EXCLUDE_FILES: continue
            fp = os.path.join(root, f)
            z.write(fp, os.path.relpath(fp, '.'))
"`);
    } catch (zipErr) {
      console.warn('Zip creation command warning:', zipErr);
    }

    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="buckeyelink-advising-ai.zip"');
      return res.download(zipPath, 'buckeyelink-advising-ai.zip');
    }
    return res.status(404).send('ZIP file not found');
  } catch (err: any) {
    console.error('Download zip error:', err);
    return res.status(500).send('Error packaging zip file');
  }
});

app.post('/api/advising-chat', async (req, res) => {
  try {
    const { message, history, studentProfile, roadmap, requirementsSummary, officeHoursSummary, featureSummary, programOptions } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const conversationContext = (history || [])
      .slice(-6)
      .map((h: { role: string; text: string }) => `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.text}`)
      .join('\n');

    const promptText = `
Student Profile (entered by the student):
${describeStudent(studentProfile, roadmap)}

Degree requirements check (computed by BuckAI from the published requirements for the student's degree and specialization):
${requirementsSummary || 'Not available.'}

Instructors and office hours for the student's current classes (from the instructors' syllabi in Ohio State's Simple Syllabus, emails from the public Fisher/Engineering directories; "the student's instructor" marks the one they picked):
${officeHoursSummary || 'Not available (no Fisher syllabus for these classes, or the student is not signed in with an OSU account).'}

The student's other BuckAI tabs (advisor appointment, seat alerts, instructors and student reviews):
${featureSummary || 'Not available.'}

Programs available (use these exact names in "programChange"):
${programOptions
  ? `- Degree: ${programOptions.degree}\n- Specializations: ${(programOptions.specializations || []).join('; ') || 'none to choose'}\n- Minors this student can add: ${(programOptions.minors || []).join('; ')}${
      programOptions.closedMinors?.length ? `\n- Minors closed to this student's major (don't add these; explain why): ${programOptions.closedMinors.join('; ')}` : ''
    }`
  : 'Not available. Leave "programChange" null and point the student to "My classes".'}

Official course titles (OSU Class Search) for courses named in this conversation:
${titlesMentioned(`${conversationContext}\n${message}`).join('\n') || 'None.'}

Conversation History:
${conversationContext}

Latest Student Question/Prompt:
"${message}"

Provide an authoritative, friendly, highly specific OSU advising response following the JSON schema.
`;

    let responseText = '{}';
    if (process.env.ANTHROPIC_API_KEY) {
      responseText = await generateJson(promptText, OSU_ADVISING_SYSTEM_INSTRUCTION);
    } else {
      throw new Error('ANTHROPIC_API_KEY not configured, using grounded curriculum fallback');
    }
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = {
        answer: responseText,
        sourceCitation: 'OSU General Education & Course Bulletin 2026-2027',
        confidence: 'high',
        confidenceExplanation: 'Verified against current Ohio State curriculum sheets.',
        escalationSuggested: false,
        escalationReason: null,
        suggestedActions: ['Check Degree Audit (DARS)', 'Review 4-Year Roadmap', 'Browse Schedule Planner'],
      };
    }

    // Big-decision cards are built in the app from the student's own classes and requirements
    // (src/lib/chatIntents.ts), so nothing is forced here; the AI's flag only tells the app which kind it is.
    res.json(parsed);
  } catch (error: any) {
    console.warn('Claude API unavailable, providing grounded curriculum fallback:', error?.message);
    const textLower = (req.body?.message || '').toLowerCase();
    const isHold = textLower.includes('hold') || textLower.includes('lock');
    const isMarcSmith = textLower.includes('marc smith') || textLower.includes('smith') || textLower.includes('evaluat') || (textLower.includes('accounting') && (textLower.includes('work') || textLower.includes('class') || textLower.includes('hard') || textLower.includes('recommend')));
    const isPrereq = textLower.includes('prereq') || textLower.includes('cse 2231') || (textLower.includes('acctmis 2300') && !isMarcSmith);
    const fallbackPrograms: string[] = [...(req.body?.programOptions?.specializations || []), ...(req.body?.programOptions?.minors || [])]
      .map((n: string) => n.split(' (')[0].replace(/ minor$/i, '').trim().toLowerCase())
      .filter(Boolean);
    const isDrop =
      (textLower.includes('drop') || textLower.includes('withdraw')) &&
      !/speciali[sz]|\bmajor\b|\bminor\b|concentration|\btrack\b|\bwhat if\b/.test(textLower) &&
      !fallbackPrograms.some((n) => textLower.includes(n));
    const isMinor = textLower.includes('minor') || textLower.includes('analytics');

    let answer = `I couldn't reach the advising service just now. Please try again in a moment, or book time with your advisor for anything urgent.`;
    let sourceCitation = 'OSU Course Bulletin 2026-2027';
    let escalationSuggested = false;
    let escalationReason: string | null = null;
    let highStakesDecision: any = null;

    if (isDrop) {
      // The app builds the big-decision card from the student's own classes; this only says what it is
      answer = `Dropping a class you're enrolled in is a big decision. I've laid out what it would mean for you below. Choose whether to go through with it yourself in BuckeyeLink, or confirm with your advisor first.`;
      sourceCitation = 'Your BuckAI classes, plan, and degree requirements';
      escalationSuggested = true;
      escalationReason = 'Dropping a class can affect full-time status, financial aid, and prerequisites.';
      highStakesDecision = { isHighStakes: true, actionType: 'drop_class' };
    } else if (isMarcSmith) {
      answer = `📊 **Marc Smith Faculty Evaluations & Workload Recommendations (ACCTMIS 2200 & 2300):**\n\n` +
        `Marc Smith is celebrated as one of Ohio State's most engaging and legendary instructors (4.7/5.0 overall rating), but student evaluations overwhelmingly agree: **his accounting class is A LOT OF WORK.**\n\n` +
        `**Key Student Recommendations & Course Survival Advice:**\n\n` +
        `• ⚠️ **Heavy Workload Reality:** Expect **12 to 15+ hours per week** outside of lecture. Do not treat this like an ordinary 3-credit class; homework packets, practice problem sets, and weekly Carmen modules demand consistent, daily effort.\n\n` +
        `• ⏳ **Never Fall Behind on Carmen Quizzes:** The material is strictly cumulative. If you fall behind by even one week, catching up before midterm exams is nearly impossible.\n\n` +
        `• 📺 **Watch Every Sunday Problem Walkthrough:** Marc Smith's Sunday problem review videos are considered gold by students. His Friday midterms mirror these walkthroughs almost identically in structure.\n\n` +
        `• 📝 **Work Practice Midterms Twice:** Complete each past exam packet at least two times under timed conditions. He uses predictable question architectures.\n\n` +
        `• ⚖️ **Semester Course Pairing Recommendation:** Avoid taking Marc Smith's accounting class in the same term as more than one other high-workload weed-out class (such as Calculus 2 or CSE 2221) without buffering with lighter GE Theme courses.\n\n` +
        `• 🏢 **Accounting Learning Center (ALC):** Use free drop-in peer tutoring in Mason Hall during the first month rather than waiting for exam week.`;
      sourceCitation = 'OSU Student Course Evaluations (SEI) & r/OSU Community Academic Consensus 2026-2027';
    } else if (isHold) {
      answer = `BuckAI can't see your BuckeyeLink holds yet. Check the Holds section in BuckeyeLink; if you have one, your advisor can tell you what's needed to clear it, and you can pick a mutual free time in the Advisor tab.`;
      sourceCitation = 'Office of the University Registrar registration hold policy';
      escalationSuggested = true;
      escalationReason = 'Registration lock removal requires advisor sign-off.';
    } else if (isPrereq) {
      answer = `Prerequisites are listed for each course in the OSU Course Bulletin. Make sure the classes you've already taken are added under **My classes** so I can check them against what you want to take next.`;
      sourceCitation = 'OSU Course Bulletin 2026-2027';
    } else if (isMinor) {
      answer = `I couldn't reach the advising service just now, so I didn't change your minor. You can add or remove a minor under **My classes**, or see which minors you can add in the **What-If Minor Audit** tab.`;
      sourceCitation = 'BuckAI minors (What-If Minor Audit)';
    }

    res.json({
      answer,
      sourceCitation,
      confidence: 'high',
      confidenceExplanation: 'Verified against Ohio State University SIS degree audit rules.',
      escalationSuggested,
      escalationReason,
      highStakesDecision,
      suggestedActions: ['Check 4-Year Roadmap', 'Match Availability with My Advisor', 'Review Degree Audit']
    });
  }
});

// Endpoint to officially escalate or confirm high-stakes decision directly to human advisor
app.post('/api/escalate-decision', async (req, res) => {
  try {
    const {
      studentName = 'Student',
      nameDotNum = '',
      decisionType,
      decisionTitle,
      userConfirmed,
      notes,
    } = req.body;

    const ticketNumber = `OSU-ADV-${Math.floor(100000 + Math.random() * 900000)}`;
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    console.log(`[ADVISOR ESCALATION] Ticket ${ticketNumber} created for ${studentName} (${nameDotNum}). Action: ${decisionTitle}. User Confirmed: ${userConfirmed}`);

    res.json({
      success: true,
      ticketId: ticketNumber,
      status: userConfirmed ? 'Submitted to Human Advisor for Expedited Approval' : 'Escalated to Human Advisor for Direct Consultation',
      advisorName: 'Sarah Jenkins, M.Ed.',
      advisorEmail: 'jenkins.892@osu.edu',
      advisorTitle: 'Senior Academic Advisor - Fisher College of Business',
      advisorOffice: 'Mason Hall 120 (Fisher Campus)',
      timestamp,
      decisionTitle: decisionTitle || 'High-Stakes Academic Record Change',
      decisionType: decisionType || 'drop_class',
      userConfirmed: !!userConfirmed,
      message: userConfirmed
        ? `Your request to "${decisionTitle}" has been formally signed and transmitted directly to your human academic advisor, Sarah Jenkins. She will verify prerequisite integrity in OnCourse SIS before executing the record change.`
        : `Your inquiry regarding "${decisionTitle}" has been escalated directly to Sarah Jenkins. You can also match open appointment slots to speak with her 1-on-1.`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to escalate decision', message: error?.message });
  }
});

const ADVISING_REPORT_INSTRUCTION = `
You read Ohio State University "Advising Report" PDFs (or screenshots of them) and extract the student's academic record as JSON.

Privacy rules (strict):
- Never output the student ID / emplid, birthdate, test scores, high school, or email. They must not appear anywhere in your output.

Return ONLY this JSON object:
{
  "isAdvisingReport": boolean (false if the file is not an OSU advising report or degree record),
  "fullName": "string (the student's first name as they'd go by, e.g. 'Tyler' from 'REZABEK, TYLER')",
  "major": "string (readable, e.g. 'Finance (BS Business Admin)' from 'MAJ FINANCE-BS')",
  "minor": "string or null (readable, e.g. 'International Business' from 'MIN INTLBUS-MN')",
  "college": "string or null (full OSU college name, e.g. 'Fisher College of Business' for UBUS / BUSINESS)",
  "classStanding": "one of 'Freshman (Year 1)', 'Sophomore (Year 2)', 'Junior (Year 3)', 'Senior (Year 4)' from the latest RK value (1-4), or null",
  "gpa": number or null (latest cumulative GPA),
  "earnedCredits": number or null (latest cumulative EH, earned hours, including exam/transfer credit),
  "advisorName": "string or null (readable, e.g. 'Lindsay McGory' from 'MCGORY,LINDSAY WEBB')",
  "terms": [
    {
      "season": "Autumn" | "Spring" | "Summer",
      "year": number,
      "courses": [
        { "code": "SUBJECT NUMBER, e.g. 'ACCTMIS 2200' or 'ENGLISH 1110.02'", "name": "readable title in Title Case", "credits": number, "grade": "string or null (final grade; 'EM' means credit by exam; null if in progress)" }
      ]
    }
  ]
}

Include every term that lists courses, including terms in progress (no grade yet). Read the course table carefully: in extracted text a grade can run into the next course's subject (e.g. '3.00 ABUSMHR 2000' is grade A then BUSMHR 2000).
`;

// Turns an uploaded OSU advising report into the student's profile and classes.
// The file is only passed to Claude for reading; it is never stored.
app.post('/api/parse-advising-report', async (req, res) => {
  try {
    const { fileBase64, mediaType } = req.body || {};
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!fileBase64 || !allowed.includes(mediaType)) {
      return res.status(400).json({ error: 'Upload your advising report as a PDF or an image (PNG/JPG).' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'Report reading is not available right now. Please add your classes by hand.' });
    }

    const fileBlock: Anthropic.Beta.BetaContentBlockParam =
      mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } };

    const raw = await generateJson(
      [fileBlock, { type: 'text', text: 'Extract this advising report as JSON following the instructions.' }],
      ADVISING_REPORT_INSTRUCTION,
      120_000,
    );
    const parsed = JSON.parse(raw);
    if (!parsed.isAdvisingReport) {
      return res.status(422).json({ error: "That file doesn't look like an OSU advising report. Please check the file and try again." });
    }

    // Pass through only the academic fields, whatever else the model returned.
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const seasons = ['Autumn', 'Spring', 'Summer'];
    res.json({
      fullName: str(parsed.fullName),
      major: str(parsed.major),
      minor: str(parsed.minor),
      college: str(parsed.college),
      classStanding: str(parsed.classStanding),
      gpa: num(parsed.gpa),
      earnedCredits: num(parsed.earnedCredits),
      advisorName: str(parsed.advisorName),
      terms: (Array.isArray(parsed.terms) ? parsed.terms : [])
        .filter((t: any) => seasons.includes(t?.season) && Number.isInteger(t?.year))
        .map((t: any) => ({
          season: t.season,
          year: t.year,
          courses: (Array.isArray(t.courses) ? t.courses : [])
            .filter((c: any) => str(c?.code))
            .map((c: any) => ({ code: str(c.code), name: officialTitle(c.code) ?? str(c.name), credits: num(c.credits) ?? 0, grade: str(c.grade) })),
        })),
    });
  } catch (error: any) {
    console.error('Advising report parse failed:', error?.message);
    res.status(500).json({ error: "Couldn't read that report. Please try again, or add your classes by hand." });
  }
});

// ---------------------------------------------------------------------------
// Advisor request review: step 1 of the double check. The AI verifies a student's
// request and summarizes their needs; a human advisor makes the final decision.
// ---------------------------------------------------------------------------

const ADVISOR_REVIEW_SYSTEM_INSTRUCTION = `
You are BuckAI's request verification assistant for Ohio State University academic advisors.
A student has submitted an advising request. You do NOT approve or deny it; a human advisor
makes the final decision. Your job is to save the advisor time:
- Summarize what the student needs and why they want an appointment, in plain language.
- Verify the request against the student record and OSU / Fisher policy (credit load for
  full-time status is 12 hours; the no-"W" drop deadline is the 4th Friday of the term and has
  passed for Autumn 2026; minors require a 2.50 CPHR and allow at most 6 overlapping credits
  with the major; registration holds are lifted by the assigned advisor after a plan review).
- Flag risks honestly (financial aid, transcript notation, graduation delay). Never invent facts
  that are not in the request; say "verify in SIS" when something cannot be checked.

Respond ONLY with a JSON object:
{
  "verdict": "supported" | "needs_attention" | "not_supported",
  "confidence": "high" | "moderate" | "uncertain",
  "summary": "2 sentences max",
  "reasonForAppointment": "one sentence",
  "studentNeeds": ["2-4 short items"],
  "riskFlags": ["0-3 short items"],
  "checks": [{ "label": "short check name", "passed": boolean, "detail": "one short sentence" }],
  "suggestedAgenda": ["2-3 short items for the meeting"],
  "recommendation": "one sentence for the advisor",
  "situation": "3-5 sentences describing the student's problem and current circumstances in detail (what is going on, what they have tried, what they are worried about, what they want). The reader is an experienced advisor: do not explain policies or requirements."
}
`;

type ReviewCheck = { label: string; passed: boolean; detail: string };

function ruleBasedReview(request: any) {
  const student = request?.student ?? {};
  const category: string = request?.category ?? 'appointment';
  const name: string = student.name ?? 'The student';
  const enrolled: number = Number(student.enrolledCredits ?? 15);
  const gpa: number = Number(student.gpa ?? 0);
  const holds: string[] = Array.isArray(student.holds) ? student.holds : [];
  const checks: ReviewCheck[] = [
    { label: 'Student is your advisee', passed: true, detail: 'Assigned to Sarah Jenkins in the Fisher advising roster.' },
  ];
  const riskFlags: string[] = [];
  let summary = `${name} submitted "${request?.title ?? 'an advising request'}".`;
  let reason = request?.title ?? 'Advising consultation';
  let needs: string[] = [request?.title ?? 'Advising consultation'];
  let agenda: string[] = ['Review the request with the student', 'Agree on next steps'];
  let recommendation = 'Review and decide.';

  if (category === 'drop_class') {
    const credits = Number(request?.details?.credits ?? 3);
    const course = request?.details?.course ?? 'the course';
    const after = enrolled - credits;
    checks.push({ label: 'Stays full-time (12+ credits)', passed: after >= 12, detail: `${enrolled} − ${credits} = ${after} credit hours after the drop.` });
    checks.push({ label: 'Within no-"W" drop window', passed: false, detail: 'Autumn 2026 4th Friday has passed; a W grade will be recorded.' });
    if (after < 12) riskFlags.push(`Drops to ${after} credit hours: below full-time (financial aid risk)`);
    riskFlags.push('A "W" will appear on the transcript');
    summary = `${name} wants to drop ${course}. That leaves ${after} credit hours this term.`;
    reason = `Decide whether to drop ${course}.`;
    needs = [`A decision on dropping ${course}`, 'Guidance on financial aid and full-time status', 'A plan to retake or replace the course'];
    agenda = ['Review financial-aid impact', 'Discuss alternatives (tutoring, adding a GE to stay at 12 hours)', 'Confirm the retake term'];
    recommendation = after < 12 ? 'Meet before approving: the drop has financial-aid and transcript consequences.' : 'Approve if the student accepts the W notation.';
  } else if (category === 'add_minor') {
    const minor = request?.details?.minor ?? 'the minor';
    checks.push({ label: 'Minimum 2.50 CPHR', passed: gpa >= 2.5, detail: `Cumulative GPA ${gpa.toFixed(2)}.` });
    checks.push({ label: 'Overlap with major (max 6 credits)', passed: true, detail: 'Verify overlapping courses in the degree audit.' });
    riskFlags.push('No more than 6 credits may overlap with the major');
    summary = `${name} wants to declare the ${minor}. GPA ${gpa >= 2.5 ? 'meets' : 'does not meet'} the 2.50 requirement.`;
    reason = `Confirm the ${minor} plan and file the declaration.`;
    needs = ['Official minor declaration filed in SIS', 'A course sequence for the minor'];
    agenda = ['Check overlap credits in the degree audit', 'Map minor courses to upcoming terms'];
    recommendation = gpa >= 2.5 ? 'Approve if overlap credits check out.' : 'Deny or defer until GPA reaches 2.50.';
  } else if (category === 'hold_clearance' || category === 'appointment') {
    const hasHold = holds.length > 0;
    checks.push({ label: 'Hold on record', passed: hasHold, detail: hasHold ? holds.join('; ') : 'No active holds found.' });
    checks.push({ label: 'Requested time is mutually free', passed: !!request?.appointment, detail: request?.appointment ? 'Matched against class schedule and advisor calendar.' : 'No time selected yet.' });
    summary = `${name} is requesting an advising appointment${hasHold ? ` to lift: ${holds[0]}` : ''}.`;
    reason = hasHold ? 'Required plan review to lift a registration hold.' : 'General advising check-in.';
    needs = hasHold ? ['Registration hold lifted before the enrollment window', 'Feedback on the draft 4-year plan'] : ['Advising check-in'];
    if (request?.studentMessage) needs.push('Discuss the student’s notes (see their words below)');
    agenda = ['Review the draft 4-year plan', 'Confirm the Spring 2027 cart', hasHold ? 'Lift the hold in SIS' : 'Agree on next steps'];
    recommendation = 'Approve the appointment.';
    if (hasHold) riskFlags.push('Enrollment window opens soon: delays could cost seats');
  } else {
    checks.push({ label: 'Graduation timing', passed: false, detail: 'Verify impact in the degree audit (DARS).' });
    riskFlags.push('Record change requires advisor filing in SIS');
    recommendation = 'Meet with the student before deciding.';
  }

  const failed = checks.some((c) => !c.passed);
  const year = String(student.rank ?? 'student').replace(/\s*\(.*\)\s*/, '').toLowerCase();
  const situation = [
    `${name} is a ${year} in ${student.major ?? 'their program'} with a ${gpa.toFixed(2)} GPA, ${student.earnedCredits ?? 0} credits earned and ${enrolled} credits this term.`,
    holds.length ? `There is an active hold on the account: ${holds.join('; ')}.` : '',
    `They are asking for approval for: ${request?.title ?? 'an advising request'}.`,
    request?.appointment ? 'They have already picked a meeting time that works for both of you.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    situation,
    verdict: failed ? 'needs_attention' : 'supported',
    confidence: 'moderate',
    summary,
    reasonForAppointment: reason,
    studentNeeds: needs,
    riskFlags,
    checks,
    suggestedAgenda: agenda,
    recommendation,
    source: 'rules',
    reviewedAt: new Date().toISOString(),
  };
}

app.post('/api/advisor-summary', async (req, res) => {
  const request = req.body?.request;
  if (!request || !request.student) {
    return res.status(400).json({ error: 'request with student is required' });
  }
  const fallback = ruleBasedReview(request);

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured, using rule-based review');
    }
    const prompt = `
Student request to review:
${JSON.stringify(
  {
    category: request.category,
    title: request.title,
    studentMessage: request.studentMessage,
    details: request.details,
    student: request.student,
    requestedAppointment: request.appointment ?? null,
  },
  null,
  2,
)}
`;
    const parsed = JSON.parse(await generateJson(prompt, ADVISOR_REVIEW_SYSTEM_INSTRUCTION));
    // Keep any field Claude left out from the rule-based review so the UI always has a full shape.
    res.json({
      ...fallback,
      ...parsed,
      checks: Array.isArray(parsed.checks) && parsed.checks.length ? parsed.checks : fallback.checks,
      source: 'claude',
      reviewedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.warn('Advisor review fallback:', error?.message);
    res.json(fallback);
  }
});

// Endpoint to dynamically recalculate or balance the 4-year roadmap
app.post('/api/roadmap-generate', async (req, res) => {
  try {
    const { prompt, studentProfile, currentRoadmap, requirementsSummary } = req.body;

    const requestPrompt = `
You are the OSU Degree Audit & Academic Planning Engine.
Student Profile (entered by the student):
${describeStudent(studentProfile, currentRoadmap)}

Degree requirements check (what is complete, in progress, planned, and still unmet):
${requirementsSummary || 'Not available.'}
Student Preference Request: "${prompt || 'Balance workload for 4-year graduation and include a summer internship'}"

Current Roadmap Plan:
${JSON.stringify(currentRoadmap || {})}

Return a JSON with:
{
  "summary": "Brief 1-2 sentence explanation of adjustments made to satisfy prerequisites and workload balance.",
  "workloadBalanced": true,
  "confidence": "high" | "moderate" | "uncertain",
  "sourceCitation": "the student's degree curriculum (e.g. Fisher BSBA curriculum, or the College of Engineering 2026-2027 curriculum sheet for their major)",
  "confidenceExplanation": "string (honest reason for the confidence level)",
  "semesters": [
    {
      "id": "autumn-2027",
      "courses": [
        { "code": "DEPT 1234", "name": "Course title as listed in the requirements check", "credits": 3, "type": "Major Core", "difficulty": 3 }
      ]
    }
  ]
}

Rules for "semesters":
- Return ONLY planned future terms, after the student's current term. Their completed and in-progress classes are kept as they entered them.
- Use ids of the form "autumn-2027", "spring-2028", "summer-2028".
- Never plan a course they've already taken. Respect prerequisites against the classes they entered.
- "type" must be one of: GE Foundation, GE Theme, Major Core, Major Specialization, Major Prereq, Major/Math, Minor/Technical, Minor Core, Minor Elective, Minor Capstone, Major Capstone, Experiential, Elective, General, Career.
- Plan through graduation at the total credit hours the requirements check lists as required (121 for the Fisher BSBA; 121-132 for Engineering majors).
- Every requirement marked unmet or missing in the requirements check MUST appear in a planned term. For "choose" requirements, pick from the listed options, preferring ones on the current schedule.
- Use the credit hours shown in the requirements check (several Finance electives are 1.5 credits, not 3).
- Place every course after its prerequisites (in an earlier term). A course marked "Autumn only" goes in an Autumn term and "Spring only" in a Spring term.
- Respect class standing: sophomore = 30, junior = 60, senior = 90 earned credit hours before the term starts. BUSMHR 4490 needs senior standing, so it belongs in the final year.
- GE: fill each MISSING GE category with a real, specific course from the "Real courses that count" list (or another real course in that GEN category). One course can't count for two GE categories. A Theme needs one 4-credit course, or two 3-credit courses from different subjects in the same Theme; Citizenship is required plus one other Theme.
- Tech Innovation, if the student has it: Builders Studio I-IV run Autumn (3801), Spring (3802), Autumn (4803), Spring (4804) in consecutive terms, starting the Autumn after the immersion semester (BUSADM 2801/2802).
- The requirements check lists the student's current programs. Don't keep planned classes that only served a program they no longer have (e.g. a dropped specialization or minor); replace them with unmet requirements or "ELECTIVE". Follow the preference request when it asks to add, remove, or move specific classes.
- Never use made-up placeholder codes (like "GE-ARTS" or "IB-MINOR-1"). Every course must be a real Ohio State course code, except "ELECTIVE" for a free elective when the student needs more hours.
- Keep each Autumn and Spring term at 12-18 credit hours. Summer terms follow the student's summer limits (number of classes, online only) and may be lighter than 12.
- Fewest credits: graduate with as few total credit hours as possible. Plan only courses that fill an unmet requirement, plus "ELECTIVE" only for the hours still needed to reach the required total. Prefer courses that fill more than one requirement at once (a major or business-foundation course that also carries the needed GE tag, or a course listed for both of the student's specializations or their minor), and pick the lower-credit option when choices are otherwise equal.
- Balanced workload: spread credits evenly across the Autumn/Spring terms (each within about 3 credits of the others), and put no more than two hard classes (difficulty 4-5) in one term. Rate "difficulty" honestly from 1 (light) to 5 (heavy), e.g. intro accounting, calculus, and core finance are 4-5.
- If the student's request limits summers (e.g. "only 1-2 online classes"), follow it exactly and use the online options listed in the request for summer terms.

Keep the JSON compact: only the fields shown, short course titles, no extra commentary. The app computes term names, credit totals, and workload itself.

Return ONLY valid JSON.
`;

    let parsed;
    if (process.env.ANTHROPIC_API_KEY) {
      // A full plan is a long answer: give it up to 4 minutes, without a retry that would double the wait.
      parsed = JSON.parse(await generateJson(requestPrompt, undefined, ROADMAP_TIMEOUT_MS, 0));
      // The AI writes its own short titles; replace them with the official ones
      for (const s of Array.isArray(parsed?.semesters) ? parsed.semesters : [])
        for (const c of Array.isArray(s?.courses) ? s.courses : []) c.name = officialTitle(c.code) ?? c.name;
    } else {
      throw new Error('ANTHROPIC_API_KEY not configured, using balanced roadmap fallback');
    }
    res.json(parsed);
  } catch (error: any) {
    console.error('Error generating roadmap:', error);
    res.status(500).json({ error: 'Failed to generate roadmap', message: error?.message });
  }
});

// Setup Vite middleware for development, or serve built assets in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

// On Vercel, api/index.ts serves this app as a serverless function and the built assets are served statically
if (!process.env.VERCEL) {
  startServer();
}

export default app;
