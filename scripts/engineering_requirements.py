"""College of Engineering BS degrees (students admitted 2026-2027) as seed data.

Sources (read October 2026): each major's 2026-2027 curriculum sheet, linked from
  https://advising.engineering.osu.edu/current-students/curriculum-sheets-major
plus each department's elective lists (URLs on each program below).

Edit the data below, then run:
  python3 scripts/engineering_requirements.py degree > supabase/migrations/<timestamp>_seed_engineering_requirements.sql
  python3 scripts/engineering_requirements.py minors > supabase/migrations/<timestamp>_seed_engineering_minors.sql
and apply that file to Supabase. Each replaces only the College of Engineering's rows for its scope.

Course lists are written as pipe-separated rows copied from the source tables:
  "CODE | Title | credits | offered | prerequisites"
offered: A = autumn only, S = spring only, none = not on the 2026-2027 schedule, blank = autumn and spring.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from fisher_requirements import build, c, group  # noqa: E402

COLLEGE = "College of Engineering"
CATALOG = "College of Engineering, admitted 2026-2027"
SHEETS = "https://advising.engineering.osu.edu/current-students/curriculum-sheets-major"
GPA_NOTE = "Ohio State requires a 2.00 cumulative GPA to graduate; a D or better passes a course, but some prerequisites need C- or better."

OFFERED = {"": [], "A/S": [], "A": ["Autumn"], "S": ["Spring"], "none": ["None"]}


def rows(text, **kw):
    """Courses from "CODE | Title | credits | offered | prerequisites" lines (trailing fields optional)."""
    out = []
    for line in text.strip().splitlines():
        parts = [p.strip() for p in line.split("|")] + [""] * 5
        code, title, credits, offered, prereqs = parts[:5]
        extra = dict(kw)
        if offered:
            extra["offered"] = OFFERED.get(offered, [])  # "varies by year" etc.: not checked
        out.append(c(code, title, float(credits) if credits else None, prereqs or None, **extra))
    return out


def osu_codes(text):
    """Official subject codes for the abbreviations some department pages use (ME 2010, Math 2174, Stat 3470...)."""
    import re
    subs = [(r"\bME\b", "MECHENG"), (r"\bMSE\b", "MATSCEN"), (r"\bNE\b", "NUCLREN"), (r"\bMath\b", "MATH"),
            (r"\bPhysic ?s\b|\bPhys\b", "PHYSICS"), (r"\bStatistics\b|\bStats?\b", "STAT"), (r"\bChemistry\b|\bChem\b", "CHEM"),
            (r"\bEngineering (?=\d)|\bEngr\b", "ENGR "), (r"\bEarth Sci\b", "EARTHSC"), (r"\bWelding Engineering\b", "WELDENG"),
            (r"\bGenEd\b", "GENED")]
    for a, b in subs:
        text = re.sub(a, b, text)
    return text.replace("ENGR  ", "ENGR ")


# ---------- Shared pieces ----------

def survey():
    return c("ENGR 1100", "Engineering Survey", 1, None, alternates=["ENGR 1110"],
             notes="Ohio State introduction requirement: ENGR 1100, ENGR 1110 with ENGR 1120, or another program's OSU Survey course.")


def fundamentals(hours_1181=2):
    """ENGR 1181/1182. The ECE and Aviation sheets list ENGR 1181 at 3 credit hours and no separate ENGR 1100 survey."""
    return [
        c("ENGR 1181", "Fundamentals of Engineering 1", hours_1181, None, alternates=["ENGR 1281"],
          notes="Honors students take ENGR 1281.0xH instead."),
        c("ENGR 1182", "Fundamentals of Engineering 2", 2, "ENGR 1181", alternates=["ENGR 1282"],
          notes="Honors students take ENGR 1282.0xH instead."),
    ]


def calculus():
    return [
        c("MATH 1151", "Calculus I", 5, None, alternates=["MATH 1141"], equivalents=["MATH 1161"],
          notes="MATH 1140 + 1141 (Calculus with Review) is equivalent to MATH 1151."),
        c("MATH 1172", "Engineering Mathematics A", 5, "C- or better in MATH 1151", equivalents=["MATH 1152"],
          notes="Some majors accept the MATH 1152, 2153, 2415, 2568 sequence instead of 1172, 2173, 2174; confirm with your advisor."),
    ]


def eng_math_b(sub_2177=False, sub_2568=True):
    """MATH 2173 + 2174. sub_2568 / sub_2177: the major's own sheet accepts MATH 2568 + 2415 / MATH 2177 instead
    (otherwise those count only as equivalents for the advisor to confirm)."""
    alt_b = (["MATH 2568"] if sub_2568 else []) + (["MATH 2177"] if sub_2177 else [])
    alt_la = ["MATH 2415"] if sub_2568 else []
    note = ("MATH 2568 + 2415 substitute for MATH 2173 + 2174." if sub_2568 else "") + (" MATH 2177 substitutes for both." if sub_2177 else "")
    return [
        c("MATH 2173", "Engineering Mathematics B", 3, "MATH 1172", alternates=alt_b,
          equivalents=[] if sub_2568 else ["MATH 2568"], notes=note.strip() or None),
        c("MATH 2174", "Linear Algebra and Differential Equations for Engineers", 3, "MATH 1172", alternates=alt_la,
          equivalents=[] if sub_2568 else ["MATH 2415"], notes=note.strip() or None),
    ]


def physics_1250():
    return c("PHYSICS 1250", "Mechanics, Thermal Physics, Waves", 5, "MATH 1151 (or concurrent)",
             notes="PHYSICS 1248 (autumn) + 1249 (spring) substitute for PHYSICS 1250 for students starting below calculus.")


def ge_groups(prefix, writing_note=None):
    """Engineering students' GEN: math and natural science Foundations are met by the major, the Reflection is
    embedded in the capstone."""
    return [
        group(f"{prefix}-ge-launch", "GE Launch Seminar", "all", [
            c("GENED 1201", "GE Launch Seminar", 1, None, alternates=["GENED 2601"],
              notes="Take within your first 3 semesters (not counting summer). Transfer students take GENED 2601."),
        ]),
        group(f"{prefix}-ge-writing", "GE Foundation: Writing & Information Literacy", "ge", ge_category="writing", min_credits=3,
              notes=writing_note),
        group(f"{prefix}-ge-arts", "GE Foundation: Literary, Visual & Performing Arts", "ge", ge_category="arts", min_credits=3),
        group(f"{prefix}-ge-history", "GE Foundation: Historical & Cultural Studies", "ge", ge_category="history", min_credits=3),
        group(f"{prefix}-ge-sbs", "GE Foundation: Social & Behavioral Sciences", "ge", ge_category="sbs", min_credits=3),
        group(f"{prefix}-ge-diversity", "GE Foundation: Race, Ethnicity & Gender Diversity", "ge", ge_category="diversity", min_credits=3),
        group(f"{prefix}-ge-citizenship", "GE Theme: Citizenship for a Diverse & Just World", "ge", ge_category="theme-citizenship",
              min_credits=4, notes="One 4-credit course, or two 3-credit courses from different subjects."),
        group(f"{prefix}-ge-theme", "GE Theme: Student Choice", "ge", ge_category="theme-other", min_credits=4,
              notes="One more Theme: one 4-credit course, or two 3-credit courses from different subjects in that Theme."),
    ]


# ---------- Civil Engineering ----------

CIVIL_URL = "https://ceg.osu.edu/civil-engineering-curriculum"
CIVIL_ELECTIVES_URL = "https://ceg.osu.edu/civil-engineering-science-technical-and-breadth-electives"

CIVIL_TECH = """
ARCH 5810 | Architectural Environments | 3 | S | MATH 1151 and PHYSICS 1200 or permission of instructor
CONSYSM 2345 | Mechanical Systems for Buildings | 3 | | MATH 1148 and (co or prerequisite) PHYSICS 1250
CIVILEN 2060 | Numerical Methods | 4 | | STAT 3450 or 3470; MATH 2173 or 2177
CIVILEN 3310 | Structural Engineering Principles | 3 | | MECHENG 2020; (co or prerequisite) STAT 3450 or 3470
CIVILEN 3160 | Water Resources Engineering | 3 | | CIVILEN 3130; ENGR 1221 (or equivalent)
CIVILEN 3540 | Geotechnical Engineering (with CIVILEN 3541 lab) | 3 | | MECHENG 2020; (co or prerequisite) STAT 3450
CIVILEN 3700 | Transportation Engineering and Analysis | 3 | | STAT 3450 or 3470
CIVILEN 4210 | The Physics of Sustainable Buildings | 3 | none | CIVILEN 3130; ENVENG 3200; MATH 2174, 2177 or 2415
CIVILEN 4320 | Structural Steel Design | 3 | A | CIVILEN 3310
CIVILEN 4350 | Reinforced Concrete Design | 3 | | CIVILEN 3310
CIVILEN 4552 | Design and Construction of Pavements | 3 | S | CIVILEN 3510; prereq or concur CIVILEN 3540, 3541, 4350
CIVILEN 5162 | Introduction to Laminated Composite Materials | 3 | A | MECHENG 2020 or 2040
CIVILEN 5168 | Finite Element Method | 3 | S | CIVILEN 2060; MATH 2174 or 2177
CIVILEN 5220 | Open Channel Hydraulics | 3 | none | CIVILEN 3160
CIVILEN 5230 | Transport Phenomena in Water Resources Engineering | 3 | S | CIVILEN 3160; MATH 2173 or 2177
CIVILEN 5240 | Groundwater and Geoenergy Engineering | 3 | none | CIVILEN 3130
CIVILEN 5300 | Airport Planning and Design | 3 | none | Senior standing in civil engineering or permission of instructor
CIVILEN 5310 | Matrix Structural Analysis | 3 | A | CIVILEN 3310
CIVILEN 5320 | Intermediate Structural Steel Design | 3 | S | CIVILEN 4320
CIVILEN 5350 | Intermediate Reinforced Concrete Design | 3 | S | CIVILEN 4350
CIVILEN 5360 | Bridge Engineering | 3 | none | CIVILEN 4320 or 4350
CIVILEN 5370 | Prestressed Concrete Design | 3 | A | CIVILEN 4350
CIVILEN 5400 | Introduction to Geographic Information Systems | 4 | S | STAT 3450 or 3470; senior standing
CIVILEN 5410 | Engineering Surveying | 3 | A | CIVILEN 2410
CIVILEN 5411 | Legal Aspects of Surveying | 3 | A | CIVILEN 2410
CIVILEN 5412 | Introduction to GPS: Theory and Application | 3 | S | MATH 1172 or 2153; junior standing
CIVILEN 5420 | Remote Sensing of Environment | 3 | S | CIVILEN 2410
CIVILEN 5441 | Introduction to GPS: Theory and Applications | 3 | S | MATH 1172 or 2153; junior standing
CIVILEN 5461 | Geospatial Numerical Analysis | 3 | A | CIVILEN 2410
CIVILEN 5510 | Durability and Condition Assessment of Reinforced Concrete Structures | 3 | A | CIVILEN 3510
CIVILEN 5561 | Rock Mechanics, Slope Stability and Retaining Structures | 3 | S | CIVILEN 3540; CIVILEN 3541
CIVILEN 5571 | Principles of Foundation Analysis | 3 | A | CIVILEN 3540; CIVILEN 3541
CIVILEN 5610.02 | Safe Water on Tap | 3 | S | Permission of instructor
CIVILEN 5700 | Urban Transportation Demand Forecasting | 3 | A | CIVILEN 3700
CIVILEN 5720 | Transportation Engineering Data Collection Studies | 3 | A | CIVILEN 3700
CIVILEN 5730 | Highway Location and Design | 3 | A | CIVILEN 3700
CIVILEN 5740 | Design and Operation of Road Traffic Facilities | 3 | S | CIVILEN 3700
CIVILEN 5750 | Instrumentation, Signals and Control in Transportation Applications | 3 | A | CIVILEN 3700
CIVILEN 5760 | Network Metrics and Control in Transportation Systems | 3 | none | CIVILEN 3700
CIVILEN 5770 | Urban Public Transportation | 3 | S | CIVILEN 3700
CIVILEN 5840 | Construction Contracts and Claims | 3 | S | CONSYSM 2205
CONSYSM 3450 | Estimating for Construction | 4 | | CONSYSM 2205; CEGE advisor permission
CONSYSM 3451 | Scheduling Construction Projects | 4 | | CONSYSM 2205; CONSYSM 3450 or permission of instructor
CONSYSM 4641 | Construction Project Management | 2 | | CONSYSM 2205; CEGE advisor permission
CONSYSM 4642 | Construction Control - Contracts and Documents | 3 | | CONSYSM 3451 or permission of instructor
CONSYSM 5670 | Green Building Design and Sustainable Construction | 3 | | Junior or senior standing
CRPLAN 5320 | Transportation Data Analytics for Planners | 3 | none | Permission of instructor
CRPLAN 5600 | Advanced Urban Planning Survey Collection, Management, and Analysis Methods | 3 | A | CIVILEN 3700
ENVENG 3200 | Fundamentals of Environmental Engineering | 3 | | CHEM 1210 or 1250
ENVENG 3210 | Environmental Engineering Unit Operations | 3 | S | Prereq or concur CIVILEN 3130; ENVENG 3200
ENVENG 4218 | Measurement and Modeling of Climate Change | 3 | S | CIVILEN 2060; ENGR 1221 (or equivalent)
ENVENG 4400 | Integrated Environmental Chemical Fate and Transport | 3 | A | CIVILEN 3130; ENVENG 3200
ENVENG 5000 | Engineering for Forced Displacement Scenarios | 3 | S |
ENVENG 5110 | Environmental Engineering Bioprocesses | 3 | A | ENVENG 3200
ENVENG 5140 | Air Quality in Engineering | 3 | A | CHEM 1220 or 1250; MATH 2177 or 2174
ENVENG 5170 | Sustainability and the Circular Economy | 3 | S | ENVENG 3200
ENVENG 5195 | Engineering Design for Environmental Health | 3 | none | MATH 1151 or 1161; CHEM 1210 or 1250
ENVENG 5410 | Hazardous Waste Management and Remediation | 3 | A | ENVENG 3200; CIVILEN 3130
ENVENG 5600 | Science, Engineering and Public Policy | 3 | none | Junior or senior standing or permission of instructor
ENVENG 5718 | Aquatic Chemistry | 3 | none | CHEM 1220; MATH 1151
ENVENG 5760 | Design of Urban Stormwater Control Measures | 3 | S | CIVILEN 3160
FABENG 5310 | Ecological Engineering and Science | 4 | S | One course in biology, ecology, engineering, or geology; junior standing
MECHENG 2030 | Dynamics | 3 | | MECHENG 2010
MECHENG 5144 | Engineering Fracture Mechanics | 3 | S | MECHENG 2020; MATH 2177 or 2174
PUBHEHS 7365 | Principles of Risk Assessment | 3 | S | Permission of instructor
"""

CIVIL_RESEARCH = """
CIVILEN 4998 | Undergraduate Research | | | Permission of instructor
CIVILEN 4999 | Undergraduate Research for Thesis | | | Permission of instructor; approved proposal for distinction
"""

CIVIL_BREADTH = """
ACCTMIS 2000 | Foundations of Accounting
AEROENG 2200 | Introduction to Aerospace Engineering I
ARCH 2220 | Sustainability and the Built Environment
ARCH 3192 | Homes and Houses: Where we Live
ARCH 5110 | History of Architecture I
ARCH 5120 | History of Architecture II
ARCH 5510 | Materials and Envelopes I
ARCH 5520 | Materials and Envelopes II
AVIATION 2000 | Introduction to Aviation Industry
AVIATION 3900 | Air Traffic Management Systems and Environment
BUSOBA 3130 | Foundations of Operations Management
BUSFIN 3120 | Foundations of Finance
BUSMHR 3100 | Foundations of Management and Human Resources
BUSML 3150 | Foundations of Marketing
CHEM 1220 | General Chemistry II | 5
CIVILEN 3530 | Learning from Disaster | 4 | none
CIVILEN 5610.01 | Sustainable Infrastructure for Developing Rural Communities
CIVILEN 5797.26 | Japanese American Design Experience
CONSYSM 2240 | Construction Materials and Methods I
CONSYSM 2440 | Construction Surveying and Site Development
CONSYSM 2600 | Construction Safety and Health
CONSYSM 4660 | Heavy Construction Management
CONSYSM 5680 | Construction Renovation and Demolition
CRPLAN 2000 | Introduction to City and Regional Planning
CRPLAN 2110 | Creating Innovative Cities and Regions
CRPLAN 2210 | Sustainable Urbanism
CRPLAN 2630 | Planning for Future Cities
CRPLAN 3000 | Planning Resilient Environments
CRPLAN 3100 | Analyzing the City
CRPLAN 3400 | Planning for Sustainable Economic Development
CRPLAN 3500 | The Socially Just City | 3
CRPLAN 3600 | Land Development Planning
CRPLAN 4110 | Transportation and Land Use Planning
CRPLAN 4597 | The Global Environment in Planning | 3
CRPLAN 5200 | Metropolitan and Regional Planning
CSE 2122 | Data Structures using C++
CSE 2123 | Data Structures using Java
CSE 2133 | Business Programming with File Processing
CSE 2321 | Foundations I: Discrete Structures
CSE 2331 | Foundations II: Data Structures and Algorithms
CSE 3241 | Introduction to Database Systems
CSE 3430 | Overview of Computer Systems for Non-Majors
CSE 4471 | Information Security
CSE 5052 | Survey of Artificial Intelligence for Non-Majors
EARTHSC 4421 | Earth Materials
EARTHSC 4450 | Water, Ice and Energy in the Earth System
EARTHSC 4530 | Structural Geology
EARTHSC 4560 | Applied Geophysics
EARTHSC 4911 | Earth's Climate: Past and Future
EARTHSC 5201 | Introduction to Seismology
EARTHSC 5203 | Geo-environment and Human Health
EARTHSC 5550 | Geomorphology
EARTHSC 5621 | Introduction to Geochemistry
EARTHSC 5645 | Advanced Structural Geology
EARTHSC 5646 | Geodynamics
EARTHSC 5651 | Hydrogeology
EARTHSC 5655 | Land Surface Hydrology
EARTHSC 5663 | Global Change and Sustainability in the Earth System
EARTHSC 5680 | Deep Earth Geophysics
EARTHSC 5687 | Borehole Geophysics
EARTHSC 5751 | Quantitative Reservoir Modeling
EARTHSC 5780 | Reflection Seismology
ECE 2020 | Analog Systems and Circuits
ENGR 2300 | Citizenship in Engineering Contexts | 3
ENGR 2301 | Exploring Citizenship in Engineering: Integrative Designation | 4
ENGR 4850S | Translating Engineering Research to K-8 (TEK8)
ECE 5050 | Humanitarian Engineering
ENGR 5797.17S | Service Learning in Ghana
ENGR 5797.21 | Sustainable and Resilient Tanzanian Communities
ENGR 5797.22S | Service Learning in Guatemala
ENGR 5797.23 | Humanitarian Engineering and Culture in Guyana
ENGR 5797.24 | Sustainable Community Development - Honduras
ENR 3280 | Water Quality Management
ENR 5210 | US Environmental Impact Assessment
ENR 5268 | Soils and Climate Change
ENVENG 3600 | Technology Innovation for Sustainability | 4 | none
FABENG 3120 | Thermodynamics
FABENG 3210 | Introduction to Humanitarian Engineering | 3
FABENG 3211 | Introduction to Humanitarian Engineering Laboratory | 1
FABENG 5200 | Appropriate Technologies for Developing Countries
FABENG 5550 | Sustainable Waste Management
FABENG 5620 | Fluid Power Systems
FABENG 5750 | Stream Geomorphology and Watershed Hydrology
GEOG 2800 | Our Global Environment
GEOG 3300 | Transportation Security
GEOG 3701 | The Making of the Modern World | 3
GEOG 3800 | Geographical Perspectives on Environment and Society | 3
GEOG 5300 | Geography of Transportation
GEOG 5301 | Sustainable Transportation
GEOG 5402 | Land Use Geography
GEOG 5502 | Data Justice and the Right to the Smart City
GEOG 5802 | Globalization and the Environment
GEOG 5900 | Weather, Climate and Global Warming
HISTORY 3700 | American Environmental History | 3
HISTORY 3706 | The History of American Business and Global Environmental Change | 3
ISE 5870 | Resilience Engineering
KNOW 2300 | Outlines of the Built Environment
KNOW 2310 | Seeing and Making | 4
LARCH 2367 | Making and Meaning of the American Landscape | 3
LARCH 2600 | Outlines of Landscape Architecture: Visual Literacy in the Built Environment | 3
MATH 3345 | Foundations of Higher Mathematics
MATSCEN 2010 | Introduction to Engineering Materials
MECHENG 3500 | Engineering Thermal Sciences
MECHENG 5682.01 | Fundamentals of Product Design Engineering
PHYSICS 1251 | Electricity and Magnetism, Waves, Optics
PUBAFRS 3000 | Public Policy Analysis
PUBAFRS 3500 | Public Management
PUBAFRS 5610 | Innovation, Policy and the Global Economy
"""

CIVIL = {
    "id": "eng-civil", "kind": "degree", "name": "BS Civil Engineering", "min_total_credits": 131, "min_gpa": 2.0,
    "source_url": CIVIL_URL,
    "notes": "Curriculum for students who started at Ohio State in Autumn 2025 or later (MATH 1151 start: 131 credit hours). "
             "Major courses need admission to the major. No course counts twice across the core selection, design, lab, and "
             "technical elective requirements. " + GPA_NOTE,
    "groups": [
        group("civ-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), *eng_math_b(), physics_1250(),
            c("CHEM 1250", "General Chemistry for Engineers", 4, None, alternates=["CHEM 1210"], equivalents=["CHEM 1206"],
              notes="CHEM 1210, or CHEM 1206 + 1208, substitutes for CHEM 1250."),
            c("STAT 3450", "Probability & Data Interpretation (STAT 3450.0x)", 2, None, alternates=["STAT 3460", "STAT 3470"]),
            c("ENGR 1221", "Computer Programming (MATLAB)", 2, None, alternates=["CSE 1222", "CSE 1223", "CSE 1224"]),
            c("ENGR 1300", "Introduction to Writing for STEM", 3, None, alternates=["ENGR 2301", "ENGLISH 3305"],
              notes="Students with prior credit for ENGLISH 1110 may take ENGR 2301 (also counts as the Citizenship Theme) or ENGLISH 3305 instead."),
        ]),
        group("civ-major", "Civil Engineering Major Courses", "all", [
            c("MECHENG 2010", "Statics", 2, "MATH 1151; PHYSICS 1250"),
            c("MECHENG 2020", "Mechanics of Materials", 3, "MECHENG 2010"),
            c("CIVILEN 2001", "Introduction to Infrastructure", 3, None),
            c("CIVILEN 2405", "Graphics for Civil Engineering", 1, None),
            c("CIVILEN 2410", "Introduction to Geomatics / Surveying", 3, None),
            c("CONSYSM 2205", "Construction Engineering & Management", 3, None),
            c("CIVILEN 3130", "Fluid Mechanics", 3, None),
            c("CIVILEN 3510", "Civil Engineering Materials", 3, None),
            c("CIVILEN 3080", "Economics & Optimization", 3, None),
            c("CIVILEN 4001", "Civil Engineering Capstone 1", 2, None),
            c("CIVILEN 4002", "Civil Engineering Capstone 2", 2, "CIVILEN 4001"),
        ]),
        group("civ-core-select", "Core Selection (choose two)", "choose_courses", rows("""
