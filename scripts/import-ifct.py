#!/usr/bin/env python3
"""
import-ifct.py — derive the ingredient grounding table from IFCT 2017 Table 1
("Proximate Principles and Dietary Fiber"), ICMR-NIN.

IFCT is a RAW-INGREDIENT table: every row is per 100 g edible portion and there
are no cooked or prepared dishes in it (0 rows match "cooked", 1 "roasted").
It therefore grounds ingredients — millets, dals, Indian fish and meats, local
vegetables, where USDA is weak — and never dishes. Cooked composite dishes stay
with the curated table in src/lib/food/indian-foods.ts. The raw -> cooked
conversion is applied at runtime in supabase/functions/food/ifct.ts, not here,
so this artifact stays a faithful, re-verifiable copy of the book.

Provenance / how to re-run:
  1. pip install pypdf   (use a venv; the system Python is often managed)
  2. python3 scripts/import-ifct.py path/to/food_table_IFCT2017.pdf \
       > supabase/functions/food/_ifct.ts

The PDF is not committed. Table 1 is book pages 1-30 = PDF pages 41-68.

Extraction notes (each one cost a bug; do not "simplify" them away):
  - extraction_mode="layout" puts each table row on one physical line with all
    its values. Default mode wraps long food names and finds only 276 of 528.
  - Table 1 has TWO column layouts. Pages 41-57 (groups A-L) carry the fibre
    and carbohydrate columns; pages 58-68 (M-S: egg, poultry, meat, fish,
    shellfish, mollusks) carry neither, so animal rows have no published
    carbohydrate at all. Assuming one layout misreads energy as fibre for 214
    rows, so the per-page header is read and the row shape follows from it.
  - Seven zero-fibre rows (lemon juice, jaggery, toddy, coconut water, milk,
    khoa) leave the fibre cells blank, which collapses carbohydrate leftward.
  - Energy is published in kJ.

Validation (keeps bad rows out of a table the engine presents as measured):
  - Atwater cross-check: 4*protein + 4*carb + 9*fat within 30% of stated kcal.
    This also re-checks the column assignment above: a fibre value landing in
    the carbohydrate slot breaks the energy balance and the row is dropped.
  - Range caps: 10-700 kcal/100 g (almond is 609), protein <90 g, fat <80 g.
"""
import hashlib, logging, re, sys
from datetime import date

import pypdf  # type: ignore

# pypdf logs the rotated "Food code" / "No. of Regions" header labels it cannot
# place, once per page. They are not data, everything else still extracts, and
# 28 such lines would bury the drop ledger this script reports on stderr.
logging.getLogger("pypdf").setLevel(logging.ERROR)

PAGES = range(40, 68)  # 0-indexed; PDF pages 41-68 = book pages 1-30
CODE = re.compile(r"^([A-S]\d{3})\s+(.*)$")
NUM = re.compile(r"^\d+(?:\.\d+)?(?:±\d+(?:\.\d+)?)?$")

NINE = ["water", "p", "ash", "f", "fibtg", "fibins", "fibsol", "cb", "kj"]
FIVE = ["water", "p", "ash", "f", "kj"]
# The seven blank-fibre rows: carbohydrate collapses into the fibre columns.
NINE_NOFIB = ["water", "p", "ash", "f", "cb", "kj"]

# Every group's row count, as printed. Asserted so a page-range slip, a pypdf
# change or a layout regression fails loudly instead of grounding on less.
CENSUS = {"A": 24, "B": 25, "C": 34, "D": 78, "E": 68, "F": 19, "G": 33,
          "H": 21, "I": 2, "J": 4, "K": 2, "L": 4, "M": 15, "N": 19, "O": 63,
          "P": 92, "Q": 8, "R": 7, "S": 10}
TOTAL = sum(CENSUS.values())  # 528


def clean_name(s):
    """Drop the Latin binomial. Cut at the FIRST '(' — 15 rows have scrambled
    parentheses ('Green gram, dal ( a)Vigna radiat') that an anchored match
    misses, and no name carries meaning after it. The food code keeps the
    pointer back to the book."""
    return re.sub(r"\s*\(.*$", "", s).strip()


