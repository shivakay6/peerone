"""
Step 3: Give candidate reviewers real depth.

For every author of the papers closest to the sample manuscripts (candidate_author_ids.json,
written by scripts/export-candidates.ts), pull their recent medical-imaging / clinical-AI works
(2021 onward) from OpenAlex so each candidate has a genuine publication history to score.
Writes raw_papers_extra.json in the same shape as raw_papers.json.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util
spec = importlib.util.spec_from_file_location("fetch", os.path.join(os.path.dirname(os.path.abspath(__file__)), "01_fetch_openalex.py"))
f = importlib.util.module_from_spec(spec); spec.loader.exec_module(f)

HERE = os.path.dirname(os.path.abspath(__file__))
cands = json.load(open(os.path.join(HERE, "candidate_author_ids.json")))
known = {p["id"] for p in json.load(open(os.path.join(HERE, "raw_papers.json")))}
TOPIC = "(imaging OR medical OR clinical OR diagnosis OR radiology OR pathology OR tomography OR segmentation)"
extra, seen = [], set(known)
for i, aid in enumerate(cands):
    try:
        data = f.api_get("/works", {
            "filter": f"author.id:{aid},from_publication_date:2021-01-01,title_and_abstract.search:{TOPIC}",
            "sort": "publication_date:desc", "per-page": 6,
            "select": "id,title,display_name,abstract_inverted_index,publication_year,publication_date,doi,authorships,keywords,concepts",
        })
    except Exception as e:
        print("FAILED", aid, e, file=sys.stderr); continue
    for w in data.get("results", []):
        if w["id"] not in seen and w.get("abstract_inverted_index"):
            seen.add(w["id"]); extra.append(f.normalize_work(w))
    if (i + 1) % 50 == 0:
        print(f"{i+1}/{len(cands)} authors, +{len(extra)} new works", flush=True)
    time.sleep(0.1)
json.dump(extra, open(os.path.join(HERE, "raw_papers_extra.json"), "w"))
print("done: new works", len(extra))