CIVILEN 3310 | Structural Engineering Principles | 3 | | MECHENG 2020; (co or prerequisite) STAT 3450 or 3470
CIVILEN 3700 | Transportation Engineering and Analysis | 3 | | STAT 3450 or 3470
ENVENG 3200 | Fundamentals of Environmental Engineering | 3 | | CHEM 1210 or 1250
"""), min_courses=2, notes="A third course from this list can count as a technical elective."),
        group("civ-design", "Design Electives (choose three)", "choose_courses", rows("""
CIVILEN 4320 | Structural Steel Design (Structures) | 3 | A | CIVILEN 3310
CIVILEN 4350 | Reinforced Concrete Design (Structures) | 3 | | CIVILEN 3310
CIVILEN 4552 | Design and Construction of Flexible and Rigid Pavements (Materials/Geotechnical) | 3 | S | CIVILEN 3510; prereq or concur CIVILEN 3540, 3541, 4350
CIVILEN 5220 | Open Channel Hydraulics (Water Resources) | 3 | none | CIVILEN 3160
CIVILEN 5571 | Principles of Foundation Analysis and Design (Materials/Geotechnical) | 3 | A | CIVILEN 3540; CIVILEN 3541
CIVILEN 5730 | Highway Location and Design (Transportation) | 3 | A | CIVILEN 3700
ENVENG 3210 | Environmental Engineering Unit Operations (Environmental) | 3 | S | Prereq or concur CIVILEN 3130; ENVENG 3200
ENVENG 5410 | Hazardous Waste Management and Remediation (Environmental) | 3 | A | ENVENG 3200; CIVILEN 3130
ENVENG 5760 | Design of Urban Stormwater Control Measures (Water Resources) | 3 | S | CIVILEN 3160
"""), min_courses=3, notes="Extra design electives can count as technical electives."),
        group("civ-lab", "Lab Elective (choose one)", "choose_courses", rows("""
CIVILEN 3160 | Water Resources Engineering | 3 | | CIVILEN 3130; ENGR 1221 (or equivalent)
CIVILEN 3540 | Geotechnical Engineering (with CIVILEN 3541 lab) | 3 | | MECHENG 2020; (co or prerequisite) STAT 3450
"""), min_courses=1),
        group("civ-science", "Science Elective (3-4 credit hours)", "choose_credits", rows("""
EARTHSC 2155 | Energy and Environment
EARTHSC 2203 | Environmental Geoscience | 3
EARTHSC 2210 | Energy, Mineral Resources, and Society | 3
EARTHSC 2911 | The Climate Crisis: Mechanisms, Impacts, and Mitigation | 4
ENR 2100 | Introduction to Environmental Science
ENR 3000 | Soil Science
GEOG 1900 | Extreme Weather and Climate
GEOG 2960 | Introduction to Physical Geography
GEOG 3900 | Global Climate Change: Causes and Consequences | 3
CSE 2321 | Foundations I: Discrete Structures
CSE 5052 | Survey of Artificial Intelligence for Non-Majors
"""), min_credits=3, notes="One course; ask a CEGE advisor whether you need 3 or 4 credit hours. GE overlap is allowed. "
                                "EARTHSC 2911 is also listed as EEOB 2911 and HISTORY 2911."),
        group("civ-tech", "Technical Electives (at least six courses, 18 credit hours)", "choose_credits",
              rows(CIVIL_TECH) + rows(CIVIL_RESEARCH, is_secondary=True), min_credits=18, max_secondary_credits=3,
              notes="Courses already counted for core selection, design, or lab can't count again. At most 3 credit hours of "
                    "undergraduate research (CIVILEN 4998/4999)."),
        group("civ-tech-breadth", "Technical or Breadth Electives (two more courses, 6 credit hours)", "choose_credits",
              rows(CIVIL_TECH) + rows(CIVIL_BREADTH) + rows(CIVIL_RESEARCH, is_secondary=True)
              + rows("CIVILEN 4191 | Internship", is_secondary=True),
              min_credits=6, max_secondary_credits=3,
              notes="Technical and breadth electives total at least eight courses (24 credit hours). At most 3 credit hours of "
                    "internship credit (CIVILEN 4191.0x) count as breadth. ENGR 2301 can't be a breadth elective if it's "
                    "already your writing course and Citizenship Theme. Source: " + CIVIL_ELECTIVES_URL),
        *ge_groups("civ", writing_note="Met by ENGR 1300."),
    ],
}

# ---------- Environmental Engineering ----------

ENV_URL = "https://ceg.osu.edu/environmental-engineering-curriculum"
ENV_ELECTIVES_URL = "https://ceg.osu.edu/approved-technical-and-science-electives-environmental-engineering-majors"

ENV_AREA1 = """
CIVILEN 2410 | Introduction to Surveying | 3 | | Prereq or concur STAT 3470
CIVILEN 3510 | Civil Engineering Materials | 3 | | Prereq or concur STAT 3470; MECHENG 2020
CIVILEN 3540 | Geotechnical Engineering (with CIVILEN 3541 lab) | 3 | | MECHENG 2020 or 2040; prereq or concur STAT 3470
CIVILEN 4210 | The Physics of Sustainable Buildings | 3 | none | CIVILEN 3130; ENVENG 3200; MATH 2174, 2177 or 2415
CIVILEN 5220 | Open Channel Hydraulics | 3 | none | CIVILEN 3160; MATH 2177 or 2415
CIVILEN 5230 | Transport Phenomena in Water Resources Engineering | 3 | S | CIVILEN 3160; MATH 2173, 2177 or 2415
CIVILEN 5240 | Groundwater Engineering | 3 | A | CIVILEN 3130
CIVILEN 5400 | Introduction to Geographic Information Systems | 4 | S | STAT 3470; senior standing
CIVILEN 5610.02 | Safe Water on Tap | 3 | S |
ENVENG 4218 | Measurement and Modeling of Climate Change | 3 | S | CIVILEN 2060; ENGR 1221
ENVENG 4400 | Integrated Environmental Chemical Fate and Transport | 3 | A | CIVILEN 3130; ENVENG 3200
ENVENG 5000 | Engineering for Forced Displacement Scenarios | 3 | S |
ENVENG 5195 | Engineering Design for Environmental Health | 3 | none | MATH 1151 or 1161; CHEM 1210 or 1250
ENVENG 5410 | Hazardous Waste Management and Remediation | 3 | A | ENVENG 3200; CIVILEN 3130
ENVENG 5600 | Science, Engineering and Public Policy | 3 | none | Junior or senior standing
ENVENG 5718 | Aquatic Chemistry | 3 | none | CHEM 1220; MATH 1151
ENVENG 5760 | Design of Urban Stormwater Control Measures | 3 | S | CIVILEN 3160
FABENG 3120 | Thermodynamics in Food, Agricultural and Biological Engineering | 4 | A | MATH 2177 or 2174 (or concurrent)
FABENG 5310 | Ecological Engineering and Science | 4 | S | One course in biology, ecology, engineering or geology; junior standing
PUBHEHS 7365 | Principles of Risk Assessment | 3 | S | Permission of instructor
"""

ENV_AREA2 = """
CHEM 2210 | Analytical Chemistry I: Quantitative Analysis | 5 | | CHEM 1220
CHEM 2520 | Organic Chemistry II | 4 | | CHEM 2510
EARTHSC 5206 | Advanced Oceanography | 3 | A | Junior standing in a STEM major or permission of instructor
EARTHSC 5621 | Introduction to Geochemistry | 3 | A | CHEM 1220; senior standing; or permission of instructor
EARTHSC 5651 | Hydrogeology | 4 | A | EARTHSC 1121; MATH 1152; or permission of instructor
EARTHSC 5655 | Land Surface Hydrology | 3 | S | MATH 1152; CHEM 1210; PHYSICS 1250
EARTHSC 5751 | Quantitative Reservoir Modeling | 4 | A | MATH 1152 or permission of instructor
ECE 5050 | Humanitarian Engineering | 3 | S | ENGR 1182
ENR 5262 | Soil Chemical Processes & Environmental Quality | 3 | A | One semester of chemistry or permission of instructor
ENR 5560 | Rehabilitation / Restoration of Ecosystems | 3 | S | Permission of instructor
FABENG 5520 | Phytotechnology and Phytoremediation | 3 | S | ENVENG 3200
FABENG 5540 | Biomass Conversion to Bioenergy | 3 | none | Permission of instructor
GEOG 5802 | Globalization and Environment | 3 | S |
GEOG 5900 | Weather, Climate and Global Warming | 3 | |
MECHENG 3500 | Engineering Thermal Sciences | 3 | | MATH 2174, 2177 or 2415; PHYSICS 1250
MICRBIO 5155 | Environmental Microbiology | 3 | A | MICRBIO 4000
"""

ENV_ADDITIONAL = """
CIVILEN 2405 | Computer Graphics for Civil Engineers | 1 | | Permission of CEGE advisor
CIVILEN 2193 | Independent Study | | | Permission of instructor
ENVENG 2193 | Independent Study | | | Permission of instructor
CIVILEN 4193 | Independent Study | | | Permission of instructor
ENVENG 4193 | Independent Study | | | Permission of instructor
CIVILEN 4191 | Environmental Engineering Internship | | | Approved internship request
CIVILEN 4998 | Undergraduate Research, No Thesis | 3 | | Permission of instructor
ENVENG 4998 | Undergraduate Research, No Thesis | 3 | | Permission of instructor
CIVILEN 4999 | Undergraduate Research with Thesis | 3 | | Permission of instructor
ENVENG 4999 | Undergraduate Research with Thesis | 3 | | Permission of instructor
MECHENG 4999 | Undergraduate Research with Thesis | 3 | | Permission of instructor
CIVILEN 5610.01 | Sustainable WaSH Infrastructure for Developing Rural Communities | 3 | A | Permission of instructor
CIVILEN 5797.26 | Japanese American Design Experience (JADE) | 3 | | Approved education abroad application
CONSYSM 5670 | Green Building Design and Sustainable Construction | 3 | | Junior or senior standing
ENGR 4850S | Translating Engineering Research to K-8 (TEK8) | 3 | A | ENGR 1182 or 1282H; permission of instructor
ENGR 5797.20 | Sustainable and Resilient Infrastructure in Italy | 3 | | ENVENG 3200 or CIVILEN 3310
ENGR 5797.21 | Sustainable and Resilient Tanzanian Communities - Engineering | 3 | S | CIVILEN 4001; concur CIVILEN 4002; or permission of instructor
ENGR 5797.24 | Sustainable Community Development - Honduras | 3 | S | Application required
FABENG 5200 | Appropriate Technologies for Developing Countries | 3 | S | ENGR 1182 or 1282; or permission of instructor
"""

ENVIRONMENTAL = {
    "id": "eng-environmental", "kind": "degree", "name": "BS Environmental Engineering", "min_total_credits": 130, "min_gpa": 2.0,
    "source_url": ENV_URL,
    "notes": "Curriculum for students who started at Ohio State in Autumn 2025 or later (MATH 1151 start: 130 credit hours). "
             "Students who need math before MATH 1151 will need extra time. " + GPA_NOTE,
    "groups": [
        group("env-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), physics_1250(),
            c("MATH 2177", "Mathematical Topics for Engineers", 4, "MATH 1172", equivalents=["MATH 2173", "MATH 2568"],
              notes="MATH 2173 + 2174, or MATH 2568 + 2415, substitute for MATH 2177."),
            c("CHEM 1210", "General Chemistry I", 5, None, equivalents=["CHEM 1206"], notes="CHEM 1206 + 1208 substitutes for CHEM 1210."),
            c("CHEM 1220", "General Chemistry II", 5, "CHEM 1210"),
            c("CHEM 2510", "Organic Chemistry I", 4, "CHEM 1220", alternates=["CHEM 2310"]),
            c("STAT 3470", "Introduction to Probability and Statistics for Engineers (STAT 3470.0x)", 3, None),
            c("ENGR 1221", "Computer Programming (MATLAB)", 2, None, alternates=["CSE 1222", "CSE 1223", "CSE 1224"]),
            c("ENGR 1300", "Introduction to Writing for STEM", 3, None, alternates=["ENGR 2301", "ENGLISH 3305"],
              notes="Students with prior credit for ENGLISH 1110 may take ENGR 2301 (also counts as the Citizenship Theme) or ENGLISH 3305 instead."),
            c("MICRBIO 4000", "Microbiology (MICRBIO 4000.0x)", 4, None),
        ]),
        group("env-major", "Environmental Engineering Major Courses", "all", [
            c("MECHENG 2040", "Statics & Mechanics of Materials", 4, None, equivalents=["MECHENG 2010"],
              notes="MECHENG 2010 + 2020 substitutes for MECHENG 2040."),
            c("CIVILEN 2001", "Introduction to Infrastructure", 3, None),
            c("CIVILEN 2090", "Professional Aspects", 1, None),
            c("ENVENG 2100", "Analytical Methods", 3, None),
            c("CIVILEN 2060", "Numerical Analysis Methods", 4, "STAT 3450 or 3470; MATH 2173 or 2177"),
            c("CIVILEN 3130", "Fluid Mechanics", 3, None),
            c("CIVILEN 3080", "Economic Evaluation & Optimization", 3, None),
            c("ENVENG 3200", "Fundamentals of Environmental Engineering", 3, "CHEM 1210 or 1250"),
            c("CIVILEN 3160", "Water Resources Engineering", 3, "CIVILEN 3130; ENGR 1221 (or equivalent)"),
            c("ENVENG 3210", "Unit Operations", 3, "Prereq or concur CIVILEN 3130; ENVENG 3200", offered=["Spring"]),
            c("ENVENG 4200", "Unit Operations Lab", 1, None),
            c("ENVENG 5110", "Environmental Engineering Bioprocesses (Biotechnology)", 3, "ENVENG 3200", offered=["Autumn"]),
            c("ENVENG 5140", "Air Quality Engineering", 3, "CHEM 1220 or 1250; MATH 2177 or 2174", offered=["Autumn"]),
            c("ENVENG 5170", "Pollution Prevention (Sustainability and the Circular Economy)", 3, "ENVENG 3200", offered=["Spring"]),
            c("ENVENG 4090", "Capstone Design (ENVENG 4090.0x)", 3, None),
        ]),
        group("env-science", "Additional Science Elective (4 credit hours, with lab)", "choose_credits", rows("""
