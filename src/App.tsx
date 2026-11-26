import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Columns2,
  Crop,
  Download,
  Eye,
  Hand,
  HelpCircle,
  ImagePlus,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  RotateCcw,
  Search,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { ControlPanel } from './components/ControlPanel';
import { ExportModal } from './components/ExportModal';
import { HelpTooltip } from './components/HelpTooltip';
import { TabBar } from './components/TabBar';
import { useEditorStore } from './store/useEditorStore';
import { parseExifFromFile } from './utils/exif';

export function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const image = useEditorStore((s) => s.image);
  const openImageInNewTab = useEditorStore((s) => s.openImageInNewTab);
  const saveSnapshotTab = useEditorStore((s) => s.saveSnapshotTab);
  const toastMessage = useEditorStore((s) => s.toastMessage);
  const clearToast = useEditorStore((s) => s.clearToast);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const resetAll = useEditorStore((s) => s.resetAll);
  const toolMode = useEditorStore((s) => s.toolMode);
  const setToolMode = useEditorStore((s) => s.setToolMode);
  const splitView = useEditorStore((s) => s.splitView);
  const setSplitView = useEditorStore((s) => s.setSplitView);
  const setComparingOriginal = useEditorStore((s) => s.setComparingOriginal);
  const showPanels = useEditorStore((s) => s.showPanels);
  const setShowPanels = useEditorStore((s) => s.setShowPanels);
  const setExportOpen = useEditorStore((s) => s.setExportOpen);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const resetView = useEditorStore((s) => s.resetView);
  const stepActiveParam = useEditorStore((s) => s.stepActiveParam);

  // Auto-hide toast notification
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => clearToast(), 2600);
    return () => clearTimeout(t);
  }, [toastMessage, clearToast]);

  // Global keyboard shortcuts (Section 6.3 + Ctrl+S snapshot)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveSnapshotTab();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setShowPanels(!useEditorStore.getState().showPanels);
        return;
      }

      if (e.key === '\\' || e.key === ' ') {
        if (e.key === ' ') e.preventDefault();
        setComparingOriginal(true);
        return;
      }

      if (e.key === '[') {
        e.preventDefault();
        stepActiveParam(-1);
      } else if (e.key === ']') {
        e.preventDefault();
        stepActiveParam(1);
      } else if (e.key.toLowerCase() === 'h') {
        setToolMode('pan');
      } else if (e.key.toLowerCase() === 'z') {
        setToolMode('zoom');
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
      } else if (e.key.toLowerCase() === 'c') {
        setToolMode(useEditorStore.getState().toolMode === 'crop' ? 'select' : 'crop');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\' || e.key === ' ') {
        setComparingOriginal(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [undo, redo, saveSnapshotTab, setShowPanels, setComparingOriginal, stepActiveParam, setToolMode]);

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const exif = await parseExifFromFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      openImageInNewTab(img, file.name, exif);
      URL.revokeObjectURL(url);
    };
    img.src = url;
    e.target.value = '';
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#000000] text-zinc-100">
      {/* Apple-style Unified Translucent Toolbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#1c1c1e]/90 px-4 backdrop-blur-2xl">
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-b from-[#38a0ff] to-[#0071e3] text-xs font-bold text-white shadow-[0_2px_8px_rgba(10,132,255,0.4)]">
              N
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-semibold tracking-tight text-white">NuanceEdit</span>
              <span className="text-[11px] font-medium text-zinc-400">Studio</span>
            </div>
          </div>

          <div className="h-4 w-px bg-white/[0.1]" />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleOpenFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.14]"
          >
            <ImagePlus className="h-3.5 w-3.5 text-[#0A84FF]" />
            写真を開く
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-full bg-white/[0.06] p-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={past.length === 0}
              title="元に戻す (Ctrl+Z)"
              className="rounded-full p-1.5 text-zinc-200 transition hover:bg-white/10 disabled:opacity-30"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              title="やり直す (Ctrl+Shift+Z)"
              className="rounded-full p-1.5 text-zinc-200 transition hover:bg-white/10 disabled:opacity-30"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={resetAll}
            title="現在のタブを初期値にリセット"
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            リセット
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowShortcuts(!showShortcuts)}
              title="ショートカット一覧"
              className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            {showShortcuts && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-2xl border border-white/[0.12] bg-[#242426]/95 p-4 text-xs shadow-2xl backdrop-blur-2xl">
                <div className="mb-2.5 font-semibold text-white">キーボードショートカット</div>
                <div className="space-y-2 text-[11px] text-zinc-300">
                  <div className="flex justify-between"><span>一時保存（新規タブ）</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-zinc-100">Ctrl+S</kbd></div>
                  <div className="flex justify-between"><span>Before比較（長押し）</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-zinc-100">Space / \</kbd></div>
                  <div className="flex justify-between"><span>数値の微減 / 微増</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-zinc-100">[ / ]</kbd></div>
                  <div className="flex justify-between"><span>パン / ズームツール</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-zinc-100">H / Z</kbd></div>
                  <div className="flex justify-between"><span>パネル非表示</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-zinc-100">Tab</kbd></div>
                  <div className="flex justify-between"><span>Undo / Redo</span><kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-zinc-100">Ctrl+Z / Shift+Z</kbd></div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPanels(!showPanels)}
            title="インスペクタ表示切替 (Tab)"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
          >
            {showPanels ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>

          <button
            type="button"
            disabled={!image}
            onClick={() => setExportOpen(true)}
            className="ml-1 flex items-center gap-1.5 rounded-full bg-[#0A84FF] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(10,132,255,0.35)] transition hover:bg-[#3399ff] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            書き出し
          </button>
        </div>
      </header>

      {/* IDE-Style Document / Adjustment Variant Tab Bar */}
      <TabBar onOpenNewImage={() => fileInputRef.current?.click()} />

      {/* Main 2-Pane Workspace */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <CanvasWorkspace onOpenFile={() => fileInputRef.current?.click()} />

          {/* Apple-style Bottom Control Bar */}
          <footer className="flex h-12 shrink-0 items-center justify-between border-t border-white/[0.08] bg-[#1c1c1e]/90 px-4 backdrop-blur-2xl select-none">
            <div className="flex items-center gap-1.5">
              <div className="flex items-center rounded-full bg-white/[0.06] p-0.5">
                <button
                  type="button"
                  onClick={() => setToolMode('select')}
                  title="選択 (V)"
                  className={`rounded-full p-1.5 transition ${
                    toolMode === 'select' ? 'bg-[#3a3a3c] text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <MousePointer2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setToolMode('pan')}
                  title="パン / 移動 (H)"
                  className={`rounded-full p-1.5 transition ${
                    toolMode === 'pan' ? 'bg-[#3a3a3c] text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Hand className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setToolMode('zoom')}
                  title="ズーム (Z)"
                  className={`rounded-full p-1.5 transition ${
                    toolMode === 'zoom' ? 'bg-[#3a3a3c] text-white shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setToolMode(toolMode === 'crop' ? 'select' : 'crop')}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    toolMode === 'crop'
                      ? 'bg-[#0A84FF] text-white shadow'
                      : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'
                  }`}
                >
                  <Crop className="h-3.5 w-3.5" />
                  トリミング
                </button>
                <HelpTooltip text="アスペクト比の指定、傾き補正、構図ガイドを使って写真を切り抜きます（ショートカット: C）。" />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSplitView(!splitView)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    splitView
                      ? 'bg-[#0A84FF] text-white shadow'
                      : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  分割比較
                </button>
                <HelpTooltip text="画面中央のバーを左右にドラッグして、編集前と編集後を1画面でシームレスに比較できます。" />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onPointerDown={() => setComparingOriginal(true)}
                  onPointerUp={() => setComparingOriginal(false)}
                  onPointerLeave={() => setComparingOriginal(false)}
                  className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.12] active:bg-[#0A84FF] active:text-white"
                >
                  <Eye className="h-3.5 w-3.5" />
                  長押し比較
                </button>
                <HelpTooltip text="ボタンを押している間（またはSpaceキー長押し中）だけ元の写真を表示し、離すと編集後へ戻ります。" />
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => setZoom(zoom * 0.85)}
                className="rounded-full p-1 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={resetView}
                title="100% / 全体表示にリセット"
                className="min-w-[46px] rounded-full px-1.5 py-0.5 text-center font-mono text-[11px] text-zinc-200 hover:bg-white/10"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom(zoom * 1.15)}
                className="rounded-full p-1 text-zinc-300 hover:bg-white/10 hover:text-white"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </footer>
        </div>

        {showPanels && <ControlPanel />}

        {/* Floating Apple-style Toast Notification */}
        {toastMessage && (
          <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#242426]/95 px-4 py-2 text-xs font-medium text-white shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <CheckCircle2 className="h-4 w-4 text-[#30D158]" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      <ExportModal />
    </div>
  );
}

export default App;
