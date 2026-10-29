import { AuthorRecord, ReviewerStats } from '../types';

/** Small deterministic PRNG so a researcher always shows the same demo numbers. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/**
 * Review track record for any researcher. Reviewers in the journal's own database carry their
 * stored numbers; everyone else gets a deterministic demo record (no open dataset has this data).
 */
export function statsFor(author: Pick<AuthorRecord, 'id' | 'stats'>): ReviewerStats {
  if (author.stats) return author.stats;
  const r = seeded(`track:${author.id}`);
  return {
    avgTat: between(r, 7, 26),
    avgRating: Math.round((3.6 + r() * 1.3) * 10) / 10,
    completedReviews: between(r, 3, 44),
    pendingReviews: between(r, 0, 3),
    declinedInvites: between(r, 0, 8),
    pendingInvites: between(r, 0, 2),
  };
}

/** Share of invitations that ended up as a review. */
export function acceptanceRate(s: ReviewerStats): number {
  return Math.round((s.completedReviews / Math.max(s.completedReviews + s.declinedInvites, 1)) * 100);
}