EARTHSC 1121 | The Dynamic Earth | 3 | | MATH 1075 or above
EARTHSC 1151 | Natural Hazards | 3
EARTHSC 1200 | Earth Science Lab | 1
ENR 3000 | Soil Science | 3
ENR 3001 | Soil Science Lab | 1
"""), min_credits=4, notes="EARTHSC 1121 or 1151 with the EARTHSC 1200 lab, or ENR 3000 with the ENR 3001 lab."),
        group("env-tech-area1", "Technical Electives, Area 1: Civil & Environmental Engineering (at least two)", "choose_courses",
              rows(ENV_AREA1), min_courses=2),
        group("env-tech-area2", "Technical Electives, Area 2: Non-CEGE Courses (at least one)", "choose_courses",
              rows(ENV_AREA2), min_courses=1),
        group("env-tech-more", "Technical Electives: remaining hours (12 credit hours in all)", "choose_credits",
              rows(ENV_AREA1) + rows(ENV_AREA2) + rows(ENV_ADDITIONAL, is_secondary=True), min_credits=3, max_secondary_credits=3,
              notes="Technical electives total at least 12 credit hours. At most 3 hours from the additional list (independent study, "
                    "research, internship, study abroad). Source: " + ENV_ELECTIVES_URL),
        *ge_groups("env", writing_note="Met by ENGR 1300."),
    ],
}

# ---------- Mechanical Engineering ----------

ME_URL = "https://mae.osu.edu/me-students-starting-math-1151"
ME_TECH_URL = "https://mae.osu.edu/undergraduate/mechanical-engineering-0/mechanical-engineering-technical-electives"

ME_DESIGN = """
MECHENG 5144 | Fracture Mechanics | 3 | | MECHENG 2020 or 2040; MATH 2174, 2177, or 2415
MECHENG 5162 | Introduction to Laminated Composite Materials | 3 | | MECHENG 2020 or 2040
MECHENG 5240 | Mechanical Vibrations | 3 | | MECHENG 3260; prereq or concur MECHENG 3360
MECHENG 5372 | Design and Control of Mechatronic Systems | 3 | | MECHENG 3360 or 3361
MECHENG 5374 | Smart Materials and Intelligent Systems | 3 | | MECHENG 3360 or 3361
MECHENG 5512 | Design of Heat Exchangers | 2 | | MECHENG 4510
MECHENG 5680 | Computer Aided Design and Manufacturing | 4 | | MECHENG 3670
MECHENG 5682.01 | Fundamentals of Product Design Engineering | 3 | | Junior, senior, or graduate standing in the College of Engineering
MECHENG 5686 | Smart Product Engineering Design | 3 | | MECHENG 2900; MECHENG 3360; MECHENG 3671; MECHENG 3870
MECHENG 5751 | Design and Manufacturing of Compliant Mechanisms and Robots | 3 | | MECHENG 3670
"""

ME_COMPUTATIONAL = """
MECHENG 5030 | Intermediate Dynamics | 3 | | MECHENG 2030
MECHENG 5134 | Introduction to Vibrations of Deformable Solids | 3 | | MECHENG 2020 or 2040; MATH 2174, 2177, or 2415
MECHENG 5139 | Applied Finite Element Method | 3 | | MECHENG 2020 or 2040
MECHENG 5339 | Simulation Techniques for Dynamic Systems | 3 | | MECHENG 3360
MECHENG 5539 | Applied Computational Fluid Dynamics and Heat Transfer | 3 | | MECHENG 3501 or 3502; MECHENG 3503 or 3504; prereq or concur MECHENG 4510
MECHENG 5670 | Advanced MCAD Modeling with CATIA | 3 | | Rank 4 in mechanical or aerospace engineering, or permission of instructor
MECHENG 5775 | Applied Machine Learning for MAE and Robotics | 3 | | MATH 2177 or 2174, or 2415 and 2568; PHYSICS 1250; AEROENG 3581 or MECHENG 2850 or 5463
"""

ME_APPLICATIONS = """
MECHENG 5180 | Mechanics of Biomolecular Systems | 3 | | Senior standing in Engineering or permission of instructor
MECHENG 5234 | Vehicle Dynamics | 4 | | MECHENG 3360; MECHENG 3671
MECHENG 5427 | Introduction to Turbomachinery | 3 | | MECHENG 3503 or 3504
MECHENG 5463 | Introduction to Real Time Robotics Systems | 3 | | MATH 2177 or 2174, or 2415 and 2568; PHYSICS 1250
MECHENG 5502 | Engineering Thermodynamics | 3 | | MECHENG 3501 or 3502
MECHENG 5530 | Internal Combustion Engines | 3 | | MECHENG 3501 or 3502
MECHENG 5531 | Advanced Automotive Systems Analysis/Laboratory | 3 | | MECHENG 3870
MECHENG 5535 | Advanced Topics in Solar Energy Systems | 3
MECHENG 5541 | HVAC | 3 | | MECHENG 4510
MECHENG 5550 | Engineering Principles in Cancer | 3 | | MECHENG 3500 or 3503, or CBE 2420
MECHENG 5700 | Introduction to Musculoskeletal Biomechanics | 3 | | MECHENG 3670
NUCLREN 4505 | Introduction to Nuclear Science and Engineering | 3 | | MATH 2173, 2177, 2255, or 2415; PHYSICS 1251
NUCLREN 4536 | Nuclear Reactor Systems | 3 | | NUCLREN 4505
NUCLREN 5606 | Radiation Protection and Shielding | 3 | | MATH 2153, 2173, or 2177; PHYSICS 1250
NUCLREN 5610 | Reactor Safety | 3 | | NUCLREN 4505
NUCLREN 5742 | Nuclear Radiations and Their Measurements | 3
"""

# At most 3 credit hours from these (professional skills, independent study, approved non-MAE courses)
ME_OTHER = """
ACCAD 5140 | Interactive Arts Media: Web | 3
ACCTMIS 2000 | Foundations of Accounting | 3
ACCTMIS 2200 | Introduction to Accounting I | 3
BUSMHR 2500 | Entrepreneurship | 3
ECE 5570 | Antiracist Technology | 4
ENGR 5050 | Introduction to Humanitarian Engineering | 3
ISE 5760 | Visual Analytics and Sensemaking | 3
MECHENG 5600 | Applied Project Management in Product Development Team Environments | 3
PUBAFRS 3000 | Introduction to Public Policy Analysis | 3
PUBAFRS 3620 | US Space Policy and the Global Space Economy | 3
PUBAFRS 5600 | Science, Engineering, and Public Policy | 3
MECHENG 4193 | Independent Study
MECHENG 5193 | Independent Study
CIVILEN 4210 | The Physics of Sustainable Buildings | 3
BIOMEDE 4110 | Bioimaging | 3
BIOMEDE 4210 | Biotransport | 3
BIOMEDE 4310 | Biomaterials | 3
BIOMEDE 4410 | Biomechanics | 3
BIOMEDE 4510 | Molecular, Cell & Tissue Engineering | 3
BIOMEDE 4610 | Biomedical Micro/Nanotechnology | 3
BIOMEDE 4710 | Introduction to Machine Learning in BME | 3
ENGR 5797 | Engineering study abroad (ENGR 5797.xx, department permission)
CSE 3521 | Survey of Artificial Intelligence I
FABENG 3481 | FABE elective
FABENG 3510 | Introduction to Biological Engineering | 3
FABENG 3610 | Utilization of Energy in Agriculture | 3
FABENG 3810 | Agricultural Structures | 3
ENVENG 3200 | Fundamentals of Environmental Engineering | 3
BIOCHEM 4511 | Biochemistry
CONSYSM 5670 | Green Building Design and Sustainable Construction | 3
EEOB 2520 | Human Physiology | 3
NEUROSC 3000 | Cellular and Molecular Neuroscience | 3
PHYSICS 3470 | Physics elective
PHYSICS 4700 | Physics elective
PHYSIO 3200 | Human Physiology | 3
THEATRE 5401 | Theatre elective
"""

MECHANICAL = {
    "id": "eng-mechanical", "kind": "degree", "name": "BS Mechanical Engineering", "min_total_credits": 130, "min_gpa": 2.0,
    "source_url": ME_URL,
    "notes": "Suggested 8-semester plan for students starting in MATH 1151 (130 credit hours). Major courses need enrollment as a "
             "MechEng-BS student. Take the GE Writing course before MECHENG 3870. Mechanical Engineering students need a 2.0 "
             "cumulative GPA to graduate.",
    "groups": [
        group("me-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), *eng_math_b(), physics_1250(),
            c("PHYSICS 1251", "E&M, Optics, Modern Physics", 5, "PHYSICS 1250; MATH 1141 or 1151; concur MATH 1152, 1161, 1172, or 1181H"),
            c("CHEM 1250", "General Chemistry for Engineers", 4, None, alternates=["CHEM 1210"]),
            c("STAT 3450", "Statistical Methods for Engineers", 2, "MATH 1152, 1161, 1172, or 1181"),
            c("MATSCEN 2010", "Introduction to Engineering Materials", 3, "PHYSICS 1250; MATH 1151; CHEM 1210 or 1250"),
            c("ISE 2040", "Engineering Economics", 2, "Sophomore standing in Engineering"),
            c("ECE 2300", "Circuits", 3, "PHYSICS 1251; MATH 1172; CPHR 2.0 or above"),
        ]),
        group("me-major", "Mechanical Engineering Major Courses", "all", [
            c("MECHENG 2010", "Statics", 2, "ENGR 1181; PHYSICS 1250; MATH 1151"),
            c("MECHENG 2020", "Mechanics of Materials", 3, "MECHENG 2010"),
            c("MECHENG 2030", "Dynamics", 3, "MECHENG 2010 or 2040"),
            c("MECHENG 2900", "Introduction to Design in Mechanical Engineering", 3, "MECHENG 2010; PHYSICS 1251; prereq or concur MATSCEN 2010"),
            c("MECHENG 2850.01", "Numerical Methods", 3, "MECHENG 2010 or 2040; prereq or concur MATH 2174, 2568, or 2415"),
            c("MECHENG 3260", "System Dynamics", 3, "MECHENG 2850; MECHENG 2030; prereq or concur MECHENG 2900; ECE 2300"),
            c("MECHENG 3360", "Systems Integration & Control", 3, "MECHENG 3260; prereq or concur MECHENG 3503, 2900; ECE 2300"),
            c("MECHENG 3501", "Thermodynamics", 3, "CHEM 1210 or 1250; prereq or concur MECHENG 2850"),
            c("MECHENG 3503", "Introduction to Fluid Mechanics", 3, "MECHENG 2850.01; MECHENG 3501"),
            c("MECHENG 3670", "Design Analysis of Machine Elements 1", 2, "MECHENG 2020; MECHENG 2030; MECHENG 2850; MATSCEN 2010"),
            c("MECHENG 3671", "Design Analysis of Machine Elements 2", 3, "MECHENG 3670; MECHENG 3751"),
            c("MECHENG 3751", "Kinematics & Mechanism Design", 2, "MECHENG 2030; MECHENG 2850"),
            c("MECHENG 3870", "Measurements & Data Analysis", 3, "STAT 3450; GE writing and information literacy; prereq or concur MECHENG 3503, 2900"),
            c("MECHENG 4510", "Heat Transfer", 3, "MECHENG 3503"),
            c("ISE 4500", "Manufacturing Process Engineering", 3, "MECHENG 3670; prereq or concur MECHENG 3503"),
            c("MECHENG 4870", "Multidisciplinary Lab", 2, "MECHENG 3360; MECHENG 3671; MECHENG 3870; prereq or concur MECHENG 4510"),
        ]),
        group("me-capstone-1", "Capstone Design 1 (MECHENG 490X.01)", "choose_credits", code_pattern=r"^MECHENG 490\d\.01",
              min_credits=2.5, notes="Prereq: MECHENG 3360, 3671, 3503, 3870; prereq or concur 4510."),
        group("me-capstone-2", "Capstone Design 2 (MECHENG 490X.02)", "choose_credits", code_pattern=r"^MECHENG 490\d\.02",
              min_credits=2.5, notes="Prereq: the matching MECHENG 490X.01."),
        group("me-tech-categories", "Technical Electives: Design, Computational & Applications (two courses)", "choose_courses",
              rows(ME_DESIGN) + rows(ME_COMPUTATIONAL) + rows(ME_APPLICATIONS), min_courses=2,
              notes="The two courses must come from different categories (Design, Computational, Applications), with at least "
                    "3 credit hours in each category; BuckAI doesn't check the categories yet."),
        group("me-tech-more", "Technical Electives: remaining hours (12 credit hours in all)", "choose_credits",
              rows(ME_OTHER, is_secondary=True), code_pattern=r"^(MECHENG|AEROENG|NUCLREN) 5\d{3}",
              exclude_codes=["MECHENG 5600", "MECHENG 5193"], min_credits=6, max_secondary_credits=3,
              notes="Any 5000-level MECHENG, AEROENG, or NUCLREN course, plus at most 3 credit hours from professional skills, "
                    "independent study, other 5000-level engineering courses (BIOMEDE, CBE, CIVILEN, CSE, ECE, ENVENG, FABENG, "
                    "ISE, MATSCEN, WELDENG...), CHEM 2310+, MATH 4000+, PHYSICS 5000+, or STAT 4201+. Research tracks "
                    "(honors and non-honors) follow different rules. Source: " + ME_TECH_URL),
        *ge_groups("me", writing_note="Must be taken before MECHENG 3870."),
    ],
}

# ---------- Aerospace Engineering ----------

AE_URL = "https://mae.osu.edu/students-starting-math-1151"
AE_TECH_URL = "https://mae.osu.edu/undergraduate/aerospace-engineering-technical-electives"

AE_AERO = """
AEROENG 5522 | Orbital Mechanics for Engineers | 3
AEROENG 5610 | Helicopter Aerodynamics | 3
AEROENG 5612 | Aircraft Performance and Flight Test Engineering | 3
AEROENG 5615 | Introduction to Computational Aerodynamics | 3
AEROENG 5616 | Advanced Flight Vehicle Design | 3
AEROENG 5620 | Stability and Control of Flight Vehicles | 3
AEROENG 5621 | Guidance, Navigation, and Control of Aerospace Vehicles | 3
AEROENG 5751 | Advanced Air Breathing Propulsion | 3
AEROENG 5752 | Advanced Space Propulsion | 3
AEROENG 5775 | Hypersonic Flow | 3
"""

AE_OTHER = """
AGSYSMT 4580 | Precision Agriculture | 2
AGSYSMT 5560 | UAS and Remote Sensing in Agriculture | 3
AGSYSMT 5580 | Data Analytics in Production Agriculture | 3
AVIATION 3900 | Air Traffic Management Systems and Environment | 3
AVIATION 4100 | Commercial Flight Fundamentals | 3
AVIATION 4400 | Airport Management | 3
AVIATION 5300 | Airport Planning, Design, and Development | 3
BIOCHEM 4511 | Introduction to Biological Chemistry | 4
BIOMEDE 4110 | Bioimaging | 3
BIOMEDE 4210 | Biotransport | 3
BIOMEDE 4310 | Biomaterials | 3
BIOMEDE 4410 | Biomechanics | 3
BIOMEDE 5110 | Biomedical Microscopic Imaging | 3
BIOMEDE 5120 | Biomedical Optics | 3
CBE 5713 | Fuel Cells & Catalysis | 3
CIVILEN 5300 | Airport Planning, Design, and Development | 3
CIVILEN 5400 | Introduction to Geographic Information Systems | 4
CIVILEN 5420 | Remote Sensing of Environment | 3
CIVILEN 5441 | Introduction to GPS: Theory and Applications | 3
CIVILEN 5461 | Geospatial Numerical Analysis | 4
CIVILEN 5700 | Urban Transportation Demand Forecasting | 3
CIVILEN 5750 | Instrumentation, Signals, and Control in Transportation Applications | 3
CIVILEN 6435 | Global Navigation Satellite Systems (GNSS) Data Processing | 3
CIVILEN 6451 | Introduction to Photogrammetry | 4
CSE 5052 | Survey of Artificial Intelligence for Non-Majors | 3
CSE 5243 | Introduction to Data Mining | 3
CSE 5441 | Introduction to Parallel Computing | 3
CSE 5442 | High-Performance Deep/Machine Learning | 3
CSE 5471 | Introduction to Cybersecurity | 3
CSE 5521 | Survey of Artificial Intelligence 1: Basic Techniques | 2
CSE 5523 | Machine Learning and Statistical Pattern Recognition | 3
CSE 5524 | Computer Vision for Human-Computer Interaction | 3
CSE 5526 | Introduction to Neural Networks | 3
CSE 5539 | Intermediate Studies in Artificial Intelligence | 2
CSE 5544 | Introduction to Data Visualization | 3
CSE 5546 | Virtual Reality | 3
ECE 5013 | Introduction to Radar Systems | 3
ECE 5050 | Humanitarian Engineering | 3
ECE 5200 | Introduction to Digital Signal Processing | 3
ECE 5206 | Medical Imaging and Processing | 3
ECE 5307 | Introduction to Machine Learning for ECE | 4
ECE 5460 | Image Processing | 3
ECE 5550 | Feedback Control Engineering for Social Justice | 3
ECE 5551 | State-Space Control Systems | 3
ECE 5553 | Autonomy in Vehicles | 3
ECE 5555 | Securing Autonomous Systems | 3
ECE 5561 | Introduction to Cybersecurity | 3
ECE 5570 | Antiracist Technology | 4
ECE 6001 | Probability and Random Variables | 3
ECE 6750 | Linear Systems Theory | 3
ENR 3335.01 | Introduction to Wildland Fire Management | 2
ENR 3335.02 | Wildland Fire Management Laboratory | 1
ENR 3800 | Principles and Tools of Ecosystem Restoration | 2
ENR 5310 | Ecological Engineering and Science | 4
ENR 5560 | The Dynamics of Ecosystem Restoration | 3
ENR 5340 | Forest Ecosystem Management | 3
ENVENG 3200 | Fundamentals of Environmental Engineering | 3
ENVENG 4218 | Measurement and Modeling of Climate Change | 3
ENVENG 4600 | Assessment for Human Rights and Sustainability | 3
ENVENG 5140 | Air Quality Engineering | 3
FABENG 3200S | Engineering for Community Development in Ohio | 3
FABENG 5310 | Ecological Engineering and Science | 4
FABENG 5330 | Environmental Biophysics | 3
ISE 5710 | Behind Human Error: Safety and Complex Systems | 3
ISE 5745 | Human-Centered Machine Learning | 3
MATH 4512 | Partial Differential Equations for Science and Engineering | 3
MATH 4530 | Probability | 3
MATH 4547 | Introductory Analysis I | 3
MATH 4556 | Dynamical Systems | 3
MATSCEN 5951 | Corrosion | 3
NUCLREN 4505 | Introduction to Nuclear Science and Engineering | 3
PUBAFRS 3000 | Public Policy Analysis | 3
PUBAFRS 3620 | US Space Policy and the Global Space Economy | 3
PUBAFRS 5600 | Science, Engineering, and Public Policy | 3
STAT 3460 | Principles of Statistics for Engineers | 2
STAT 3470 | Introduction to Probability and Statistics for Engineers | 3
STAT 4201 | Introduction to Mathematical Statistics I | 4
STAT 4620 | Introduction to Statistical Learning | 2
"""

AE_PROFESSIONAL = """
ENGR 4375 | Inclusive Leadership Practice for Emerging Professionals | 1
ENGR 5680 | Leading in Engineering Organizations | 3
ENGR 5797.25 | International Perspectives on Aviation | 3
ENGR 6230 | Technology Strategy & Innovation for Engineers | 3
ISE 3800 | Engineering Project Management | 3
MECHENG 5600 | Applied Project Management in Product Development Team Environments | 3
"""

AEROSPACE = {
    "id": "eng-aerospace", "kind": "degree", "name": "BS Aerospace Engineering", "min_total_credits": 128, "min_gpa": 2.0,
    "source_url": AE_URL,
    "notes": "Suggested 8-semester plan for students starting in MATH 1151 (128 credit hours). Most AEROENG courses are restricted "
             "to Aerospace majors and offered once a year. Aerospace Engineering students need a 2.0 cumulative GPA to graduate.",
    "groups": [
        group("ae-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), *eng_math_b(), physics_1250(),
            c("PHYSICS 1251", "E&M, Optics, Modern Physics", 5, "PHYSICS 1250; MATH 1141 or 1151; concur MATH 1152, 1161, 1172, or 1181H"),
            c("CHEM 1250", "General Chemistry for Engineers", 4, None, alternates=["CHEM 1210"]),
            c("ENGR 1221", "Introduction to MATLAB", 2, "ENGR 1181 or 1281", alternates=["CSE 1222"]),
            c("ECE 2300", "Circuits", 3, "PHYSICS 1251; MATH 1172; CPHR 2.0 or above"),
        ]),
        group("ae-major", "Aerospace Engineering Major Courses", "all", [
            c("MECHENG 2040", "Statics & Mechanics of Materials", 4, "ENGR 1181; PHYSICS 1250; MATH 1172",
              notes="MECHENG 2010 + 2020 is also accepted (AEROENG 3542 lists either)."),
            c("MECHENG 2030", "Dynamics", 3, "MECHENG 2010 or 2040"),
            c("AEROENG 2200", "Introduction to Aeronautical and Astronautical Engineering 1", 4,
              "PHYSICS 1250; MATH 1172; prereq or concur MATH 2173, CHEM 1250 or 1210", offered=["Autumn"]),
            c("AEROENG 2405", "Thermodynamics", 3, "AEROENG 2200", offered=["Spring"]),
            c("AEROENG 3520", "Flight Vehicle Dynamics", 3, "AEROENG 2200; prereq or concur MECHENG 2030, PHYSICS 1251", offered=["Spring"]),
            c("AEROENG 3521", "Flight Vehicle Control", 3, "AEROENG 3520", offered=["Autumn"]),
            c("AEROENG 3522", "Fundamental Astronautics", 3, "AEROENG 3520; AEROENG 2405", offered=["Spring"]),
            c("AEROENG 3542", "Flight Vehicle Structures 1", 3, "AEROENG 3520; MECHENG 2030; MECHENG 2040", offered=["Autumn"]),
            c("AEROENG 3543", "Flight Vehicle Structures 2", 3, "AEROENG 3542", offered=["Spring"]),
            c("AEROENG 3560", "Fluids I", 3, "AEROENG 2200; AEROENG 2405; MATH 2174; prereq or concur ECE 2300", offered=["Autumn"]),
            c("AEROENG 3570", "Gasdynamics", 3, "AEROENG 3560", offered=["Spring"]),
            c("AEROENG 3580", "Heat Transfer", 3, "AEROENG 3560; prereq or concur ECE 2300", offered=["Spring"]),
            c("AEROENG 3581", "Numerical Methods", 3, "MATH 2174", offered=["Autumn"]),
            c("AEROENG 4510", "Experimental Projects 1", 2, "AEROENG 3543; AEROENG 3570; senior standing", offered=["Autumn"], min_standing=90),
            c("AEROENG 4511", "Experimental Projects 2", 3, "AEROENG 4510", offered=["Spring"]),
            c("AEROENG 4550", "Flight Vehicle Propulsion", 3, "AEROENG 3570", offered=["Autumn"]),
        ]),
        group("ae-capstone-1", "Capstone Design 1 (choose one)", "choose_courses", rows("""
AEROENG 4515 | Preliminary Design of Atmospheric Flight Vehicles | 3 | A | AEROENG 3543; AEROENG 3570; AEROENG 3521; AEROENG 3581; AEROENG 3580; ECE 2300; prereq or concur AEROENG 4550
AEROENG 4517 | Space Vehicles and Systems 1 | 3 | A | AEROENG 3543; AEROENG 3570; AEROENG 3521; AEROENG 3581; AEROENG 3580; ECE 2300; prereq or concur AEROENG 4550
"""), min_courses=1),
        group("ae-capstone-2", "Capstone Design 2 (choose one)", "choose_courses", rows("""
