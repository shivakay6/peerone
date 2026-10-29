"""
Step 1: Pull a real, author-centric OpenAlex dataset for the Reviewer
Recommendation Engine prototype.

Strategy:
  1. Query OpenAlex for works in "AI for medical imaging / diagnostics".
  2. From the top relevance-ranked works, extract the most frequently
     occurring authors -> these become our ~35 "target" authors with
     full publication histories (dense core, drives real scoring).
  3. Pull each target author's full works list (their real publication
     history) from OpenAlex directly via author.id filter.
  4. Pull a broad background corpus of additional real papers in the
     same/related subfields to round out to ~3000 total papers, so the
     semantic search has real scale/noise to search through.
  5. Reconstruct abstracts from OpenAlex's inverted-index format.
  6. Write raw papers.json (deduped) and authors.json.

No scraping of anything not meant to be public: OpenAlex is an open,
public scholarly dataset explicitly designed for this kind of reuse.
"""
import json
import time
import sys
from collections import Counter
import requests

import os
API_KEY = os.environ["OPENALEX_API_KEY"]
BASE = "https://api.openalex.org"
HEADERS = {"User-Agent": "PeerOne-Prototype/1.0 (mailto:shivakay6@gmail.com)"}

SEED_QUERY = "deep learning medical imaging diagnosis radiology"
TARGET_AUTHOR_COUNT = 35
BACKGROUND_TOTAL = 3000  # total papers across dense core + background

session = requests.Session()
session.headers.update(HEADERS)


