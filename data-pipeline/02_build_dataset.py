"""
Step 2: Turn raw OpenAlex pulls into the app's static dataset.

Outputs (into ../public/data):
  papers.json   - compact paper records; row i here == embedding row i later
  authors.json  - author table (affiliation, ORCID, paper index, internal-pool flag)
  embed_input.json - the exact text that gets embedded for each paper (same order)

Notes on what is REAL vs SIMULATED (documented so it can be stated honestly):
  REAL (from OpenAlex): titles, abstracts, keywords, publication dates, DOIs,
        authors, ORCIDs, institutions, co-authorship.
  SIMULATED (not available in any open dataset): reviewer performance stats
        (turnaround, rating, completed/pending reviews, declined invites) for the
        internal reviewer pool, and the demo email addresses. OpenAlex does not
        publish emails. Emails use the reserved .example TLD so they can never
        resolve to a real mailbox.
"""
import json
import os
import random
import re
import unicodedata
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "data")
os.makedirs(OUT, exist_ok=True)

MAX_AUTHORS_PER_PAPER = 25
NO_AFFIL = "Affiliation not listed"


def clean_name(n):
    n = unicodedata.normalize("NFKC", n or "")
    n = re.sub(r"[‎‏‪-‮]", "", n).strip()
    # OpenAlex disambiguation artefacts such as "Guorong Wu A"
    n = re.sub(r"\s[A-Z]$", "", n)
    return re.sub(r"\s+", " ", n)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", ".", s.lower()).strip(".")


def short_id(openalex_id):
    return openalex_id.rsplit("/", 1)[-1]


def main():
    raw = json.load(open(os.path.join(HERE, "raw_papers.json")))
    extra_path = os.path.join(HERE, "raw_papers_extra.json")
    if os.path.exists(extra_path):
        raw += json.load(open(extra_path))
    targets = {short_id(t) for t in json.load(open(os.path.join(HERE, "target_author_ids.json")))}

    seen, papers = set(), []
    for p in raw:
        if p["id"] in seen or not p.get("publicationYear") or not p["authorships"]:
            continue
        if len(p["abstract"]) < 200:  # too thin to embed meaningfully
            continue
        seen.add(p["id"])
        papers.append(p)
    papers.sort(key=lambda p: p["publicationDate"], reverse=True)
    print(f"papers kept: {len(papers)} of {len(raw)}")

    out_papers, authors = [], {}
    paper_index = defaultdict(list)
    affil_votes = defaultdict(list)  # author -> [(date, affiliation)]

    for i, p in enumerate(papers):
        auths = []
        for a in p["authorships"][:MAX_AUTHORS_PER_PAPER]:
            if not a["authorId"]:
                continue
            aid = short_id(a["authorId"])
            name = clean_name(a["name"])
            orcid = (a["orcid"] or "").rsplit("/", 1)[-1] or None
            aff = NO_AFFIL if a["affiliation"] == "Independent Researcher" else a["affiliation"]
            auths.append({"id": aid, "name": name, "affiliation": aff})
            paper_index[aid].append(i)
            if aid not in authors:
                authors[aid] = {"id": aid, "name": name, "orcid": orcid}
            elif orcid and not authors[aid]["orcid"]:
                authors[aid]["orcid"] = orcid
            if aff != NO_AFFIL:
                affil_votes[aid].append((p["publicationDate"], aff))
        out_papers.append({
            "id": short_id(p["id"]),
            "title": re.sub(r"\s+", " ", p["title"]).strip(),
            "abstract": p["abstract"].strip(),
            "keywords": p["keywords"],
            "date": p["publicationDate"],
            "year": p["publicationYear"],
            "doi": p["doi"],
            "authors": auths,
        })

    pool_ids = [t for t in targets if t in authors]
    for aid, a in authors.items():
        votes = sorted(affil_votes.get(aid, []), reverse=True)  # newest first
        a["affiliation"] = votes[0][1] if votes else NO_AFFIL
        a["paperIdx"] = paper_index[aid]
        a["email"] = f"{slug(a['name'])}@demo.peerone.example"
        a["inPool"] = aid in pool_ids
        if a["inPool"]:
            rng = random.Random(aid)  # deterministic: same numbers on every build
            a["stats"] = {
                "avgTat": rng.randint(6, 24),
                "avgRating": round(rng.uniform(3.6, 4.9), 1),
                "completedReviews": rng.randint(4, 58),
                "pendingReviews": rng.randint(0, 4),
                "declinedInvites": rng.randint(0, 9),
                "pendingInvites": rng.randint(0, 3),
            }

    json.dump(out_papers, open(os.path.join(OUT, "papers.json"), "w"), separators=(",", ":"))
    json.dump(list(authors.values()), open(os.path.join(OUT, "authors.json"), "w"), separators=(",", ":"))
    embed_input = [f"{p['title']}. {p['abstract']} Keywords: {', '.join(p['keywords'])}" for p in out_papers]
    json.dump(embed_input, open(os.path.join(OUT, "embed_input.json"), "w"), separators=(",", ":"))

    multi = sum(1 for a in authors.values() if len(a["paperIdx"]) >= 3)
    print(f"authors: {len(authors)} | with >=3 papers: {multi} | internal pool: {len(pool_ids)}")
    for f in ("papers.json", "authors.json", "embed_input.json"):
        print(f"  {f}: {os.path.getsize(os.path.join(OUT, f)) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