AEROENG 4516 | Design of Atmospheric Flight Vehicles | 3 | S | AEROENG 4515
AEROENG 4518 | Design of Space Vehicles and Systems 2 | 3 | S | AEROENG 4517
"""), min_courses=1, notes="Follows the matching Capstone Design 1 course."),
        group("ae-tech-aero", "Technical Elective: Aerospace (at least 3 credit hours of AEROENG 5000+)", "choose_credits",
              rows(AE_AERO), code_pattern=r"^AEROENG [5-7]\d{3}", min_credits=3),
        group("ae-tech-more", "Technical Electives: remaining hours (9 credit hours in all)", "choose_credits",
              rows(AE_OTHER) + rows(AE_PROFESSIONAL, is_secondary=True), code_pattern=r"^(AEROENG|MECHENG|NUCLREN) 5\d{3}",
              exclude_codes=["MECHENG 5600"], min_credits=6, max_secondary_credits=3,
              notes="Any 5000-level AEROENG, MECHENG, or NUCLREN course, or the approved list. At most 6 credit hours from "
                    "non-aerospace courses and at most 3 from professional skills (ENGR courses, MECHENG 5600, ISE 3800). "
                    "6000/7000-level courses need permission; math used in the major core can't count again. Source: " + AE_TECH_URL),
        *ge_groups("ae"),
    ],
}

# ---------- Welding Engineering ----------

WELD_URL = "https://advising.engineering.osu.edu/media/document/2026-10-19/00-we-26-27-updated-curriculum-sheet-curriculum-change_0.pdf"

# "Any course in Engineering, Math, Biological, or Physical Sciences 3000 or higher"; WELDENG must be 4000+.
SCI_ENG_3000 = (r"^(?!WELDENG 3)(AEROENG|AVIATN|AVIATION|BIOMEDE|CBE|CIVILEN|CSE|ECE|ENGR|ENGPHYS|ENVENG|FABENG|ISE|MATSCEN|MECHENG|"
                r"NUCLREN|WELDENG|MATH|STAT|PHYSICS|CHEM|BIOCHEM|BIOLOGY|MICRBIO|MOLGEN|EEOB|EARTHSC|ASTRON) [3-7]\d{3}")

WELDING = {
    "id": "eng-welding", "kind": "degree", "name": "BS Welding Engineering", "min_total_credits": 129, "min_gpa": 2.0,
    "source_url": WELD_URL,
    "notes": "2026-2027 curriculum sheet (revised 10/19/2026), 129 credit hours. Direct admission; MATSCEN 2010 with a C or higher "
             "is required before the spring major courses, and major courses start in spring. " + GPA_NOTE,
    "groups": [
        group("weld-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), *eng_math_b(sub_2177=True, sub_2568=False), physics_1250(),
            c("PHYSICS 1251", "E&M, Optics, Modern Physics", 5, "PHYSICS 1250"),
            c("CHEM 1250", "General Chemistry for Engineers", 4, None,
              notes="CHEM 1250 is encouraged; CHEM 1210 + 1220 is also accepted."),
            c("STAT 3450", "Statistics for Engineers", 2, None),
            c("ENGR 1221", "Programming in MATLAB", 2, None, notes="Schedule with your advisor."),
            c("MECHENG 2040", "Statics & Mechanics of Materials", 4, None),
            c("ECE 2300", "Electrical Circuits and Electronic Devices", 3, None),
            c("ISE 2040", "Engineering Economics", 2, None),
        ]),
        group("weld-major", "Welding Engineering Major Courses", "all", [
            c("MATSCEN 2010", "Introduction to Materials Science & Engineering", 3, None, min_grade="C",
              notes="C or higher needed to start the spring major courses."),
            c("MATSCEN 2251", "Materials Thermodynamics", 3, None),
            c("WELDENG 2001", "Introduction to Welding Engineering", 3, "MATSCEN 2010", offered=["Spring"]),
            c("WELDENG 2601", "Introduction to Arc Welding Lab", 1, None, offered=["Spring"]),
            c("MATSCEN 3141", "Structural Transformations", 3, None),
            c("MATSCEN 3333", "Materials Processing Lab 1", 2, None),
            c("WELDENG 4001", "Physical Principles of Welding Processes & Lab", 4, None),
            c("WELDENG 4602", "Weld Procedure Development & Qualification", 3, None),
            c("WELDENG 4002", "Physical Principles of Welding Processes & Lab 2", 4, "WELDENG 4001"),
            c("WELDENG 4101", "Welding Metallurgy & Lab 1", 4, None),
            c("WELDENG 4201", "Engineering Analysis, Design, Simulation & Lab", 4, None),
            c("WELDENG 4189", "Industrial Experience", 1, None),
            c("WELDENG 4102", "Welding Metallurgy & Lab 2", 3, "WELDENG 4101"),
            c("WELDENG 4202", "Welding Design", 3, None),
            c("WELDENG 4301", "Nondestructive Evaluation & Lab", 3, None),
            c("WELDENG 4901", "Capstone Welding Design 1", 2, None),
            c("WELDENG 4902", "Capstone Welding Design 2", 3, "WELDENG 4901"),
        ]),
        group("weld-tech", "Technical Electives (7 credit hours)", "choose_credits", rows("""
CHEM 2310 | Organic Chemistry
CHEM 2510 | Organic Chemistry I | 4
WELDENG 4193.01 | Lincoln Electric Welding "Boot Camp" | 1
"""), code_pattern=SCI_ENG_3000, min_credits=7,
              notes="Any 3000-level or higher course in Engineering, Math, Biological, or Physical Sciences; WELDENG courses must be "
                    "4000-level or higher. CHEM 2310 or 2510 also count. WELDENG 4193.01 (Lincoln Electric boot camp) is encouraged."),
        *ge_groups("weld"),
    ],
}

# ---------- Electrical and Computer Engineering (Electrical and Computer Engineering programs of study) ----------

ECE_URL = "https://ece.osu.edu/worksheets-curricula-information"
EE_SHEET = "https://ece.osu.edu/media/document/2026-08-20/2026-2027-ee-bingo-sheet-8-20-26.docx"
CE_SHEET = "https://ece.osu.edu/media/document/2026-08-20/2026-2027-ce-bingo-sheet-8-20-26.docx"

# Approved non-ECE "directed electives" (the department's list is long; these subjects cover it, and the advisor confirms).
DIRECTED = (r"^(AEROENG|BIOMEDE|CBE|CIVILEN|CSE|ENGR|ENGPHYS|ENVENG|FABENG|ISE|MATSCEN|MECHENG|NUCLREN|WELDENG|MATH|STAT|"
            r"PHYSICS|CHEM|BIOCHEM|BIOLOGY|MICRBIO|MOLGEN|EEOB|EARTHSC|ASTRON|ANATOMY|BUSADM|BUSMHR|BUSFIN|BUSML|BUSOBA|ACCTMIS) [2-7]\d{3}")

EE_DOMAINS = """
ECE 5000 | Communication & DSP | 3
ECE 5101 | Communication & DSP | 3
ECE 5200 | Communication & DSP | 3
ECE 5206 | Communication & DSP
ECE 5400 | Communication & DSP
ECE 5307 | Communication & DSP (lab) | 4
ECE 3561 | Computer Systems | 3
ECE 5362 | Computer Systems | 3
ECE 5460 | Computer Systems | 3
ECE 5463 | Computer Systems | 3
ECE 5466 | Computer Systems | 3
ECE 5560 | Computer Systems | 3
ECE 5561 | Computer Systems | 3
ECE 5567.01 | Computer Systems | 3
ECE 5567.02 | Computer Systems | 3
ECE 3567 | Computer Systems (lab) | 1
ECE 4567 | Computer Systems (lab) | 4
ECE 3551 | Control Systems | 3
ECE 5050 | Control Systems or Humans & Justice | 3
ECE 5500 | Control Systems | 3
ECE 5551 | Control Systems | 3
ECE 5553 | Control Systems | 3
ECE 5554 | Control Systems | 3
ECE 5555 | Control Systems | 3
ECE 4021 | Electronic Circuits | 3
ECE 5020 | Electronic Circuits | 3
ECE 5021 | Electronic Circuits | 3
ECE 5022 | Electronic Circuits | 3
ECE 5023 | Electronic Circuits | 3
ECE 5024 | Electronic Circuits | 3
ECE 5120 | Electronic Circuits | 3
ECE 5027 | Electronic Circuits (lab) | 4
ECE 5227 | Electronic Circuits (lab) | 4
ECE 5010 | Electromagnetics & Optics | 3
ECE 5011 | Electromagnetics & Optics | 3
ECE 5012 | Electromagnetics & Optics | 3
ECE 5013 | Electromagnetics & Optics | 3
ECE 5510 | Electromagnetics & Optics | 3
ECE 5017 | Electromagnetics & Optics (lab) | 4
ECE 5025 | Energy & Power Systems | 3
ECE 5041 | Energy & Power Systems | 3
ECE 5042 | Energy & Power Systems | 3
ECE 5043 | Energy & Power Systems | 3
ECE 5244 | Energy & Power Systems | 3
ECE 3047 | Energy & Power Systems (lab) | 1
ECE 5127 | Energy & Power Systems (lab) | 1
ECE 5047 | Energy & Power Systems (lab) | 3
ECE 5031 | Solid State & Photonics | 3
ECE 5033 | Solid State & Photonics | 3
ECE 5131 | Solid State & Photonics | 3
ECE 5132 | Solid State & Photonics | 3
ECE 5530 | Solid State & Photonics | 3
ECE 5832 | Solid State & Photonics | 3
ECE 5833 | Solid State & Photonics | 3
ECE 5037 | Solid State & Photonics (lab) | 4
ECE 5537 | Solid State & Photonics (lab) | 4
ECE 5550 | Humans & Justice | 3
ECE 5078 | Empowering the Entrepreneurial Electrical and Computer Engineer (hours only, no domain)
"""

CE_TRACKS = """
ECE 5050 | Humans & Justice | 3
ECE 5550 | Humans & Justice | 3
ECE 5530 | VLSI & Computer Aided Design | 3
ECE 3030 | VLSI & Computer Aided Design | 3
ECE 4021 | VLSI & Computer Aided Design | 3
ECE 5020 | VLSI & Computer Aided Design | 3
ECE 5021 | VLSI & Computer Aided Design | 3
ECE 5560 | VLSI & Computer Aided Design; Computer Architecture & Embedded Systems | 3
ECE 5025 | VLSI & Computer Aided Design | 3
ECE 5024 | Cyber Security | 3
ECE 5555 | Cyber Security | 3
ECE 5561 | Cyber Security | 3
ECE 5567.01 | Cyber Security | 3
ECE 5567.02 | Cyber Security | 3
ECE 5500 | Machine Learning; Robotics & Control | 3
ECE 5307 | Machine Learning; Robotics & Control (lab) | 4
ECE 5460 | Machine Learning | 3
ECE 3050 | Signal Processing & Applications; Robotics & Control | 3
ECE 5200 | Signal Processing & Applications; Robotics & Control | 3
ECE 5206 | Signal Processing & Applications | 3
ECE 5013 | Signal Processing & Applications | 3
ECE 5000 | Signal Processing & Applications | 3
ECE 3551 | Robotics & Control | 3
ECE 5463 | Robotics & Control | 3
CSE 3461 | Computer Networking | 3
ECE 5101 | Computer Networking | 3
ECE 4567 | Computer Networking; Computer Architecture & Embedded Systems (lab) | 4
ECE 5465 | Computer Architecture & Embedded Systems | 3
CSE 2431 | Computer Architecture & Embedded Systems; Operating Systems & Databases | 3
ECE 5466 | Computer Architecture & Embedded Systems | 3
CSE 5441 | Computer Architecture & Embedded Systems | 3
CSE 2451 | Operating Systems & Databases | 2
CSE 2421 | Operating Systems & Databases | 4
CSE 3241 | Operating Systems & Databases | 3
CSE 3430 | Operating Systems & Databases | 3
"""

ECE_COMMON_NOTE = ("Minimum 128 credit hours; at least 30 hours of ECE courses at Ohio State; 30 hours of basic math and science; "
                   "2.0 cumulative GPA to graduate. No more than 3 credit hours of S/U coursework in the electives.")

ECE = {
    "id": "eng-ece", "kind": "degree", "name": "BS Electrical and Computer Engineering", "min_total_credits": 128, "min_gpa": 2.0,
    "source_url": ECE_URL,
    "notes": "One degree with two programs of study: Electrical Engineering and Computer Engineering (choose one as your "
             "specialization). Requirements from the 2026-2027 bingo sheets (updated 8/20/2026). " + ECE_COMMON_NOTE,
    "groups": [
        group("ece-core", "Core Courses", "all", [
            *fundamentals(hours_1181=3), *calculus(), *eng_math_b(), physics_1250(),
            c("PHYSICS 1251", "Electricity, Magnetism, Optics, and Modern Physics", 5, "PHYSICS 1250"),
            c("CSE 1222", "Programming in C++ for Engineers and Scientists", 3, None),
            c("STAT 3470", "Probability and Statistics for Engineers", 3, None),
            c("ISE 2040", "Engineering Economics", 2, None),
        ], notes="The ECE sheets list ENGR 1181 at 3 credit hours and no separate ENGR 1100 survey; other majors' 2026-2027 "
                 "sheets show ENGR 1181 (2) + ENGR 1100 (1). Confirm with your ECE advisor if your record differs."),
        group("ece-major", "ECE Major Core (both programs)", "all", [
            c("ECE 2060", "Introduction to Digital Logic", 3, None),
            c("ECE 2020", "Introduction to Analog Systems and Circuits", 3, None),
            c("ECE 2050", "Introduction to Discrete Time Signals & Systems", 3, None),
            c("ECE 2560", "Introduction to Microcontroller-Based Systems", 2, None),
            c("ECE 3020", "Introduction to Electronics", 3, None),
            c("ECE 3027", "Electronics Laboratory", 1, None),
            c("ECE 3906", "Capstone Design I", 4, None),
            c("ECE 4905", "Capstone Design II", 3, "ECE 3906", notes="Also completes the GE Reflection (GENED 4001)."),
        ]),
        group("ece-philosophy", "Philosophy requirement (choose one)", "choose_courses", rows("""
PHILOS 1332 | Philosophy (also fits GE Historical & Cultural Studies)
PHILOS 2332.01 | Philosophy (also fits GE Citizenship Theme)
PHILOS 2332.02 | Philosophy (also fits GE Citizenship Theme)
PHILOS 2338 | Philosophy (also fits GE Citizenship Theme)
"""), min_courses=1, notes="Required of all ECE students; also counts toward the GE category shown."),
        *ge_groups("ece"),
    ],
}

ECE_EE = {
    "id": "eng-ece-ee", "kind": "specialization", "parent_id": "eng-ece", "name": "Electrical Engineering",
    "source_url": EE_SHEET,
    "groups": [
        group("ee-core", "Electrical Engineering Core", "all", [
            c("CHEM 1250", "General Chemistry for Engineers", 4, None, alternates=["CHEM 1210"]),
            c("ECE 3010", "Introduction to Radio Frequency and Optical Engineering", 3, None),
            c("ECE 3030", "Semiconductor Electronic Devices", 3, None),
            c("ECE 3040", "Sustainable Energy and Power Systems I", 3, None),
            c("ECE 3050", "Signals and Systems", 3, None),
        ]),
        group("ee-tech", "Major Technical Electives (at least 16 credit hours)", "choose_credits", rows(EE_DOMAINS), min_credits=16,
              notes="6 credit hours in one domain, 3 in a second, and 3 in a third; at least one 5000-level course; at least one "
                    "lab (course numbers ending in 7). ECE 5050/5550 count as Control or Humans & Justice; ECE 5078 counts for "
                    "hours but not a domain; ECE 4670 doesn't count. BuckAI doesn't check the domain rules yet."),
        group("ee-elec-more", "Engineering Electives: remaining hours (27 credit hours in all)", "choose_credits", rows(EE_DOMAINS),
              code_pattern=DIRECTED, min_credits=11,
              notes="More technical electives, or at most 11 credit hours of approved non-ECE directed electives (courses for "
                    "other engineering majors, pre-med, business, higher math, statistics, and science). At most 2 science "
                    "courses below the 2000 level. Directed electives aren't required."),
    ],
}

ECE_CE = {
    "id": "eng-ece-ce", "kind": "specialization", "parent_id": "eng-ece", "name": "Computer Engineering",
    "source_url": CE_SHEET,
    "groups": [
        group("ce-core", "Computer Engineering Core", "all", [
            c("ECE 3561", "Advanced Digital Design", 3, None),
            c("ECE 3567", "Microcontroller Laboratory", 1, None),
            c("ECE 5362", "Computer Architecture and Design", 3, None),
            c("CSE 2221", "Software I: Software Components", 4, None),
            c("CSE 2321", "Foundations I: Discrete Structures", 3, None),
            c("CSE 2231", "Software II: Software Development and Design", 4, "CSE 2221"),
        ]),
        group("ce-tech", "Major Technical Electives (at least 12 credit hours)", "choose_credits", rows(CE_TRACKS), min_credits=12,
              notes="6 credit hours in one track (Additional Breadth isn't a track); at least one 5000-level ECE or CSE course. "
                    "CSE courses admit on space available. BuckAI doesn't check the track rule yet."),
        group("ce-elec-more", "Engineering Electives: remaining hours (25 credit hours in all)", "choose_credits", rows(CE_TRACKS),
              code_pattern=r"^(?:ECE [2-7]\d{3}|" + DIRECTED[1:] + ")", exclude_codes=["ECE 2300", "ECE 2360", "ECE 4670"], min_credits=13,
              notes="More technical electives, any approved ECE course (Additional Breadth; not ECE 2300, 2360, or 4670), or at "
                    "most 13 credit hours of approved non-ECE directed electives. At most 2 science courses below the 2000 level."),
    ],
}

# ---------- Engineering Physics (managed by the Department of Physics) ----------

EP_URL = "https://physics.osu.edu/engineering-physics-program/engineering-physics-degree-requirements"
EP_SHEET = "https://advising.engineering.osu.edu/media/document/2026-10-19/eng_phy_curriculum_sheet_26_27_math1151.pdf"
ENG_SUBJECTS = "AEROENG|BIOMEDE|CBE|CIVILEN|CSE|ECE|ENGR|ENGPHYS|ENVENG|FABENG|ISE|MATSCEN|MECHENG|NUCLREN|WELDENG"

ENGPHYS = {
    "id": "eng-engphys", "kind": "degree", "name": "BS Engineering Physics", "min_total_credits": 131, "min_gpa": 2.0,
    "source_url": EP_URL,
    "notes": "2026-2027 curriculum sheet for students starting in MATH 1151 (revised 6/9/2026), 131 credit hours. Choose one of eight "
             "engineering specializations (27 credit hours). " + GPA_NOTE,
    "groups": [
        group("ep-core", "College Core: Math, Programming & Engineering Fundamentals", "all", [
            survey(), *fundamentals(),
            c("MATH 1151", "Calculus I", 5, None, alternates=["MATH 1141", "MATH 1181H", "MATH 4181H"],
              notes="Calculus sequences: MATH 1151-1172-2173, 1151-1152-2153, 1140-1141-1152-2153, 1181H-2182H, or 4181H-4182H."),
            c("MATH 1172", "Engineering Mathematics A", 5, "C- or better in MATH 1151", alternates=["MATH 1152", "MATH 2182H", "MATH 4182H"]),
            c("MATH 2173", "Engineering Mathematics B", 3, "MATH 1172", alternates=["MATH 2153"],
              notes="Not needed after MATH 1181H-2182H or 4181H-4182H."),
            c("MATH 2174", "Differential Equations and Linear Algebra", 3, "MATH 2173", alternates=["MATH 2415", "MATH 2255", "MATH 5520H"],
              notes="MATH 2415 + 2568 or MATH 2255 + 2568 also count. The ECE specialization requires MATH 2415 and 2568."),
            c("CSE 1222", "Programming in C++", 3, None, alternates=["CSE 1223", "CSE 1224", "ENGR 1221", "ASTRON 1221", "ENGR 1281H"],
              notes="ECE and CSE specializations require CSE 1222 (CSE also accepts 1223 or 1224)."),
        ], notes="ENGR 1181/1182 may also be the scholars (.02), honors (1281H/1282), or transfer (1186, 1187, 1188) sequence."),
        group("ep-physics", "Required Physics", "all", [
            c("PHYSICS 1270", "Introductory Physics I", 5, None, alternates=["PHYSICS 1250", "PHYSICS 1250H", "PHYSICS 1260"],
              notes="PHYSICS 1248-1249-1251 also works."),
            c("PHYSICS 1271", "Introductory Physics II", 5, "PHYSICS 1270", alternates=["PHYSICS 1251", "PHYSICS 1251H", "PHYSICS 1261"]),
            c("PHYSICS 2095", "Physics Seminar", 1, None),
            c("PHYSICS 2300", "Intermediate Mechanics I", 4, None),
            c("PHYSICS 2301", "Intermediate Mechanics II", 4, "PHYSICS 2300"),
            c("PHYSICS 3700", "Data Analysis Lab", 3, None),
            c("PHYSICS 4700", "Electronics Lab", 3, None),
            c("PHYSICS 5400", "Intermediate Electromagnetism", 4, None, alternates=["PHYSICS 5400H"]),
            c("PHYSICS 5500", "Intermediate Quantum Mechanics", 4, None, alternates=["PHYSICS 5500H"]),
            c("PHYSICS 5800", "Engineering Physics Capstone Design I", 3, None, alternates=["ENGR 5901.01"],
              notes="The Multidisciplinary Capstone (ENGR 5901.01-5902.01, approval required) can replace PHYSICS 5800-5801."),
            c("PHYSICS 5801", "Engineering Physics Capstone Design II", 3, "PHYSICS 5800", alternates=["ENGR 5902.01"]),
        ]),
        group("ep-physics-elective", "Physics Elective (choose one)", "choose_courses", rows("""
PHYSICS 3470 | Optics | 3
PHYSICS 5300 | Theoretical Mechanics | 4
PHYSICS 5401H | Honors Electromagnetism II | 4
PHYSICS 5501 | Quantum Mechanics II | 4
PHYSICS 5501H | Quantum Mechanics II (Honors) | 4
PHYSICS 5600 | Statistical Mechanics | 4
PHYSICS 5680 | Big Data Analytics | 3
PHYSICS 5810 | Computational Physics | 4
"""), code_pattern=r"^PHYSICS 68\d{2}", min_courses=1, notes="Any PHYSICS 68xx course also counts."),
        group("ep-targeted", "Targeted Electives (9 credit hours)", "choose_credits",
              code_pattern=rf"^(MATH|PHYSICS|{ENG_SUBJECTS}) [2-7]\d{{3}}", min_credits=9,
              notes="Any additional math, physics, or engineering course at the 2000 level or above that isn't already required or "
                    "counting toward another elective. See https://physics.osu.edu/engineering-physics-targeted-electives"),
        *ge_groups("ep"),
    ],
}


def ep_spec(sid, name, required, electives, elective_hours):
    """An Engineering Physics specialization: required courses plus electives, 27 credit hours in all."""
    return {
        "id": f"eng-engphys-{sid}", "kind": "specialization", "parent_id": "eng-engphys", "name": f"{name} (Engineering Physics)",
        "source_url": EP_URL,
        "groups": [
            group(f"ep-{sid}-req", f"{name}: Required Courses", "all", rows(osu_codes(required))),
            group(f"ep-{sid}-elec", f"{name}: Electives ({elective_hours} credit hours)", "choose_credits",
                  rows(osu_codes(electives)), min_credits=elective_hours),
        ],
    }


EP_SPECS = [
    ep_spec("aero", "Aerospace Engineering", """
