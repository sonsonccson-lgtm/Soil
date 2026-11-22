import React, { useRef, useState } from 'react';
import { AtterbergComputed, Language } from '../types/geotech';

interface PlasticityChartProps {
  atterberg: AtterbergComputed;
  aashtoGroup: string;
  uscsFinesZone: string;
  lang: Language;
}

export const PlasticityChart: React.FC<PlasticityChartProps> = ({
  atterberg,
  uscsFinesZone,
  lang,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [showAASHTOOverlay, setShowAASHTOOverlay] = useState(false);
  const [hoverCoord, setHoverCoord] = useState<{ ll: number; pi: number } | null>(null);

  const llVal = atterberg.ll ?? 0;
  const piVal = atterberg.pi ?? 0;

  const maxLL = Math.max(100, Math.ceil((llVal + 10) / 10) * 10);
  const maxPI = Math.max(70, Math.ceil((piVal + 10) / 10) * 10);

  const width = 620;
  const height = 340;
  const pad = { top: 20, right: 20, bottom: 44, left: 50 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xFromLL = (ll: number) => pad.left + (Math.max(0, Math.min(maxLL, ll)) / maxLL) * plotW;
  const yFromPI = (pi: number) => pad.top + ((maxPI - Math.max(0, Math.min(maxPI, pi))) / maxPI) * plotH;

  const aLineStartLL = 20;
  const aLineEndLL = Math.min(maxLL, 20 + maxPI / 0.73);
  const aLineEndPI = 0.73 * (aLineEndLL - 20);

  const uLineStartLL = 8;
  const uLineEndLL = Math.min(maxLL, 8 + maxPI / 0.9);
  const uLineEndPI = 0.9 * (uLineEndLL - 8);

  const clmlPoly = [
    [xFromLL(12.444), yFromPI(4)],
    [xFromLL(25.479), yFromPI(4)],
    [xFromLL(29.589), yFromPI(7)],
    [xFromLL(15.778), yFromPI(7)],
  ]
    .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');

  const aLineSplitLL = 25.479;
  const aLineSplitPI = 4;

  const aashtoDiagEndLL = Math.min(maxLL, 30 + maxPI);
  const aashtoDiagEndPI = aashtoDiagEndLL - 30;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    if (svgX < pad.left || svgX > width - pad.right || svgY < pad.top || svgY > height - pad.bottom) {
      setHoverCoord(null);
      return;
    }

    const ll = ((svgX - pad.left) / plotW) * maxLL;
    const pi = ((pad.top + plotH - svgY) / plotH) * maxPI;
    setHoverCoord({ ll, pi });
  };

  const hasValidPoint = !atterberg.isNonPlastic && atterberg.ll !== null && atterberg.pi !== null;
  const pointInBounds = hasValidPoint && llVal >= 0 && piVal >= 0;
  const aLineAtSample = llVal >= 20 ? 0.73 * (llVal - 20) : 0;
  const uLineAtSample = llVal >= 8 ? 0.9 * (llVal - 8) : 0;
  const aboveULine = hasValidPoint && piVal > uLineAtSample + 0.05;

  const llTicks = [];
  for (let v = 0; v <= maxLL; v += 10) llTicks.push(v);
  const piTicks = [];
  for (let v = 0; v <= maxPI; v += 10) piTicks.push(v);

  return (
    <section className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#231912]">
          {lang === 'th'
            ? 'แผนภูมิความยืดหยุ่น (Plasticity Chart)'
            : 'Casagrande Plasticity Chart (LL vs. PI)'}
        </h3>

        <button
          type="button"
          onClick={() => setShowAASHTOOverlay((v) => !v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            showAASHTOOverlay
              ? 'bg-[#f4e8dc] text-[#8c421b] border-[#d9bca2]'
              : 'bg-[#f7f3ec] text-[#5e4e41] border-[#ddd3c3] hover:bg-[#efe8dc]'
          }`}
        >
          {showAASHTOOverlay
            ? lang === 'th'
              ? 'ซ่อนเส้นแบ่ง AASHTO'
              : 'Hide AASHTO Zones'
            : lang === 'th'
              ? 'แสดงเส้นแบ่ง AASHTO'
              : 'Show AASHTO Zones'}
        </button>
      </div>

      <div className="relative w-full overflow-hidden rounded border border-[#ddd3c3] bg-[#fffdf9]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoord(null)}
        >
          <defs>
            <pattern id="clmlHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#b5a38d" strokeWidth="1" />
            </pattern>
            <clipPath id="plasticityPlotClip">
              <rect x={pad.left} y={pad.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Gridlines */}
          {llTicks.map((v) => {
            const x = xFromLL(v);
            return (
              <g key={`ll-${v}`}>
                <line
                  x1={x}
                  y1={pad.top}
                  x2={x}
                  y2={height - pad.bottom}
                  stroke={v === 50 ? '#b5a38d' : '#efe8dc'}
                  strokeWidth={v === 50 ? '1.3' : '1'}
                />
                <text
                  x={x}
                  y={height - pad.bottom + 16}
                  textAnchor="middle"
                  className="fill-[#5e4e41] font-mono text-[10px]"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {piTicks.map((v) => {
            const y = yFromPI(v);
            return (
              <g key={`pi-${v}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#efe8dc"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#5e4e41] font-mono text-[10px]"
                >
                  {v}
                </text>
              </g>
            );
          })}

          <g clipPath="url(#plasticityPlotClip)">
            {/* CL-ML Hatched Zone */}
            <polygon points={clmlPoly} fill="url(#clmlHatch)" stroke="#8c7a66" strokeWidth="1" />

            {/* U-Line */}
            <line
              x1={xFromLL(uLineStartLL)}
              y1={yFromPI(0)}
              x2={xFromLL(uLineEndLL)}
              y2={yFromPI(uLineEndPI)}
              stroke="#8c7a66"
              strokeWidth="1.3"
              strokeDasharray="5 4"
            />

            {/* A-Line lower dashed tail */}
            <line
              x1={xFromLL(aLineStartLL)}
              y1={yFromPI(0)}
              x2={xFromLL(aLineSplitLL)}
              y2={yFromPI(aLineSplitPI)}
              stroke="#5e4e41"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />

            {/* A-Line solid main segment */}
            <line
              x1={xFromLL(aLineSplitLL)}
              y1={yFromPI(aLineSplitPI)}
              x2={xFromLL(aLineEndLL)}
              y2={yFromPI(aLineEndPI)}
              stroke="#2c221b"
              strokeWidth="2"
            />

            {/* LL = 50 boundary */}
            <line
              x1={xFromLL(50)}
              y1={pad.top}
              x2={xFromLL(50)}
              y2={height - pad.bottom}
              stroke="#5e4e41"
              strokeWidth="1.4"
            />

            {/* Optional AASHTO Sub-Zone Overlay */}
            {showAASHTOOverlay && (
              <g>
                <line
                  x1={xFromLL(40)}
                  y1={pad.top}
                  x2={xFromLL(40)}
                  y2={height - pad.bottom}
                  stroke="#b45309"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <line
                  x1={pad.left}
                  y1={yFromPI(10)}
                  x2={width - pad.right}
                  y2={yFromPI(10)}
                  stroke="#b45309"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <line
                  x1={xFromLL(40)}
                  y1={yFromPI(10)}
                  x2={xFromLL(aashtoDiagEndLL)}
                  y2={yFromPI(aashtoDiagEndPI)}
                  stroke="#9a4d22"
                  strokeWidth="1.4"
                  strokeDasharray="6 3"
                />
                <text x={xFromLL(22)} y={yFromPI(5)} className="fill-[#9a4d22] font-mono text-[10px] font-semibold">
                  A-4 / A-2-4
                </text>
                <text x={xFromLL(58)} y={yFromPI(5)} className="fill-[#9a4d22] font-mono text-[10px] font-semibold">
                  A-5 / A-2-5
                </text>
                <text x={xFromLL(26)} y={yFromPI(21)} className="fill-[#9a4d22] font-mono text-[10px] font-semibold">
                  A-6 / A-2-6
                </text>
                <text x={xFromLL(68)} y={yFromPI(24)} className="fill-[#9a4d22] font-mono text-[10px] font-semibold">
                  A-7-5
                </text>
                <text x={xFromLL(55)} y={yFromPI(42)} className="fill-[#9a4d22] font-mono text-[10px] font-semibold">
                  A-7-6
                </text>
              </g>
            )}

            {/* USCS Zone Labels */}
            <text x={xFromLL(35)} y={yFromPI(22)} textAnchor="middle" className="fill-[#47382c] text-[13px] font-bold">
              CL
            </text>
            <text x={xFromLL(38)} y={yFromPI(7)} textAnchor="middle" className="fill-[#6b5a4b] text-[12px] font-semibold">
              ML (or OL)
            </text>
            <text x={xFromLL(21)} y={yFromPI(5.5)} textAnchor="middle" className="fill-[#2c221b] text-[9px] font-bold">
              CL-ML
            </text>
            <text x={xFromLL(70)} y={yFromPI(46)} textAnchor="middle" className="fill-[#47382c] text-[14px] font-bold">
              CH
            </text>
            <text x={xFromLL(76)} y={yFromPI(18)} textAnchor="middle" className="fill-[#6b5a4b] text-[13px] font-semibold">
              MH (or OH)
            </text>

            {/* Line Annotations */}
            <text
              x={xFromLL(Math.min(maxLL - 12, 74))}
              y={yFromPI(0.73 * (Math.min(maxLL - 12, 74) - 20)) - 8}
              className="fill-[#2c221b] font-mono text-[9px] font-semibold"
            >
              A-Line: PI = 0.73(LL−20)
            </text>
            <text
              x={xFromLL(Math.min(maxLL - 18, 42))}
              y={yFromPI(0.9 * (Math.min(maxLL - 18, 42) - 8)) - 8}
              className="fill-[#786555] font-mono text-[9px]"
            >
              U-Line: PI = 0.9(LL−8)
            </text>

            {/* Plotted Sample Point (LL, PI) */}
            {pointInBounds && (
              <g>
                <line
                  x1={xFromLL(llVal)}
                  y1={yFromPI(piVal)}
                  x2={xFromLL(llVal)}
                  y2={height - pad.bottom}
                  stroke={aboveULine ? '#b91c1c' : '#9a4d22'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <line
                  x1={pad.left}
                  y1={yFromPI(piVal)}
                  x2={xFromLL(llVal)}
                  y2={yFromPI(piVal)}
                  stroke={aboveULine ? '#b91c1c' : '#9a4d22'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xFromLL(llVal)}
                  cy={yFromPI(piVal)}
                  r="9"
                  fill={aboveULine ? '#b91c1c' : '#9a4d22'}
                  fillOpacity="0.16"
                  stroke={aboveULine ? '#b91c1c' : '#9a4d22'}
                  strokeWidth="1.4"
                />
                <circle
                  cx={xFromLL(llVal)}
                  cy={yFromPI(piVal)}
                  r="4.2"
                  fill={aboveULine ? '#b91c1c' : '#9a4d22'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <g
                  transform={`translate(${
                    xFromLL(llVal) > width - 155 ? xFromLL(llVal) - 118 : xFromLL(llVal) + 12
                  }, ${Math.max(pad.top + 8, yFromPI(piVal) - 22)})`}
                >
                  <rect width="108" height="24" rx="3" fill="#2c221b" fillOpacity="0.94" />
                  <text x="54" y="15.5" textAnchor="middle" className="fill-[#fcfbf8] font-mono text-[10px] font-medium">
                    ({llVal.toFixed(1)}, {piVal.toFixed(1)})
                  </text>
                </g>
              </g>
            )}
          </g>

          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="none"
            stroke="#a99781"
            strokeWidth="1"
          />

          <text
            x={pad.left + plotW / 2}
            y={height - 10}
            textAnchor="middle"
            className="fill-[#47382c] text-[11px] font-medium"
          >
            {lang === 'th' ? 'ขีดจำกัดเหลว, Liquid Limit (LL, %)' : 'Liquid Limit, LL (%)'}
          </text>
          <text
            x={16}
            y={pad.top + plotH / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${pad.top + plotH / 2})`}
            className="fill-[#47382c] text-[11px] font-medium"
          >
            {lang === 'th' ? 'ดัชนีความยืดหยุ่น, Plasticity Index (PI, %)' : 'Plasticity Index, PI (%)'}
          </text>
        </svg>

        {atterberg.isNonPlastic && (
          <div className="absolute bottom-14 left-16 bg-[#2c221b]/95 text-[#fcfbf8] px-3 py-1.5 rounded text-xs font-mono">
            Non-Plastic (NP) · PI = 0 ({lang === 'th' ? 'ไม่มีจุดพล็อตบน Plasticity Chart' : 'No Plasticity Plot Point'})
          </div>
        )}

        {hoverCoord && (
          <div className="absolute top-3 right-3 bg-[#2c221b]/95 text-[#fcfbf8] px-2.5 py-1.5 rounded text-[11px] font-mono pointer-events-none">
            LL = {hoverCoord.ll.toFixed(1)} · PI = {hoverCoord.pi.toFixed(1)}
          </div>
        )}
      </div>

      {/* Plasticity Parameters Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-[#efe8dc]">
        <div>
          <div className="text-[11px] text-[#786555]">Liquid Limit (LL)</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {atterberg.isNonPlastic ? 'NP' : atterberg.ll !== null ? `${atterberg.ll.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">Plastic Limit (PL)</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {atterberg.isNonPlastic ? 'NP' : atterberg.pl !== null ? `${atterberg.pl.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">Plasticity Index (PI)</div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {atterberg.isNonPlastic ? '0 (NP)' : atterberg.pi !== null ? `${atterberg.pi.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#786555]">
            {lang === 'th' ? 'ตำแหน่งเทียบ A-Line' : 'A-Line Position'}
          </div>
          <div className="text-sm font-mono font-semibold text-[#2c221b] mt-0.5">
            {atterberg.isNonPlastic
              ? 'NP (ML)'
              : `${uscsFinesZone} (${piVal >= aLineAtSample ? '≥ A-Line' : '< A-Line'})`}
          </div>
        </div>
      </div>
    </section>
  );
};
