"""College of Arts and Sciences degrees, majors, minors, and special programs as seed data.

Sources (read November 2026):
  Degree (college) requirements and the GE:
    https://artsandsciences.osu.edu/advising/general-education-requirements/new-ge-requirements
      BA_(new)_GE_AU26.pdf, BS_(new)_GE_AU26.pdf, PPA_(new)_GE_AU26.pdf (Professional Programs in the Arts)
    https://artsandsciences.osu.edu/advising/general-education-requirements/legacy-ge-requirements (GE Legacy sheets)
  Majors: each department's major requirements page or advising sheet (each major's `source_url`), found from
    https://artsandsciences.osu.edu/academics/programs/majors
  Minors: each minor's official advising sheet, linked from https://artsandsciences.osu.edu/academics/programs/minors

How ASC is modeled (see CLAUDE.md):
  - The degree (BA, BS, BFA, BM, BME, BSD, BAE) holds the college requirements: the GE, world language, BS calculus,
    BA additional arts/humanities/social science course, College Survey, Civic Literacy, 121 hours.
  - Each major is a `specialization` of its degree (`parent_id`). A double major is a second specialization, like
    Fisher's double specializations; each major needs 18 unique hours, so shared courses are flagged.
  - Degrees have three versions by entering class: entered Autumn 2026 or later (base), Autumn 2022 - Summer 2026
    (no BA additional course; Civic Literacy only if graduating Spring 2030+), and before Autumn 2022 (GE Legacy).

Titles, credit hours, prerequisites, and offered terms come from OSU Class Search (src/data/ascFaculty.json,
engineeringFaculty.json, fisherFaculty.json; Autumn 2026 and Spring 2027), so course lists here are mostly codes.
Courses in an ASC/Engineering/Fisher subject that are on neither schedule are marked not scheduled.

Edit the data below, then run:
  python3 scripts/asc_requirements.py degree > supabase/migrations/<timestamp>_seed_asc_requirements.sql
  python3 scripts/asc_requirements.py minors > supabase/migrations/<timestamp>_seed_asc_minors.sql
and apply that file to Supabase. Each replaces only the College of Arts and Sciences' rows for its scope.
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fisher_requirements import build, group  # noqa: E402

COLLEGE = "College of Arts and Sciences"
CATALOG = "College of Arts and Sciences, entered Autumn 2026 or later"
ASC_URL = "https://artsandsciences.osu.edu/advising/general-education-requirements/new-ge-requirements"
GEL_URL = "https://artsandsciences.osu.edu/advising/general-education-requirements/legacy-ge-requirements"
MAJORS_URL = "https://artsandsciences.osu.edu/academics/programs/majors/"
MINORS_URL = "https://artsandsciences.osu.edu/academics/programs/minors/"

# ---------- Course catalog (OSU Class Search, Autumn 2026 + Spring 2027) ----------

DATA = os.path.join(os.path.dirname(__file__), "..", "src", "data")


def _load_catalog():
    cat = {}
    for f in ("ascFaculty.json", "engineeringFaculty.json", "fisherFaculty.json"):
        for course in json.load(open(os.path.join(DATA, f)))["courses"]:
            seasons = sorted({t["term"].split(" ")[0] for t in course.get("terms", [])})
            cr = course.get("credits") or ""
            credits = float(cr) if re.fullmatch(r"\d+(\.\d+)?", cr) else (float(cr.split("-")[0]) if cr[:1].isdigit() else None)
            cat[course["id"]] = {"title": (course.get("title") or course["id"]).strip(), "credits": credits, "prereq": course.get("prereq"),
                                 "seasons": seasons}
    ge = json.load(open(os.path.join(DATA, "geCourses.json")))["courses"]
    return cat, ge


CATALOG_COURSES, GE_COURSES = _load_catalog()
SCHEDULED_SUBJECTS = {code.split(" ")[0] for code in CATALOG_COURSES}


def info(code):
    """Title, credits, prerequisites and seasons for a course code (honors and decimal variants fall back to the base)."""
    for key in (code, re.sub(r"H$", "", code), re.sub(r"\.\d+H?$", "", code)):
        if key in CATALOG_COURSES:
            return CATALOG_COURSES[key], key == code
    # "STAT 1450" on a sheet = any of Class Search's STAT 1450.01 / 1450.02 sections: offered whenever any of them is
    if "." not in code:
        variants = [v for k, v in CATALOG_COURSES.items() if k.startswith(code + ".") and not k.endswith("H")]
        if variants:
            seasons = sorted({s for v in variants for s in v["seasons"]})
            return {**variants[0], "seasons": seasons}, True
    for key in (code, re.sub(r"H$", "", code)):
        if key in GE_COURSES:
            g = GE_COURSES[key]
            return {"title": g["title"], "credits": g.get("credits"), "prereq": None, "seasons": None}, False
    return None, False


def course(code, title=None, credits=None, prereqs=None, *, grade="C-", alternates=(), equivalents=(), notes=None,
           standing=None, secondary=False, offered=None):
    """One requirement course; anything not given comes from Class Search."""
    code = re.sub(r"\s+", " ", code.strip().upper())
    found, exact = info(code)
    if offered is None:
        if found and found["seasons"] is not None and exact:
            s = found["seasons"]
            offered = [] if set(s) >= {"Autumn", "Spring"} else [x for x in s if x in ("Autumn", "Spring")] or ["None"]
        elif code.split(" ")[0] in SCHEDULED_SUBJECTS and not found:
            offered = ["None"]  # an ASC/Engineering/Fisher course on neither the Autumn 2026 nor Spring 2027 schedule
        else:
            offered = []  # another college's course, or a section variant: not checked
    out = {
        "code": code,
        "title": title or (found["title"] if found else "Listed on the advising sheet"),
        "credits": credits if credits is not None else (found["credits"] if found else None),
        "prerequisites": prereqs if prereqs is not None else (found or {}).get("prereq"),
        "min_grade": grade,
        "alternates": list(alternates),
        "equivalents": list(equivalents),
        "is_secondary": secondary,
        "notes": notes,
        "offered": offered,
    }
    if standing:
        out["min_standing"] = standing
    return out


def cs(spec, **kw):
    """Courses from compact text: "PSYCH 1100 2220; STAT 1450/1350" -> PSYCH 1100, PSYCH 2220, STAT 1450 (alt. STAT 1350).
    A bare number reuses the previous subject; "a/b" makes b an accepted alternate of a."""
    out = []
    subject = None
    for chunk in re.split(r"[;,]\s*|\s+(?=[A-Z]{2,8}\s)", spec.strip()):
        for token in re.findall(r"(?:[A-Z]{2,8}\s+)?[\dX]{4}(?:\.\d{2})?[A-Z]?(?:/(?:[A-Z]{2,8}\s+)?\d{4}(?:\.\d{2})?[A-Z]?)*", chunk):
            parts = token.split("/")
            codes = []
            for p in parts:
                m = re.match(r"([A-Z]{2,8})\s+(.+)", p)
                if m:
                    subject = m.group(1)
                    codes.append(f"{subject} {m.group(2)}")
                else:
                    codes.append(f"{subject} {p}")
            out.append(course(codes[0], alternates=codes[1:], **kw))
    return out


def req(gid, title, spec, notes=None, **kw):
    """Every course listed is required."""
    return group(gid, title, "all", cs(spec, **kw) if isinstance(spec, str) else spec, notes=notes)


def pick(gid, title, n, spec, notes=None, pattern=None, exclude=(), **kw):
    """Choose n courses from the list (or matching `pattern`)."""
    courses = cs(spec, **kw) if isinstance(spec, str) else spec
    return group(gid, title, "choose_courses", courses, min_courses=n, notes=notes, code_pattern=pattern,
                 exclude_codes=list(exclude))


def hours(gid, title, n, spec="", notes=None, pattern=None, exclude=(), **kw):
    """At least n credit hours from the list (or matching `pattern`)."""
    courses = cs(spec, **kw) if isinstance(spec, str) else spec
    return group(gid, title, "choose_credits", courses, min_credits=n, notes=notes, code_pattern=pattern,
                 exclude_codes=list(exclude))


def manual(gid, title, notes):
    return group(gid, title, "manual", notes=notes)


def upper(subjects, low=3000, high=5999):
    """Code pattern for subject courses numbered low..high (e.g. upper("ECON") = ECON 3000-5999)."""
    subj = subjects if isinstance(subjects, str) else "|".join(subjects)
    lo, hi = str(low)[0], str(high)[0]
    return rf"^({subj}) [{lo}-{hi}]\d{{3}}(\.\d{{2}})?[A-Z]?$"


# ---------- College (degree) requirements ----------

MAJOR_RULES = ("At least 30 credit hours at the 2000 level or above; C- or better in each major course and a 2.00 GPA across the "
               "major; no Pass/Non-Pass. At least half the major's hours must be Ohio State courses (not AP or transfer credit). "
               "A second major needs at least 18 hours that don't overlap with the first. Up to two GE Theme courses (one "
               "Citizenship, one other Theme) may count on the major; GE Foundation courses may not.")

DEGREE_RULES = ("121 credit hours, including 111 hours of Arts and Sciences (or ASC-approved) courses and 39 upper-division hours "
                "(3000 level and above, plus 2000-level math, physical science, and world-language courses); 30 hours earned "
                "at Ohio State; a 2.00 cumulative GPA and a 2.00 GPA in the major; a graduation application by the deadline.")

LANGUAGES = ("ARABIC|ASL|BCS|CHINESE|CZECH|FRENCH|GERMAN|GREEK|HEBREW|HINDI|ITALIAN|JAPANSE|KOREAN|LATIN|MDRNGRK|PERSIAN|POLISH|"
             "PORTGSE|QUECHUA|ROMANIAN|RUSSIAN|SOMALI|SPANISH|SWAHILI|SWEDISH|TURKISH|UKRAINE|URDU|UZBEK|YIDDISH")

CIVIC = "AFAMAST 2006; CIVICLL 2110; CLAS 2207; COMPSTD 2006; ENGLISH 2195; HISTORY 2003; PHILOS 2490; POLITSC 1166; WGSST 2006"


def survey():
    return req("{p}-survey", "Arts and Sciences College Survey", [
        course("ARTSSCI 1100.01", "Arts and Sciences Survey", 1, grade=None,
               alternates=[f"ARTSSCI 1100.{n:02d}" for n in range(2, 20)] + ["ARTSSCI 1100.01H"],
               notes="Any ARTSSCI 1100 section (General, Transfer, Biological Sciences, Design, Music, ...), first semester."),
    ])


def world_language(through="1103", note=None):
    return pick("{p}-language", f"World language through {through}", 1, [], grade=None,
                pattern=rf"^({LANGUAGES}) ({through[:2]}(0[3-9]|[1-9]\d)|[2-5]\d{{3}})(\.\d{{2}})?[A-Z]?$" if through == "1103"
                else rf"^({LANGUAGES}) (1102|1103|[2-5]\d{{3}})(\.\d{{2}})?[A-Z]?$",
                notes=note or ("Course work or proficiency through the third language course (1103 or equivalent) in any language "
                               "Ohio State teaches. Proficiency by placement test, high-school study, or a heritage language also "
                               "counts: if you placed out, tell your advisor and BuckAI treats this as met once it's on your report."))


def calculus_bs():
    return req("{p}-calculus", "BS requirement: Calculus", [
        course("MATH 1151", grade=None, alternates=["MATH 1156", "MATH 1161", "MATH 1161.01", "MATH 1161.02", "MATH 1181H",
                                                     "MATH 1141"],
               notes="MATH 1151, 1156, 1161, 1181H, or 1140 + 1141. If you don't place into calculus, take the prerequisite first."),
    ])


def extra_arts_ba():
    return manual("{p}-extra", "BA requirement: Additional arts, humanities, or social science course",
                  "One more 3-credit course from the same GE Foundation area (Literary, Visual & Performing Arts; Historical & "
                  "Cultural Studies; or Social & Behavioral Sciences) in which you complete Civic Literacy, not another Civic "
                  "Literacy course. Required for BA students who entered Autumn 2026 or later. Confirm the course with your advisor.")


def civic(required=True):
    if required:
        return pick("{p}-civic", "Civic Literacy (State of Ohio)", 1, CIVIC, grade=None,
                    notes="Required for every Ohio bachelor's degree awarded Spring 2030 or later. May also count as a GE Foundation.")
    return pick("{p}-civic", "Civic Literacy (if you graduate Spring 2030 or later)", 1, CIVIC, grade=None,
                notes="Only students graduating Spring 2030 or later need this; if you finish earlier, ignore it. May also count as "
                      "a GE Foundation.")


def ge_groups():
    return [
        group("{p}-ge-launch", "GE Launch Seminar", "all", [
            course("GENED 1201", "GE Launch Seminar", 1, grade=None, alternates=["GENED 2601", "GENED 2601.01"],
                   notes="Take by your third semester. Specified transfer students take GENED 2601.01 instead of Launch and Reflection."),
        ]),
        group("{p}-ge-writing", "GE Foundation: Writing & Information Literacy", "ge", ge_category="writing", min_credits=3),
        group("{p}-ge-math", "GE Foundation: Mathematical & Quantitative Reasoning or Data Analysis", "ge", ge_category="math",
              min_credits=3),
        group("{p}-ge-arts", "GE Foundation: Literary, Visual & Performing Arts", "ge", ge_category="arts", min_credits=3),
        group("{p}-ge-history", "GE Foundation: Historical & Cultural Studies", "ge", ge_category="history", min_credits=3),
        group("{p}-ge-natsci", "GE Foundation: Natural Sciences (with lab)", "ge", ge_category="natsci", min_credits=4,
              notes="A 4-5 credit lab science, or a 3-credit course with its department's 1-credit lab."),
        group("{p}-ge-sbs", "GE Foundation: Social & Behavioral Sciences", "ge", ge_category="sbs", min_credits=3),
        group("{p}-ge-diversity", "GE Foundation: Race, Ethnicity & Gender Diversity", "ge", ge_category="diversity", min_credits=3),
        group("{p}-ge-citizenship", "GE Theme: Citizenship for a Diverse & Just World", "ge", ge_category="theme-citizenship",
              min_credits=4, notes="One 4-credit course, or two 3-credit courses from different departments."),
        group("{p}-ge-theme", "GE Theme: Student Choice", "ge", ge_category="theme-other", min_credits=4,
              notes="One more Theme: one 4-credit course, or two 3-credit courses from different departments in that Theme."),
        group("{p}-ge-reflection", "GE Reflection Seminar", "all", [
            course("GENED 4001", "GE Reflection Seminar", 1, grade=None, standing=90,
                   notes="Take in your next-to-last or last semester. Doesn't count toward the 39 upper-division hours."),
        ]),
    ]


def gel_group():
    return manual("{p}-ge-legacy", "General Education (GE Legacy)",
                  "You entered Ohio State before Autumn 2022, so you follow the GE Legacy: Writing (6), Quantitative & Logical "
                  "Skills, Natural Science (10, with lab), Literature, Visual & Performing Arts, Social Science (6), Historical "
                  "Study, Cultures & Ideas, Open Options, Social Diversity in the US, Global Studies, and world language through "
                  "1103. Your BuckeyeLink advising report lists which GEL categories are still open; confirm with your ASC advisor.")


def fill(groups, prefix):
    out = []
    for g in groups:
        g = dict(g, id=g["id"].replace("{p}", prefix))
        out.append(g)
    return out


DEGREES = {
    # id: (name, abbreviation, sheet, extra college groups for entrants Autumn 2026+)
    "asc-ba": ("Bachelor of Arts (BA)", "BA", "BA_(new)_GE_AU26.pdf"),
    "asc-bs": ("Bachelor of Science (BS)", "BS", "BS_(new)_GE_AU26.pdf"),
    "asc-bfa": ("Bachelor of Fine Arts (BFA)", "BFA", "PPA_(new)_GE_AU26.pdf"),
    "asc-bm": ("Bachelor of Music (BM)", "BM", "PPA_(new)_GE_AU26.pdf"),
    "asc-bme": ("Bachelor of Music Education (BME)", "BME", "PPA_(new)_GE_AU26.pdf"),
    "asc-bsd": ("Bachelor of Science in Design (BSD)", "BSD", "PPA_(new)_GE_AU26.pdf"),
    "asc-bae": ("Bachelor of Art Education (BAE)", "BAE", "PPA_(new)_GE_AU26.pdf"),
}
PROFESSIONAL = {"asc-bfa", "asc-bm", "asc-bme", "asc-bsd", "asc-bae"}


def degree_groups(did, cohort):
    """College requirement groups for a degree. cohort: 'au26' (entered Autumn 2026+), 'au22' (Autumn 2022-Summer 2026)."""
    gs = [survey()]
    if did == "asc-ba":
        gs.append(world_language())
        if cohort == "au26":
            gs.append(extra_arts_ba())
    elif did == "asc-bs":
        gs += [world_language(), calculus_bs()]
    elif did == "asc-bm":
        gs.append(manual("{p}-language", "World language (Music History and Voice only)",
                         "Music History: course work or proficiency through French or German 1103. Voice: through 1102 in French, "
                         "German, or Italian (a different language from the one studied in high school). Other BM majors: none."))
    gs += ge_groups()
    gs.append(civic(required=cohort == "au26"))
    return gs


def degree(did):
    name, abbr, sheet = DEGREES[did]
    pro = did in PROFESSIONAL
    notes = (DEGREE_RULES + (" BME students need a 3.00 cumulative GPA." if did == "asc-bme" else "")
             + (" Professional Programs in the Arts are selective-admission; some need a higher major GPA (Art BFA 2.25, Art "
                "Education 3.0, Dance 2.2, Design 2.25, Music Education 3.0)." if pro else "")
             + " Pick your major below; add a second major if you're double majoring.")
    base = {
        "id": did, "kind": "degree", "name": name, "min_total_credits": 121, "min_gpa": 3.0 if did == "asc-bme" else 2.0,
        "source_url": ASC_URL, "catalog": f"Arts and Sciences {abbr}, entered Autumn 2026 or later ({sheet})",
        "entry_from": "autumn-2026", "notes": notes, "groups": fill(degree_groups(did, "au26"), did),
    }
    au22 = {
        **base, "id": did + "-gen22", "version_of": did, "entry_from": "autumn-2022", "entry_through": "summer-2026",
        "catalog": f"Arts and Sciences {abbr}, entered Autumn 2022 - Summer 2026 (new GE)",
        "groups": fill(degree_groups(did, "au22"), did + "-gen22"),
    }
    gel_groups = [g for g in degree_groups(did, "au22") if "-ge-" not in g["id"] and "-language" not in g["id"]] + [gel_group()]
    gel = {
        **base, "id": did + "-gel", "version_of": did, "entry_from": None, "entry_through": "summer-2022",
        "catalog": f"Arts and Sciences {abbr}, entered before Autumn 2022 (GE Legacy)", "source_url": GEL_URL,
        "groups": fill(gel_groups, did + "-gel"),
    }
    return [base, au22, gel]


# ---------- Majors ----------

MAJORS = []  # filled below, one block per department


def major(mid, name, deg, url, groups, notes="", credits=None, admission=None):
    """A major (kind specialization) on degree `deg` ('ba', 'bs', 'bfa', 'bm', 'bme', 'bsd', 'bae')."""
    parent = "asc-" + deg
    full_notes = " ".join(x for x in [
        (f"About {credits} credit hours in the major." if isinstance(credits, (int, float)) else credits) if credits else "",
        f"Admission: {admission}" if admission else "",
        notes,
        MAJOR_RULES,
    ] if x)
    p = {"id": f"asc-{mid}-{deg}", "kind": "specialization", "name": name, "parent_id": parent, "source_url": url,
         "catalog": f"{name}, {DEGREES[parent][1]} (current advising sheet)", "notes": full_notes,
         "groups": [dict(g, id=f"{mid}-{deg}-{g['id']}") for g in groups]}
    MAJORS.append(p)
    return p


def sup(spec, **kw):
    """Supporting (prerequisite) courses: they don't count in the major's hours, and no C- minimum beyond prerequisites."""
    return cs(spec, grade=None, **kw)


def both(mid, name, url, groups_for, **kw):
    """A major offered as both a BA and a BS; groups_for(deg) gives that degree's groups."""
    return [major(mid, name, "ba", url, groups_for("ba"), **kw), major(mid, name, "bs", url, groups_for("bs"), **kw)]


# ---------- Biology (Center for Life Sciences Education) ----------
BIO_URL = "https://clse.osu.edu/students/requirements/bs-ba-compare"
BIOSCI = "BIOCHEM|BIOLOGY|EEOB|MICRBIO|MOLGEN"
BIO_LABS = ("Three lab courses in the major (beyond the supporting-course labs), e.g. EEOB 3320, 3410, 3520, MICRBIO 4000, MOLGEN 3300, "
            "5601. Full list: https://clse.osu.edu/lab-courses-biology-majors")
BIO_POLICY = ("32 credit hours of core, required, specialization and elective courses (supporting courses don't count), at least 25 "
              "of them in the biological sciences (BIOCHEM, BIOLOGY, EEOB, MICRBIO, MOLGEN), including three lab courses. "
              "Electives are 2000-level or above (3000+ for BIOCHEM and BIOLOGY); up to 3 hours of research, individual study, or "
              "internship count. Honors versions substitute freely.")


def bio_support(deg):
    if deg == "ba":
        return [
            req("support", "Supporting courses (BA)", [
                course("BIOLOGY 1113", grade=None, alternates=["BIOLOGY 1113H", "BIOLOGY 1113.01", "BIOLOGY 1113.02"]),
                course("BIOLOGY 1114", grade=None, alternates=["BIOLOGY 1114H", "BIOLOGY 1114.01", "BIOLOGY 1114.02"]),
                course("CHEM 1210", grade=None, alternates=["CHEM 1610", "CHEM 1910H"], equivalents=["CHEM 1208"],
                       notes="CHEM 1206 + 1208 also counts."),
                course("CHEM 1220", grade=None, alternates=["CHEM 1620", "CHEM 1920H"]),
                course("CHEM 2310", grade=None, alternates=["CHEM 2510"],
                       notes="Or CHEM 2510 with 2520 or 2540."),
                course("MATH 1150", grade=None, alternates=["MATH 1149", "MATH 1151", "STAT 1450"],
                       notes="MATH 1148 + 1149, MATH 1150, or MATH 1148 + STAT 1450."),
                course("PHYSICS 1200", grade=None, alternates=["PHYSICS 1250"], notes="PHYSICS 1250 needs MATH 1152."),
            ]),
        ]
    return [
        req("support", "Supporting courses (BS)", [
            course("BIOLOGY 1113", grade=None, alternates=["BIOLOGY 1113H", "BIOLOGY 1113.01", "BIOLOGY 1113.02"]),
            course("BIOLOGY 1114", grade=None, alternates=["BIOLOGY 1114H", "BIOLOGY 1114.01", "BIOLOGY 1114.02"]),
            course("CHEM 1210", grade=None, alternates=["CHEM 1610", "CHEM 1910H"], equivalents=["CHEM 1208"],
                   notes="General chemistry is the prerequisite for the organic sequence."),
            course("CHEM 1220", grade=None, alternates=["CHEM 1620", "CHEM 1920H"]),
            course("CHEM 2510", grade=None, alternates=["CHEM 2610", "CHEM 2910H"]),
            course("CHEM 2520", grade=None, alternates=["CHEM 2620", "CHEM 2920H"]),
            course("CHEM 2540", grade=None, alternates=["CHEM 2940H"]),
            course("CHEM 2550", grade=None, alternates=["CHEM 2950H"]),
            course("MATH 1151", grade=None, alternates=["MATH 1156"]),
            course("MATH 1152", grade=None, alternates=["MATH 1157", "STAT 1450", "STAT 2480", "STAT 2450"],
                   notes="MATH 1157, STAT 1450, STAT 2480, MATH 1152, or STAT 2450."),
            course("PHYSICS 1200", grade=None, alternates=["PHYSICS 1250", "PHYSICS 1248"], notes="Or PHYSICS 1248 + 1249."),
            course("PHYSICS 1201", grade=None, alternates=["PHYSICS 1251"]),
        ]),
    ]


def bio_core():
    return req("core", "Core course", [
        course("BIOLOGY 3401", equivalents=["BIOLOGY 3501"], notes="Or BIOLOGY 3501 (Integrative Skills) with BIOLOGY 4901 (Capstone)."),
    ])


def bio_rest(n):
    return hours("electives", f"Major electives (to reach 32 hours, 3 labs, 25 bio-science hours)", n,
                 pattern=rf"^(EEOB|MICRBIO|MOLGEN) [2-5]\d{{3}}|^(BIOCHEM|BIOLOGY) [3-5]\d{{3}}|^(ANTHROP|ANATOMY|ENTMLGY|PHYSIO|PHYSIOCB) [2-5]\d{{3}}",
                 exclude=["BIOLOGY 3401", "BIOLOGY 3501"],
                 notes=BIO_LABS + " Official elective list: https://clse.osu.edu/sites/default/files/2025-02/Biology%20Major%20Electives.pdf")