AEROENG 2200 | Introduction to Aerospace Engineering | 4 | A | Physics 1270 (or 1250 or 1260); concur: Math 2153 or 2173
AEROENG 2405 | Thermodynamics | 3 | S | AEROENG 2200
""", """
AEROENG 3520 | Flight Vehicle Dynamics | 3 | S | AEROENG 2200; concur: ME 2030 or Phys 2301
AEROENG 3521 | Fundamentals of Flight Vehicle Control | 3 | A | AEROENG 3520
AEROENG 3522 | Fundamental Astronautics | 3 | S | AEROENG 3520; prereq or concur: AEROENG 2405
AEROENG 3542 | Flight Vehicle Structures I | 3 | A | AEROENG 2200; ME 2030; ME 2040 (or ME 2010+2020)
AEROENG 3543 | Flight Vehicle Structures II | 3 | S | AEROENG 3542
AEROENG 3560 | Fundamentals of Aerodynamics | 3 | A | AEROENG 2200, 2405; Math 2174 (or Math 2568+2415); prereq or concur: ECE 2300 (petition to count Physics 4700)
AEROENG 3570 | One Dimensional Gas Dynamics | 3 | S | AEROENG 3560
AEROENG 3580 | Heat Transfer | 3 | S | AEROENG 3560
AEROENG 3581 | Numerical Methods in Aerospace Engineering | 3 | A | Math 2174 or (Math 2415+2568)
AEROENG 4550 | Principles of Flight Vehicle Propulsion | 3 | A | AEROENG 3570
AEROENG 5610 | Helicopter Aerodynamics | 3 | S | AEROENG 3570
AEROENG 5612 | Aircraft Performance & Flight Test Engineering | 3 | varies by year | AEROENG 3520 and 3570
AEROENG 5615 | Introduction to Computational Aerodynamics | 3 | A | AEROENG 3570 and 3581
AEROENG 5620 | Stability and Control of Flight Vehicles | 3 | S | AEROENG 3521
AEROENG 5621 | Guidance, Navigation, & Control of Aerospace Vehicles | 3 | varies by year | AEROENG 3521
AEROENG 5626 | Orbital Mechanics for Engineers | 3 | A | AEROENG 3520 and ME 2030
AEROENG 5751 | Advanced Air-Breathing Propulsion | 3 | S | AEROENG 4550
AEROENG 5752 | Advanced Space Propulsion | 3 | S | AEROENG 4550
AEROENG 5775.01 | Hypersonic Flow | 3 | A | AEROENG 3570
""", 20),
    ep_spec("chem", "Chemical Engineering", """
CBE 2200 | Process Fundamentals | 3 | | Chem 1210; Engr 1181 or 1281H; prereq or concur: Math 1172
""", """
CBE 2345 | Computational Methods for Chemical Engineering | 3 | | CBE 2200
CBE 2420 | Transport Phenomena I | 3 | | CBE 2200; Math 2173 or 2415
CBE 2523 | Separation Processes | 3 | | CBE 2200; prereq or concur: CBE 2420
CBE 3421 | Transport Phenomena II - Heat Transfer | 3 | | CBE 2420
CBE 3422 | Transport Phenomena III - Mass Transfer | 3 | | CBE 3421
CBE 3508 | Chemical Engineering Thermodynamics I | 3 | | CBE 2200
CBE 3509 | Chemical Engineering Thermodynamics II | 3 | | CBE 3508
CBE 3610 | Kinetics and Reactor Design | 3 | | CBE 3508
CBE 3730 | Unit Operations I | 1 | | CBE 2200
CBE 3731 | Unit Operations II | 1 | | CBE 3730
CBE 3732 | Unit Operations III | 2 | | CBE 3731
CBE 4624 | Chemical Process Dynamics and Control | 3 | | CBE 2523 or 3610
CBE 4755 | Chemical Process Safety | 2 | | CBE 3422 or 3521
CBE 4760 | Chemical Engineering Economy and Strategy | 3 | | CBE 3610; GENED 1201 or 2601
CBE 5200 | Introduction to Petroleum Engineering | 3 | S | CBE 2200
CBE 5210 | Petroleum Reservoir Engineering | 3 | A | Junior standing (rank 3)
CBE 5230 | Petroleum Drilling and Production Engineering | 3 | S | CBE 5200; Earth Sci 5661
CBE 5260 | Petroleum Project Evaluation | 3 | A | Junior standing (rank 3)
CBE 5550 | Engineering Principles in Cancer | 3 | S | CBE 2420
CBE 5713 | Fuel Cells and Catalysis | 3 | S | CBE 3508 or 3610
CBE 5715 | Particle Technology | 3 | A | CBE 2523; Math 2174 or 2415 or 2255
CBE 5730 | Industrial Biopharmaceuticals | 3 | A | CBE 2200
CBE 5734 | Molecular Informatics | 3 | S | CBE 2345
CBE 5735 | Cellular Nanotechnology | 3 | S | Junior or senior standing in the College of Engineering
CBE 5740 | Quantitative Cell Biology for Engineers and Scientists | 3
CBE 5765 | Principles of Biochemical Engineering | 3 | A | CBE 2523 or 3610
CBE 5773 | Introduction to High Polymer Engineering | 3 | A | CBE 3610
CBE 5774 | Polymer Membranes | 3 | A | CBE 3508
CBE 5775 | Rheology of Fluids | 3 | S | CBE 2420
""", 24),
    ep_spec("cse", "Computer Science and Engineering", """
CSE 2221 | Software I: Components | 4 | | CSE 1222, 1223, 1224, Engr 1221, or 1281H; prereq or concur: Math 1151
CSE 2231 | Software II: Software Development and Design | 4 | | CSE 2221; concur: CSE 2321
CSE 2321 | Foundations I: Discrete Structures | 3 | | CSE 2221; concur: CSE 2231
CSE 2421 | Systems I: Introduction to Low-Level Programming and Computer Organization | 4 | | CSE 2231, 2321
""", """
CSE 2331 | Foundations II: Data Structures and Algorithms | 3 | | CSE 2231, 2321; Stat 3460 or 3470; prereq or concur: Math 3345
CSE 2371 | Quantum Circuits and Algorithms | 3 | | Rank 2 (sophomore) or above
CSE 2431 | Systems II: Introduction to Operating Systems | 3 | | CSE 2421 and ECE 2560
CSE 3231 | Software Engineering Techniques | 3 | | CSE 3901 or 3902 or 3903
CSE 3232 | Software Requirement Analysis | 3 | | CSE 3241, 3901, 3902, 3903, or 5241
CSE 3241 | Introduction to Database Systems | 3 | | CSE 2123 or 2231; CSE 2321
CSE 3244 | Data Management in the Cloud | 3 | | CSE 3241 and 2421
CSE 3321 | Automata and Formal Languages | 3 | | CSE 2231, 2421, 2331; Math 3345
CSE 3341 | Principles of Programming Languages | 3 | | CSE 2231, 2331, 2421; CSE 3901, 3902, or 3903
CSE 3421 | Introduction to Computer Architecture | 3 | | CSE 2231; CSE 2421; ECE 2060
CSE 3430 | Overview of Computer Systems for Non-majors | 4 | | CSE 2122 or 2123; CSE 2321
CSE 3461 | Computer Networking and Internet Technologies | 3 | A | CSE 2421
CSE 3521 | Survey of Artificial Intelligence I: Basic Techniques | 3 | | CSE 2331; Math 2174 or 2568 or 5520H; Stat 3201 or 3450 or 3460 or 3470 or 4201 or Math 4530 or 5530H
CSE 3541 | Computer Game and Animation Techniques | 3 | | CSE 3901, 3902, or 3903
CSE 3901 | Project: Design, Development, and Documentation of Web Applications | 4 | | CSE 2231; CSE 2321; CSE 2421
CSE 3902 | Project: Design, Development, and Documentation of Interactive Systems | 4 | | CSE 2231; CSE 2321; CSE 2421
CSE 3903 | Project: Design, Development, and Documentation of System Software | 4 | A | CSE 2231; CSE 2321; CSE 2421
CSE 4251 | The UNIX Programming Environment | 1 | | CSE 2122, 2123, or 2231; CSE 2321
CSE 4252 | Programming in C++ | 1 | | CSE 2123 or 2231; CSE 2321
CSE 4253 | Programming in C# | 1 | | CSE 2122, 2123, or 2231; CSE 2321
CSE 4256 | Programming in Python | 1 | | CSE 2122, 2123, or 2231; CSE 2321
CSE 4471 | Information Security | 3 | | CSE 2231 and 2321
CSE 5234 | Distributed Enterprise Computing | 3 | A | CSE 2431
CSE 5236 | Mobile Application Development | 3 | | CSE 3901 or 3902 or 3903
CSE 5242 | Advanced Database Management Systems | 3 | A | CSE 3241 and CSE 2421
CSE 5243 | Introduction to Data Mining | 3 | S | CSE 3241 and CSE 2331
CSE 5245 | Introduction to Network Science | 3 | | CSE 2331
CSE 5343 | Compiler Design and Implementation | 3 | S | CSE 3341; one of CSE 3901, 3902, 3903
CSE 5351 | Introduction to Cryptography | 3 | S | CSE 2331; Statistics 3460 or 3470
CSE 5361 | Numerical Methods | 3 | S | CSE 2231 and Math 2568
CSE 5441 | Introduction to Parallel Computing | 3 | | CSE 2231, 2321, and 2421
CSE 5462 | Network Programming | 3 | S | CSE 3461
CSE 5463 | Introduction to Wireless Networking | 3 | S | CSE 3461; Statistics 3450 or 3470
CSE 5471 | Introduction to Cybersecurity | 3 | | Junior standing (rank 3) or higher
CSE 5472 | Information Security Projects | 3 | A | One of CSE 3901, 3902, 3903; CSE 3461, 5461, or 4471
CSE 5473 | Network Security | 3 | S | CSE 3461
CSE 5474 | Software Security | 3 | S | CSE 2431
CSE 5523 | Machine Learning and Statistical Pattern Recognition | 3 | | CSE 3521; CSE 5522, Stat 3460, or Stat 3470; Math 2568, 2174, or 5520H
CSE 5524 | Computer Vision for Human-Computer Interaction | 3 | | CSE 2331
CSE 5525 | Foundations of Speech and Language Processing | 3 | | CSE 3521; CSE 5522, Stat 3460, or Stat 3470
CSE 5526 | Introduction to Neural Networks | 3 | | CSE 3521
CSE 5542 | Real-Time Rendering | 3 | | One of CSE 3901, 3902, 3903; Math 2568
CSE 5544 | Introduction to Data Visualization | 3 | | CSE 5361
""", 12),
    ep_spec("ece", "Electrical and Computer Engineering", """
ECE 2020 | Introduction to Analog Systems and Circuits | 3 | | Math 1152 or 1172 or 1181H; Physics 1250, 1260, or 1270
ECE 2050 | Introduction to Discrete Time Signals & Systems | 3 | | ECE 2060; CSE 1222; prereq or concur: Math 2174 or 2568
ECE 2060 | Introduction to Digital Logic | 3
""", """
ECE 2300 | Electrical Circuits and Electronic Devices | 3 | | Physics 1251 or 1261 or 1271; Math 1172, 2153, 2182H, or 4182H
ECE 2560 | Introduction to Microcontroller-Based Systems | 2 | | ECE 2060; prereq or concur: CSE 1222 or ENGR 1281H
ECE 3010 | Introduction to Radio Frequency and Optical Engineering | 3 | | ECE 2020; Physics 1251, 1261, or 1271; Math 2415 or 2174
ECE 3020 | Introduction to Electronics | 3 | | ECE 2020
ECE 3027 | Electronics Laboratory | 1 | | ECE 3020
ECE 3030 | Semiconductor Electronic Devices | 3 | | Physics 1251, 1261, or 1271; Chemistry 1210 or 1250; prereq or concur: Math 2415 or 2174
ECE 3040 | Sustainable Energy and Power Systems I | 3 | | ECE 2020
ECE 3047 | Sustainable Energy and Energy Conversion Lab | 1 | | ECE 3040
ECE 3050 | Signals and Systems | 3 | | ECE 2020, 2050, and 2060; Math 2568
ECE 3551 | Introduction to Feedback Control Systems | 3 | | ECE 3050
ECE 3561 | Advanced Digital Design | 3 | | ECE 2060; prereq or concur: ECE 3020
ECE 3567 | Microcontroller Lab | 1 | | ECE 2560
ECE 4021 | Analog Integrated Circuits I | 3 | A | ECE 3020
ECE 5010 | Wireless Propagation and Remote Sensing | 3 | A | ECE 3010
ECE 5012 | Integrated Optics | 3 | S | ECE 3010
ECE 5013 | Introduction to Radar Systems | 3 | S | ECE 3050; ECE 3010; Statistics 3470
ECE 5020 | Mixed Signal VLSI | 3 | A | ECE 3020
ECE 5021 | Analog Integrated Circuits II | 3 | S | ECE 4021
ECE 5022 | Introduction to RF Systems | 3 | A | ECE 4021
ECE 5025 | Power Electronics: Devices, Circuits, and Applications | 3 | A | ECE 3020
ECE 5027 | Microwave Electronics | 4 | S | ECE 3020
ECE 5031 | Semiconductor Process Technology | 3 | S | ECE 3030
ECE 5033 | Surfaces and Interfaces of Electronics Materials | 3 | A | ECE 3030
ECE 5037 | Solid State Electronics and Photonics Laboratory | 4 | A | prereq or concur: ECE 3030
ECE 5041 | Electric Machines | 3 | S | ECE 3020 and 3040
ECE 5042 | Power Systems | 3 | A | ECE 3040
ECE 5050 | Humanitarian Engineering | 3 | S | Engineering 1182 or 1282H
ECE 5078 | Empowering the Entrepreneurial Electrical and Computer Engineer | 3 | S | prereq or concur: ECE 3010, 3020, 3030, 3040, or 3050
ECE 5101 | Introduction to Wireless Networking | 3 | S | ECE 3561; Statistics 2450 or 3470
ECE 5131 | Lasers | 3 | A | ECE 3010 or 3030
ECE 5227 | Fundamentals of Power Management Integrated Circuits for VLSI Systems | 4 | S | ECE 4021
ECE 5244 | Si and Wide Band Gap Power Devices | 3 | A | ECE 3030
ECE 5362 | Computer Architecture and Design | 3 | | ECE 2560 and 3561
ECE 5400 | Instrumentation, Signals, and Control in Transportation Applications | 3 | | ECE 2020 and 2050; Math 2415
ECE 5460 | Image Processing | 3 | A | Statistics 3470 and Math 2568
ECE 5463 | Introduction to Real Time Robotics Systems | 3 | | Math 2174 or (Math 2415 and 2568); Physics 1250, 1260, or 1270; CSE 1222, ENGR 1181, ENGR 1281H, or ENGR 1222
ECE 5466 | Embedded Computer Systems | 3 | S | ECE 5362
ECE 5510 | Introduction to Computational Electromagnetics | 3 | to be announced | ECE 3010
ECE 5530 | Fundamentals of Semiconductors for Microelectronics and Photonics | 3 | A | ECE 3030
ECE 5537 | Semiconductor Device Characterization and Modelling Lab | 4 | S | ECE 3030
ECE 5551 | State-Space Control Systems | 3 | A | ECE 3050 and Statistics 3470
ECE 5553 | Autonomy in Vehicles | 3 | S | ECE 3551
ECE 5554 | Powertrain Control Systems | 3 | S | ECE 3551
ECE 5561 | Introduction to Cybersecurity | 3 | | Junior (rank 3) standing or above
ECE 5832 | Photovoltaics and Energy Conversion | 3 | A | ECE 3030
ECE 5833 | Organic and Printed Flexible Electronics | 3 | S | ECE 3030
""", 18),
    ep_spec("ise", "Industrial and Systems Engineering", """
ISE 2400 | Design of Work: Methods and Measurements | 2 | | Sophomore standing (rank 2)
ISE 2500 | Introduction to Manufacturing Engineering | 3
ISE 3200 | Linear and Integer Programming | 3 | | Math 2568 or 2174; CSE 1222, CSE 1223, CSE 1224, or Engineering 1281H
""", """
ISE 2040 | Engineering Economics (ISE 2040.01 in person or 2040.02 online) | 2 | | Sophomore standing (rank 2) or above
ISE 3210 | Nonlinear and Dynamic Optimization | 3 | | ISE 3200
ISE 3400 | Production Planning and Facilities Design | 4 | | ISE 3200 and Statistics 3470
ISE 3500 | Process Engineering for Machining Operations | 3 | | ISE 2400
ISE 3600 | Workplace Ergonomics: Analysis and Design of Physical Work Systems | 3 | | ISE 2040 and Statistics 3470
ISE 3700 | Cognitive Engineering Systems | 3 | | ISE 2400
ISE 3800 | Engineering Project Management | 3 | | ISE 2400
ISE 4100 | Stochastic Modeling and Simulation | 4 | | ISE 2400 and Statistics 3470
ISE 4120 | Quality and Reliability Engineering | 3 | | Junior standing (rank 3); Statistics 3470
ISE 4500 | Manufacturing Process Engineering | 3 | | ME 2020; Welding Engineering 4201 or ME 3500 or MSE 3151
ISE 4510 | Manufacturing Engineering | 3 | | ISE 2500
ISE 5110 | Design of Engineering Experiments | 3 | | ISE 4210
ISE 5200 | Linear Optimization | 3 | A | Math 2174, 2415, or 2568
ISE 5220 | Complementarity Theory & Applications | 3 | S | ISE 3200
ISE 5230 | Decomposition Techniques in Mathematical Programming | 3 | A | ISE 3200 and 3210
ISE 5350 | Probabilistic Models and Methods in Operations Research | 3 | S | ISE 3200 and Statistics 3470
ISE 5410 | Quantitative Models in Production and Distribution Logistics | 3 | A | ISE 3210 and 3400
ISE 5520 | Industrial Automation | 1.5 | | ISE 2500
ISE 5525 | Industrial Robotics | 1.5 | | Engineering 1182, 1282H, or 1188; junior standing (rank 3) or above
ISE 5540 | Polymer Processing Fundamentals | 3 | S | ME 2020 or ME 2040; prereq or concur: MSE 2251 or ME 4510
ISE 5555 | Manufacturing Processes and Machine Tools | 3 | S | Junior or senior (rank 3 or 4) in Engineering
ISE 5570 | Manufacturing Data Processing and Analysis | 3 | A | CSE 1222, 1223, 1224, or 2021; Statistics 3470, 3450, or 3460
ISE 5610 | Ergonomics in the Product Design Process | 3 | A | ISE 3600 and 3700
ISE 5620 | Risk Assessment Tools for Occupational Musculoskeletal Disorders | 3 | S | ISE 3600
ISE 5740 | Cognitive Engineering Systems: Human-Centered Automation | 3 | A | Senior standing (rank 4)
ISE 5745 | Human-Centered Machine Learning | 3 | S | Senior standing (rank 4)
ISE 5760 | Visual Analytics and Sensemaking | 3 | | Junior or senior standing (rank 3 or 4)
ISE 5800 | Advanced Project Management | 3 | | ISE 3800
ISE 5830 | Decision Analysis | 3 | A | ISE 2040 and Statistics 3470
ISE 5870 | Resilience Engineering | 3 | S | Senior standing (rank 4)
""", 19),
    ep_spec("mse", "Materials Science and Engineering", """
MSE 2010 | Introduction to Engineering Materials | 3 | | Physics 1250, 1260, or 1270; Math 1151; Chemistry 1210, 1250, or 1910H
MSE 2241 | Structure and Characterization of Materials | 3 | S | MSE 2010
MSE 2251 | Thermodynamics of Materials | 3 | S | MSE 2010
MSE 2331 | Structure and Characterization Lab | 2 | S | MSE 2010
""", """
MSE 2321 | Modeling and Simulation Lab I | 3 | S | MSE 2010
MSE 3141 | Transformation and Processing of Materials | 3 | A | MSE 2251
MSE 3151 | Transport Phenomena and Kinetics | 3 | A | MSE 2010, 2241; Math 2174 or 2415
MSE 3261 | Introduction to the Mechanical Behavior of Materials | 3 | S | MSE 2010; ME 2020 or 2040
MSE 3271 | Electronic Properties | 3 | S | MSE 2010; Math 1151; Physics 1251, 1261, or 1271
MSE 3321 | Modeling and Simulation Lab II | 2 | S | MSE 3231, 3141, and 3151
MSE 3331 | Materials Science and Engineering Lab I | 2 | A | MSE 2331
MSE 3332 | Materials Science and Engineering Lab II | 2 | S | MSE 2241, 2331, and 2251
MSE 3611 | Biological Response to Biomaterials | 3 | S | MSE 2010
MSE 4181 | Materials Selection | 2 | A | MSE 2241, 2331, 2251, and 2321
MSE 4321 | Modeling and Simulation-Based Design | 3 | A | MSE 2321 and 3321
MSE 5431 | Advanced Metals Laboratory | 1 | A | MSE 2241, 2331, 3141, 3261, and 3332; prereq or concur: MSE 5441 or 5451
MSE 5441 | Physical Metallurgy | 3 | A | MSE 3141 and 3261
MSE 5451 | Molten Metal Processing | 3 | S | MSE 2251 or 3151
MSE 5531 | Ceramics Processing Laboratory | 1 | | MSE 3141, 3261, 3271, and 3332
MSE 5551 | Ceramic Processing | 3 | A | MSE 3141 and 3151
MSE 5571.71 | Electroceramics I: Electronic and Ionic Conductors | 1.5 | S | MSE 3271
MSE 5571.72 | Electroceramics II: Dielectric, Magnetic, and Optical Ceramics | 1.5 | S | MSE 3271
MSE 5572 | Materials for Energy Technology | 3 | A | MSE 2241 and MSE 3271
MSE 5575 | Ultrafast Laser Materials Processing | 3 | A | Math 1172; prereq or concur: Physics 1251, 1261, or 1271
MSE 5631 | Biomaterials Laboratory | 1 | A | prereq or concur: MSE 5641
MSE 5641 | Structure-Property Relationships of Polymers | 3 | A | MSE 2010
MSE 5651 | Biomaterials Processing | 3 | S | MSE 5641
MSE 5711.70 | Introduction to Composites | 1.5 | S | MSE 3261
MSE 5761.71 | Mechanical Behavior of Crystalline Solids at Lower Temperatures | 1.5 | A | MSE 3261 or 3332
MSE 5763.70 | Fracture and Fatigue of Engineering Materials | 1.5 | A | MSE 3261
MSE 5951 | Corrosion | 3 | | Senior standing (rank 4)
MSE 5952 | Failure Analysis of Materials | 3 | S | Senior standing (rank 4)
""", 16),
    ep_spec("mech", "Mechanical Engineering", """
