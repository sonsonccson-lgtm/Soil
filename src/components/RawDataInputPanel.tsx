import React from 'react';
import { AlertTriangle, ArrowDown, ArrowRight, Plus, Trash2 } from 'lucide-react';
import {
  AtterbergInputMode,
  Language,
  SieveInputMode,
  SoilAnalysisOutput,
  SoilSampleInput,
} from '../types/geotech';
import { PRESET_SAMPLES } from '../utils/presets';

interface RawDataInputPanelProps {
  input: SoilSampleInput;
  output: SoilAnalysisOutput;
  selectedPresetKey: string;
  onSelectPreset: (key: string) => void;
  onChange: (next: SoilSampleInput) => void;
  onSubmit: () => void;
  hasSubmitted: boolean;
  submitError: string | null;
  lang: Language;
}

export const RawDataInputPanel: React.FC<RawDataInputPanelProps> = ({
  input,
  output,
  selectedPresetKey,
  onSelectPreset,
  onChange,
  onSubmit,
  hasSubmitted,
  submitError,
  lang,
}) => {
  const updateField = <K extends keyof SoilSampleInput>(key: K, value: SoilSampleInput[K]) => {
    onChange({ ...input, [key]: value });
  };

  const updateSieve = (
    idx: number,
    field: 'emptySieveG' | 'sievePlusSoilG' | 'massRetainedG' | 'directPercentPassing',
    val: number,
  ) => {
    const nextSieves = input.sieves.map((s, i) => (i === idx ? { ...s, [field]: val } : s));
    onChange({ ...input, sieves: nextSieves });
  };

  const updateLLTrial = (
    idx: number,
    field: 'blows' | 'canLabel' | 'emptyCanG' | 'wetSoilCanG' | 'drySoilCanG',
    val: number | string,
  ) => {
    const next = input.llTrials.map((t, i) => (i === idx ? { ...t, [field]: val } : t));
    onChange({ ...input, llTrials: next });
  };

  const addLLTrial = () => {
    const idx = input.llTrials.length + 1;
    onChange({
      ...input,
      llTrials: [
        ...input.llTrials,
        {
          id: `ll-${Date.now()}`,
          blows: 20,
          canLabel: `L-${idx}`,
          emptyCanG: 15.0,
          wetSoilCanG: 35.0,
          drySoilCanG: 30.0,
        },
      ],
    });
  };

  const removeLLTrial = (idx: number) => {
    if (input.llTrials.length <= 1) return;
    onChange({
      ...input,
      llTrials: input.llTrials.filter((_, i) => i !== idx),
    });
  };

  const updatePLTrial = (
    idx: number,
    field: 'canLabel' | 'emptyCanG' | 'wetSoilCanG' | 'drySoilCanG',
    val: number | string,
  ) => {
    const next = input.plTrials.map((t, i) => (i === idx ? { ...t, [field]: val } : t));
    onChange({ ...input, plTrials: next });
  };

  const addPLTrial = () => {
    const idx = input.plTrials.length + 1;
    onChange({
      ...input,
      plTrials: [
        ...input.plTrials,
        {
          id: `pl-${Date.now()}`,
          canLabel: `P-${idx}`,
          emptyCanG: 14.0,
          wetSoilCanG: 26.0,
          drySoilCanG: 24.0,
        },
      ],
    });
  };

  const removePLTrial = (idx: number) => {
    if (input.plTrials.length <= 1) return;
    onChange({
      ...input,
      plTrials: input.plTrials.filter((_, i) => i !== idx),
    });
  };

  const updateHydrometerPoint = (idx: number, field: 'diameterMm' | 'percentFiner', val: number) => {
    const next = input.hydrometerPoints.map((h, i) => (i === idx ? { ...h, [field]: val } : h));
    onChange({ ...input, hydrometerPoints: next });
  };

  const addHydrometerPoint = () => {
    onChange({
      ...input,
      hydrometerPoints: [
        ...input.hydrometerPoints,
        { id: `h-${Date.now()}`, diameterMm: 0.005, percentFiner: 10 },
      ],
    });
  };

  const removeHydrometerPoint = (idx: number) => {
    onChange({
      ...input,
      hydrometerPoints: input.hydrometerPoints.filter((_, i) => i !== idx),
    });
  };

  const renderFlowCurveMini = () => {
    const valid = output.atterberg.llTrials.filter((t) => t.valid && t.waterContentPct !== null);
    if (valid.length === 0 || output.atterberg.isNonPlastic) return null;

    const w = 380;
    const h = 136;
    const pad = { top: 12, right: 14, bottom: 24, left: 36 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    const minLog = Math.log10(10);
    const maxLog = Math.log10(50);
    const xFromN = (n: number) => {
      const clamped = Math.max(10, Math.min(50, n));
      return pad.left + ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * pw;
    };

    const wcVals = valid.map((t) => t.waterContentPct as number);
    if (output.atterberg.ll !== null) wcVals.push(output.atterberg.ll);
    const minW = Math.floor(Math.min(...wcVals) - 2);
    const maxW = Math.ceil(Math.max(...wcVals) + 2);
    const rangeW = Math.max(4, maxW - minW);
    const yFromW = (val: number) => pad.top + ((maxW - val) / rangeW) * ph;

    const slope = output.atterberg.flowCurveSlope;
    const intercept = output.atterberg.flowCurveIntercept;

    return (
      <div className="mt-3 pt-3 border-t border-[#efe8dc]">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-[#231912]">Flow Curve (N = 25)</span>
          <span className="font-mono text-[#5e4e41]">
            {output.atterberg.ll !== null ? `LL = ${output.atterberg.ll.toFixed(1)}%` : '—'}
            {output.atterberg.flowCurveR2 !== null ? ` · R² ${output.atterberg.flowCurveR2.toFixed(2)}` : ''}
          </span>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto bg-[#f7f3ec] rounded border border-[#ddd3c3]">
          {[10, 15, 20, 25, 30, 40, 50].map((n) => (
            <g key={n}>
              <line
                x1={xFromN(n)}
                y1={pad.top}
                x2={xFromN(n)}
                y2={h - pad.bottom}
                stroke={n === 25 ? '#b45309' : '#e2d7c5'}
                strokeDasharray={n === 25 ? '3 2' : undefined}
                strokeWidth={n === 25 ? 1.3 : 1}
              />
              <text x={xFromN(n)} y={h - 8} textAnchor="middle" className="fill-[#6b5a4b] font-mono text-[9px]">
                {n}
              </text>
            </g>
          ))}
          <text x={pad.left - 5} y={pad.top + 8} textAnchor="end" className="fill-[#6b5a4b] font-mono text-[9px]">
            {maxW}%
          </text>
          <text x={pad.left - 5} y={h - pad.bottom} textAnchor="end" className="fill-[#6b5a4b] font-mono text-[9px]">
            {minW}%
          </text>
          {slope !== null && intercept !== null && (
            <line
              x1={xFromN(12)}
              y1={yFromW(slope * Math.log(12) + intercept)}
              x2={xFromN(45)}
              y2={yFromW(slope * Math.log(45) + intercept)}
              stroke="#9a4d22"
              strokeWidth="1.8"
            />
          )}
          {output.atterberg.ll !== null && (
            <circle
              cx={xFromN(25)}
              cy={yFromW(output.atterberg.ll)}
              r="4"
              fill="#b45309"
              stroke="#ffffff"
              strokeWidth="1.2"
            />
          )}
          {valid.map((t) => (
            <circle
              key={t.id}
              cx={xFromN(t.blows)}
              cy={yFromW(t.waterContentPct as number)}
              r="3.2"
              fill="#9a4d22"
              stroke="#ffffff"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <form
      id="input"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 sm:p-6 flex flex-col gap-6"
    >
      {/* 01. Sample Metadata + Preset Selector */}
      <div className="pb-5 border-b border-[#e5dccd]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-[#231912]">
            {lang === 'th' ? '01. ข้อมูลตัวอย่างดิน' : '01. Sample Details'}
          </h2>

          <select
            aria-label="Load lab preset"
            value={selectedPresetKey}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium bg-[#f3ede3] border border-[#cbbba3] rounded-md text-[#231912] focus:outline-none focus:border-[#9a4d22] cursor-pointer"
          >
            <option value="">
              {lang === 'th' ? '— เติมตัวอย่างข้อมูลทดลอง —' : '— Load sample preset —'}
            </option>
            {PRESET_SAMPLES.map((p) => (
              <option key={p.key} value={p.key}>
                {lang === 'th' ? p.nameTh : p.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#5e4e41] mb-1">
              {lang === 'th' ? 'รหัสตัวอย่าง' : 'Sample ID'}
            </label>
            <input
              type="text"
              value={input.sampleId}
              onChange={(e) => updateField('sampleId', e.target.value)}
              placeholder="BH-01 / S-01"
              className="w-full px-3 py-2 text-xs font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5e4e41] mb-1">
              {lang === 'th' ? 'สถานที่' : 'Location'}
            </label>
            <input
              type="text"
              value={input.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder={lang === 'th' ? 'ชื่อโครงการ / พื้นที่' : 'Project site'}
              className="w-full px-3 py-2 text-xs bg-[#fffdf9] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5e4e41] mb-1">
              {lang === 'th' ? 'ความลึก (ม.)' : 'Depth (m)'}
            </label>
            <input
              type="text"
              value={input.depthM}
              onChange={(e) => updateField('depthM', e.target.value)}
              placeholder="1.50 - 2.00"
              className="w-full px-3 py-2 text-xs font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5e4e41] mb-1">
              {lang === 'th' ? 'มวลแห้งเริ่มต้น (g)' : 'Dry Mass (g)'}
            </label>
            <input
              type="number"
              min={0}
              step="0.1"
              value={input.totalDryMassG}
              onChange={(e) => updateField('totalDryMassG', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
            />
          </div>
        </div>
      </div>

      {/* 2-Column Lab Data Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 02. Sieve Analysis */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#231912]">
              {lang === 'th' ? '02. การร่อนตะแกรง' : '02. Sieve Analysis'}
            </h2>
            <div className="flex items-center gap-1 bg-[#efe8dc] p-0.5 rounded">
              {(
                [
                  { id: 'mass_retained', th: 'มวลค้าง (g)', en: 'Retained (g)' },
                  { id: 'sieve_plus_soil', th: 'ตะแกรง+ดิน', en: 'Sieve+Soil' },
                  { id: 'percent_passing', th: '% ผ่าน', en: '% Passing' },
                ] as { id: SieveInputMode; th: string; en: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateField('sieveMode', m.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    input.sieveMode === m.id
                      ? 'bg-[#fcfbf8] text-[#8c421b] shadow-xs'
                      : 'text-[#5e4e41] hover:text-[#231912]'
                  }`}
                >
                  {lang === 'th' ? m.th : m.en}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[#ddd3c3] rounded overflow-hidden bg-[#fffdf9]">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#f3ede3] border-b border-[#ddd3c3] text-[11px] text-[#5e4e41]">
                  <th className="py-2 px-2.5 text-left font-semibold">
                    {lang === 'th' ? 'ตะแกรง' : 'Sieve'}
                  </th>
                  <th className="py-2 px-2 text-right font-semibold">mm</th>
                  {input.sieveMode === 'sieve_plus_soil' && (
                    <>
                      <th className="py-2 px-1.5 text-right font-semibold">
                        {lang === 'th' ? 'เปล่า(g)' : 'Empty'}
                      </th>
                      <th className="py-2 px-1.5 text-right font-semibold">
                        {lang === 'th' ? 'รวม(g)' : 'Total'}
                      </th>
                    </>
                  )}
                  {input.sieveMode === 'mass_retained' && (
                    <th className="py-2 px-2 text-right font-semibold">
                      {lang === 'th' ? 'มวลค้าง (g)' : 'Retained (g)'}
                    </th>
                  )}
                  {input.sieveMode === 'percent_passing' && (
                    <th className="py-2 px-2 text-right font-semibold">
                      {lang === 'th' ? '% ผ่าน' : '% Pass'}
                    </th>
                  )}
                  <th className="py-2 px-2.5 text-right font-semibold">
                    {lang === 'th' ? '% ผ่าน' : '% Pass'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efe8dc]">
                {output.sieveRows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-[#faf6ef]">
                    <td className="py-1.5 px-2.5 font-mono font-medium text-[#231912]">{row.label}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#786555]">{row.openingMm}</td>

                    {input.sieveMode === 'sieve_plus_soil' && (
                      <>
                        <td className="py-1 px-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={row.emptySieveG}
                            onChange={(e) =>
                              updateSieve(idx, 'emptySieveG', parseFloat(e.target.value) || 0)
                            }
                            className="w-18 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                          />
                        </td>
                        <td className="py-1 px-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={row.sievePlusSoilG}
                            onChange={(e) =>
                              updateSieve(idx, 'sievePlusSoilG', parseFloat(e.target.value) || 0)
                            }
                            className="w-18 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                          />
                        </td>
                      </>
                    )}

                    {input.sieveMode === 'mass_retained' && (
                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={row.massRetainedG}
                          onChange={(e) =>
                            updateSieve(idx, 'massRetainedG', parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                        />
                      </td>
                    )}

                    {input.sieveMode === 'percent_passing' && (
                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.1"
                          value={row.directPercentPassing}
                          onChange={(e) =>
                            updateSieve(idx, 'directPercentPassing', parseFloat(e.target.value) || 0)
                          }
                          className="w-24 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                        />
                      </td>
                    )}

                    <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-[#231912]">
                      {row.percentPassing.toFixed(1)}%
                    </td>
                  </tr>
                ))}

                {input.sieveMode !== 'percent_passing' && (
                  <tr className="bg-[#f7f3ec]">
                    <td className="py-1.5 px-2.5 font-mono font-medium text-[#47382c]">
                      {lang === 'th' ? 'ถาดรอง (Pan)' : 'Pan'}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[#8c7a66]">—</td>

                    {input.sieveMode === 'sieve_plus_soil' ? (
                      <>
                        <td className="py-1 px-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={input.panEmptyG}
                            onChange={(e) =>
                              updateField('panEmptyG', parseFloat(e.target.value) || 0)
                            }
                            className="w-18 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                          />
                        </td>
                        <td className="py-1 px-1.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={input.panPlusSoilG}
                            onChange={(e) =>
                              updateField('panPlusSoilG', parseFloat(e.target.value) || 0)
                            }
                            className="w-18 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                          />
                        </td>
                      </>
                    ) : (
                      <td className="py-1 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={input.panMassG}
                          onChange={(e) => updateField('panMassG', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-right font-mono text-xs bg-[#fcfbf8] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                        />
                      </td>
                    )}
                    <td className="py-1.5 px-2.5 text-right font-mono text-[#786555]">0.0%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {input.sieveMode !== 'percent_passing' && (
            <div className="flex items-center justify-between px-3 py-2 bg-[#f3ede3] border border-[#ddd3c3] rounded text-xs font-mono">
              <span className="text-[#5e4e41]">
                {lang === 'th' ? 'รวม:' : 'Sum:'}{' '}
                <strong className="text-[#231912]">{output.sumRetainedPlusPanG.toFixed(1)} g</strong>
              </span>
              <span
                className={
                  output.massLossPct <= 2
                    ? 'text-[#2f6b48] font-semibold'
                    : output.massLossPct <= 5
                      ? 'text-[#b45309] font-semibold'
                      : 'text-[#b91c1c] font-semibold'
                }
              >
                {lang === 'th' ? 'คลาดเคลื่อน' : 'Loss'}: {output.massLossPct.toFixed(2)}%
              </span>
            </div>
          )}

          {/* Hydrometer Toggle */}
          <div className="border-t border-[#efe8dc] pt-3">
            <label className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-xs font-medium text-[#47382c]">
                {lang === 'th' ? 'เพิ่มข้อมูล Hydrometer (< 0.075 mm)' : 'Hydrometer (< 0.075 mm)'}
              </span>
              <input
                type="checkbox"
                checked={input.useHydrometer}
                onChange={(e) => updateField('useHydrometer', e.target.checked)}
                className="w-4 h-4 accent-[#9a4d22] rounded cursor-pointer"
              />
            </label>

            {input.useHydrometer && (
              <div className="mt-2.5 flex flex-col gap-2">
                {input.hydrometerPoints.map((h, idx) => (
                  <div key={h.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#786555]">D(mm)</span>
                      <input
                        type="number"
                        step="0.001"
                        min={0.0005}
                        max={0.074}
                        value={h.diameterMm}
                        onChange={(e) =>
                          updateHydrometerPoint(idx, 'diameterMm', parseFloat(e.target.value) || 0.001)
                        }
                        className="w-full px-2 py-1 text-xs font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#786555]">%Pass</span>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        max={100}
                        value={h.percentFiner}
                        onChange={(e) =>
                          updateHydrometerPoint(idx, 'percentFiner', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 text-xs font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHydrometerPoint(idx)}
                      className="p-1 text-[#8c7a66] hover:text-[#b91c1c] cursor-pointer"
                      aria-label="Remove hydrometer row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHydrometerPoint}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#9a4d22] hover:text-[#7c3b18] cursor-pointer self-start"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === 'th' ? 'เพิ่มจุด' : 'Add Point'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 03. Atterberg Limits */}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-[#231912]">
              {lang === 'th' ? '03. ขีดจำกัด LL / PL' : '03. Atterberg Limits'}
            </h2>
            {!input.isNonPlastic && (
              <div className="flex items-center gap-1 bg-[#efe8dc] p-0.5 rounded">
                {(
                  [
                    { id: 'raw_cans', th: 'กระป๋องดิน', en: 'Moisture Cans' },
                    { id: 'direct', th: 'กรอกค่าตรง', en: 'Direct LL / PL' },
                  ] as { id: AtterbergInputMode; th: string; en: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateField('atterbergMode', m.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      input.atterbergMode === m.id
                        ? 'bg-[#fcfbf8] text-[#8c421b] shadow-xs'
                        : 'text-[#5e4e41] hover:text-[#231912]'
                    }`}
                  >
                    {lang === 'th' ? m.th : m.en}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center justify-between px-3 py-2.5 bg-[#f3ede3] border border-[#ddd3c3] rounded cursor-pointer select-none">
            <span className="text-xs font-semibold text-[#231912]">
              {lang === 'th' ? 'ดินไม่มีความยืดหยุ่น (Non-Plastic · PI = 0)' : 'Non-Plastic Soil (NP · PI = 0)'}
            </span>
            <input
              type="checkbox"
              checked={input.isNonPlastic}
              onChange={(e) => updateField('isNonPlastic', e.target.checked)}
              className="w-4 h-4 accent-[#9a4d22] cursor-pointer"
            />
          </label>

          {!input.isNonPlastic && (
            <>
              {input.atterbergMode === 'raw_cans' ? (
                <>
                  {/* Liquid Limit Trials */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-[#231912]">Liquid Limit (LL)</span>
                      <button
                        type="button"
                        onClick={addLLTrial}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9a4d22] hover:text-[#7c3b18] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        {lang === 'th' ? 'เพิ่มแถว' : 'Add'}
                      </button>
                    </div>
                    <div className="border border-[#ddd3c3] rounded overflow-x-auto bg-[#fffdf9]">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#f3ede3] border-b border-[#ddd3c3] text-[#5e4e41]">
                            <th className="py-1.5 px-2 text-center font-semibold">N</th>
                            <th className="py-1.5 px-1.5 text-right font-semibold">Can(g)</th>
                            <th className="py-1.5 px-1.5 text-right font-semibold">Wet+Can</th>
                            <th className="py-1.5 px-1.5 text-right font-semibold">Dry+Can</th>
                            <th className="py-1.5 px-2 text-right font-semibold">w(%)</th>
                            <th className="py-1.5 px-1"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#efe8dc]">
                          {output.atterberg.llTrials.map((t, idx) => (
                            <tr key={t.id}>
                              <td className="p-1.5 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={t.blows}
                                  onChange={(e) =>
                                    updateLLTrial(idx, 'blows', parseInt(e.target.value, 10) || 1)
                                  }
                                  className="w-12 px-1.5 py-1 text-center font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={t.emptyCanG}
                                  onChange={(e) =>
                                    updateLLTrial(idx, 'emptyCanG', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 px-1.5 py-1 text-right font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={t.wetSoilCanG}
                                  onChange={(e) =>
                                    updateLLTrial(idx, 'wetSoilCanG', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 px-1.5 py-1 text-right font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={t.drySoilCanG}
                                  onChange={(e) =>
                                    updateLLTrial(idx, 'drySoilCanG', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 px-1.5 py-1 text-right font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right font-mono font-semibold text-[#231912]">
                                {t.waterContentPct !== null ? `${t.waterContentPct.toFixed(1)}` : '—'}
                              </td>
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeLLTrial(idx)}
                                  className="text-[#8c7a66] hover:text-[#b91c1c] cursor-pointer"
                                  aria-label="Remove LL trial"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {renderFlowCurveMini()}
                  </div>

                  {/* Plastic Limit Trials */}
                  <div className="pt-2 border-t border-[#efe8dc]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-[#231912]">Plastic Limit (PL)</span>
                      <button
                        type="button"
                        onClick={addPLTrial}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9a4d22] hover:text-[#7c3b18] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        {lang === 'th' ? 'เพิ่มแถว' : 'Add'}
                      </button>
                    </div>
                    <div className="border border-[#ddd3c3] rounded overflow-x-auto bg-[#fffdf9]">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#f3ede3] border-b border-[#ddd3c3] text-[#5e4e41]">
                            <th className="py-1.5 px-2 text-left font-semibold">Can</th>
                            <th className="py-1.5 px-1.5 text-right font-semibold">Can(g)</th>
                            <th className="py-1.5 px-1.5 text-right font-semibold">Wet+Can</th>
                            <th className="py-1.5 px-1.5 text-right font-semibold">Dry+Can</th>
                            <th className="py-1.5 px-2 text-right font-semibold">w(%)</th>
                            <th className="py-1.5 px-1"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#efe8dc]">
                          {output.atterberg.plTrials.map((t, idx) => (
                            <tr key={t.id}>
                              <td className="p-1.5">
                                <input
                                  type="text"
                                  value={t.canLabel}
                                  onChange={(e) => updatePLTrial(idx, 'canLabel', e.target.value)}
                                  className="w-12 px-1.5 py-1 font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={t.emptyCanG}
                                  onChange={(e) =>
                                    updatePLTrial(idx, 'emptyCanG', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 px-1.5 py-1 text-right font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={t.wetSoilCanG}
                                  onChange={(e) =>
                                    updatePLTrial(idx, 'wetSoilCanG', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 px-1.5 py-1 text-right font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={t.drySoilCanG}
                                  onChange={(e) =>
                                    updatePLTrial(idx, 'drySoilCanG', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 px-1.5 py-1 text-right font-mono bg-[#fcfbf8] border border-[#d5c9b6] rounded"
                                />
                              </td>
                              <td className="p-1.5 text-right font-mono font-semibold text-[#231912]">
                                {t.waterContentPct !== null ? `${t.waterContentPct.toFixed(1)}` : '—'}
                              </td>
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removePLTrial(idx)}
                                  className="text-[#8c7a66] hover:text-[#b91c1c] cursor-pointer"
                                  aria-label="Remove PL trial"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs text-[#5e4e41] mb-1">Liquid Limit (LL, %)</label>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      step="0.1"
                      value={input.directLL}
                      onChange={(e) => updateField('directLL', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#5e4e41] mb-1">Plastic Limit (PL, %)</label>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      step="0.1"
                      value={input.directPL}
                      onChange={(e) => updateField('directPL', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-sm font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded focus:outline-none focus:border-[#9a4d22]"
                    />
                  </div>
                </div>
              )}

              {/* Computed LL / PL / PI Quick Summary */}
              <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-[#f3ede3] border border-[#ddd3c3] rounded text-xs font-mono">
                <div>
                  <span className="text-[#786555]">LL: </span>
                  <strong className="text-[#231912]">
                    {output.atterberg.ll !== null ? `${output.atterberg.ll.toFixed(1)}%` : '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#786555]">PL: </span>
                  <strong className="text-[#231912]">
                    {output.atterberg.pl !== null ? `${output.atterberg.pl.toFixed(1)}%` : '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#786555]">PI: </span>
                  <strong className="text-[#8c421b]">
                    {output.atterberg.pi !== null ? `${output.atterberg.pi.toFixed(1)}%` : '—'}
                  </strong>
                </div>
              </div>

              {/* Organic Soil Test */}
              <div className="pt-2 border-t border-[#efe8dc]">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <span className="text-xs font-medium text-[#47382c]">
                    {lang === 'th' ? 'ทดสอบดินอินทรีย์ (LL อบแห้ง)' : 'Organic Soil Check (Oven LL)'}
                  </span>
                  <input
                    type="checkbox"
                    checked={input.checkOrganic}
                    onChange={(e) => updateField('checkOrganic', e.target.checked)}
                    className="w-4 h-4 accent-[#9a4d22] cursor-pointer"
                  />
                </label>
                {input.checkOrganic && (
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="Oven-dried LL (%)"
                      value={input.ovenDriedLL ?? ''}
                      onChange={(e) =>
                        updateField(
                          'ovenDriedLL',
                          e.target.value === '' ? null : parseFloat(e.target.value),
                        )
                      }
                      className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-[#fffdf9] border border-[#d5c9b6] rounded"
                    />
                    <span className="text-xs font-mono text-[#47382c]">
                      Ratio:{' '}
                      <strong>
                        {output.atterberg.organicRatio !== null
                          ? output.atterberg.organicRatio.toFixed(3)
                          : '—'}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Validation Alert */}
      {submitError && (
        <div className="bg-[#fef3c7] border border-[#d97706] rounded px-4 py-2.5 flex items-center gap-2 text-xs font-medium text-[#78350f]">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#b45309]" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Bottom Submit Action */}
      <div className="pt-4 border-t border-[#ddd3c3] flex flex-wrap items-center justify-between gap-4">
        <span className="text-xs text-[#786555]">
          {hasSubmitted
            ? lang === 'th'
              ? 'เลื่อนลงด้านล่างเพื่อดูผลการคำนวณ กราฟ และการตรวจสอบ'
              : 'Scroll down to inspect results, charts, and verification'
            : lang === 'th'
              ? 'กรอกข้อมูลดิบด้านบนให้เรียบร้อย แล้วกดปุ่มเพื่อแสดงผลลัพธ์'
              : 'Enter raw data above and click to calculate and reveal results'}
        </span>

        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-[#fcfbf8] bg-[#8c421b] hover:bg-[#733515] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>
            {hasSubmitted
              ? lang === 'th'
                ? 'เลื่อนไปดูผลลัพธ์'
                : 'Jump to Results'
              : lang === 'th'
                ? 'คำนวณและแสดงผลลัพธ์'
                : 'Calculate & Show Results'}
          </span>
          {hasSubmitted ? <ArrowDown className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
};