BIO_SPECS = {
    "forensic": ("Forensic Biology", "https://clse.osu.edu/students/requirements/forensic-biology", lambda: [
        bio_core(),
        req("required", "Required courses", [
            course("MOLGEN 4500", alternates=["MOLGEN 4606"]),
            course("BIOCHEM 4511", alternates=["BIOCHEM 5613"], notes="Or BIOCHEM 5613 + 5614."),
        ], notes="Students starting Autumn 2027 or later also take EEOB 3310 (Evolution). ANTHROP 2200 is the prerequisite for "
                 "upper-level anthropology."),
        pick("spec", "Specialization courses (choose at least 3)", 3,
             "ANTHROP 5607 5608 5609 5610 5644; BIOCHEM 5615; MOLGEN 5601 5607 5701; MICRBIO 4000/4000.01/4000.02; MOLGEN 4581S/4591S"),
        bio_rest(9),
    ]),
    "igb": ("Integrated General Biology", "https://clse.osu.edu/students/requirements/IGB", lambda: [
        bio_core(),
        req("required", "Required courses", [
            course("BIOCHEM 4511", alternates=["BIOCHEM 5613"], notes="Or BIOCHEM 5613 + 5614."),
            course("EEOB 3310", alternates=["EEOB 3310.01", "EEOB 3310.02"]),
            course("EEOB 3410"),
            course("EEOB 3510", alternates=["MOLGEN 4700", "MOLGEN 5607", "MOLGEN 5608"]),
            course("MICRBIO 4000", alternates=["MICRBIO 4000.01", "MICRBIO 4000.02", "MICRBIO 4100"]),
            course("MOLGEN 4500", alternates=["MOLGEN 4606"]),
        ]),
        pick("spec", "Specialization coursework: two major electives at the 4000 level or above", 2, [],
             pattern=rf"^({BIOSCI}) [45]\d{{3}}", exclude=["BIOLOGY 4901"]),
        bio_rest(3),
    ]),
    "lse": ("Life Sciences Education", "https://clse.osu.edu/students/requirements/life-science-education", lambda: [
        bio_core(),
        req("required", "Required courses", [
            course("BIOCHEM 4511", alternates=["BIOCHEM 5613"], notes="Or BIOCHEM 5613 + 5614."),
            course("MOLGEN 4500", alternates=["MOLGEN 4606"]),
            course("EEOB 3310", alternates=["EEOB 3310.01", "EEOB 3310.02"]),
            course("MICRBIO 4000", alternates=["MICRBIO 4000.01", "MICRBIO 4000.02", "MICRBIO 4100"]),
            course("MOLGEN 3300"),
        ]),
        pick("spec", "Specialization courses (choose at least 2)", 2,
             "EEOB 2220 3320 4210 4220 4230 5430/5930; ENTMLGY 4000; MOLGEN 4581S/4591S",
             notes="EEOB 3320 is strongly recommended. For high-school teaching, plan on Ohio State's M.Ed. after the BA/BS."),
        bio_rest(6),
    ]),
    "prehealth": ("Pre-Health Professions", "https://clse.osu.edu/students/requirements/prehealth", lambda: [
        bio_core(),
        req("required", "Required course", "MOLGEN 4500/4606",
            notes="Students starting Autumn 2027 or later also take EEOB 3310 (Evolution)."),
        pick("spec", "Specialization courses (choose at least 4)", 4, [
            course("BIOCHEM 4511", alternates=["BIOCHEM 5613"]),
            course("MICRBIO 4000", alternates=["MICRBIO 4000.01", "MICRBIO 4000.02", "MICRBIO 4100"]),
            course("EEOB 3510", alternates=["MOLGEN 5607"]),
            course("EEOB 3520"),
            course("EEOB 2511", alternates=["ANATOMY 2300.01", "ANATOMY 3300", "ANATOMY 3310.01"]),
            course("EEOB 3310", alternates=["EEOB 3310.01", "EEOB 3310.02", "EEOB 3310.03", "EEOB 3310.20"]),
            course("EEOB 4510"),
            course("EEOB 2520", alternates=["EEOB 4520", "PHYSIOCB 3200"]),
            course("EEOB 3410", alternates=["EEOB 3270", "EEOB 3320", "EEOB 3420", "EEOB 4240"]),
        ]),
        bio_rest(8),
    ]),
}

for _key, (_name, _url, _groups) in BIO_SPECS.items():
    for _deg in ("ba", "bs"):
        major(f"biology-{_key}", f"Biology: {_name}", _deg, _url, bio_support(_deg) + _groups(),
              notes=BIO_POLICY + " BA and BS differ only in the supporting (prerequisite) courses.", credits=32)


# ---------- Economics ----------
ECON_URL = "https://economics.osu.edu/majors-and-minors"


def econ(deg):
    ba = deg == "ba"
    return [
        req("prereq", "Prerequisites", [
            course("ECON 2001.01", grade=None, alternates=["ECON 2001.02", "ECON 2001.03H"]),
            course("MATH 1130" if ba else "MATH 1151", grade=None,
                   alternates=(["MATH 1148", "MATH 1149", "MATH 1150", "MATH 1151", "MATH 1156", "MATH 1161"] if ba
                               else ["MATH 1156", "MATH 1161", "MATH 1181H"]),
                   notes="BA: MATH 1130 or 1148 or higher. BS: MATH 1151 or higher."),
            course("STAT 1450" if ba else "STAT 2450", grade=None,
                   alternates=(["ECON 3400", "STAT 2450", "STAT 3450", "STAT 3470"] if ba else ["STAT 3450", "STAT 3470"]),
                   notes="BA: STAT 1450 or ECON 3400 or higher. BS: STAT 2450 or higher."),
        ]),
        req("core", "Major core", "ECON 2002.01/2002.02/2002.03H; " + (
            "ECON 4001.01/4001.02/4001.03; ECON 4002.01/4002.02/4002.03; ECON 4400" if ba else
            "ECON 4001.02/4001.03; ECON 4002.02/4002.03; ECON 5410; ECON 5420"),
            notes="BA: algebra-based intermediate theory (.01) and ECON 4400. BS: calculus-based theory (.02) and the "
                  "two-course econometrics sequence ECON 5410-5420."),
        pick("writing", "Writing/thought requirement (one course)", 1, "ECON 2367.02 5130 5140"),
        hours("elect5000", "ECON 5000-level electives (2 courses, 6 hours)", 6, pattern=upper("ECON", 5000, 5999),
              exclude=["ECON 5410", "ECON 5420", "ECON 5130", "ECON 5140"]),
        hours("elect3000", "ECON 3000-level or above electives (3 courses, 9 hours)", 9, pattern=upper("ECON", 3000, 5999),
              exclude=["ECON 3400", "ECON 4400", "ECON 4001.01", "ECON 4001.02", "ECON 4002.01", "ECON 4002.02", "ECON 5410",
                       "ECON 5420", "ECON 4320"],
              notes="At most 3 hours of ECON 4998/4999/5193 count. ECON 4797.01 needs the Director of Undergraduate Studies' OK."),
    ]


both("economics", "Economics", ECON_URL, econ,
     notes="Both degrees are STEM-designated (CIP 45.0603). The BS is the more quantitative path.")


# ---------- Psychology ----------
PSYCH_URL = "https://psychology.osu.edu/undergraduate/degree-options/"
PSYCH_SEQ = ("PSYCH 4305 4475 4501 4509 4510 4518 4520 4532 4540 4630 4644 5089 5250 5270 5600 5602 5606 5613H 5614 5622 5681 5684")
PSYCH_ADV = ("PSYCH 4485 4508 4511 4515 4521 4522 4531 4543 4545 4552 4554 4555 4571 5309 5505 5601 5608 5617 5618 5621 5800 "
             "5832 5871 5898")


def psych(deg):
    bs = deg == "bs"
    return [
        req("intro", "Introduction to Psychology (prerequisite, also the GE Social & Behavioral Science)",
            [course("PSYCH 1100", grade=None, alternates=["PSYCH 1100H", "PSYCH 1100E"])]),
        req("research", "Data analysis and research" + (" (four courses)" if bs else " (two courses)"),
            "PSYCH 2220/2220H; PSYCH 2300" + ("; PSYCH 3321; PSYCH 4510/4520" if bs else ""),
            notes="C- or better in PSYCH 2220 and 2300 before advanced courses." + (
                " PSYCH 3321 needs a B or better in PSYCH 2220. PSYCH 4510/4520 also counts as your sequenced advanced course "
                "and advanced writing course." if bs else "")),
        pick("core-a", "Core A: Brain and Behavior", 1, "PSYCH 3313/3313H 3513"),
        pick("core-b", "Core B: Cognitive Psychology", 1, "PSYCH 3302 3310/3310H 3312"),
        pick("core-c", "Core C: Clinical and Developmental", 1, "PSYCH 3331/3331H 3335 3340/3340H 3530 3550/3550H 3551/3551H"),
        pick("core-d", "Core D: Social Psychology", 1, "PSYCH 2367.01 3325/3325H 3375"),
        pick("seq", "Sequenced advanced course" + (" (met by PSYCH 4510/4520 above)" if bs else ""), 0 if bs else 1, PSYCH_SEQ,
             notes="Needs the matching core course first (e.g. PSYCH 4532 after 3331)."),
        pick("advanced", "Advanced courses" + (" (at least one more)" if bs else " (at least one more, sequenced or not)"), 1,
             PSYCH_SEQ + " " + PSYCH_ADV.replace("PSYCH ", "")),
        hours("electives", "Psychology electives (to 12 courses / 36 credit hours)", 9 if bs else 12, pattern=upper("PSYCH", 2000, 5999),
              exclude=["PSYCH 2220", "PSYCH 2300"],
              notes="Any 2000+ PSYCH course, including more from the lists above. Study-abroad PSYCH 5797 is evaluated individually."),
    ]


both("psychology", "Psychology", PSYCH_URL, lambda d: psych(d), credits=36,
     notes="12 psychology courses, at least 36 credit hours, beyond PSYCH 1100.")


def t(code, title, credits=3, prereqs=None, **kw):
    """A course whose title isn't in Class Search data (another college's course, or not scheduled this year)."""
    return course(code, title, credits, prereqs, **kw)


# ---------- Neuroscience (BS only) ----------
NEURO_URL = "https://neurosciencemajor.osu.edu/neuroscience-major-requirements"
NEURO_T = {
    "NEUROSC 3000": "Introduction to Molecular/Cellular Neuroscience", "NEUROSC 3050": "Structure and Function of the Nervous System",
    "NEUROSC 4550": "Autism Spectrum Disorder and Neurodevelopmental Disorders", "NEUROSC 4425": "Neurotrauma: TBI, Stroke, and Spinal Cord Injury",
    "NEUROSC 4100": "Basic and Clinical Foundations of Neurological Disease", "NEUROSC 4640": "Neuronal Signal Transduction",
    "NEUROSC 4500": "Introduction to Neuroimmunology", "NEUROSC 4623": "Biological Clocks and Rhythms", "NEUROSC 3025": "History of Neuroscience",
    "NEUROSC 4850": "Contemporary Topics in Neuroscience", "NEUROSC 4207": "Dark History of Treatments for Neurological Conditions",
    "NEUROSC 3010": "Neurophysiology", "NEUROSC 3305": "Neuropharmacology", "NEUROSC 4050H": "Neurogenetics",
    "NEUROSC 5790H": "Developmental Neuroscience", "BIOPHRM 5824": "Pharmacology of the Nervous System",
    "NEUROSC 4998": "Undergraduate Research in Neuroscience",
}


def nc(spec):
    out = []
    for code in [x.strip() for x in spec.split(",")]:
        if code in NEURO_T:
            out.append(t(code, NEURO_T[code], 3, grade="C"))
        else:
            out.extend(cs(code, grade="C"))
    return out


NEURO_SPEC = {
    "molecular": ("Molecular/Cellular", "Molecular-Cellular%20SPL%20Updated%20SP26.docx",
                  "NEUROSC 4550, NEUROSC 3010, NEUROSC 3305, NEUROSC 4050H, NEUROSC 4100, NEUROSC 4500, NEUROSC 4640, NEUROSC 5790H, "
                  "PSYCH 4644, PSYCH 5603, PSYCH 4305, BIOPHRM 5824, CHEM 5230, NEUROSC 4623, BIOCHEM 4511/MOLGEN 4500/MICRBIO 4000",
                  "NEUROSC 3025, NEUROSC 4850, NEUROSC 4207, PSYCH 4501, PSYCH 5089, PSYCH 5613/5613H, PSYCH 5600, PSYCH 5602, PSYCH 5604, "
                  "PSYCH 5622, EEOB 4550, LING 3701, PSYCH 5612/LING 5612/PHILOS 5612/CSE 5612, PSYCH 5614, PSYCH 5618, PSYCH 5628, "
                  "SPHHRNG 5760, PSYCH 3321, MATH 4350, PSYCH 5608, PSYCH 5898, CSE 5052, CSE 5526, ECON 5870, NEUROSC 4998"),
    "systems": ("Systems/Behavioral", "Systems-Behavioral%20SPL%20Updated%20SP26.docx",
                "NEUROSC 4550, NEUROSC 4425, PSYCH 4501, NEUROSC 4100, PSYCH 4644, NEUROSC 4500, PSYCH 5613/5613H, PSYCH 5600, PSYCH 5602, "
                "PSYCH 5603, PSYCH 5604, PSYCH 5622, PSYCH 5898, NEUROSC 4623, EEOB 4550, PSYCH 4305, BIOPHRM 5824, "
                "BIOCHEM 4511/MOLGEN 4500/MICRBIO 4000",
                "NEUROSC 3025, NEUROSC 4850, NEUROSC 4207, NEUROSC 3010, NEUROSC 3305, NEUROSC 4050H, NEUROSC 4640, NEUROSC 5790H, CHEM 5230, "
                "LING 3701, PSYCH 5612/LING 5612/PHILOS 5612/CSE 5612, PSYCH 5089, PSYCH 5614, PSYCH 5618, PSYCH 5628, SPHHRNG 5760, "
                "PSYCH 3321, MATH 4350, PSYCH 5608, CSE 5052, CSE 5526, ECON 5870, NEUROSC 4998"),
    "cognitive": ("Cognitive/Computational", "Cognitive-Computational%20SPL%20Updated%20SP26.docx",
                  "LING 3701, PSYCH 3321, PSYCH 5600, PSYCH 5608, PSYCH 5612/LING 5612/PHILOS 5612/CSE 5612, PSYCH 5614, PSYCH 5618, "
                  "PSYCH 5628, MATH 4350, PSYCH 5089, CSE 5052, CSE 5526, SPHHRNG 5760",
                  "NEUROSC 3025, NEUROSC 4850, NEUROSC 4207, NEUROSC 3010, NEUROSC 3305, NEUROSC 4050H, NEUROSC 4640, NEUROSC 4550, "
                  "NEUROSC 4425, NEUROSC 4100, NEUROSC 4500, NEUROSC 4623, PSYCH 4501, PSYCH 4644, PSYCH 4305, PSYCH 5613/5613H, PSYCH 5602, "
                  "PSYCH 5603, PSYCH 5604, PSYCH 5622, EEOB 4550, CHEM 5230, ECON 5870, NEUROSC 4998"),
}
for _key, (_name, _sheet, _spec, _breadth) in NEURO_SPEC.items():
    major(f"neuroscience-{_key}", f"Neuroscience: {_name}", "bs",
          "https://neurosciencemajor.osu.edu/sites/default/files/2026-02/" + _sheet, [
              req("support", "Prerequisites (don't count in the major)", "BIOLOGY 1113/1113H; PSYCH 1100/1100H", grade=None),
              req("premajor", "Pre-major (B or better, 3.00 GPA, within 3 semesters)", [
                  t("NRO 1100", "Neuroscience Honors Survey", 1, grade="B", alternates=["NRO 1100H", "NEUROSC 1100"],
                    notes="The professional survey: first semester of the pre-major; doesn't count toward the 33 hours."),
                  course("PSYCH 3313", grade="B", alternates=["PSYCH 3313H"]),
                  t("NEUROSC 3000", NEURO_T["NEUROSC 3000"], 3, "BIOLOGY 1113; pre-neuroscience", grade="B"),
              ], notes="Pre-major: 24 credit hours (12 graded at Ohio State), a 3.00 cumulative GPA, and a B or better in NRO 1100, "
                       "PSYCH 3313, and NEUROSC 3000."),
              req("core", "Core (with PSYCH 3313 and NEUROSC 3000 above)", [
                  course("PSYCH 3513", grade="C"),
                  t("NEUROSC 3050", NEURO_T["NEUROSC 3050"], 3, "BIOLOGY 1113; NEUROSC 3000", grade="C"),
              ]),
              pick("data", "Data analysis (one course)", 1, "PSYCH 2220/2220H; STAT 2480 2450", grade="C"),
              pick("writing", "Writing (one course)", 1, "ENGLISH 3304 3305", grade="C"),
              pick("spec", f"{_name} specialization courses (four)", 4, nc(_spec),
                   notes="Only one of BIOCHEM 4511 / MOLGEN 4500 / MICRBIO 4000 counts."),
              pick("breadth", "Breadth course (one, outside your specialization)", 1, nc(_breadth),
                   notes="Up to 3 hours of NEUROSC 4998 research / individual study (pre-approved) can count here."),
          ], credits="11 courses, at least 33 credit hours.",
          admission="pre-major with a 3.00 GPA and a B or better in NRO 1100, PSYCH 3313 and NEUROSC 3000.",
          notes="BS only. C or better in every other major course. Honors students add a graduate-level course.")


# ---------- Computer and Information Science (CSE department, ASC degrees) ----------
CIS_BS_URL = "https://cse.osu.edu/prospective-students/undergrad/majors/bs-cis-program-information"
CIS_BA_URL = "https://cse.osu.edu/ba-cis-program-information"
CIS_LIMITS = ("No more than 2 of CSE 4251/4252/4253/4256, and no more than 6 hours combined of CSE 4193 (2 max), 4998 (3 max), "
              "and 4999 (6 max).")

major("cis", "Computer and Information Science", "bs", CIS_BS_URL, [
    req("core", "CSE core", [
        course("CSE 2221", notes="C- or better. Prerequisite: CSE 1222/1223/1224, ENGR 1281H, or the CSE 2221 placement test."),
        *cs("CSE 2231 2321 2331 2421 2431 3341"),
        course("CSE 2501", alternates=["PHILOS 2338"], notes="Or PHILOS 2338 (also a GE Citizenship Theme course)."),
    ]),
    pick("se-db", "Software Engineering or Databases", 1, "CSE 3231 3241"),
    pick("arch-net", "Computer Architecture or Networking", 1, "CSE 3421 3461"),
    pick("ai-game", "Artificial Intelligence or Game and Animation", 1, "CSE 3521 3541"),
    pick("project", "Junior project", 1, "CSE 3901 3902 3903"),
    pick("capstone", "Capstone", 1, "CSE 5911 5912 5913 5914 5915", standing=90),
    req("noncs", "Non-CSE core", "ECE 2060; MATH 1152; MATH 3345; STAT 3470; PHYSICS 1250", grade=None,
        notes="MATH 1151 is the prerequisite (and the BS calculus requirement). BS CIS doesn't need ECE 2020 or MATH 2568, "
              "except the AI specialization needs linear algebra."),
    hours("science", "Science elective (5 hours beyond the GE natural science)", 5, pattern=r"^(PHYSICS|CHEM|BIOLOGY|EARTHSC|ASTRON|EEOB|MOLGEN|MICRBIO) [1-5]\d{3}",
          exclude=["PHYSICS 1250"], grade=None, notes="Any GE Natural Science course, e.g. PHYSICS 1251, CHEM 1210, BIOLOGY 1113."),
    hours("tech", "Technical electives (16 hours, at least 9 CSE)", 16, pattern=r"^CSE [3-5]\d{3}|^(MATH|STAT|ECE|PHYSICS|LING|PSYCH|ECON|ISE) [2-5]\d{3}",
          notes="Your specialization (Software Engineering; Database Systems and Data Analytics; Computer Systems; Computer "
                "Networking; Information and Computation Assurance; Artificial Intelligence; Computer Graphics and Game Design) "
                "sets part of the 9 CSE hours. The other 7 can be 3000+ CSE or 2000+ non-CSE courses from a completed minor, the "
                "pre-approved list, or a petition. " + CIS_LIMITS),
], credits="About 75 hours of CSE, math, and science courses.", admission="selective; apply to the major after the pre-major courses (CSE 2221, 2231, 2321, MATH 1151-1152).",
    notes="Same computer-science coursework as Engineering's BS CSE, with Arts and Sciences GE and a world language instead of "
          "more math, science and engineering. Curriculum sheet: https://cse.osu.edu/media/document/2025-08-22/"
          "bscis_curriculum_sheet_with_sample_schedule_july2025accessibleread-only.docx")

major("cis", "Computer and Information Science", "ba", CIS_BA_URL, [
    req("core", "CSE core", [
        course("CSE 2221", notes="C- or better."), *cs("CSE 2231 2321 2421"),
        course("CSE 2501", alternates=["PHILOS 2338"], notes="Or PHILOS 2338 (4 hours)."),
    ]),
    pick("project", "Junior project", 1, "CSE 3901 3902 3903"),
    req("math", "Required math and statistics", "MATH 1151; MATH 1152; STAT 2450/3470", grade=None),
    hours("science", "Science electives (10 hours beyond the GE natural science)", 10, grade=None,
          pattern=r"^(PHYSICS|CHEM|BIOLOGY|EARTHSC|ASTRON|EEOB|MOLGEN|MICRBIO|ANTHROP|GEOG) [1-5]\d{3}",
          notes="GE Natural Science courses."),
    hours("mathsci", "Math or science elective (3 hours)", 3, "MATH 2153 2173 2174 2177 2255 2415 2568 2568H", grade=None,
          pattern=r"^MATH [3-5]\d{3}"),
    hours("cse-elect", "CSE electives (at least 13 hours)", 13, "CSE 2331 2431", pattern=r"^CSE [3-5]\d{3}",
          exclude=["CSE 3901", "CSE 3902", "CSE 3903"], notes="CSE 2331, 2431, and 3000+ CSE courses. " + CIS_LIMITS),
    manual("related", "Related field (at least 18 hours)",
           "At least 18 hours numbered 2000 or above in one related field: a pre-approved field (Art and Design; Communication; "
           "Economics, Accounting, and Business; Game Design and Animation; Linguistics) or one you design with the CIS BA faculty "
           "advisor's approval. 12 hours form the related-field core; at least 6 more are related-field electives."),
    hours("extra", "Additional electives (8 hours of CSE or related-field courses)", 8, pattern=r"^CSE [3-5]\d{3}",
          notes="CSE courses, related-field courses, or both."),
], credits="Major core 32 hours plus 27 hours of program electives; 123 hours total.",
    admission="selective; apply online in the term you finish the admission courses.",
    notes="The most flexible CIS degree: fewer advanced CSE courses, plus an 18-hour related field. Curriculum sheet: "
          "https://cse.osu.edu/media/document/2025-08-22/bacis_ge_curriculum_sheet_with_sample_schedule-july2025accessible.docx")


# ---------- Communication and Journalism (School of Communication) ----------
COMM_URL = "https://comm.osu.edu/undergraduate/communication/"
COMM_PRE = req("premajor", "Pre-major (C- or better; don't count in the major)", "COMM 1100 1101",
               notes="Then a competitive Major & Specialization Application (cumulative GPA, pre-major courses, capacity). COMM 1100 "
                     "is also the GE Social & Behavioral Science; STAT 1350 or 1450 is the prerequisite for research methods.")
COMM_EXP = hours("experience", "Experiential learning (3 hours)", 3, "COMM 3188 3800 4191 4998")
COMM_ADMIT = "competitive Major & Specialization Application after COMM 1100 and 1101."

major("comm-scm", "Communication: Strategic Communication", "ba", COMM_URL + "scm", [
    COMM_PRE,
    req("core", "Core (16 hours)", "COMM 2321 2331; COMM 3333/3444; COMM 3334 4337"),
    req("methods", "Research method", "COMM 3163"),
    COMM_EXP,
    pick("oral", "Oral communication skills", 1, "COMM 2110 2131 2367/2367H"),
    pick("focus", "Focus area electives (3 courses, 9 hours)", 3,
         "COMM 2511 3332 3340 3345 3414 3444 3558 3628 4445 4558 2367 3325 3330 3331 3333 3668 4820",
         notes="Strategic Planning in PR/Advertising and Strategic Communication Contexts clusters; a course can't count twice."),
], credits=35, admission=COMM_ADMIT)

major("comm-cae", "Communication: Communication Analysis and Engagement", "ba", COMM_URL + "cae", [
    COMM_PRE,
    req("core", "Core (12 hours)", "COMM 2110; COMM 2367/2367H; COMM 3440 3620"),
    req("methods", "Research method", "COMM 3160"),
    hours("experience", "Experiential learning (3 hours)", 3, "COMM 3800 4191 4998"),
    hours("focus", "Focus area electives (5 courses, 15 hours; 12 at 3000+)", 15,
          "COMM 3402 3413 3442 4401 4445 4600 2131 3325 3330 3331 3624 3628 3629 3662 3667 3668 4635 2596 3332 3340 4240 4736 "
          "4737 4738 3404 4814 4820 3597.01 3597.02", pattern=upper("COMM", 2000, 5999),
          notes="Any School of Communication courses; the clusters (Media Effects; Leadership; Health, Environment, Risk & Science; "
                "Advocacy, Politics & Citizenship; Diversity & Culture) are guides."),
], credits=34, admission=COMM_ADMIT)

major("comm-tech", "Communication: Communication Technology", "ba", COMM_URL + "cot", [
    COMM_PRE,
    req("core", "Core (12 hours)", "COMM 2367/2367H; COMM 2511 2540 3554"),
    pick("methods", "Research method", 1, "COMM 3160 3165"),
    hours("experience", "Experiential learning (3 hours)", 3, "COMM 3800 4191 4998"),
    pick("focus", "Focus area electives (2 courses)", 2, "COMM 3513 3558 4557 4558 4665 4738"),
    pick("topics", "Special topic electives (3 courses, 9 hours)", 3, "COMM 3513 3545 4511 4555 4557 3330 3331 4556 4665; CSE 2123",
         notes="Human-Computer Interaction & User Experience or Communication Technology Management tracks; a course can't count twice."),
], credits=34, admission=COMM_ADMIT)

major("journalism", "Journalism (BA in Journalism)", "ba", "https://comm.osu.edu/undergraduate/journalism", [
    COMM_PRE,
    req("core", "Core (19 hours)", "COMM 2221 2223 3226 3404 4221"),
    pick("methods", "Research method", 1, "COMM 3160 3163"),
    pick("critical", "Critical thinking skills (2 courses)", 2, "COMM 3402 3440 3597.01 3597.02 4240 4445 4814 4820"),
    hours("internship", "Internship (3 hours)", 3, "COMM 4191"),
    manual("minor", "Required minor (12+ hours)",
           "Declare by the end of your first semester in the major: Business, Business Analytics, Campaigns and Elections, Capital "
           "Program, Criminology & Criminal Justice Studies, Economics, Geographic Information Science, Geography, International "
           "Studies, Media Production & Analysis, Political Science, Public Policy, Sport Industry, or World Politics (others by "
           "petition to the School of Communication). Add it in the What-If Minor tab."),
], credits=35, admission=COMM_ADMIT, notes="Public Affairs Journalism. The degree is the Bachelor of Arts in Journalism (same college "
                                            "requirements as the BA).")


