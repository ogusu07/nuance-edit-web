import React, { useRef } from 'react';
import { useEditorStore } from '../store/useEditorStore';

interface CropOverlayProps {
  width: number;
  height: number;
}

const ASPECT_RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
};

export const CropOverlay: React.FC<CropOverlayProps> = ({ width, height }) => {
  const crop = useEditorStore((s) => s.crop);
  const setCrop = useEditorStore((s) => s.setCrop);
  const dragRef = useRef<{
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se';
    startX: number;
    startY: number;
    orig: typeof crop;
  } | null>(null);

  const onPointerDown = (
    e: React.PointerEvent,
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...crop },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { type, startX, startY, orig } = dragRef.current;
    const dx = (e.clientX - startX) / Math.max(1, width);
    const dy = (e.clientY - startY) / Math.max(1, height);
    const targetRatio = ASPECT_RATIOS[orig.aspectRatio];
    const imgRatio = width / Math.max(1, height);

    if (type === 'move') {
      const nx = Math.min(1 - orig.width, Math.max(0, orig.x + dx));
      const ny = Math.min(1 - orig.height, Math.max(0, orig.y + dy));
      setCrop({ x: nx, y: ny });
      return;
    }

    let nx = orig.x;
    let ny = orig.y;
    let nw = orig.width;
    let nh = orig.height;

    if (type === 'se') {
      nw = Math.min(1 - orig.x, Math.max(0.1, orig.width + dx));
      nh = Math.min(1 - orig.y, Math.max(0.1, orig.height + dy));
    } else if (type === 'nw') {
      const maxDx = orig.width - 0.1;
      const maxDy = orig.height - 0.1;
      const clampedDx = Math.max(-orig.x, Math.min(maxDx, dx));
      const clampedDy = Math.max(-orig.y, Math.min(maxDy, dy));
      nx = orig.x + clampedDx;
      ny = orig.y + clampedDy;
      nw = orig.width - clampedDx;
      nh = orig.height - clampedDy;
    } else if (type === 'ne') {
      nw = Math.min(1 - orig.x, Math.max(0.1, orig.width + dx));
      const maxDy = orig.height - 0.1;
      const clampedDy = Math.max(-orig.y, Math.min(maxDy, dy));
      ny = orig.y + clampedDy;
      nh = orig.height - clampedDy;
    } else if (type === 'sw') {
      const maxDx = orig.width - 0.1;
      const clampedDx = Math.max(-orig.x, Math.min(maxDx, dx));
      nx = orig.x + clampedDx;
      nw = orig.width - clampedDx;
      nh = Math.min(1 - orig.y, Math.max(0.1, orig.height + dy));
    }

    if (targetRatio) {
      // Maintain aspect ratio in pixel coordinates: (nw * width) / (nh * height) = targetRatio
      nh = (nw * imgRatio) / targetRatio;
      if (ny + nh > 1) {
        nh = 1 - ny;
        nw = (nh * targetRatio) / imgRatio;
      }
    }

    setCrop({ x: nx, y: ny, width: nw, height: nh });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const left = crop.x * width;
  const top = crop.y * height;
  const cw = crop.width * width;
  const ch = crop.height * height;

  return (
    <div
      className="absolute inset-0 z-20 select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Dimmed outside regions */}
      <div
        className="pointer-events-none absolute inset-0 bg-black/60"
        style={{
          clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.height) * 100}%, ${(crop.x + crop.width) * 100}% ${(crop.y + crop.height) * 100}%, ${(crop.x + crop.width) * 100}% ${crop.y * 100}%, 0% ${crop.y * 100}%)`,
        }}
      />

      {/* Active crop frame */}
      <div
        onPointerDown={(e) => onPointerDown(e, 'move')}
        style={{ left, top, width: cw, height: ch }}
        className="absolute cursor-move border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
      >
        {/* Composition Guides */}
        {crop.guide === 'thirds' && (
          <svg className="pointer-events-none h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          </svg>
        )}
        {crop.guide === 'diagonal' && (
          <svg className="pointer-events-none h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="0" x2="100" y2="100" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
            <line x1="100" y1="0" x2="0" y2="100" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
          </svg>
        )}
        {crop.guide === 'golden' && (
          <svg className="pointer-events-none h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="38.2" y1="0" x2="38.2" y2="100" stroke="rgba(245,158,11,0.5)" strokeWidth="0.5" />
            <line x1="61.8" y1="0" x2="61.8" y2="100" stroke="rgba(245,158,11,0.5)" strokeWidth="0.5" />
            <line x1="0" y1="38.2" x2="100" y2="38.2" stroke="rgba(245,158,11,0.5)" strokeWidth="0.5" />
            <line x1="0" y1="61.8" x2="100" y2="61.8" stroke="rgba(245,158,11,0.5)" strokeWidth="0.5" />
          </svg>
        )}

        {/* Corner Handles */}
        {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
          const posClass =
            corner === 'nw'
              ? '-left-1.5 -top-1.5 cursor-nwse-resize'
              : corner === 'ne'
                ? '-right-1.5 -top-1.5 cursor-nesw-resize'
                : corner === 'sw'
                  ? '-left-1.5 -bottom-1.5 cursor-nesw-resize'
                  : '-right-1.5 -bottom-1.5 cursor-nwse-resize';
          return (
            <div
              key={corner}
              onPointerDown={(e) => onPointerDown(e, corner)}
              className={`absolute h-3.5 w-3.5 rounded-sm border border-zinc-900 bg-white shadow ${posClass}`}
            />
          );
        })}
      </div>
    </div>
  );
};
