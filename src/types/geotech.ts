export type Language = 'th' | 'en';

export type SieveInputMode = 'mass_retained' | 'sieve_plus_soil' | 'percent_passing';
export type AtterbergInputMode = 'raw_cans' | 'direct';

export interface SieveRowInput {
  id: string;
  label: string;
  openingMm: number; // 0 for Pan
  emptySieveG: number;
  sievePlusSoilG: number;
  massRetainedG: number;
  directPercentPassing: number;
}

export interface HydrometerPoint {
  id: string;
  diameterMm: number;
  percentFiner: number;
}

export interface LLTrialInput {
  id: string;
  blows: number;
  canLabel: string;
  emptyCanG: number;
  wetSoilCanG: number;
  drySoilCanG: number;
}

export interface PLTrialInput {
  id: string;
  canLabel: string;
  emptyCanG: number;
  wetSoilCanG: number;
  drySoilCanG: number;
}

export interface SoilSampleInput {
  sampleId: string;
  location: string;
  depthM: string;
  sieveMode: SieveInputMode;
  totalDryMassG: number;
  sieves: SieveRowInput[];
  panEmptyG: number;
  panPlusSoilG: number;
  panMassG: number;
  useHydrometer: boolean;
  hydrometerPoints: HydrometerPoint[];
  atterbergMode: AtterbergInputMode;
  isNonPlastic: boolean;
  llTrials: LLTrialInput[];
  plTrials: PLTrialInput[];
  directLL: number;
  directPL: number;
  checkOrganic: boolean;
  ovenDriedLL: number | null;
}

export interface ComputedSieveRow extends SieveRowInput {
  computedMassRetainedG: number;
  cumulativeRetainedG: number;
  cumulativePercentRetained: number;
  percentPassing: number;
}

export interface GSDCurvePoint {
  diameterMm: number;
  percentPassing: number;
  label: string;
  source: 'sieve' | 'hydrometer';
}

export interface LLTrialComputed extends LLTrialInput {
  waterContentPct: number | null;
  valid: boolean;
}

export interface PLTrialComputed extends PLTrialInput {
  waterContentPct: number | null;
  valid: boolean;
}

export interface AtterbergComputed {
  ll: number | null;
  pl: number | null;
  pi: number | null;
  isNonPlastic: boolean;
  isOrganic: boolean;
  organicRatio: number | null;
  llTrials: LLTrialComputed[];
  plTrials: PLTrialComputed[];
  flowCurveSlope: number | null;
  flowCurveIntercept: number | null;
  flowCurveR2: number | null;
  flowCurveMethod: 'regression' | 'one_point' | 'direct' | 'non_plastic' | 'insufficient';
}

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface VerificationCheck {
  id: string;
  category: 'integrity' | 'atterberg' | 'consistency';
  titleTh: string;
  titleEn: string;
  status: CheckStatus;
  measuredText: string;
  criterionText: string;
  detailTh: string;
  detailEn: string;
}

export interface ClassificationStep {
  stepNumber: number;
  ruleTh: string;
  ruleEn: string;
  condition: string;
  observed: string;
  passed: boolean;
  conclusionTh: string;
  conclusionEn: string;
}

export interface USCSResult {
  symbol: string;
  groupNameEn: string;
  groupNameTh: string;
  majorDivisionTh: string;
  majorDivisionEn: string;
  finesZone: string;
  steps: ClassificationStep[];
}

export interface AASHTOGroupEvaluation {
  group: string;
  isSelected: boolean;
  overallPass: boolean;
  criteria: {
    label: string;
    requirement: string;
    actual: string;
    pass: boolean;
  }[];
}

export interface AASHTOResult {
  group: string;
  groupIndex: number;
  fullNotation: string;
  generalClassificationTh: string;
  generalClassificationEn: string;
  subgradeRatingTh: string;
  subgradeRatingEn: string;
  giFormulaGeneral: string;
  giFormulaSubstituted: string;
  giRawValue: number;
  evaluations: AASHTOGroupEvaluation[];
  steps: ClassificationStep[];
}

export interface SoilAnalysisOutput {
  sieveRows: ComputedSieveRow[];
  totalMassInputG: number;
  sumRetainedPlusPanG: number;
  panComputedG: number;
  massLossG: number;
  massLossPct: number;
  cobblesPct: number;
  gravelPct: number;
  sandPct: number;
  finesPct: number;
  p4: number;
  p10: number;
  p40: number;
  p200: number;
  d10: number | null;
  d30: number | null;
  d60: number | null;
  cu: number | null;
  cc: number | null;
  curvePoints: GSDCurvePoint[];
  atterberg: AtterbergComputed;
  uscs: USCSResult;
  aashto: AASHTOResult;
  checks: VerificationCheck[];
  overallStatus: CheckStatus;
}