# ---------- Political Science and World Politics ----------
PS_URL = "https://polisci.osu.edu/sites/default/files/2026-07/PoliSci%20{}%20Major%20Requirements.pdf"
PS_AM = "POLITSC 2110 2120 2145 2150 2367 3115 3147 3160 3170 3905 3910 3950 4110 4115 4120 4123 4125 4127 4130 4131 4132H 4135 4136 4137 4138 4139 4140 4143 4150 4152 4160 4164 4165 4170 4175 4920"
PS_CP = "POLITSC 3220 3225 3240 3245 3275 3280 3290 3596 4200 4212 4218 4236 4240 4242 4245H 4249 4250 4250H 4282 4285 4597.03 4940"
PS_IR = "POLITSC 2300 3310 3380 3910 4300 4305 4310 4315 4318 4320 4322 4327 4330 4331 4332 4335 4381 4385"
PS_TH = "POLITSC 2400/2400H 3001 3002 3420 3430 3440 3450 3460 3500 4455 4460 4465 4553 5000 5411 5412 5413 5414"
PS_INTRO = ("POLITSC 1100 1165 1166 1200 1300 1900 2110 2120 2150 2300 2367 2400")
PS_OTHER = ("AFAMAST 3083 4250 4504 4610; HISTORY 3083; COMM 3404 4814 4820; COMPSTD 4871; ECON 4300 4508 4600 5410 5420 5650; "
            "GEOG 3601; HISTORY 3001 3002 3003 3005 3006 3014 3016 3017 3041; INTSTDS 3850 4535 4560 4700 4701 4803; "
            "PHILOS 5400 5410; PUBAFRS 3000 4020 4021; WGSST 4465 4513 4597")
PS_RULES = ("33 hours at the 2000 level or above, 24 of them 3000+ (up to 6 of those from approved courses in other departments); "
            "21 hours at Ohio State (15 at 3000+); at most 6 hours of independent study, internships, and research/problems/topics "
            "courses. Embedded literacies: one Data Analysis, one Advanced Writing, and one Technology course (see the sheet).")


def ps_major(deg):
    bs = deg == "bs"
    gs = [pick("intro", "Introductory course (before graduation)", 1, PS_INTRO, grade=None,
               notes="Credit for one of these is required; 1000-level ones don't count in the 33 hours.")]
    if bs:
        gs += [
            req("methods", "Political methodology core (9 hours)", "POLITSC 3780/3780H 4781 4782"),
            pick("methods-adv", "Specialized methodology course", 1, "POLITSC 3549 4192 4553; PUBAFRS 3000",
                 notes="A graduate or ITV methods course can count with instructor consent. POLITSC 4553 is autumn only."),
            req("calculus", "Calculus (5-8 hours)", [course("MATH 1151", grade=None, alternates=["MATH 1141"],
                                                            notes="MATH 1151, or MATH 1140 + 1141.")]),
        ]
    fields = [("american", "American Politics", PS_AM), ("comparative", "Comparative Politics", PS_CP),
              ("ir", "International Relations", PS_IR), ("theory", "Political Theory", PS_TH)]
    if bs:
        gs.append(pick("subfields", "One course in 3 of the 4 subfields", 3,
                       " ".join(x[2] for x in fields).replace(" POLITSC", ""),
                       notes="American Politics, Comparative Politics, International Relations, Political Theory: one course each "
                             "in three of them."))
    else:
        for fid, fname, fl in fields:
            gs.append(pick(fid, f"Subfield: {fname}", 1, fl,
                           notes="POLITSC 3780 or 4781 can stand in for any one subfield." if fid == "american" else None))
    gs.append(hours("electives", "Political science electives (to 33 hours, 24 at 3000+)", 33 - (21 if bs else 12),
                    PS_OTHER, pattern=upper("POLITSC", 2000, 5999),
                    notes="Optional 4-course focus in a subfield or one of seven specializations (Law, Politics & Society; "
                          "Political Behavior; Public Policy; ...). Up to 6 hours from the other-department list need an advisor's OK."))
    return gs


for _deg in ("ba", "bs"):
    major("political-science", "Political Science", _deg, PS_URL.format(_deg.upper()), ps_major(_deg), credits=33,
          notes=PS_RULES + " Sheet effective for students entering Autumn 2026 or later; earlier entrants should confirm with a "
                           "Political Science advisor.")

WP_URL = "https://polisci.osu.edu/sites/default/files/2025-10/Bachelor%20of%20Arts%20in%20World%20Politics%20-%20major%20requirements%20GE%20Embedded%20Literacies.pdf"
major("world-politics", "World Politics", "ba", WP_URL, [
    pick("intro", "Before declaring: one introductory course", 1, "POLITSC 1165 1200 1300", grade=None),
    manual("specializations", "Specialization distribution",
           "At least 4 courses (2000+) in one of the four World Politics specializations (Foreign Policy and Security; Political "
           "Institutions and Processes; Political Economy and Development; International Theory) and at least 1 course in "
           "each of the other three. POLITSC 3780, 4781 and 4782 can count in one substantive area. Lists are on the sheet."),
    hours("courses", "World Politics courses (33 hours at 2000+, 24 at 3000+)", 33, PS_OTHER, pattern=upper("POLITSC", 2000, 5999),
          notes="Up to 6 hours from related courses in other departments with prior advisor approval."),
], credits=33, notes=PS_RULES)


# ---------- Sociology and Criminology ----------
SOC_URL = "https://sociology.osu.edu/undergraduate-program/curriculum-majors-minors-and-certificates"
SOC_EXP = hours("experience", "Experiential learning (3+ hours, department permission)", 3,
                "SOCIOL 2211S 3191 3798.03 4000S 4000E 4462 4629 4998 4999.02 4999.02H")
SOC_PRE = pick("prereq", "Program prerequisite", 1, "SOCIOL 1101/1101H 1102", grade=None,
               notes="Declare with a Sociology advisor after SOCIOL 1101 or 1102.")

major("sociology", "Sociology", "ba", SOC_URL, [
    SOC_PRE,
    req("core", "Required courses", "SOCIOL 2463/2463H; SOCIOL 3487/3487H; SOCIOL 3488 3549",
        notes="SOCIOL 3487 is the Advanced Writing and 3549 the Data Analysis embedded literacy."),
    SOC_EXP,
    pick("upper", "Electives at the 4000-5000 level (at least 4)", 4, [], pattern=upper("SOCIOL", 4000, 5999)),
    hours("electives", "Other sociology electives (to 13 courses / 39 hours)", 12, pattern=upper("SOCIOL", 2000, 5999),
          notes="SOCIOL 3302 meets the Technology embedded literacy."),
], credits="13 courses, 39 credit hours.", notes="BA only. Major courses can't also count on the GE.")

major("criminology", "Criminology and Criminal Justice Studies", "ba", SOC_URL, [
    SOC_PRE,
    req("core", "Required courses", "SOCIOL 3410/3410H; SOCIOL 3487/3487H; SOCIOL 3488 3549",
        notes="SOCIOL 3487 is the Advanced Writing and 3549 the Data Analysis embedded literacy."),
    SOC_EXP,
    pick("upper", "Criminology electives at the 4000-5000 level (at least 4)", 4, [], pattern=upper("SOCIOL", 4000, 5999)),
    hours("electives", "Other criminology electives (8 electives in all)", 12, pattern=upper("SOCIOL", 2000, 5999),
          notes="Electives come from the department's Criminology course list; SOCIOL 3302 meets the Technology literacy."),
], credits="13 courses, 39 credit hours.", notes="A Sociology + Criminology double major has its own requirement sheet "
                                                  "(https://sociology.osu.edu/media/4189).")


# ---------- English (students who started Autumn 2023 or later) ----------
ENG_URL = "https://english.osu.edu/english-major-au-23/"
ENG_PRE1800 = "ENGLISH 2201/2201H 2220/2220H 2221 2290 4513 4514 4515 4520.01 4520.02 4521 4522 4523 4531 4533 4535 4550"
ENG_POST1800 = "ENGLISH 2202/2202H 2281 2381 2581 2291 4540 4542 4543 4547 4551 4552 4553 4563 4581 4582 4586 4587 4588"
ENG_DIVERSITY = "ENGLISH 4577.01 4580 4581 4582 4586 4587 4588 4589 4592 4597.01"
ENG_RULES = ("12 unique courses (36 hours), 27 hours at 3000+, including one Embedded Literacy: Technology course; C- in each "
             "course (C in the methods course). Up to 6 hours can also count as GE Themes. Students who started before Autumn "
             "2023 follow the older English major sheet (https://english.osu.edu/undergraduate/english-major).")


def eng_common(methods="3398"):
    return [
        pick("pre1800", "Pre-1800 literature", 1, ENG_PRE1800),
        pick("post1800", "Post-1800 literature", 1, ENG_POST1800),
        pick("diversity", "Diversity in English Studies", 1, ENG_DIVERSITY),
        req("methods", f"ENGLISH {methods} (C or better)", [course(f"ENGLISH {methods}", grade="C",
                                                                   notes="Also the Advanced Writing and Data Analysis embedded literacy.")]),
    ]


major("english-lit", "English: Literature, Film, Folklore and Popular Culture Studies", "ba",
      ENG_URL + "literature-film-folklore-and-popular-culture-studies-specialization", eng_common() + [
          hours("electives", "Specialization and English electives (to 36 hours, 27 at 3000+)", 24, pattern=upper("ENGLISH", 2000, 5999),
                notes="Literature, film, folklore and popular-culture courses from the specialization sheet."),
      ], credits=36, notes=ENG_RULES)
major("english-cw", "English: Creative Writing", "ba", ENG_URL + "creative-writing-specialization", eng_common() + [
    pick("intro-cw", "Introductory creative writing", 1, "ENGLISH 2265 2266 2267 2268"),
    pick("workshops", "4000-level creative writing workshops", 3, [], pattern=r"^ENGLISH 4(5[6-9]\d|56[0-9])",
         notes="Workshops in poetry, fiction, and creative nonfiction need placement: https://english.osu.edu/creative-writing-concentration"),
    hours("electives", "English electives (to 36 hours, 27 at 3000+)", 12, pattern=upper("ENGLISH", 2000, 5999)),
], credits=36, notes=ENG_RULES)
major("english-wrl", "English: Writing, Rhetoric and Literacy", "ba", ENG_URL + "writing-rhetoric-and-literacy-wrl-specialization",
      eng_common("3379") + [
          hours("electives", "WRL courses and English electives (to 36 hours, 27 at 3000+)", 24, pattern=upper("ENGLISH", 2000, 5999),
                notes="Rhetorical theory, workplace writing (e.g. ENGLISH 3304, 3305), digital media composing (ENGLISH 2269, 4569), and "
                      "research methods courses from the specialization sheet."),
      ], credits=36, notes=ENG_RULES)
major("english-preed", "English: Pre-Education", "ba", ENG_URL + "pre-education-specialization", [
    req("methods", "ENGLISH 3398 (C or better)", [course("ENGLISH 3398", grade="C")]),
    pick("american", "American literature", 1, "ENGLISH 2290 4550 4551 4552 4553 4564.03"),
    pick("british", "British literature", 1, "ENGLISH 2201/2201H 2202/2202H 4513 4514 4515 4521 4522 4523 4531 4533 4535"),
    pick("shakespeare", "Shakespeare", 1, "ENGLISH 2220/2220H 2221 4520.01 4520.02"),
    pick("film", "Film studies", 1, "ENGLISH 2263 3378 4578"),
    pick("ethnic", "US ethnic/minority literature", 1, "ENGLISH 2281 2581 4580 4581 4582 4586 4587 4588"),
    pick("digital", "Digital media studies (Technology literacy)", 1, "ENGLISH 2269 4569"),
    hours("electives", "Language, writing and English electives (to 12 courses, 36-38 hours)", 15, pattern=upper("ENGLISH", 2000, 5999),
          notes="Including the specialization's English language/linguistics and writing courses; see the sheet."),
], credits="36-38", notes=ENG_RULES + " Leads to an M.Ed. or post-baccalaureate licensure program in Integrated Language Arts (grades 7-12).")


# ---------- History ----------
HIST_URL = "https://history.osu.edu/undergrad/major/resources/2025-2026-undergraduate-student-handbook"
major("history", "History", "ba", HIST_URL, [
    req("gateway", "Introduction to the Discipline of History (C or better)", [course("HISTORY 2800", grade="C")]),
    pick("seminars", "Two 4000-level seminars", 2,
         "HISTORY 4005 4015 4085 4125 4215 4216 4217 4218 4235 4245 4255 4285 4325 4375 4410 4430 4475",
         pattern=r"^HISTORY 4[0-6]\d5$", exclude=["HISTORY 4193", "HISTORY 4194"],
         notes="Usually in the third or fourth year. HISTORY 4193, 4194 and 4797-4999 don't count."),
    manual("breadth", "Breadth (12 hours)",
           "Two courses before 1750, two after 1750, two on East Asia/Africa/Latin America/the Middle East/Central or South Asia, "
           "two on North America and/or Europe, and one comparative/transnational/global course. One course can meet several "
           "of these, and seminars and concentration courses count too. Lists are in the History handbook."),
    manual("concentration", "Concentration (12 hours)",
           "Four courses in one area you choose with your advisor (a region, period, or theme)."),
    hours("courses", "History courses (33 hours, 21 at 3000+)", 24, pattern=upper("HISTORY", 2000, 5999),
          notes="Up to 6 hours from other departments can count toward breadth with advisor approval. Limits: 3 hours of 3193/4193, "
                "6 of 2798/3798/4798, 9 of 4998/4999."),
], credits=33, notes="A combined BA/MA in History is available to strong students (apply junior year).")


# ---------- Actuarial Science, Statistics, Data Analytics ----------
major("actuarial-science", "Actuarial Science", "bs", "https://math.osu.edu/undergrad/current-majors/actsci/requirements", [
    req("prereq", "Major prerequisites", "MATH 1151 1152; ACCTMIS 2000; ECON 2001.01/2001.02/2001.03H; ECON 2002.01/2002.02/2002.03H",
        grade=None),
    pick("programming", "Programming (one)", 1, "CSE 1222 1223 1224 2111", grade=None),
    pick("speaking", "Speaking (one)", 1, "COMM 2367 2110 2131", grade=None),
    req("core", "Major courses", [
        *cs("MATH 2153 2568"),
        course("MATH 4530", alternates=["STAT 4201"], notes="Prepares for SOA Exam P / CAS 1."),
        *cs("STAT 4202 MATH 3588"),
        course("MATH 3618", notes="Prepares for SOA Exam FM / CAS 2."),
        *cs("BUSFIN 3120 ENGLISH 3304"),
    ]),
    pick("electives", "Actuarial electives (three)", 3, "MATH 5630 5631 5632 5633 5634 5637",
         notes="Each prepares for an SOA exam (FAM-L, ALTAM, FAM-S, ASTAM, SRM); take the exam the semester after the course."),
], notes="A Math + Actuarial Science double major has its own sheet; a combined BS/MS (Actuarial Science and Mathematics) is "
         "available.")

major("statistics", "Statistics", "bs", "https://stat.osu.edu/sites/default/files/2022-06/StatMajorOverview-new-GE-Jun-03-22.pdf", [
    req("prereq", "Prerequisites (don't count in the major)", "CSE 1221/1222/1223/1224; MATH 1152", grade=None,
        notes="A 1000-2000 level STAT course (1350, 1430, 2450, 2480) is encouraged first."),
    req("core", "Required core", "MATH 2153 2568; STAT 3201 3202 3301 3302 3410 4301 4302",
        notes="STAT 3301 is the Data Analysis and 3302 the Advanced Writing and Technology embedded literacy."),
    hours("math", "MATH 3345 + 4547, or 6 hours of approved 2000+ math", 6,
          "MATH 3345 4547 2255 2415 3350 3607 4350 4507 4548 4556 4557 4575 4578"),
    hours("cat1", "Category I: Statistics electives (9 hours)", 9, "STAT 3303 4620 5510 5550 5730 5740",
          notes="STAT 5510 isn't offered regularly; don't plan on it."),
    hours("cat2", "Category II: Statistics or math electives (6 hours)", 6,
          "STAT 3303 4620 5510 5550 5730 5740; MATH 2255 2415 3345 3350 3607 4350 4507 4547 4548 4556 4557 4575 4578",
          notes="Grad-school bound students: MATH 3345, 4547, 4548 is recommended."),
], credits="At least 50 hours (105 including prerequisites, GE and college requirements).")

DA_URL = "https://data-analytics.osu.edu/major/"
DA_CORE = [
    req("prereq", "Prerequisites", "MATH 1151 1152; CSE 1223/1224", grade=None),
    req("core", "Core (51 hours)", [
        *cs("CSE 2221 2231 2321"), course("CSE 2421", alternates=["CSE 3430"]),
        *cs("MATH 2568 CSE 3241 STAT 3201 3202 3301 3302 3303 ISE 3230 STAT 4620"),
    ]),
    pick("db", "Advanced data management (one)", 1, "CSE 5242 3244 5243"),
    pick("viz", "Visualization (one)", 1, "CSE 5544 ISE 5760"),
]
major("data-analytics-bph", "Data Analytics: Biomedical and Public Health Analytics", "bs",
      DA_URL + "specialization/biomedical-public-health", DA_CORE + [
          req("spec-prereq", "Specialization prerequisites (also GE natural science)", "CHEM 1110/1210; BIOLOGY 1113", grade=None),
          req("spec", "Specialization courses", [course("MOLGEN 4500", alternates=["MOLGEN 4606"]),
                                                 t("BMI 5710", "Introduction to Biomedical Informatics"),
                                                 t("PUBHLTH 5015", "Public Health Data Analytics")]),
          pick("elective", "Specialization elective (one)", 1, [
              t("BMI 5720", "Introduction to Imaging Informatics"), t("BMI 5730", "Introduction to Bioinformatics"),
              t("BMI 5740", "Introduction to Research Informatics"), t("BMI 5750", "Methods in Biomedical Informatics"),
              t("BMI 5760", "Public Health Informatics"), t("BMI 5770", "Health Analytics: Data to Discovery to Dissemination"),
              t("PUBHEPI 5420", "Infectious Disease Modeling in Humans and Animals"),
              t("PUBHBIO 5280", "Introduction to Genomic Data Analysis"),
              t("PUBHEPI 5421", "Mathematics of Infectious Disease Dynamics"), *cs("GEOG 5226")]),
          req("capstone", "Capstone", "STAT 4911"),
      ])
major("data-analytics-ban", "Data Analytics: Business Analytics", "bs", DA_URL + "specialization/business-analytics", DA_CORE + [
    req("spec-prereq", "Required GE courses (Social Science)", "ECON 2001.01/2001.02/2001.03H; ECON 2002.01/2002.02/2002.03H", grade=None),
    req("immersion", "Business Analytics Industry Immersion (capstone)", "BUSADM 3630.05 3632.05",
        notes="Needs admission to Fisher's Industry Immersion Program (3.0 cumulative GPA). Autumn then spring."),
    hours("business", "Business electives (9 hours)", 9, "BUSFIN 3120 3220 3222 3250", pattern=r"^(BUSFIN|BUSML|BUSOBA|BUSMHR|ACCTMIS) [2-5]\d{3}",
          notes="Finance, marketing, operations, and other focus-area electives from the specialization page."),
])
major("data-analytics-can", "Data Analytics: Computational Analytics", "bs", DA_URL + "specialization/computational-analytics", DA_CORE + [
    hours("electives", "Computational electives (10 hours)", 10,
          "CSE 3461 4471 5472 5473 2331 3521 5245 5523 5524 5526 2431 3901 3902 3903 5361 5441; LING 2000",
          pattern=r"^(CSE [3-5]\d{3}|LING 4\d{3})",
          notes="Cyber-security, Machine Intelligence, Systems/Theory, or Linguistics & Text Analytics focus (LING 2000 first)."),
    pick("capstone", "Capstone (4 hours)", 1, "STAT 4911 CSE 5911 5912 5913 5914 5915"),
])


# ---------- Mathematics (BS; six tracks, each with an honors version) ----------
MATH_URL = "https://math.osu.edu/undergrad/current-majors/requirements/"
MATH_PRE = req("prereq", "Prerequisites", "MATH 1295 1151 1152", grade=None,
               notes="MATH 1295 is the 1-credit introductory math major seminar.")
MATH_CORE = "MATH 2153 3345 2568; STAT 4202; MATH 4530/STAT 4201"
MATH_ELECT = ("MATH 3350 3589 3607 3618 4350 4504 4507 4551 4552 4556 4557 4570 4573 4575 4578 5001 5051 5101 5102 5451 5529H "
              "5522H 5540H 5576H 5601 5602 5603 5632 5702 5756 5757 5801")
MATH_NOTE = ("5000-level courses need your academic advisor's permission. Honors versions of each track exist for ASC Honors "
             "students (https://math.osu.edu/honors-math-asc-honors-contract).")
PROG = pick("programming", "Programming (one)", 1, "CSE 1222 1223 1224", grade=None)

major("math-theoretical", "Mathematics: Theoretical Track", "bs", MATH_URL + "theoretical", [
    MATH_PRE, req("core", "Core", MATH_CORE + "; MATH 2255 4547 4548 4580 4581"),
    pick("electives", "Math electives (two)", 2, MATH_ELECT),
], notes=MATH_NOTE)
for _sci, _extra in (("physics", "PHYSICS 2300 2301"), ("chemistry", "CHEM 2510 2520")):
    major(f"math-applied-{_sci}", f"Mathematics: Applied Track ({_sci.title()})", "bs", MATH_URL + "applied", [
        MATH_PRE,
        req("science", "Science and programming prerequisites", "CHEM 1210" + ("; CHEM 1220" if _sci == "chemistry" else "")
            + "; PHYSICS 1250 1251; BIOLOGY 1113/1114", grade=None),
        PROG,
        req("core", "Core", MATH_CORE + "; MATH 2255"),
        pick("applied", "Applied math courses (2 of 3)", 2, "MATH 3607 4556 4557",
             notes="Confirm the three choices on the track sheet."),
        hours("applied-elect", "Applied math electives (6 hours)", 6, "MATH 4551 4350 3607 4556 4557 4552 5601 5602 5603"),
        hours("area", f"Applied area: {_sci} (6 hours)", 6, _extra, pattern=upper("PHYSICS" if _sci == "physics" else "CHEM", 2000, 5999)),
    ], notes=MATH_NOTE)
major("math-biology", "Mathematics: Mathematical Biology Track", "bs", MATH_URL + "biology", [
    MATH_PRE, req("science", "Science prerequisites", "BIOLOGY 1113 1114; CHEM 1210", grade=None,
                  notes="CHEM 1220 isn't required but is a prerequisite for some choices."),
    req("core", "Core", MATH_CORE + "; MATH 2255 3350"),
    pick("bio", "Biology core (one)", 1, "BIOLOGY 3401 MOLGEN 4500"),
    pick("applied", "Applied math courses (2 of 3)", 2, "MATH 3607 4556 4557"),
    hours("applied-elect", "Applied math electives (6 hours)", 6, "MATH 4350 3607 4556 4557 4551"),
    hours("bio-elect", "Biology electives", 6, "BIOCHEM 4511 EEOB 3310 3420 4520 CHEM 2510 MOLGEN 5601"),
], notes=MATH_NOTE)
major("math-education", "Mathematics: Mathematics Education Track", "bs", MATH_URL + "education", [
    MATH_PRE, PROG, req("cse", "Programming", "CSE 2221", grade=None),
    req("core", "Core (starred courses are required by Ohio State's M.Ed. program)", MATH_CORE),
    hours("electives", "Track math courses and electives", 15, MATH_ELECT,
          notes="Geometry, history of math, algebra and statistics courses from the track sheet (MATH 4504, 4507, 4580, ...)."),
    manual("med", "Courses for M.Ed. preparation",
           "ESEPSY 5401 or PSYCH 3351 (adolescent learning/development), EDUTL 5442 (reading across the curriculum), and ESSPED "
           "2251 or EDUTL 5501 (special education/inclusion); FEEP is suggested. For a teaching license, plan on Ohio State's "
           "M.Ed. in Mathematics Education."),
], notes=MATH_NOTE)
major("math-financial", "Mathematics: Financial Mathematics Track", "bs", MATH_URL + "financial", [
    MATH_PRE,
    req("prereq-bus", "Prerequisites", "ECON 2001.01/2001.02/2001.03H; ECON 2002.01/2002.02/2002.03H; CSE 2111; ACCTMIS 2000/2200",
        grade=None, notes="Accounting: ACCTMIS 2000, or 2200 + 2300."),
    pick("programming", "Programming (one)", 1, "CSE 1222 1223", grade=None),
    req("core", "Core", MATH_CORE + "; MATH 2255 3589 3607 3618"),
    pick("finance", "Finance (one)", 1, "BUSFIN 3120 3220"),
    pick("electives", "Financial math electives", 1, "MATH 5632 5630 4557 4556 5601 5603 4578"),
], notes=MATH_NOTE)


# ---------- Chemistry and Biochemistry ----------
CHEM_URL = "https://chemistry.osu.edu/sites/default/files/2026-03/"
GENCHEM = [course("CHEM 1610", grade=None, alternates=["CHEM 1210", "CHEM 1910H"], notes="1610-1620 is recommended; honors 1910H-1920H."),
           course("CHEM 1620", grade=None, alternates=["CHEM 1220", "CHEM 1920H"])]
ORGO = [course("CHEM 2610", alternates=["CHEM 2510", "CHEM 2910H"]), course("CHEM 2620", alternates=["CHEM 2520", "CHEM 2920H"]),
        *cs("CHEM 2540")]
RESEARCH_MAX = "At most 6 hours of research (CHEM/BIOCHEM 4998/4999) count; undergraduate research is recommended."

major("chemistry", "Chemistry", "bs", CHEM_URL + "bs_in_chemistry_sample_curriculum_gen.pdf", [
    req("support", "Supporting courses", GENCHEM + cs("MATH 1151 1172/1152 2177/2153; PHYSICS 1250 1251", grade=None),
        notes="PLTL sections CHEM 1612/1622 are recommended."),
    req("core", "Chemistry core", ORGO + cs("CHEM 2550 2210/2210H 3510 4300 4310 4410 4870 4880")),
    hours("adv-lab", "Advanced lab elective (2 hours)", 2, "CHEM 4998 4550; BIOCHEM 5621"),
    hours("adv-sci", "Advanced science electives (6 hours, 3 in upper-level CHEM/BIOCHEM)", 6,
          "CHEM 5230 5420 5430 5440 5520 4998 4999; BIOCHEM 4511 4998 4999",
          pattern=r"^(CHEM|BIOCHEM) [4-6]\d{3}|^(PHYSICS|MATH) [45]\d{3}", notes=RESEARCH_MAX),
], notes="For students who want to be professional chemists. For an ACS-certified degree add BIOCHEM 4511 or 5613 and CHEM 4550 "
         "or BIOCHEM 5621.")

