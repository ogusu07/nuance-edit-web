import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEditorStore } from '../store/useEditorStore';
import { HelpTooltip } from './HelpTooltip';

function buildPath(arr: Uint32Array, maxCount: number, width: number, height: number): string {
  const n = arr.length;
  let d = `M 0 ${height}`;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * width;
    const norm = Math.min(1, arr[i] / Math.max(1, maxCount));
    const y = height - norm * (height - 4);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L ${width} ${height} Z`;
  return d;
}

export const HistogramPanel: React.FC = () => {
  const bins = useEditorStore((s) => s.histogram);
  const showClipping = useEditorStore((s) => s.showClipping);
  const setShowClipping = useEditorStore((s) => s.setShowClipping);
  const showHistogram = useEditorStore((s) => s.showHistogram);
  const setShowHistogram = useEditorStore((s) => s.setShowHistogram);

  const w = 264;
  const h = 64;

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 select-none">
      <div className="flex items-center justify-between gap-2 px-1 py-0.5">
        <button
          type="button"
          onClick={() => setShowHistogram(!showHistogram)}
          className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold tracking-tight text-zinc-200 transition-colors hover:text-white"
        >
          {showHistogram ? (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          )}
          <span>ヒストグラム</span>
          {bins && (
            <span className="flex items-center gap-1">
              <span
                title="黒つぶれ警告"
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  bins.hasShadowClip ? 'bg-[#0A84FF] shadow-[0_0_6px_#0A84FF]' : 'bg-zinc-700'
                }`}
              />
              <span
                title="白飛び警告"
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  bins.hasHighlightClip ? 'bg-[#FF453A] shadow-[0_0_6px_#FF453A]' : 'bg-zinc-700'
                }`}
              />
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {showHistogram && (
            <button
              type="button"
              onClick={() => setShowClipping(!showClipping)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                showClipping
                  ? 'bg-[#0A84FF] text-white'
                  : 'bg-white/[0.08] text-zinc-300 hover:bg-white/[0.14]'
              }`}
            >
              警告
            </button>
          )}
          <HelpTooltip text="写真の明るさとRGB色の分布をリアルタイム表示します。青は黒つぶれ、赤は白飛びの目安です。" />
        </div>
      </div>

      {showHistogram && bins && (
        <div className="mt-2 px-0.5">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="block h-16 w-full overflow-hidden rounded-xl bg-black/50"
          >
            <path d={buildPath(bins.r, bins.maxCount, w, h)} fill="rgba(255, 69, 58, 0.42)" />
            <path d={buildPath(bins.g, bins.maxCount, w, h)} fill="rgba(48, 209, 88, 0.38)" />
            <path d={buildPath(bins.b, bins.maxCount, w, h)} fill="rgba(10, 132, 255, 0.44)" />
            <path
              d={buildPath(bins.luma, bins.maxCount, w, h)}
              fill="none"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="1"
            />
          </svg>
        </div>
      )}
    </section>
  );
};