ME 2010 | Statics | 2 | | ENGR 1181 or 1281H; Physics 1250, 1260, or 1270; Math 1151
""", """
ME 2020 | Introduction to Mechanics of Materials | 3 | | ME 2010
ME 2030 | Dynamics | 3 | | ME 2010
ME 2850.01 | Numerical Methods in Mechanical Engineering | 3 | | ME 2010; prereq or concur: Math 2174, 2568, or 2415
ME 2900 | Introduction to Design in Mechanical Engineering | 3 | A | ME 2010; Physics 1251, 1261, or 1271
ME 3260 | System Dynamics and Vibrations | 3 | | ME 2850 and 2030; prereq or concur: ME 2900 or ECE 2300
ME 3360 | System Integration and Control | 3 | | ME 3260; prereq or concur: ME 3503, ME 2900, and ECE 2300
ME 3500 | Engineering Thermal Sciences | 3 | | Math 2174, 2255, or 2415; Physics 1250, 1260, or 1270
ME 3501 | Introduction to Engineering Thermodynamics | 3 | | Chemistry 1210 or 1250; prereq or concur: ME 2850
ME 3503 | Introduction to Fluid Mechanics | 3 | | ME 2850 and 3501
ME 3670 | Design and Analysis of Machine Elements I | 2 | | ME 2020, 2030, and 2850
ME 3671 | Design and Analysis of Machine Elements II | 3 | | ME 3670 and 3751
ME 3751 | Kinematics and Mechanism Design | 2 | | ME 2030 and 2850
ME 3870 | Introduction to Measurements and Data Analysis in Mechanical Engineering | 3 | | Statistics 3450; GE Writing and Information Literacy; prereq or concur: ME 3503 and 2900
ME 4505 | Introduction to Nuclear Science and Engineering | 3 | | Math 2153 or above; PHYSICS 1251, 1261, or 1271
ME 4510 | Heat Transfer | 3 | | ME 3503
ME 4536 | Nuclear Reactor Systems | 3 | S | ME 4505
ME 5003 | Nuclear Reactor Systems and Analysis | 3 | S | ME 4505 and ME 3501
ME 5030 | Intermediate Dynamics | 3 | S | ME 2030
ME 5134 | Introduction to Vibrations of Deformable Solids | 3 | S | ME 2020; Math 2174 or 2415
ME 5139 | Applied Finite Element Method | 3 | | ME 2020
ME 5144 | Engineering Fracture Mechanics | 3 | S | ME 2020; Math 2174 or 2415
ME 5234 | Vehicle Dynamics | 4 | S | ME 3360 and 3671
ME 5240 | Mechanical Vibrations | 3 | A | ME 3260; prereq or concur: ME 3360
ME 5339 | Simulation Techniques for Dynamic Systems | 3 | | ME 3360
ME 5372 | Theory and Applications of Feedback Control | 3 | S | ME 3360
ME 5374 | Smart Materials and Intelligent Systems | 3 | A | ME 3360
ME 5427 | Introduction to Turbomachinery | 3 | | ME 3503
ME 5463 | Introduction to Real Time Robotics Systems | 3 | | Math 2174 or (Math 2415 and 2568); Physics 1250, 1260, or 1270
ME 5530 | Internal Combustion Engines | 3 | A | ME 3501
ME 5539 | Applied Computational Fluid Dynamics and Heat Transfer | 3 | | ME 3501 and ME 3503; prereq or concur: ME 4510
ME 5541 | Heating, Ventilating, and Air Conditioning | 3 | S | ME 4510
ME 5550 | Engineering Principles in Cancer | 3 | S | ME 3500 or ME 3503
ME 5600 | Applied Project Management in Product Development Team Environments | 3 | A | Junior or senior standing (rank 3 or 4)
ME 5670 | Advanced MCAD Modeling with CATIA | 3 | S | ME 3670
ME 5680 | Computer Aided Design and Manufacturing | 4 | | ME 3670
ME 5682.01 | Fundamentals of Product Design Engineering | 3 | | Junior or senior standing (rank 3 or 4)
ME 5751 | Design and Manufacturing of Compliant Mechanisms and Robots | 3 | | ME 3670
""", 25),
    ep_spec("nuclear", "Nuclear Engineering", """
NE 4505 | Introduction to Nuclear Science and Engineering | 3 | | Math 2153 or above; Physics 1251, 1261, or 1271
""", """
NE 4506 | Undergraduate Nuclear Engineering Laboratory | 3 | A | NE 4505
NE 4536 | Nuclear Reactor Systems | 3 | S | NE 4505
NE 5001 | Interactions of Radiation with Matter | 3 | A | NE 4505
NE 5002 | Reactor Physics | 3 | A | NE 4505
NE 5003 | Nuclear Reactor Systems and Analysis | 3 | S | NE 4505 and ME 3500
NE 5004 | Materials in Nuclear Systems | 3 | S | Senior standing (rank 4)
NE 5606 | Radiation Protection and Shielding | 3 | S | Math 2153 or 2173; Physics 1250, 1260, or 1270
NE 5610 | Reactor Safety | 3 | S | NE 4505
NE 5735 | Nuclear Power Plant Operations | 3 | S | NE 4505
NE 5742 | Nuclear Instrumentation, Radiation Sensor and Detection | 3 | S
NE 5776 | Nuclear Fuel Cycle and Radioactive Waste Management | 3 | A | NE 4505
ME 3500 | Engineering Thermal Sciences | 3 | | Math 2174, 2255, or 2415; Physics 1250, 1260, or 1270
""", 24),
]

# ---------- Materials Science and Engineering ----------

MSE_URL = "https://advising.engineering.osu.edu/media/document/2026-10-19/00-mse-2026-2027-gen-curriculum-sheet_0.pdf"

MATERIALS = {
    "id": "eng-materials", "kind": "degree", "name": "BS Materials Science and Engineering", "min_total_credits": 127, "min_gpa": 2.0,
    "source_url": MSE_URL,
    "notes": "Curriculum sheet revised 10/19/2026 (127 credit hours; the sheet's heading still says 2025-2026). Direct admission; "
             "major courses start in spring after MATSCEN 2010 with a C or higher. Focus areas: Biomaterials, Ceramics, Electronic "
             "Materials, Metallurgy, or Polymers (chosen through electives). " + GPA_NOTE,
    "groups": [
        group("mse-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), physics_1250(),
            c("PHYSICS 1251", "E&M, Optics, Modern Physics", 5, "PHYSICS 1250"),
            c("MATH 2177", "Ordinary & Partial Differential Equations", 4, "MATH 1172", equivalents=["MATH 2173"],
              notes="MATH 2173 + 2174 substitutes for MATH 2177 (the sheet prints this as \"Math 2174 + 2174\")."),
            c("MECHENG 2040", "Statics & Mechanics of Materials", 4, None),
        ]),
        group("mse-chem", "Chemistry (two courses)", "choose_courses", rows("""
CHEM 1250 | General Chemistry for Engineers | 4
CHEM 1210 | General Chemistry I | 5
CHEM 1220 | General Chemistry II | 5
CHEM 2310 | Introductory Organic Chemistry | 4
"""), min_courses=2, notes="CHEM 1250 + 2310 (8 hours), CHEM 1210 + 1220 (10 hours), or CHEM 1250 + 1220 (9 hours)."),
        group("mse-major", "Materials Science & Engineering Major Courses", "all", [
            c("MATSCEN 2010", "Introduction to Engineering Materials", 3, "PHYSICS 1250; MATH 1151; CHEM 1210 or 1250", min_grade="C",
              notes="C or higher needed to start the major courses."),
            c("MATSCEN 2241", "Structure & Characterization", 3, "MATSCEN 2010", offered=["Spring"]),
            c("MATSCEN 2331", "Structure & Characterization Lab", 2, "MATSCEN 2010", offered=["Spring"]),
            c("MATSCEN 2251", "Materials & Thermodynamics", 3, "MATSCEN 2010", offered=["Spring"]),
            c("MATSCEN 2321", "Modeling & Simulation 1", 3, "MATSCEN 2010", offered=["Spring"]),
            c("MATSCEN 3141", "Structural Transformations", 3, "MATSCEN 2251", offered=["Autumn"]),
            c("MATSCEN 3151", "Transport & Kinetics", 3, "MATSCEN 2010; MATSCEN 2241; MATH 2174 or 2415", offered=["Autumn"]),
            c("MATSCEN 3331", "Materials Lab 1", 2, "MATSCEN 2331", offered=["Autumn"]),
            c("MATSCEN 3271", "Electronic Materials", 3, None),
            c("MATSCEN 3261", "Mechanical Behavior of Materials", 3, "MATSCEN 2010; MECHENG 2020 or 2040", offered=["Spring"]),
            c("MATSCEN 3321", "Modeling & Simulation 2", 2, None, offered=["Spring"]),
            c("MATSCEN 3332", "Materials Lab 2", 2, "MATSCEN 2241, 2331, and 2251", offered=["Spring"]),
            c("MATSCEN 4181", "Materials Selection", 2, "MATSCEN 2241, 2331, 2251, and 2321", offered=["Autumn"]),
            c("MATSCEN 4381", "Senior Design 1", 3, None),
            c("MATSCEN 4382", "Senior Design 2", 3, "MATSCEN 4381"),
        ]),
        group("mse-electives", "MATSCEN Electives (15 credit hours of MATSCEN 5000+, including one lab)", "choose_credits",
              code_pattern=r"^MATSCEN [5-7]\d{3}", min_credits=15,
              notes="One of these must be a 1-credit MATSCEN 5000-level lab. Choose by focus area."),
        group("mse-tech", "Technical Electives (6 credit hours)", "choose_credits", rows("""
ECE 2300 | Electrical Circuits and Electronic Devices (Electronic Materials) | 3
CHEM 2310 | Organic Chemistry (Biomaterials, Polymers; if not used for chemistry) | 4
CHEM 2510 | Organic Chemistry I (Biomaterials, Polymers) | 4
BIOLOGY 1113 | Biological Sciences: Energy Transfer and Development (Biomaterials) | 4
"""), code_pattern=SCI_ENG_3000.replace("(?!WELDENG 3)", ""), min_credits=6,
              notes="Graded courses in Engineering, Math, Biological, or Physical Sciences numbered 3000 or higher, plus the listed exceptions."),
        *ge_groups("mse"),
    ],
}


# ---------- Food, Agricultural and Biological Engineering (four specializations) ----------

FABE_SHEETS = SHEETS
FABE_TE_NOTE = ("The approved lists are in your Buckeye Degree Planner (not published online); BuckAI counts engineering and science "
                "courses at the 3000 level or higher, so confirm each choice with your FABE advisor.")
FABE_TE = SCI_ENG_3000.replace("(?!WELDENG 3)", "").replace("AEROENG|", "AEROENG|FDSCTE|ENR|AGSYSMT|FABENG|")

FABE = {
    "id": "eng-fabe", "kind": "degree", "name": "BS Food, Agricultural and Biological Engineering", "min_total_credits": 132,
    "min_gpa": 2.0, "source_url": FABE_SHEETS,
    "notes": "2026-2027 curriculum sheets (revised 7/2026), 132 credit hours. Choose one specialization: Food, Agricultural, "
             "Biological, or Ecological Engineering. Course numbers use the official subject FABENG (the sheets write FABE). "
             "A senior exit survey is required. " + GPA_NOTE,
    "groups": [
        group("fabe-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), physics_1250(),
            c("PHYSICS 1251", "E&M, Optics, Modern Physics", 5, "PHYSICS 1250"),
            c("MATH 2177", "Mathematical Topics for Engineers", 4, "MATH 1172"),
            c("ENGR 1221", "Computer Programming (MATLAB)", 2, None, alternates=["CSE 1222", "CSE 1224"]),
            c("ISE 2040", "Engineering Economics (ISE 2040.01 or .02)", 2, None),
        ]),
        group("fabe-major", "FABE Major Courses", "all", [
            c("FABENG 2100", "Introduction to FABE / Energy in Biological Systems", 1, None),
            c("FABENG 2110", "Fluid Mechanics in FABE", 3, None),
            c("FABENG 3120", "Thermodynamics in FABE", 4, "MATH 2177 or 2174 (or concurrent)", offered=["Autumn"]),
            c("FABENG 3130", "Heat & Mass Transfer in FABE", 4, None),
            c("FABENG 3140", "Professional Development in FABE", 1, None),
            c("FABENG 3150", "System Dynamics & Electricity", 4, None),
            c("FABENG 5160", "Electronics, Measurement & Instrumentation", 4, None),
            c("FABENG 4900", "Capstone Design 1", 3, None),
            c("FABENG 4910", "Capstone Design 2", 3, "FABENG 4900"),
        ]),
        *ge_groups("fabe"),
    ],
}


def fabe_spec(sid, name, courses, electives):
    return {
        "id": f"eng-fabe-{sid}", "kind": "specialization", "parent_id": "eng-fabe", "name": f"{name} Engineering (FABE)",
        "source_url": FABE_SHEETS, "groups": [group(f"fabe-{sid}-req", f"{name} Engineering: Required Courses", "all", courses), *electives],
    }


GRAPHICS = c("FABENG 3171", "Computer Graphics (AutoCAD)", 2, None, alternates=["FABENG 3170"],
             notes="FABENG 3170 (SolidWorks, spring only) also counts.")

FABE_SPECS = [
    fabe_spec("food", "Food", [
        c("CHEM 1210", "General Chemistry 1", 5, None, equivalents=["CHEM 1206"], notes="CHEM 1206 + 1208 substitutes for CHEM 1210."),
        c("CHEM 1220", "General Chemistry 2", 5, "CHEM 1210"),
        c("CHEM 2310", "Organic Chemistry", 4, "CHEM 1220"),
        c("BIOLOGY 1113.01", "Biological Analysis", 4, None),
        c("MICRBIO 4000.01", "Basic Microbiology", 4, None),
        c("BIOCHEM 5721", "Physical Biochemistry 1", 3, None),
        c("FDSCTE 5536", "Food Microbiology", 3, None),
        GRAPHICS,
        c("FABENG 4410", "Unit Operations in Food Engineering", 3, None),
        c("FABENG 5405", "Food Engineering Kinetics", 4, None),
        c("FABENG 5410", "Advanced Food Engineering", 3, None),
    ], [group("fabe-food-tech", "Technical Electives (8 credit hours)", "choose_credits", code_pattern=FABE_TE, min_credits=8,
              notes=FABE_TE_NOTE)]),
    fabe_spec("ag", "Agricultural", [
        c("CHEM 1250", "Chemistry for Engineers", 4, None, alternates=["CHEM 1210"], equivalents=["CHEM 1206"],
          notes="CHEM 1210 or CHEM 1206 + 1208 also accepted."),
        c("MECHENG 2010", "Statics", 2, None),
        c("MECHENG 2020", "Mechanics of Materials", 3, "MECHENG 2010"),
        c("MECHENG 2030", "Dynamics", 3, "MECHENG 2010"),
        c("FABENG 2710", "Surveying", 2, None),
        c("FABENG 2720", "Principles of Soil & Water Engineering", 2, None),
        c("FABENG 3810", "Agricultural Structures", 3, None),
        c("FABENG 3610", "Utilization of Energy in Agriculture", 3, None),
        GRAPHICS,
        c("FABENG 5820", "Environmental Controls & Air Quality", 3, None),
        c("FABENG 5730", "Design of Agricultural Water Management Systems", 3, None),
    ], [group("fabe-ag-tech", "Applied Science & Technical Electives (18 credit hours, at least one Applied Science Elective)",
              "choose_credits", code_pattern=FABE_TE, min_credits=18, notes=FABE_TE_NOTE)]),
    fabe_spec("bio", "Biological", [
        c("CHEM 1210", "General Chemistry 1", 5, None, equivalents=["CHEM 1206"], notes="CHEM 1206 + 1208 substitutes for CHEM 1210."),
        c("CHEM 1220", "General Chemistry 2", 5, "CHEM 1210"),
        c("CHEM 2310", "Introductory Organic Chemistry", 4, "CHEM 1220"),
        c("MICRBIO 4000.01", "Basic Microbiology", 4, None),
        c("BIOLOGY 1113.01", "Energy Transfer and Development", 4, None),
        c("MECHENG 2040", "Statics & Mechanics of Materials", 4, None),
        c("FABENG 3500", "Biological Engineering", 3, None),
        c("FABENG 4500", "Advanced Biological Engineering", 2, "FABENG 3500"),
        GRAPHICS,
    ], [group("fabe-bio-tech", "Applied Science & Technical Electives (15 credit hours, at least one Applied Science Elective)",
              "choose_credits", code_pattern=FABE_TE, min_credits=15, notes=FABE_TE_NOTE)]),
    fabe_spec("eco", "Ecological", [
        c("CHEM 1250", "Chemistry for Engineers", 4, None, alternates=["CHEM 1210"],
          notes="Students who take CHEM 1210 (or 1206 + 1208) instead must also take CHEM 1220 before CHEM 2310."),
        c("CHEM 2310", "Introductory Organic Chemistry", 4, "CHEM 1250 or 1220"),
        c("BIOLOGY 1114.01", "Biological Sciences", 4, None),
        c("EEOB 3410", "Ecology", 4, None),
        c("MECHENG 2040", "Statics & Mechanics of Materials", 4, None),
        c("FABENG 2710", "Surveying", 2, None),
        c("FABENG 2720", "Principles of Soil/Water Engineering", 2, None),
        c("FABENG 3171", "Computer Graphics (AutoCAD)", 2, None),
        c("FABENG 5310", "Ecological Engineering & Science", 4, None, offered=["Spring"]),
        c("FABENG 5750", "Stream Geomorphology & Watershed Hydrology", 3, None),
        c("FABENG 5550", "Sustainable Waste Management", 3, None),
    ], [
        group("fabe-eco-tech", "Technical Electives (6 credit hours)", "choose_credits", code_pattern=FABE_TE, min_credits=6,
              notes=FABE_TE_NOTE),
        group("fabe-eco-ecology", "Advanced Ecology Electives (6 credit hours)", "manual",
              notes="Two approved Advanced Ecology Electives (3 credit hours each). The list is in your Buckeye Degree Planner."),
    ]),
]

# ---------- Computer Science and Engineering ----------

CSE_URL = "https://cse.osu.edu/prospective-students/undergrad/majors/bs-cse-program-information"

CSE_BS = {
    "id": "eng-cse", "kind": "degree", "name": "BS Computer Science and Engineering", "min_total_credits": 126, "min_gpa": 2.0,
    "source_url": CSE_URL,
    "notes": "Requirements for students who entered in or after Autumn 2022 (126 credit hours), from the CSE department's program "
             "page (the college's linked curriculum sheet was last updated 3/22/2023). Admission to the major requires an "
             "application. Every student also picks a CSE specialization, which sets some of the technical electives; BuckAI "
             "checks the overall technical elective hours, not each specialization's list. A program outcomes exit test (POCAT) "
             "is required in the graduation term. " + GPA_NOTE,
    "groups": [
        group("cse-college", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), physics_1250(),
        ], notes="CSE 1223 (or 1222, 1224, ENGR 1281H) is a prerequisite for CSE 2221, not part of the 126 hours; a passing CSE 2221 "
                 "placement test also meets it."),
        group("cse-nonmajor", "Required Non-CSE Courses", "all", [
            c("ECE 2360", "Electronics for CSE Majors", 3, None, alternates=["ECE 2020"],
              notes="Students who entered before Autumn 2022 may take ECE 2020 (ECE 2360 is preferred)."),
            c("ECE 2060", "Introduction to Digital Logic", 3, None),
            c("MATH 2568", "Linear Algebra", 3, None),
            c("MATH 3345", "Foundations of Higher Mathematics", 3, None),
            c("STAT 3470", "Introduction to Probability and Statistics for Engineers", 3, None),
        ]),
        group("cse-mathsci", "Math and Science Electives (8 credit hours)", "choose_credits", rows("""
