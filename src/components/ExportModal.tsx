import React, { useState } from 'react';
import { Download, ShieldCheck, X } from 'lucide-react';
import { renderFullResolutionExport } from '../engine/webglPipeline';
import { useEditorStore } from '../store/useEditorStore';
import { ExportPresetId } from '../types/editor';
import { HelpTooltip } from './HelpTooltip';

interface PresetConfig {
  id: ExportPresetId;
  title: string;
  desc: string;
  format: 'image/webp' | 'image/jpeg' | 'image/png';
  ext: string;
  quality: number;
  maxLongEdge: number | null;
  colorSpace: 'srgb' | 'display-p3';
}

const EXPORT_PRESETS: PresetConfig[] = [
  {
    id: 'web',
    title: 'Web / SNS 最適化',
    desc: '最大長辺 2048px · WebP · sRGB（軽量・高鮮明）',
    format: 'image/webp',
    ext: 'webp',
    quality: 0.92,
    maxLongEdge: 2048,
    colorSpace: 'srgb',
  },
  {
    id: 'print',
    title: '高品質・印刷用',
    desc: '原寸大解像度 · JPEG 100% · sRGB',
    format: 'image/jpeg',
    ext: 'jpg',
    quality: 1.0,
    maxLongEdge: null,
    colorSpace: 'srgb',
  },
  {
    id: 'archive',
    title: 'ロスレスアーカイブ',
    desc: '原寸大解像度 · PNG 非圧縮 · Display P3',
    format: 'image/png',
    ext: 'png',
    quality: 1.0,
    maxLongEdge: null,
    colorSpace: 'display-p3',
  },
];

export const ExportModal: React.FC = () => {
  const exportOpen = useEditorStore((s) => s.exportOpen);
  const setExportOpen = useEditorStore((s) => s.setExportOpen);
  const image = useEditorStore((s) => s.image);
  const fileName = useEditorStore((s) => s.fileName);
  const params = useEditorStore((s) => s.params);
  const crop = useEditorStore((s) => s.crop);

  const [selectedId, setSelectedId] = useState<ExportPresetId>('web');
  const [stripExif, setStripExif] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!exportOpen || !image) return null;

  const activePreset = EXPORT_PRESETS.find((p) => p.id === selectedId)!;
  const sw = Math.round(crop.width * image.naturalWidth);
  const sh = Math.round(crop.height * image.naturalHeight);
  const scale = activePreset.maxLongEdge
    ? Math.min(1, activePreset.maxLongEdge / Math.max(sw, sh))
    : 1;
  const outW = Math.round(sw * scale);
  const outH = Math.round(sh * scale);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const outCanvas = renderFullResolutionExport(
          image,
          params,
          crop,
          activePreset.maxLongEdge
        );
        outCanvas.toBlob(
          (blob) => {
            if (!blob) {
              setIsExporting(false);
              return;
            }
            const baseName = fileName.replace(/\.[^.]+$/, '');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_nuance.${activePreset.ext}`;
            a.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
            setExportOpen(false);
          },
          activePreset.format,
          activePreset.quality
        );
      } catch {
        setIsExporting(false);
      }
    }, 30);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#1c1c1e]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-semibold tracking-tight text-white">書き出し</h3>
              <HelpTooltip text="現在のタブの調整内容とトリミングを原画像解像度でレンダリングし、端末へ直接ダウンロードします。" />
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              フル解像度パイプラインでブラウザ内書き出し
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExportOpen(false)}
            className="rounded-full bg-white/[0.08] p-1.5 text-zinc-300 transition hover:bg-white/[0.16] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {EXPORT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setSelectedId(preset.id)}
              className={`w-full rounded-2xl border p-3.5 text-left transition-all ${
                selectedId === preset.id
                  ? 'border-[#0A84FF] bg-[#0A84FF]/15'
                  : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">{preset.title}</span>
                <span className="rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
                  {preset.ext}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">{preset.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#30D158]" />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-100">
                <span>Exifメタデータを消去</span>
                <HelpTooltip text="撮影日時・位置情報・使用カメラなどの個人特定につながる情報を除いて書き出します。" />
              </div>
              <div className="text-[10px] text-zinc-400">プライバシー保護のため推奨</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={stripExif}
            onChange={(e) => setStripExif(e.target.checked)}
            className="h-4 w-4 accent-[#0A84FF]"
          />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
          <div className="font-mono text-xs text-zinc-400">
            出力: <span className="text-white">{outW} × {outH} px</span>
          </div>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[#3399ff] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {isExporting ? '書き出し中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
};
