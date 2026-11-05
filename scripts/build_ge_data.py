"""Builds src/data/geCourses.json: Ohio State GE (GEN) courses and their official categories.

Sources:
  1. OSU Class Search (content.osu.edu), filtered by each "GEN Category", for the terms below.
     This is the registrar's own tagging, with credit hours and when each course is offered.
  2. ASC's approved lists for GEN Race, Ethnicity & Gender Diversity and the GEN Themes, which
     also cover approved courses that aren't scheduled in those terms:
       https://asccas.osu.edu/general-education-program/gen-race-ethnicity-and-gender-diversity-themes-information/approved
       https://asccas.osu.edu/general-education-program/gen-race-ethnicity-and-gender-diversity-themes-information/approved-gen

Run each term to refresh:  python3 scripts/build_ge_data.py
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request

TERMS = {"1268": "Autumn 2026", "1272": "Spring 2027"}

# Class-search category name -> our category id
CATEGORIES = {
    "GEN Foundation: Writing and Information Literacy": "writing",
    "GEN Foundation: Math & Quant Reason (or Data Anyl)": "math",
    "GEN Foundation: Literary, Visual & Performing Arts": "arts",
    "GEN Foundation: Historical and Cultural Studies": "history",
    "GEN Foundation: Natural Sciences": "natsci",
    "GEN Foundation: Social and Behavioral Sciences": "sbs",
    "GEN Foundation: Race, Ethnicity & Gender Diversity": "diversity",
    "GEN Theme: Citizenship for a Diverse & Just World": "theme-citizenship",
    "GEN Theme: Lived Environments": "theme-lived-environments",
    "GEN Theme: Sustainability": "theme-sustainability",
    "GEN Theme: Health and Well-being": "theme-health",
    "GEN Theme: Traditions, Cultures, & Transformations": "theme-traditions",
    "GEN Theme: Origins and Evolution": "theme-origins",
    "GEN Theme: Number, Nature, Mind": "theme-number-nature-mind",
    "GEN Theme: Migration, Mobility, and Immobility": "theme-migration",
}

# Headings on the ASC approved-Themes page -> our category id
ASC_THEMES = {
    "Citizenship for a Diverse and Just World": "theme-citizenship",
    "Lived Environments": "theme-lived-environments",
    "Sustainability": "theme-sustainability",
    "Health and Wellbeing": "theme-health",
    "Migration, Mobility, and Immobility": "theme-migration",
    "Number, Nature, Mind": "theme-number-nature-mind",
    "Origins & Evolution": "theme-origins",
    "Traditions, Cultures, and Transformation": "theme-traditions",
}
ASC_BASE = "https://asccas.osu.edu/general-education-program/gen-race-ethnicity-and-gender-diversity-themes-information/"
UA = {"User-Agent": "BuckAI-Team3 student project (GE data build)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def page_lines(url):
    s = re.sub(r"(?s)<(script|style|noscript)[^>]*>.*?</\1>", "", get(url))
    s = re.sub(r"(?i)</(p|div|li|h\d)>|<br\s*/?>", "\n", s)
    return [l.strip() for l in html.unescape(re.sub(r"<[^>]+>", "", s)).split("\n") if l.strip()]


COURSE_LINE = re.compile(r"^([A-Z][A-Z&]{1,9})\s+(\d{4}(?:\.\d{2})?[A-Z]?)\s+\"([^\"]+)\"")


def main():
    courses = {}

    def add(code, title, category, credits=None, term=None):
        e = courses.setdefault(code, {"title": title, "credits": credits, "categories": [], "terms": []})
        if credits is not None and e["credits"] is None:
            e["credits"] = credits
        if category not in e["categories"]:
            e["categories"].append(category)
        if term and term not in e["terms"]:
            e["terms"].append(term)

    # 1. Registrar class search
    for term, term_name in TERMS.items():
        for name, cat in CATEGORIES.items():
            page = 1
            while True:
                q = urllib.parse.urlencode({"q": "", "campus": "col", "academic-career": "ugrd", "term": term,
                                            "gen-categories": name, "p": page})
                data = json.loads(get("https://content.osu.edu/v2/classes/search?" + q))["data"]
                for c in data["courses"]:
                    co = c["course"]
                    lo, hi = co.get("minUnits"), co.get("maxUnits")
                    credits = lo if lo == hi else hi
                    add(f"{co['subject']} {co['catalogNumber']}", co["title"], cat, credits, term_name)
                print(term_name, name, "page", page, "of", data["totalPages"], file=sys.stderr)
                if page >= data["totalPages"] or not data["courses"]:
                    break
                page += 1
                time.sleep(0.3)

    # 2. ASC approved lists (adds approved courses not scheduled in those terms)
    for line in page_lines(ASC_BASE + "approved"):
        m = COURSE_LINE.match(line)
        if m:
            add(f"{m[1]} {m[2]}", m[3], "diversity")
    current = None
    for line in page_lines(ASC_BASE + "approved-gen"):
        if line.startswith("Theme:"):
            current = ASC_THEMES.get(line.split(":", 1)[1].strip())
            continue
        m = COURSE_LINE.match(line)
        if m and current:
            add(f"{m[1]} {m[2]}", m[3], current)

    out = {
        "generatedAt": time.strftime("%Y-%m-%d"),
        "sources": ["https://classes.osu.edu (GEN Categories filter)", ASC_BASE + "approved", ASC_BASE + "approved-gen"],
        "terms": list(TERMS.values()),
        "courses": dict(sorted(courses.items())),
    }
    json.dump(out, open("src/data/geCourses.json", "w"), indent=1)
    print(len(courses), "GE courses written to src/data/geCourses.json")


if __name__ == "__main__":
    main()