def parse(path):
    """-> (rows, codes_seen). One row per printed line; validation comes later
    so the ledger can account for all 528."""
    reader = pypdf.PdfReader(path)
    rows, codes = [], []
    for i in PAGES:
        text = reader.pages[i].extract_text(extraction_mode="layout") or ""
        lines = text.split("\n")
        header = next((l for l in lines if "WATER" in l and "PROTCNT" in l), None)
        if header is None:
            sys.exit(f"page {i + 1}: no column header found — layout changed")
        cols = NINE if "FIBTG" in header else FIVE

        for line in lines:
            m = CODE.match(line.strip())
            if not m:
                continue  # group headers, column headers and footers never match
            code, rest = m.group(1), m.group(2)
            codes.append(code)

            tokens = rest.split()
            n = 0
            for tok in reversed(tokens):
                if not NUM.match(tok):
                    break
                n += 1
            trail = tokens[len(tokens) - n:]
            name = clean_name(" ".join(tokens[: len(tokens) - n]))

            # trail is [No. of Regions, *cols]; pick the shape that fits.
            if len(trail) == len(cols) + 1:
                shape = cols
            elif cols is NINE and len(trail) == len(NINE_NOFIB) + 1:
                shape = NINE_NOFIB
            else:
                rows.append({
                    "code": code,
                    "name": name,
                    "err": f"{len(trail)} values, expected {len(cols) + 1}",
                })
                continue

            vals = [float(t.split("±")[0]) for t in trail[1:]]
            r = dict(zip(shape, vals))
            rows.append({
                "code": code,
                "name": name,
                "kcal": r["kj"] / 4.184,          # IFCT publishes kJ
                "p": r["p"],
                "cb": r.get("cb", 0.0),           # animal layout has no carb column
                "f": r["f"],
            })
    return rows, codes


def valid(r):
    kcal, p, cb, f = r["kcal"], r["p"], r["cb"], r["f"]
    # A standalone number or a "±" in the name means a numeric column leaked
    # into it, i.e. the row was split in the wrong place. Cultivar suffixes
    # like "Brinjal-1" and "Chillies, green-7" are real names and must pass,
    # so the digit has to start a token to count as a leak.
    if not r["name"] or re.search(r"(?:^|\s)\d|±", r["name"]):
        return f"bad name {r['name'][:40]!r}"
    if not (10 <= kcal <= 700):
        return f"kcal/100g {kcal:.0f}"
    if p > 90 or f > 80:
        return f"macro p{p:.0f} f{f:.0f}"
    if abs(4 * p + 4 * cb + 9 * f - kcal) / kcal > 0.30:
        return f"atwater {abs(4 * p + 4 * cb + 9 * f - kcal) / kcal:.2f}"
    return None


def check_census(codes):
    """Three ways a silently short table could ship, all fatal."""
    seen = {}
    for c in codes:
        seen.setdefault(c[0], []).append(int(c[1:]))
    if len(codes) != TOTAL:
        sys.exit(f"expected {TOTAL} code lines, found {len(codes)}")
    for group, want in CENSUS.items():
        got = sorted(seen.get(group, []))
        if len(got) != want:
            sys.exit(f"group {group}: expected {want} rows, found {len(got)}")
        if got != list(range(1, want + 1)):
            sys.exit(f"group {group}: codes not contiguous 1..{want}")
    print(f"# {len(codes)} code lines, census OK", file=sys.stderr)


def main():
    path = sys.argv[1]
    rows, codes = parse(path)
    check_census(codes)

    kept, dropped = [], []
    for r in rows:
        err = r.get("err") or valid(r)
        if err:
            dropped.append((r["code"], r.get("name", "?"), err))
            continue
        kept.append({
            "code": r["code"], "name": r["name"],
            "kcal": round(r["kcal"]), "proteinG": round(r["p"]),
            "carbsG": round(r["cb"]), "fatG": round(r["f"]),
        })

    if len(kept) + len(dropped) != TOTAL:
        sys.exit(f"ledger: {len(kept)} + {len(dropped)} != {TOTAL}")
    for code, name, err in dropped:
        print(f"# dropped {code} {name[:34]}: {err}", file=sys.stderr)
    print(f"# {len(kept)} rows, {len(dropped)} dropped", file=sys.stderr)

    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    drops = "; ".join(f"{c} ({e})" for c, _, e in dropped) or "none"
    out = [
        "// AUTO-GENERATED from IFCT 2017 Table 1 (PDF pages 41-68) by",
        "// scripts/import-ifct.py — do not edit by hand.",
        "//",
        "// Source: Indian Food Composition Tables 2017, National Institute of",
        "// Nutrition (ICMR), Hyderabad. All values per 100 g edible portion,",
        "// RAW unless the food is published cooked. Energy converted from the",
        "// published kJ at 1 kcal = 4.184 kJ.",
        "//",
        f"// PDF sha256: {digest}",
        f"// Generated:  {date.today().isoformat()} — {len(kept)} of {TOTAL} rows",
        f"// Dropped:    {drops}",
        "//",
        "// Regenerate: npm run ifct -- path/to/food_table_IFCT2017.pdf \\",
        "//               > supabase/functions/food/_ifct.ts",
        "",
        "// @ts-nocheck",
        "export const IFCT_FOODS = [",
    ]
    for r in kept:
        out.append(
            f"  {{ code: '{r['code']}', name: {dump(r['name'])}, "
            f"kcal: {r['kcal']}, proteinG: {r['proteinG']}, "
            f"carbsG: {r['carbsG']}, fatG: {r['fatG']} }},"
        )
    out.append("];")
    print("\n".join(out))


def dump(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


if __name__ == "__main__":
    main()
