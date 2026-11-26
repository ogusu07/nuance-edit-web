import React, { useRef } from 'react';
import { PARAM_META } from '../data/presets';
import { useEditorStore } from '../store/useEditorStore';
import { ParamKey } from '../types/editor';
import { HelpTooltip } from './HelpTooltip';

interface ParamSliderProps {
  paramKey: ParamKey;
  beginnerMode?: boolean;
  showNumericInput?: boolean;
}

export const ParamSlider: React.FC<ParamSliderProps> = ({
  paramKey,
  beginnerMode = false,
  showNumericInput = false,
}) => {
  const meta = PARAM_META[paramKey];
  const value = useEditorStore((s) => s.params[paramKey]);
  const activeParamKey = useEditorStore((s) => s.activeParamKey);
  const setParam = useEditorStore((s) => s.setParam);
  const resetParam = useEditorStore((s) => s.resetParam);
  const commitHistory = useEditorStore((s) => s.commitHistory);

  const snapshotRef = useRef<{
    params: ReturnType<typeof useEditorStore.getState>['params'];
    crop: ReturnType<typeof useEditorStore.getState>['crop'];
    activePresetId: string | null;
  } | null>(null);

  const isActive = activeParamKey === paramKey;
  const isModified = Math.abs(value - meta.defaultValue) > 0.001;
  const displayLabel = beginnerMode && meta.beginnerLabel ? meta.beginnerLabel : meta.label;

  const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;
  const trackStyle = meta.trackGradient
    ? { background: meta.trackGradient }
    : {
        background: `linear-gradient(to right, #0A84FF 0%, #0A84FF ${pct}%, rgba(255,255,255,0.14) ${pct}%, rgba(255,255,255,0.14) 100%)`,
      };

  const formattedValue =
    meta.step < 1
      ? `${value > 0 ? '+' : ''}${value.toFixed(2)}${meta.unit ?? ''}`
      : `${value > 0 && meta.min < 0 ? '+' : ''}${Math.round(value)}${meta.unit ?? ''}`;

  const handlePointerDown = () => {
    const s = useEditorStore.getState();
    snapshotRef.current = {
      params: { ...s.params },
      crop: { ...s.crop },
      activePresetId: s.activePresetId,
    };
  };

  const handlePointerUp = () => {
    if (snapshotRef.current) {
      commitHistory(snapshotRef.current);
      snapshotRef.current = null;
    }
  };

  return (
    <div
      className={`group rounded-xl px-2.5 py-2 transition-colors ${
        isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onDoubleClick={() => resetParam(paramKey)}
            title="ダブルクリックで初期値にリセット"
            className={`cursor-pointer select-none truncate text-left font-medium transition-colors ${
              isModified ? 'text-white' : 'text-zinc-300 group-hover:text-white'
            }`}
          >
            {displayLabel}
          </button>
          <HelpTooltip text={meta.description} />
          {isModified && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A84FF]" />}
        </div>

        {showNumericInput ? (
          <input
            type="number"
            min={meta.min}
            max={meta.max}
            step={meta.step}
            value={meta.step < 1 ? Number(value.toFixed(2)) : Math.round(value)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) setParam(paramKey, v, true);
            }}
            className="w-16 rounded-lg border border-white/10 bg-black/40 px-2 py-0.5 text-right font-mono text-[11px] text-zinc-100 focus:border-[#0A84FF] focus:outline-none"
          />
        ) : (
          <span className="shrink-0 font-mono text-[11px] text-zinc-400">{formattedValue}</span>
        )}
      </div>

      <input
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={value}
        style={trackStyle}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onChange={(e) => setParam(paramKey, parseFloat(e.target.value), false)}
        onDoubleClick={() => resetParam(paramKey)}
        className="nuance-slider h-4 w-full rounded-full"
      />
    </div>
  );
};