major("chemistry", "Chemistry", "ba", CHEM_URL + "BA%20in%20Chemistry%20New%20GE%20Sample%20Curriculum.pdf", [
    req("support", "Supporting courses", GENCHEM + cs("MATH 1151 1152; PHYSICS 1200/1250 1201/1251; BIOLOGY 1113", grade=None)),
    req("core", "Chemistry core", ORGO + cs("CHEM 2550 2210 4200 4210 4410")),
    hours("adv-sci", "Advanced science electives (9 hours, 3 in upper-level CHEM/BIOCHEM)", 9,
          "CHEM 3510 5230 5420 5430 5440 5520 4998 4999; BIOCHEM 4511; MICRBIO 4000; MOLGEN 4500",
          pattern=r"^(CHEM|BIOCHEM) [4-6]\d{3}|^MATH [2-4]\d{3}|^(MICRBIO|MOLGEN|PHYSICS|FDSCTE|EEOB) [4-6]\d{3}", notes=RESEARCH_MAX),
], notes="For students headed to the life sciences or medicine, pharmacy, or veterinary school.")

BIOCHEM_URL = "https://chemistry.osu.edu/sites/default/files/2022-09/"
for _deg in ("bs", "ba"):
    _bs = _deg == "bs"
    major("biochemistry", "Biochemistry", _deg, BIOCHEM_URL + f"{_deg}_in_biochemistry_sample_curriculum_new_ge_pdf.pdf", [
        req("support", "Supporting courses", GENCHEM + cs("MATH 1151 1152; BIOLOGY 1113 1114" + ("; MATH 2153; PHYSICS 1250 1251" if _bs
                                                                                           else "; PHYSICS 1200/1250 1201/1251"), grade=None)),
        req("core", "Biochemistry core", ORGO + cs(("CHEM 2550; " if _bs else "") + "BIOCHEM 5613 5614 5615 5621 5721"
                                                  + (" 5722" if _bs else "") + "; MOLGEN 4500/4606")),
        hours("elective", "Major elective", 0 if _bs else 2, "CHEM 2550; BIOCHEM 4998 4999",
              notes="BA: 2 hours of major electives; CHEM 2550 is recommended."),
    ], credits=38 if _bs else 31, notes="Biochemistry research (BIOCHEM 4998/4999) is strongly recommended. "
                                        + ("For professional biochemists and biotech." if _bs else "For medicine, vet, optometry, or pharmacy."))


# ---------- Physics (BS only) ----------
major("physics", "Physics", "bs", "https://physics.osu.edu/physics-major-requirements-autumn-2024-present", [
    req("intro", "Introductory calculus-based physics", [
        course("PHYSICS 1250", alternates=["PHYSICS 1270", "PHYSICS 1250H", "PHYSICS 1260", "PHYSICS 1248"]),
        course("PHYSICS 1251", alternates=["PHYSICS 1271", "PHYSICS 1251H", "PHYSICS 1261"],
               notes="Sequences: 1270-1271, 1250-1251, 1250H-1251H, 1260-1261, or 1248-1249-1251."),
    ]),
    req("core", "Required physics", "PHYSICS 2095 2300 2301 3700; PHYSICS 5400/5400H; PHYSICS 5500/5500H; PHYSICS 5700"),
    pick("lab3", "Third physics lab (one)", 1, "PHYSICS 4700 5680 5810"),
    pick("elective", "Physics elective (one)", 1, "PHYSICS 3470 5300 5401H 5501/5501H 5600 4700 5680 5810"),
    hours("career", "Career electives (12 hours)", 12, pattern=r"^[A-Z]+ [2-5]\d{3}",
          exclude=["PHYSICS 2300", "PHYSICS 2301", "PHYSICS 3700", "PHYSICS 5400", "PHYSICS 5500", "PHYSICS 5700"],
          notes="Any graded 2000+ course that fits your goals, from any department (not seminars or research; no overlap with "
                "a minor). Up to two GE Theme courses (one Citizenship, one other) can count."),
    req("math", "Math and programming", [
        course("MATH 1151", grade=None, alternates=["MATH 1140", "MATH 1181H", "MATH 4181H"]),
        course("MATH 1152", grade=None, alternates=["MATH 1172", "MATH 2182H", "MATH 4182H"]),
        course("MATH 2153", grade=None, alternates=["MATH 2173"]),
        course("MATH 2415", grade=None, alternates=["MATH 2255", "MATH 2174", "MATH 5520H"], notes="MATH 2415 preferred."),
        course("CSE 1223", grade=None, alternates=["CSE 1222", "CSE 1224", "ASTRON 1221", "ENGR 1221", "ENGR 1281H"]),
    ], notes="Calculus: 1140-1141-1152-2153, 1151-1152-2153, 1151-1172-2173, 1181H-2182H, or 4181H-4182H."),
], credits="39-43 hours of physics plus 12 hours of career electives.",
    notes="BS only (Ohio State has no physics BA). Curriculum for students who started Autumn 2024 or later; earlier students "
          "follow a focus (Advanced, Applied, Pre-Med/Life Sciences, Teaching): https://physics.osu.edu/ug-semester-options. "
          "A Physics + Astronomy & Astrophysics double major is common.")


# ---------- Astronomy and Astrophysics (BS) ----------
major("astronomy", "Astronomy and Astrophysics", "bs", "https://astronomy.osu.edu/undergraduates/major", [
    req("prereq", "Prerequisites (27 hours)", [
        course("ASTRON 1221", grade=None, alternates=["CSE 1222", "CSE 1223", "CSE 1224", "ENGR 1221", "ENGR 1281H"]),
        *cs("MATH 1151/1161/1181H 1152/1172/2162/2182H 2153/2173/4182H", grade=None),
        course("PHYSICS 1250", grade=None, alternates=["PHYSICS 1250H", "PHYSICS 1260", "PHYSICS 1270"]),
        course("PHYSICS 1251", grade=None, alternates=["PHYSICS 1251H", "PHYSICS 1261", "PHYSICS 1271"]),
    ]),
    req("astro", "Astrophysics", "ASTRON 2895 2291 2292 3350"),
    pick("senior", "Senior-level astrophysics (one)", 1, "ASTRON 5681 5682",
         notes="Other 5000-level ASTRON courses may substitute with department approval."),
    req("math", "Mathematics", [course("MATH 2415", alternates=["MATH 2255", "MATH 2174", "MATH 5520H"]),
                                course("MATH 2568", alternates=["MATH 2174", "MATH 5520H"])],
        notes="MATH 5520H or 2174 can replace 2415 + 2568; MATH 2255 can replace 2415."),
    req("physics", "Physics", "PHYSICS 2300 2301 3700; PHYSICS 5400/5400H; PHYSICS 5500/5500H; PHYSICS 5600"),
    pick("adv-physics", "Advanced physics (one)", 1, "PHYSICS 5401H 5501/5501H"),
], credits=47, notes="Pairs naturally with a Physics double major.")


# ---------- Geography department: Atmospheric Sciences, GIS, Geography, Air Transportation ----------
GEOG_URL = "https://geography.osu.edu/undergrad/majors"
major("atmospheric-sciences", "Atmospheric Sciences (BS in Atmospheric Sciences)", "bs",
      "https://asp.osu.edu/sites/default/files/2026-06/Atmospheric%20Sciences%20New%20Major%20Curriculum%20%28Declare%20AU26%20and%20Beyond%29.pdf", [
    req("support", "Prerequisite and supplemental courses", "GEOG 1900/1900H; MATH 1151 1152 2153 2255; PHYSICS 1250/1250H 1251/1251H; "
        "CHEM 1210; STAT 2450", grade=None),
    req("core", "Required courses (34 hours)", [
        *cs("GEOG 4911 ATMOSSC 5201 5202 5203 5301 5302 5401 5501 5502 5601 5602"),
        course("ATMOSSC 4981", standing=90, notes="Senior standing."),
    ], notes="Several courses run once a year, so plan the sequences carefully. Most need a C- in the previous course."),
    pick("electives", "Electives (three)", 3, "ATMOSSC 2193 2194 4191 4193 4194 4998 4999 4999H 5450 5701 5901; GEOG 3900.01/3900.02"),
], credits=43, notes="Curriculum for students who declare Autumn 2026 or later; students who declared Autumn 2022-Summer 2026 follow "
                     "the previous sheet (https://asp.osu.edu/undergrad). The degree is the BS in Atmospheric Sciences.")

major("gis", "Geographic Information Science (BS in Geographic Information Science)", "bs",
      "https://geography.osu.edu/sites/default/files/2024-05/GIS%20Major%20Curriculum%20%28Declare%20SP24%20and%20Beyond%29%20GEN%20or%20GEL.docx", [
    req("core", "Core (15 hours)", "GEOG 4103 5101 5200 5210 5225"),
    pick("intermediate", "Intermediate courses (three)", 3, "GEOG 4191 5103 5201 5212 5222 5223 5229"),
    pick("electives", "Electives (three; a focus area is encouraged)", 3,
         "GEOG 4191 5103 5201 5212 5222 5223 5229 5300 5301 5501 5502 5503 3597.03 3702 3800 5402 5700 5802 5803; "
         "CSE 2122/2123 2221 2231 5241 5242; CRPLAN 5320; PUBAFRS 4040",
         notes="Focus areas: Spatial Data Analytics, Urban Studies, Sustainability. Electives can't double count with the "
               "intermediate courses."),
], credits=33, notes="For students who declared Spring 2024 or later.")

for _deg in ("ba", "bs"):
    major("geography", "Geography: Social and Environmental Geography" if _deg == "ba" else "Geography", _deg, GEOG_URL, [
        req("writing", "Required prerequisite (Advanced Writing literacy)", "GEOG 3597.03"),
        req("required", "Required courses", [course("GEOG 4101", notes="Autumn only."),
                                             course("GEOG 4100", standing=90, notes="Capstone, spring of your final year."),
                                             course("GEOG 5193", 1, notes="Final year, spring.")]),
        req("methods", "Methods", "GEOG 4103 5210"),
        pick("intro", "Introductory course (one)", 1, "GEOG 2400.01/2400.02 2500 2800"),
        pick("intermediate", "Intermediate courses (three)", 3, "GEOG 3300 3597.01 3600 3701 3702 3750 3800 3801 3900.01/3900.02 3980"),
        pick("advanced", "Advanced courses (three)", 3, "GEOG 4191 5300 5301 5401 5402 5501 5502 5503 5700 5802 5803"),
    ], credits="34-38", notes=("The BA Social and Environmental Geography sheet (declared Autumn 2022 or later). " if _deg == "ba" else
                               "The BS adds more physical-geography/quantitative coursework; confirm the BS sheet with a Geography advisor. ")
                              + "At least 20 major hours must be GEOG courses.")

major("air-transportation", "Air Transportation (Social Science)", "ba",
      "https://geography.osu.edu/sites/default/files/2024-11/Social%20Science%20Air%20Transportation%20Pre-Major%20Curriculum%20%28Declare%20SP23%20and%20Beyond%29%20GEN.pdf", [
    req("premajor", "Pre-major (14-15 hours)", "GEOG 2400.01/2400.02; AVIATN 2000 2100; GEOG 3300"),
    req("core", "Major core (26 hours)", "AVIATN 2200 2300 3000 3200 3300 4500; GEOG 5300 5900"),
    hours("aviation", "Aviation electives: non-flight (12 hours) or Professional Pilot (23-25 hours)", 12,
          "AVIATN 2101 2102 2400 2401 2900 3193 3400 3500 3600 3700 3900 4000 4193 4200 2501 3100 3101 4100 4101 4102 4300 4301 5100 5101",
          notes="Professional Pilot (PPC) students take the flight sequence through commercial and multi-engine (or flight "
                "instructor) labs; flight fees apply."),
    hours("social", "Social science electives (12 hours, 2 GEOG courses)", 12,
          "GEOG 2200.01 3350 3600 3701 3702 3750 3900.01 5200 5210 5301 5700 5802; COMM 2367 3331 2331 2540 3545; INTSTDS 5195; POLITSC 2150"),
], notes="Choose the flight (Professional Pilot) or non-flight path. Students who declared Spring 2023 or later.")


# ---------- EEOB: Evolution and Ecology, Zoology ----------
EEOB_URL = "https://eeob.osu.edu/sites/default/files/2026-10/"
EEOB_SUPPORT_BS = req("support", "Supporting courses (BS)", [
    *cs("BIOLOGY 1113 1114; MATH 1151/1156", grade=None),
    course("PHYSICS 1200", grade=None, alternates=["PHYSICS 1250"]), course("PHYSICS 1201", grade=None, alternates=["PHYSICS 1251"]),
    course("CHEM 1210", grade=None, equivalents=["CHEM 1208"], notes="Or CHEM 1206 + 1208."), *cs("CHEM 1220", grade=None),
    course("CHEM 2310", grade=None, alternates=["CHEM 2510"]), *cs("STAT 2480/2450", grade=None),
])
EEOB_ELECT = ("Electives: any EEOB course 2000-5999, or approved outside courses; up to 3 hours of research or internship. Other "
              "courses need the advisor's approval.")
major("evolution-ecology", "Evolution and Ecology", "bs", EEOB_URL + "Evolution%20%26%20Ecology%20Major%202027.pdf", [
    EEOB_SUPPORT_BS,
    pick("core", "Evolution and ecology core (choose 2)", 2, "EEOB 3310/3310.01/3310.02/3310.03 3410; BIOLOGY 3401/3501.01",
         notes="An advanced math or statistics course can also count."),
    pick("biodiversity", "Biodiversity (choose 2)", 2,
         "EEOB 2210 2220 2250 2270 2410 3320 3600 4210 4220 4230 4240 5910 3420 3610 4410 4420H 4430 5310 5320 5340 5350 5410 "
         "5420 5430 5450 5460 5470 5480 5490"),
    hours("electives", "Electives (to 30 major hours)", 16, "BIOCHEM 4511; ENTMLGY 4600 4607; ENR 3300; MICRBIO 4000 4100; MOLGEN 4500 4606",
          pattern=upper("EEOB", 2000, 5999), notes=EEOB_ELECT),
], credits=30)
for _deg in ("bs", "ba"):
    major("zoology", "Zoology", _deg, EEOB_URL + "Zoology%20Major%202027.pdf", [
        EEOB_SUPPORT_BS if _deg == "bs" else req("support", "Supporting courses (BA)", [
            *cs("BIOLOGY 1113 1114; MATH 1148", grade=None),
            course("PHYSICS 1103", grade=None, alternates=["PHYSICS 1106.01", "PHYSICS 1200"],
                   notes="PHYSICS 1103 + 1104, 1106 + 1107, or 1200 + 1201."),
            course("CHEM 1210", grade=None, equivalents=["CHEM 1208"]), *cs("CHEM 1220 2310 STAT 1450", grade=None)]),
        pick("core", "Organismal biology core (choose 2)", 2, "EEOB 3310/3310.01/3310.02/3310.03 3410 3320; MOLGEN 4500/4500.01/4500.02"),
        pick("biodiversity", "Biodiversity (choose 1)", 1,
             "EEOB 2220 2250 2270 2410 3600 4210 4220 4230 4410 4420H 5910 2511 3420 3510 3520 3610 4510 4520 4550 4560"),
        hours("electives", "Electives (to 30 major hours)", 20,
              "ANIMSCI 3130 3140; ANTHROP 3300 3304; BIOCHEM 4511 5613 5614; BIOLOGY 3401; EARTHSC 3315 4501; ENTMLGY 4600 4607; "
              "ENR 3300; MICRBIO 4000 4100; PSYCH 3313 5601", pattern=upper("EEOB", 2000, 5999), notes=EEOB_ELECT),
    ], credits=30, notes="Pre-med and pre-vet students need a full year of organic chemistry (CHEM 2510-2520) and likely the labs "
                         "(2540, 2550).")

# ---------- Microbiology (BS; combined BS/MS available) ----------
major("microbiology", "Microbiology", "bs", "https://microbiology.osu.edu/students/ugrad-requirements", [
    req("support", "Prerequisites (for students admitted Autumn 2022 or later)",
        "BIOLOGY 1113 1114; MATH 1151/1156/1141; STAT 1450/2450/2480; CHEM 1210 1220 2510 2520 2540; PHYSICS 1200/1250", grade=None,
        notes="Honors or more advanced courses can substitute."),
    req("core", "Core (21 hours)", [*cs("BIOCHEM 4511"), course("MICRBIO 4100", notes="Non-majors with an A/A- in MICRBIO 4000 may "
                                                                                       "petition to use it."), *cs("MICRBIO 4110 4120 4130 4140")]),
    hours("group1", "Group 1 electives (at least 3 hours)", 3,
          "MICRBIO 2000 2100 3704 4145 4150 4193 4591S 4800 4891 5122 5129 5130 5147 5149 5155 5161 5270 5536 5546 4998 4999"),
    hours("electives", "More major electives (to 9 hours; 6 at 4000+)", 6,
          "MICRBIO 2200 5122 5149 5155 5161; BIOCHEM 5621; CBE 5765; EARTHSC 5160; ENVENG 5120; ENR 5263; MOLGEN 4500 4501 4606 5800; "
          "PLNTPTH 5010 5020 5040", pattern=upper("MICRBIO", 2000, 5999),
          notes="At most 3 hours graded S/U (research, MICRBIO 4591S)."),
], credits=30, notes="A combined BS/MS in Microbiology is available.")

# ---------- Molecular Genetics (BS; combined BS/MS available) ----------
MG_ELECT = ("MOLGEN 2220H 2690 3300 3436 4503 4591S 4703 5193 5194 5300 5623 5630 5632 5643 5650 5700 5701 5705 5715 5733 5735 5795 "
            "5796 5797 5798 5800; BIOCHEM 5621; BIOPHRM 5733; EEOB 4520; MICRBIO 4000 4100 4130 4140 5122 5161; PSYCH 5602")
major("molecular-genetics", "Molecular Genetics", "bs", "https://molgen.osu.edu/majors", [
    req("support", "Prerequisites (don't count in the 30 hours)", "BIOLOGY 1113 1114; CHEM 1210 1220 2510 2520 2540 2550; MATH 1151/1156; "
        "PHYSICS 1200/1250 1201/1251", grade=None),
    req("core", "Core (19+ hours)", [course("BIOCHEM 4511", alternates=["BIOCHEM 5613"], notes="Or BIOCHEM 5613 + 5614."),
                                     *cs("MOLGEN 4606 5607/5607E 5608/5608E 5645"),
                                     course("MOLGEN 5601", alternates=["MOLGEN 5602"],
                                            notes="Two semesters of research can substitute 3 hours of MOLGEN 4998/4999 (advisor approval).")]),
    pick("electives", "Electives (at least 3; core + electives = 30 hours)", 3, MG_ELECT,
         notes="Up to 3 hours of MOLGEN 4998/4999 can count. Most 5000-level MOLGEN courses need the core first."),
], credits=30, notes="A Plant Cellular and Molecular Biology emphasis is possible (core adds MOLGEN 3300 and 3436). A combined BS/MS "
                     "is available.")


# ---------- Anthropology: Anthropology (BA), Anthropological Sciences (BS), Forensic (BS), Medical (BA/BS) ----------
ANTH_URL = "https://anthropology.osu.edu/undergrad/"
ANTH_BIO = ("ANTHROP 2203 3211 3300 3301 3302 3304 3315 3322 3360 3403 3409 3411 3500 3504 4597.04 5600 5602 5607 5608 5609 5610 5641 "
            "5642 5644 5646 5651")
ANTH_ARCH = "ANTHROP 3306 3350 3420 3434 3451 3452 3554 3555 3604 4597.03H 5603 5604 5606 5614 5685"
ANTH_CULT = ("ANTHROP 3027 3050 3306 3334 3340 3416 3418 3419 4706 5505 5515 3597.01 3597.02 3623 5601 5614 5615 5624 5625 5626 5627 "
             "5650 5700 5701 5702")


def anth_electives(free):
    return [
        pick("el-bio", "Elective: biological anthropology", 1, ANTH_BIO),
        pick("el-arch", "Elective: archaeology", 1, ANTH_ARCH),
        pick("el-cult", "Elective: cultural anthropology", 1, ANTH_CULT),
        hours("el-free", f"More anthropology electives ({free} hours)", free, "ANTHROP 3305", pattern=upper("ANTHROP", 2000, 5999),
              notes="Ask the anthropology advisor which subfield a course counts in."),
    ]


major("anthropology", "Anthropology", "ba", ANTH_URL + "major-ba", [
    req("prereq", "Prerequisite", "ANTHROP 2200/2200H", grade=None),
    req("core", "Core (15 hours)", [course("ANTHROP 3300", alternates=["ANTHROP 3301"]), *cs("ANTHROP 2201 3401 2202 4525")]),
    *anth_electives(6),
], credits=30, notes="At most 7 elective hours of non-graded work (independent study, research, field school).")
major("anthropological-sciences", "Anthropological Sciences", "bs", ANTH_URL + "major-bs", [
    req("prereq", "Prerequisites", "ANTHROP 2200/2200H; STAT 1450/2450", grade=None),
    req("core", "Core (18 hours)", "ANTHROP 3300 3301; EEOB 3310; ANTHROP 2201 3401 2202 5620"),
    *anth_electives(6),
], credits=36)
major("forensic-anthropology", "Forensic Anthropology", "bs", "https://anthropology.osu.edu/major-forensic-anthropology-bs", [
    req("prereq", "Prerequisites (10 hours)", "ANTHROP 2200/2200H 3504; STAT 1450/2450", grade=None),
    req("intro", "Introductory coursework", "ANTHROP 2203 3211; SOCIOL 2209"),
    req("core", "Core", "ANTHROP 3301 3604"),
    req("practical", "Practical training", "ANTHROP 5607 5644"),
    pick("applications", "Applications to forensic anthropology (two)", 2,
         "ANTHROP 3401 5603 5608 5609 5610 5642 5651 5685 5686 5700; EEOB 4510; SOCIOL 4100"),
    hours("interdisciplinary", "Interdisciplinary research and application (6 hours)", 6,
          "AFAMAST 4921 WGSST 4921 COMM 4240 COMPSTD 4921 EARTHSC 4502 EEOB 3520 5330 ENGLISH 3305 POLITSC 4455 SOCIOL 4507 5650 STAT 5730",
          notes="Also ANATOMY 4300/4700, PHYSIO 3200, RADSCI 3672."),
], credits=33, notes="43 hours with prerequisites. Undergraduate research is encouraged for grad/professional school.")
for _deg in ("ba", "bs"):
    _bs = _deg == "bs"
    major("medical-anthropology", "Medical Anthropology", _deg, ANTH_URL + ("major-medical-anthropology-bs-0" if _bs else
                                                                             "major-medical-anthropology-bs"), [
        req("prereq", "Prerequisites (10 hours)", "ANTHROP 2200/2200H 2202/2202H; STAT 1450/2450/2480", grade=None),
        req("intro", "Introductory coursework", [*cs("ANTHROP 3302"), t("PUBHEPI 2410", "Introduction to Epidemiology")]),
        req("core", "Core", "ANTHROP 3301 4525 5650"),
        pick("interdisciplinary", "Interdisciplinary perspectives on health (two)", 2,
             "ANTHROP 4706 COMPSTD 3645/3645H EEOB 4240 HISTORY 3307 SOCIOL 3630 5450 WGSST 4404 4189.01S",
             notes="Also PUBHEHS 4530/5320, PUBHEPI 4410/5412/5420, SXLTYST 5620, SOCWORK 3597/5026."),
        *([req("evo-found", "Foundations in human evolution", "ANTHROP 3300/3300H 5600"),
           pick("evo", "Evolutionary perspectives on health (two)", 2, "ANTHROP 3504 3411 5610 5615 5642 5621 5645"),
           pick("biocultural", "Biocultural perspectives on health (one)", 1,
                "ANTHROP 3027 3340 4597.05H 5601 5602 5624 5700 5701 5702")] if _bs else
          [pick("evo-bio", "Evolutionary and biocultural perspectives on health (four)", 4,
                "ANTHROP 3027 3340 3411 3504 5600 5601 5602 5610 5615 5624 5642 5700 5702 4597.05H 5621 5645 5701")]),
    ], credits=33)


# ---------- Earth Sciences (BA, BS with three subprograms) ----------
ES_URL = "https://earthsciences.osu.edu/majors"
ES_NOTE = ("The School of Earth Sciences' pages couldn't be read automatically, so BuckAI checks the shared core and earth-science "
           "hours; confirm your subprogram's course list with an Earth Sciences advisor.")
major("earth-sciences", "Earth Sciences", "ba", "https://earthsciences.osu.edu/majors/ba-earth-science", [
    req("prep", "Preparation for the major", "EARTHSC 1121/1121H/1110 1200 2122 2245; CHEM 1210", grade=None),
    hours("major", "Earth Sciences courses (30 hours at 2000+)", 24, pattern=upper("EARTHSC", 2000, 5999),
          exclude=["EARTHSC 2911"]),
], credits=30, notes=ES_NOTE)
for _key, _name, _note in (
    ("cwe", "Climate, Water and Environment", "Climate, hydrology, and environmental geoscience."),
    ("geological", "Geological Sciences", "Includes an approved field course such as the EARTHSC 5189 summer field camp (partly in Utah)."),
    ("geophysics", "Geophysics", "Supporting science requirements change in Spring 2027; check the current sheet."),
):
    major(f"earth-sciences-{_key}", f"Earth Sciences: {_name}", "bs", ES_URL, [
        req("prep", "Preparation for the major", "EARTHSC 1121/1121H/1110 1200 2122 2245; CHEM 1210 1220; MATH 1151 1152; "
            "PHYSICS 1200/1250 1201/1251", grade=None),
        req("core", "Required for all Earth Sciences BS", [course("EARTHSC 2000", 1, notes="Preparation for Thesis and Careers.")]),
        pick("sustainability", "Approved sustainability course", 1, "EARTHSC 2203 2210 2911 3530 5242"),
        hours("major", f"{_name} subprogram courses", 27, pattern=upper("EARTHSC", 2000, 5999), exclude=["EARTHSC 2911"],
              notes=_note),
        manual("second", "Approved certificate, minor, or second major",
               "Every Earth Sciences BS subprogram requires an approved certificate, a minor, or a second major."),
    ], notes=ES_NOTE + " A senior thesis is part of the BS.")

