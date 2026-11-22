import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { CheckStatus, Language, SoilAnalysisOutput } from '../types/geotech';

interface VerificationSectionProps {
  output: SoilAnalysisOutput;
  lang: Language;
}

function StatusLabel({ status, lang }: { status: CheckStatus; lang: Language }) {
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2f6b48] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{lang === 'th' ? 'ผ่าน' : 'PASS'}</span>
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b45309] whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{lang === 'th' ? 'ตรวจสอบ' : 'REVIEW'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b91c1c] whitespace-nowrap">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{lang === 'th' ? 'ไม่ผ่าน' : 'FAIL'}</span>
    </span>
  );
}

export const VerificationSection: React.FC<VerificationSectionProps> = ({ output, lang }) => {
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const passCount = output.checks.filter((c) => c.status === 'pass').length;
  const totalCount = output.checks.length;

  return (
    <section id="verification" className="flex flex-col gap-6">
      {/* Part 1: Raw Data & Physical Validity Checks */}
      <div className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#ddd3c3]">
          <h2 className="text-xl font-bold text-[#231912]">
            {lang === 'th' ? 'การตรวจสอบความถูกต้อง' : 'Verification & Audit'}
          </h2>

          <div className="flex items-center gap-3">
            <StatusLabel status={output.overallStatus} lang={lang} />
            <span className="text-xs font-mono text-[#5e4e41]">
              {passCount}/{totalCount} {lang === 'th' ? 'รายการผ่าน' : 'passed'}
            </span>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#ddd3c3] text-[#786555] text-[11px]">
                <th className="py-2 pr-3 text-left font-semibold">
                  {lang === 'th' ? 'สถานะ' : 'Status'}
                </th>
                <th className="py-2 px-3 text-left font-semibold">
                  {lang === 'th' ? 'รายการตรวจ' : 'Check'}
                </th>
                <th className="py-2 px-3 text-left font-semibold">
                  {lang === 'th' ? 'ค่าที่ได้' : 'Result'}
                </th>
                <th className="py-2 px-3 text-left font-semibold">
                  {lang === 'th' ? 'เกณฑ์' : 'Limit'}
                </th>
                <th className="py-2 pl-3 text-left font-semibold">
                  {lang === 'th' ? 'หมายเหตุ' : 'Detail'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efe8dc]">
              {output.checks.map((chk) => (
                <tr key={chk.id} className="align-top">
                  <td className="py-2.5 pr-3">
                    <StatusLabel status={chk.status} lang={lang} />
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#231912] whitespace-nowrap">
                    {lang === 'th' ? chk.titleTh : chk.titleEn}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#231912] whitespace-nowrap">
                    {chk.measuredText}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[#786555] whitespace-nowrap">
                    {chk.criterionText}
                  </td>
                  <td className="py-2.5 pl-3 text-[#5e4e41]">
                    {lang === 'th' ? chk.detailTh : chk.detailEn}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Part 2: USCS & AASHTO Step-by-Step Decision Proofs */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#ddd3c3]">
            <h3 className="text-base font-bold text-[#231912]">
              {lang === 'th' ? 'ขั้นตอนการตัดสินใจ USCS' : 'USCS Decision Path'}
            </h3>
            <span className="font-mono text-lg font-bold text-[#8c421b]">{output.uscs.symbol}</span>
          </div>

          <div className="flex flex-col divide-y divide-[#efe8dc]">
            {output.uscs.steps.map((step) => (
              <div key={step.stepNumber} className="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#231912]">
                    {step.stepNumber > 0 ? `${step.stepNumber}. ` : ''}
                    {lang === 'th' ? step.ruleTh : step.ruleEn}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#8c421b] whitespace-nowrap shrink-0">
                    → {lang === 'th' ? step.conclusionTh : step.conclusionEn}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#5e4e41] bg-[#f3ede3] px-2.5 py-1 rounded">
                  {step.observed}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#ddd3c3]">
            <h3 className="text-base font-bold text-[#231912]">
              {lang === 'th' ? 'ขั้นตอนการตัดสินใจ AASHTO' : 'AASHTO Decision Path'}
            </h3>
            <span className="font-mono text-lg font-bold text-[#231912]">
              {output.aashto.fullNotation}
            </span>
          </div>

          <div className="flex flex-col divide-y divide-[#efe8dc]">
            {output.aashto.steps.map((step) => (
              <div key={step.stepNumber} className="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#231912]">
                    {step.stepNumber}. {lang === 'th' ? step.ruleTh : step.ruleEn}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#2f6b48] whitespace-nowrap shrink-0">
                    → {lang === 'th' ? step.conclusionTh : step.conclusionEn}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#5e4e41] bg-[#f3ede3] px-2.5 py-1 rounded break-words">
                  {step.observed}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#efe8dc]">
            <button
              type="button"
              onClick={() => setShowFullMatrix((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8c421b] hover:text-[#733515] cursor-pointer"
            >
              {showFullMatrix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>
                {showFullMatrix
                  ? lang === 'th'
                    ? 'ซ่อนตารางคัดกรอง AASHTO ทั้ง 12 กลุ่ม'
                    : 'Hide Full 12-Group AASHTO Table'
                  : lang === 'th'
                    ? 'ดูตารางคัดกรอง AASHTO ทั้ง 12 กลุ่ม (A-1-a ถึง A-7-6)'
                    : 'View Full 12-Group AASHTO Table'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Expandable 12-Group Matrix */}
      {showFullMatrix && (
        <div className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#ddd3c3] mb-3">
            <h3 className="text-base font-bold text-[#231912]">
              {lang === 'th' ? 'ตารางคัดเลือก AASHTO M 145 (ซ้าย → ขวา)' : 'AASHTO M 145 Elimination Matrix'}
            </h3>
            <span className="text-xs font-mono font-semibold text-[#8c421b]">
              {output.aashto.fullNotation}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-[#f3ede3] border-b border-[#ddd3c3] text-[#5e4e41]">
                  <th className="py-2 px-2.5 text-left font-semibold">Group</th>
                  <th className="py-2 px-2.5 text-left font-semibold">Result</th>
                  <th className="py-2 px-2.5 text-left font-semibold">Criteria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efe8dc]">
                {output.aashto.evaluations.map((ev) => (
                  <tr
                    key={ev.group}
                    className={ev.isSelected ? 'bg-[#f4e8dc]/75' : 'hover:bg-[#faf6ef]'}
                  >
                    <td className="py-2 px-2.5 font-mono font-semibold text-[#231912] whitespace-nowrap">
                      {ev.group}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      {ev.overallPass ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#2f6b48]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {lang === 'th' ? 'ผ่าน' : 'PASS'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#9b8a77]">
                          <XCircle className="w-3.5 h-3.5" />
                          {lang === 'th' ? 'ไม่ผ่าน' : 'FAIL'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 font-mono">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {ev.criteria.map((c, idx) => (
                          <span
                            key={idx}
                            className={c.pass ? 'text-[#47382c]' : 'text-[#b91c1c] font-medium'}
                          >
                            {c.pass ? '✓' : '✕'} {c.label}: {c.actual}{' '}
                            <span className="text-[#8c7a66]">({c.requirement})</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
