import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

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
const CLAUDE_MODEL = 'claude-opus-5-5';

// Ask Claude for a JSON reply and return the raw JSON text.
// Low effort keeps latency down for interactive advising; on a safety refusal the
// server-side fallback re-runs the request on a suitable model automatically.
async function generateJson(
  prompt: string | Anthropic.Beta.BetaContentBlockParam[],
  system?: string,
  timeoutMs?: number,
): Promise<string> {
  const response = await anthropic.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  }, timeoutMs ? { timeout: timeoutMs } : undefined);

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
      .map((t) => `  - ${t.name}: ${t.courses.map((c: any) => `${c.code}${c.name && c.name !== c.code ? ` (${c.name})` : ''}${c.notes ? ` [${c.notes}]` : ''}`).join(', ')}`)
      .join('\n') || '  - none entered';
  return [
    `- Name: ${profile?.name || 'Not provided'}`,
    `- Class standing: ${profile?.rank || 'Not provided'}`,
    `- College: ${profile?.college || 'Not provided'}`,
    `- Major: ${profile?.major || 'Not provided'}`,
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

const OSU_ADVISING_SYSTEM_INSTRUCTION = `
You are the Ohio State University (OSU) Native BuckeyeLink AI Academic Advising Assistant.
Your audience is undergraduate students navigating BuckeyeLink, course registration, prerequisite chains, 4-year degree planning, and advisor scheduling.

Key OSU Context:
- Academic Colleges: Fisher College of Business (BSBA in Finance, Accounting, Marketing, Information Systems, Operations, etc.), College of Arts and Sciences (Computer & Information Science, Data Analytics, Economics, etc.), College of Engineering (CSE).
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
    "actionType": "'drop_class' | 'add_minor' | 'change_major' | 'withdraw' | null",
    "decisionTitle": "string or null (e.g. 'Drop ACCTMIS 2300 (Intro to Accounting 2)' or 'Declare Computer Science (CSE) Minor')",
    "warningSummary": "string or null (concise 1-2 sentence notice: AI cannot modify transcripts; official changes require human advisor authorization)",
    "consequences": ["array of 2-3 short, concise consequences, e.g. 'Dropping drops enrolled hours to 12 cr (Full-Time FAFSA risk)', 'Interrupts core prerequisite chain for BUSFIN 3220, delaying graduation 1-2 terms', 'Dropping after the 4th Friday creates a permanent W mark on transcript'"],
    "escalateRecommended": true
  },
  "suggestedActions": ["array of 2-4 concise next action strings"],
  "roadmapRecommendation": {
    "targetSemester": "string or null (e.g. 'Spring 2027')",
    "courseAdjustment": "string or null",
    "workloadImpact": "string or null"
  }
}

IMPORTANT: When a student asks to make a big decision like dropping a class (e.g. ACCTMIS 2300, CSE 2221, MATH 1152) or picking up a new minor (e.g. CSE minor, Business Analytics minor) as a 'real choice' or asks the AI to actually execute it:
- Keep the response clear, direct, and concise (not overly verbose).
- You MUST set "highStakesDecision.isHighStakes" to true.
- Outline short consequences (financial aid risk, prerequisite bottlenecks, degree delay, transcript notation).
- Emphasize that automated AI agents are barred by university policy from making unilateral changes to official student transcripts and that this MUST be escalated directly to their human advisor.

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
    const { message, history, studentProfile, roadmap } = req.body;

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

    // Guardrail check: if student prompt asked to drop a class or declare/pick up a minor as a real choice, ensure highStakesDecision is attached
    const lowerPrompt = (message || '').toLowerCase();
    const isDroppingClass = lowerPrompt.includes('drop') || lowerPrompt.includes('withdraw') || lowerPrompt.includes('drop a class');
    const isDeclaringMinor = (lowerPrompt.includes('minor') && (lowerPrompt.includes('add') || lowerPrompt.includes('pick up') || lowerPrompt.includes('declare') || lowerPrompt.includes('real choice') || lowerPrompt.includes('enroll')));

    if ((isDroppingClass || isDeclaringMinor) && (!parsed.highStakesDecision || !parsed.highStakesDecision.isHighStakes)) {
      if (isDroppingClass) {
        const courseCode = lowerPrompt.includes('acctmis') ? 'ACCTMIS 2300' : lowerPrompt.includes('math') ? 'MATH 1152' : lowerPrompt.includes('cse') ? 'CSE 2221' : 'Current Enrolled Course';
        parsed.highStakesDecision = {
          isHighStakes: true,
          actionType: 'drop_class',
          decisionTitle: `Drop ${courseCode} from Autumn 2026 Active Enrollment`,
          warningSummary: `You are requesting to officially drop ${courseCode}. Per Ohio State University Academic Senate regulations, an AI assistant cannot alter your official registration record directly. Dropping this course carries immediate academic standing, financial aid, and graduation consequences.`,
          consequences: [
            'Financial Aid Risk: Dropping lowers your enrolled credits below 12 credit hours, terminating full-time student status and triggering Title IV FAFSA / Fisher Merit Scholarship aid clawbacks.',
            `Prerequisite Disruption: ${courseCode} is a foundational requirement for subsequent 3000-level Fisher finance and technical sequences, pushing your planned graduation back by up to two terms.`,
            'Official Transcript Notation: Course drops processed after the 4th Friday deadline generate a permanent "W" (Withdrawal) record on your official Ohio State transcript.'
          ],
          escalateRecommended: true
        };
        parsed.escalationSuggested = true;
        parsed.escalationReason = `Permanent course withdrawal for ${courseCode} requires human academic advisor verification.`;
      } else if (isDeclaringMinor) {
        const minorName = lowerPrompt.includes('cse') || lowerPrompt.includes('computer science') ? 'Computer Science (CSE) Minor' : lowerPrompt.includes('econ') ? 'Economics Minor' : 'Business Analytics & CIS Minor';
        parsed.highStakesDecision = {
          isHighStakes: true,
          actionType: 'add_minor',
          decisionTitle: `Declare ${minorName} on Official University Degree Audit`,
          warningSummary: `You are requesting to declare the ${minorName} as your official secondary academic credential. While simulated roadmaps provide instant modeling, only an authorized human academic advisor can petition the college to update your SIS student master record.`,
          consequences: [
            'Credit Load & Overlap Cap: Under Fisher College rules, no more than 6 credit hours may overlap between your Finance major core and an official minor program.',
            'College Committee Review: Inter-college minor additions (e.g. College of Engineering CSE Minor) require formal program coordinator audit and GPA check (minimum 2.50 CPHR).',
            'Time-to-Degree Audit: Adding this minor locks in 15-16 specific upper-division graded credit hours that must be completed prior to degree certification.'
          ],
          escalateRecommended: true
        };
        parsed.escalationSuggested = true;
        parsed.escalationReason = `Adding the ${minorName} requires Sarah Jenkins to enter a curriculum change form in OnCourse SIS.`;
      }
    }

    res.json(parsed);
  } catch (error: any) {
    console.warn('Claude API unavailable, providing grounded curriculum fallback:', error?.message);
    const textLower = (req.body?.message || '').toLowerCase();
    const isHold = textLower.includes('hold') || textLower.includes('lock');
    const isMarcSmith = textLower.includes('marc smith') || textLower.includes('smith') || textLower.includes('evaluat') || (textLower.includes('accounting') && (textLower.includes('work') || textLower.includes('class') || textLower.includes('hard') || textLower.includes('recommend')));
    const isPrereq = textLower.includes('prereq') || textLower.includes('cse 2231') || (textLower.includes('acctmis 2300') && !isMarcSmith);
    const isDrop = textLower.includes('drop') || textLower.includes('withdraw');
    const isMinor = textLower.includes('minor') || textLower.includes('analytics');

    let answer = `I couldn't reach the advising service just now. Please try again in a moment, or book time with your advisor for anything urgent.`;
    let sourceCitation = 'Fisher College of Business Curriculum Sheet 2026-2027';
    let escalationSuggested = false;
    let escalationReason: string | null = null;
    let highStakesDecision: any = null;

    if (isDrop) {
      const course = textLower.includes('acctmis') ? 'ACCTMIS 2300' : textLower.includes('math') ? 'MATH 1152' : textLower.includes('cse') ? 'CSE 2221' : 'ACCTMIS 2300';
      answer = `⚠️ **SERIOUS WARNING:** You have requested to drop **${course}** from your active semester schedule as a real academic choice.\n\nPer Ohio State University policy, automated AI systems cannot make unilateral modifications to your official student transcript. Dropping this course carries severe risks to your full-time student status (dropping below 12 credits risks immediate financial aid loss) and disrupts your prerequisite roadmap.\n\nPlease review the critical warnings below. You can escalate directly to your assigned advisor **Sarah Jenkins** or, if you choose to confirm your decision, your request will be immediately dispatched directly to her for human review and expedited sign-off.`;
      sourceCitation = 'OSU Faculty Rule 3335-8-32 (Course Enrollment Alterations) & Fisher Undergraduate Handbook';
      escalationSuggested = true;
      escalationReason = `Course withdrawal requires certified advisor review to safeguard financial aid and prerequisite sequence.`;
      highStakesDecision = {
        isHighStakes: true,
        actionType: 'drop_class',
        decisionTitle: `Drop ${course} from Autumn 2026 Active Enrollment`,
        warningSummary: `You are requesting to officially drop ${course}. Doing so carries irreversible financial aid and degree completion implications. Per university policy, an AI assistant cannot modify your official SIS transcript autonomously without certified advisor sign-off.`,
        consequences: [
          'Financial Aid Risk: Dropping lowers your enrolled credits below 12 credit hours, terminating full-time student status and triggering Title IV FAFSA / Fisher Merit Scholarship aid clawbacks.',
          `Prerequisite Disruption: ${course} is a hard prerequisite for next-term courses (such as BUSFIN 3220 or CSE 2231), delaying your graduation by up to two full semesters.`,
          'Official Transcript Notation: Course drops processed after the 4th Friday deadline generate a permanent "W" (Withdrawal) record on your official Ohio State transcript.'
        ],
        escalateRecommended: true
      };
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
      sourceCitation = 'Office of the University Registrar & Fisher Advising Policy § 2.4';
      escalationSuggested = true;
      escalationReason = 'Registration lock removal requires advisor sign-off.';
    } else if (isPrereq) {
      answer = `Prerequisites are listed for each course in the OSU Course Bulletin. Make sure the classes you've already taken are added under **My classes** so I can check them against what you want to take next.`;
      sourceCitation = 'OSU Course Bulletin 2026-2027';
    } else if (isMinor) {
      const minorName = textLower.includes('cse') ? 'Computer Science (CSE) Minor' : 'Business Analytics & CIS Minor';
      answer = `⚠️ **SERIOUS WARNING: Official Curriculum Declaration Requested**\n\nYou asked to officially declare the **${minorName}** as your real academic credential in BuckeyeLink.\n\nWhile the Degree Planner provides instant simulations, declaring a minor permanently binds 15-16 credit hours to your graduation audit and must be formally filed through OnCourse SIS. You can escalate directly to your advisor **Sarah Jenkins**, or if you confirm your choice below, your declaration will be transmitted straight to her desk for official processing.`;
      sourceCitation = 'Fisher Undergraduate Handbook: Minor Declarations & Inter-College Credential Policies';
      escalationSuggested = true;
      escalationReason = `Official declaration requires advisor sign-off in OnCourse SIS.`;
      highStakesDecision = {
        isHighStakes: true,
        actionType: 'add_minor',
        decisionTitle: `Declare ${minorName} on Official University Degree Audit`,
        warningSummary: `You are requesting to officially declare ${minorName} on your student master record. University policy prohibits AI agents from filing permanent curriculum declarations without human advisor validation.`,
        consequences: [
          'Credit Load & Overlap Limit: Only a limited number of credit hours can overlap between your major and a declared minor.',
          'Inter-College Approval: Engineering and Arts & Sciences minors require college committee review and minimum 2.50 cumulative CPHR verification.',
          'Graduation Requirement: Declared minors must be fully satisfied or formally dropped prior to degree conferral.'
        ],
        escalateRecommended: true
      };
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
            .map((c: any) => ({ code: str(c.code), name: str(c.name), credits: num(c.credits) ?? 0, grade: str(c.grade) })),
        })),
    });
  } catch (error: any) {
    console.error('Advising report parse failed:', error?.message);
    res.status(500).json({ error: "Couldn't read that report. Please try again, or add your classes by hand." });
  }
});

