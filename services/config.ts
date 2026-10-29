import { PipelineConfig } from '../types';
import { DEFAULT_CONFIG } from './pipeline';

/**
 * Engine settings used by the app: the design-doc formula and weights, with similarity calibrated
 * to this embedding model (scripts/calibrate-analyze.ts shows the evidence).
 *
 * Why: e5-small-v2 rates almost any two medical-imaging papers 0.85 or higher (corpus median 0.88,
 * closest 50 papers 0.92-0.95, maximum 0.96). Raw cosine therefore cannot separate a strong match
 * from a loose one, and the design doc's 0.80 depth threshold would count nearly everything.
 * Cosine is rescaled so 0.85 (about the 10th percentile of paper pairs) is 0% and 0.97 is 100%.
 * Papers at 50% (cosine 0.91, roughly the top 10% of the corpus) count as strong matches for depth.
 * The evidence floor of 20% (cosine 0.874) is where the "why relevant" text stops being credible
 * and the engine reports INSUFFICIENT_EVIDENCE instead of writing an explanation.
 */
export const ENGINE_CONFIG: PipelineConfig = {
  ...DEFAULT_CONFIG,
  similarityFloor: 0.85,
  similarityCeiling: 0.97,
  depthThreshold: 0.5,
  evidenceFloor: 0.2,
};
