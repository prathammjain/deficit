#!/usr/bin/env python3
"""
import-indb.py — derive curated Indian food-table entries from the Indian
Nutrient Databank (INDB), which is grounded in IFCT 2017 (ICMR-NIN).

We do NOT copy the INDB database wholesale (nutritional values are facts, not
copyrightable; a database's structure/selection is). Instead we curate a target
list of common dishes (our own ids/names/serving labels/aliases) and take only
the measured macros from the best-matching INDB row, after validation. The
output is pasted into src/lib/food/indian-foods.ts, then synced to the edge
function with scripts/sync-indian-foods.mjs.

Provenance / how to re-run:
  1. Download INDB.xlsx:
     https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/raw/main/INDB.xlsx
  2. pip install openpyxl   (use a venv; the system Python is often managed)
  3. python3 scripts/import-indb.py INDB.xlsx > new-entries.json

Validation (keeps bad rows out of the "trusted" local table):
  - Atwater cross-check: 4*protein + 4*carb + 9*fat within 30% of stated kcal
  - Range caps: 10–1000 kcal/serving, 5–620 g serving, <600 kcal/100g,
    protein <90 g, fat <80 g
  - Serving grams derived from unit_serving_kcal / energy_kcal_per_100g * 100
  - Manual audit of name-vs-source afterwards (the "shortest match" heuristic
    can mislabel; drop any mismatches before committing)
"""
import json, re, sys, unicodedata

import openpyxl  # type: ignore

# (id, display name, [ALL-required match keywords], unit word, [aliases])
TARGETS = [
    ("thepla", "Thepla", ["thepla"], "piece", ["methi thepla"]),
    ("dal-paratha", "Dal Paratha", ["dal parantha"], "piece", ["dal stuffed paratha"]),
    ("paneer-paratha", "Paneer Paratha", ["paneer", "parantha"], "piece", ["paneer stuffed paratha"]),
    ("mooli-paratha", "Mooli Paratha", ["radish parantha"], "piece", ["mooli ka paratha"]),
    ("gobi-paratha", "Gobi Paratha", ["cauliflower parantha"], "piece", ["gobhi paratha"]),
    ("curd-rice", "Curd Rice", ["curd rice"], "plate", ["dahi chawal", "thayir sadam"]),
    ("lemon-rice", "Lemon Rice", ["lemon rice"], "plate", ["chitranna"]),
    ("tamarind-rice", "Tamarind Rice", ["tamarind rice"], "plate", ["puliyodarai", "imli rice"]),
    ("veg-pulao", "Vegetable Pulao", ["vegetable pulao"], "plate", ["pulao", "pilaf"]),
    ("plain-pulao", "Plain Pulao", ["plain pulao"], "plate", ["jeera pulao"]),
    ("mushroom-pulao", "Mushroom Pulao", ["mushroom pulao"], "plate", []),
    ("veg-fried-rice", "Veg Fried Rice", ["chinese fried rice"], "plate", ["fried rice"]),
    ("mutton-biryani", "Mutton Biryani", ["mutton biryani"], "plate", ["biriyani"]),
    ("moong-dal", "Moong Dal", ["washed moong dal"], "katori", ["yellow dal", "dhuli moong"]),
    ("chana-masala", "Chana Masala", ["chickpeas curry"], "katori", ["chole masala", "safed chana"]),
    ("kala-chana", "Kala Chana", ["black channa"], "katori", ["black chickpeas", "bengal gram"]),
    ("lobia", "Lobia Curry", ["lobia curry"], "katori", ["black eyed peas", "chawli"]),
    ("rasam", "Rasam", ["rasam"], "bowl", ["tomato rasam"]),
    ("baingan-bharta", "Baingan Bharta", ["brinjal bhartha"], "katori", ["eggplant", "baingan"]),
    ("aloo-methi", "Aloo Methi", ["potato fenugreek"], "katori", ["aloo methi"]),
    ("bhindi-fry", "Bhindi Fry", ["okra", "fry"], "katori", ["okra fry", "lady finger"]),
    ("bharwa-bhindi", "Bharwa Bhindi", ["stuffed okra"], "katori", ["stuffed bhindi"]),
    ("gobi-coconut", "Gobi Sabzi", ["cauliflower with coconut"], "katori", ["cauliflower sabzi"]),
    ("paneer-shaslik", "Paneer Tikka Shaslik", ["paneer shaslik"], "katori", ["paneer shashlik"]),
    ("paneer-kathi-roll", "Paneer Kathi Roll", ["paneer kaathi roll"], "piece", ["paneer roll"]),
    ("soya-curry", "Soya Chunk Curry", ["soyabean curry"], "katori", ["soya chunk", "meal maker", "nutrela"]),
    ("chicken-sandwich", "Chicken Sandwich", ["chicken sandwich"], "piece", []),
    ("omelette", "Omelette", ["plain omelette"], "piece", ["omelet", "egg omelette"]),
    ("egg-bhurji", "Egg Bhurji", ["scrambled egg"], "katori", ["anda bhurji", "scrambled egg"]),
    ("fish-tikka", "Fish Tikka", ["hariyali fish tikka"], "serving", ["grilled fish"]),
    ("palak-mutton", "Palak Mutton", ["spinach mutton"], "bowl", ["mutton palak", "saag gosht"]),
    ("rava-upma", "Rava Upma", ["semolina upma"], "katori", ["suji upma"]),
    ("vermicelli-upma", "Vermicelli Upma", ["vermicelli upma"], "katori", ["semiya upma"]),
    ("rice-upma", "Rice Upma", ["rice upma"], "katori", []),
    ("veg-poha", "Vegetable Poha", ["vegetable poha"], "katori", ["poha"]),
    ("sprouted-poha", "Sprouted Moong Poha", ["sprouted moong poha"], "katori", []),
    ("pav-bhaji", "Pav Bhaji", ["pav bhaji"], "plate", ["pao bhaji"]),
    ("dhokla", "Dhokla", ["dhokla"], "piece", ["khaman"]),
    ("moong-chila", "Moong Dal Chilla", ["chilla"], "piece", ["cheela", "moong cheela"]),
    ("shrikhand", "Shrikhand", ["sweetened yogurt"], "katori", ["sweet yogurt"]),
    ("suji-porridge", "Suji Porridge", ["semolina porridge"], "bowl", ["rava porridge", "daliya"]),
    ("kheer", "Rice Kheer", ["rice kheer"], "katori", ["rice pudding", "payasam", "chawal kheer"]),
    ("suji-halwa", "Suji Halwa", ["semolina halwa"], "katori", ["sooji halwa", "rava halwa"]),
    ("gajar-halwa", "Gajar Halwa", ["carrot halwa"], "katori", ["carrot halwa", "gajrela"]),
    ("besan-ladoo", "Besan Ladoo", ["gram flour ladoo"], "piece", ["laddu", "besan laddu"]),
    ("coconut-ladoo", "Coconut Ladoo", ["semolina ladoo with coconut"], "piece", ["nariyal ladoo"]),
]