# ---------- Philosophy; Philosophy, Politics and Economics ----------
major("philosophy", "Philosophy", "ba", "https://philosophy.osu.edu/sites/default/files/2026-06/Cheat%20sheet%20AU26.pdf", [
    pick("prereq", "Prerequisite (logic)", 1, "PHILOS 1500 1501 2500", grade=None,
         notes="Can also count as your GE Math & Quantitative Reasoning Foundation."),
    req("gateway", "Gateway seminar", "PHILOS 3000", notes="Take it early in the major."),
    pick("history", "History of philosophy (two)", 2, "PHILOS 3210 3220 3230 3240 3250 3260 3261"),
    pick("topics", "Topics (two)", 2, "PHILOS 3300 3420 3440 3530 3600 3650 3700 3750 3800 3810"),
    pick("el-2000", "Elective at the 2000 level or higher", 1, [], pattern=upper("PHILOS", 2000, 5999)),
    pick("el-3000", "Electives at the 3000 level or higher (two)", 2, [], pattern=upper("PHILOS", 3000, 5999)),
    pick("el-5000", "Electives at the 5000 level (two)", 2, [], pattern=upper("PHILOS", 5000, 5999), exclude=["PHILOS 5010S"]),
], credits=30, notes="Major courses can't count on the GE except up to two Theme courses from different Themes.")

major("ppe", "Philosophy, Politics and Economics", "ba", "https://ppe.osu.edu/curriculum", [
    pick("stats", "Statistics (one)", 1, "ECON 3400; INTSTDS 3400; POLITSC 3780/3780H"),
    pick("formal", "Formal methods (one)", 1, "ECON 5001; PHILOS 2500 2540; POLITSC 3500 4553/4553H"),
    req("moral", "Moral philosophy", "PHILOS 3300"),
    pick("political", "Political philosophy and theory (one)", 1, "PHILOS 2400; POLITSC 2400/2400H"),
    pick("econ", "Economics (one)", 1, "ECON 2001.01/2001.03H 2002.01/2002.03H"),
    pick("polecon", "Political economy (one)", 1, "POLITSC 3280 3380 4381"),
    req("core", "PPE core (after the fundamentals)", "PHILOS 3001/POLITSC 3001/ECON 3001; PHILOS 3002/POLITSC 3002/ECON 3002"),
    pick("concentration", "Concentration (four courses: one each in ECON, PHILOS and POLITSC; three at 3000+)", 4, [],
         pattern=r"^(ECON|PHILOS|POLITSC) [2-5]\d{3}",
         notes="Choice and Behavior; Global Cooperation and Conflict; Justice and Moral Reasoning; Law, Policy, and Governance; "
               "or design your own. Courses can't count for both the fundamentals and the concentration."),
])

# ---------- Linguistics ----------
LING_URL = "https://linguistics.osu.edu/undergrad/major"
LING_COMMON = [
    req("intro", "Introduction to Linguistics (prerequisite)", "LING 2000/2000H", grade=None),
    manual("language", "Language requirement",
           "3 hours of a world language at the 2000 level or higher (taught in the language), 3 hours of a language not used for "
           "the ASC language requirement, placement equivalent to either, field methods (LING 4550/5551/5552), or an approved "
           "4000+ course on a non-English language's structure."),
    pick("core", "Core (any four)", 4, "LING 4100 4200 4300 4350 4400"),
    manual("core-elective", "Elective core: one course in each of two areas",
           "Historical (LING 3901, 3902, 5901); Sociolinguistics (3603, 3605, 4602, 5601); Psycholinguistics (3701, 5701, 5702); "
           "Field Methods (4550, 5551, 5552)."),
]
major("linguistics-a", "Linguistics: Track A (breadth)", "ba", LING_URL, LING_COMMON + [
    hours("electives", "Major electives (12 hours, plus the two elective-core courses)", 18, pattern=upper("LING", 2000, 5999),
          notes="Up to 3 hours of LING 3191/4998/4999; related courses elsewhere with the advisor's OK."),
], credits=30)
major("linguistics-b", "Linguistics: Track B (research / graduate school)", "ba", LING_URL, LING_COMMON + [
    pick("analytic", "Analytic requirement (prerequisite)", 1, "LING 2001 2051/2051H; PHILOS 2500; MATH 2366; STAT 1350 1450; "
         "PSYCH 2220/2220H", grade=None),
    req("seminar", "Undergraduate research seminar", "LING 4780"),
    manual("depth", "Area-depth sequence",
           "Two courses in one subfield, e.g. LING 5801-5802 (computational), 5601-5602 (sociolinguistics), 5101-5102 (phonetics), "
           "5301-5302 (phonology), 5401 + 5201, or another sequence the advisor approves."),
    hours("electives", "Major electives (12 hours incl. the depth sequence, plus elective core)", 18, pattern=upper("LING", 2000, 5999)),
], credits=33)

# ---------- Comparative Studies department: Comparative Studies, Religious Studies, World Literatures ----------
CS_URL = "https://comparativestudies.osu.edu/"
major("comparative-studies", "Comparative Studies", "ba",
      CS_URL + "undergrad/ba-comparative-studies/ba-comparative-studies-requirements-au-23-onward", [
    req("required", "Required courses (10 hours)", "COMPSTD 2099 2360 3990 4990"),
    pick("research", "Comparative Studies 4000-level research course (before COMPSTD 4990)", 1, [],
         pattern=r"^COMPSTD 4\d{3}", exclude=["COMPSTD 4990"]),
    hours("focus", "Core area of focus (five courses, 15 hours)", 15, pattern=r"^(COMPSTD|RELSTDS) [2-5]\d{3}",
          notes="An individualized set of five courses designed with your advisor (at least four COMPSTD or RELSTDS)."),
    hours("electives", "Electives (12 hours)", 12, pattern=r"^(COMPSTD|RELSTDS) [2-5]\d{3}",
          notes="Comparative Studies courses not used above; one approved outside course may count."),
], credits=37, notes="For students who started Autumn 2023 or later.")
major("religious-studies", "Religious Studies", "ba", CS_URL + "religious-studies-requirements", [
    req("core", "Core (12 hours)", "RELSTDS 2370/2102.02; RELSTDS 3972; COMPSTD 3990; RELSTDS 4970/COMPSTD 4990"),
    hours("traditions", "Individual religious traditions (9-15 hours, three traditions or regions)", 9,
          "ARABIC 5701 CLAS 3401 3404 3405 3408 HEBREW 2700 3210 HISTORY 2220 2221 2351 2450 2451 2452 3218 3219 3227 3229 3245 "
          "HISTART 3005 JEWSHST 2201 3210 NELC 3501 3508 PHILOS 2120 3111", pattern=r"^RELSTDS [2-5]\d{3}"),
    hours("electives", "Thematic and elective courses (to 36 hours)", 15, pattern=r"^(RELSTDS|COMPSTD) [2-5]\d{3}"),
], credits=36)
major("world-literatures", "World Literatures", "ba", CS_URL + "undergrad/world-literatures/about-world-literatures/requirements", [
    req("required", "Required (12 hours)", "COMPSTD 2301 3302 3990 3903"),
    manual("regions", "Regional distribution",
           "Eight literature courses (24 hours) from ASC language, literature and culture departments: at least one from each of "
           "five regions (Africa; East and South Asia; Latin America/Caribbean; Middle East; North America/Europe) and two from "
           "three of them. At most two at the 2000 level."),
    hours("literature", "Literature courses (24 hours)", 24,
          pattern=r"^(AFAMAST|CHINESE|JAPANSE|KOREAN|EALL|SPANISH|PORTGSE|ARABIC|HEBREW|PERSIAN|TURKISH|NELC|ENGLISH|FRENCH|ITALIAN|"
                  r"GERMAN|RUSSIAN|SLAVIC|CLAS|COMPSTD) [2-5]\d{3}"),
], credits=36)


# ---------- WGSS, AAAS ----------
major("wgss", "Women's, Gender and Sexuality Studies", "ba", "https://wgss.osu.edu/undergraduate/major", [
    req("prereq", "Prerequisite", "WGSST 1110/1110H"),
    req("core", "Core (9 hours)", "WGSST 2550 3575 4575",
        notes="WGSST 4575 (spring) needs 3575 first; a WGSST 4999 thesis can earn research distinction instead."),
    hours("electives", "WGSS electives (7 courses, 21 hours; 3 at 3000+)", 21, pattern=upper("WGSST", 2000, 5999),
          notes="Include one approved Women of Color course and one Global & Transnational Feminisms course (different courses)."),
], credits=33, notes="33 hours including the prerequisite, so it pairs easily with a second major.")
major("aaas", "African American and African Studies", "ba", "https://aaas.osu.edu/students/undergrad/major", [
    req("core", "Core (12 hours)", "AFAMAST 2201 3310 3440 4921"),
    pick("upper", "Electives at the 4000 level (three)", 3, [], pattern=upper("AFAMAST", 4000, 5999)),
    hours("electives", "Other AFAMAST electives (9 hours at 2000+)", 9, pattern=upper("AFAMAST", 2000, 5999)),
], credits=30, notes="Older students may follow the 5-core/5-elective version; confirm with the AAAS advisor.")

# ---------- Classics department ----------
CL_URL = "https://classics.osu.edu/Undergraduate-Studies/major-requirements/"
GRK_LAT = "GREEK 2101 2102 2103 2104 2110 5011 5012 5013 5014 5015 5016 5017 5030 5797; LATIN 2101 2102 2103 2104 2105 2106 5011 5012 5013 5014 5015 5016 5017 5018 5030 5797"
CLAS_ELECT = r"^(CLAS|GREEK|LATIN|MDRNGRK) [2-5]\d{3}"
major("classics-humanities", "Classics: Classical Humanities", "ba", CL_URL + "classics-major/classical-humanities", [
    req("prereq", "Prerequisite", "CLAS 1101/1101H", grade=None),
    pick("c2000", "2000-level courses (two)", 2, "CLAS 2201/2201H 2202/2202H 2204 2205 2220/2220H 2301 2500H"),
    pick("c3000", "3000-level courses (three)", 3, "CLAS 3000 3100 3101 3102 3103 3104 3203 3205 3212 3215 3217 3220 3221 3222 3223 "
         "3401 3402 3403 3404 3408 3720 3956"),
    pick("c4000", "4000-level or above (one)", 1, "CLAS 4031 4101 4301 4501 4998 4999 5051 5101 5302 5401 5798.02"),
    hours("electives", "Electives (15 hours)", 15, pattern=CLAS_ELECT, notes="At most 3 courses from outside Classics."),
], credits=33)
for _key, _name, _pre, _req in (
    ("greek", "Ancient Greek Language", "GREEK 1101 1102 1103", "GREEK"),
    ("latin", "Latin Language", "LATIN 1101 1102 1103", "LATIN"),
    ("greek-latin", "Ancient Greek and Latin Language", "GREEK 1101 1102 1103; LATIN 1101 1102 1103", "GREEK|LATIN"),
):
    major(f"classics-{_key}", f"Classics: {_name}", "ba", CL_URL + f"classics-major/{_key.replace('greek-latin', 'greek-and-latin')}", [
        req("prereq", "Language prerequisites (don't count in the major)", _pre, grade=None),
        pick("lang", "Language courses at 2000+ (three)", 3, [], pattern=rf"^({_req}) [2-5]\d{{3}}"),
        pick("lang5000", "5000-level language courses (two)", 2, [], pattern=rf"^({_req}) 5\d{{3}}"),
        hours("electives", "Electives (15 hours)", 15, pattern=CLAS_ELECT, notes="At most 3 courses from outside Classics; advisor-approved."),
    ], credits=30)
major("ancient-history-classics", "Ancient History and Classics", "ba", CL_URL + "ancient-history-and-classics-major", [
    manual("prereq", "Greek or Latin language sequence (prerequisite)", "GREEK or LATIN 1101-1102-1103 (13 hours, not in the major)."),
    hours("lang", "Greek and/or Latin at 2000+ (four courses)", 12, GRK_LAT),
    hours("history", "Ancient history at 2000+ (four courses)", 12, "HISTORY 2201 2202 2205 2210 2211 2212 2213 2214 3210 3211 3212 "
          "3215 3220 3221 3223 3225 3226 3228 3229 3230 4210 4211 4212 4213 4215 4216 4217 4218"),
    req("senior", "Senior thesis", [course("HISTORY 4999", 4, alternates=["CLAS 4999"], notes="4 credit hours.")]),
    hours("elective", "Elective (3 hours)", 3, pattern=r"^(CLAS|GREEK|LATIN|HISTORY|HISTART|PHILOS) [2-5]\d{3}"),
], credits=31)
major("modern-greek", "Modern Greek", "ba", CL_URL + "modern-greek-major", [
    manual("prereq", "Modern Greek language prerequisite", "MDRNGRK 1101-1102-1103 (13 hours, not in the major)."),
    hours("advanced", "Advanced Modern Greek language (two courses)", 6, pattern=r"^MDRNGRK [2-5]\d{3}"),
    pick("culture", "Modern Greek culture (one)", 1, "MDRNGRK 2000 2100 2240 2680 3710"),
    hours("courses", "More courses at 2000+ (seven, 21 hours)", 21, pattern=r"^(MDRNGRK|CLAS) [2-5]\d{3}",
          notes="At most two allied-field courses (History, Theatre, Linguistics) with a strong Modern Greek component."),
], credits=30)

# ---------- History of Art ----------
major("history-of-art", "History of Art", "ba",
      "https://history-of-art.osu.edu/sites/default/files/2023-08/histart_undergrad_advising_sheet_2022-gen.docx", [
    hours("core", "Group A: four core courses (12 hours)", 12, "HISTART 2001/2001H 2002/2002H 2003/2003H 4001 4005 4010 4016",
          notes="See the advising worksheet for the four core courses."),
    hours("breadth", "Group B: six courses across three areas (18 hours, four at 4000+)", 18, pattern=upper("HISTART", 2000, 5999),
          notes="Areas: Mediterranean/European before 1700; modern Europe and US after 1700; global (Asia, Africa, the Americas)."),
    pick("concentration", "Group C: concentration (two 4000+ in one area, one at 5000)", 2, [], pattern=upper("HISTART", 4000, 5999)),
    pick("d", "Group D: one more 5000-level course (or HISTART 4999 thesis)", 1, "HISTART 4999", pattern=upper("HISTART", 5000, 5999)),
], credits=39)


# ---------- International Studies (BA: 14 specializations; BS) ----------
IS_URL = "https://internationalstudies.osu.edu/academics/majors/"
IS_SPECS = [("african-studies", "African Studies"), ("development-studies", "Development Studies"),
            ("east-asian-studies", "East Asian Studies"), ("globalization-studies", "Globalization Studies"),
            ("human-rights", "Human Rights"), ("information-security", "Information Security"),
            ("international-conflict-peace-studies", "International Conflict and Peace Studies"),
            ("international-relations-diplomacy", "International Relations and Diplomacy"),
            ("latin-american-studies", "Latin American Studies"), ("middle-east-studies", "Middle East Studies"),
            ("security-intelligence", "Security and Intelligence"), ("slavic-east-european-studies", "Slavic and East European Studies"),
            ("west-european-studies", "West European Studies"), ("world-economy-and-business", "World Economy and Business")]
IS_PATTERN = r"^[A-Z]{3,8} [2-5]\d{3}"
IS_COMMON = [
    req("foundations", "Required foundations", "INTSTDS 3850 4852"),
    manual("language", "World language proficiency at the 2000 level",
           "Proficiency in a language other than English through the 2000 level (beyond the ASC 1103 requirement); it doesn't "
           "count toward the 33 hours. See internationalstudies.osu.edu's World Language Requirement page."),
]
for _slug, _name in IS_SPECS:
    major(f"intstds-{_slug}", f"International Studies: {_name}", "ba", IS_URL + _slug, IS_COMMON + [
        pick("methods", "Methods and analysis (one)", 1, "GEOG 4103; ECON 3400; INTSTDS 3400 5650"),
        hours("primary", f"Primary specialization: {_name} (five courses, 15 hours)", 15, pattern=IS_PATTERN,
              exclude=["INTSTDS 3850", "INTSTDS 4852"], notes="From the specialization's approved list on the program page."),
        hours("secondary", "Secondary specialization (three courses, 9 hours)", 9, pattern=IS_PATTERN,
              exclude=["INTSTDS 3850", "INTSTDS 4852"], notes="Three courses from a second specialization's list."),
    ], credits="11 courses, 33 hours (language not included).",
       notes="Include one Advanced Writing, one Data Analysis and one Technology embedded-literacy course.")
major("intstds", "International Studies", "bs", IS_URL, IS_COMMON + [
    hours("data", "Data analysis series (three courses, 9 hours)", 9, "GEOG 5103 5210 4103; ECON 3400; STAT 3301",
          notes="One complete 3-course data series from the BS list."),
    hours("primary", "Primary specialization (five courses, 15 hours)", 15, pattern=IS_PATTERN, exclude=["INTSTDS 3850", "INTSTDS 4852"]),
], credits="11 courses, 33 hours.", notes="The BS swaps the methods course and secondary specialization for a 3-course data "
                                           "analysis series. Pick your specialization with an International Studies advisor.")


# ---------- World language and area-studies majors ----------
def language_major(mid, name, url, subjects, hours_total, prereq, upper_hours=15, groups=(), notes="", pattern=None):
    subj = subjects if isinstance(subjects, str) else "|".join(subjects)
    return major(mid, name, "ba", url, [
        manual("prereq", "Language prerequisite (doesn't count in the major)", prereq),
        *groups,
        pick("upper", f"Courses at the 3000 level or above ({upper_hours} hours)", upper_hours // 3, [],
             pattern=pattern or upper(subj, 3000, 5999)),
        hours("courses", f"{name.split(':')[0]} courses (to {hours_total} hours at 2000+)", hours_total - upper_hours - 3 * sum(
            (g.get("min_courses") or 0) for g in groups if g["kind"] == "choose_courses"),
              pattern=pattern or upper(subj, 2000, 5999)),
    ], credits=hours_total, notes=(notes + " " if notes else "") + "Courses taught in the language and approved culture courses "
                                   "count; confirm the department's current major sheet for any required course groups.")


DEALL = "https://deall.osu.edu/programs/undergrad/"
major("chinese", "Chinese", "ba", "https://deall.osu.edu/sites/deall.osu.edu/files/chinese-major-handout.pdf", [
    manual("prereq", "Prerequisites (15 hours)", "CHINESE 1101.01, 1102.01, 1103.01 (or the intensive/heritage track) and CHINESE 2231."),
    hours("language", "Major language courses (18 hours)", 18, "CHINESE 2102.01 4101.01 4102.01 5111.01",
          pattern=r"^CHINESE (2[01]\d{2}|4[01]\d{2}|51\d{2})", notes="Regular, individualized, and intensive (2151-4152 heritage) tracks."),
    pick("literature", "Literature (two)", 2, "CHINESE 2451 4401 4402 4403 4404 4407"),
    pick("advanced", "Advanced studies (two)", 2, "CHINESE 4193 4380 4381 4401 4402 4403 4404 4405 4406 4407 4998 4999 5112 5101"),
    pick("culture", "East Asian arts, culture, history, thought (one)", 1, [], pattern=r"^(EALL|HISTART|HISTORY|CHINESE|JAPANSE|KOREAN|PHILOS|RELSTDS) [2-5]\d{3}"),
], credits=33, notes="18 of the 33 hours must be taken at Ohio State. A combined BA/MA is available.")
language_major("japanese", "Japanese", DEALL + "japanese", "JAPANSE", 33,
               "JAPANSE 1101.xx-1103.xx (or the intensive track).", notes="Handout: https://deall.osu.edu/sites/deall.osu.edu/files/japanese-major-handout.pdf")
language_major("korean", "Korean", DEALL + "korean", "KOREAN", 33,
               "KOREAN 1101-1103 (or the heritage track).", notes="Handout: https://deall.osu.edu/sites/deall.osu.edu/files/korean-major-handout.pdf")
language_major("french", "French", "https://frit.osu.edu/ug/majors/major-french", "FRENCH", 30, "FRENCH 1101-1103 (or placement).",
               groups=[req("core", "Core", "FRENCH 3101 4100"), req("writing", "Advanced writing literacy", "FRENCH 4401")],
               notes="Attend the World Language Skills and Competencies Workshop. At most half the hours by EM or transfer credit.")
language_major("french-francophone", "French and Francophone Studies", "https://frit.osu.edu/ug/majors/ffs-major", ["FRENCH", "FRIT"], 30,
               "FRENCH 1101-1103 (or placement).", notes="Mixes courses taught in French and in English translation.")
language_major("italian", "Italian", "https://frit.osu.edu/ug/majors/major-italian", "ITALIAN", 30, "ITALIAN 1101-1103 (or placement).")
language_major("italian-studies", "Italian Studies", "https://frit.osu.edu/ug/majors/italian-studies-major", ["ITALIAN", "FRIT"], 30,
               "ITALIAN 1101-1103 (or placement).", notes="Includes Italian culture courses taught in English.")
language_major("romance-studies", "Romance Studies", "https://frit.osu.edu/ug/majors/romance-studies-major",
               ["FRENCH", "ITALIAN", "SPANISH", "PORTGSE", "FRIT"], 33, "Proficiency in two Romance languages per the major sheet.")
language_major("german", "German", "https://germanic.osu.edu/undergraduate-studies", ["GERMAN", "SCANDVN", "YIDDISH"], 30,
               "GERMAN 1101-1103 (or placement).")
language_major("russian", "Russian", "https://slavic.osu.edu/undergraduate-russian-major", ["RUSSIAN", "SLAVIC"], 30,
               "RUSSIAN 1101-1103 (or placement).")
language_major("spanish", "Spanish", "https://sppo.osu.edu/undergraduate/spanish", ["SPANISH", "PORTGSE"], 33,
               "SPANISH 1101-1103 (or 1155) and SPANISH 2202 or 2213.",
               notes="Four tracks; C- in each course. At most 2 honors-embedded (E) courses count.")
language_major("arabic", "Arabic", "https://nelc.osu.edu/CoursesandPrograms/AcademicPrograms/Undergraduate/Arabic", ["ARABIC", "NELC"], 30,
               "ARABIC 1101-1103 (or placement).")
language_major("hebrew-jewish", "Hebrew and Jewish Studies", "https://nesa.osu.edu/CoursesandPrograms/AcademicPrograms/Undergraduate/Hebrew/JewishStudies",
               ["HEBREW", "JEWSHST", "YIDDISH"], 30, "HEBREW 1101-1103 (or placement).")
language_major("islamic-studies", "Islamic Studies", "https://nesa.osu.edu/CoursesandPrograms/AcademicPrograms/Undergraduate/IslamicStudies",
               ["ISLAM", "ARABIC", "PERSIAN", "TURKISH", "NELC", "HISTORY", "RELSTDS"], 30,
               "A language of the Islamic world (Arabic, Persian, Turkish, Urdu, Uzbek...) through the major sheet's level.",
               pattern=r"^(ISLAM|ARABIC|PERSIAN|TURKISH|URDU|UZBEK|NELC|HISTORY|RELSTDS|COMPSTD) [3-5]\d{3}")
language_major("asl", "American Sign Language: Applied Communication and Community Studies",
               "https://asl.osu.edu/major-american-sign-language-asl-applied-communication-and-community-studies", "ASL", 30,
               "ASL 1101-1103.")


# ---------- Speech and Hearing Science, Leadership, Arts Management ----------
major("speech-hearing", "Speech and Hearing Science", "ba", "https://sphs.osu.edu/", [
    req("core", "Core courses", "SPHHRNG 2230 3320 3330/3330E 3340 4420 4430 4440 4540"),
    hours("electives", "Speech and Hearing electives", 9, "SPHHRNG 2260 3350 3360 3370S 3380S 4510 4520 4530 5605 5732 5760 4999",
          pattern=upper("SPHHRNG", 2000, 5999), notes="Pre-professional students also plan graduate-school prerequisites "
          "(biology, physics or chemistry, statistics, psychology)."),
], credits="About 34", notes="Prepares for graduate study in speech-language pathology (MA) or audiology (AuD). Confirm the "
                             "current core with the department's advising sheet.")
major("leadership", "Leadership", "ba", "https://ascleadershipmajor.osu.edu/curriculum/sample-curricula/sample-advising-sheet", [
    manual("core", "Core (12 hours)", "Four core courses: Leadership in History, Ethics of Leadership, Diversity and Leadership, "
           "and Practice of Leadership (see the Leadership major's full course list)."),
    manual("skills", "Specialization skills (9 hours)", "Three skills courses from your specialization's list, including one COMM "
           "skills course; up to 3 hours of co-curricular credit (ARTSSCI 3192) with the director's approval."),
    manual("content", "Specialization content (9 hours)", "Three content courses from your specialization's list."),
    manual("capstone", "Capstone seminar and digital portfolio", "After the four core courses, two skills and two content courses; "
           "junior or senior standing. Turn in your Digital Learning Portfolio at the end."),
], credits=33, notes="11 courses; up to 9 hours of non-ASC coursework (cross-counting needs both departments' approval).")
major("arts-management", "Arts Management", "ba", "https://aaep.osu.edu/sites/default/files/2025-08/Arts%20Management%20Major%20Curriculum%20Sheet.pdf", [
    req("prereq", "Pre-requisites (13 hours)", "ECON 2001.01/2001.03H; BUSMHR 2500; MATH 1130; ENGLISH 1110.01", grade=None,
        notes="Some can count toward the GE."),
    req("business", "Business core (9 hours)", "ACCTMIS 2000; BUSFIN 3120; BUSML 3510",
        notes="ACCTMIS 2000 is challenging for many; plan for it."),
    req("core", "Arts policy and management core (10 hours)", [*cs("ARTEDUC 2100"), course("ARTEDUC 3680", alternates=["ARTEDUC 3681"]),
                                                                *cs("ARTEDUC 5222 5688")]),
    pick("advanced", "Advanced arts policy and management (four)", 4,
         "ARTEDUC 5470.01 5670 5671 5672 5674 5675 5677 5681 5682 5684 5685 5686 5687 5797.04"),
    req("capstone", "Capstone (senior year)", "ARTEDUC 5683", standing=90),
    hours("applied", "Applied learning experience (3 hours)", 3, "ARTEDUC 4191 4193"),
], notes="Internships and arts-organization experience are part of the program.")

