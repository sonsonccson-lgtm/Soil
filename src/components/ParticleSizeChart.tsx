import React, { useMemo, useRef, useState } from 'react';
import { GSDCurvePoint, Language } from '../types/geotech';

interface ParticleSizeChartProps {
  curvePoints: GSDCurvePoint[];
  d10: number | null;
  d30: number | null;
  d60: number | null;
  cu: number | null;
  cc: number | null;
  lang: Language;
}

const LOG_MIN = Math.log10(0.001);
const LOG_MAX = Math.log10(100);

const MAJOR_TICKS = [100, 10, 1, 0.1, 0.01, 0.001];
const MINOR_TICKS = [
  90, 80, 70, 60, 50, 40, 30, 20,
  9, 8, 7, 6, 5, 4, 3, 2,
  0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2,
  0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02,
  0.009, 0.008, 0.007, 0.006, 0.005, 0.004, 0.003, 0.002,
];

const KEY_SIEVES = [
  { label: '3"', mm: 75 },
  { label: '#4', mm: 4.75 },
  { label: '#10', mm: 2.0 },
  { label: '#40', mm: 0.425 },
  { label: '#200', mm: 0.075 },
];

export const ParticleSizeChart: React.FC<ParticleSizeChartProps> = ({
  curvePoints,
  d10,
  d30,
  d60,
  cu,
  cc,
  lang,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [showDMarkers, setShowDMarkers] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    dMm: number;
    pct: number;
  } | null>(null);

  const width = 720;
  const height = 340;
  const pad = { top: 40, right: 20, bottom: 44, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xFromMm = (mm: number) => {
    const clamped = Math.max(0.001, Math.min(100, mm));
    const logVal = Math.log10(clamped);
    const ratio = (LOG_MAX - logVal) / (LOG_MAX - LOG_MIN);
    return pad.left + ratio * plotW;
  };

  const mmFromX = (x: number) => {
    const ratio = Math.max(0, Math.min(1, (x - pad.left) / plotW));
    const logVal = LOG_MAX - ratio * (LOG_MAX - LOG_MIN);
    return Math.pow(10, logVal);
  };

  const yFromPct = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return pad.top + ((100 - clamped) / 100) * plotH;
  };

  const validPoints = useMemo(() => {
    return curvePoints.filter((p) => p.diameterMm > 0);
  }, [curvePoints]);

  const pathD = useMemo(() => {
    if (validPoints.length === 0) return '';
    return validPoints
      .map((pt, idx) => {
        const x = xFromMm(pt.diameterMm);
        const y = yFromPct(pt.percentPassing);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [validPoints]);

  const areaD = useMemo(() => {
    if (validPoints.length < 2) return '';
    const first = validPoints[0];
    const last = validPoints[validPoints.length - 1];
    const baseY = yFromPct(0);
    return `${pathD} L ${xFromMm(last.diameterMm).toFixed(2)} ${baseY.toFixed(2)} L ${xFromMm(first.diameterMm).toFixed(2)} ${baseY.toFixed(2)} Z`;
  }, [pathD, validPoints]);

  const interpolatePctAtMm = (targetMm: number): number | null => {
    if (validPoints.length === 0) return null;
    if (targetMm >= validPoints[0].diameterMm) return validPoints[0].percentPassing;
    if (targetMm <= validPoints[validPoints.length - 1].diameterMm)
      return validPoints[validPoints.length - 1].percentPassing;

    for (let i = 0; i < validPoints.length - 1; i++) {
      const p1 = validPoints[i];
      const p2 = validPoints[i + 1];
      if (p1.diameterMm >= targetMm && p2.diameterMm <= targetMm) {
        const log1 = Math.log10(p1.diameterMm);
        const log2 = Math.log10(p2.diameterMm);
        const logT = Math.log10(targetMm);
        const t = (logT - log2) / (log1 - log2);
        return p2.percentPassing + t * (p1.percentPassing - p2.percentPassing);
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    if (svgX < pad.left || svgX > width - pad.right || svgY < pad.top || svgY > height - pad.bottom) {
      setHoverInfo(null);
      return;
    }

    const dMm = mmFromX(svgX);
    const pct = interpolatePctAtMm(dMm);
    if (pct !== null) {
      setHoverInfo({
        x: svgX,
        y: yFromPct(pct),
        dMm,
        pct,
      });
    } else {
      setHoverInfo(null);
    }
  };

  const zoneBands = [
    { label: lang === 'th' ? 'หินใหญ่' : 'Cobbles', maxMm: 100, minMm: 75, fill: '#f3ede3' },
    { label: lang === 'th' ? 'กรวด (Gravel)' : 'Gravel', maxMm: 75, minMm: 4.75, fill: '#faf6ef' },
    { label: lang === 'th' ? 'ทราย (Sand)' : 'Sand', maxMm: 4.75, minMm: 0.075, fill: '#fffdf9' },
    { label: lang === 'th' ? 'ดินละเอียด (Silt & Clay)' : 'Silt & Clay', maxMm: 0.075, minMm: 0.001, fill: '#faf6ef' },
  ];

  const dMarkers = [
    { label: 'D₆₀', val: d60, pct: 60 },
    { label: 'D₃₀', val: d30, pct: 30 },
    { label: 'D₁₀', val: d10, pct: 10 },
  ].filter((m) => m.val !== null && m.val > 0) as { label: string; val: number; pct: number }[];

  return (
    <section className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#231912]">
          {lang === 'th'
            ? 'กราฟการกระจายขนาดเม็ดดิน (GSD Curve)'
            : 'Particle Size Distribution Curve'}
        </h3>

        <button
          type="button"
          onClick={() => setShowDMarkers((v) => !v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            showDMarkers
              ? 'bg-[#f4e8dc] text-[#8c421b] border-[#d9bca2]'
              : 'bg-[#f7f3ec] text-[#5e4e41] border-[#ddd3c3] hover:bg-[#efe8dc]'
          }`}
        >
          {showDMarkers
            ? lang === 'th'
              ? 'ซ่อนเส้น D₁₀ / D₃₀ / D₆₀'
              : 'Hide D₁₀ / D₃₀ / D₆₀'
            : lang === 'th'
              ? 'แสดงเส้น D₁₀ / D₃₀ / D₆₀'
              : 'Show D₁₀ / D₃₀ / D₆₀'}
        </button>
      </div>

      {/* SVG Plot */}
      <div className="relative w-full overflow-hidden rounded border border-[#ddd3c3] bg-[#fffdf9]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
        >
          <defs>
            <linearGradient id="gsdAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9a4d22" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#9a4d22" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Soil Fraction Zone Bands */}
          {zoneBands.map((z) => {
            const x1 = xFromMm(z.maxMm);
            const x2 = xFromMm(z.minMm);
            return (
              <g key={z.label}>
                <rect x={x1} y={pad.top} width={x2 - x1} height={plotH} fill={z.fill} />
                <rect
                  x={x1}
                  y={pad.top - 22}
                  width={x2 - x1}
                  height={22}
                  fill="#efe8dc"
                  stroke="#cbbba3"
                  strokeWidth="0.8"
                />
                {x2 - x1 > 42 && (
                  <text
                    x={(x1 + x2) / 2}
                    y={pad.top - 8}
                    textAnchor="middle"
                    className="fill-[#5e4e41] text-[10px] font-medium"
                  >
                    {z.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Minor Log Gridlines */}
          {MINOR_TICKS.map((t) => {
            const x = xFromMm(t);
            return (
              <line
                key={`minor-${t}`}
                x1={x}
                y1={pad.top}
                x2={x}
                y2={height - pad.bottom}
                stroke="#f0e9de"
                strokeWidth="1"
              />
            );
          })}

          {/* Major Log Gridlines & X-Axis Labels */}
          {MAJOR_TICKS.map((t) => {
            const x = xFromMm(t);
            return (
              <g key={`major-${t}`}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={height - pad.bottom}
                  stroke="#d5c9b6"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - pad.bottom + 16}
                  textAnchor="middle"
                  className="fill-[#5e4e41] font-mono text-[10px]"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Horizontal Percent Finer Gridlines */}
          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pct) => {
            const y = yFromPct(pct);
            const isMajor = pct % 20 === 0 || pct === 50;
            return (
              <g key={`y-${pct}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke={pct === 50 ? '#c4b49c' : isMajor ? '#e5dccd' : '#f0e9de'}
                  strokeDasharray={pct === 50 ? '4 3' : undefined}
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#6b5a4b] font-mono text-[10px]"
                >
                  {pct}
                </text>
              </g>
            );
          })}

          {/* Key Sieve Reference Lines (#4, #10, #40, #200) */}
          {KEY_SIEVES.map((s) => {
            const x = xFromMm(s.mm);
            return (
              <g key={s.label}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={height - pad.bottom}
                  stroke="#a99781"
                  strokeWidth="0.9"
                  strokeDasharray="3 3"
                />
                <text
                  x={x}
                  y={pad.top + 12}
                  textAnchor="middle"
                  className="fill-[#6b5a4b] font-mono text-[9px] font-semibold"
                >
                  {s.label}
                </text>
              </g>
            );
          })}

          {/* Plot Border */}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="#a99781"
            strokeWidth="1"
          />

          {/* D10, D30, D60 Drop-lines */}
          {showDMarkers &&
            dMarkers.map((m) => {
              const x = xFromMm(m.val);
              const y = yFromPct(m.pct);
              const baseY = yFromPct(0);
              return (
                <g key={m.label}>
                  <line
                    x1={pad.left}
                    y1={y}
                    x2={x}
                    y2={y}
                    stroke="#b45309"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={x}
                    y1={y}
                    x2={x}
                    y2={baseY}
                    stroke="#b45309"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <circle cx={x} cy={y} r="3.5" fill="#b45309" />
                  <rect
                    x={x - 16}
                    y={baseY - 18}
                    width="32"
                    height="14"
                    rx="2"
                    fill="#fef3c7"
                    stroke="#d97706"
                    strokeWidth="0.8"
                  />
                  <text
                    x={x}
                    y={baseY - 8}
                    textAnchor="middle"
                    className="fill-[#78350f] font-mono text-[9px] font-semibold"
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}

          {/* Subtle Area Fill & Primary GSD Curve */}
          {areaD && <path d={areaD} fill="url(#gsdAreaGrad)" />}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#9a4d22"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Data Points */}
          {validPoints.map((pt, i) => {
            const x = xFromMm(pt.diameterMm);
            const y = yFromPct(pt.percentPassing);
            if (pt.source === 'hydrometer') {
              return (
                <polygon
                  key={`pt-${i}`}
                  points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`}
                  fill="#fffdf9"
                  stroke="#b45309"
                  strokeWidth="1.8"
                />
              );
            }
            return (
              <circle
                key={`pt-${i}`}
                cx={x}
                cy={y}
                r="3.2"
                fill="#fffdf9"
                stroke="#9a4d22"
                strokeWidth="2"
              />
            );
          })}

          {/* Axis Titles */}
          <text
            x={pad.left + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-[#47382c] text-[11px] font-medium"
          >
            {lang === 'th' ? 'ขนาดเม็ดดิน, D (มม.) — สเกลลอการิทึม' : 'Particle Diameter, D (mm) — Log Scale'}
          </text>
          <text
            x={16}
            y={pad.top + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${pad.top + plotH / 2})`}
            className="fill-[#47382c] text-[11px] font-medium"
          >
            {lang === 'th' ? 'เปอร์เซ็นต์ผ่านตะแกรง (% Finer)' : 'Percent Passing (% Finer)'}
          </text>

          {/* Interactive Crosshair Probe */}
          {hoverInfo && (
            <g pointerEvents="none">
              <line
                x1={hoverInfo.x}
                y1={pad.top}
                x2={hoverInfo.x}
                y2={height - pad.bottom}
                stroke="#5e4e41"
                strokeWidth="0.9"
                strokeDasharray="2 2"
              />
              <line
                x1={pad.left}
                y1={hoverInfo.y}
                x2={width - pad.right}
                y2={hoverInfo.y}
                stroke="#5e4e41"
                strokeWidth="0.9"
                strokeDasharray="2 2"
              />
              <circle cx={hoverInfo.x} cy={hoverInfo.y} r="4.5" fill="#8c421b" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          )}
        </svg>

        {/* Live Crosshair HUD */}
        {hoverInfo && (
          <div className="absolute top-3 right-3 bg-[#2c221b]/95 text-[#fcfbf8] px-2.5 py-1.5 rounded text-[11px] font-mono pointer-events-none">
            D = {hoverInfo.dMm >= 1 ? hoverInfo.dMm.toFixed(2) : hoverInfo.dMm.toFixed(3)} mm · Passing ={' '}
            {hoverInfo.pct.toFixed(1)}%
          </div>
        )}
      </div>

      {/* Gradation Coefficients Readout Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 border-t border-[#efe8dc]">
        <div>
          <div className="text-[11px] text-[#786555]">D₁₀ (Effective Size)</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {d10 !== null ? `${d10 < 0.01 ? d10.toFixed(4) : d10.toFixed(3)} mm` : 'N/A (<0.075)'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">D₃₀</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {d30 !== null ? `${d30 < 0.01 ? d30.toFixed(4) : d30.toFixed(3)} mm` : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">D₆₀</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {d60 !== null ? `${d60 < 0.01 ? d60.toFixed(4) : d60.toFixed(3)} mm` : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">Cu (D₆₀/D₁₀)</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {cu !== null ? cu.toFixed(2) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">Cc (D₃₀²/D₁₀D₆₀)</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {cc !== null ? cc.toFixed(2) : 'N/A'}
          </div>
        </div>
      </div>
    </section>
  );
};
