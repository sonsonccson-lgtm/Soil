import {
  AASHTOGroupEvaluation,
  AASHTOResult,
  AtterbergComputed,
  CheckStatus,
  ClassificationStep,
  ComputedSieveRow,
  GSDCurvePoint,
  LLTrialComputed,
  PLTrialComputed,
  SoilAnalysisOutput,
  SoilSampleInput,
  USCSResult,
  VerificationCheck,
} from '../types/geotech';

function roundTo(val: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function computeWaterContent(
  emptyCan: number,
  wetSoilCan: number,
  drySoilCan: number,
): number | null {
  const drySoil = drySoilCan - emptyCan;
  const water = wetSoilCan - drySoilCan;
  if (drySoil <= 0 || wetSoilCan <= 0 || drySoilCan <= 0 || water < 0) {
    return null;
  }
  return (water / drySoil) * 100;
}

export function computeAtterberg(input: SoilSampleInput): AtterbergComputed {
  const llTrials: LLTrialComputed[] = input.llTrials.map((t) => {
    const w = computeWaterContent(t.emptyCanG, t.wetSoilCanG, t.drySoilCanG);
    const valid = w !== null && t.blows > 0 && t.blows <= 100;
    return {
      ...t,
      waterContentPct: w !== null ? roundTo(w, 2) : null,
      valid,
    };
  });

  const plTrials: PLTrialComputed[] = input.plTrials.map((t) => {
    const w = computeWaterContent(t.emptyCanG, t.wetSoilCanG, t.drySoilCanG);
    const valid = w !== null;
    return {
      ...t,
      waterContentPct: w !== null ? roundTo(w, 2) : null,
      valid,
    };
  });

  if (input.isNonPlastic) {
    return {
      ll: 0,
      pl: 0,
      pi: 0,
      isNonPlastic: true,
      isOrganic: false,
      organicRatio: null,
      llTrials,
      plTrials,
      flowCurveSlope: null,
      flowCurveIntercept: null,
      flowCurveR2: null,
      flowCurveMethod: 'non_plastic',
    };
  }

  let ll: number | null = null;
  let pl: number | null = null;
  let flowCurveSlope: number | null = null;
  let flowCurveIntercept: number | null = null;
  let flowCurveR2: number | null = null;
  let flowCurveMethod: AtterbergComputed['flowCurveMethod'] = 'insufficient';

  if (input.atterbergMode === 'direct') {
    ll = input.directLL > 0 ? roundTo(input.directLL, 2) : null;
    pl = input.directPL >= 0 ? roundTo(input.directPL, 2) : null;
    flowCurveMethod = 'direct';
  } else {
    const validLL = llTrials.filter((t) => t.valid && t.waterContentPct !== null);
    const distinctBlows = new Set(validLL.map((t) => t.blows));

    if (validLL.length >= 2 && distinctBlows.size >= 2) {
      const pts = validLL.map((t) => ({
        x: Math.log(t.blows),
        y: t.waterContentPct as number,
      }));
      const n = pts.length;
      const meanX = pts.reduce((acc, p) => acc + p.x, 0) / n;
      const meanY = pts.reduce((acc, p) => acc + p.y, 0) / n;
      const sxx = pts.reduce((acc, p) => acc + (p.x - meanX) ** 2, 0);
      const sxy = pts.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0);
      const syy = pts.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);

      if (sxx > 0) {
        const slope = sxy / sxx;
        const intercept = meanY - slope * meanX;
        const predicted25 = slope * Math.log(25) + intercept;
        let r2 = 1;
        if (syy > 0) {
          const ssRes = pts.reduce((acc, p) => acc + (p.y - (slope * p.x + intercept)) ** 2, 0);
          r2 = Math.max(0, 1 - ssRes / syy);
        }
        ll = roundTo(predicted25, 2);
        flowCurveSlope = slope;
        flowCurveIntercept = intercept;
        flowCurveR2 = roundTo(r2, 4);
        flowCurveMethod = 'regression';
      }
    } else if (validLL.length >= 1) {
      // ASTM D4318 1-point method approximation
      const t = validLL[0];
      const w = t.waterContentPct as number;
      ll = roundTo(w * Math.pow(t.blows / 25, 0.121), 2);
      flowCurveMethod = 'one_point';
    }

    const validPL = plTrials.filter((t) => t.valid && t.waterContentPct !== null);
    if (validPL.length > 0) {
      const avgPL =
        validPL.reduce((acc, t) => acc + (t.waterContentPct as number), 0) / validPL.length;
      pl = roundTo(avgPL, 2);
    }
  }

  const pi = ll !== null && pl !== null ? roundTo(ll - pl, 2) : null;
  let organicRatio: number | null = null;
  let isOrganic = false;
  if (input.checkOrganic && ll !== null && ll > 0 && input.ovenDriedLL !== null && input.ovenDriedLL > 0) {
    organicRatio = roundTo(input.ovenDriedLL / ll, 3);
    isOrganic = organicRatio < 0.75;
  }

  return {
    ll,
    pl,
    pi,
    isNonPlastic: false,
    isOrganic,
    organicRatio,
    llTrials,
    plTrials,
    flowCurveSlope,
    flowCurveIntercept,
    flowCurveR2,
    flowCurveMethod,
  };
}

function interpolateDiameterAtPercent(points: GSDCurvePoint[], targetPct: number): number | null {
  if (points.length < 2) return null;
  // Points are ordered coarse to fine (descending diameterMm)
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (
      (p1.percentPassing >= targetPct && p2.percentPassing <= targetPct) ||
      (p1.percentPassing <= targetPct && p2.percentPassing >= targetPct)
    ) {
      if (p1.percentPassing === p2.percentPassing) {
        return p1.diameterMm;
      }
      if (p1.diameterMm <= 0 || p2.diameterMm <= 0) continue;
      const log1 = Math.log10(p1.diameterMm);
      const log2 = Math.log10(p2.diameterMm);
      const t = (targetPct - p2.percentPassing) / (p1.percentPassing - p2.percentPassing);
      const logD = log2 + t * (log1 - log2);
      return Math.pow(10, logD);
    }
  }
  return null;
}

function interpolatePassingAtDiameter(points: GSDCurvePoint[], targetMm: number): number {
  const exact = points.find((p) => Math.abs(p.diameterMm - targetMm) < 1e-6);
  if (exact) return exact.percentPassing;
  if (points.length === 0) return 0;
  if (targetMm >= points[0].diameterMm) return points[0].percentPassing;
  if (targetMm <= points[points.length - 1].diameterMm) return points[points.length - 1].percentPassing;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p1.diameterMm >= targetMm && p2.diameterMm <= targetMm && p1.diameterMm > 0 && p2.diameterMm > 0) {
      const log1 = Math.log10(p1.diameterMm);
      const log2 = Math.log10(p2.diameterMm);
      const logT = Math.log10(targetMm);
      const t = (logT - log2) / (log1 - log2);
      return p2.percentPassing + t * (p1.percentPassing - p2.percentPassing);
    }
  }
  return 0;
}

