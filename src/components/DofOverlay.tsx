import React, { useRef } from 'react';
import { useEditorStore } from '../store/useEditorStore';

interface DofOverlayProps {
  width: number;
  height: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

type HandleType = 'center' | 'rxPos' | 'rxNeg' | 'ryPos' | 'ryNeg' | 'feather';

export const DofOverlay: React.FC<DofOverlayProps> = ({ width, height, canvasRef }) => {
  const params = useEditorStore((s) => s.params);
  const setDofPatch = useEditorStore((s) => s.setDofPatch);
  const commitHistory = useEditorStore((s) => s.commitHistory);

  const dragRef = useRef<{
    handle: HandleType;
    snapshot: {
      params: ReturnType<typeof useEditorStore.getState>['params'];
      crop: ReturnType<typeof useEditorStore.getState>['crop'];
      activePresetId: string | null;
    };
  } | null>(null);

  const cx = (params.dofFocusX / 100) * width;
  const cy = (params.dofFocusY / 100) * height;
  const rx = (params.dofRadiusX / 100) * height;
  const ry = (params.dofRadiusY / 100) * height;
  const feather = (params.dofFeather / 100) * height;
  const angleRad = (params.dofAngle * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const toCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * width;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * height;
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent, handle: HandleType) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const s = useEditorStore.getState();
    dragRef.current = {
      handle,
      snapshot: {
        params: { ...s.params },
        crop: { ...s.crop },
        activePresetId: s.activePresetId,
      },
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    const { handle } = dragRef.current;
    const pt = toCanvasPoint(e.clientX, e.clientY);

    if (handle === 'center') {
      setDofPatch({
        dofFocusX: (pt.x / Math.max(1, width)) * 100,
        dofFocusY: (pt.y / Math.max(1, height)) * 100,
      });
      return;
    }

    const dx = pt.x - cx;
    const dy = pt.y - cy;

    if (handle === 'rxPos' || handle === 'rxNeg') {
      // Affinity-style: dragging X handles stretches horizontal semi-axis AND rotates ellipse
      // Hold Shift to lock current angle and stretch X only
      const dist = Math.hypot(dx, dy);
      const nextRx = (dist / Math.max(1, height)) * 100;
      if (e.shiftKey) {
        const localX = Math.abs(dx * cosA + dy * sinA);
        setDofPatch({ dofRadiusX: (localX / Math.max(1, height)) * 100 });
      } else {
        let nextAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (handle === 'rxNeg') nextAngle += 180;
        setDofPatch({ dofRadiusX: nextRx, dofAngle: nextAngle });
      }
      return;
    }

    if (handle === 'ryPos' || handle === 'ryNeg') {
      // Project onto rotated Y axis to stretch vertical semi-axis independently (forms ellipse)
      const localY = Math.abs(-dx * sinA + dy * cosA);
      setDofPatch({ dofRadiusY: (localY / Math.max(1, height)) * 100 });
      return;
    }

    if (handle === 'feather') {
      // Project onto rotated +X axis beyond rx to adjust blur transition width
      const localX = Math.abs(dx * cosA + dy * sinA);
      const nextFeather = ((localX - rx) / Math.max(1, height)) * 100;
      setDofPatch({ dofFeather: nextFeather });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    commitHistory(dragRef.current.snapshot);
    dragRef.current = null;
  };

  // Compute handle coordinates in canvas space
  const pRxPos = { x: cx + rx * cosA, y: cy + rx * sinA };
  const pRxNeg = { x: cx - rx * cosA, y: cy - rx * sinA };
  const pRyPos = { x: cx - ry * sinA, y: cy + ry * cosA };
  const pRyNeg = { x: cx + ry * sinA, y: cy - ry * cosA };
  const pFeather = { x: cx + (rx + feather) * cosA, y: cy + (rx + feather) * sinA };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 z-20 overflow-visible select-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Rotated Concentric Ellipses (Affinity Photo Respect) */}
      <g transform={`rotate(${params.dofAngle} ${cx} ${cy})`}>
        {/* Outer Full-Blur Dashed Ellipse */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + feather}
          ry={ry + feather}
          fill="none"
          stroke="rgba(10, 132, 255, 0.72)"
          strokeWidth="1.25"
          strokeDasharray="5 4"
        />

        {/* Inner Sharp Focus Solid Ellipse */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="rgba(10, 132, 255, 0.04)"
          stroke="rgba(255, 255, 255, 0.9)"
          strokeWidth="1.4"
          style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.75))' }}
        />
      </g>

      {/* Crosshair Axes connecting center to inner handles */}
      <line
        x1={pRxNeg.x}
        y1={pRxNeg.y}
        x2={pRxPos.x}
        y2={pRxPos.y}
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1"
      />
      <line
        x1={pRyNeg.x}
        y1={pRyNeg.y}
        x2={pRyPos.x}
        y2={pRyPos.y}
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="1"
      />
      {/* Feather connector */}
      <line
        x1={pRxPos.x}
        y1={pRxPos.y}
        x2={pFeather.x}
        y2={pFeather.y}
        stroke="rgba(10, 132, 255, 0.75)"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />

      {/* Interactive Handles */}
      {/* Center Focus Handle */}
      <g
        className="pointer-events-auto cursor-move"
        onPointerDown={(e) => handlePointerDown(e, 'center')}
      >
        <title>ドラッグしてピント中心を移動</title>
        <circle cx={cx} cy={cy} r={11} fill="rgba(0,0,0,0.3)" stroke="#0A84FF" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
      </g>

      {/* X-Axis Handles (Stretch X + Rotate) */}
      {(
        [
          ['rxPos', pRxPos],
          ['rxNeg', pRxNeg],
        ] as [HandleType, { x: number; y: number }][]
      ).map(([hType, p]) => (
        <g
          key={hType}
          className="pointer-events-auto cursor-ew-resize"
          onPointerDown={(e) => handlePointerDown(e, hType)}
        >
          <title>ドラッグして横幅と傾きを調整（Shiftで角度固定）</title>
          <circle
            cx={p.x}
            cy={p.y}
            r={6.5}
            fill="#ffffff"
            stroke="#0A84FF"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}
          />
        </g>
      ))}

      {/* Y-Axis Handles (Stretch Y to form Ellipse) */}
      {(
        [
          ['ryPos', pRyPos],
          ['ryNeg', pRyNeg],
        ] as [HandleType, { x: number; y: number }][]
      ).map(([hType, p]) => (
        <g
          key={hType}
          className="pointer-events-auto cursor-ns-resize"
          onPointerDown={(e) => handlePointerDown(e, hType)}
        >
          <title>ドラッグして縦幅を調整（楕円変形）</title>
          <circle
            cx={p.x}
            cy={p.y}
            r={6.5}
            fill="#ffffff"
            stroke="#0A84FF"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}
          />
        </g>
      ))}

      {/* Outer Feather Handle */}
      <g
        className="pointer-events-auto cursor-ew-resize"
        onPointerDown={(e) => handlePointerDown(e, 'feather')}
      >
        <title>ドラッグしてボケ境界（フェザー）の広さを調整</title>
        <rect
          x={pFeather.x - 5.5}
          y={pFeather.y - 5.5}
          width={11}
          height={11}
          rx={3}
          transform={`rotate(${params.dofAngle + 45} ${pFeather.x} ${pFeather.y})`}
          fill="#0A84FF"
          stroke="#ffffff"
          strokeWidth="1.5"
          style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}
        />
      </g>
    </svg>
  );
};
