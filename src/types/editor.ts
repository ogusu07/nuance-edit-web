export interface EditParams {
  // Basic & Tone
  exposure: number;    // -3.0 to +3.0 EV (default 0.0)
  highlights: number;  // -100 to +100 (default 0)
  shadows: number;     // -100 to +100 (default 0)
  contrast: number;    // -100 to +100 (default 0)
  blacks: number;      // -100 to +100 (default 0)
  whites: number;      // -100 to +100 (default 0)

  // Color
  temperature: number; // 2000 to 10000 K (default 5500)
  tint: number;        // -100 to +100 (default 0)
  vibrance: number;    // -100 to +100 (default 0)

  // Detail & Nuance
  clarity: number;     // -100 to +100 (default 0)
  grain: number;       // 0 to 100 (default 0)
  shadowTint: number;  // -100 to +100 (cyan/teal <-> warm in shadows, default 0)

  // Depth of Field (Pro Detail — Elliptical Affinity-style)
  dofBlur: number;     // 0 to 100 (default 0)
  dofRadiusX: number;  // 5 to 80 % of height (default 26)
  dofRadiusY: number;  // 5 to 80 % of height (default 26)
  dofAngle: number;    // -180 to 180 deg (default 0)
  dofFeather: number;  // 5 to 60 % of height (default 22)
  dofFocusX: number;   // 0 to 100 (default 50)
  dofFocusY: number;   // 0 to 100 (default 50)

  // Portrait Assist (Section 5.2)
  skinSmooth: number;  // 0 to 100 (default 0)
  catchlight: number;  // 0 to 100 (default 0)
  skinWarmth: number;  // 0 to 100 (default 0)
}

export type ParamKey = keyof EditParams;

export interface CropState {
  x: number;           // normalized 0..1
  y: number;           // normalized 0..1
  width: number;       // normalized 0..1
  height: number;      // normalized 0..1
  aspectRatio: AspectPreset;
  rotation: number;    // -45 to +45 degrees
  guide: CompositionGuide;
}

export type AspectPreset = 'free' | '1:1' | '4:5' | '9:16' | '3:2' | '16:9';
export type CompositionGuide = 'thirds' | 'diagonal' | 'golden' | 'none';

export interface ExifData {
  make?: string;
  model?: string;
  lens?: string;
  fNumber?: string;
  exposureTime?: string;
  iso?: string;
  dateTime?: string;
  width?: number;
  height?: number;
}

export interface NuancePreset {
  id: string;
  name: string;
  subtitle: string;
  scene: string;
  swatchGradient: string;
  params: Partial<EditParams>;
}

export type ExportPresetId = 'web' | 'print' | 'archive';

export interface ExportOptions {
  preset: ExportPresetId;
  format: 'image/webp' | 'image/jpeg' | 'image/png';
  quality: number;     // 0..1
  maxLongEdge: number | null; // null = original
  colorSpace: 'srgb' | 'display-p3';
  keepExif: boolean;
}

export type ToolMode = 'select' | 'pan' | 'zoom' | 'crop';