function evaluateFinesPlasticity(atterberg: AtterbergComputed): {
  zone: 'CL' | 'ML' | 'CL-ML' | 'CH' | 'MH' | 'OL' | 'OH' | 'NP';
  aboveOrOnALine: boolean;
  aLinePI: number | null;
} {
  if (atterberg.isNonPlastic || atterberg.ll === null || atterberg.pi === null) {
    return { zone: 'NP', aboveOrOnALine: false, aLinePI: null };
  }
  const ll = atterberg.ll;
  const pi = atterberg.pi;
  const aLinePI = roundTo(0.73 * (ll - 20), 2);
  const aboveOrOnALine = pi >= aLinePI;

  if (atterberg.isOrganic) {
    return {
      zone: ll < 50 ? 'OL' : 'OH',
      aboveOrOnALine,
      aLinePI,
    };
  }

  if (ll < 50) {
    if (pi >= 4 && pi <= 7 && aboveOrOnALine) {
      return { zone: 'CL-ML', aboveOrOnALine, aLinePI };
    }
    if (pi > 7 && aboveOrOnALine) {
      return { zone: 'CL', aboveOrOnALine, aLinePI };
    }
    return { zone: 'ML', aboveOrOnALine, aLinePI };
  } else {
    if (aboveOrOnALine) {
      return { zone: 'CH', aboveOrOnALine, aLinePI };
    }
    return { zone: 'MH', aboveOrOnALine, aLinePI };
  }
}

