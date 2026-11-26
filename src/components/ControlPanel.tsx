import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Crosshair, Eye, EyeOff, Info, Sparkles, Sliders, UserCheck } from 'lucide-react';
import { NUANCE_PRESETS } from '../data/presets';
import { useEditorStore } from '../store/useEditorStore';
import { AspectPreset, CompositionGuide } from '../types/editor';
import { HelpTooltip } from './HelpTooltip';
import { HistogramPanel } from './HistogramPanel';
import { ParamSlider } from './ParamSlider';

type ProTab = 'tone' | 'color' | 'detail';

export const ControlPanel: React.FC = () => {
  const activePresetId = useEditorStore((s) => s.activePresetId);
  const applyPreset = useEditorStore((s) => s.applyPreset);
  const proExpanded = useEditorStore((s) => s.proExpanded);
  const setProExpanded = useEditorStore((s) => s.setProExpanded);
  const toolMode = useEditorStore((s) => s.toolMode);
  const crop = useEditorStore((s) => s.crop);
  const setCrop = useEditorStore((s) => s.setCrop);
  const resetCrop = useEditorStore((s) => s.resetCrop);
  const image = useEditorStore((s) => s.image);
  const fileName = useEditorStore((s) => s.fileName);
  const exif = useEditorStore((s) => s.exif);
  const showPhotoInfo = useEditorStore((s) => s.showPhotoInfo);
  const setShowPhotoInfo = useEditorStore((s) => s.setShowPhotoInfo);
  const isPickingFocus = useEditorStore((s) => s.isPickingFocus);
  const setPickingFocus = useEditorStore((s) => s.setPickingFocus);
  const showDofOverlay = useEditorStore((s) => s.showDofOverlay);
  const setShowDofOverlay = useEditorStore((s) => s.setShowDofOverlay);
  const setDofPatch = useEditorStore((s) => s.setDofPatch);
  const params = useEditorStore((s) => s.params);
  const setParam = useEditorStore((s) => s.setParam);

  const [proTab, setProTab] = useState<ProTab>('tone');

  const exifSummary = [exif.model, exif.lens, exif.fNumber, exif.exposureTime, exif.iso]
    .filter(Boolean)
    .join(' · ');

  const applyAspectPreset = (aspect: AspectPreset) => {
    if (!image || aspect === 'free') {
      setCrop({ aspectRatio: aspect, x: 0, y: 0, width: 1, height: 1 }, true);
      return;
    }
    const ratioMap: Record<Exclude<AspectPreset, 'free'>, number> = {
      '1:1': 1,
      '4:5': 4 / 5,
      '9:16': 9 / 16,
      '3:2': 3 / 2,
      '16:9': 16 / 9,
    };
    const target = ratioMap[aspect];
    const imgRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
    let w = 1;
    let h = imgRatio / target;
    if (h > 1) {
      h = 1;
      w = target / imgRatio;
    }
    setCrop(
      {
        aspectRatio: aspect,
        width: w,
        height: h,
        x: (1 - w) / 2,
        y: (1 - h) / 2,
      },
      true
    );
  };

  return (
    <aside className="flex h-full w-[336px] shrink-0 flex-col border-l border-white/[0.08] bg-[#1c1c1e]/90 text-zinc-100 backdrop-blur-2xl select-none">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
        {/* 0a. Collapsible Photo Info Section */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5">
          <div className="flex items-center justify-between gap-2 px-1 py-0.5">
            <button
              type="button"
              onClick={() => setShowPhotoInfo(!showPhotoInfo)}
              className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold tracking-tight text-zinc-200 transition-colors hover:text-white"
            >
              {showPhotoInfo ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
              )}
              <Info className="h-3.5 w-3.5 text-zinc-400" />
              <span>写真情報</span>
            </button>
            <HelpTooltip text="開いている写真のファイル名・解像度・撮影Exif情報（カメラ・絞り・シャッター速度・ISO）を表示します。" />
          </div>

          {showPhotoInfo && (
            <div className="mt-2 space-y-1.5 rounded-xl bg-black/35 px-3 py-2 text-[11px]">
              {image ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-zinc-100" title={fileName}>
                      {fileName}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                      {image.naturalWidth} × {image.naturalHeight}
                    </span>
                  </div>
                  {exifSummary && (
                    <div className="truncate font-mono text-[10px] text-zinc-400" title={exifSummary}>
                      {exifSummary}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-zinc-500">写真が読み込まれていません</span>
              )}
            </div>
          )}
        </section>

        {/* 0b. Collapsible Histogram Section */}
        <HistogramPanel />

        {/* Crop Panel when Crop Mode is active */}
        {toolMode === 'crop' && (
          <section className="rounded-2xl border border-[#0A84FF]/35 bg-[#0A84FF]/[0.08] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-semibold tracking-tight text-[#64D2FF]">
                  トリミング・構図調整
                </h2>
                <HelpTooltip text="写真の縦横比や傾きを整えます。構図ガイドを参考に切り抜き範囲をドラッグ調整できます。" />
              </div>
              <button
                type="button"
                onClick={resetCrop}
                className="text-[11px] font-medium text-zinc-300 hover:text-white"
              >
                リセット
              </button>
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-300">
                <span>アスペクト比</span>
                <HelpTooltip text="SNS投稿や印刷などの用途に合わせた標準の縦横比をワンクリックで適用します。" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['free', '1:1', '4:5', '9:16', '3:2', '16:9'] as AspectPreset[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => applyAspectPreset(ar)}
                    className={`rounded-lg py-1.5 text-[11px] font-medium transition-all ${crop.aspectRatio === ar
                      ? 'bg-[#0A84FF] text-white shadow'
                      : 'bg-white/[0.07] text-zinc-300 hover:bg-white/[0.12]'
                      }`}
                  >
                    {ar === 'free' ? 'フリー' : ar}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <span>傾き補正</span>
                  <HelpTooltip text="水平線や建物の傾きを -45°〜+45° の範囲で微調整します。" />
                </div>
                <span className="font-mono text-zinc-100">{crop.rotation.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min={-45}
                max={45}
                step={0.5}
                value={crop.rotation}
                onChange={(e) => setCrop({ rotation: parseFloat(e.target.value) })}
                className="nuance-slider h-4 w-full rounded-full bg-white/15"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-300">
                <span>構図ガイド</span>
                <HelpTooltip text="三分割法や黄金比の補助線を重ねて、バランスの良い構図作りを支援します。" />
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/35 p-1">
                {(
                  [
                    ['thirds', '三分割'],
                    ['diagonal', '対角線'],
                    ['golden', '黄金比'],
                    ['none', 'なし'],
                  ] as [CompositionGuide, string][]
                ).map(([g, label]) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setCrop({ guide: g })}
                    className={`rounded-lg py-1 text-[10px] font-medium transition-colors ${crop.guide === g
                      ? 'bg-[#3a3a3c] text-white shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 1. Quick Nuance Presets (Section 5.1) */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#0A84FF]" />
              <h2 className="text-xs font-semibold tracking-tight text-white">
                クイックニュアンス
              </h2>
              <HelpTooltip text="撮影シーンに合わせた調和のとれた色味・明るさをワンタップで適用します。適用後も各スライダーで自由に微調整できます。" />
            </div>
            <span className="text-[10px] text-zinc-500">ワンタップ</span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {NUANCE_PRESETS.map((preset) => {
              const active = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`group flex items-center gap-3 rounded-xl border p-2 text-left transition-all ${active
                    ? 'border-[#0A84FF]/70 bg-[#0A84FF]/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'border-transparent bg-white/[0.035] hover:bg-white/[0.07]'
                    }`}
                >
                  <div
                    className="h-9 w-11 shrink-0 rounded-lg border border-white/15 shadow-inner"
                    style={{ background: preset.swatchGradient }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs font-semibold ${active ? 'text-white' : 'text-zinc-100'
                          }`}
                      >
                        {preset.name}
                      </span>
                      <span className="text-[9px] font-medium tracking-wide text-zinc-400">
                        {preset.subtitle}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-400">{preset.scene}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Basic Sliders (Progressive Disclosure Tier 1) */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-zinc-300" />
              <h2 className="text-xs font-semibold tracking-tight text-white">基本調整</h2>
              <HelpTooltip text="写真の印象を決める4つの基本項目です。スライダー名またはツマミをダブルクリックすると初期値に戻ります。" />
            </div>
            <span className="text-[10px] text-zinc-500">ダブルクリックで戻す</span>
          </div>
          <div className="space-y-1">
            <ParamSlider paramKey="exposure" beginnerMode showNumericInput={proExpanded} />
            <ParamSlider paramKey="vibrance" beginnerMode showNumericInput={proExpanded} />
            <ParamSlider paramKey="temperature" beginnerMode showNumericInput={proExpanded} />
            <ParamSlider paramKey="clarity" beginnerMode showNumericInput={proExpanded} />
          </div>
        </section>

        {/* 3. Portrait One-Touch Assist (Section 5.2) */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-[#FF375F]" />
              <h2 className="text-xs font-semibold tracking-tight text-white">ポートレート補正</h2>
              <HelpTooltip text="人物写真の肌質感・瞳の輝き・血色感をワンタッチで自然に引き立てます。オンにすると強度の微調整スライダーが表示されます。" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['skinSmooth', '肌スムース', 45],
                ['catchlight', '瞳輝き', 55],
                ['skinWarmth', '血色感', 40],
              ] as const
            ).map(([key, label, presetVal]) => {
              const isOn = params[key] > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setParam(key, isOn ? 0 : presetVal, true)}
                  className={`rounded-xl border px-2 py-2 text-[11px] font-medium transition-all ${isOn
                    ? 'border-[#FF375F]/50 bg-[#FF375F]/20 text-white shadow-sm'
                    : 'border-white/[0.06] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.09] hover:text-white'
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {(params.skinSmooth > 0 || params.catchlight > 0 || params.skinWarmth > 0) && (
            <div className="mt-2.5 space-y-1 border-t border-white/[0.06] pt-2">
              <ParamSlider paramKey="skinSmooth" showNumericInput={proExpanded} />
              <ParamSlider paramKey="catchlight" showNumericInput={proExpanded} />
              <ParamSlider paramKey="skinWarmth" showNumericInput={proExpanded} />
            </div>
          )}
        </section>

        {/* 4. Professional Detail Toggle (Progressive Disclosure Tier 2) */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5">
          <div className="flex items-center justify-between px-1 py-1">
            <button
              type="button"
              onClick={() => setProExpanded(!proExpanded)}
              className="flex flex-1 items-center gap-1.5 text-left text-xs font-semibold text-zinc-200 transition-colors hover:text-white"
            >
              {proExpanded ? (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              )}
              <span>プロフェッショナル詳細</span>
            </button>
            <HelpTooltip text="ハイライト・シャドウの個別制御やケルビン数値入力、フィルム粒子など詳細なパラメータを展開します。" />
          </div>

          {proExpanded && (
            <div className="mt-2.5 space-y-3 px-0.5">
              {/* Apple-style Segmented Control */}
              <div className="grid grid-cols-3 rounded-xl bg-black/40 p-1">
                {(
                  [
                    ['tone', '階調'],
                    ['color', 'カラー'],
                    ['detail', 'ディテール'],
                  ] as [ProTab, string][]
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProTab(tab)}
                    className={`rounded-lg py-1.5 text-[11px] font-medium transition-all ${proTab === tab
                      ? 'bg-[#3a3a3c] text-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]'
                      : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {proTab === 'tone' && (
                <div className="space-y-1">
                  <ParamSlider paramKey="highlights" showNumericInput />
                  <ParamSlider paramKey="shadows" showNumericInput />
                  <ParamSlider paramKey="contrast" showNumericInput />
                  <ParamSlider paramKey="whites" showNumericInput />
                  <ParamSlider paramKey="blacks" showNumericInput />
                </div>
              )}

              {proTab === 'color' && (
                <div className="space-y-1">
                  <ParamSlider paramKey="temperature" showNumericInput />
                  <ParamSlider paramKey="tint" showNumericInput />
                  <ParamSlider paramKey="vibrance" showNumericInput />
                  <ParamSlider paramKey="shadowTint" showNumericInput />
                </div>
              )}

              {proTab === 'detail' && (
                <div className="space-y-1">
                  <ParamSlider paramKey="clarity" showNumericInput />
                  <ParamSlider paramKey="grain" showNumericInput />
                  <div className="my-1.5 border-t border-white/[0.06] pt-1.5">
                    <ParamSlider paramKey="dofBlur" showNumericInput />
                    {params.dofBlur > 0 && (
                      <div className="mt-1.5 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!showDofOverlay) setShowDofOverlay(true);
                              setPickingFocus(!isPickingFocus);
                            }}
                            className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition-all ${
                              isPickingFocus
                                ? 'border-[#0A84FF] bg-[#0A84FF]/20 text-white shadow-sm'
                                : 'border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.09]'
                            }`}
                          >
                            <Crosshair className="h-3.5 w-3.5 shrink-0 text-[#0A84FF]" />
                            <span className="truncate">
                              {isPickingFocus ? 'ピント指定中' : 'ピント指定'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowDofOverlay(!showDofOverlay)}
                            className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium transition-all ${
                              showDofOverlay
                                ? 'border-white/[0.12] bg-white/[0.08] text-zinc-100 hover:bg-white/[0.12]'
                                : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200'
                            }`}
                          >
                            {showDofOverlay ? (
                              <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                            )}
                            <span className="truncate">
                              {showDofOverlay ? 'ガイド表示' : 'ガイド非表示'}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between px-1 pt-0.5 text-[10px] text-zinc-400">
                          <span>写真上の楕円ハンドルで範囲・傾きを調整</span>
                          <button
                            type="button"
                            onClick={() =>
                              setDofPatch(
                                {
                                  dofFocusX: 50,
                                  dofFocusY: 50,
                                  dofRadiusX: 26,
                                  dofRadiusY: 26,
                                  dofAngle: 0,
                                  dofFeather: 22,
                                },
                                true
                              )
                            }
                            className="shrink-0 font-medium text-zinc-300 hover:text-white"
                          >
                            形を戻す
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
