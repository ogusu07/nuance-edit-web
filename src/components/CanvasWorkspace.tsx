import React, { useEffect, useRef, useState } from 'react';
import { Upload, Columns2, ImagePlus } from 'lucide-react';
import {
  computeHistogram,
  createProxySource,
  WebGLImageRenderer,
} from '../engine/webglPipeline';
import { useEditorStore } from '../store/useEditorStore';
import { parseExifFromFile } from '../utils/exif';
import { CropOverlay } from './CropOverlay';
import { DofOverlay } from './DofOverlay';

interface CanvasWorkspaceProps {
  onOpenFile: () => void;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({ onOpenFile }) => {
  const image = useEditorStore((s) => s.image);
  const params = useEditorStore((s) => s.params);
  const crop = useEditorStore((s) => s.crop);
  const toolMode = useEditorStore((s) => s.toolMode);
  const splitView = useEditorStore((s) => s.splitView);
  const splitPosition = useEditorStore((s) => s.splitPosition);
  const setSplitPosition = useEditorStore((s) => s.setSplitPosition);
  const isComparingOriginal = useEditorStore((s) => s.isComparingOriginal);
  const showClipping = useEditorStore((s) => s.showClipping);
  const isPickingFocus = useEditorStore((s) => s.isPickingFocus);
  const showDofOverlay = useEditorStore((s) => s.showDofOverlay);
  const setDofFocus = useEditorStore((s) => s.setDofFocus);
  const commitHistory = useEditorStore((s) => s.commitHistory);
  const zoom = useEditorStore((s) => s.zoom);
  const pan = useEditorStore((s) => s.pan);
  const setPan = useEditorStore((s) => s.setPan);
  const setZoomAndPan = useEditorStore((s) => s.setZoomAndPan);
  const resetView = useEditorStore((s) => s.resetView);
  const openImageInNewTab = useEditorStore((s) => s.openImageInNewTab);
  const setHistogram = useEditorStore((s) => s.setHistogram);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLImageRenderer | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 533 });

  const panDragRef = useRef<{ startX: number; startY: number; origPan: { x: number; y: number } } | null>(null);
  const zoomDragRef = useRef<{
    startX: number;
    startY: number;
    cx: number;
    cy: number;
    origZoom: number;
    origPan: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const splitDragRef = useRef(false);
  const focusDragRef = useRef<{
    snapshot: {
      params: ReturnType<typeof useEditorStore.getState>['params'];
      crop: ReturnType<typeof useEditorStore.getState>['crop'];
      activePresetId: string | null;
    };
  } | null>(null);

  const updateFocusFromClientPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
    const yPct = ((clientY - rect.top) / Math.max(1, rect.height)) * 100;
    setDofFocus(xPct, yPct, false);
  };

  // Helper: zoom smoothly keeping the exact point under (clientX, clientY) pinned
  const zoomAtClientPoint = (targetZoom: number, clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const state = useEditorStore.getState();
    const oldZoom = state.zoom;
    const newZoom = Math.min(8, Math.max(0.25, targetZoom));
    if (Math.abs(newZoom - oldZoom) < 0.0001) return;

    const rect = container.getBoundingClientRect();
    const cx = clientX - (rect.left + rect.width / 2);
    const cy = clientY - (rect.top + rect.height / 2);
    const ratio = newZoom / oldZoom;

    const nextPan = {
      x: cx - (cx - state.pan.x) * ratio,
      y: cy - (cy - state.pan.y) * ratio,
    };

    // Snap back to center neatly when zooming back out to <= 100%
    if (newZoom <= 1.0 && oldZoom > 1.0 && Math.abs(newZoom - 1.0) < 0.08) {
      setZoomAndPan(1, { x: 0, y: 0 });
    } else {
      setZoomAndPan(newZoom, nextPan);
    }
  };

  // Non-passive wheel listener for smooth cursor-centered zoom (mouse wheel + trackpad pinch)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useEditorStore.getState();
      // Smooth proportional zoom factor (works cleanly for both mouse wheel ticks & trackpad pinch)
      const intensity = e.ctrlKey ? 0.01 : 0.0018;
      const clampedDelta = Math.max(-180, Math.min(180, e.deltaY));
      const factor = Math.exp(-clampedDelta * intensity);
      zoomAtClientPoint(state.zoom * factor, e.clientX, e.clientY);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Initialize WebGL renderer once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WebGLImageRenderer(canvas);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Upload proxy texture whenever image changes (including tab switch to another photo)
  useEffect(() => {
    if (!image || !rendererRef.current) return;
    const proxy = createProxySource(image, 2048);
    rendererRef.current.uploadImage(proxy.canvas, proxy.width, proxy.height);
  }, [image]);

  // Compute fitted display size inside container
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current || !image) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pad = 56;
      const maxW = Math.max(200, rect.width - pad);
      const maxH = Math.max(200, rect.height - pad);
      const imgRatio = image.naturalWidth / Math.max(1, image.naturalHeight);
      let w = maxW;
      let h = w / imgRatio;
      if (h > maxH) {
        h = maxH;
        w = h * imgRatio;
      }
      setDisplaySize({ width: Math.round(w), height: Math.round(h) });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [image]);

  // Render WebGL frame whenever params, image, or view flags change
  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas || !image) return;

    const raf = requestAnimationFrame(() => {
      renderer.render(params, {
        splitX: splitView ? splitPosition : 1.0,
        showOriginal: isComparingOriginal,
        showClipping,
      });
      setHistogram(computeHistogram(canvas));
    });
    return () => cancelAnimationFrame(raf);
  }, [image, params, splitView, splitPosition, isComparingOriginal, showClipping, setHistogram]);

  const handleFileLoad = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const exifData = await parseExifFromFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      openImageInNewTab(img, file.name, exifData);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (toolMode === 'crop') return;

    if (isPickingFocus && params.dofBlur > 0 && image) {
      const s = useEditorStore.getState();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      focusDragRef.current = {
        snapshot: {
          params: { ...s.params },
          crop: { ...s.crop },
          activePresetId: s.activePresetId,
        },
      };
      updateFocusFromClientPoint(e.clientX, e.clientY);
      return;
    }

    if (toolMode === 'zoom') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      zoomDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        cx: e.clientX - (rect.left + rect.width / 2),
        cy: e.clientY - (rect.top + rect.height / 2),
        origZoom: zoom,
        origPan: { ...pan },
        moved: false,
      };
      return;
    }

    // Pan when in pan mode, middle click, shift-drag, or zoomed in (>100%)
    if (toolMode === 'pan' || e.button === 1 || e.shiftKey || zoom > 1.01) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panDragRef.current = { startX: e.clientX, startY: e.clientY, origPan: { ...pan } };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (focusDragRef.current) {
      updateFocusFromClientPoint(e.clientX, e.clientY);
      return;
    }
    if (splitDragRef.current && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / Math.max(1, rect.width);
      setSplitPosition(relX);
      return;
    }
    if (panDragRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      setPan({ x: panDragRef.current.origPan.x + dx, y: panDragRef.current.origPan.y + dy });
    } else if (zoomDragRef.current) {
      const { startX, cx, cy, origZoom, origPan } = zoomDragRef.current;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) zoomDragRef.current.moved = true;
      const newZoom = Math.min(8, Math.max(0.25, origZoom * Math.pow(1.006, dx)));
      const ratio = newZoom / origZoom;
      setZoomAndPan(newZoom, {
        x: cx - (cx - origPan.x) * ratio,
        y: cy - (cy - origPan.y) * ratio,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (focusDragRef.current) {
      commitHistory(focusDragRef.current.snapshot);
      focusDragRef.current = null;
      return;
    }
    if (zoomDragRef.current && !zoomDragRef.current.moved) {
      // Single click in Zoom tool: zoom in 1.5x (or Alt+click to zoom out) at cursor
      const factor = e.altKey ? 1 / 1.5 : 1.5;
      zoomAtClientPoint(zoom * factor, e.clientX, e.clientY);
    }
    panDragRef.current = null;
    zoomDragRef.current = null;
    splitDragRef.current = false;
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (toolMode === 'crop') return;
    if (zoom > 1.05) {
      resetView();
    } else {
      zoomAtClientPoint(2.5, e.clientX, e.clientY);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFileLoad(file);
      }}
      className={`relative flex flex-1 items-center justify-center overflow-hidden bg-[#000000] ${
        isPickingFocus && params.dofBlur > 0
          ? 'cursor-crosshair'
          : toolMode === 'pan' || (toolMode === 'select' && zoom > 1.01)
            ? 'cursor-grab active:cursor-grabbing'
            : toolMode === 'zoom'
              ? 'cursor-zoom-in'
              : 'cursor-default'
      }`}
    >
      {/* Subtle studio ambient vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 45%, #1c1c1e 0%, #000000 72%)',
        }}
      />

      {/* Minimal Original Comparison Indicator */}
      {isComparingOriginal && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#0A84FF] px-3 py-1 text-[11px] font-semibold tracking-wide text-white shadow-lg">
          ORIGINAL (BEFORE)
        </div>
      )}

      {/* Empty State when no photo is loaded */}
      {!image && (
        <div className="relative z-10 flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-[#1c1c1e]/75 px-10 py-10 text-center shadow-2xl backdrop-blur-2xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.07] text-[#0A84FF]">
            <ImagePlus className="h-7 w-7" />
          </div>
          <h2 className="text-base font-semibold tracking-tight text-white">
            写真を読み込んで編集を始める
          </h2>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-zinc-400">
            JPEG / PNG / WebP ファイルをここへドラッグ＆ドロップするか、ボタンから選択してください。
          </p>
          <button
            type="button"
            onClick={onOpenFile}
            className="mt-5 flex items-center gap-2 rounded-full bg-[#0A84FF] px-5 py-2 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(10,132,255,0.35)] transition hover:bg-[#3399ff]"
          >
            <ImagePlus className="h-4 w-4" />
            写真を開く
          </button>
          <p className="mt-4 text-[10px] text-zinc-500">
            画像はサーバーへ送信されず、ブラウザ内のみで処理されます
          </p>
        </div>
      )}

      {/* Main WebGL Canvas Stage */}
      <div
        style={{
          width: displaySize.width,
          height: displaySize.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${
            toolMode === 'crop' ? crop.rotation : 0
          }deg)`,
        }}
        className={`relative shadow-[0_28px_70px_rgba(0,0,0,0.85)] ${!image ? 'hidden' : ''}`}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full rounded-[4px] object-contain"
          style={{ width: displaySize.width, height: displaySize.height }}
        />

        {/* Crop Overlay */}
        {toolMode === 'crop' && (
          <CropOverlay width={displaySize.width} height={displaySize.height} />
        )}

        {/* Affinity-style Interactive Elliptical Depth-of-Field Overlay */}
        {params.dofBlur > 0 && showDofOverlay && !isComparingOriginal && toolMode !== 'crop' && (
          <DofOverlay
            width={displaySize.width}
            height={displaySize.height}
            canvasRef={canvasRef}
          />
        )}

        {/* Split-View Draggable Divider */}
        {splitView && !isComparingOriginal && (
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              splitDragRef.current = true;
            }}
            style={{ left: `${splitPosition * 100}%` }}
            className="absolute inset-y-0 z-30 w-0.5 -translate-x-1/2 cursor-ew-resize bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.8)]"
          >
            <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#1c1c1e]/90 text-white shadow-xl backdrop-blur-xl">
              <Columns2 className="h-3.5 w-3.5" />
            </div>
            <span className="pointer-events-none absolute -left-14 top-3 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              After
            </span>
            <span className="pointer-events-none absolute left-2 top-3 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              Before
            </span>
          </div>
        )}
      </div>

      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center border-2 border-dashed border-[#0A84FF] bg-black/75 backdrop-blur-xl">
          <Upload className="mb-3 h-10 w-10 text-[#0A84FF]" />
          <p className="text-sm font-semibold text-white">ドロップして新しいタブで開く</p>
          <p className="mt-1 text-xs text-zinc-400">JPEG / PNG / WebP（ブラウザ内で完結処理）</p>
        </div>
      )}
    </div>
  );
};
