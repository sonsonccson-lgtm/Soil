import React from 'react';
import { Language } from '../types/geotech';

interface StandardsReferenceProps {
  lang: Language;
}

export const StandardsReference: React.FC<StandardsReferenceProps> = ({ lang }) => {
  return (
    <section id="standards" className="bg-[#fcfbf8] border border-[#ddd3c3] rounded-lg p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#231912] pb-3 border-b border-[#ddd3c3] mb-4">
        {lang === 'th'
          ? 'เกณฑ์อ้างอิงมาตรฐาน (USCS & AASHTO)'
          : 'Classification Reference Criteria'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        <div className="space-y-1.5 text-[#5e4e41]">
          <h3 className="text-sm font-bold text-[#231912] mb-2">USCS (ASTM D2487)</h3>
          <div>
            <span className="font-mono font-semibold text-[#231912]">P₂₀₀ &lt; 50%</span> ·{' '}
            {lang === 'th' ? 'ดินเม็ดหยาบ (Gravel / Sand)' : 'Coarse-Grained (Gravel / Sand)'}
          </div>
          <div>
            <span className="font-mono font-semibold text-[#231912]">GW / SW</span> ·{' '}
            {lang === 'th' ? 'Fines < 5%, Cu ≥ 4 (GW) หรือ 6 (SW), 1 ≤ Cc ≤ 3' : 'Fines < 5%, Cu ≥ 4/6, 1 ≤ Cc ≤ 3'}
          </div>
          <div>
            <span className="font-mono font-semibold text-[#231912]">A-Line</span> ·{' '}
            <span className="font-mono">PI = 0.73(LL − 20)</span> ·{' '}
            <span className="font-mono">U-Line: PI = 0.90(LL − 8)</span>
          </div>
        </div>

        <div className="space-y-1.5 text-[#5e4e41]">
          <h3 className="text-sm font-bold text-[#231912] mb-2">AASHTO (M 145)</h3>
          <div>
            <span className="font-mono font-semibold text-[#231912]">P₂₀₀ ≤ 35%</span> ·{' '}
            {lang === 'th' ? 'วัสดุเม็ดหยาบ (A-1 ถึง A-3, A-2)' : 'Granular Materials (A-1 to A-3, A-2)'}
          </div>
          <div>
            <span className="font-mono font-semibold text-[#231912]">P₂₀₀ &gt; 35%</span> ·{' '}
            {lang === 'th' ? 'ดินตะกอน-ดินเหนียว (A-4 ถึง A-7)' : 'Silt-Clay Materials (A-4 to A-7)'}
          </div>
          <div>
            <span className="font-mono font-semibold text-[#231912]">GI</span> ·{' '}
            <span className="font-mono">(F−35)[0.2+0.005(LL−40)] + 0.01(F−15)(PI−10)</span>
          </div>
        </div>
      </div>
    </section>
  );
};