function classifyUSCS(
  p4: number,
  p200: number,
  cobblesPct: number,
  cu: number | null,
  cc: number | null,
  atterberg: AtterbergComputed,
): USCSResult {
  const steps: ClassificationStep[] = [];
  // Normalize < 75 mm fraction per ASTM D2487 if cobbles exist
  const normFactor = cobblesPct > 0 && cobblesPct < 100 ? 100 / (100 - cobblesPct) : 1;
  const p4Norm = Math.min(100, p4 * normFactor);
  const p200Norm = Math.min(100, p200 * normFactor);

  const gravelPct = roundTo(100 - p4Norm, 2);
  const sandPct = roundTo(p4Norm - p200Norm, 2);
  const finesPct = roundTo(p200Norm, 2);
  const retained200Pct = roundTo(100 - finesPct, 2);

  const finesInfo = evaluateFinesPlasticity(atterberg);
  const aLineStr = finesInfo.aLinePI !== null ? `A-Line PI = ${finesInfo.aLinePI.toFixed(1)}` : 'NP';

  if (cobblesPct > 0) {
    steps.push({
      stepNumber: 0,
      ruleTh: 'ปรับสัดส่วนเฉพาะเม็ดดินขนาด < 75 มม. (3") ตาม ASTM D2487',
      ruleEn: 'Normalize fractions to < 75 mm (3 in.) portion per ASTM D2487',
      condition: 'Cobbles (> 75 mm) excluded from USCS symbol calculation',
      observed: `Cobbles = ${cobblesPct.toFixed(1)}% · Adjusted Fines = ${finesPct.toFixed(1)}%`,
      passed: true,
      conclusionTh: 'คำนวณสัดส่วนกรวด-ทราย-เม็ดละเอียดบนฐาน < 75 มม.',
      conclusionEn: 'Normalized gravel/sand/fines on < 75 mm base',
    });
  }

  const isCoarse = finesPct < 50;
  steps.push({
    stepNumber: 1,
    ruleTh: 'ปริมาณเม็ดละเอียด (No. 200)',
    ruleEn: 'Fines Passing No. 200',
    condition: '< 50% หยาบ · ≥ 50% ละเอียด',
    observed: `P₂₀₀ = ${finesPct.toFixed(1)}%`,
    passed: true,
    conclusionTh: isCoarse ? 'ดินเม็ดหยาบ' : 'ดินเม็ดละเอียด',
    conclusionEn: isCoarse ? 'Coarse-Grained' : 'Fine-Grained',
  });

  if (isCoarse) {
    const isGravel = gravelPct > sandPct;
    steps.push({
      stepNumber: 2,
      ruleTh: 'สัดส่วนกรวด vs ทราย',
      ruleEn: 'Gravel vs. Sand',
      condition: isGravel ? 'Gravel > Sand' : 'Sand ≥ Gravel',
      observed: `Gravel ${gravelPct.toFixed(1)}% · Sand ${sandPct.toFixed(1)}%`,
      passed: true,
      conclusionTh: isGravel ? 'กลุ่มกรวด (G)' : 'กลุ่มทราย (S)',
      conclusionEn: isGravel ? 'Gravel (G)' : 'Sand (S)',
    });

    const cuReq = isGravel ? 4 : 6;
    const isWellGraded =
      cu !== null && cc !== null && cu >= cuReq && cc >= 1 && cc <= 3;

    const finesClean = finesPct < 5;
    const finesDual = finesPct >= 5 && finesPct <= 12;

    steps.push({
      stepNumber: 3,
      ruleTh: 'ช่วงปริมาณเม็ดละเอียด',
      ruleEn: 'Fines Bracket',
      condition: '<5% · 5–12% · >12%',
      observed: `Fines = ${finesPct.toFixed(1)}%`,
      passed: true,
      conclusionTh: finesClean
        ? 'พิจารณา Cu, Cc'
        : finesDual
          ? 'สัญลักษณ์คู่ (5–12%)'
          : 'พิจารณา Plasticity Chart',
      conclusionEn: finesClean
        ? 'Gradation (Cu, Cc)'
        : finesDual
          ? 'Dual Symbol (5–12%)'
          : 'Plasticity Chart',
    });

    const finesAreSilty = finesInfo.zone === 'ML' || finesInfo.zone === 'MH' || finesInfo.zone === 'NP' || finesInfo.zone === 'OL' || finesInfo.zone === 'OH';
    const finesAreCLML = finesInfo.zone === 'CL-ML';

    let symbol = '';
    let baseEn = '';
    let baseTh = '';

    if (finesClean) {
      const gradSymbol = isWellGraded ? (isGravel ? 'GW' : 'SW') : isGravel ? 'GP' : 'SP';
      symbol = gradSymbol;
      baseEn = isWellGraded
        ? isGravel
          ? 'Well-graded gravel'
          : 'Well-graded sand'
        : isGravel
          ? 'Poorly graded gravel'
          : 'Poorly graded sand';
      baseTh = isWellGraded
        ? isGravel
          ? 'กรวดคละขนาดดี'
          : 'ทรายคละขนาดดี'
        : isGravel
          ? 'กรวดคละขนาดไม่ดี'
          : 'ทรายคละขนาดไม่ดี';

      steps.push({
        stepNumber: 4,
        ruleTh: `ตรวจสอบเกณฑ์การคละขนาด (Cu ≥ ${cuReq} และ 1 ≤ Cc ≤ 3)`,
        ruleEn: `Gradation Criteria (Cu ≥ ${cuReq} and 1 ≤ Cc ≤ 3)`,
        condition: `Cu ≥ ${cuReq} and 1 ≤ Cc ≤ 3`,
        observed:
          cu !== null && cc !== null
            ? `Cu = ${cu.toFixed(2)}, Cc = ${cc.toFixed(2)}`
            : 'Cu / Cc cannot be evaluated (insufficient fine points)',
        passed: isWellGraded,
        conclusionTh: `${symbol} (${baseTh})`,
        conclusionEn: `${symbol} (${baseEn})`,
      });
    } else if (finesDual) {
      const firstSym = isWellGraded ? (isGravel ? 'GW' : 'SW') : isGravel ? 'GP' : 'SP';
      const secondSym = finesAreSilty ? (isGravel ? 'GM' : 'SM') : isGravel ? 'GC' : 'SC';
      symbol = `${firstSym}-${secondSym}`;

      const gradDescEn = isWellGraded
        ? isGravel
          ? 'Well-graded gravel'
          : 'Well-graded sand'
        : isGravel
          ? 'Poorly graded gravel'
          : 'Poorly graded sand';
      const finesDescEn = finesAreSilty ? 'silt' : 'clay';
      baseEn = `${gradDescEn} with ${finesDescEn}`;

      const gradDescTh = isWellGraded
        ? isGravel
          ? 'กรวดคละขนาดดี'
          : 'ทรายคละขนาดดี'
        : isGravel
          ? 'กรวดคละขนาดไม่ดี'
          : 'ทรายคละขนาดไม่ดี';
      const finesDescTh = finesAreSilty ? 'ปนทรายแป้ง' : 'ปนดินเหนียว';
      baseTh = `${gradDescTh}${finesDescTh}`;

      steps.push({
        stepNumber: 4,
        ruleTh: `ตรวจสอบทั้งเกณฑ์คละขนาด (Cu/Cc) และ Plasticity Chart สำหรับสัญลักษณ์คู่`,
        ruleEn: `Evaluate both Gradation (Cu/Cc) and Fines Plasticity for Dual Symbol`,
        condition: `Cu ≥ ${cuReq}, 1 ≤ Cc ≤ 3 | Fines vs ${aLineStr}`,
        observed: `Cu=${cu !== null ? cu.toFixed(2) : 'N/A'}, Cc=${cc !== null ? cc.toFixed(2) : 'N/A'} · Fines Zone = ${finesInfo.zone}`,
        passed: true,
        conclusionTh: `${symbol} (${baseTh})`,
        conclusionEn: `${symbol} (${baseEn})`,
      });
    } else {
      // > 12% fines
      if (finesAreCLML) {
        symbol = isGravel ? 'GC-GM' : 'SC-SM';
        baseEn = isGravel ? 'Silty, clayey gravel' : 'Silty, clayey sand';
        baseTh = isGravel ? 'กรวดปนทรายแป้งและดินเหนียว' : 'ทรายปนทรายแป้งและดินเหนียว';
      } else if (finesAreSilty) {
        symbol = isGravel ? 'GM' : 'SM';
        baseEn = isGravel ? 'Silty gravel' : 'Silty sand';
        baseTh = isGravel ? 'กรวดปนทรายแป้ง' : 'ทรายปนทรายแป้ง';
      } else {
        symbol = isGravel ? 'GC' : 'SC';
        baseEn = isGravel ? 'Clayey gravel' : 'Clayey sand';
        baseTh = isGravel ? 'กรวดปนดินเหนียว' : 'ทรายปนดินเหนียว';
      }

      steps.push({
        stepNumber: 4,
        ruleTh: 'ตรวจสอบตำแหน่งของ (LL, PI) บน Plasticity Chart เพื่อจำแนกชนิดเม็ดละเอียด',
        ruleEn: 'Evaluate (LL, PI) on Casagrande Plasticity Chart',
        condition: 'PI < 4 or below A-Line → M (Silty) | PI > 7 & ≥ A-Line → C (Clayey) | 4–7 & ≥ A-Line → CL-ML',
        observed: atterberg.isNonPlastic
          ? 'Non-Plastic (NP)'
          : `LL=${atterberg.ll?.toFixed(1) ?? 'N/A'}, PI=${atterberg.pi?.toFixed(1) ?? 'N/A'} (${aLineStr}) → ${finesInfo.zone}`,
        passed: true,
        conclusionTh: `${symbol} (${baseTh})`,
        conclusionEn: `${symbol} (${baseEn})`,
      });
    }

    // Group name modifier (>= 15% minor coarse component, plus cobble note)
    let modEn = '';
    let modTh = '';
    if (isGravel && sandPct >= 15) {
      modEn = finesDual ? ' (and sand)' : ' with sand';
      modTh = 'ปนทราย';
    } else if (!isGravel && gravelPct >= 15) {
      modEn = finesDual ? ' (and gravel)' : ' with gravel';
      modTh = 'ปนกรวด';
    }
    if (cobblesPct >= 5) {
      modEn += ' with cobbles';
      modTh += ' มีหินใหญ่ปน';
    }

    const groupNameEn = `${baseEn}${modEn}`;
    const groupNameTh = `${baseTh}${modTh}`;

    steps.push({
      stepNumber: 5,
      ruleTh: 'ตรวจสอบส่วนประกอบรอง (≥ 15%) เพื่อตั้งชื่อกลุ่มมาตรฐาน ASTM D2487',
      ruleEn: 'Apply Secondary Coarse Modifier (≥ 15%) for Standard Group Name',
      condition: isGravel ? 'Sand ≥ 15% → "with sand"' : 'Gravel ≥ 15% → "with gravel"',
      observed: isGravel ? `Sand = ${sandPct.toFixed(1)}%` : `Gravel = ${gravelPct.toFixed(1)}%`,
      passed: true,
      conclusionTh: `${symbol}: ${groupNameTh}`,
      conclusionEn: `${symbol}: ${groupNameEn}`,
    });

    return {
      symbol,
      groupNameEn,
      groupNameTh,
      majorDivisionTh: 'ดินเม็ดหยาบ (Coarse-Grained Soils)',
      majorDivisionEn: 'Coarse-Grained Soils',
      finesZone: finesInfo.zone,
      steps,
    };
  } else {
    // Fine-grained soil (>= 50% passing No. 200)
    const ll = atterberg.ll ?? 0;
    const pi = atterberg.pi ?? 0;
    const symbol = finesInfo.zone === 'NP' ? 'ML' : finesInfo.zone;

    steps.push({
      stepNumber: 2,
      ruleTh: 'ตรวจสอบค่า Liquid Limit (LL) เพื่อแบ่งความยืดหยุ่นต่ำ (< 50) หรือสูง (≥ 50)',
      ruleEn: 'Plasticity Division: LL < 50 (Low) vs. LL ≥ 50 (High)',
      condition: 'LL < 50 → L | LL ≥ 50 → H',
      observed: atterberg.isNonPlastic ? 'Non-Plastic (treated as ML)' : `LL = ${ll.toFixed(1)}%`,
      passed: true,
      conclusionTh: ll < 50 ? 'ความยืดหยุ่นต่ำ (Low Plasticity, L)' : 'ความยืดหยุ่นสูง (High Plasticity, H)',
      conclusionEn: ll < 50 ? 'Low Plasticity (L)' : 'High Plasticity (H)',
    });

    steps.push({
      stepNumber: 3,
      ruleTh: 'ตรวจสอบตำแหน่ง (LL, PI) เทียบกับเส้น A-Line และโซน CL-ML',
      ruleEn: 'Compare (LL, PI) against Casagrande A-Line & CL-ML zone',
      condition: 'A-Line: PI = 0.73(LL − 20) | CL-ML: 4 ≤ PI ≤ 7 above A-Line',
      observed: atterberg.isNonPlastic
        ? 'NP → Below A-Line (ML)'
        : `LL = ${ll.toFixed(1)}, PI = ${pi.toFixed(1)}, ${aLineStr}`,
      passed: true,
      conclusionTh: `สัญลักษณ์กลุ่ม: ${symbol}`,
      conclusionEn: `Group Symbol: ${symbol}`,
    });

    const baseNames: Record<string, { en: string; th: string }> = {
      CL: { en: 'Lean clay', th: 'ดินเหนียวความยืดหยุ่นต่ำ' },
      ML: { en: 'Silt', th: 'ดินตะกอนทรายแป้ง' },
      'CL-ML': { en: 'Silty clay', th: 'ดินเหนียวปนทรายแป้ง' },
      OL: { en: 'Organic clay/silt (low plasticity)', th: 'ดินอินทรีย์ความยืดหยุ่นต่ำ' },
      CH: { en: 'Fat clay', th: 'ดินเหนียวความยืดหยุ่นสูง' },
      MH: { en: 'Elastic silt', th: 'ดินตะกอนยืดหยุ่นสูง' },
      OH: { en: 'Organic clay/silt (high plasticity)', th: 'ดินอินทรีย์ความยืดหยุ่นสูง' },
    };

    const base = baseNames[symbol] ?? { en: 'Silt', th: 'ดินตะกอนทรายแป้ง' };
    let groupNameEn = base.en;
    let groupNameTh = base.th;

    if (retained200Pct >= 30) {
      const domSand = sandPct >= gravelPct;
      groupNameEn = `${domSand ? 'Sandy' : 'Gravelly'} ${base.en.toLowerCase()}`;
      groupNameTh = `${base.th}${domSand ? 'ปนทรายมาก' : 'ปนกรวดมาก'}`;
      if (domSand && gravelPct >= 15) {
        groupNameEn += ' with gravel';
        groupNameTh += ' และมีกรวดปน';
      } else if (!domSand && sandPct >= 15) {
        groupNameEn += ' with sand';
        groupNameTh += ' และมีทรายปน';
      }
    } else if (retained200Pct >= 15) {
      const domSand = sandPct >= gravelPct;
      groupNameEn = `${base.en} ${domSand ? 'with sand' : 'with gravel'}`;
      groupNameTh = `${base.th}${domSand ? 'ปนทราย' : 'ปนกรวด'}`;
    }

    steps.push({
      stepNumber: 4,
      ruleTh: 'ตรวจสอบสัดส่วนเม็ดหยาบที่ค้างตะแกรง No. 200 เพื่อกำหนดชื่อกลุ่มเต็ม',
      ruleEn: 'Coarse Fraction Retained on No. 200 (<15%, 15–29%, ≥30%)',
      condition: '<15% (Base) | 15–29% ("with sand/gravel") | ≥30% ("Sandy/Gravelly")',
      observed: `Retained No. 200 = ${retained200Pct.toFixed(1)}% (Sand ${sandPct.toFixed(1)}%, Gravel ${gravelPct.toFixed(1)}%)`,
      passed: true,
      conclusionTh: `${symbol}: ${groupNameTh}`,
      conclusionEn: `${symbol}: ${groupNameEn}`,
    });

    return {
      symbol,
      groupNameEn,
      groupNameTh,
      majorDivisionTh: 'ดินเม็ดละเอียด (Fine-Grained Soils)',
      majorDivisionEn: 'Fine-Grained Soils',
      finesZone: symbol,
      steps,
    };
  }
}