MATH 2153 | Calculus III | 4
MATH 2255 | Differential Equations and Their Applications | 3
MATH 2415 | Ordinary and Partial Differential Equations | 3
STAT 4201 | Introduction to Mathematical Statistics I | 4
STAT 5301 | Intermediate Data Analysis I | 4
ANTHROP 2200 | Introduction to Physical Anthropology | 4
BIOLOGY 1113 | Biological Sciences: Energy Transfer and Development | 4
BIOLOGY 1114 | Biological Sciences: Form, Function, Diversity, and Ecology | 4
CHEM 1210 | General Chemistry I | 5
CHEM 1250 | General Chemistry for Engineers | 4
EARTHSC 1121 | The Dynamic Earth | 4
EARTHSC 1122 | Earth Through Time | 4
ENR 2100 | Introduction to Environmental Science | 3
ENR 3000 | Soil Science (with ENR 3001 lab) | 3
ENR 3001 | Soil Science Laboratory | 1
FDSCTE 2200 | The Science of Food | 3
HCS 2201 | Ecology of Managed Plant Systems | 4
HCS 2202 | Form and Function in Cultivated Plants | 4
PHYSICS 1251 | E&M, Optics, Modern Physics | 5
"""), min_credits=8, notes="Only one of MATH 2255 or 2415 counts."),
        group("cse-core", "CSE Core", "all", [
            c("CSE 2221", "Software I: Software Components", 4, "CSE 1222, 1223, 1224, or ENGR 1281", min_grade="C-",
              notes="Needs a C- or better. Prerequisite: CSE 1222, 1223, 1224, or ENGR 1281H, or the CSE 2221 placement test."),
            c("CSE 2231", "Software II: Software Development and Design", 4, "CSE 2221; MATH 1151"),
            c("CSE 2321", "Foundations I: Discrete Structures", 3, "CSE 2221; MATH 1151"),
            c("CSE 2331", "Foundations II: Data Structures and Algorithms", 3, "CSE 2231; CSE 2321; STAT 3470"),
            c("CSE 2421", "Systems I: Introduction to Low-Level Programming", 4, "CSE 2231; CSE 2321"),
            c("CSE 2431", "Systems II: Introduction to Operating Systems", 3, "CSE 2421"),
            c("CSE 3341", "Principles of Programming Languages", 3, "CSE 2331; CSE 2421; CSE 3901, 3902, or 3903"),
            c("CSE 2501", "Social, Ethical, and Professional Issues in Computing", 1, "CSE 2231; CSE 2321; GE writing",
              alternates=["PHILOS 2338"], notes="PHILOS 2338 (4 credit hours, also a GE Theme course) may be taken instead."),
        ]),
        group("cse-se-db", "Software Engineering or Databases (choose one)", "choose_courses", rows("""
CSE 3231 | Software Engineering Techniques | 3 | | CSE 3901, 3902, or 3903
CSE 3241 | Introduction to Database Systems | 3 | | CSE 2231; CSE 2321
"""), min_courses=1),
        group("cse-arch-net", "Computer Architecture or Networking (choose one)", "choose_courses", rows("""
CSE 3421 | Introduction to Computer Architecture | 3 | | CSE 2231; CSE 2421 or ECE 2560; ECE 2060
CSE 3461 | Computer Networking and Internet Technologies | 3 | | CSE 2421
"""), min_courses=1),
        group("cse-ai-game", "AI or Game and Animation (choose one)", "choose_courses", rows("""
CSE 3521 | Survey of Artificial Intelligence I: Basic Techniques | 3 | | CSE 2331; MATH 2174 or 2568 or 5520H; STAT 3201 or 3450 or 3460 or 3470 or 4201
CSE 3541 | Computer Game and Animation Techniques | 3 | | CSE 3901, 3902, or 3903
"""), min_courses=1),
        group("cse-project", "Project Course (choose one)", "choose_courses", rows("""
CSE 3901 | Project: Design, Development, and Documentation of Web Applications | 4 | | CSE 2231; CSE 2321; CSE 2421
CSE 3902 | Project: Design, Development, and Documentation of Interactive Systems | 4 | | CSE 2231; CSE 2321; CSE 2421
CSE 3903 | Project: Design, Development, and Documentation of System Software | 4 | | CSE 2231; CSE 2321; CSE 2421
"""), min_courses=1),
        group("cse-capstone", "Capstone (choose one)", "choose_courses", rows("""
CSE 5911 | Capstone Design: Software Applications | 4 | | CSE 3231; CSE 2501 or PHILOS 2338; CSE 3901, 3902, or 3903
CSE 5912 | Capstone Design: Game Design and Development | 4 | | CSE 3541; CSE 2501 or PHILOS 2338; CSE 3901, 3902, or 3903
CSE 5913 | Capstone Design: Computer Animation | 4 | | CSE 3541; CSE 2501 or PHILOS 2338; CSE 3901, 3902, or 3903
CSE 5914 | Capstone Design: Knowledge-Based Systems | 4 | | CSE 3521; CSE 2501 or PHILOS 2338; CSE 3901, 3902, or 3903
CSE 5915 | Capstone Design: Information Systems | 4 | | CSE 3241; CSE 2501 or PHILOS 2338; CSE 3901, 3902, or 3903
"""), min_courses=1, notes="Each capstone also needs the GE Writing course. Also completes the GE Reflection."),
        group("cse-tech-cse", "Technical Electives: CSE (at least 9 credit hours of CSE 3000+)", "choose_credits",
              rows("""
CSE 4251 | The UNIX Programming Environment | 1
CSE 4252 | Programming in C++ | 1
CSE 4253 | Programming in C# | 1
CSE 4256 | Programming in Python | 1
""", is_secondary=True), code_pattern=r"^CSE [3-5]\d{3}", exclude_codes=["CSE 4251", "CSE 4252", "CSE 4253", "CSE 4256"],
              min_credits=9, max_secondary_credits=2,
              notes="Part of these come from your specialization. At most 2 credit hours of CSE 4251-4256; at most 6 hours "
                    "combined of CSE 4193 (up to 2), 4998 (up to 3), and 4999 (up to 6)."),
        group("cse-tech-more", "Technical Electives: remaining 8 credit hours (17 in all)", "choose_credits",
              code_pattern=r"^CSE [3-5]\d{3}|^(" + ENG_SUBJECTS.replace("CSE|", "") + r"|MATH|STAT|PHYSICS|CHEM|BIOLOGY|BIOCHEM|"
                           r"EARTHSC|ECON|LING|PSYCH|PHILOS|BUSOBA|BUSMHR|ACCTMIS) [2-7]\d{3}",
              min_credits=8,
              notes="More CSE courses at the 3000 level or higher, or non-CSE courses at the 2000 level or higher that are on CSE's "
                    "pre-approved list, part of a completed minor, or approved by petition. Confirm non-CSE choices with your advisor."),
        *ge_groups("cse"),
    ],
}

# ---------- Chemical Engineering ----------

CBE_URL = "https://cbe.osu.edu/curriculum-students-starting-math-1151"
CBE_TECH_URL = "https://cbe.osu.edu/approved-technical-electives"

CHEMICAL = {
    "id": "eng-chemical", "kind": "degree", "name": "BS Chemical Engineering", "min_total_credits": 126, "min_gpa": 2.0,
    "source_url": CBE_URL,
    "notes": "Suggested curriculum for students starting in MATH 1151 (126 credit hours). Optional focus areas: Biomolecular, "
             "Environmental, or Polymer (through electives). " + GPA_NOTE,
    "groups": [
        group("cbe-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(),
            c("MATH 2173", "Engineering Mathematics B", 3, "MATH 1172"),
            physics_1250(),
            c("CHEM 1210", "General Chemistry I", 5, None),
            c("CHEM 1220", "General Chemistry II", 5, "CHEM 1210"),
            c("CHEM 2510", "Organic Chemistry I", 4, "CHEM 1220"),
            c("CHEM 2540", "Organic Chemistry Lab I", 2, None),
            c("ENGR 1221", "Introduction to MATLAB", 2, "ENGR 1181 or 1281", alternates=["CSE 1222", "CSE 1224"]),
        ]),
        group("cbe-major", "Chemical Engineering Major Courses", "all", [
            c("CBE 2100", "Chemical Engineering Seminar", 1, None),
            c("CBE 2200", "Process Fundamentals", 3, "CHEM 1210; ENGR 1181 or 1281H; prereq or concur MATH 1172"),
            c("CBE 2345", "Computational Methods for Chemical Engineering", 3, "CBE 2200"),
            c("CBE 3508", "Thermodynamics I", 3, "CBE 2200"),
            c("CBE 2420", "Transport Phenomena I", 3, "CBE 2200; MATH 2173 or 2415"),
            c("CBE 2523", "Separation Processes", 3, "CBE 2200; prereq or concur CBE 2420"),
            c("CBE 3509", "Thermodynamics II", 3, "CBE 3508"),
            c("CBE 3421", "Transport Phenomena II", 3, "CBE 2420"),
            c("CBE 3610", "Kinetics and Reactor Design", 3, "CBE 3508"),
            c("CBE 3730", "Unit Operations Lab I", 1, "CBE 2200"),
            c("CBE 3422", "Transport Phenomena III", 3, "CBE 3421"),
            c("CBE 3731", "Unit Operations Lab II", 1, "CBE 3730"),
            c("CBE 4760", "Process Design, Economics, & Strategy", 3, "CBE 3610; GENED 1201 or 2601"),
            c("CBE 3732", "Unit Operations Lab III", 2, "CBE 3731"),
            c("CBE 4624", "Process Dynamics and Control", 3, "CBE 2523 or 3610"),
            c("CBE 4755", "Process Safety", 2, "CBE 3422 or 3521"),
            c("CBE 4764", "Process Simulation & Product Engineering", 3, None),
        ]),
        group("cbe-mathstat", "Math or Statistics Technical Elective (exactly one)", "choose_courses", rows("""
CBE 5779 | CBE math option (listed instead of a math/statistics course) | 3
MATH 2415 | Ordinary and Partial Differential Equations | 3
MATH 2568 | Linear Algebra | 3
MATH 3350 | Math elective
MATH 3607 | Math elective
MATH 4512 | Partial Differential Equations for Science and Engineering | 3
MATH 4551 | Math elective
MATH 4552 | Math elective
MATH 4556 | Dynamical Systems | 3
MATH 4557 | Math elective
STAT 3201 | Statistics elective
STAT 3202 | Statistics elective
STAT 3450.01 | Statistics for Engineers | 2
STAT 3450.02 | Statistics for Engineers | 2
STAT 3460 | Principles of Statistics for Engineers | 2
STAT 3470.01 | Introduction to Probability and Statistics for Engineers | 3
STAT 3470.02 | Introduction to Probability and Statistics for Engineers | 3
"""), min_courses=1, notes="CBE's list gives course numbers only; titles marked 'elective' aren't on the list."),
        group("cbe-tech-cbe", "CBE Technical Electives (at least 6 credit hours of CBE 5000-5999)", "choose_credits",
              code_pattern=r"^CBE 5\d{3}", min_credits=6),
        group("cbe-tech-industry", "Chemical Industry Technical Electives (at least 6 credit hours)", "choose_credits", rows("""
BIOCHEM 4511 | Introduction to Biological Chemistry | 4
CHEM 2520 | Organic Chemistry II | 4
CHEM 2620 | Chemistry elective
CHEM 2920H | Chemistry elective (honors)
CHEM 4300 | Chemistry elective
CHEM 4310 | Chemistry elective
"""), code_pattern=r"^CBE 5\d{3}", min_credits=6),
        group("cbe-tech-more", "Additional Technical Electives (18 credit hours in all)", "choose_credits", rows("""
CBE 4193 | Individual Studies
CBE 4998 | Undergraduate Research
CBE 4998H | Undergraduate Research (Honors)
CBE 4999 | Undergraduate Research for Thesis
CBE 4999H | Undergraduate Research for Thesis (Honors)
CHEM 2550 | Organic Chemistry Lab II
ENGR 4850S | Translating Engineering Research to K-8 (TEK8)
ENGR 5901.01 | Multidisciplinary Capstone Design I
ENR 3000 | Soil Science
FDSCTE 2400 | Food science elective
FDSCTE 2410 | Food science elective
"""), code_pattern=r"^(AEROENG|ASTRON|AVIATN|AVIATION|BIOCHEM|BIOLOGY|BIOPHYS|CHEM|CHEMPHY|CIVILEN|CSE|EARTHSC|ECE|EEOB|ENTMLGY|ENVENG|"
                           r"ENVSCI|FABENG|FDSCTE|ISE|MATH|MCDBIO|MECHENG|MICRBIO|MOLGEN|NUCLREN|PHYSICS|PLNTBIO|STAT|WELDENG) [3-7]\d{3}"
                           r"|^BIOMEDE [2-7]\d{3}|^(CBE|MATSCEN) [5-7]\d{3}|^ENGR 5797\.[1-9]\d",
              min_credits=3,
              notes="Technical electives total at least 18 credit hours. Students completing an approved minor, second major, or "
                    "second degree (listed on CBE's page) need only 15. Source: " + CBE_TECH_URL),
        *ge_groups("cbe"),
    ],
}

# ---------- Industrial and Systems Engineering ----------

ISE_URL = "https://ise.osu.edu/autumn-2023-and-after-sample-curriculum"
ISE_TRACKS_URL = "https://ise.osu.edu/degrees/undergraduate-program/curriculum-ise-elective-tracks-bsms-information"

INDUSTRIAL = {
    "id": "eng-ise", "kind": "degree", "name": "BS Industrial and Systems Engineering", "min_total_credits": 127, "min_gpa": 2.0,
    "source_url": ISE_URL,
    "notes": "Sample curriculum for students admitted Autumn 2023 and after (127 credit hours, including one 3-credit free "
             "elective). Choose one technical elective track as your specialization. All students need at least 30 credit hours "
             "of math and basic science. " + GPA_NOTE,
    "groups": [
        group("ise-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            survey(), *fundamentals(), *calculus(), physics_1250(),
            c("PHYSICS 1251", "Introductory Physics 2", 5, "PHYSICS 1250"),
            c("CSE 1224", "Programming in Python", 3, None),
            c("MATH 2568", "Linear Algebra", 3, None),
            c("MATH 2415", "Ordinary & Partial Differential Equations", 3, None),
            c("STAT 3470", "Probability & Statistics (STAT 3470.01 or .02)", 3, None),
            c("MECHENG 2040", "Statics & Mechanics of Materials", 4, None),
            c("CSE 2112", "Spreadsheets/Databases for Engineers", 3, None),
            c("ISE 2040", "Engineering Economics (ISE 2040.01 or .02)", 2, "Sophomore standing"),
            c("PHILOS 1332", "Engineering Ethics", 3, None, notes="Can also count as GE Historical & Cultural Studies."),
        ]),
        group("ise-writing", "Writing in Engineering (choose one)", "choose_courses", rows("""
ENGR 2301 | Exploring Citizenship in Engineering: Integrative Designation | 4
PHILOS 2332.02 | Writing in Engineering (philosophy) | 4
PHILOS 2338 | Writing in Engineering (philosophy) | 4
"""), min_courses=1, notes="Can also count as the GE Citizenship Theme."),
        group("ise-science", "Additional Science (choose one, 4-5 credit hours)", "choose_courses", rows("""
ANATOMY 2220 | Additional science option
ANATOMY 2300 | Additional science option
ANATOMY 3300 | Additional science option
ANTHROP 2200 | Introduction to Physical Anthropology | 4
BIOLOGY 1113 | Biological Sciences: Energy Transfer and Development | 4
BIOLOGY 1114 | Biological Sciences: Form, Function, Diversity, and Ecology | 4
BIOLOGY 2100 | Additional science option
CHEM 1210 | General Chemistry I | 5
CHEM 1250 | General Chemistry for Engineers | 4
EARTHSC 1911 | Additional science option
EARTHSC 2155 | Energy and Environment
EARTHSC 2203 | Environmental Geoscience
EARTHSC 2204 | Additional science option
EARTHSC 3203 | Additional science option
ENR 2155 | Additional science option
ENR 3280 | Water Quality Management
EEOB 2510 | Human Anatomy | 4
EEOB 2520 | Human Physiology
GEOG 2200 | Additional science option
GEOG 3300 | Additional science option
PHYSICS 3700 | Data Analysis Lab | 3
"""), min_courses=1),
        group("ise-major", "ISE Major Courses", "all", [
            c("ISE 2400", "Design of Work: Methods and Measurements", 2, "Sophomore standing (rank 2)"),
            c("ISE 2500", "Introduction to Manufacturing Engineering", 3, None),
            c("ISE 3200", "Linear & Integer Programming", 3, "MATH 2568 or 2174; CSE 1222, 1223, 1224, or ENGR 1281H"),
            c("ISE 3210", "Nonlinear & Dynamic Optimization", 3, "ISE 3200"),
            c("ISE 3800", "Engineering Project Management", 3, "ISE 2400"),
            c("ISE 3600", "Workplace Ergonomics", 3, "ISE 2040; STAT 3470"),
            c("ISE 3700", "Cognitive Systems Engineering", 3, "ISE 2400"),
            c("ISE 4120", "Quality & Reliability Engineering", 3, "Junior standing; STAT 3470", min_standing=60),
            c("ISE 3400", "Production Planning & Facilities Design", 4, "ISE 3200; STAT 3470"),
            c("ISE 4100", "Stochastic Modeling & Simulation", 4, "ISE 2400; STAT 3470"),
        ]),
        group("ise-capstone", "Capstone (one option)", "choose_courses", rows("""
ISE 4900 | Capstone Design | 4
ENGR 5901.01 | Multidisciplinary Engineering Capstone Design I
ISE 5811 | Integrated Lean Six Sigma Green Belt (with ISE 5812)
"""), min_courses=1, notes="ISE 4900, the Multidisciplinary Capstone, or ISE 5811 + 5812 (Lean Six Sigma Green Belt). IBE honors "
                                "students follow the IBE capstone."),
        *ge_groups("ise"),
    ],
}


def ise_track(sid, name, groups, total):
    return {
        "id": f"eng-ise-{sid}", "kind": "specialization", "parent_id": "eng-ise", "name": f"{name} (ISE track)",
        "source_url": ISE_TRACKS_URL, "notes": f"Technical elective track, at least {total} credit hours.", "groups": groups,
    }


ISE_ANY_TECH = r"^ISE [3-5]\d{3}"
ISE_TRACKS = [
    ise_track("data", "Data Analytics & Optimization", [
        group("ise-data-req", "Required Track Courses (17 credit hours)", "all", rows("""
CSE 2221 | Software I: Software Components | 4
CSE 2231 | Software II: Software Development and Design | 4
CSE 2321 | Foundations I: Discrete Structures | 3
CSE 3241 | Introduction to Database Systems | 3
CSE 5243 | Introduction to Data Mining | 3
"""), notes="Takes at least 4 semesters."),
    ], 17),
    ise_track("supply", "Supply Chain Management & Logistics", [
        group("ise-scm-req", "Both Required", "all", rows("""
ISE 5110 | Design of Engineering Experiments | 3
ISE 5410 | Quantitative Models in Production and Distribution Logistics | 3 | A
""")),
        group("ise-scm-data", "Data Driven Analytics (choose one)", "choose_courses", rows("""
ISE 5350 | Probabilistic Models and Methods in Operations Research | 3 | S
ISE 5830 | Decision Analysis | 3 | A
"""), min_courses=1),
        group("ise-scm-risk", "Systems Analysis and Risk Management (choose one)", "choose_courses", rows("""
MECHENG 5682.01 | Fundamentals of Product Design Engineering | 3
ISE 5760 | Visual Analytics and Sensemaking | 3
ISE 5800 | Advanced Project Management | 3
ISE 5820 | Systems Thinking in Engineering and Design | 3
ISE 5870 | Resilience Engineering | 3
"""), min_courses=1),
        group("ise-scm-ops", "Planning and Operations (3 credit hours)", "choose_credits", rows("""
BUSML 3380 | Logistics Management | 1.5
BUSML 4380 | Advanced Logistics Management | 1.5 | | BUSML 3380
BUSML 4383 | Supply Chain Management | 1.5 | | BUSML 3380
BUSML 4385 | Building a Sustainable Supply Chain | 1.5 | | BUSML 3380
BUSML 4387 | Lean Logistics | 1.5 | | BUSML 3380
ISE 5350 | Probabilistic Models and Methods in Operations Research | 3 | S
ISE 5830 | Decision Analysis | 3 | A
"""), min_credits=3, notes="Can't reuse a course from the categories above."),
    ], 15),
    ise_track("msor", "Management Systems & Operations Research", [
        group("ise-msor-core", "Management Systems and Operations Research (choose three)", "choose_courses", rows("""
