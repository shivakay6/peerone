// ---------- Corpus (static dataset shipped with the app) ----------

export interface PaperAuthor {
  id: string;
  name: string;
  affiliation: string;
}

export interface Paper {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  date: string; // ISO yyyy-mm-dd
  year: number;
  doi: string | null;
  authors: PaperAuthor[];
}

export interface ReviewerStats {
  avgTat: number; // turnaround, days            (SIMULATED demo data)
  avgRating: number; // 1-5                      (SIMULATED demo data)
  completedReviews: number;
  pendingReviews: number;
  declinedInvites: number;
  pendingInvites: number;
}

export interface AuthorRecord {
  id: string;
  name: string;
  orcid: string | null;
  affiliation: string;
  paperIdx: number[]; // indices into the papers array
  email: string; // demo address on the reserved .example domain
  inPool: boolean; // true = in the journal's own reviewer database
  stats?: ReviewerStats; // only for inPool authors
}

// ---------- Manuscript under review ----------

export interface ManuscriptAuthor {
  name: string;
  email: string;
  affiliation: string;
  orcid?: string;
}

export interface Manuscript {
  title: string;
  abstract: string;
  keywords: string[];
  authors: ManuscriptAuthor[];
}

// ---------- Engine configuration (initial heuristics, tunable) ----------

export interface PipelineConfig {
  topKPapers: number; // candidate retrieval depth
  similarityTopN: number; // how many of an author's best papers feed the similarity signal
  similarityFloor: number; // cosine mapped to 0% match; 0 = use raw cosine
  similarityCeiling: number; // cosine mapped to 100% match
  depthThreshold: number; // similarity at/above which a paper counts as "relevant"
  depthCap: number; // relevant papers needed for full depth score
  windowYears: number; // publication look-back window
  weights: { similarity: number; depth: number; recency: number };
  coiCoauthorYears: number;
  resultCount: number;
  evidenceFloor: number; // below this best-paper similarity => INSUFFICIENT_EVIDENCE
}

// ---------- Engine output ----------

export interface EvidencePaper {
  paperIdx: number;
  title: string;
  year: number;
  date: string;
  similarity: number;
  doi: string | null;
  keywords: string[];
}

export interface ScoreBreakdown {
  similarity: number; // 0-1, avg of best N papers in window
  depth: number; // 0-1
  recency: number; // 0-1
  final: number; // 0-1 weighted
  relevantCount: number; // papers >= depthThreshold within window
  windowPaperCount: number; // papers within window
}

export type CoiType = 'same-person' | 'same-institution' | 'recent-coauthor';

export interface CoiFlag {
  type: CoiType;
  severity: 'hard' | 'soft';
  reason: string;
}

export interface PaperNote {
  paperIdx: number;
  text: string; // why this paper matches, written from the two texts
  topics: string[]; // concepts present in both the manuscript and this paper
}

export interface Explanation {
  text: string;
  sufficient: boolean; // false => the INSUFFICIENT_EVIDENCE guardrail fired
  sharedTopics: string[];
  paperNotes: PaperNote[];
}

export interface RankedReviewer {
  author: AuthorRecord;
  score: ScoreBreakdown;
  evidence: EvidencePaper[]; // best papers, most similar first
  coi: CoiFlag[];
  explanation: Explanation;
  surfacedByPapers: number; // how many of the top-K retrieved papers they authored
}

export interface PipelineFunnel {
  corpusSize: number;
  topPapers: number;
  candidateAuthors: number;
  scored: number; // candidates with >=1 paper in window
  hardExcluded: number;
  softFlagged: number; // reviewers in the shown list that carry a conflict flag
  shown: number;
}

export interface PipelineResult {
  reviewers: RankedReviewer[]; // ranked, capped at resultCount; soft conflicts stay in, with their flags
  hardExcluded: { name: string; reason: string }[];
  funnel: PipelineFunnel;
  topPaperTitles: string[];
  computeMs: number; // measured time for retrieval + scoring + conflicts + explanations
}

// ---------- Invite & track (workflow UI) ----------

export enum InvitationStatus {
  PENDING = 'Pending',
  CANCELLED = 'Cancelled',
  ACCEPTED = 'Accepted',
  DECLINED = 'Declined',
  BACKUP = 'Backup',
}

export enum ReviewStatus {
  NOT_STARTED = 'Not Started',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export interface TrackedReviewer {
  instanceId: string;
  author: AuthorRecord;
  relevance?: number; // 0-1, when the reviewer came from a recommendation
  coi?: CoiFlag[]; // conflicts against this manuscript's authors
  invitationStatus: InvitationStatus;
  reviewStatus: ReviewStatus;
  lastActivity: string;
}