function classifyAASHTO(
  p10: number,
  p40: number,
  p200: number,
  atterberg: AtterbergComputed,
): AASHTOResult {
  const isNP = atterberg.isNonPlastic;
  const ll = isNP ? 0 : (atterberg.ll ?? 0);
  const pi = isNP ? 0 : Math.max(0, atterberg.pi ?? 0);

  const fmt = (n: number) => `${roundTo(n, 1)}%`;
  const fmtVal = (n: number) => `${roundTo(n, 1)}`;

  const evaluations: AASHTOGroupEvaluation[] = [
    {
      group: 'A-1-a',
      isSelected: false,
      overallPass: p10 <= 50 && p40 <= 30 && p200 <= 15 && pi <= 6,
      criteria: [
        { label: '#10', requirement: '≤ 50%', actual: fmt(p10), pass: p10 <= 50 },
        { label: '#40', requirement: '≤ 30%', actual: fmt(p40), pass: p40 <= 30 },
        { label: '#200', requirement: '≤ 15%', actual: fmt(p200), pass: p200 <= 15 },
        { label: 'PI', requirement: '≤ 6', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi <= 6 },
      ],
    },
    {
      group: 'A-1-b',
      isSelected: false,
      overallPass: p40 <= 50 && p200 <= 25 && pi <= 6,
      criteria: [
        { label: '#40', requirement: '≤ 50%', actual: fmt(p40), pass: p40 <= 50 },
        { label: '#200', requirement: '≤ 25%', actual: fmt(p200), pass: p200 <= 25 },
        { label: 'PI', requirement: '≤ 6', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi <= 6 },
      ],
    },
    {
      group: 'A-3',
      isSelected: false,
      overallPass: p40 >= 51 && p200 <= 10 && (isNP || pi === 0),
      criteria: [
        { label: '#40', requirement: '≥ 51%', actual: fmt(p40), pass: p40 >= 51 },
        { label: '#200', requirement: '≤ 10%', actual: fmt(p200), pass: p200 <= 10 },
        { label: 'PI', requirement: 'NP', actual: isNP || pi === 0 ? 'NP' : fmtVal(pi), pass: isNP || pi === 0 },
      ],
    },
    {
      group: 'A-2-4',
      isSelected: false,
      overallPass: p200 <= 35 && ll <= 40 && pi <= 10,
      criteria: [
        { label: '#200', requirement: '≤ 35%', actual: fmt(p200), pass: p200 <= 35 },
        { label: 'LL', requirement: '≤ 40', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll <= 40 },
        { label: 'PI', requirement: '≤ 10', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi <= 10 },
      ],
    },
    {
      group: 'A-2-5',
      isSelected: false,
      overallPass: p200 <= 35 && ll > 40 && pi <= 10,
      criteria: [
        { label: '#200', requirement: '≤ 35%', actual: fmt(p200), pass: p200 <= 35 },
        { label: 'LL', requirement: '≥ 41 (>40)', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll > 40 },
        { label: 'PI', requirement: '≤ 10', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi <= 10 },
      ],
    },
    {
      group: 'A-2-6',
      isSelected: false,
      overallPass: p200 <= 35 && ll <= 40 && pi > 10,
      criteria: [
        { label: '#200', requirement: '≤ 35%', actual: fmt(p200), pass: p200 <= 35 },
        { label: 'LL', requirement: '≤ 40', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll <= 40 },
        { label: 'PI', requirement: '≥ 11 (>10)', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi > 10 },
      ],
    },
    {
      group: 'A-2-7',
      isSelected: false,
      overallPass: p200 <= 35 && ll > 40 && pi > 10,
      criteria: [
        { label: '#200', requirement: '≤ 35%', actual: fmt(p200), pass: p200 <= 35 },
        { label: 'LL', requirement: '≥ 41 (>40)', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll > 40 },
        { label: 'PI', requirement: '≥ 11 (>10)', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi > 10 },
      ],
    },
    {
      group: 'A-4',
      isSelected: false,
      overallPass: p200 > 35 && ll <= 40 && pi <= 10,
      criteria: [
        { label: '#200', requirement: '> 35%', actual: fmt(p200), pass: p200 > 35 },
        { label: 'LL', requirement: '≤ 40', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll <= 40 },
        { label: 'PI', requirement: '≤ 10', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi <= 10 },
      ],
    },
    {
      group: 'A-5',
      isSelected: false,
      overallPass: p200 > 35 && ll > 40 && pi <= 10,
      criteria: [
        { label: '#200', requirement: '> 35%', actual: fmt(p200), pass: p200 > 35 },
        { label: 'LL', requirement: '≥ 41 (>40)', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll > 40 },
        { label: 'PI', requirement: '≤ 10', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi <= 10 },
      ],
    },
    {
      group: 'A-6',
      isSelected: false,
      overallPass: p200 > 35 && ll <= 40 && pi > 10,
      criteria: [
        { label: '#200', requirement: '> 35%', actual: fmt(p200), pass: p200 > 35 },
        { label: 'LL', requirement: '≤ 40', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll <= 40 },
        { label: 'PI', requirement: '≥ 11 (>10)', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi > 10 },
      ],
    },
    {
      group: 'A-7-5',
      isSelected: false,
      overallPass: p200 > 35 && ll > 40 && pi > 10 && pi <= ll - 30,
      criteria: [
        { label: '#200', requirement: '> 35%', actual: fmt(p200), pass: p200 > 35 },
        { label: 'LL', requirement: '≥ 41 (>40)', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll > 40 },
        { label: 'PI', requirement: '≥ 11 (>10)', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi > 10 },
        { label: 'A-7 Sub', requirement: `PI ≤ LL−30 (${roundTo(ll - 30, 1)})`, actual: fmtVal(pi), pass: pi <= ll - 30 },
      ],
    },
    {
      group: 'A-7-6',
      isSelected: false,
      overallPass: p200 > 35 && ll > 40 && pi > 10 && pi > ll - 30,
      criteria: [
        { label: '#200', requirement: '> 35%', actual: fmt(p200), pass: p200 > 35 },
        { label: 'LL', requirement: '≥ 41 (>40)', actual: isNP ? 'NP (0)' : fmtVal(ll), pass: ll > 40 },
        { label: 'PI', requirement: '≥ 11 (>10)', actual: isNP ? 'NP (0)' : fmtVal(pi), pass: pi > 10 },
        { label: 'A-7 Sub', requirement: `PI > LL−30 (${roundTo(ll - 30, 1)})`, actual: fmtVal(pi), pass: pi > ll - 30 },
      ],
    },
  ];

  // Pick first matching group left-to-right per AASHTO M 145
  let selectedEval = evaluations.find((e) => e.overallPass);
  if (!selectedEval) {
    // Fallback safeguard (theoretically unreachable since all LL/PI regions are covered)
    selectedEval = evaluations[evaluations.length - 1];
  }
  selectedEval.isSelected = true;

  const group = selectedEval.group;
  const isGranular = p200 <= 35;

  // Group Index Calculation per AASHTO M 145
  let giRaw = 0;
  let giFormulaGeneral = 'GI = (F − 35)[0.2 + 0.005(LL − 40)] + 0.01(F − 15)(PI − 10)';
  let giFormulaSubstituted = 'GI = 0 (ตามข้อกำหนด AASHTO M 145 สำหรับกลุ่ม A-1, A-3, A-2-4, A-2-5)';

  if (group === 'A-2-6' || group === 'A-2-7') {
    giFormulaGeneral = 'GI = 0.01(F₂₀₀ − 15)(PI − 10)';
    giRaw = 0.01 * (p200 - 15) * (pi - 10);
    giFormulaSubstituted = `GI = 0.01 × (${p200.toFixed(1)} − 15) × (${pi.toFixed(1)} − 10) = ${giRaw.toFixed(2)}`;
  } else if (['A-4', 'A-5', 'A-6', 'A-7-5', 'A-7-6'].includes(group)) {
    const term1 = (p200 - 35) * (0.2 + 0.005 * (ll - 40));
    const term2 = 0.01 * (p200 - 15) * (pi - 10);
    giRaw = term1 + term2;
    giFormulaSubstituted = `GI = (${p200.toFixed(1)} − 35)[0.2 + 0.005(${ll.toFixed(1)} − 40)] + 0.01(${p200.toFixed(1)} − 15)(${pi.toFixed(1)} − 10) = ${term1.toFixed(2)} + ${term2.toFixed(2)} = ${giRaw.toFixed(2)}`;
  }

  const groupIndex = Math.max(0, Math.round(giRaw));
  const fullNotation = `${group} (${groupIndex})`;

  const ratingMap: Record<string, { th: string; en: string }> = {
    'A-1-a': { th: 'ดีเยี่ยมถึงดี (เศษหิน กรวดและทราย)', en: 'Excellent to Good (Stone fragments, gravel & sand)' },
    'A-1-b': { th: 'ดีเยี่ยมถึงดี (กรวดและทรายปนละเอียดเล็กน้อย)', en: 'Excellent to Good (Gravel & sand)' },
    'A-3': { th: 'ดีเยี่ยมถึงดี (ทรายละเอียดคละสม่ำเสมอ)', en: 'Excellent to Good (Fine sand)' },
    'A-2-4': { th: 'ดีเยี่ยมถึงดี (กรวด/ทรายปนตะกอน)', en: 'Excellent to Good (Silty gravel/sand)' },
    'A-2-5': { th: 'ดีเยี่ยมถึงดี (กรวด/ทรายปนตะกอน LL สูง)', en: 'Excellent to Good (Silty gravel/sand, high LL)' },
    'A-2-6': { th: 'ดีเยี่ยมถึงดี (กรวด/ทรายปนดินเหนียว)', en: 'Excellent to Good (Clayey gravel/sand)' },
    'A-2-7': { th: 'ดีเยี่ยมถึงดี (กรวด/ทรายปนดินเหนียว LL สูง)', en: 'Excellent to Good (Clayey gravel/sand, high LL)' },
    'A-4': { th: 'พอใช้ถึงแย่ (ดินตะกอน)', en: 'Fair to Poor (Silty soils)' },
    'A-5': { th: 'พอใช้ถึงแย่ (ดินตะกอนยืดหยุ่นสูง)', en: 'Fair to Poor (Elastic silty soils)' },
    'A-6': { th: 'พอใช้ถึงแย่ (ดินเหนียว)', en: 'Fair to Poor (Clayey soils)' },
    'A-7-5': { th: 'พอใช้ถึงแย่ (ดินเหนียวปนตะกอนความยืดหยุ่นปานกลาง)', en: 'Fair to Poor (Clayey soils, moderate PI vs LL)' },
    'A-7-6': { th: 'พอใช้ถึงแย่ (ดินเหนียวความยืดหยุ่นสูงและหดพองมาก)', en: 'Fair to Poor (High-plasticity expansive clay)' },
  };

  const steps: ClassificationStep[] = [
    {
      stepNumber: 1,
      ruleTh: 'แยกกลุ่มตาม % ผ่าน No. 200',
      ruleEn: 'Split by Passing No. 200',
      condition: '≤35% เม็ดหยาบ · >35% ดินละเอียด',
      observed: `P₂₀₀ = ${p200.toFixed(1)}%`,
      passed: true,
      conclusionTh: isGranular ? 'วัสดุเม็ดหยาบ' : 'ดินตะกอน-ดินเหนียว',
      conclusionEn: isGranular ? 'Granular' : 'Silt-Clay',
    },
    {
      stepNumber: 2,
      ruleTh: 'คัดกรองจากซ้ายไปขวา (AASHTO M 145)',
      ruleEn: 'Left-to-Right Table Match',
      condition: 'เลือกกลุ่มแรกที่ผ่านทุกเกณฑ์',
      observed: `#10=${p10.toFixed(1)}%, #40=${p40.toFixed(1)}%, #200=${p200.toFixed(1)}%, LL=${isNP ? 'NP' : ll.toFixed(1)}, PI=${isNP ? 'NP' : pi.toFixed(1)}`,
      passed: true,
      conclusionTh: `กลุ่ม ${group}`,
      conclusionEn: `Group ${group}`,
    },
    {
      stepNumber: 3,
      ruleTh: 'คำนวณ Group Index (GI)',
      ruleEn: 'Group Index (GI)',
      condition: giFormulaGeneral,
      observed: giFormulaSubstituted,
      passed: true,
      conclusionTh: `${fullNotation}`,
      conclusionEn: `${fullNotation}`,
    },
  ];

  return {
    group,
    groupIndex,
    fullNotation,
    generalClassificationTh: isGranular
      ? 'วัสดุเม็ดหยาบ (Granular Materials · ผ่าน No. 200 ≤ 35%)'
      : 'ดินตะกอน-ดินเหนียว (Silt-Clay Materials · ผ่าน No. 200 > 35%)',
    generalClassificationEn: isGranular
      ? 'Granular Materials (≤ 35% passing No. 200)'
      : 'Silt-Clay Materials (> 35% passing No. 200)',
    subgradeRatingTh: ratingMap[group]?.th ?? '',
    subgradeRatingEn: ratingMap[group]?.en ?? '',
    giFormulaGeneral,
    giFormulaSubstituted,
    giRawValue: roundTo(giRaw, 2),
    evaluations,
    steps,
  };
}