ISE 4230 | Decision Analytics for ISE | 3
ISE 5043 | Power Systems: Analysis and Operation | 3
ISE 5110 | Design of Engineering Experiments | 3
ISE 5220 | Complementarity Theory and Applications | 3
ISE 5230 | Decomposition Techniques in Mathematical Programming | 3
ISE 5350 | Probabilistic Models and Methods in Operations Research | 3
ISE 5410 | Quantitative Models in Production and Distribution Logistics | 3
ISE 5745 | Human-Centered Machine Learning | 3
ISE 5760 | Visual Analytics and Sensemaking | 3
ISE 5800 | Advanced Project Management | 3
ISE 5820 | Systems Thinking in Engineering and Design | 3
ISE 5830 | Decision Analysis | 3
ISE 5870 | Resilience Engineering | 3
"""), min_courses=3),
        group("ise-msor-skills", "Connected Skills (6 credit hours)", "choose_credits", code_pattern=ISE_ANY_TECH, min_credits=6,
              notes="Any ISE technical elective from this or another track, or a non-ISE Connected Skills elective (full list in "
                    "your Buckeye Degree Planner)."),
    ], 15),
    ise_track("mfg", "Manufacturing", [
        group("ise-mfg-req", "Required Course (one, depending on your track version)", "choose_courses", rows("""
ISE 3500 | Process Engineering for Machining Operations | 3
ISE 4510 | Manufacturing Engineering | 3
"""), min_courses=1, notes="The department lists two versions of this track; ask ISE advising which one your degree audit follows."),
        group("ise-mfg-courses", "Manufacturing Courses (6 credit hours)", "choose_credits", rows("""
ISE 3500 | Process Engineering for Machining Operations | 3
ISE 5570 | Manufacturing Data Processing and Analysis | 3
MATSCEN 5451 | Molten Metal Processing | 3
ISE 5501 | Fundamentals of Solid State Processing | 3
ISE 5520 | Industrial Automation I | 1.5
ISE 5525 | Industrial Robotics | 1.5
ISE 5521 | Advanced Sheet Forming Laboratory | 1.5
ISE 5540 | Polymer Processing Fundamentals | 3
ISE 5550 | Principles of Precision Engineering | 3
ISE 5555 | Manufacturing Processes and Machine Tools | 3
MECHENG 5682.01 | Fundamentals of Product Design Engineering | 3
"""), min_credits=6),
        group("ise-mfg-more", "Electives (6 credit hours)", "choose_credits", rows("""
MATSCEN 5451 | Molten Metal Processing (Group 1) | 3
ISE 5502 | Manufacturing processes elective (Group 1; listed as an option to MATSCEN 5451) | 3
WELDENG 5027 | Welding elective (Group 1) | 3
ISE 5540 | Polymer Processing Fundamentals (Group 1) | 3
"""), code_pattern=ISE_ANY_TECH, min_credits=6,
              notes="Group 1 (Manufacturing Processes): MATSCEN 5451 or ISE 5502, WELDENG 5027, ISE 5540. Group 2: ISE technical "
                    "electives from another track or Connected Skills electives (full list in your Buckeye Degree Planner). "
                    "Students are encouraged to take all 6 hours from one group."),
    ], 15),
    ise_track("hsid", "Human Systems Integration & Design", [
        group("ise-hsid-core", "Human Systems Integration and Design (choose three)", "choose_courses", rows("""
ISE 5110 | Design of Engineering Experiments | 3
ISE 5610 | Ergonomics in the Product Design Process | 3
ISE 5620 | Risk Assessment Tools for Occupational Musculoskeletal Disorders | 3
ISE 5640 | Occupational Safety: Analysis and Design of Work Environments | 3
MECHENG 5682.01 | Fundamentals of Product Design Engineering | 3
ISE 5710 | Behind Human Error: Safety and Complex Systems | 3
ISE 5740 | Cognitive Engineering Systems: Human-Centered Automation | 3
ISE 5745 | Human-Centered Machine Learning | 3
ISE 5760 | Visual Analytics and Sensemaking | 3
ISE 5820 | Systems Thinking in Engineering and Design | 3
ISE 5870 | Resilience Engineering | 3
"""), min_courses=3),
        group("ise-hsid-skills", "Connected Skills (6 credit hours)", "choose_credits", code_pattern=ISE_ANY_TECH, min_credits=6,
              notes="Any ISE technical elective from this or another track, or a non-ISE Connected Skills elective (full list in "
                    "your Buckeye Degree Planner)."),
    ], 15),
]

# ---------- Biomedical Engineering ----------

BME_URL = "https://bme.osu.edu/bme-sample-curriculum-sheets"
BME_CAREER_URL = "https://bme.osu.edu/career-electives"
BME_ENG = (r"^(BIOMEDE|AEROENG|AVIATN|AVIATION|CBE|CIVILEN|COMPEDU|CSE|CYBRSEC|ECE|ENGR|FABENG|ISE|MATSCEN|MECHENG|NUCLREN|WELDENG) [3-7]\d{3}"
           r"|^(ECE 2060|ECE 2300|ISE 2500|MECHENG 2030)")
BME_CAREER_OTHER = """
CSE 1222 | Programming in C++ | 3
CSE 1223 | Programming in Java | 3
CSE 1224 | Programming in Python | 3
CSE 2122 | Data Structures using C++
CSE 2123 | Data Structures using Java
CSE 2124 | Data Structures
CSE 2221 | Software I: Software Components | 4
ACCTMIS 2000 | Foundations of Accounting | 3
ACCTMIS 2200 | Introduction to Accounting I | 3
ACCTMIS 2300 | Introduction to Accounting II | 3
BIOETHC 3000 | Bioethics
BIOETHC 5060 | Bioethics
BUSFIN 3120 | Foundations of Finance | 3
BUSFIN 3220 | Business Finance | 3
BUSMHR 3100 | Foundations of Management and Human Resources | 3
BUSMHR 3200 | Organizational Behavior | 3
BUSMHR 3510 | Entrepreneurship and Value Creation | 3
BUSML 3150 | Foundations of Marketing | 3
BUSML 3250 | Marketing Management | 3
BUSOBA 3130 | Foundations of Operations Management | 3
BUSOBA 3230 | Introduction to Operations Management | 3
CHEM 2310 | Introductory Organic Chemistry | 4
CHEM 2510 | Organic Chemistry I | 4
CHEM 2910H | Organic Chemistry I (Honors)
CHEM 2520 | Organic Chemistry II | 4
CHEM 2920H | Organic Chemistry II (Honors)
CHEM 2540 | Organic Chemistry Lab I | 2
CHEM 2550 | Organic Chemistry Lab II
COMM 2110 | Communication elective
COMM 2131 | Communication elective
DESIGN 2700 | Introduction to Design Practice
EEOB 2520 | Human Physiology
EEOB 3510 | Biology elective
ENGLISH 3305 | Technical Writing | 3
HTHRHSC 2500 | Health sciences elective
HTHRHSC 5620 | Aging, Access, and Design
HTHRHSC 7410 | Health sciences elective
MICRBIO 4000 | Basic and Practical Microbiology | 4
MOLGEN 4500.01 | Molecular genetics elective
MOLGEN 4500.02 | Molecular genetics elective
NEUROSC 3000 | Cellular and Molecular Neuroscience | 3
PHYSIO 3200 | Human Physiology
PSYCH 3331 | Abnormal Psychology
"""

BIOMEDICAL = {
    "id": "eng-biomedical", "kind": "degree", "name": "BS Biomedical Engineering", "min_total_credits": 131, "min_gpa": 2.0,
    "source_url": BME_URL,
    "notes": "From BME's sample curriculum for students starting in MATH 1151 (the sample plan totals 131 credit hours; confirm "
             "the official minimum with your BME advisor). Course numbers use the official subject BIOMEDE. " + GPA_NOTE,
    "groups": [
        group("bme-core", "College Core: Math, Science & Engineering Fundamentals", "all", [
            c("ENGR 1100", "Introduction to OSU and BME (Engineering Survey)", 1, None, alternates=["ENGR 1110"]),
            *fundamentals(), *calculus(), *eng_math_b(sub_2568=False), physics_1250(),
            c("PHYSICS 1251", "E&M, Waves, Optics, Modern Physics", 5, "PHYSICS 1250"),
            c("CHEM 1210", "General Chemistry I", 5, None),
            c("CHEM 1220", "General Chemistry II", 5, "CHEM 1210"),
            c("BIOLOGY 1113", "Biological Sciences: Energy Transfer and Development", 4, None),
            c("STAT 3450", "Basic Statistics for Engineers", 2, None),
            c("MECHENG 2040", "Statics and Introduction to Mechanics of Materials", 4, None),
            c("MATSCEN 2010", "Introduction to Engineering Materials", 3, None),
            c("MECHENG 3500", "Thermodynamics", 3, None, alternates=["FABENG 3120"]),
        ]),
        group("bme-major", "Biomedical Engineering Major Courses", "all", [
            c("BIOMEDE 2000", "Introduction to Biomedical Engineering", 3, None),
            c("BIOMEDE 2001", "Professional Development", 1, None),
            c("BIOMEDE 2200", "Quantitative Principles of Cellular and Molecular Systems", 3, None),
            c("BIOMEDE 2700", "Numerical Simulations in BME", 2, None),
            c("BIOMEDE 2800", "Anatomy for Engineers", 3, None),
            c("BIOMEDE 3701", "Biomedical Engineering Domain Lab", 2, None),
            c("BIOMEDE 3702", "Measurements and Instrumentation Lab", 3, None),
            c("BIOMEDE 3703", "Quantitative Physiology", 3, None),
            c("BIOMEDE 4901", "Biomedical Engineering Capstone Design I", 3, None),
            c("BIOMEDE 4902", "Biomedical Engineering Capstone Design II", 3, "BIOMEDE 4901"),
        ]),
        group("bme-domain", "BME Domain Courses (choose three)", "choose_courses", rows("""
BIOMEDE 4110 | Bioimaging | 3
BIOMEDE 4210 | Biotransport | 3
BIOMEDE 4310 | Biomaterials | 3
BIOMEDE 4410 | Biomechanics | 3
BIOMEDE 4510 | Molecular, Cell & Tissue Engineering | 3
BIOMEDE 4610 | Biomedical Micro/Nanotechnology | 3
BIOMEDE 4710 | Introduction to Machine Learning in BME | 3
"""), min_courses=3, notes="Domains: Bioimaging, Biotransport, Biomaterials, Biomechanics, Molecular/Cell/Tissue Engineering, "
                                "Micro/Nano Bioengineering, Machine Learning."),
        group("bme-career-bme", "Career Electives: BME 5000-level (at least 3 credit hours)", "choose_credits",
              rows("CBE 5735 | Cellular Nanotechnology (cross-listed BIOMEDE 5635) | 3\nECE 5206 | Medical Imaging and Processing (cross-listed BIOMEDE 5160) | 3"),
              code_pattern=r"^BIOMEDE 5\d{3}", min_credits=3),
        group("bme-career-eng", "Career Electives: Engineering (at least 6 credit hours)", "choose_credits", code_pattern=BME_ENG,
              exclude_codes=["ECE 4670", "ISE 4610", "MECHENG 4610", "WELDENG 4610"], min_credits=6),
        group("bme-career-more", "Career Electives: remaining 6 credit hours (15 in all)", "choose_credits", rows(BME_CAREER_OTHER),
              code_pattern=BME_ENG, exclude_codes=["ECE 4670", "ISE 4610", "MECHENG 4610", "WELDENG 4610"], min_credits=6,
              notes="Any approved career elective, including a GE Theme: Health and Well-being course. At most 3 credit hours of "
                    "ENGR 5797 and 3 of engineering 4998 research; 4998 + 4999 together at most 6. Full list in your Buckeye "
                    "Degree Planner. Source: " + BME_CAREER_URL),
        *ge_groups("bme", writing_note=None),
    ],
}

# ---------- Aviation ----------

AVN_URL = "https://aviation.osu.edu/majors/bachelor-science-aviation"
AVN_NONFLIGHT_URL = "https://aviation.osu.edu/b.s.-aviation-non-flight-starting-autumn-2026-or-later"
AVN_FLIGHT_URL = "https://aviation.osu.edu/b.s.-aviation-flight-training-starting-autumn-2026-or-later"
AVN_TECH = rf"^AVIATN (2[4-9]\d{{2}}|[3-7]\d{{3}})|^({ENG_SUBJECTS}|MATH|STAT) [2-7]\d{{3}}"
AVN_TECH_NOTE = ("Any AVIATN course 2400 or above not used for another aviation requirement, most engineering, math, or statistics "
                 "courses at the 2000 level or above, or other aviation-related technical courses the Department of Aviation approves "
                 "(full list in your Buckeye Degree Planner).")

AVIATION = {
    "id": "eng-aviation", "kind": "degree", "name": "BS Aviation", "min_total_credits": 121, "min_gpa": 2.0, "source_url": AVN_URL,
    "notes": "Requirements for students starting Autumn 2026 or later. Two versions: non-flight, or with flight training (Professional "
             "Pilot Certification and R-ATP). The sample schedules total about 121 credit hours; confirm the minimum with your "
             "aviation advisor. " + GPA_NOTE,
    "groups": [
        group("avn-college", "General College of Engineering Requirements", "all", [
            *fundamentals(hours_1181=3), *calculus(), physics_1250(),
        ], notes="The aviation pages list ENGR 1181 at 3 credit hours and no separate ENGR 1100 survey."),
        group("avn-core", "Aviation Major Core", "all", rows("""
AVIATN 2000 | Introduction to the Aviation Industry | 3
AVIATN 2001 | Aviation Seminar Course I | 1
AVIATN 2002 | Aviation Seminar Course II | 1
AVIATN 2220 | Aviation Organization Analysis, Writing and Research | 3
AVIATN 2300 | Aviation Weather | 3
AVIATN 3000 | Aviation Management and Marketing | 3
AVIATN 3200 | Aviation Regulations and Policy | 3
AVIATN 3300 | Aviation Human Factors and Safety | 3
AVIATN 4520 | Aviation Capstone | 3
""")),
        *ge_groups("avn"),
        group("avn-ge-reflection", "GE Reflection Seminar", "all", [c("GENED 4001", "GE Reflection Seminar", 1, None)]),
    ],
}

AVIATION_NONFLIGHT = {
    "id": "eng-aviation-nonflight", "kind": "specialization", "parent_id": "eng-aviation", "name": "Aviation (non-flight)",
    "source_url": AVN_NONFLIGHT_URL,
    "groups": [
        group("avn-nf-flightops", "Flight Operations (choose one)", "choose_courses", rows("""
AVIATN 2150 | Introduction to Flight Operations | 3
AVIATN 2100 | Private Pilot Fundamentals (for students going into Air Traffic Control) | 5
"""), min_courses=1),
        group("avn-nf-electives", "Aviation Major Electives (at least 15 credit hours)", "choose_credits", rows("""
AVIATN 2400 | Fundamentals in Unmanned Aircraft Systems | 3
AVIATN 2401 | UAS Ground and Flight Operations | 3
AVIATN 2850 | Applied Aircraft Performance I | 3
AVIATN 2900 | Air Traffic Control Fundamentals | 3
AVIATN 2901 | Air Traffic Control Fundamentals Lab | 1
AVIATN 3400 | Aviation Accident Investigation | 3
AVIATN 3600 | Business and Corporate Aviation Management | 3
AVIATN 3800 | Advanced Uncrewed Aviation Operations Beyond Visual Line of Sight | 3
AVIATN 3850 | Applied Aircraft Performance II | 3
AVIATN 3900 | Air Traffic Management Systems and Environment | 3
AVIATN 4000 | Air Transportation Analysis I | 3
AVIATN 4200 | Aircraft Dispatch Fundamentals | 3
AVIATN 4201 | Applied Dispatching | 3
AVIATN 4400 | Airport Management | 3
AVIATN 5400 | Access and Retention in Aviation and STEM Workforces | 3
"""), min_credits=15),
        group("avn-nf-tech", "Aviation Technical Electives (at least 20 credit hours)", "choose_credits", code_pattern=AVN_TECH,
              min_credits=20, notes=AVN_TECH_NOTE),
    ],
}

AVIATION_FLIGHT = {
    "id": "eng-aviation-flight", "kind": "specialization", "parent_id": "eng-aviation", "name": "Aviation with Flight Training",
    "source_url": AVN_FLIGHT_URL,
    "notes": "Courses marked R-ATP on the department's page count toward the Restricted Airline Transport Pilot certificate.",
    "groups": [
        group("avn-fl-ppc", "Professional Pilot Certification (PPC)", "all", rows("""
AVIATN 2100 | Private Pilot Fundamentals | 5
AVIATN 2101 | Private Pilot Flight Lab I | 2
AVIATN 2102 | Private Pilot Flight Lab II | 2
AVIATN 2501 | Commercial Cross Country Flight Lab | 2
AVIATN 3100 | Instrument Flight Fundamentals | 3
AVIATN 3101 | Instrument Flight Lab | 3
AVIATN 4100 | Commercial Flight Fundamentals | 3
AVIATN 4101 | Commercial Flight Lab I | 2
AVIATN 4102 | Commercial Flight Lab II | 2
AVIATN 4300 | Advanced Multiengine Operations | 2
AVIATN 5100 | Flight Instructor Methodology | 2
""")),
        group("avn-fl-lab", "Multiengine or Flight Instructor Lab (choose one)", "choose_courses", rows("""
AVIATN 4301 | Commercial Multiengine Flight Lab | 2
AVIATN 5101 | Flight Instructor ASE Flight Lab | 2
"""), min_courses=1, notes="If you take both, one can count as an R-ATP elective."),
        group("avn-fl-ratp", "R-ATP Electives (at least 15 credit hours)", "choose_credits", rows("""
AEROENG 2200 | Introduction to Aerospace Engineering I | 4
AVIATN 2850 | Applied Aircraft Performance I | 3
AVIATN 2900 | Air Traffic Control Fundamentals | 3
AVIATN 2901 | Air Traffic Control Fundamentals Lab | 1
AVIATN 3400 | Aviation Accident Investigation | 3
AVIATN 3600 | Business and Corporate Aviation Management | 3
AVIATN 3850 | Applied Aircraft Performance II | 3
AVIATN 3900 | Air Traffic Management Systems and Environment | 3
AVIATN 4000 | Air Transportation Analysis I | 3
AVIATN 4200 | Aircraft Dispatch Fundamentals | 3
AVIATN 4201 | Applied Dispatching | 3
AVIATN 4301 | Commercial Multiengine Flight Lab | 2
AVIATN 5101 | Flight Instructor ASE Flight Lab | 2
AVIATN 5102 | Flight Instructor AME Lab | 1
AVIATN 5200 | Instrument Flight Instructor Methodology | 2
AVIATN 5201 | Flight Instructor Instrument Flight Lab | 1
GEOG 5900 | Weather, Climate, and Global Warming | 3
"""), min_credits=15, notes="You can't count both AEROENG 2200 and AVIATN 2850."),
        group("avn-fl-tech", "Aviation Technical Electives (at least 5 credit hours)", "choose_credits", code_pattern=AVN_TECH,
              min_credits=5, notes=AVN_TECH_NOTE),
    ],
}

PROGRAMS = [CIVIL, ENVIRONMENTAL, MECHANICAL, AEROSPACE, WELDING, ECE, ECE_EE, ECE_CE, ENGPHYS, *EP_SPECS, MATERIALS,
            FABE, *FABE_SPECS, CSE_BS, CHEMICAL, INDUSTRIAL, *ISE_TRACKS, BIOMEDICAL, AVIATION, AVIATION_NONFLIGHT, AVIATION_FLIGHT]
MINORS = []


# Courses listed under more than one subject on the source pages (a student may register under either code).
CROSS_LISTED = [
    ["EARTHSC 2911", "EEOB 2911", "HISTORY 2911"],  # Civil science electives
    ["ENVENG 5000", "CRPLAN 5000"],  # Civil and Environmental electives
    ["CIVILEN 5162", "MECHENG 5162"],
    ["CIVILEN 5168", "MATH 5168"],
    ["ACCTMIS 2000", "AMIS 2000"],  # Civil breadth list names both
    ["ENVENG 5600", "PUBAFRS 5600"],  # Environmental electives
    ["FABENG 5310", "ENR 5310", "ENVENG 5310"],
    ["CBE 5735", "BIOMEDE 5635"],  # BME career electives
    ["ECE 5206", "BIOMEDE 5160"],
    ["MECHENG 4505", "NUCLREN 4505"],  # MAE and Engineering Physics lists
    ["MECHENG 4536", "NUCLREN 4536"],
    ["MECHENG 5003", "NUCLREN 5003"],
    ["MECHENG 5682.01", "ISE 5682.01"],  # ECE directed electives
    ["CIVILEN 5750", "ECE 5400"],  # Aerospace electives (course description)
]


def add_cross_listings(programs):
    import re
    same = {code: group for group in CROSS_LISTED for code in group}
    for p in programs:
        for g in p["groups"]:
            for course in g["courses"]:
                others = [x for x in same.get(course["code"], []) if x != course["code"]]
                # Aviation's subject is AVIATN; some departments still write AVIATION
                m = re.match(r"^AVIATION (\d{4})$", course["code"])
                if m:
                    others.append(f"AVIATN {m.group(1)}")
                course["alternates"] = list(dict.fromkeys(course.get("alternates", []) + others))


add_cross_listings(PROGRAMS)


def main():
    scope = sys.argv[1] if len(sys.argv) > 1 else "degree"
    if scope == "degree":
        print(build(PROGRAMS, scope, 200, college=COLLEGE, script="engineering_requirements.py", catalog=CATALOG, offerings={}))
    elif scope == "minors":
        print(build(MINORS, scope, 300, college=COLLEGE, script="engineering_requirements.py", catalog=CATALOG, offerings={}))
    else:
        sys.exit("usage: engineering_requirements.py degree|minors")


if __name__ == "__main__":
    main()
