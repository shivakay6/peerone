"""Step 4a: reuse vectors for papers that were already embedded; list the indices still missing."""
import json, os
import numpy as np
H = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(H, "..", "public", "data")
old_ids = [p["id"] for p in json.load(open(os.path.join(H, "old_papers.json")))]
old = np.fromfile(os.path.join(H, "old_embeddings.bin"), dtype="<f4").reshape(len(old_ids), 384)
pos = {i: k for k, i in enumerate(old_ids)}
new_ids = [p["id"] for p in json.load(open(os.path.join(D, "papers.json")))]
missing = [k for k, i in enumerate(new_ids) if i not in pos]
json.dump(missing, open(os.path.join(H, "missing_idx.json"), "w"))
print("papers", len(new_ids), "reused", len(new_ids) - len(missing), "to embed", len(missing))