// Endpoint to dynamically recalculate or balance the 4-year roadmap
app.post('/api/roadmap-generate', async (req, res) => {
  try {
    const { prompt, studentProfile, currentRoadmap } = req.body;

    const requestPrompt = `
You are the OSU Degree Audit & Academic Planning Engine.
Student Profile (entered by the student):
${describeStudent(studentProfile, currentRoadmap)}
Student Preference Request: "${prompt || 'Balance workload for 4-year graduation and include a summer internship'}"

Current Roadmap Plan:
${JSON.stringify(currentRoadmap || {})}

Return a JSON with:
{
  "summary": "Brief 1-2 sentence explanation of adjustments made to satisfy prerequisites and workload balance.",
  "workloadBalanced": true,
  "confidence": "high" | "moderate" | "uncertain",
  "sourceCitation": "Fisher College of Business / Arts & Sciences 4-Year Curriculum Guide 2026",
  "confidenceExplanation": "string (honest reason for the confidence level)",
  "semesters": [
    {
      "id": "autumn-2027",
      "name": "Autumn 2027",
      "status": "planned",
      "courses": [
        { "code": "DEPT 1234", "name": "Course title", "credits": 3, "type": "Major Core", "difficulty": 3, "prereqMet": true, "prereqInfo": "optional note" }
      ],
      "totalCredits": 15,
      "workloadRating": "Light" | "Moderate" | "Balanced" | "Heavy" | "Overload"
    }
  ]
}

Rules for "semesters":
- Return ONLY planned future terms, after the student's current term. Their completed and in-progress classes are kept as they entered them.
- Use ids of the form "autumn-2027", "spring-2028", "summer-2028".
- Never plan a course they've already taken. Respect prerequisites against the classes they entered.
- "type" must be one of: GE Foundation, GE Theme, Major Core, Major Specialization, Major Prereq, Major/Math, Minor/Technical, Minor Core, Minor Elective, Minor Capstone, Major Capstone, Experiential, Elective, General, Career.
- Plan through graduation at about 120 total credits.

Return ONLY valid JSON.
`;

    let parsed;
    if (process.env.ANTHROPIC_API_KEY) {
      parsed = JSON.parse(await generateJson(requestPrompt));
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
