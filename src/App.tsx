import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, RotateCcw, XCircle } from 'lucide-react';
import { ParticleSizeChart } from './components/ParticleSizeChart';
import { PlasticityChart } from './components/PlasticityChart';
import { RawDataInputPanel } from './components/RawDataInputPanel';
import { StandardsReference } from './components/StandardsReference';
import { VerificationSection } from './components/VerificationSection';
import { Language, SoilSampleInput } from './types/geotech';
import { analyzeSoilSample } from './utils/geotechEngine';
import { createEmptySample, PRESET_SAMPLES } from './utils/presets';

export default function App() {
  const [lang, setLang] = useState<Language>('th');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('');
  const [sampleInput, setSampleInput] = useState<SoilSampleInput>(() => createEmptySample());
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeSoilSample(sampleInput), [sampleInput]);

  const handlePresetChange = (key: string) => {
    setSelectedPresetKey(key);
    setSubmitError(null);
    const found = PRESET_SAMPLES.find((p) => p.key === key);
    if (found) {
      setSampleInput(found.data);
    }
  };

  const handleReset = () => {
    setSelectedPresetKey('');
    setSampleInput(createEmptySample());
    setHasSubmitted(false);
    setSubmitError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmitForm = () => {
    const hasSieveMass =
      sampleInput.sieveMode === 'percent_passing'
        ? sampleInput.sieves.some((s) => s.directPercentPassing < 100)
        : analysis.sumRetainedPlusPanG > 0;

    if (!hasSieveMass) {
      setSubmitError(
        lang === 'th'
          ? 'กรุณากรอกข้อมูลการร่อนตะแกรงอย่างน้อย 1 ช่อง (หรือเลือกตัวอย่างข้อมูลทดลองด้านบน) ก่อนคำนวณ'
          : 'Please enter at least one sieve measurement (or select a preset sample) before calculating.',
      );
      return;
    }

    setSubmitError(null);
    setHasSubmitted(true);
    setTimeout(() => {
      scrollToSection('results');
    }, 60);
  };

  const handleExportCSV = () => {
    const lines: string[] = [
      'GeoClassify Lab Report',
      `Sample ID,${sampleInput.sampleId}`,
      `Location,"${sampleInput.location}"`,
      `Depth (m),${sampleInput.depthM}`,
      `USCS Symbol,${analysis.uscs.symbol}`,
      `USCS Name,"${analysis.uscs.groupNameEn}"`,
      `AASHTO Classification,"${analysis.aashto.fullNotation}"`,
      `Cobbles %,${analysis.cobblesPct}`,
      `Gravel %,${analysis.gravelPct}`,
      `Sand %,${analysis.sandPct}`,
      `Fines %,${analysis.finesPct}`,
      `LL %,${analysis.atterberg.isNonPlastic ? 'NP' : (analysis.atterberg.ll ?? '')}`,
      `PL %,${analysis.atterberg.isNonPlastic ? 'NP' : (analysis.atterberg.pl ?? '')}`,
      `PI %,${analysis.atterberg.isNonPlastic ? '0 (NP)' : (analysis.atterberg.pi ?? '')}`,
      `Cu,${analysis.cu ?? 'N/A'}`,
      `Cc,${analysis.cc ?? 'N/A'}`,
      `Mass Loss %,${analysis.massLossPct}`,
      `Verification Status,${analysis.overallStatus.toUpperCase()}`,
      '',
      'Sieve,Opening (mm),Retained (g),Cumulative Retained (g),Percent Passing (%)',
      ...analysis.sieveRows.map(
        (r) =>
          `${r.label},${r.openingMm},${r.computedMassRetainedG},${r.cumulativeRetainedG},${r.percentPassing}`,
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(sampleInput.sampleId || 'soil_sample').replace(/[^a-zA-Z0-9_-]/g, '_')}_classification.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f7f3ec] text-[#2c221b] flex flex-col">
      {/* Top Bar: Strict 3-Zone Contract */}
      <header className="bg-[#fcfbf8] border-b border-[#ddd3c3] sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-[#231912] whitespace-nowrap shrink-0"
          >
            GeoClassify Lab
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#5e4e41]">
            <button
              type="button"
              onClick={() => scrollToSection('input')}
              className="hover:text-[#231912] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === 'th' ? 'กรอกข้อมูลดิบ' : 'Raw Data'}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('charts')}
              className={`hover:text-[#231912] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !hasSubmitted ? 'opacity-45 pointer-events-none' : ''
              }`}
            >
              {lang === 'th' ? 'กราฟวิเคราะห์' : 'Charts'}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('verification')}
              className={`hover:text-[#231912] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !hasSubmitted ? 'opacity-45 pointer-events-none' : ''
              }`}
            >
              {lang === 'th' ? 'ตรวจสอบผล' : 'Verification'}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('standards')}
              className="hover:text-[#231912] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {lang === 'th' ? 'มาตรฐานอ้างอิง' : 'Standards'}
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#fcfbf8] bg-[#8c421b] hover:bg-[#733515] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="top" className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Page Title & Controls */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#ddd3c3]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#231912] tracking-tight text-balance">
              {lang === 'th'
                ? 'โปรแกรมจำแนกชนิดของดิน USCS & AASHTO'
                : 'USCS & AASHTO Soil Classification'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#786555] mt-1">
              <span>ASTM D2487</span>
              <span aria-hidden="true">·</span>
              <span>AASHTO M 145</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#fcfbf8] border border-[#d5c9b6] text-[#47382c] hover:bg-[#efe8dc] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'ล้างค่า' : 'Reset'}</span>
            </button>

            <div className="flex items-center p-0.5 bg-[#e6dccb] rounded-md">
              <button
                type="button"
                onClick={() => setLang('th')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  lang === 'th' ? 'bg-[#fcfbf8] text-[#231912] shadow-xs' : 'text-[#5e4e41]'
                }`}
              >
                ไทย
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  lang === 'en' ? 'bg-[#fcfbf8] text-[#231912] shadow-xs' : 'text-[#5e4e41]'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 1: RAW DATA INPUT FORM */}
        <RawDataInputPanel
          input={sampleInput}
          output={analysis}
          selectedPresetKey={selectedPresetKey}
          onSelectPreset={handlePresetChange}
          onChange={(next) => {
            setSelectedPresetKey('');
            setSubmitError(null);
            setSampleInput(next);
          }}
          onSubmit={handleSubmitForm}
          hasSubmitted={hasSubmitted}
          submitError={submitError}
          lang={lang}
        />

        {/* SECTION 2: RESULTS, CHARTS & VERIFICATION (REVEALED BELOW UPON SUBMIT) */}
        {hasSubmitted && (
          <div id="results" className="flex flex-col gap-6 pt-2">
            {/* Classification Summary Banner */}
            <section className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#efe8dc]">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-[#231912]">
                    {lang === 'th' ? 'ผลการจำแนกชนิดของดิน' : 'Classification Results'}
                  </h2>
                  <span className="text-xs text-[#786555] font-mono">
                    {sampleInput.sampleId || 'UNSPECIFIED'}
                    {sampleInput.depthM ? ` · ${sampleInput.depthM} m` : ''}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => scrollToSection('verification')}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:underline underline-offset-4 ${
                    analysis.overallStatus === 'pass'
                      ? 'text-[#2f6b48]'
                      : analysis.overallStatus === 'warn'
                        ? 'text-[#b45309]'
                        : 'text-[#b91c1c]'
                  }`}
                >
                  {analysis.overallStatus === 'pass' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {analysis.overallStatus === 'warn' && <AlertTriangle className="w-4 h-4 shrink-0" />}
                  {analysis.overallStatus === 'fail' && <XCircle className="w-4 h-4 shrink-0" />}
                  <span>
                    {analysis.overallStatus === 'pass'
                      ? lang === 'th'
                        ? 'ผ่านการตรวจสอบทั้งหมด'
                        : 'All Checks Passed'
                      : analysis.overallStatus === 'warn'
                        ? lang === 'th'
                          ? 'มีจุดควรตรวจสอบ'
                          : 'Review Warnings'
                        : lang === 'th'
                          ? 'ข้อมูลไม่สมบูรณ์'
                          : 'Invalid Input'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-semibold text-[#786555]">USCS (ASTM D2487)</div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-4xl font-mono font-bold text-[#8c421b] tracking-tight">
                      {analysis.uscs.symbol}
                    </span>
                    <span className="text-base font-bold text-[#231912]">
                      {lang === 'th' ? analysis.uscs.groupNameTh : analysis.uscs.groupNameEn}
                    </span>
                  </div>
                  <div className="text-xs text-[#786555]">{analysis.uscs.groupNameEn}</div>
                </div>

                <div className="flex flex-col gap-1 md:border-l md:border-[#ddd3c3] md:pl-6">
                  <div className="text-xs font-semibold text-[#786555]">AASHTO (M 145)</div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-4xl font-mono font-bold text-[#231912] tracking-tight">
                      {analysis.aashto.fullNotation}
                    </span>
                    <span className="text-xs font-mono text-[#786555]">
                      GI = {analysis.aashto.groupIndex}
                    </span>
                  </div>
                  <div className="text-xs text-[#5e4e41]">
                    {lang === 'th'
                      ? analysis.aashto.subgradeRatingTh
                      : analysis.aashto.subgradeRatingEn}
                  </div>
                </div>
              </div>

              {/* Composition Breakdown Strip */}
              <div className="pt-3 border-t border-[#efe8dc] flex flex-col gap-2">
                <div className="flex h-2.5 w-full rounded overflow-hidden bg-[#efe8dc]">
                  {analysis.cobblesPct > 0 && (
                    <div
                      style={{ width: `${analysis.cobblesPct}%` }}
                      className="bg-[#5e4e41]"
                    />
                  )}
                  <div style={{ width: `${analysis.gravelPct}%` }} className="bg-[#b45309]" />
                  <div style={{ width: `${analysis.sandPct}%` }} className="bg-[#d97706]" />
                  <div style={{ width: `${analysis.finesPct}%` }} className="bg-[#8c421b]" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#47382c]">
                  <div className="flex flex-wrap items-center gap-4">
                    {analysis.cobblesPct > 0 && (
                      <span>
                        <span className="inline-block w-2 h-2 bg-[#5e4e41] mr-1.5" />
                        Cobbles: <strong>{analysis.cobblesPct.toFixed(1)}%</strong>
                      </span>
                    )}
                    <span>
                      <span className="inline-block w-2 h-2 bg-[#b45309] mr-1.5" />
                      Gravel: <strong>{analysis.gravelPct.toFixed(1)}%</strong>
                    </span>
                    <span>
                      <span className="inline-block w-2 h-2 bg-[#d97706] mr-1.5" />
                      Sand: <strong>{analysis.sandPct.toFixed(1)}%</strong>
                    </span>
                    <span>
                      <span className="inline-block w-2 h-2 bg-[#8c421b] mr-1.5" />
                      Fines (#200): <strong>{analysis.finesPct.toFixed(1)}%</strong>
                    </span>
                  </div>
                  <div className="text-[#786555]">
                    #10: {analysis.p10.toFixed(1)}% · #40: {analysis.p40.toFixed(1)}% · #200:{' '}
                    {analysis.p200.toFixed(1)}%
                  </div>
                </div>
              </div>
            </section>

            {/* Charts Section */}
            <div id="charts" className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <ParticleSizeChart
                curvePoints={analysis.curvePoints}
                d10={analysis.d10}
                d30={analysis.d30}
                d60={analysis.d60}
                cu={analysis.cu}
                cc={analysis.cc}
                lang={lang}
              />

              <PlasticityChart
                atterberg={analysis.atterberg}
                aashtoGroup={analysis.aashto.group}
                uscsFinesZone={analysis.uscs.finesZone}
                lang={lang}
              />
            </div>

            {/* Verification & Audit Trail */}
            <VerificationSection output={analysis} lang={lang} />
          </div>
        )}

        {/* Reference Standards */}
        <StandardsReference lang={lang} />
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-[#ddd3c3] bg-[#fcfbf8] mt-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#786555]">
          <span>GeoClassify Lab · ASTM D2487 & AASHTO M 145</span>
          <span>
            {lang === 'th'
              ? 'คำนวณและทวนสอบผลตามมาตรฐานห้องปฏิบัติการปฐพีกลศาสตร์'
              : 'Deterministic Geotechnical Laboratory Verification'}
          </span>
        </div>
      </footer>
    </div>
  );
}