# ---------- Theatre, Film, and Media Arts ----------
TFMA = "https://theatreandfilm.osu.edu/sites/default/files/"
major("film-studies", "Film Studies", "ba", TFMA + "2026-07/FILMSTD-BA%20advising%20guide%20%28eff.%20AU26%29%2006.2026.pdf", [
    pick("prereq", "Prerequisite", 1, "FILMSTD 2270.01 2271", grade=None),
    hours("core", "Core: international film history, theory, and analysis (6 hours)", 6, pattern=r"^FILMSTD [23]\d{3}"),
    hours("categories", "Non-fictional & non-industrial (6), global screen cultures (3), screen histories (3)", 12,
          pattern=r"^(FILMSTD|MVNGIMG|ENGLISH|HISTART|COMPSTD|FRENCH|GERMAN|ITALIAN|SPANISH|JAPANSE|CHINESE|KOREAN|ART) [2-5]\d{3}",
          notes="A course in several categories counts in only one."),
    hours("electives", "Film Studies electives (9 hours)", 9, pattern=r"^(FILMSTD|MVNGIMG|THEATRE|ART|COMM|ENGLISH) [2-5]\d{3}"),
    hours("subplan", "Upper-level subplan: Film Production, Cinema and Culture, or Screenwriting", 9, "FILMSTD 4800 4880 4881 4890 4895",
          pattern=r"^(FILMSTD|MVNGIMG) [3-5]\d{3}"),
], notes="Advising guide effective Autumn 2026.")
major("moving-image-production", "Moving-Image Production", "ba",
      TFMA + "2026-04/MIP%20Degree%20requirements%20and%204-year%20schedule%20%28AU26%29.pdf", [
    req("premajor", "Pre-major (9 hours)", "MVNGIMG 2201 2202; FILMSTD 2271",
        notes="Then a portfolio review; a B- (2.7) average across pre-major courses is needed to be considered."),
    manual("studios", "Production studios (21 hours)", "At least one studio in each of Animation, Documentary, Experimental, and "
           "Narrative, plus 9 more hours in those areas or the optional skill courses (ART, THEATRE and DESIGN studios on the sheet)."),
    hours("cinema-today", "Cinema Today (repeat for 2 hours)", 2, "MVNGIMG 4200"),
    hours("electives", "MIP electives (6 hours at 2000+)", 6, "MVNGIMG 4191", pattern=r"^(MVNGIMG|FILMSTD|ART|THEATRE) [2-5]\d{3}"),
    req("senior", "Senior project", "MVNGIMG 4501 4502", standing=90),
], admission="selective: pre-major courses, a 2.7 average, and a portfolio review.")
major("theatre", "Theatre", "ba", TFMA + "2024-06/Theatre%20Major%20Requirements%20%28as%20of%20AU22%2C%20accessible%29_0.pdf", [
    req("foundations", "Foundations", "THEATRE 2100/2100H 3831 2000.02 3000 3731 3732",
        notes="THEATRE 2000 production labs and 3000 run crew; complete most foundations early."),
    pick("history5771", "Performance history/theory", 1, "THEATRE 5771 3710 3711 3712"),
    pick("advanced", "Advanced production (one, audition or permission)", 1, [], pattern=r"^THEATRE (4000|5\d{3})"),
    hours("experiential", "Experiential learning (3 hours)", 3, "THEATRE 4191 3921S 4921S"),
    hours("electives", "Theatre electives at 3000+ (12 hours)", 12, pattern=upper("THEATRE", 3000, 5999),
          notes="Shape them toward acting, new works, design, or technical theatre."),
], notes="Requirements as of Autumn 2022.")

# ---------- Professional Programs in the Arts (BFA, BM, BME, BSD, BAE) and arts BA/BS ----------
PPA_NOTE = ("Admission is selective (audition or portfolio). BuckAI checks the main course sequences; the department's checklist "
            "has the semester-by-semester details, so confirm with your arts advisor.")
major("dance", "Dance (BFA)", "bfa", "https://dance.osu.edu/undergrad/bfa-program", [
    hours("contemporary", "Contemporary technique (16 hours, every autumn and spring)", 16, "DANCE 3101 3102 4101 4102"),
    hours("african", "African and Afro-diasporic technique (6 hours)", 6, "DANCE 3003 4003 5003"),
    hours("ballet", "Ballet technique (6 hours)", 6, "DANCE 3111 3112 4111 4112 5111 5112"),
    hours("somatic", "Somatic practice (2 hours)", 2, "DANCE 2171 2175 5171 5173 5175"),
    hours("creative", "Composition, improvisation, production, music, technology", 12,
          "DANCE 2121 2601 2701 2702 2801 2802 4203", pattern=r"^DANCE [2-5]\d{3}"),
    req("senior", "History/theory, teaching, and senior work", "DANCE 2401 4490 4502 4801 4802 4998", standing=60),
], credits="Degree total 127 hours", admission="audition.", notes=PPA_NOTE + " Dance BFA needs a 2.2 major GPA and C- in dance courses.")

MUSIC_CORE = [
    manual("theory", "Music theory and aural skills sequence",
           "The four-semester theory and aural-skills sequence for music majors (from MUSIC 2121 Intensive Music Theory 1 onward), "
           "placed by the School of Music's entrance exam."),
    hours("history", "Music history and global music", 6, "MUSIC 3340 3342 3347 3348 4500.02", pattern=r"^MUSIC (33|34|46)\d{2}"),
    hours("applied", "Applied lessons (principal instrument or voice)", 8, pattern=r"^MUSIC (2201|2202|3401|3402|4501|4502|5501|5502)\.\d{2}",
          notes="Applied lessons each semester on your principal instrument (MUSIC 2201/3401/4501 series)."),
    hours("ensembles", "Ensembles (every semester in residence)", 6, pattern=r"^MUSIC (2|3|4|5)7\d{2}|^MUSIC 2?2?2[4-9]\d{2}",
          notes="Large ensembles by audition; see music.osu.edu/ensembles."),
]
MUSIC_URL = "https://music.osu.edu/future/undergrad/degrees/"
major("music", "Music (BA)", "ba", MUSIC_URL + "ba-music", MUSIC_CORE[:3] + [
    hours("electives", "Music electives", 6, pattern=upper("MUSIC", 2000, 5999)),
], admission="audition.", notes="The liberal-arts music degree; pairs well with a second major. " + PPA_NOTE)
for _key, _name in (("cs", "Computer Science"), ("sonic", "Sonic Arts"), ("business", "Creative Practice, Business and Technology")):
    major(f"music-{_key}", f"Music: {_name} (BS)", "bs", MUSIC_URL + "bs-music", MUSIC_CORE[:2] + [
        hours("spec", f"{_name} specialization courses", 15,
              "MUSIC 3330 3354 3355" + ("; CSE 2221 2231 2321" if _key == "cs" else ""),
              pattern=r"^(MUSIC|CSE|ACCAD|DESIGN|BUSADM|ARTEDUC) [2-5]\d{3}"),
        manual("senior", "Senior project", "A senior project in your specialization (see the BS in Music curriculum)."),
    ], notes="Multidisciplinary BS in music and sound studies. " + PPA_NOTE)
for _key, _name, _url in (("composition", "Composition", "bm-comp"), ("jazz", "Jazz Studies", "bm-jazz"),
                          ("performance", "Performance", "bm-perf"), ("history", "Music History", "bm-perf"),
                          ("theory", "Music Theory", "bm-perf")):
    major(f"music-{_key}", f"Music: {_name} (BM)", "bm", MUSIC_URL + _url, MUSIC_CORE + [
        hours("area", f"{_name} area courses", 12, pattern=upper("MUSIC", 3000, 5999)),
        manual("recital", "Recital / senior project", "Junior and/or senior recital or capstone project as your area requires."),
    ], credits="Degree total 121 hours (Voice performance 127)", admission="audition.", notes=PPA_NOTE)
for _key, _name in (("choral", "Choral"), ("instrumental", "Instrumental"), ("general", "General")):
    major(f"music-education-{_key}", f"Music Education: {_name} (BME)", "bme", MUSIC_URL + "bme", MUSIC_CORE + [
        req("intro", "Music education foundations", "MUSIC 2470/2470E"),
        hours("methods", "Methods, techniques, and conducting", 12, pattern=r"^MUSIC (24|34|44|54)\d{2}"),
        manual("student-teaching", "Field experience and student teaching", "Clinical field experiences and a semester of student "
               "teaching for Ohio multi-age music licensure."),
    ], admission="audition.", notes="BME needs a 3.00 cumulative and major GPA. " + PPA_NOTE)

DESIGN_URL = "https://design.osu.edu/undergrad/majors/"
DESIGN_CORE = req("foundations", "Design foundations", "DESIGN 2110 2130 2310 2330 2700 2750",
                  notes="First-year foundations; admission to the major is by portfolio review.")
for _key, _name, _codes in (
    ("ind", "Industrial Design", "DESIGN 3151 3401 3551 4101 4151 4401 5101 5201 3200 4200"),
    ("int", "Interior Design", "DESIGN 3102 3552 4152 4402 4502 5102 5202 3200 4200 4752"),
    ("vcd", "Visual Communication Design", "DESIGN 3153 3403 3453 3503 3553 4103 4153 4403 5103 5203 5453 3200 4200"),
    ("emd", "Experiential Media Design", "DESIGN 3106 3556 4106 4806 3200 4200"),
):
    major(f"design-{_key}", f"{_name} (BSD)", "bsd", DESIGN_URL + _key, [
        DESIGN_CORE,
        req("studio", f"{_name} studio and media sequence", _codes),
        hours("electives", "Design electives", 6, pattern=upper("DESIGN", 3000, 5999)),
    ], admission="portfolio review after the foundations year.",
          notes=PPA_NOTE + " Design BSD needs a 2.25 major GPA." + (" CIDA-accredited." if _key == "int" else ""))

major("art", "Art (BFA)", "bfa", "https://art.osu.edu/undergraduate-students/major-and-minor-curriculum-sheets", [
    req("foundations", "Foundations", "ART 2000 2100 2200 2300 2400"),
    req("portfolio", "BFA portfolio review", "ART 2990"),
    hours("studio", "Studio courses (3000+)", 30, pattern=upper("ART", 3000, 4999),
          notes="Ceramics, glass, painting & drawing, photography, printmaking, sculpture, art & technology, film/video."),
    hours("arthistory", "Art history", 9, pattern=upper("HISTART", 2000, 5999)),
    req("senior", "Professional practice and senior exhibition", "ART 5000 4990", standing=90),
], admission="BFA portfolio review (ART 2990).", notes=PPA_NOTE + " Art BFA needs a 2.25 major GPA.")
major("art", "Art (BA)", "ba", "https://art.osu.edu/sites/default/files/2025-11/BA%20Degree%20Plan%20GEN%203.0_Updated_AU25%20%281%29.pdf", [
    req("foundations", "Foundations", "ART 2000 2100 2300 2400"),
    hours("studio", "Studio courses", 18, pattern=upper("ART", 3000, 4999)),
    hours("arthistory", "Art history", 6, pattern=upper("HISTART", 2000, 5999)),
], admission="selective.", notes="The liberal-arts art degree (BA degree plan, GEN 3.0, updated Autumn 2025).")
major("art-education", "Art Education (BAE)", "bae", "https://aaep.osu.edu/academics/art-education/ba", [
    req("foundations", "Art foundations", "ART 2100 2300 2400"),
    req("education", "Art education sequence", "ARTEDUC 2250 2550 3900 4000 4100 4200 4300 4400"),
    req("clinical", "Practicum and student teaching", "ARTEDUC 4189.02 4500 4900", standing=60),
    hours("studio", "Studio art and art history electives", 12, pattern=r"^(ART|HISTART) [2-5]\d{3}"),
], admission="selective.", notes="Leads to Ohio multi-age (PreK-12) visual arts licensure. BAE needs a 3.00 major GPA. " + PPA_NOTE)