export function analyzeSoilSample(input: SoilSampleInput): SoilAnalysisOutput {
  // 1. Reduce sieve data
  let sumRetainedG = 0;
  const rawRetainedList = input.sieves.map((s) => {
    if (input.sieveMode === 'sieve_plus_soil') {
      return Math.max(0, s.sievePlusSoilG - s.emptySieveG);
    }
    return Math.max(0, s.massRetainedG);
  });

  const panComputedG =
    input.sieveMode === 'sieve_plus_soil'
      ? Math.max(0, input.panPlusSoilG - input.panEmptyG)
      : Math.max(0, input.panMassG);

  sumRetainedG = rawRetainedList.reduce((a, b) => a + b, 0) + panComputedG;

  let sieveRows: ComputedSieveRow[] = [];
  let totalMassInputG = input.totalDryMassG;
  let massLossG = 0;
  let massLossPct = 0;

  if (input.sieveMode === 'percent_passing') {
    const denom = totalMassInputG > 0 ? totalMassInputG : 100;
    let prevPass = 100;
    sieveRows = input.sieves.map((s) => {
      const pctPass = Math.max(0, Math.min(100, s.directPercentPassing));
      const incRetPct = Math.max(0, prevPass - pctPass);
      prevPass = pctPass;
      const massRet = (incRetPct / 100) * denom;
      const cumRetPct = 100 - pctPass;
      return {
        ...s,
        computedMassRetainedG: roundTo(massRet, 2),
        cumulativeRetainedG: roundTo((cumRetPct / 100) * denom, 2),
        cumulativePercentRetained: roundTo(cumRetPct, 2),
        percentPassing: roundTo(pctPass, 2),
      };
    });
    sumRetainedG = denom;
  } else {
    const denom = sumRetainedG > 0 ? sumRetainedG : 1;
    let cumG = 0;
    sieveRows = input.sieves.map((s, idx) => {
      const retG = rawRetainedList[idx];
      cumG += retG;
      const cumPct = sumRetainedG > 0 ? (cumG / denom) * 100 : 0;
      const pctPass = sumRetainedG > 0 ? Math.max(0, 100 - cumPct) : 0;
      return {
        ...s,
        computedMassRetainedG: roundTo(retG, 2),
        cumulativeRetainedG: roundTo(cumG, 2),
        cumulativePercentRetained: roundTo(cumPct, 2),
        percentPassing: roundTo(pctPass, 2),
      };
    });

    if (totalMassInputG > 0) {
      massLossG = roundTo(totalMassInputG - sumRetainedG, 2);
      massLossPct = roundTo((Math.abs(massLossG) / totalMassInputG) * 100, 2);
    }
  }

  // 2. Build GSD curve points
  const curvePoints: GSDCurvePoint[] = sieveRows.map((r) => ({
    diameterMm: r.openingMm,
    percentPassing: r.percentPassing,
    label: r.label,
    source: 'sieve' as const,
  }));

  if (input.useHydrometer && input.hydrometerPoints.length > 0) {
    const validHydro = input.hydrometerPoints
      .filter((h) => h.diameterMm > 0 && h.diameterMm < 0.075 && h.percentFiner >= 0 && h.percentFiner <= 100)
      .sort((a, b) => b.diameterMm - a.diameterMm);
    for (const h of validHydro) {
      curvePoints.push({
        diameterMm: h.diameterMm,
        percentPassing: roundTo(h.percentFiner, 2),
        label: `Hyd (${h.diameterMm}mm)`,
        source: 'hydrometer',
      });
    }
  }

  // Sort coarse to fine just in case
  curvePoints.sort((a, b) => b.diameterMm - a.diameterMm);

  // Key sieve passings
  const p3in = interpolatePassingAtDiameter(curvePoints, 75.0);
  const p4 = interpolatePassingAtDiameter(curvePoints, 4.75);
  const p10 = interpolatePassingAtDiameter(curvePoints, 2.0);
  const p40 = interpolatePassingAtDiameter(curvePoints, 0.425);
  const p200 = interpolatePassingAtDiameter(curvePoints, 0.075);

  const cobblesPct = roundTo(Math.max(0, 100 - p3in), 2);
  const gravelPct = roundTo(Math.max(0, p3in - p4), 2);
  const sandPct = roundTo(Math.max(0, p4 - p200), 2);
  const finesPct = roundTo(Math.max(0, p200), 2);

  // D10, D30, D60
  const d10Raw = interpolateDiameterAtPercent(curvePoints, 10);
  const d30Raw = interpolateDiameterAtPercent(curvePoints, 30);
  const d60Raw = interpolateDiameterAtPercent(curvePoints, 60);

  const d10 = d10Raw !== null ? roundTo(d10Raw, 4) : null;
  const d30 = d30Raw !== null ? roundTo(d30Raw, 4) : null;
  const d60 = d60Raw !== null ? roundTo(d60Raw, 4) : null;

  const cu = d10Raw !== null && d60Raw !== null && d10Raw > 0 ? roundTo(d60Raw / d10Raw, 2) : null;
  const cc =
    d10Raw !== null && d30Raw !== null && d60Raw !== null && d10Raw > 0 && d60Raw > 0
      ? roundTo((d30Raw * d30Raw) / (d10Raw * d60Raw), 2)
      : null;

  // 3. Atterberg
  const atterberg = computeAtterberg(input);

  // 4. Classifications
  const uscs = classifyUSCS(p4, p200, cobblesPct, cu, cc, atterberg);
  const aashto = classifyAASHTO(p10, p40, p200, atterberg);

  // 5. Verification & Integrity Checks
  const checks: VerificationCheck[] = [];

  // Check 1: Sieve mass balance (or percent passing bounds)
  if (input.sieveMode !== 'percent_passing') {
    const hasMass = sumRetainedG > 0;
    const lossStatus: CheckStatus = !hasMass ? 'fail' : massLossPct <= 2.0 ? 'pass' : massLossPct <= 5.0 ? 'warn' : 'fail';
    checks.push({
      id: 'mass_balance',
      category: 'integrity',
      titleTh: 'สมดุลมวลตะแกรง',
      titleEn: 'Sieve Mass Balance',
      status: lossStatus,
      measuredText: hasMass ? `Δ = ${massLossPct.toFixed(2)}%` : '0.0 g',
      criterionText: '≤ 2.0%',
      detailTh: !hasMass
        ? 'ยังไม่มีข้อมูลน้ำหนักค้างตะแกรง'
        : massLossPct <= 2.0
          ? `น้ำหนักรวม ${sumRetainedG.toFixed(1)} g / ${totalMassInputG.toFixed(1)} g (อยู่ในเกณฑ์)`
          : `น้ำหนักคลาดเคลื่อน ${massLossPct.toFixed(2)}% เกิน 2.0%`,
      detailEn: !hasMass
        ? 'No sieve mass recorded.'
        : massLossPct <= 2.0
          ? `Sum ${sumRetainedG.toFixed(1)} g vs ${totalMassInputG.toFixed(1)} g (within 2%)`
          : `Discrepancy ${massLossPct.toFixed(2)}% exceeds 2.0%`,
    });
  } else {
    let monotonic = true;
    for (let i = 0; i < sieveRows.length - 1; i++) {
      if (sieveRows[i].directPercentPassing < sieveRows[i + 1].directPercentPassing) {
        monotonic = false;
        break;
      }
    }
    checks.push({
      id: 'monotonicity',
      category: 'integrity',
      titleTh: 'ลำดับ % ผ่านตะแกรง',
      titleEn: '% Passing Order',
      status: monotonic ? 'pass' : 'fail',
      measuredText: monotonic ? 'ปกติ' : 'ย้อนกลับ',
      criterionText: 'ลดลงตามลำดับ',
      detailTh: monotonic
        ? 'ค่า % ผ่านลดลงจากตะแกรงใหญ่ไปเล็กถูกต้อง'
        : 'พบค่า % ผ่านของตะแกรงเล็กมากกว่าตะแกรงใหญ่',
      detailEn: monotonic
        ? '% Passing decreases monotonically.'
        : 'Finer sieve exceeds coarser sieve.',
    });
  }

  // Check 2: Soil Fractions Sum to 100%
  const fracSum = roundTo(cobblesPct + gravelPct + sandPct + finesPct, 2);
  checks.push({
    id: 'fraction_sum',
    category: 'integrity',
    titleTh: 'ผลรวมองค์ประกอบดิน',
    titleEn: 'Fraction Sum',
    status: Math.abs(fracSum - 100) <= 0.2 ? 'pass' : 'fail',
    measuredText: `${fracSum.toFixed(1)}%`,
    criterionText: '100.0%',
    detailTh: `Gravel ${gravelPct.toFixed(1)}% + Sand ${sandPct.toFixed(1)}% + Fines ${finesPct.toFixed(1)}%`,
    detailEn: `Gravel ${gravelPct.toFixed(1)}% + Sand ${sandPct.toFixed(1)}% + Fines ${finesPct.toFixed(1)}%`,
  });

  // Check 3: Atterberg Physical Validity & U-Line
  if (atterberg.isNonPlastic) {
    checks.push({
      id: 'atterberg_valid',
      category: 'atterberg',
      titleTh: 'ค่าความยืดหยุ่น (Atterberg)',
      titleEn: 'Atterberg Validity',
      status: 'pass',
      measuredText: 'NP (PI = 0)',
      criterionText: 'Non-Plastic',
      detailTh: 'ดินไม่มีความยืดหยุ่น (PI = 0)',
      detailEn: 'Non-plastic soil (PI = 0)',
    });
  } else {
    const ll = atterberg.ll;
    const pl = atterberg.pl;
    const pi = atterberg.pi;
    const validNums = ll !== null && pl !== null && pi !== null && ll > 0 && pl >= 0;
    const plLeLl = validNums && pi >= 0;
    const uLineMax = ll !== null ? roundTo(0.9 * (ll - 8), 2) : 0;
    const belowULine = validNums && pi <= Math.max(0, uLineMax + 0.05);

    const status: CheckStatus = !validNums || !plLeLl ? 'fail' : !belowULine ? 'warn' : 'pass';
    checks.push({
      id: 'atterberg_valid',
      category: 'atterberg',
      titleTh: 'ความถูกต้อง LL, PL และ U-Line',
      titleEn: 'LL, PL & U-Line Bound',
      status,
      measuredText: validNums ? `PI = ${pi.toFixed(1)}%` : 'ไม่ครบ',
      criterionText: validNums ? `PL ≤ LL, PI ≤ ${Math.max(0, uLineMax).toFixed(1)}` : 'Valid LL/PL',
      detailTh: !validNums
        ? 'ข้อมูล LL หรือ PL ยังไม่ครบ'
        : !plLeLl
          ? 'ค่า PL มากกว่า LL (PI < 0) ไม่ถูกต้อง'
          : !belowULine
            ? `ค่า PI เกินเส้น U-Line (${uLineMax.toFixed(1)}) ควรทวนสอบ`
            : `LL=${ll.toFixed(1)}%, PL=${pl.toFixed(1)}% อยู่ใต้เส้น U-Line`,
      detailEn: !validNums
        ? 'Missing LL or PL.'
        : !plLeLl
          ? 'PL exceeds LL.'
          : !belowULine
            ? `PI above U-Line (${uLineMax.toFixed(1)}).`
            : `LL=${ll.toFixed(1)}%, PL=${pl.toFixed(1)}% below U-Line`,
    });

    if (input.atterbergMode === 'raw_cans') {
      const r2 = atterberg.flowCurveR2;
      const r2Status: CheckStatus =
        atterberg.flowCurveMethod === 'regression'
          ? (r2 ?? 0) >= 0.9
            ? 'pass'
            : 'warn'
          : atterberg.flowCurveMethod === 'one_point'
            ? 'warn'
            : 'fail';

      checks.push({
        id: 'flow_curve',
        category: 'atterberg',
        titleTh: 'ความแม่นยำ Flow Curve',
        titleEn: 'Flow Curve R²',
        status: r2Status,
        measuredText:
          atterberg.flowCurveMethod === 'regression'
            ? `R² = ${(r2 ?? 0).toFixed(3)}`
            : atterberg.flowCurveMethod === 'one_point'
              ? '1-Point'
              : 'ไม่พอ',
        criterionText: 'R² ≥ 0.90',
        detailTh:
          atterberg.flowCurveMethod === 'regression'
            ? `คำนวณ LL₂₅ จากเส้นตรงถดถอย (R² = ${(r2 ?? 0).toFixed(3)})`
            : atterberg.flowCurveMethod === 'one_point'
              ? 'มี 1 จุด ใช้สูตรประมาณค่า 1-Point'
              : 'ต้องมีข้อมูล LL อย่างน้อย 2 จุด',
        detailEn:
          atterberg.flowCurveMethod === 'regression'
            ? `Semi-log regression (R² = ${(r2 ?? 0).toFixed(3)})`
            : atterberg.flowCurveMethod === 'one_point'
              ? '1-Point approximation used'
              : 'Need ≥ 2 LL trials',
      });
    }
  }

  // Check 4: Boundary Proximity / Cross-System Consistency
  const nearBoundaries: string[] = [];
  if (Math.abs(p200 - 50) <= 1.5) nearBoundaries.push(`P₂₀₀≈50%`);
  if (Math.abs(p200 - 35) <= 1.5) nearBoundaries.push(`P₂₀₀≈35%`);
  if (!atterberg.isNonPlastic && atterberg.ll !== null && atterberg.pi !== null) {
    if (Math.abs(atterberg.ll - 50) <= 1.5) nearBoundaries.push(`LL≈50`);
    if (Math.abs(atterberg.ll - 40) <= 1.5) nearBoundaries.push(`LL≈40`);
    const aPI = 0.73 * (atterberg.ll - 20);
    if (atterberg.ll >= 20 && Math.abs(atterberg.pi - aPI) <= 1.0) {
      nearBoundaries.push(`ใกล้เส้น A-Line`);
    }
  }

  checks.push({
    id: 'cross_check',
    category: 'consistency',
    titleTh: 'ความสอดคล้อง USCS ↔ AASHTO',
    titleEn: 'Cross-System Check',
    status: nearBoundaries.length > 0 ? 'warn' : 'pass',
    measuredText: `${uscs.symbol} · ${aashto.fullNotation}`,
    criterionText: 'สอดคล้องกัน',
    detailTh:
      nearBoundaries.length > 0
        ? `ผลสอดคล้องกัน (ค่าใกล้เส้นแบ่ง: ${nearBoundaries.join(', ')})`
        : `ผลทั้ง 2 ระบบสอดคล้องกันชัดเจน`,
    detailEn:
      nearBoundaries.length > 0
        ? `Consistent (near boundary: ${nearBoundaries.join(', ')})`
        : `USCS and AASHTO results are consistent`,
  });

  const overallStatus: CheckStatus = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'pass';

  return {
    sieveRows,
    totalMassInputG,
    sumRetainedPlusPanG: roundTo(sumRetainedG, 2),
    panComputedG: roundTo(panComputedG, 2),
    massLossG,
    massLossPct,
    cobblesPct,
    gravelPct,
    sandPct,
    finesPct,
    p4: roundTo(p4, 2),
    p10: roundTo(p10, 2),
    p40: roundTo(p40, 2),
    p200: roundTo(p200, 2),
    d10,
    d30,
    d60,
    cu,
    cc,
    curvePoints,
    atterberg,
    uscs,
    aashto,
    checks,
    overallStatus,
  };
}