def norm(s):
    return re.sub(r"[^a-z0-9 ]", "", unicodedata.normalize("NFKD", str(s).lower()))


def load(path):
    ws = openpyxl.load_workbook(path, read_only=True)["Nutrient Data"]
    rows = list(ws.iter_rows(values_only=True))
    idx = {str(h): i for i, h in enumerate(rows[0])}
    out = []
    for r in rows[1:]:
        e100 = r[idx["energy_kcal"]]
        es = r[idx["unit_serving_energy_kcal"]]
        if not e100 or not es:
            continue
        out.append({
            "name": str(r[idx["food_name"]]),
            "g": es / e100 * 100,
            "kcal": es,
            "p": r[idx["unit_serving_protein_g"]],
            "cb": r[idx["unit_serving_carb_g"]],
            "f": r[idx["unit_serving_fat_g"]],
            "kcal100": e100,
        })
    return out


def valid(r):
    kcal, p, cb, f, g, k100 = r["kcal"], r["p"], r["cb"], r["f"], r["g"], r["kcal100"]
    if not (10 <= kcal <= 1000):
        return f"kcal {kcal:.0f}"
    if not (5 <= g <= 620):
        return f"serving {g:.0f}g"
    if k100 > 600:
        return f"{k100:.0f} kcal/100g"
    if f > 80 or p > 90:
        return f"macro p{p:.0f} f{f:.0f}"
    if kcal > 0 and abs(4 * p + 4 * cb + 9 * f - kcal) / kcal > 0.30:
        return "atwater"
    return None


def main():
    indb = load(sys.argv[1] if len(sys.argv) > 1 else "INDB.xlsx")
    entries, dropped = [], []
    for tid, name, kw, unit, aliases in TARGETS:
        cands = [r for r in indb if all(k in norm(r["name"]) for k in kw)]
        if not cands:
            dropped.append(f"{tid}: no match"); continue
        r = sorted(cands, key=lambda x: len(x["name"]))[0]  # prefer canonical (shortest)
        err = valid(r)
        if err:
            dropped.append(f"{tid}: {err} [{r['name'][:30]}]"); continue
        g = round(r["g"] / 5) * 5
        entries.append({
            "id": tid, "name": name, "serving": f"1 {unit} ({g}g)",
            "kcal": round(r["kcal"]), "proteinG": round(r["p"]),
            "carbsG": round(r["cb"]), "fatG": round(r["f"]),
            "aliases": aliases, "_src": r["name"],
        })
    for d in dropped:
        print(f"# dropped {d}", file=sys.stderr)
    print(f"# {len(entries)} entries, {len(dropped)} dropped", file=sys.stderr)
    print(json.dumps(entries, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