def api_get(path, params, retries=4):
    params = dict(params)
    params["api_key"] = API_KEY
    for attempt in range(retries):
        r = session.get(f"{BASE}{path}", params=params, timeout=30)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 429:
            wait = 5 * (attempt + 1)
            print(f"  rate limited, waiting {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue
        print(f"  ERROR {r.status_code}: {r.text[:300]}", file=sys.stderr)
        r.raise_for_status()
    raise RuntimeError(f"Failed after {retries} retries: {path}")


def reconstruct_abstract(inverted_index):
    if not inverted_index:
        return ""
    positions = {}
    for word, idxs in inverted_index.items():
        for i in idxs:
            positions[i] = word
    return " ".join(positions[i] for i in sorted(positions.keys()))


def extract_keywords(work):
    kws = [k.get("display_name") for k in (work.get("keywords") or []) if k.get("display_name")]
    if not kws:
        kws = [c.get("display_name") for c in (work.get("concepts") or [])[:6] if c.get("display_name")]
    return kws[:8]


def extract_authorships(work):
    out = []
    for a in work.get("authorships", []):
        author = a.get("author") or {}
        insts = a.get("institutions") or []
        out.append({
            "authorId": author.get("id", ""),
            "name": author.get("display_name", "Unknown"),
            "orcid": author.get("orcid"),
            "affiliation": insts[0]["display_name"] if insts else "Independent Researcher",
            "position": a.get("author_position", "middle"),
        })
    return out


def normalize_work(w):
    return {
        "id": w["id"],
        "title": w.get("title") or w.get("display_name") or "Untitled",
        "abstract": reconstruct_abstract(w.get("abstract_inverted_index")),
        "keywords": extract_keywords(w),
        "publicationDate": w.get("publication_date") or f"{w.get('publication_year', 2020)}-01-01",
        "publicationYear": w.get("publication_year"),
        "doi": w.get("doi"),
        "authorships": extract_authorships(w),
    }


def fetch_seed_pool(n=400):
    print(f"Fetching top {n} seed works for '{SEED_QUERY}'...")
    out = []
    page = 1
    per_page = 200
    while len(out) < n:
        data = api_get("/works", {
            "search": SEED_QUERY,
            "per-page": per_page,
            "page": page,
            "select": "id,title,display_name,abstract_inverted_index,publication_year,"
                      "publication_date,doi,authorships,keywords,concepts",
        })
        results = data.get("results", [])
        if not results:
            break
        out.extend(results)
        page += 1
        if page > 3:
            break
        time.sleep(0.2)
    print(f"  got {len(out)} seed works")
    return out[:n]


def pick_target_authors(seed_works, n=TARGET_AUTHOR_COUNT):
    counter = Counter()
    author_info = {}
    for w in seed_works:
        for a in w.get("authorships", []):
            author = a.get("author") or {}
            aid = author.get("id")
            if not aid:
                continue
            counter[aid] += 1
            author_info[aid] = author
    # most frequently co-occurring authors in this real corpus
    top = counter.most_common(n * 2)  # overfetch, we'll filter
    chosen = [aid for aid, cnt in top if cnt >= 1][:n]
    print(f"  identified {len(chosen)} candidate target authors "
          f"(top frequency: {top[0][1] if top else 0})")
    return chosen, author_info


def fetch_author_works(author_id, max_works=8):
    data = api_get("/works", {
        "filter": f"author.id:{author_id}",
        "sort": "publication_date:desc",
        "per-page": max_works,
        "select": "id,title,display_name,abstract_inverted_index,publication_year,"
                  "publication_date,doi,authorships,keywords,concepts",
    })
    return data.get("results", [])


def fetch_background_corpus(existing_ids, target_count):
    print(f"Fetching background corpus (~{target_count} more real papers)...")
    queries = [
        "deep learning medical imaging diagnosis",
        "convolutional neural network radiology",
        "machine learning diagnostic imaging",
        "medical image segmentation deep learning",
        "AI chest X-ray diagnosis",
        "deep learning MRI analysis",
        "neural network histopathology classification",
        "artificial intelligence CT scan diagnosis",
        "transfer learning medical image classification",
        "explainable AI medical diagnosis imaging",
    ]
    out = []
    seen = set(existing_ids)
    per_query = (target_count // len(queries)) + 50
    for q in queries:
        page = 1
        got = 0
        while got < per_query:
            data = api_get("/works", {
                "search": q,
                "per-page": 200,
                "page": page,
                "select": "id,title,display_name,abstract_inverted_index,publication_year,"
                          "publication_date,doi,authorships,keywords,concepts",
            })
            results = data.get("results", [])
            if not results:
                break
            for w in results:
                if w["id"] not in seen and w.get("abstract_inverted_index"):
                    out.append(w)
                    seen.add(w["id"])
                    got += 1
            page += 1
            if page > 10:
                break
            time.sleep(0.15)
        print(f"  '{q}': +{got} (total {len(out)})")
        if len(out) >= target_count:
            break
    return out


def main():
    seed_works = fetch_seed_pool(400)
    target_author_ids, author_info = pick_target_authors(seed_works)

    dense_core = {}
    for w in seed_works:
        if w.get("abstract_inverted_index"):
            dense_core[w["id"]] = w

    print(f"Fetching full publication histories for {len(target_author_ids)} target authors...")
    for i, aid in enumerate(target_author_ids):
        try:
            works = fetch_author_works(aid, max_works=8)
            added = 0
            for w in works:
                if w.get("abstract_inverted_index") and w["id"] not in dense_core:
                    dense_core[w["id"]] = w
                    added += 1
            print(f"  [{i+1}/{len(target_author_ids)}] {author_info[aid].get('display_name')}: "
                  f"+{added} papers (dense core now {len(dense_core)})")
        except Exception as e:
            print(f"  [{i+1}/{len(target_author_ids)}] FAILED for {aid}: {e}", file=sys.stderr)
        time.sleep(0.15)

    print(f"Dense core complete: {len(dense_core)} papers across target authors")

    remaining = BACKGROUND_TOTAL - len(dense_core)
    background = fetch_background_corpus(set(dense_core.keys()), remaining)

    all_works = list(dense_core.values()) + background
    print(f"\nTOTAL raw works pulled: {len(all_works)}")

    normalized = [normalize_work(w) for w in all_works]
    normalized = [w for w in normalized if w["abstract"] and w["title"]]
    print(f"TOTAL after cleaning (has title+abstract): {len(normalized)}")

    with open("raw_papers.json", "w") as f:
        json.dump(normalized, f)

    with open("target_author_ids.json", "w") as f:
        json.dump(list(target_author_ids), f)

    print("Wrote raw_papers.json and target_author_ids.json")


if __name__ == "__main__":
    main()