# ---------- Minors ----------
# Sources: each minor's official advising sheet (artsandsciences.osu.edu/academics/programs/minors/<slug>, read November 2026).
# Course lists below were read from the sheets; every minor also accepts its subject's 2000+ courses, since most sheets
# allow electives by subject. The minor's own required courses and caps are in its notes / the sheet.
ASC_MINOR_SHEETS = {  # slug: (name, credit hours, advising sheet, subject pattern, majors that exclude it, courses on the sheet)
    'african-american-and-african-studies': ('African American and African Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-aaas.pdf', 'AFAMAST', ['aaas'], 'AFAMAST 2201 AFAMAST 3310 AFAMAST 2000 AFAMAST 3000'),
    'american-indian-studies': ('American Indian Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-ais.pdf', 'AMINSTS|ANTHROP|COMPSTD|HISTORY', [], ''),
    'american-sign-language-asl-studies': ('American Sign Language (ASL) Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-asl-studies.pdf', 'ASL', ['asl'], 'ASL 2104 ASL 3105 ASL 3104 ASL 3350 ASL 3650 ASL 4189S ENGLISH 2277 LING 2000 ARTSSCI 5797'),
    'american-studies': ('American Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-01/minor-american-studies.pdf', 'COMPSTD|HISTORY|ENGLISH|AFAMAST', [], ''),
    'andean-and-amazonian-studies': ('Andean and Amazonian Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2024-07/minor-andean-amazonian.pdf', 'SPANISH|PORTGSE|QUECHUA|ANTHROP', [], 'MUSIC 2208.22 SPANISH 2208.22 SPANISH 2330 SPANISH 2798.11 SPANISH 4515 SPANISH 4516 SPANISH 4555 SPANISH 2332 SPANISH 4565H INTSTDS 2580 INTSTDS 4535 INTSTDS 4597.01 ANTHROP 3302 ANTHROP 3416 ANTHROP 3419 ANTHROP 5600 ANTHROP 5602 HISTORY 2100 HISTORY 2105 HISTORY 3100 HISTORY 3105 INTSTDS 2100 SPANISH 5640 LING 3501 POLITSC 3220 POLITSC 4240 PORTGSE 4597.02 PORTGSE 5650 SPANISH 2151 SPANISH 2380 SPANISH 4556 SPANISH 4560 SPANISH 4570 SPANISH 4580 SPANISH 5620 SPANISH 5660 HISTORY 2111 PORTGSE 2330 PORTGSE 2335 PORTGSE 2798.10 PORTGSE 4561 ENGLISH 4577.01 THEATRE 5771.02 GEOG 2100 COMPSTD 5797 SPANISH 2193 SPANISH 4193'),
    'animation': ('Animation', 15, 'https://artsandsciences.osu.edu/sites/default/files/2024-01/minor-animation.pdf', 'ART|DESIGN|ACCAD', [], 'ART 3009 ART 3101 ART 2200 DESIGN 5002 DESIGN 5104 ART 4101 ART 4401 ART 3001 ART 3004 ART 3107 ART 5001 CSE 3541 CSE 3902 CSE 5542 CSE 5546 DESIGN 4104 DESIGN 4154 THEATRE 2811 THEATRE 3111 THEATRE 3820 THEATRE 5331'),
    'anthropology': ('Anthropology', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-01/minor-anthropology.pdf', 'ANTHROP', ['anthropology', 'anthropological-sciences', 'forensic-anthropology', 'medical-anthropology'], 'ANTHROP 2201 ANTHROP 3401 ANTHROP 3350 ANTHROP 3420 ANTHROP 3434 ANTHROP 3451 ANTHROP 3452 ANTHROP 3554 ANTHROP 3555 ANTHROP 3604 ANTHROP 4597.03H ANTHROP 5505 ANTHROP 5603 ANTHROP 5604 ANTHROP 5606 ANTHROP 5614 ANTHROP 5651 ANTHROP 5684 ANTHROP 5685 ANTHROP 5686 ANTHROP 4034 ANTHROP 2202 ANTHROP 4525 ANTHROP 3027 ANTHROP 3050 ANTHROP 3302 ANTHROP 3334 ANTHROP 3340 ANTHROP 3416 ANTHROP 3418 ANTHROP 3419 ANTHROP 3597.01 ANTHROP 3597.02 ANTHROP 3623 ANTHROP 5600 ANTHROP 5601 ANTHROP 5602 ANTHROP 5615 ANTHROP 5620 ANTHROP 5624 ANTHROP 5625 ANTHROP 5626 ANTHROP 5627 ANTHROP 5645 ANTHROP 5650 ANTHROP 5700 ANTHROP 5701 ANTHROP 5702 ANTHROP 2200 ANTHROP 3300 ANTHROP 3301 ANTHROP 3304 ANTHROP 3409 ANTHROP 3410 ANTHROP 3411 ANTHROP 3500 ANTHROP 3504 ANTHROP 4597.04 ANTHROP 5607 ANTHROP 5608'),
    'arabic': ('Arabic', 14, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/arabic_minor_update_6-9-21.pdf', 'ARABIC|NELC', ['arabic'], 'NELC 4601'),
    'art-engineering-structure': ('Art: Engineering Structure', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-art-engineering-structure.pdf', 'ART', ['art'], ''),
    'arts-entrepreneurship': ('Arts Entrepreneurship', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-arts-entrepreneurship.pdf', 'ARTEDUC|ART|DESIGN|MUSIC|THEATRE|DANCE', ['arts-management'], 'BUSMHR 2500 BUSMHR 3510 ARTEDUC 3690'),
    'asian-american-studies': ('Asian American Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2024-09/minor-aas.pdf', 'ASAMSTS|COMPSTD|ENGLISH|HISTORY', [], 'WGSST 4921 ETHNSTD 2321 COMPSTD 4803 EALL 3446 ENGLISH 4587 WGSST 3612 PSYCH 3375 RELSTDS 3672 RELSTDS 5871 SOCIOL 2463 WGSST 2367.04 WGSST 2750 WGSST 3340 WGSST 4520 WGSST 4540 CHINESE 2231 CHINESE 2232 CHINESE 2451 CHINESE 4402 CHINESE 4403 CHINESE 4404 CHINESE 4405 CHINESE 4406 CHINESE 5400 EALL 3223 ETHNSTD 3605 HISTORY 2392 HISTORY 2401 HISTORY 3375 HISTORY 3376 HISTORY 3403 HISTORY 3404 HISTORY 3405 HISTORY 3410 HISTORY 3411 HISTORY 3425 HISTORY 3426 HISTORY 3580 HISTORY 3715 HISTART 2003 HISTART 3605 HISTART 4001 HISTART 4810 HISTART 4815 HISTART 4820 HISTART 4825 HISTART 5002 HISTART 5711 HISTART 5815 HISTART 5816 INTSTDS 2050 JAPANSE 2231 JAPANSE 2451 JAPANSE 2452 JAPANSE 4400 JAPANSE 5400 JAPANSE 5454 JAPANSE 5455 KOREAN 2231 KOREAN 2451'),
    'astronomy-and-astrophysics': ('Astronomy and Astrophysics', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/astronomyastrophysicsmn_updt_6-9-21.pdf', 'ASTRON', ['astronomy'], 'MATH 2162.01 MATH 4181H ASTRON 2291 ASTRON 2292 ASTRON 3350 ASTRON 3810 ASTRON 4810 EARTHSC 5205 ASTRON 5550 ASTRON 5681 ASTRON 5682 PHYSICS 2300 PHYSICS 3470'),
    'atmospheric-sciences': ('Atmospheric Sciences', 14, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-atmospheric-science.pdf', 'ATMOSSC|GEOG', ['atmospheric-sciences'], 'GEOG 5900 GEOG 3900 GEOG 3901H GEOG 5921 GEOG 2940 GEOG 5922 GEOG 5940 GEOG 5941 GEOG 2153 GEOG 5942 GEOG 5950 GEOG 5951 GEOG 5952 GEOG 2255'),
    'biochemistry': ('Biochemistry', 15, 'https://artsandsciences.osu.edu/sites/default/files/2025-08/minor-biochemistry.pdf', 'BIOCHEM|CHEM', ['biochemistry'], 'CHEM 2510 CHEM 2610 CHEM 2910H CHEM 2520 CHEM 2620 CHEM 2920H MATH 4181H'),
    'biology': ('Biology', 15, 'https://artsandsciences.osu.edu/sites/default/files/2024-07/minor-biology.pdf', 'BIOLOGY|EEOB|MOLGEN|MICRBIO|BIOCHEM', ['biology-forensic', 'biology-igb', 'biology-lse', 'biology-prehealth'], 'EEOB 2510 EEOB 2511 EEOB 2520 EEOB 3310 EEOB 3310.01 EEOB 3310.02 EEOB 3310.20 EEOB 3310.22 EEOB 3410 EEOB 4000 EEOB 4000.01 EEOB 4000.02 EEOB 4500 EEOB 4500E EEOB 2000 EEOB 3000'),
    'campaigns-and-elections': ('Campaigns and Elections', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-02/minor-campaigns-elections.pdf', 'POLITSC|COMM', ['political-science'], ''),
    'chemistry': ('Chemistry', 17, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-chemistry.pdf', 'CHEM', ['chemistry', 'biochemistry'], ''),
    'chinese': ('Chinese', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-08/minor-chinese.pdf', 'CHINESE|EALL', ['chinese'], ''),
    'classical-greek': ('Classical Greek', 15, 'https://artsandsciences.osu.edu/sites/default/files/2025-08/minor-classical-greek.pdf', 'GREEK|CLAS', ['classics-greek', 'classics-greek-latin'], ''),
    'classical-humanities': ('Classical Humanities', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-08/minor-classical-humanities.pdf', 'CLAS', ['classics-humanities'], ''),
    'cognitive-science': ('Cognitive Science', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-cognitive-science.pdf', 'PSYCH|LING|PHILOS|CSE|COGST', [], 'CSE 5531 CSE 5612 CSE 5830 CSE 4550 CSE 3313 CSE 3513 CSE 4501 CSE 5425 CSE 5614 CSE 5618 CSE 5870 CSE 5760 CSE 2309 CSE 3700 CSE 3310 CSE 3312 CSE 3550 CSE 4508 CSE 3321 CSE 3521 CSE 5321 CSE 5522 CSE 5526 CSE 5914 CSE 3802 CSE 5801 CSE 5608 CSE 2001 CSE 3701 CSE 4100 CSE 4200 CSE 4300 CSE 4400 CSE 5101 CSE 5201 CSE 5301 CSE 5401 CSE 5701 CSE 3371 CSE 4554 CSE 3330 CSE 4420 CSE 5460 CSE 3302 CSE 5309 CSE 5606 CSE 4440 CSE 2500 CSE 3600 CSE 3750 CSE 3800 CSE 5500 CSE 5600 CSE 5750 CSE 5840'),
    'communication': ('Communication', 12, 'https://artsandsciences.osu.edu/sites/default/files/2025-02/minor-communication.pdf', 'COMM', ['comm-scm', 'comm-cae', 'comm-tech', 'journalism'], ''),
    'communication-technology': ('Communication Technology', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-02/minor-comm-tech_0.pdf', 'COMM', ['comm-tech'], ''),
    'comparative-politics': ('Comparative Politics', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-10/minor-comparative-politics.pdf', 'POLITSC', ['political-science', 'world-politics'], ''),
    'comparative-studies': ('Comparative Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-comparative-studies.pdf', 'COMPSTD', ['comparative-studies'], ''),
    'creative-writing': ('Creative Writing', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-creative-writing.pdf', 'ENGLISH', ['english-cw'], ''),
    'criminology-and-criminal-justice-studies': ('Criminology and Criminal Justice Studies', 18, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-criminology.pdf', 'SOCIOL', ['criminology'], ''),
    'dance': ('Dance', 16, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-dance.pdf', 'DANCE', ['dance'], ''),
    'design-foundations': ('Design Foundations', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-design-foundations.pdf', 'DESIGN', ['design-ind', 'design-int', 'design-vcd', 'design-emd'], ''),
    'design-thinking': ('Design Thinking', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-design-thinking.pdf', 'DESIGN', ['design-ind', 'design-int', 'design-vcd', 'design-emd'], ''),
    'disability-studies': ('Disability Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-disability-studies.pdf', 'DSABLST|ENGLISH|SPHHRNG', [], 'ENGLISH 2277 SPHHRNG 4510 ANTHROP 3302 ANTHROP 4706 ANTHROP 5702 ASL 3350 ENGLISH 2367.06 ENGLISH 3031 ENGLISH 4410 ENGLISH 4597.01 GEOG 3702 HISTORY 4706 PHR 3540 PSYCH 3331 PSYCH 4571 PSYCH 5681 SOCIOL 2290 SOCIOL 4629 SOCIOL 5450 SOCWORK 5031S SPHHRNG 3350 SPHHRNG 4530 SPHHRNG 5605 SPHHRNG 5860 WGSST 2325 WGSST 2326 WGSST 5191'),
    'earth-sciences': ('Earth Sciences', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-08/minor-earth-sciences.pdf', 'EARTHSC', ['earth-sciences', 'earth-sciences-cwe', 'earth-sciences-geological', 'earth-sciences-geophysics'], ''),
    'east-asian-languages-and-literatures': ('East Asian Languages and Literatures', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-east-asian.pdf', 'CHINESE|JAPANSE|KOREAN|EALL', [], ''),
    'economics': ('Economics', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-economics.pdf', 'ECON', ['economics'], 'ECON 2001 ECON 2002 ECON 4001 ECON 4002 ECON 4400 ECON 3000 ECON 2001.01 ECON 2002.01 ECON 4001.01 ECON 4002.01 ECON 3400 ECON 4320 ECON 4998 ECON 4999 ECON 5193 ECON 4797.01'),
    'english': ('English', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-08/English%20Minor%20Advising%20Sheet%202023%5B84%5D.pdf', 'ENGLISH', ['english-lit', 'english-cw', 'english-wrl', 'english-preed'], ''),
    'entertainment-design-and-technology': ('Entertainment Design and Technology', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-entertainment-design.pdf', 'THEATRE', ['theatre'], 'THEATRE 2211 THEATRE 3241 THEATRE 3411 THEATRE 3511 THEATRE 3551 THEATRE 3611 THEATRE 5210 THEATRE 5225 THEATRE 5241 THEATRE 5305 THEATRE 5310 THEATRE 5321 THEATRE 5401 THEATRE 5403 THEATRE 5501 THEATRE 5603 THEATRE 2000 THEATRE 4000 THEATRE 3000 THEATRE 4191'),
    'environmental-arts-and-humanities': ('Environmental Arts and Humanities', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-12/minor-enviro-art-hum.pdf', 'ENGLISH|COMPSTD|HISTORY|ART|HISTART', [], 'ART 5101 CHINESE 4407 ENGLISH 5189S ENGLISH 3360 GEOG 3597.03 ENGLISH 4321 ENR 3470 SCANDVN 2310 GEOG 3800 GEOG 3801 HISTORY 2010 HISTORY 2040 HISTORY 2700 HISTORY 2702 HISTORY 2704 HISTORY 2710 HISTORY 2720 HISTORY 3700 HISTORY 3706 HISTORY 3715 HISTORY 3724 HISTORY 4705 LARCH 2367 LARCH 5610 LARCH 5620 PHILOS 2340 PHILOS 2342 PHILOS 2458 SOCIOL 3460 SPANISH 2332'),
    'evolution-and-ecology': ('Evolution and Ecology', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-evolution-ecology.pdf', 'EEOB', ['evolution-ecology'], 'EEOB 3310 EEOB 3320 EEOB 3410 EEOB 3310.01 EEOB 2210 EEOB 2220 EEOB 3420 EEOB 4210 EEOB 4220 EEOB 4230 EEOB 4240 EEOB 4410 EEOB 4420H EEOB 4430 EEOB 5310 EEOB 5320 EEOB 5410 EEOB 5420 EEOB 5430 EEOB 5450 EEOB 5460 EEOB 5470 EEOB 3000'),
    'film-studies': ('Film Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-12/minor-film-studies.pdf', 'FILMSTD|MVNGIMG', ['film-studies'], 'ENGLISH 2263 FILMSTD 2270 FILMSTD 2271 GERMAN 3351 HISTART 2901 WGSST 2317 AFAMAST 4571 CHINESE 4405 WGSST 2381 COMPSTD 3607 EALL 3446 ENGLISH 3378 ENGLISH 4578 FILMSTD 3660 FILMSTD 4194 FILMSTD 4580 FILMSTD 4640 FILMSTD 4650 GERMAN 4670H FILMSTD 4895 FRENCH 2801 FRENCH 5701 HISTART 3901 INTSTDS 3905 HISTART 5643 HISTART 5645 HISTART 5901 HISTART 5905 HISTART 5906 HISTART 5910 ITALIAN 2053 ITALIAN 2055 ITALIAN 2056 ITALIAN 4223 JAPANSE 4400 MUSIC 3344 RUSSIAN 3460 SLAVIC 3310 SLAVIC 3360 SPANISH 2380 SPANISH 4580 SPANISH 4581 WGSST 4527.01 WGSST 4527.02'),
    'folklore': ('Folklore', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-folklore.pdf', 'COMPSTD|ENGLISH', [], 'NELC 3700 NELC 2301 NELC 3350 NELC 3000 NELC 2013'),
    'forensic-science': ('Forensic Science', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-01/minor-forensic-science.pdf', 'ANTHROP|SOCIOL|CHEM|MOLGEN', ['forensic-anthropology'], 'ANTHROP 3305 ANTHROP 5607 ANTHROP 5610 ANTHROP 5644 PHR 2400 PSYCH 4485 SOCIOL 2209 ANTHROP 5608 ANTHROP 5609 ANTHROP 5686 CHEM 2210 CHEM 4870 CHEM 4880 CSE 4471 ENTMLGY 4000 MOLGEN 4500 MOLGEN 4606 MOLGEN 5607 MOLGEN 5608 MOLGEN 5650 PSYCH 4511 PSYCH 5684 SOCIOL 2210 SOCIOL 2310 SOCIOL 3410 SOCIOL 4507 SPHHRNG 3320 SPHHRNG 4420'),
    'french': ('French', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-07/minor-french.pdf', 'FRENCH', ['french', 'french-francophone'], 'FRENCH 2101 FRENCH 3101 FRENCH 3201 FRENCH 3202 FRENCH 3401 FRENCH 3402 FRENCH 3403 FRENCH 3501 FRENCH 3502 FRENCH 3503 FRENCH 3000 FRENCH 4000 FRENCH 2000 FRENCH 5000 FRENCH 4401 FRENCH 5401 FRENCH 5701 FRENCH 5702 FRENCH 5403 FRENCH 5201 FRENCH 5202 FRENCH 5203 FRENCH 5204 FRENCH 5205'),
    'game-studies': ('Game Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-game-studies.pdf', 'COMM|DESIGN|ENGLISH|ACCAD|CSE', [], 'ENGLISH 2463 COMM 3513 DESIGN 3104 ENGLISH 2367.08 ENGLISH 3364 MUSIC 2254 PHILOS 2455 COMM 3545 COMM 3554 COMM 4555 DESIGN 4104 DESIGN 4154 ART 5001 CSE 3541 CSE 5912'),
    'geographic-information-science': ('Geographic Information Science', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-01/gis-minor-sheet.pdf', 'GEOG', ['gis'], 'GEOG 5200 GEOG 5210 GEOG 5212 GEOG 5225 GEOG 4103 GEOG 5101 GEOG 5103 GEOG 5100 GEOG 5201 GEOG 5222 GEOG 5223 GEOG 5229'),
    'geography': ('Geography', 14, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-geography.pdf', 'GEOG', ['geography'], 'GEOG 2500 GEOG 2400 GEOG 2750 GEOG 3300 GEOG 3597.01 GEOG 3600 GEOG 3701 GEOG 3702 GEOG 3750 GEOG 5300 GEOG 5401 GEOG 5402 GEOG 5501 GEOG 5502 GEOG 5602 GEOG 5700 GEOG 2100 GEOG 3800 GEOG 3900 GEOG 5601 GEOG 2800 GEOG 3597.03 GEOG 3751 GEOG 3901 GEOG 3980 GEOG 5801 GEOG 5802 GEOG 2200 GEOG 3753 GEOG 5275 GEOG 2000 GEOG 4000 GEOG 3901H GEOG 2940 GEOG 2960 GEOG 5210 GEOG 5270 GEOG 5900'),
    'german': ('German', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-german.pdf', 'GERMAN', ['german'], ''),
    'globalization-studies': ('Globalization Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-06/minor-globalization-studies.pdf', 'INTSTDS', [], ''),
    'health-and-society': ('Health and Society', 18, 'https://artsandsciences.osu.edu/sites/default/files/2026-10/minor-health-society.pdf', 'SOCIOL', ['sociology'], 'SOCIOL 2202 SOCIOL 2210 SOCIOL 2300 SOCIOL 2309 SOCIOL 2310 SOCIOL 2320 SOCIOL 2330 SOCIOL 2340 SOCIOL 2345 SOCIOL 2367.01H SOCIOL 2367.02 SOCIOL 2367.03H SOCIOL 2370 SOCIOL 2391 SOCIOL 3200 SOCIOL 3302 SOCIOL 3306 SOCIOL 3315 SOCIOL 3380 SOCIOL 3410 SOCIOL 3430 SOCIOL 3434 SOCIOL 3435 SOCIOL 3460 SOCIOL 2463 SOCIOL 2463H SOCIOL 3464 SOCIOL 3467 SOCIOL 3487 SOCIOL 3488 SOCIOL 3549 SOCIOL 3597.01 SOCIOL 3597.02 SOCIOL 3630 SOCIOL 5629 SOCIOL 4000S SOCIOL 4505 SOCIOL 4506 SOCIOL 4508 SOCIOL 4509 SOCIOL 4511 SOCIOL 4591S SOCIOL 4609 SOCIOL 4610 SOCIOL 4635 SOCIOL 4650 SOCIOL 4655 SOCIOL 4666 SOCIOL 4998 SOCIOL 5503 SOCIOL 5605 SOCIOL 5680'),
    'health-environment-risk-and-science-communication': ('Health, Environment, Risk and Science Communication', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-herscom.pdf', 'COMM', [], ''),
    'hebrew': ('Hebrew', 13, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-hebrew.pdf', 'HEBREW', ['hebrew-jewish'], 'NELC 4601 NELC 5120 NELC 5121'),
    'hip-hop-studies': ('Hip Hop Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-07/minor-hip-hop.pdf', 'AFAMAST|MUSIC|DANCE|ENGLISH', [], 'MUSIC 3450 MUSIC 3354 MUSIC 2050 MUSIC 2288 MUSIC 3355 MUSIC 3460 MUSIC 2233 MUSIC 2271 MUSIC 5638'),
    'history': ('History', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-history.pdf', 'HISTORY', ['history'], ''),
    'history-art': ('History of Art', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-history-art.pdf', 'HISTART', ['history-of-art'], ''),
    'human-rights': ('Human Rights', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-06/minor-human-rights.pdf', 'INTSTDS|POLITSC|PHILOS|HISTORY', [], 'INTSTDS 3450 INTSTDS 4000 HISTORY 3083 COMPSTD 4597.02 ENGLISH 4573.02 ENGLISH 4597.01 ENGLISH 4554 WGSST 3370 CRPLAN 3500 COMM 4853.02 INTSTDS 5800 INTSTDS 3460 POLITSC 4455 POLITSC 4940 SOCIOL 3460 INTSTDS 5191'),
    'inequality-and-society': ('Inequality and Society', 18, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-inequality-society.pdf', 'SOCIOL', ['sociology'], 'SOCIOL 2210 SOCIOL 2290 SOCIOL 2300 SOCIOL 2309 SOCIOL 2310 SOCIOL 2320 SOCIOL 2330 SOCIOL 2340 SOCIOL 2345 SOCIOL 2367.01H SOCIOL 2367.02 SOCIOL 2367.03H SOCIOL 2370 SOCIOL 2391 SOCIOL 3200 SOCIOL 3302 SOCIOL 3315 SOCIOL 3380 SOCIOL 3410 SOCIOL 3430 SOCIOL 3434 SOCIOL 3435 SOCIOL 3460 SOCIOL 3464 SOCIOL 3467 SOCIOL 3487 SOCIOL 3488 SOCIOL 3549 SOCIOL 3597.01 SOCIOL 3597.02 SOCIOL 3630 SOCIOL 4000S SOCIOL 4505 SOCIOL 4506 SOCIOL 4508 SOCIOL 4509 SOCIOL 4510 SOCIOL 4511 SOCIOL 4591S SOCIOL 4609 SOCIOL 4610 SOCIOL 4635 SOCIOL 4650 SOCIOL 4655 SOCIOL 4666 SOCIOL 4998 SOCIOL 5450 SOCIOL 5503 SOCIOL 5563 SOCIOL 5605 SOCIOL 5629 SOCIOL 5680'),
    'information-security': ('Information Security', 16, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-information-security.pdf', 'INTSTDS|CSE', [], 'CSE 2501 CSE 3702 CSE 4471 CSE 3703 CSE 3332 CSE 5351 CSE 5473 CSE 3700 CSE 3701 CSE 5191 CSE 3801 CSE 3802 CSE 4000 CSE 5525 CSE 3000'),
    'international-studies': ('International Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-06/minor-international-studies.pdf', 'INTSTDS', [], ''),
    'islamic-studies': ('Islamic Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-islamic-studies.pdf', 'ISLAM|ARABIC|NELC|PERSIAN|TURKISH|HISTORY', ['islamic-studies'], 'NELC 3501 NELC 5701 NELC 4626 MEDREN 2514 MEDREN 3201 MEDREN 3204 MEDREN 3205 MEDREN 3502 MEDREN 3702 MEDREN 4597 MEDREN 5578 MEDREN 3355 MEDREN 2241 MEDREN 2798.01 MEDREN 2701 MEDREN 2702 MEDREN 3301 MEDREN 3601 MEDREN 3705 MEDREN 5701 MEDREN 5703 MEDREN 2350 MEDREN 2351 MEDREN 2352 MEDREN 2353 MEDREN 2375 MEDREN 3304 MEDREN 3351 MEDREN 3353 MEDREN 3365 MEDREN 2220 MEDREN 2244 MEDREN 3230 MEDREN 3620 MEDREN 3704 MEDREN 5204 MEDREN 5568 MEDREN 5645 MEDREN 5377 MEDREN 2102.02 MEDREN 2370 MEDREN 3972'),
    'italian': ('Italian', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-italian.pdf', 'ITALIAN', ['italian', 'italian-studies'], ''),
    'japanese': ('Japanese', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-japanese.pdf', 'JAPANSE', ['japanese'], ''),
    'jewish-oral-history': ('Jewish Oral History', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-jewish-oral-history.pdf', 'JEWSHST|HISTORY', [], 'NELC 4601 NELC 3111 NELC 4327 NELC 3371 NELC 3399 NELC 4721'),
    'jewish-studies': ('Jewish Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-jewish-studies.pdf', 'JEWSHST|HEBREW|YIDDISH|HISTORY', ['hebrew-jewish'], ''),
    'judicial-politics': ('Judicial Politics', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-judicial-politics.pdf', 'POLITSC', ['political-science'], ''),
    'korean': ('Korean', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-korean.pdf', 'KOREAN', ['korean'], ''),
    'latin': ('Latin', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/latin-minor-sheet.pdf', 'LATIN|CLAS', ['classics-latin', 'classics-greek-latin'], ''),
    'latinx-studies': ('Latinx Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2024-12/minor-latinx-studies.pdf', 'ETHNSTD|SPANISH|ENGLISH|COMPSTD', [], 'SPANISH 2242 SPANISH 3000 SPANISH 2000 ANTHROP 3416 ENGLISH 4588 ENGLISH 3364 ENGLISH 4581 ETHNSTD 3408 HISTART 3562 ETHNSTD 5890 SPANISH 2202 SPANISH 2213 SPANISH 2504 COMM 2704 SPANISH 3413 SPANISH 4542 SPANISH 4556 SPANISH 4557.10 SPANISH 4557.20 SPANISH 4558 SPANISH 4582 SPANISH 5640 SPANISH 5689S WGSST 4540 WGSST 4921 WGSST 3340 ETHNSTD 3572 HISTORY 2750 INTSTDS 4451 SPANISH 2389 SPANISH 5389 WGSST 4405 WGSST 4520 WGSST 4560'),
    'legal-foundations-society': ('Legal Foundations of Society', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-10/minor-legal-foundations-of-society.pdf', 'POLITSC|PHILOS|HISTORY|SOCIOL', [], 'AEDECON 3170 AFAMAST 4326 AFAMAST 4610 COMM 3404 ECON 4700 HISTORY 2015 HISTORY 3005 HISTORY 3006 PHILOS 2400 PHILOS 3410 PSYCH 4485 SOCIOL 2209 SOCIOL 4507 SOCIOL 4509 SOCIOL 4510 SOCIOL 4511 SOCIOL 4609 SOCIOL 4611 SOCIOL 4615 WGSST 3200'),
    'lgbtq': ('LGBTQ+', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-lgbtqplus.pdf', 'WGSST|COMPSTD|ENGLISH', [], ''),
    'linguistics': ('Linguistics', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-linguistics.pdf', 'LING', ['linguistics-a', 'linguistics-b'], 'LING 2000 LING 4100 LING 4200 LING 4300 LING 4350 LING 4400 LING 5000 LING 3701H LING 3801 LING 3802 LING 3802H LING 3803 LING 3901 LING 3902 LING 4052 LING 4602 LING 3000 LING 4000 LING 2000H LING 2001 LING 2051 LING 2051H LING 2501 LING 3191 LING 3501 LING 3502 LING 3601 LING 3603 LING 3605 LING 3606 LING 3606H LING 3701'),
    'mathematics': ('Mathematics', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/mathematics-minor.pdf', 'MATH', ['math-theoretical', 'math-applied-physics', 'math-applied-chemistry', 'math-biology', 'math-education', 'math-financial'], ''),
    'media-and-society': ('Media and Society', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-media-society.pdf', 'COMM', ['comm-cae'], ''),
    'media-production-and-analysis': ('Media Production and Analysis', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-media-production-analysis.pdf', 'COMM', [], 'COMM 4191 THEATRE 4191 THEATRE 5189 THEATRE 2700 COMM 2540 COMM 2223 THEATRE 3351 COMM 2321 COMM 3403 COMM 3405 COMM 3413 COMM 3414 COMM 3554 THEATRE 2000.03 THEATRE 3352 THEATRE 4000.03 THEATRE 5321 THEATRE 5322 THEATRE 5323 THEATRE 5331'),
    'medical-humanities': ('Medical Humanities', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-medical-humanities.pdf', 'ENGLISH|HISTORY|PHILOS|COMPSTD', [], 'WGSST 2325 WGSST 2326 WGSST 4189.01S WGSST 4410'),
    'medieval-and-renaissance-studies': ('Medieval and Renaissance Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-medieval-renaissance-studies.pdf', 'MEDREN|HISTORY|ENGLISH|HISTART|CLAS', [], 'NELC 5568 NELC 3111 NELC 3220 NELC 3230 NELC 5220 NELC 5230 NELC 4550 NELC 5510 NELC 5650 NELC 5051 NELC 5701 NELC 3350 NELC 5150 NELC 5251 NELC 2320 NELC 2321 NELC 4551 NELC 4555 NELC 4555E NELC 5680.02H NELC 5680.03H NELC 5611 NELC 2201 NELC 2201H NELC 2202 NELC 2202H NELC 3401 NELC 3405 NELC 5691 NELC 5957.01 NELC 5957.02 NELC 2201E NELC 2203 NELC 2205 NELC 2230 NELC 2231 NELC 2240 NELC 2250 NELC 2251 NELC 2280 NELC 2301 NELC 2351 NELC 2390 NELC 2391 NELC 2450 NELC 2451 NELC 3216 NELC 3222 NELC 3223 NELC 3225 NELC 3226 NELC 3228 NELC 3229 NELC 3235 NELC 3236 NELC 3239 NELC 3240 NELC 3241 NELC 3242 NELC 3245'),
    'microbiology': ('Microbiology', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-microbiology.pdf', 'MICRBIO', ['microbiology'], 'MICRBIO 4100 MICRBIO 4110 MICRBIO 4120 MICRBIO 4130 MICRBIO 4140 MICRBIO 2000 MICRBIO 2100 MICRBIO 3704 MICRBIO 4145 MICRBIO 4150 MICRBIO 4193 MICRBIO 4591S MICRBIO 5122 MICRBIO 5129 MICRBIO 5147 MICRBIO 5149 MICRBIO 5155 MICRBIO 5161 MICRBIO 5270 MICRBIO 5536 MICRBIO 5546 MICRBIO 4998 MICRBIO 4998H MICRBIO 4999 MICRBIO 4999H MICRBIO 4000'),
    'modern-greek': ('Modern Greek', 12, 'https://artsandsciences.osu.edu/sites/default/files/2025-08/minor-modern-greek.pdf', 'MDRNGRK', ['modern-greek'], 'MDRNGRK 2000 MDRNGRK 2001 MDRNGRK 2680 MDRNGRK 3710 MDRNGRK 4001 MDRNGRK 2100 MDRNGRK 2240 MDRNGRK 4002 MDRNGRK 4998 MDRNGRK 4999 MDRNGRK 5000 MDRNGRK 5010 MDRNGRK 5193 MDRNGRK 5194 MDRNGRK 5797'),
    'molecular-genetics': ('Molecular Genetics', 14, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-molecular-genetics.pdf', 'MOLGEN', ['molecular-genetics'], 'MOLGEN 4998 MOLGEN 4998H MOLGEN 4999 MOLGEN 4999H MOLGEN 5193'),
    'music': ('Music', 12, 'https://artsandsciences.osu.edu/sites/default/files/2024-04/minor-music.pdf', 'MUSIC', ['music', 'music-cs', 'music-sonic', 'music-business'], ''),
    'music-media-and-enterprise': ('Music, Media and Enterprise', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-music-media-enterprise.pdf', 'MUSIC', [], 'MUSIC 2220 MUSIC 2250 MUSIC 2251 MUSIC 2252 MUSIC 2253 MUSIC 2288 MUSIC 3348 MUSIC 3349 MUSIC 3431 MUSIC 3432 MUSIC 5638 MUSIC 5639 MUSIC 3000'),
    'musical-theatre': ('Musical Theatre', 18, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-musical-theatre.pdf', 'THEATRE|MUSIC|DANCE', [], 'THEATRE 2811 THEATRE 3831 DANCE 3401 THEATRE 4821 THEATRE 5771.05 MUSIC 2021 MUSIC 2216.21 DANCE 2102 DANCE 2103 DANCE 2112 DANCE 2113 DANCE 2142 DANCE 2143 DANCE 2162 DANCE 2152 DANCE 2181 DANCE 5105 DANCE 5115 DANCE 5190'),
    'neuroscience': ('Neuroscience', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-neuroscience_0.pdf', 'NEUROSC|PSYCH|NRO', ['neuroscience-molecular', 'neuroscience-systems', 'neuroscience-cognitive'], 'CSE 5526 EEOB 4550 EEOB 3010 EEOB 3050 EEOB 5644 EEOB 3513 EEOB 4305 EEOB 4501 EEOB 4623 EEOB 4644 EEOB 5600 EEOB 5606 EEOB 5613H EEOB 5614 EEOB 5898 EEOB 4511 EEOB 4500 EEOB 3341H EEOB 2013'),
    'organizational-communication': ('Organizational Communication', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-organizational-communication.pdf', 'COMM', [], ''),
    'peace-studies': ('Peace Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-international-conflict-peace-studies.pdf', 'INTSTDS|COMM|POLITSC', [], 'INTSTDS 2800 INTSTDS 4000 COMM 3330 POLITSC 3460 POLITSC 4282 POLITSC 4330 POLITSC 4455 INTSTDS 4801 INTSTDS 4803 INTSTDS 5191 POLITSC 4320 POLITSC 4331 PUBAFRS 2150 PUBAFRS 3140'),
    'persian': ('Persian', 13, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-persian.pdf', 'PERSIAN|NELC', [], 'NELC 2241 NELC 2244 NELC 3204 NELC 3205 NELC 3501 NELC 3502 NELC 3702 NELC 3704 INTSTDS 5645'),
    'philosophy': ('Philosophy', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-07/minor-philosophy.pdf', 'PHILOS', ['philosophy'], ''),
    'physics': ('Physics', 14, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-physics.pdf', 'PHYSICS', ['physics'], ''),
    'plant-cellular-and-molecular-biology': ('Plant Cellular and Molecular Biology', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-plant-cellular-molecular-biology.pdf', 'MOLGEN|EEOB', [], 'MOLGEN 4503 MOLGEN 4998 MOLGEN 4998H MOLGEN 5193 MOLGEN 5194 MOLGEN 5601 MOLGEN 5602 MOLGEN 4999 MOLGEN 4999H'),
    'political-decision-making': ('Political Decision Making', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-political-decision-making.pdf', 'POLITSC', ['political-science'], ''),
    'political-science': ('Political Science', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-political-science.pdf', 'POLITSC', ['political-science'], ''),
    'political-theory': ('Political Theory', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-political-theory.pdf', 'POLITSC', ['political-science'], ''),
    'popular-culture-studies': ('Popular Culture Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-pop-culture.pdf', 'ENGLISH|COMPSTD|FILMSTD', [], 'COMPSTD 2264 WGSST 2230 COMPSTD 3686 COMPSTD 5957.01 COMPSTD 5957.02 COMPSTD 4577.01 COMPSTD 4577.02 COMPSTD 2256 MEDREN 2666 MEDREN 4217 MEDREN 4504 MEDREN 2253 MEDREN 5646 MEDREN 2367.01 AFAMAST 2270 AFAMAST 2285 AFAMAST 3450 AFAMAST 4571 AFAMAST 3334 AFAMAST 4406 AFAMAST 2321 COMPSTD 2322 COMPSTD 2360 COMPSTD 2152 COMPSTD 2270 COMPSTD 4597.01 COMPSTD 2251 COMPSTD 2901 COMPSTD 2680 COMPSTD 2253 COMPSTD 3364 RELSTDS 3679 RELSTDS 2335.01 RELSTDS 3460 RELSTDS 3470 RELSTDS 3480 RELSTDS 3490 RELSTDS 2230 RELSTDS 2365.01 RELSTDS 3310 RELSTDS 3360 WGSST 4375 WGSST 2550 WGSST 3413 WGSST 3440 WGSST 3513 WGSST 4554 COMPSTD 2281 COMPSTD 3678 COMPSTD 2372 COMPSTD 2374 COMPSTD 2375 COMPSTD 3474 COMPSTD 3401 COMPSTD 2263 COMPSTD 2463 COMPSTD 2464 COMPSTD 5664 COMPSTD 2271 COMPSTD 3801'),
    'portuguese': ('Portuguese', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-portuguese.pdf', 'PORTGSE', [], 'PORTGSE 5501 PORTGSE 3401 PORTGSE 3402 PORTGSE 3403 PORTGSE 3450 PORTGSE 4000 PORTGSE 4193 PORTGSE 4194 PORTGSE 4510 PORTGSE 4550 PORTGSE 4560 PORTGSE 4561 PORTGSE 4595 PORTGSE 4606 PORTGSE 4998H PORTGSE 4999 PORTGSE 5191 PORTGSE 5510 PORTGSE 5520 PORTGSE 5530 PORTGSE 5611 PORTGSE 5650 PORTGSE 5797'),
    'professional-writing': ('Professional Writing', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-professional-writing.pdf', 'ENGLISH', ['english-wrl'], ''),
    'psychology': ('Psychology', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-psych.pdf', 'PSYCH', ['psychology'], ''),
    'public-health-and-arts': ('Public Health and the Arts', 12, 'https://artsandsciences.osu.edu/sites/default/files/2024-01/minor-public-health-arts.pdf', 'ART|ARTEDUC|PUBHLTH', [], 'PUBHLTH 2010 ART 2000 ARTEDUC 2367.01 ARTEDUC 2600 ARTEDUC 2550 DANCE 3401 ART 3009 DANCE 2121 DESIGN 3105 DANCE 5177 DESIGN 3305 DESIGN 3505 ENGLISH 2367.07S ENGLISH 2269 ENGLISH 2267 ENGLISH 2276 MUSIC 3010 SPANISH 2208.22 THEATRE 2811 THEATRE 3921S THEATRE 5922S WGSST 2326S ARTEDUC 5670 ARTEDUC 5687 DANCE 3402 ENGLISH 2367.06 ENGLISH 3361 ENGLISH 4321 ENGLISH 4554 ENGLISH 4573.02 ENGLISH 4597.01 FRIT 2061 FRIT 3052 FRIT 3053 FRIT 3054 HISTART 5632 HTHRHSC 2530 ITALIAN 2051 ITALIAN 2053 ITALIAN 3051 MUSIC 2250 SPANISH 2389 SPANISH 4582 SPANISH 4515 SPANISH 4516 SPANISH 5461 SPANISH 5201 SPANISH 5202 THEATRE 2367.02 WGSST 2340 WGSST 2230 WGSST 2317'),
    'quantitative-economics': ('Quantitative Economics', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-quantitative-economics.pdf', 'ECON|MATH|STAT', ['economics'], ''),
    'religious-studies': ('Religious Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-religious-studies.pdf', 'RELSTDS|COMPSTD', ['religious-studies'], ''),
    'russian': ('Russian', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-russian.pdf', 'RUSSIAN|SLAVIC', ['russian'], ''),
    'scandinavian-studies': ('Scandinavian Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-scandinavian-studies.pdf', 'SCANDVN|SWEDISH|GERMAN', [], ''),
    'science-and-technology-studies': ('Science and Technology Studies', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-science-and-technology-studies.pdf', 'COMPSTD|HISTORY|PHILOS', [], 'COMPSTD 2340 COMPSTD 3007 COMPSTD 4456 COMPSTD 4597.01 COMPSTD 4645 WGSST 4845 HISTORY 2701 HISTORY 3711 HISTORY 3712 PHILOS 2660 RELSTDS 2670 PHILOS 3650 SOCIOL 3302 AEDECON 4320 AEDECON 4597.01 PHILOS 3440 ANTHROP 5614 ART 5001 ART 5101 COMM 3545 COMM 3554 COMM 4555 COMPSTD 2104 COMPSTD 2367.04 COMPSTD 2420 COMPSTD 3646 COMPSTD 4420 ENGLISH 2269 ENGLISH 3372 ENGLISH 4569 ENR 2300 ENR 3470 WGSST 3530 HISTORY 2700 HISTORY 2702 HISTORY 2704 HISTORY 2720 HISTORY 3700 HISTORY 3715 INTSTDS 4320 INTSTDS 4597.01 MEDREN 2610 PHILOS 2338 PHILOS 2340 PHILOS 2342 PHILOS 3680 PHILOS 5650 PHYSICS 2367 RURLSOC 5500 SOCIOL 3460 WGSST 2900 WGSST 3306'),
    'screenwriting': ('Screenwriting', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-screenwriting.pdf', 'FILMSTD|THEATRE|ENGLISH', [], 'ENGLISH 2263 FILMSTD 2270 FILMSTD 2271 HISTART 2901 ENGLISH 2220 ENGLISH 2261 ENGLISH 2262 ENGLISH 2265 ENGLISH 2268 ENGLISH 2269 ENGLISH 4559 THEATRE 3731 FILMSTD 4800 FILMSTD 4880 FILMSTD 4881 FILMSTD 4890 THEATRE 5331'),
    'slavic-and-east-european': ('Slavic and East European', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-slavic-east-european.pdf', 'SLAVIC|RUSSIAN|BCS|CZECH|POLISH', ['russian'], ''),
    'sociology': ('Sociology', 15, 'https://artsandsciences.osu.edu/sites/default/files/2024-01/minor-sociology.pdf', 'SOCIOL', ['sociology'], 'SOCIOL 2202 SOCIOL 2210 SOCIOL 2290 SOCIOL 2300 SOCIOL 2309 SOCIOL 2310 SOCIOL 2320 SOCIOL 2330 SOCIOL 2340 SOCIOL 2345 SOCIOL 2367.01H SOCIOL 2367.02 SOCIOL 2367.03H SOCIOL 2370 SOCIOL 2391 SOCIOL 3200 SOCIOL 3302 SOCIOL 3306 SOCIOL 3315 SOCIOL 3380 SOCIOL 3410 SOCIOL 3430 SOCIOL 3434 SOCIOL 3435 SOCIOL 3460 SOCIOL 2463 SOCIOL 2463H SOCIOL 3464 SOCIOL 3467 SOCIOL 3549 SOCIOL 3597.01 SOCIOL 3597.02 SOCIOL 3630 SOCIOL 4000S SOCIOL 4505 SOCIOL 4506 SOCIOL 4508 SOCIOL 4509 SOCIOL 4511 SOCIOL 4591S SOCIOL 4606 SOCIOL 4607 SOCIOL 4608 SOCIOL 4609 SOCIOL 4610 SOCIOL 4635 SOCIOL 4650 SOCIOL 4655 SOCIOL 4666 SOCIOL 4998 SOCIOL 5450 SOCIOL 5503 SOCIOL 5605 SOCIOL 5629 SOCIOL 5680 SOCIOL 3487 SOCIOL 3488'),
    'somali-language-and-culture': ('Somali Language and Culture', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-somali.pdf', 'SOMALI|AFAMAST', [], ''),
    'south-asia-studies': ('South Asia Studies', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-south-asia-studies.pdf', 'SASIA|HINDI|URDU|NELC', [], 'SASIA 3220 SASIA 2220 SASIA 2000 SASIA 3025 SASIA 2230 SASIA 3625 SASIA 3630S SASIA 5241 RELSTDS 2370 SASIA 3671 RELSTDS 3673 EALL 3223 HISTORY 2392 HISTORY 2393 HISTORY 2675 HISTORY 3365 PHILOS 2120 RELSTDS 2102.01 ETHNSTD 2321 ENGLISH 4581 ENGLISH 4583'),
    'spanish': ('Spanish', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-spanish.pdf', 'SPANISH', ['spanish'], 'SPANISH 2202 SPANISH 2213 SPANISH 3401 SPANISH 3403 SPANISH 3413 SPANISH 3450 SPANISH 4551 SPANISH 4552 SPANISH 4555 SPANISH 4556 SPANISH 4557.10 SPANISH 4557.20 SPANISH 4558 SPANISH 4560 SPANISH 4561 SPANISH 4564 SPANISH 4565H SPANISH 4567 SPANISH 4568 SPANISH 4570 SPANISH 4580 SPANISH 4581 SPANISH 4595.02 SPANISH 4595.03 SPANISH 4798.10 SPANISH 5104 SPANISH 5191 SPANISH 5201 SPANISH 5202 SPANISH 5203 SPANISH 5389 SPANISH 5620 SPANISH 5689S SPANISH 3404 SPANISH 4430 SPANISH 4532 SPANISH 4534 SPANISH 4536 SPANISH 4537 SPANISH 4538 SPANISH 4595.01 SPANISH 4610 SPANISH 4689S PORTGSE 5611 PORTGSE 3401 PORTGSE 5502 PORTGSE 4193 PORTGSE 4194 PORTGSE 4998 PORTGSE 4999 PORTGSE 5797'),
    'spanish-business': ('Spanish for Business', 15, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-spanish-for-business.pdf', 'SPANISH', ['spanish'], 'SPANISH 2202 SPANISH 2213 SPANISH 2506 SPANISH 3401 SPANISH 3403 SPANISH 3413 SPANISH 3406 SPANISH 4606'),
    'spanish-honors': ('Spanish Honors', 15, 'https://artsandsciences.osu.edu/sites/default/files/2024-09/minor-spanish-honors.pdf', 'SPANISH', ['spanish'], 'SPANISH 2202 SPANISH 2213 SPANISH 3401 SPANISH 3403 SPANISH 3413 SPANISH 3450H SPANISH 4000 SPANISH 5000 SPANISH 4430 SPANISH 4532 SPANISH 4534 SPANISH 4536 SPANISH 4537 SPANISH 4538 SPANISH 4542 SPANISH 4551 SPANISH 4552 SPANISH 4555 SPANISH 4556 SPANISH 4557.10 SPANISH 4557.20 SPANISH 4558 SPANISH 4560 SPANISH 4561 SPANISH 4564 SPANISH 4565H SPANISH 4567 SPANISH 4568 SPANISH 4570 SPANISH 4580 SPANISH 4581 SPANISH 4595.02 SPANISH 4595.03 SPANISH 4606 SPANISH 4610 SPANISH 4689S SPANISH 5104 SPANISH 5191 SPANISH 5201 SPANISH 5202 SPANISH 5203 SPANISH 5389 SPANISH 5620 SPANISH 5689S SPANISH 4193 SPANISH 4194 SPANISH 4998 SPANISH 4999 SPANISH 5797'),
    'speech-and-hearing-science': ('Speech and Hearing Science', 14, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-speech-hearing.pdf', 'SPHHRNG', ['speech-hearing'], ''),
    'statistics': ('Statistics', 13, 'https://artsandsciences.osu.edu/sites/default/files/2022-07/minor-statistics.pdf', 'STAT', ['statistics', 'data-analytics-bph', 'data-analytics-ban', 'data-analytics-can'], ''),
    'studio-art': ('Studio Art', 12, 'https://artsandsciences.osu.edu/sites/default/files/2024-10/minor-studio-art.pdf', 'ART', ['art'], ''),
    'swahili-language-and-culture': ('Swahili Language and Culture', 15, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-swahili.pdf', 'SWAHILI|AFAMAST', [], ''),
    'theatre': ('Theatre', 12, 'https://artsandsciences.osu.edu/sites/default/files/2023-05/minor-theatre.pdf', 'THEATRE', ['theatre'], ''),
    'turkish-and-central-asian-studies': ('Turkish and Central Asian Studies', 13, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-turkish-central-asian-studies.pdf', 'TURKISH|UZBEK|NELC', [], 'NELC 5204 NELC 2102 NELC 3001 NELC 3102 NELC 2701 NELC 2241 NELC 3350 NELC 5377 NELC 2352 NELC 2375 NELC 2244 NELC 3204 NELC 3205 NELC 3501 NELC 3502 NELC 3702 NELC 3704 NELC 3375 NELC 3376 NELC 3365 NELC 5645'),
    'video-arts': ('Video Arts', 15, 'https://artsandsciences.osu.edu/sites/default/files/2024-03/minor-video-arts.pdf', 'THEATRE|MVNGIMG|ART', ['moving-image-production'], ''),
    'voice-acting': ('Voice Acting', 15, 'https://artsandsciences.osu.edu/sites/default/files/2023-03/minor-voice-acting.pdf', 'THEATRE', [], 'THEATRE 2811 THEATRE 3820 THEATRE 3241 THEATRE 3351 THEATRE 3821 THEATRE 2000 THEATRE 2000.02 THEATRE 3352 THEATRE 3812 THEATRE 3813 THEATRE 3814 THEATRE 3815 THEATRE 3825 THEATRE 3831 THEATRE 4000.02 THEATRE 4000.08 THEATRE 4100 THEATRE 4191 THEATRE 4821'),
    'women-gender-and-public-policy': ('Women, Gender and Public Policy', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-womens-gender-public-policy.pdf', 'WGSST|PUBAFRS|POLITSC', [], 'PUBAFRS 2110 WGSST 2550 WGSST 2325 WGSST 2350 WGSST 3200 WGSST 3300.01S WGSST 3302 WGSST 3370 WGSST 4189.01S WGSST 4402 WGSST 4404 WGSST 4524 WGSST 4525 COMPSTD 4921 COMPSTD 5240 PUBAFRS 5250 ECON 2001 SLAVIC 5450 PUBAFRS 2120 PUBAFRS 2130 PUBAFRS 2150 WGSST 2326 PUBAFRS 3000 PUBAFRS 3140 WGSST 3385 PUBAFRS 3500 PUBAFRS 4010 PUBAFRS 4020 POLITSC 4138 PUBAFRS 4191 WGSST 3191 PUBAFRS 5591 PUBAFRS 2020'),
    'womens-gender-and-sexuality-studies': ("Women's, Gender and Sexuality Studies", 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-wgss_0.pdf', 'WGSST', ['wgss'], ''),
    'world-literatures': ('World Literatures', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-world-literatures_0.pdf', 'COMPSTD|ENGLISH', ['world-literatures'], 'COMPSTD 3302 COMPSTD 3903 COMPSTD 2101 COMPSTD 2103 COMPSTD 2104 COMPSTD 2105 COMPSTD 2367.08 COMPSTD 3603 COMPSTD 3604 COMPSTD 3606 COMPSTD 3607 COMPSTD 3608 COMPSTD 4597.03 COMPSTD 4803 COMPSTD 4805 COMPSTD 4809 AFAMAST 2251 AFAMAST 2253 AFAMAST 2281 AFAMAST 2367.01 AFAMAST 3451 AFAMAST 4460 AFAMAST 4551 ENGLISH 4582 ARABIC 2701 ARABIC 2705 COMPSTD 3301 ARABIC 3501 CHINESE 2451 CHINESE 4401 CHINESE 4402 CHINESE 4403 CHINESE 4404 CHINESE 4407 CHINESE 5400 CLAS 3101 CLAS 3103 CLAS 3104 CLAS 5101 ENGLISH 4583 ENGLISH 4586 ENGLISH 4589 ENGLISH 4597.01 ENGLISH 4597.02 COMPSTD 4804 FRENCH 2501 GERMAN 2251 GERMAN 2254 GERMAN 2367 GERMAN 3252 GERMAN 4250 GERMAN 4252 HEBREW 2700 HEBREW 2701 HEBREW 2702 HEBREW 2705 ITALIAN 2051 ITALIAN 2052 ITALIAN 2054 JAPANSE 2451'),
    'world-politics': ('World Politics', 12, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-world-politics.pdf', 'POLITSC', ['world-politics', 'political-science'], ''),
    'yiddish': ('Yiddish', 12, 'https://artsandsciences.osu.edu/sites/default/files/2026-11/minor-yiddish.pdf', 'YIDDISH|GERMAN', [], ''),
    'zoology': ('Zoology', 14, 'https://artsandsciences.osu.edu/sites/default/files/2022-01/minor-zoology.pdf', 'EEOB', ['zoology'], 'EEOB 3310 EEOB 3410 EEOB 4500 EEOB 3310.01 EEOB 2510 EEOB 3320 EEOB 4510 EEOB 4520'),
}

ASC_MINOR_RULES = ("12-18 credit hours at the 2000 level or above, at least 6 upper-division; C- or better in each course and a 2.00 GPA "
                   "across the minor; no Pass/Non-Pass, at most 3 hours of X193 and 3 of S/U; up to 6 hours of transfer/exam credit; up "
                   "to two courses may overlap the GE (one if the minor has fewer than four courses). The minor must be in a different "
                   "subject than the major and have 12 hours that don't overlap the major or other minors. Declare it at least one term "
                   "before graduating.")


def asc_minors():
    by_base = {}
    for p in MAJORS:
        base = re.sub(r"-(ba|bs|bfa|bm|bme|bsd|bae)$", "", p["id"][4:])
        by_base.setdefault(base, []).append(p["id"])
    out = []
    for slug, (name, credits, sheet, subjects, excl, codes) in ASC_MINOR_SHEETS.items():
        listed = cs("; ".join(codes.split(" ")[i] + " " + codes.split(" ")[i + 1] for i in range(0, len(codes.split(" ")) - 1, 2))) if codes else []
        out.append({
            "catalog": "Arts and Sciences minor advising sheets (2026)", "id": "minor-asc-" + slug, "kind": "minor",
            "name": f"{name} Minor", "min_total_credits": credits, "min_gpa": 2.0, "source_url": sheet,
            "excluded_programs": [i for base in excl for i in by_base.get(base, [])],
            "notes": f"{credits} credit hours. Required courses, groups and caps are on the official advising sheet: {sheet} "
                     + ASC_MINOR_RULES,
            "groups": [group(f"masc-{slug}", f"{name} minor courses ({credits} hours, 6 upper-division)", "choose_credits", listed,
                             min_credits=credits, code_pattern=upper(subjects, 2000, 5999),
                             notes="Courses listed on the sheet, or other 2000+ courses in the minor's subjects (confirm electives "
                                   "with the minor advisor).")],
        })
    return out


# ---------- Special programs ----------
# College-wide programs have no parent degree and adjustments.colleges = [COLLEGE]: every ASC degree can join them
# (src/lib/requirements.ts specialProgramsFor). Programs tied to one major name it in requires_programs (warning only).
HONORS_URL = "https://aschonors.osu.edu/au22-or-later-honors-requirements"
ASC_ONLY = {"colleges": [COLLEGE]}
HONORS_COURSE = r"^[A-Z]+ [1-5]\d{3}(\.\d{2})?[HE]$"


def majors_named(prefix):
    return [p["id"] for p in MAJORS if p["id"].startswith(prefix)]


SPECIAL_PROGRAMS = [
    {
        "id": "sp-asc-honors", "kind": "special", "name": "Arts and Sciences Honors Program", "parent_id": None, "min_gpa": 3.4,
        "catalog": "ASC Honors, entered Autumn 2022 or later", "entry_from": "autumn-2022", "source_url": HONORS_URL,
        "adjustments": ASC_ONLY,
        "notes": "Graduate 'with Honors in the Arts and Sciences': all degree requirements, a 3.4 cumulative GPA, the honors "
                 "coursework, and an approved Honors Project. Submit the yearly benchmark survey to stay in the program. Arts "
                 "majors (Art, Art Education, Dance, Design, Music, Theatre, Arts Management, Film, History of Art, Moving-Image "
                 "Production) follow the Arts Honors version.",
        "groups": [
            req("asch-survey", "ASC Honors survey course", [course("ARTSSCI 1100.01H", grade=None,
                notes="Waived if you joined the Honors Program after your first semester.")]),
            hours("asch-coursework", "Honors coursework (18 hours)", 18, pattern=HONORS_COURSE, grade=None,
                  notes="Honors (H), honors-embedded (E), or honors-quality courses; transfer credit counts, AP/IB doesn't. Up to "
                        "two can overlap your major and one your minor. GE Theme courses must be honors or honors-quality (4-credit "
                        "Theme courses count)."),
            manual("asch-breadth", "Honors disciplinary breadth",
                   "One honors or honors-quality course in each of Natural & Mathematical Sciences, Arts & Humanities, and Social & "
                   "Behavioral Sciences (ASC Honors Disciplinary Breadth Guide)."),
            manual("asch-portfolio", "Honors ePortfolio", "An honors-enhanced ePortfolio (waived for GE Legacy students)."),
            manual("asch-project", "Honors Project",
                   "An approved, defended project by your fourth year: a thesis (4999H, which also earns Honors Research "
                   "Distinction), research experience, internship, service-learning, study abroad, or creative project."),
            manual("asch-gpa", "Honors GPA", "Keep a 3.4 cumulative GPA (some majors expect more, e.g. a 3.5 major GPA)."),
        ],
    },
    {
        "id": "sp-asc-honors-pre22", "version_of": "sp-asc-honors", "kind": "special", "name": "Arts and Sciences Honors Program",
        "parent_id": None, "min_gpa": 3.4, "catalog": "ASC Honors, entered before Autumn 2022 (Honors contract)",
        "entry_through": "summer-2022", "source_url": "https://aschonors.osu.edu/honors-curriculum", "adjustments": ASC_ONLY,
        "notes": "Pre-Autumn 2022 honors students follow the Honors contract and the Pre-AU22 Honors requirements; confirm with an "
                 "ASC Honors advisor.",
        "groups": [manual("ascho-contract", "Honors contract", "Complete the honors coursework and project in your approved Honors "
                                                               "contract, with a 3.4 cumulative GPA.")],
    },
    {
        "id": "sp-asc-research-distinction", "kind": "special", "name": "Graduation with Research Distinction (ASC)",
        "parent_id": None, "min_gpa": 3.0, "catalog": "ASC Research Distinction (current)", "adjustments": ASC_ONLY,
        "source_url": "https://artsandsciences.osu.edu/sites/default/files/2023-02/thesis_application_for_research_distinction_fillable_6.pdf",
        "notes": "Open to any ASC student (honors students earn Honors Research Distinction with 4999H). Apply with the thesis "
                 "application signed by your faculty advisor; you need 60 graded Ohio State hours and a 3.0 cumulative GPA by "
                 "graduation (3.4 for Honors Research Distinction).",
        "groups": [
            hours("ard-research", "Thesis research (at least 4 hours)", 4, pattern=r"^[A-Z]+ 4999(\.\d{2})?H?$", grade=None,
                  notes="Your department's 4999 (or 4999H) thesis course."),
            manual("ard-thesis", "Thesis and oral defense", "A thesis approved by your advisor and an oral exam with at least one "
                                                            "outside reader; submit it to the Knowledge Bank."),
        ],
    },
    {
        "id": "sp-asc-scholars", "kind": "special", "name": "Arts and Sciences Scholars Program", "parent_id": None,
        "catalog": "Ohio State Scholars in Arts and Sciences (current)", "adjustments": ASC_ONLY,
        "source_url": "https://honors-scholars.osu.edu/scholars",
        "notes": "Living-learning Scholars programs (Arts, Biological Sciences, Humanities, International Affairs, Law and Society, "
                 "STEM Exploration & Engagement). Program activities and the second-year commitment are set by each program.",
        "groups": [pick("scho-seminar", "Scholars seminar (first year)", 1, "ARTSSCI 1120.01 1120.02 1120.03 1120.04 1120.05 1120.06",
                        grade=None)],
    },
    {
        "id": "sp-asc-bsba-dual", "kind": "special", "name": "Dual degree: Arts and Sciences BA/BS + Fisher BSBA", "parent_id": None,
        "catalog": "Combined BA or BS and BSBA (current)", "adjustments": ASC_ONLY, "source_url": GEL_URL,
        "notes": "File a dual-degree petition with an ASC advisor as soon as you're admitted to Fisher. You need at least 30 hours "
                 "beyond the 121 for one degree (151+), 18 of them ASC upper-division, and must finish both colleges' requirements. "
                 "Two 3-hour Theme courses (or one 4-5 hour Theme course) can overlap a major. BuckAI checks your ASC degree here; "
                 "check the BSBA side by picking the Fisher BSBA as your degree in My classes.",
        "groups": [
            manual("dual-petition", "Dual-degree petition", "Approved at least a semester before graduation, with a major program form."),
            manual("dual-bsba", "Fisher BSBA requirements", "Business Foundation, Business Core, advanced writing, and a "
                                                            "specialization (see the Fisher BSBA in BuckAI)."),
            manual("dual-hours", "151 total hours", "30 hours beyond 121, including 18 ASC upper-division hours."),
        ],
    },
    {
        "id": "sp-asc-prehealth", "kind": "special", "name": "Pre-health prerequisites (pre-med, pre-dental, pre-PA, pre-vet)",
        "parent_id": None, "catalog": "Typical health-professional school prerequisites (current)",
        "source_url": "https://artsandsciences.osu.edu/academics/current-students/pre-professional",
        "notes": "Not a major: the courses most medical, dental, PA, optometry, pharmacy and veterinary schools expect. Schools differ; "
                 "check each school's list and meet with a pre-health advisor. Most count toward ASC science majors too.",
        "groups": [
            req("ph-bio", "Biology", "BIOLOGY 1113/1113H 1114/1114H", grade="C"),
            req("ph-chem", "General and organic chemistry with labs", "CHEM 1210/1610/1910H 1220/1620/1920H 2510/2610/2910H "
                "2520/2620/2920H 2540 2550", grade="C"),
            req("ph-phys", "Physics", "PHYSICS 1200/1250 1201/1251", grade="C"),
            req("ph-biochem", "Biochemistry", "BIOCHEM 4511/5613", grade="C"),
            pick("ph-quant", "Math and statistics", 2, "MATH 1150/1151; STAT 1450/2480/2450", grade="C"),
            pick("ph-social", "Behavioral science (MCAT)", 2, "PSYCH 1100/1100H; SOCIOL 1101/1101H", grade="C"),
        ],
    },
]

for _prefix, _deg, _name, _url, _note in (
    ("asc-microbiology-bs", "Microbiology", "Combined BS/MS in Microbiology", "https://microbiology.osu.edu/undergraduate-program",
     "Apply as a junior; graduate courses taken as an undergraduate count toward both degrees."),
    ("asc-molecular-genetics-bs", "Molecular Genetics", "Combined BS/MS in Molecular Genetics", "https://molgen.osu.edu/majors",
     "Apply as a junior; includes a research thesis."),
    ("asc-math-", "Mathematics", "Combined BS/MS in Mathematics (or Actuarial Science)", "https://math.osu.edu/undergrad",
     "Strong math and actuarial science majors can start MS courses as seniors."),
    ("asc-history-ba", "History", "Combined BA/MA in History", "https://history.osu.edu/undergrad/major",
     "Apply in the junior year; up to 12 graduate hours count toward both degrees."),
    ("asc-chinese-ba", "Chinese", "Combined BA/MA in Chinese", "https://deall.osu.edu/programs/undergrad/chinese",
     "For advanced Chinese students; apply through DEALL."),
):
    SPECIAL_PROGRAMS.append({
        "id": "sp-asc-combined-" + _deg.lower().replace(" ", "-"),
        "kind": "special", "name": _name, "parent_id": None, "adjustments": ASC_ONLY, "min_gpa": 3.0,
        "catalog": f"{_name} (current)", "source_url": _url, "requires_programs": majors_named(_prefix),
        "notes": _note + " Usually needs a 3.0+ GPA and admission to the graduate program; confirm with the department.",
        "groups": [manual("comb-" + _prefix.split("-")[1], "Graduate courses counted toward both degrees",
                          "Your department's approved graduate courses, taken after admission to the combined program.")],
    })


# ---------- Build ----------
MINORS = asc_minors()

PROGRAMS = [p for did in DEGREES for p in degree(did)] + MAJORS + SPECIAL_PROGRAMS


def main():
    scope = sys.argv[1] if len(sys.argv) > 1 else "degree"
    if scope == "degree":
        print(build(PROGRAMS, scope, 400, college=COLLEGE, script="asc_requirements.py", catalog=CATALOG, offerings={}))
    elif scope == "minors":
        print(build(MINORS, scope, 500, college=COLLEGE, script="asc_requirements.py", catalog=CATALOG, offerings={}))
    else:
        sys.exit("usage: asc_requirements.py degree|minors")


if __name__ == "__main__":
    main()
