"""Step 4b: assemble embeddings.bin (row i == papers.json[i]) from reused + newly embedded vectors."""
import json, os
import numpy as np
H = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(H, "..", "public", "data")
old_ids = [p["id"] for p in json.load(open(os.path.join(H, "old_papers.json")))]
old = np.fromfile(os.path.join(H, "old_embeddings.bin"), dtype="<f4").reshape(len(old_ids), 384)
pos = {i: k for k, i in enumerate(old_ids)}
new_ids = [p["id"] for p in json.load(open(os.path.join(D, "papers.json")))]
missing = json.load(open(os.path.join(H, "missing_idx.json")))
fresh = np.fromfile(os.path.join(H, "new_embeddings.bin"), dtype="<f4").reshape(len(missing), 384)
out = np.zeros((len(new_ids), 384), dtype="<f4"); m = {k: j for j, k in enumerate(missing)}
for k, i in enumerate(new_ids):
    out[k] = fresh[m[k]] if k in m else old[pos[i]]
assert np.isfinite(out).all() and (np.abs(np.linalg.norm(out, axis=1) - 1) < 1e-3).all()
out.tofile(os.path.join(D, "embeddings.bin")); print("wrote", out.shape)
