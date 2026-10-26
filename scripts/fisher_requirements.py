"""Fisher BSBA curriculum (enrollment Spring 2027 and prior) as seed data.

Source pages (read October 2026):
  https://fisher.osu.edu/undergraduate/academics/curriculum-requirements
  https://fisher.osu.edu/undergraduate/academics/specializations/<name>

Edit the data below, then run:
  python3 scripts/fisher_requirements.py > supabase/migrations/<timestamp>_seed_fisher_requirements.sql
and apply that file to Supabase. It replaces all curriculum rows.
"""

CATALOG = "Fisher BSBA, enrollment Spring 2027 and prior"
SPEC_URL = "https://fisher.osu.edu/undergraduate/academics/specializations/"

# Prerequisite shorthand used by most 3000+ level courses
UPPER = "BUSMHR 2292; ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321"


def c(code, title, credits, prereqs=None, **kw):
    return {"code": code, "title": title, "credits": credits, "prerequisites": prereqs, **kw}


def group(gid, title, kind, courses=(), **kw):
    return {"id": gid, "title": title, "kind": kind, "courses": list(courses), **kw}


PROGRAMS = [
    {
        "id": "fisher-bsba",
        "kind": "degree",
        "name": "Bachelor of Science in Business Administration (BSBA)",
        "min_total_credits": 121,
        "min_gpa": 2.0,
        "notes": "Minimum 121 credit hours and a 2.0 cumulative GPA in the specialization. General Education totals 32-39 credit hours; "
        "business foundation courses also count toward GE Writing, Math & Quantitative Reasoning, and Social & Behavioral Sciences. "
        "Requirements change for students who begin in Autumn 2027 or later.",
        "source_url": "https://fisher.osu.edu/undergraduate/academics/curriculum-requirements",
        "groups": [
            group("bsba-foundation", "Business Foundation", "all", [
                c("ENGLISH 1110", "First-Year English Composition", 3, "EDUTL 1902 or Placement Level 4", min_grade="C"),
                c("MATH 1131", "Calculus for Business (or MATH 1151 Calculus I)", 5, "MATH 1130, 1148, or 1150, or Placement Level L",
                  min_grade="C", alternates=["MATH 1151"], equivalents=["MATH 1161", "MATH 1181H"]),
                c("STAT 1430", "Statistics for Business", 4, "MATH 1131/1151",
                  equivalents=["STAT 1450", "STAT 2450"],
                  notes="Other intro statistics credit (for example by AP exam) may substitute. Confirm with your advisor."),
                c("ECON 2001", "Principles of Microeconomics", 3, None),
                c("ECON 2002", "Principles of Macroeconomics", 3, None),
                c("CSE 2111", "Modeling and Problem Solving with Spreadsheets and Databases", 3, "MATH placement L and/or MATH 1130 or above"),
                c("ACCTMIS 2200", "Introduction to Accounting I (Financial)", 3, "ECON 2001"),
                c("ACCTMIS 2300", "Introduction to Accounting II (Managerial)", 3, "ECON 2001; ACCTMIS 2200"),
                c("BUSOBA 2320", "Statistical Techniques", 3, "ECON 2001; MATH 1131/1151; CSE 2111; STAT 1430; prereq/concur ECON 2002"),
                c("BUSOBA 2321", "Business Analytics", 1.5, "ECON 2001; ECON 2002; MATH 1131/1151; CSE 2111"),
            ], notes="Students must earn a C or higher in ENGLISH 1110 and calculus."),
            group("bsba-adv-writing", "Advanced Writing", "choose_courses", [
                c("ECON 2367.01", "Economics Advanced Writing", 3, "ENGLISH 1110"),
                c("ECON 2367.02", "Economics Advanced Writing", 3, "ENGLISH 1110"),
                c("ENGLISH 2367.01", "Language, Identity, Culture: The U.S. Experience", 3, "ENGLISH 1110"),
                c("ENGLISH 2367.01H", "Language, Identity, Culture (Honors)", 3, "ENGLISH 1110"),
                c("ENGLISH 2367.02", "Writing about Literature in the U.S. Experience", 3, "ENGLISH 1110"),
                c("ENGLISH 2367.04", "The U.S. Folk Experience", 3, "ENGLISH 1110"),
                c("ENGLISH 3304", "Business and Professional Writing", 3, "ENGLISH 1110"),
                c("ENGLISH 3305", "Technical Writing", 3, "ENGLISH 1110"),
                c("POLITSC 2367", "Contemporary Issues in American Politics", 3, "ENGLISH 1110"),
            ], min_courses=1),
            group("bsba-core", "Business Core", "all", [
                c("BUSMHR 2292", "Business Skills & Environment", 3, "ENGLISH 1110 & admission to business major"),
                c("BUSMHR 2000", "Introduction to International Business", 1.5, "ECON 2001; ECON 2002"),
                c("BUSFIN 3500", "Legal Environment of Business", 1.5, "Sophomore standing"),
                c("BUSML 3380", "Logistics Management", 1.5, "ECON 2001; ECON 2002"),
                c("BUSFIN 3220", "Business Finance", 3, "ECON 2001; ECON 2002; ACCTMIS 2200; prereq/concur ACCTMIS 2300"),
                c("BUSOBA 3230", "Introduction to Operations Management", 3, "ECON 2001; ECON 2002; STAT 1430"),
                c("BUSML 3250", "Marketing Management", 3, "ECON 2001; ECON 2002"),
                c("BUSMHR 3200", "Organizational Behavior", 3, "ECON 2001; ECON 2002"),
                c("BUSMHR 4490", "Strategic Management", 3,
                  "BUSMHR 2000, 2292, 3200; BUSOBA 2320, 2321, 3230; BUSFIN 3500, 3220; BUSML 3250, 3380; Senior standing"),
            ]),
            group("bsba-ge-bookends", "GE Launch Seminar & Reflection", "all", [
                c("GENED 1201", "GE Launch Seminar", 1, None),
                c("GENED 4001", "GE Reflection", 1, None),
            ]),
            # GE categories that business foundation courses already cover: ENGLISH 1110 (Writing & Information
            # Literacy), calculus/STAT/CSE 2111 (Math & Quantitative Reasoning), ECON 2001/2002 (Social & Behavioral).
            # The rest are student choice from Ohio State's GE course lists, so they're confirmed by hand.
            group("ge-arts", "GE Foundation: Literary, Visual & Performing Arts", "manual", min_credits=3,
                  notes="Student choice from the Ohio State GE list."),
            group("ge-history", "GE Foundation: Historical & Cultural Studies", "manual", min_credits=3,
                  notes="Student choice from the Ohio State GE list."),
            group("ge-natsci", "GE Foundation: Natural Science", "manual", min_credits=4,
                  notes="4-5 credit hours, student choice from the Ohio State GE list."),
            group("ge-diversity", "GE Foundation: Race, Ethnic & Gender Diversity", "manual", min_credits=3,
                  notes="Student choice from the Ohio State GE list."),
            group("ge-theme-citizenship", "GE Theme: Citizenship for a Diverse & Just World", "manual", min_credits=4,
                  notes="Required theme. One 4-credit course or two 3-credit courses."),
            group("ge-theme-choice", "GE Theme: Student Choice", "manual", min_credits=4,
                  notes="Any second GE Theme. One 4-credit course or two 3-credit courses."),
        ],
    },
    {
        "id": "spec-accounting", "kind": "specialization", "name": "Accounting", "source_url": SPEC_URL + "accounting",
        "groups": [
            group("acct-req", "Required", "all", [
                c("BUSFIN 4510", "Legal Business Issues", 1.5, "BUSFIN 3500 or concurrent; BUSMHR 2292"),
                c("ACCTMIS 3200", "Financial Accounting I", 3, UPPER),
                c("ACCTMIS 3300", "Cost Accounting", 3, UPPER),
                c("ACCTMIS 3201", "Financial Accounting II", 3, "ACCTMIS 3200"),
                c("ACCTMIS 3400", "Tax Accounting I", 3, "ACCTMIS 3200"),
                c("ACCTMIS 3600", "Introduction to Accounting Information Systems", 3, "ACCTMIS 3200"),
                c("ACCTMIS 4200", "Advanced Financial Accounting", 3, "ACCTMIS 3201"),
                c("ACCTMIS 4500", "Auditing Principles & Procedures", 3, "ACCTMIS 3200"),
                c("ECON 4001", "Intermediate Microeconomics (4001.01/.02/.03)", 3, "ECON 2001; ECON 2002"),
            ]),
            group("acct-elec", "Electives (3 credit hours)", "choose_credits", [
                c("ACCTMIS 4210", "Topics in Financial Accounting", 3, "ACCTMIS 3201"),
                c("ACCTMIS 4220", "Government & Non-Profit Accounting", 3, "ACCTMIS 2200; BUSMHR 2292"),
                c("ACCTMIS 4310", "Topics in Management Accounting", 3, "ACCTMIS 3300"),
                c("ACCTMIS 4410", "Tax Accounting II", 3, "ACCTMIS 3400"),
                c("ACCTMIS 4510", "Fraud Examination", 3, "ACCTMIS 3201; ACCTMIS 3600"),
                c("ACCTMIS 4550", "Advanced Assurance Services", 3, "ACCTMIS 4500"),
                c("ACCTMIS 4640", "Accounting Data Analytics", 3, "ACCTMIS 3200"),
                c("ACCTMIS 4680", "Information Technology Security, Audit and Controls", 3, "ACCTMIS 3600 or 3620"),
                c("ACCTMIS 4784", "Tax Research Seminar", 3, "ACCTMIS 3400"),
                c("ACCTMIS 4780", "Accounting Research & Practice", 3, "Permission of instructor"),
            ], min_credits=3),
        ],
    },
    {
        "id": "spec-aviation-management", "kind": "specialization", "name": "Aviation Management",
        "source_url": SPEC_URL + "aviation-management",
        "notes": "Offered with the Center for Aviation Studies. Students in this track can't enroll in the Professional Pilot Certification.",
        "groups": [
            group("avi-req", "Required", "all", [
                c("AVIATION 2000", "Introduction to Aviation Industry", 3, None),
                c("AVIATION 2200", "Aviation Communications", 3, "AVIATION 2000; AVIATION 2100 or 2150"),
                c("AVIATION 3000", "Aviation Management & Marketing", 3, "AVIATION 2000; AVIATION 2100 or 2150; AVIATION 2200; admitted to specialization"),
                c("AVIATION 3200", "Aviation Regulations", 3, "AVIATION 3000; admitted to specialization"),
                c("AVIATION 3600", "Business and Corporate Aviation Management", None, "AVIATION 3000; admitted to specialization",
                  notes="Credit hours not listed on Fisher's page."),
                c("AVIATION 4000", "Air Transportation Analysis I", 3, "AVIATION 3000; admitted to specialization"),
                c("AVIATION 5000", "Air Transportation Analysis II", 3, "AVIATION 4000; admitted to specialization"),
            ]),
            group("avi-flight", "Flight Fundamentals (choose one)", "choose_courses", [
                c("AVIATION 2100", "Private Pilot Fundamentals", 5, None),
                c("AVIATION 2150", "Introduction to Flight Operations", None, None, notes="Credit hours not listed on Fisher's page."),
            ], min_courses=1),
        ],
    },
    {
        "id": "spec-business-management", "kind": "specialization", "name": "Business Management (regional campuses)",
        "source_url": SPEC_URL + "business-management",
        "notes": "Offered on regional campuses. Columbus students follow the prerequisites on each course's own specialization sheet.",
        "groups": [
            group("bm-req", "Required", "all", [
                c("ACCTMIS 3300", "Cost Accounting", 3, UPPER, notes="Autumn only"),
                c("ACCTMIS 3601", "Introduction to Business Information Systems", 1.5, UPPER, notes="Autumn only"),
                c("BUSFIN 4200", "Applications in Finance", 3, UPPER + "; BUSFIN 3220", notes="Spring only"),
                c("BUSMHR 4324", "Staffing: Concepts and Competencies for Acquiring Talent", 3, UPPER + "; BUSMHR 3200", notes="Spring only"),
                c("BUSOBA 4250", "Six Sigma Principles", 3, UPPER + "; BUSOBA 3230", notes="Autumn only"),
                c("BUSML 4206", "Strategic Marketing Decisions", 3, UPPER + "; BUSML 3250", notes="Autumn only"),
                c("BUSML 4380", "Advanced Logistics Management", 1.5, UPPER + "; BUSML 3380", notes="Spring only"),
            ]),
        ],
    },
    {
        "id": "spec-economics", "kind": "specialization", "name": "Economics", "source_url": SPEC_URL + "economics",
        "notes": "Economics students must earn a C- or higher in ECON 2001 and ECON 2002.",
        "groups": [
            group("econ-micro", "Intermediate Microeconomic Theory (choose one)", "choose_courses", [
                c("ECON 4001.01", "Intermediate Microeconomic Theory", 3, "ECON 2001; ECON 2002"),
                c("ECON 4001.02", "Intermediate Microeconomic Theory (calculus-based)", 3, "ECON 2001; ECON 2002; MATH 1131 or 1151 or 1152 or 1161"),
                c("ECON 4001.03", "Intermediate Microeconomic Theory (advanced calculus-based)", 3, "ECON 2001; ECON 2002; MATH 1131 or 1151 or 1152 or 1161"),
            ], min_courses=1),
            group("econ-macro", "Intermediate Macroeconomic Theory (choose one)", "choose_courses", [
                c("ECON 4002.01", "Intermediate Macroeconomic Theory", 3, "ECON 2001; ECON 2002"),
                c("ECON 4002.02", "Intermediate Macroeconomic Theory (calculus-based)", 3, "ECON 2001; ECON 2002; MATH 1131 or 1151 or 1152 or 1161"),
                c("ECON 4002.03", "Intermediate Macroeconomic Theory (advanced calculus-based)", 3, "ECON 2001; ECON 2002; MATH 1131 or 1151 or 1152 or 1161"),
            ], min_courses=1),
            group("econ-elec", "Economics Electives (12 credit hours, 4000-5000 level)", "choose_credits",
                  min_credits=12, code_pattern=r"^ECON [45]\d{3}",
                  exclude_codes=["ECON 4191", "ECON 4998", "ECON 4998H", "ECON 4999", "ECON 4999H", "ECON 5193"],
                  notes="Any ECON 4000- or 5000-level course except ECON 4191, 4998(H), 4999(H), and 5193."),
        ],
    },
    {
        "id": "spec-finance", "kind": "specialization", "name": "Finance", "source_url": SPEC_URL + "finance",
        "groups": [
            group("fin-req", "Required", "all", [
                c("BUSFIN 4211", "Corporate Finance", 3, "ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3220"),
                c("BUSFIN 4221", "Investments", 3, "ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3220"),
                c("BUSFIN 4201", "Financial Data", 1.5, "ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3220"),
                c("BUSFIN 4250", "Global Finance", 1.5, "ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3220"),
            ]),
            group("fin-adv", "Advanced Course (choose one)", "choose_courses", [
                c("BUSFIN 4219", "Advanced Corporate Finance", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4229", "Options & Futures", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4239", "Risk Management", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4255", "International Finance", 3, "BUSFIN 4211, 4221, 4250 (or concurrent)"),
            ], min_courses=1, notes="Fisher lists these under 'Advanced courses' in the required section; read here as choose one."),
            group("fin-elec", "Electives (9 credit hours)", "choose_credits", [
                c("BUSFIN 4213", "Corporate Restructuring and Bankruptcy", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4215", "Entrepreneurial Finance", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4216", "Private Equity", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4217", "Private Financing: VC & PE", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4218", "Fixed Income Securities", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4223", "Fixed Income", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4224", "Behavioral Finance", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4225", "Investment Strategies & Philosophies", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4226", "Finance Consulting & Business", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4227", "Trading & Markets", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4228", "Stock Market: Student Investment Management", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4234", "FinTech", 1.5, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4235", "Applied Fundamental Investing", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4236", "Capital Markets", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4237", "Short Selling", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4238", "Intro to Debt Valuation & Strategy", 3, "BUSFIN 4211; BUSFIN 4221"),
                c("BUSFIN 4255", "International Finance", 3, "BUSFIN 4211, 4221, 4250 (or concurrent)"),
                c("BUSFIN 4265", "Financial Institutions", 3, "BUSFIN 4211 and 4221 (or concurrent)"),
                c("BUSFIN 3300", "Principles of Insurance", 3, "ECON 2001.01; ECON 2002.01; BUSMHR 2292", notes="No priority; waitlist"),
                c("BUSFIN 4310", "Commercial Property and Casualty Insurance", 3, "BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3300", notes="No priority; waitlist"),
                c("BUSFIN 4311", "Personal Insurance", 3, "BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3300", notes="No priority; waitlist"),
                c("BUSFIN 4510", "Legal Business Issues", 1.5, "BUSMHR 2292; ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSFIN 3500 or concurrent", notes="No priority; waitlist"),
                c("ACCTMIS 3200", "Financial Accounting I", 3, UPPER, is_secondary=True),
                c("BUSFIN 3400", "Introduction to Real Estate", 3, "ECON 2001.01; ECON 2002.01; BUSMHR 2292", is_secondary=True),
                c("BUSFIN 4410", "Real Estate Finance", 3, "BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSFIN 3400 or Finance specialization", is_secondary=True),
                c("BUSFIN 5402", "Real Estate Valuation", 3, "BUSFIN 4211 and 4221; or BUSFIN 3400 and Real Estate major/minor", is_secondary=True),
                c("ECON 4001.01", "Intermediate Microeconomics", 3, "ECON 2001.01; ECON 2002.01", is_secondary=True),
                c("ECON 4002.01", "Intermediate Macroeconomics", 3, "ECON 2001.01; ECON 2002.01", is_secondary=True),
            ], min_credits=9, max_secondary_credits=3,
                notes="At most 3 credit hours may come from the non-finance list (ACCTMIS 3200, BUSFIN 3400/4410/5402, ECON 4001.01/4002.01)."),
        ],
    },
    {
        "id": "spec-human-resources", "kind": "specialization", "name": "Human Resources", "source_url": SPEC_URL + "human-resources",
        "groups": [
            group("hr-req", "Required", "all", [
                c("BUSMHR 4320", "Human Resource Management in a Market Economy", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4322", "Human Resource Learning: Training & Development", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4326", "Compensation & Benefits Administration", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4330", "Strategic Human Resource Management", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4323", "Human Resource Practices & the Law", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4324", "Staffing: Concepts & Competencies for Acquiring Talent", 3, UPPER + "; BUSMHR 3200; BUSMHR 4323"),
            ]),
            group("hr-elec", "Elective (choose one)", "choose_courses", [
                c("BUSMHR 3303", "Human Resources Analytics", 3, "ENGLISH 1110"),
                c("BUSMHR 3543", "Franchising", 3, "BUSMHR 2500 or BUSMHR 3200"),
                c("BUSMHR 4321", "International Labor & Human Resource Management", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4221", "Concepts & Competencies for Managing People", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4328", "Performance Management", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4325", "Labor Relations & Collective Bargaining", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4520E", "Leading High Performance Ventures", 3, None),
            ], min_courses=1),
        ],
    },
    {
        "id": "spec-information-systems", "kind": "specialization", "name": "Information Systems", "source_url": SPEC_URL + "information-systems",
        "groups": [
            group("is-req", "Required", "all", [
                c("CSE 1223", "Introduction to Computer Programming in Java", 3, None),
                c("MATH 2366", "Discrete Mathematics", 2, "C- or better in MATH 1131, 1151, 1161.xx, or 1181H"),
                c("CSE 2123", "Data Structures Using Java", 3, "CSE 1223"),
                c("CSE 3241", "Introduction to Database Systems", 3, "MATH 2366; CSE 2123"),
                c("CSE 3232", "Software Requirements Analysis", 3, "CSE 3241"),
                c("ACCTMIS 3620", "Foundations of Information Systems", 3, UPPER + "; CSE 1223"),
                c("ACCTMIS 4630", "Business Systems Application Development", 3, UPPER + "; CSE 2123"),
            ]),
            group("is-elec", "Electives (6 credit hours)", "choose_credits", [
                c("ACCTMIS 4670", "Information Systems Planning & Management", 3, UPPER + "; CSE 2123"),
                c("ACCTMIS 4620", "Analysis & Design of Management Information Systems", 3, UPPER + "; CSE 3232"),
                c("ACCTMIS 4650", "Decision Support & Expert Systems", 3, UPPER + "; CSE 3232"),
                c("ACCTMIS 4660", "Electronic Commerce", 3, UPPER + "; ACCTMIS 3610 or CSE 3241"),
                c("ACCTMIS 4680", "Information Technology Security, Audit and Controls", 3, "ACCTMIS 3620 or 3600"),
                c("ACCTMIS 4610", "Topics in Information Systems", 3, UPPER + "; ACCTMIS 3620; CSE 2123"),
                c("BUSOBA 4331", "Business Analytics: Data Management and Descriptive Analytics", 3, "MATH 1131/1151; ECON 2001.01; ECON 2002.01; CSE 2111"),
            ], min_credits=6),
        ],
    },
    {
        "id": "spec-international-business", "kind": "specialization", "name": "International Business", "source_url": SPEC_URL + "international-business",
        "groups": [
            group("ib-req", "Required", "all", [
                c("BUSMHR 4000", "Advanced Topics in International Business", 3, UPPER + "; BUSMHR 2000", notes="Autumn only"),
                c("BUSMHR 4020", "Cross-Cultural Management", 3, "BUSMHR 4000", notes="Spring only"),
            ]),
            group("ib-elec", "Electives (9 credit hours)", "choose_credits", [
                c("BUSMHR 3543", "Franchising", 3, "BUSMHR 2500 or BUSMHR 3200"),
                c("BUSFIN 3250", "Foundations of International Finance", 3, UPPER + "; BUSFIN 3220"),
                c("BUSMHR 4021", "Institutions of the International Business Environment", 3, "BUSMHR 4000"),
                c("BUSMHR 4321", "International Labor & Human Resource Management", 3, UPPER + "; BUSMHR 3200"),
                c("BUSMHR 4570", "Establishing Import-Export Firms", 3, "BUSMHR 2000 and permission of instructor; requires an application"),
                c("BUSOBA 4237", "International Operations Management", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4263", "Global Sourcing", 3, UPPER + "; BUSOBA 3230"),
                c("BUSML 4254", "International Marketing", 3, UPPER + "; BUSML 3250"),
            ], min_credits=9),
            group("ib-experience", "International Experience", "manual",
                  notes="Study abroad, an international internship, or another qualifying experience through Fisher's Office of Global Business."),
        ],
    },
    {
        "id": "spec-logistics-management", "kind": "specialization", "name": "Logistics Management", "source_url": SPEC_URL + "logistics-management",
        "groups": [
            group("log-req", "Required", "all", [
                c("BUSML 4380", "Advanced Logistics Management", 1.5, UPPER + "; BUSML 3380"),
                c("BUSML 4381", "Logistics Execution I", 3, UPPER + "; BUSML 3380", alternates=["BUSML 5381"]),
                c("BUSML 4382", "Logistics and Supply Chain Analytics", 3, UPPER + "; BUSML 3380"),
                c("BUSML 4383", "Supply Chain Management", 1.5, UPPER + "; BUSML 3380"),
            ]),
            group("log-elec", "Electives (6 credit hours)", "choose_credits", [
                c("BUSML 4384", "Supply Chain Management Tools", 1.5, "BUSML 4383"),
                c("BUSML 4385", "Building a Sustainable Supply Chain", 1.5, UPPER + "; BUSML 3380"),
                c("BUSML 4386", "Logistics and Supply Chain Technology", 1.5, UPPER + "; BUSML 3380"),
                c("BUSML 4387", "Lean Logistics", 1.5, "BUSML 4380"),
                c("BUSML 4388", "Logistics Execution II", 1.5, "BUSML 4381 or 5381"),
                c("BUSML 4389", "Logistics Technology & Application II: ERP Systems", 1.5, UPPER + "; BUSML 3380"),
                c("BUSML 5389", "Logistics and Supply Chain Decision Making", 3, "BUSML 4380 or concurrent"),
                c("ACCTMIS 3300", "Cost Accounting", 3, UPPER, is_secondary=True, notes="No priority; waitlist"),
                c("BUSML 4201", "Consumer Behavior", 3, UPPER + "; BUSML 3250", is_secondary=True, notes="No priority; waitlist"),
                c("BUSFIN 4211", "Corporate Finance", 3, UPPER + "; BUSFIN 3220", is_secondary=True, notes="No priority; waitlist"),
                c("BUSMHR 4221", "Concepts & Competencies for Managing People", 3, UPPER + "; BUSMHR 3200", is_secondary=True, notes="No priority; waitlist"),
                c("BUSOBA 4232", "Operations Planning & Control", 3, UPPER + "; BUSOBA 3230", is_secondary=True, notes="No priority; waitlist"),
            ], min_credits=6, max_secondary_credits=3,
                notes="At most 3 credit hours may come from the non-logistics list."),
        ],
    },
    {
        "id": "spec-marketing", "kind": "specialization", "name": "Marketing", "source_url": SPEC_URL + "marketing",
        "groups": [
            group("mkt-req", "Required", "all", [
                c("BUSML 4201", "Consumer Behavior", 3, "ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSML 3250"),
                c("BUSML 4202", "Marketing Research", 3, "ACCTMIS 2200; ACCTMIS 2300; BUSOBA 2320; BUSOBA 2321; BUSMHR 2292; BUSML 3250"),
                c("BUSML 4203", "Marketing Strategy", 1.5, "BUSML 4201; BUSML 4202",
                  notes="Fisher's page lists the title without a code; BUSML 4203 per Fisher faculty course listings."),
                c("BUSML 4204", "Marketing Projects", 3, "BUSML 4201; BUSML 4202",
                  notes="Fisher's page lists the title without a code; BUSML 4204 per Fisher faculty course listings."),
            ]),
            group("mkt-elec", "Electives (6 credit hours)", "choose_credits", [
                c("BUSML 4210", "Advanced Market Research", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4211", "Market Analysis & Forecasting", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4212", "Customer Relationship Management", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4222", "Services Marketing", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4223", "Foundations of Sales & Sales Management", 3, "BUSML 4201; BUSML 4202"),
                c("BUSML 4224", "Strategic Sales Leadership", 3, "BUSML 4223"),
                c("BUSML 4230", "Advertising Management", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4231", "Promotional Strategy", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4232", "Digital Marketing", 3, "BUSML 4201; BUSML 4202"),
                c("BUSML 4233", "Advertising & Promotional Strategy", 3, "BUSML 4201; BUSML 4202"),
                c("BUSML 4240", "New Product Management", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4241", "Entrepreneurial Marketing", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4251", "Retail Management", 3, "BUSML 4201; BUSML 4202"),
                c("BUSML 4252", "Social Marketing & Public Policy", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4253", "Global Marketing", 1.5, "BUSML 4201; BUSML 4202"),
                c("BUSML 4254", "International Marketing", 3, UPPER + "; BUSML 3250"),
                c("BUSML 4255", "Sustainability Marketing for Consumers, Firms and Society", 3, "BUSML 3250 or AEDECON 3102"),
                c("BUSML 4256", "Brand Management", 3, "BUSML 4201; BUSML 4202"),
                c("BUSML 4258", "eCommerce Digital Advertising", 1.5, "BUSML 3250; BUSML 4232 or 4233 (or concurrent)"),
                c("BUSML 4259", "Entertainment Marketing", 3, "BUSML 3250"),
                c("BUSML 4260", "Pricing Strategy and Analysis", 3, "BUSMHR 2292; BUSML 4201; BUSML 4202"),
                c("BUSML 4383", "Supply Chain Management", 1.5, UPPER + "; BUSML 3380", notes="No priority; waitlist"),
                c("BUSML 4382", "Logistics Analytics", 3, UPPER + "; BUSML 3380", notes="No priority; waitlist"),
                c("BUSML 5389", "Logistics Decision Making", 3, "BUSML 4380; BUSML 4382 or concurrent", notes="No priority; waitlist"),
            ], min_credits=6),
        ],
    },
]

OPS_ELECTIVES_COMMON = [
    c("BUSOBA 4251", "Six Sigma Projects", 3, "BUSOBA 4250"),
    c("BUSOBA 4233", "Operations Management Analytics", 3, UPPER + "; BUSOBA 3230"),
    c("BUSOBA 4253", "Sustainable Operations", 3, UPPER + "; BUSOBA 3230"),
    c("BUSOBA 4237", "International Operations Management", 3, UPPER + "; BUSOBA 3230"),
    c("BUSOBA 4234", "Service Operations", 3, UPPER + "; BUSOBA 3230"),
    c("BUSOBA 4240", "Management of Technology", 3, UPPER + "; BUSOBA 3230"),
    c("BUSADM 2798", "Study Tour: Operations Global Lab", 1.5, "Minimum rank 2; minimum GPA 3.0; application required"),
    c("BUSML 4380", "Advanced Logistics Management", 1.5, UPPER + "; BUSML 3380", notes="No priority; waitlist"),
    c("BUSML 4383", "Supply Chain Management", 1.5, UPPER + "; BUSML 3380", notes="No priority; waitlist"),
    c("BUSMHR 4221", "Concepts & Competencies for Managing People", 3, UPPER + "; BUSMHR 3200", notes="No priority; waitlist"),
]

PROGRAMS += [
    {
        "id": "spec-operations-management", "kind": "specialization", "name": "Operations Management (Operations track)",
        "source_url": SPEC_URL + "operations-management",
        "groups": [
            group("ops-req", "Required", "all", [
                c("BUSOBA 4250", "Six Sigma Principles", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4232", "Operations Planning & Control", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4239", "Managing Process Improvement", 3, UPPER + "; BUSOBA 3230"),
            ]),
            group("ops-elec", "Electives (6 credit hours)", "choose_credits", OPS_ELECTIVES_COMMON + [
                c("BUSOBA 4254", "Projects in Sustainable Supply Chains", 3, "Prereq or concur: BUSOBA 3230 or BUSML 3380"),
                c("BUSOBA 4261", "Purchasing & Supply Chain Management", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4262", "Purchasing Strategy", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4263", "Global Sourcing", 3, UPPER + "; BUSOBA 3230"),
            ], min_credits=6),
        ],
    },
    {
        "id": "spec-operations-purchasing", "kind": "specialization", "name": "Operations Management (Purchasing track)",
        "source_url": SPEC_URL + "operations-management",
        "groups": [
            group("opp-req", "Required", "all", [
                c("BUSOBA 4232", "Operations Planning & Control", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4261", "Purchasing & Supply Chain Management", 3, UPPER + "; BUSOBA 3230", notes="Autumn only"),
                c("BUSOBA 4262", "Purchasing Strategy", 3, UPPER + "; BUSOBA 3230", notes="Spring only"),
                c("BUSOBA 4263", "Global Sourcing", 3, UPPER + "; BUSOBA 3230", notes="Autumn only"),
            ]),
            group("opp-elec", "Electives (6 credit hours)", "choose_credits", OPS_ELECTIVES_COMMON + [
                c("BUSOBA 4239", "Managing Process Improvement", 3, UPPER + "; BUSOBA 3230"),
                c("BUSOBA 4250", "Six Sigma Principles", 3, UPPER + "; BUSOBA 3230"),
            ], min_credits=6),
        ],
    },
    {
        "id": "spec-real-estate", "kind": "specialization", "name": "Real Estate", "source_url": SPEC_URL + "real-estate",
        "groups": [
            group("re-req", "Required", "all", [
                c("BUSFIN 3400", "Introduction to Real Estate", 3, "ECON 2001.01; ECON 2002.01; " + UPPER),
                c("BUSFIN 4410", "Real Estate Finance", 3, "BUSFIN 3400; " + UPPER),
                c("BUSFIN 4411", "Property Management", 3, "BUSFIN 3400; BUSFIN 3220; BUSFIN 3500; " + UPPER),
                c("BUSFIN 4412", "Real Estate Law", 3, "BUSFIN 3400; BUSFIN 3500; " + UPPER),
            ]),
            group("re-options", "Real Estate Option (choose one)", "choose_courses", [
                c("BUSFIN 4413", "Planning & Development", 3, "BUSFIN 3400; BUSFIN 3220; BUSFIN 3500; " + UPPER, notes="Spring only"),
                c("BUSFIN 5402", "Real Estate Valuation", 3, "BUSFIN 3400; BUSFIN 3220; BUSFIN 3500; " + UPPER),
            ], min_courses=1, notes="Fisher lists these under 'Real estate options'; read here as choose one."),
            group("re-elec", "Elective (3 credit hours)", "choose_credits", [
                c("BUSFIN 4265", "Financial Institutions", 3, "BUSFIN 4211 and 4221 (or concurrent)", notes="No priority; waitlist"),
                c("BUSFIN 4201", "Financial Data", 1.5, "BUSFIN 3220; " + UPPER, notes="No priority; waitlist"),
                c("BUSFIN 4250", "Global Finance", 1.5, "BUSFIN 3220; " + UPPER, notes="No priority; waitlist"),
                c("BUSFIN 3300", "Principles of Insurance", 3, "ECON 2001.01; ECON 2002.01; " + UPPER, notes="No priority; waitlist"),
                c("BUSFIN 4310", "Commercial Property and Casualty Insurance", 3, "BUSFIN 3300", notes="No priority; waitlist"),
            ], min_credits=3),
        ],
    },
]


def sql(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, list):
        return "array[" + ", ".join(sql(x) for x in v) + "]::text[]" if v else "'{}'::text[]"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    out = [
        "-- Generated by scripts/fisher_requirements.py. Edit that file, not this one.",
        "begin;",
        "update public.student_profiles set specialization_id = null where specialization_id is not null"
        " and specialization_id not in (" + ", ".join(sql(p["id"]) for p in PROGRAMS) + ");",
        "delete from public.requirement_courses;",
        "delete from public.requirement_groups;",
        "delete from public.programs where id not in (" + ", ".join(sql(p["id"]) for p in PROGRAMS) + ");",
    ]
    programs, groups, courses = [], [], []
    for pi, p in enumerate(PROGRAMS):
        programs.append(dict(
            id=p["id"], kind=p["kind"], name=p["name"], college="Fisher College of Business", catalog=CATALOG,
            min_total_credits=p.get("min_total_credits"), min_gpa=p.get("min_gpa"), notes=p.get("notes"),
            source_url=p.get("source_url"), sort_order=pi,
        ))
        for gi, g in enumerate(p["groups"]):
            groups.append(dict(
                id=g["id"], program_id=p["id"], sort_order=gi, title=g["title"], kind=g["kind"],
                min_courses=g.get("min_courses"), min_credits=g.get("min_credits"),
                max_secondary_credits=g.get("max_secondary_credits"), code_pattern=g.get("code_pattern"),
                exclude_codes=g.get("exclude_codes", []), notes=g.get("notes"),
            ))
            for ci, course in enumerate(g["courses"]):
                courses.append(dict(
                    group_id=g["id"], sort_order=ci, code=course["code"], title=course["title"], credits=course["credits"],
                    prerequisites=course.get("prerequisites"), min_grade=course.get("min_grade"),
                    alternates=course.get("alternates", []), equivalents=course.get("equivalents", []),
                    is_secondary=course.get("is_secondary", False),
                    notes=course.get("notes"),
                ))

    def insert(table, rows, suffix=""):
        cols = list(rows[0])
        values = ",\n".join("(" + ", ".join(sql(r[k]) for k in cols) + ")" for r in rows)
        return f"insert into public.{table} ({', '.join(cols)}) values\n{values}{suffix};"

    out.append(insert("programs", programs, "\non conflict (id) do update set " + ", ".join(
        f"{k} = excluded.{k}" for k in programs[0] if k != "id")))
    out.append(insert("requirement_groups", groups))
    out.append(insert("requirement_courses", courses))
    out.append("commit;")
    print("\n".join(out))


if __name__ == "__main__":
    main()
