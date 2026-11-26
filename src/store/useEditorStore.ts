import { create } from 'zustand';
import { DEFAULT_PARAMS, NUANCE_PRESETS, PARAM_META } from '../data/presets';
import { HistogramBins } from '../engine/webglPipeline';
import { CropState, EditParams, ExifData, ParamKey, ToolMode } from '../types/editor';

export const DEFAULT_CROP: CropState = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  aspectRatio: 'free',
  rotation: 0,
  guide: 'thirds',
};

export interface HistorySnapshot {
  params: EditParams;
  crop: CropState;
  activePresetId: string | null;
}

export interface EditorTab {
  id: string;
  title: string;
  isSnapshot?: boolean;
  savedAt?: string;
  image: HTMLImageElement | null;
  fileName: string;
  exif: ExifData;
  isSampleImage: boolean;
  params: EditParams;
  crop: CropState;
  activePresetId: string | null;
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  zoom: number;
  pan: { x: number; y: number };
}

let tabCounter = 1;
const makeTabId = () => `tab-${Date.now()}-${tabCounter++}`;

function syncActiveTab(tabs: EditorTab[], activeTabId: string, patch: Partial<EditorTab>): EditorTab[] {
  return tabs.map((t) => (t.id === activeTabId ? { ...t, ...patch } : t));
}

function formatTimeNow(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

interface EditorState {
  // Multi-tab IDE state
  tabs: EditorTab[];
  activeTabId: string;
  snapshotCount: number;
  toastMessage: string | null;

  // Active tab mirrored fields (for fast selectors & seamless reactivity)
  image: HTMLImageElement | null;
  fileName: string;
  exif: ExifData;
  isSampleImage: boolean;
  params: EditParams;
  crop: CropState;
  activePresetId: string | null;
  activeParamKey: ParamKey;
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // UI & View state
  toolMode: ToolMode;
  splitView: boolean;
  splitPosition: number;
  isComparingOriginal: boolean;
  showClipping: boolean;
  showHistogram: boolean;
  showPhotoInfo: boolean;
  isPickingFocus: boolean;
  showDofOverlay: boolean;
  histogram: HistogramBins | null;
  showPanels: boolean;
  proExpanded: boolean;
  exportOpen: boolean;
  zoom: number;
  pan: { x: number; y: number };

  // Tab & Snapshot actions
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  renameTab: (tabId: string, title: string) => void;
  saveSnapshotTab: () => void;
  openImageInNewTab: (img: HTMLImageElement, fileName: string, exif: ExifData) => void;
  clearToast: () => void;

  // Editing actions (operate on active tab)
  setImage: (img: HTMLImageElement, fileName: string, exif: ExifData, isSample?: boolean) => void;
  setParam: (key: ParamKey, value: number, recordHistory?: boolean) => void;
  commitHistory: (prevSnapshot?: HistorySnapshot) => void;
  resetParam: (key: ParamKey) => void;
  applyPreset: (presetId: string) => void;
  resetAll: () => void;
  setCrop: (patch: Partial<CropState>, recordHistory?: boolean) => void;
  resetCrop: () => void;

  undo: () => void;
  redo: () => void;

  setActiveParamKey: (key: ParamKey) => void;
  stepActiveParam: (direction: 1 | -1) => void;
  setToolMode: (mode: ToolMode) => void;
  setSplitView: (enabled: boolean) => void;
  setSplitPosition: (pos: number) => void;
  setComparingOriginal: (comparing: boolean) => void;
  setShowClipping: (show: boolean) => void;
  setShowHistogram: (show: boolean) => void;
  setShowPhotoInfo: (show: boolean) => void;
  setPickingFocus: (picking: boolean) => void;
  setShowDofOverlay: (show: boolean) => void;
  setDofFocus: (x: number, y: number, recordHistory?: boolean) => void;
  setDofPatch: (
    patch: Partial<Pick<EditParams, 'dofFocusX' | 'dofFocusY' | 'dofRadiusX' | 'dofRadiusY' | 'dofAngle' | 'dofFeather'>>,
    recordHistory?: boolean
  ) => void;
  setHistogram: (bins: HistogramBins | null) => void;
  setShowPanels: (show: boolean) => void;
  setProExpanded: (expanded: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoomAndPan: (zoom: number, pan: { x: number; y: number }) => void;
  resetView: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: '',
  snapshotCount: 0,
  toastMessage: null,

  image: null,
  fileName: '',
  exif: {},
  isSampleImage: false,
  params: { ...DEFAULT_PARAMS },
  crop: { ...DEFAULT_CROP },
  activePresetId: null,
  activeParamKey: 'exposure',
  past: [],
  future: [],

  toolMode: 'select',
  splitView: false,
  splitPosition: 0.5,
  isComparingOriginal: false,
  showClipping: false,
  showHistogram: true,
  showPhotoInfo: true,
  isPickingFocus: false,
  showDofOverlay: true,
  histogram: null,
  showPanels: true,
  proExpanded: false,
  exportOpen: false,
  zoom: 1,
  pan: { x: 0, y: 0 },

  clearToast: () => set({ toastMessage: null }),

  switchTab: (tabId) => {
    const state = get();
    if (tabId === state.activeTabId) return;
    const target = state.tabs.find((t) => t.id === tabId);
    if (!target) return;
    set({
      activeTabId: target.id,
      image: target.image,
      fileName: target.fileName,
      exif: target.exif,
      isSampleImage: target.isSampleImage,
      params: { ...target.params },
      crop: { ...target.crop },
      activePresetId: target.activePresetId,
      past: target.past,
      future: target.future,
      zoom: target.zoom,
      pan: { ...target.pan },
    });
  },

  closeTab: (tabId) => {
    const state = get();
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const nextTabs = state.tabs.filter((t) => t.id !== tabId);
    if (nextTabs.length === 0) {
      set({
        tabs: [],
        activeTabId: '',
        image: null,
        fileName: '',
        exif: {},
        isSampleImage: false,
        params: { ...DEFAULT_PARAMS },
        crop: { ...DEFAULT_CROP },
        activePresetId: null,
        past: [],
        future: [],
        histogram: null,
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
      return;
    }
    if (tabId !== state.activeTabId) {
      set({ tabs: nextTabs });
      return;
    }
    const fallback = nextTabs[Math.max(0, idx - 1)];
    set({
      tabs: nextTabs,
      activeTabId: fallback.id,
      image: fallback.image,
      fileName: fallback.fileName,
      exif: fallback.exif,
      isSampleImage: fallback.isSampleImage,
      params: { ...fallback.params },
      crop: { ...fallback.crop },
      activePresetId: fallback.activePresetId,
      past: fallback.past,
      future: fallback.future,
      zoom: fallback.zoom,
      pan: { ...fallback.pan },
    });
  },

  renameTab: (tabId, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title: trimmed } : t)),
    }));
  },

  saveSnapshotTab: () => {
    const state = get();
    if (!state.image) return;
    const nextNum = state.snapshotCount + 1;
    const presetName = state.activePresetId
      ? NUANCE_PRESETS.find((p) => p.id === state.activePresetId)?.name
      : null;
    const label = presetName ? `案${nextNum} · ${presetName}` : `一時保存 #${nextNum}`;
    const newId = makeTabId();
    const newTab: EditorTab = {
      id: newId,
      title: label,
      isSnapshot: true,
      savedAt: formatTimeNow(),
      image: state.image,
      fileName: state.fileName,
      exif: { ...state.exif },
      isSampleImage: state.isSampleImage,
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
      past: [...state.past],
      future: [],
      zoom: state.zoom,
      pan: { ...state.pan },
    };

    set({
      tabs: [...state.tabs, newTab],
      activeTabId: newId,
      snapshotCount: nextNum,
      toastMessage: `「${label}」をタブに一時保存しました`,
      image: newTab.image,
      fileName: newTab.fileName,
      exif: newTab.exif,
      isSampleImage: newTab.isSampleImage,
      params: { ...newTab.params },
      crop: { ...newTab.crop },
      activePresetId: newTab.activePresetId,
      past: newTab.past,
      future: [],
      zoom: newTab.zoom,
      pan: { ...newTab.pan },
    });
  },

  openImageInNewTab: (img, fileName, exif) => {
    const state = get();
    const fullExif: ExifData = { ...exif, width: img.naturalWidth, height: img.naturalHeight };
    const newId = makeTabId();
    const newTab: EditorTab = {
      id: newId,
      title: fileName,
      image: img,
      fileName,
      exif: fullExif,
      isSampleImage: false,
      params: { ...DEFAULT_PARAMS },
      crop: { ...DEFAULT_CROP },
      activePresetId: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
    };

    // If the only existing tab is the unmodified sample image, replace it cleanly; otherwise append a new tab
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    const shouldReplaceInitial =
      state.tabs.length === 1 && activeTab?.isSampleImage && activeTab.past.length === 0;

    const nextTabs = shouldReplaceInitial ? [newTab] : [...state.tabs, newTab];

    set({
      tabs: nextTabs,
      activeTabId: newId,
      image: img,
      fileName,
      exif: fullExif,
      isSampleImage: false,
      params: { ...DEFAULT_PARAMS },
      crop: { ...DEFAULT_CROP },
      activePresetId: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  },

  setImage: (img, fileName, exif, isSample = false) => {
    const state = get();
    const fullExif: ExifData = { ...exif, width: img.naturalWidth, height: img.naturalHeight };
    const patch: Partial<EditorTab> = {
      title: isSample ? 'サンプル写真' : fileName,
      image: img,
      fileName,
      exif: fullExif,
      isSampleImage: isSample,
      params: { ...DEFAULT_PARAMS },
      crop: { ...DEFAULT_CROP },
      activePresetId: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
    };
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, patch),
      image: img,
      fileName,
      exif: fullExif,
      isSampleImage: isSample,
      params: { ...DEFAULT_PARAMS },
      crop: { ...DEFAULT_CROP },
      activePresetId: null,
      past: [],
      future: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  },

  setParam: (key, value, recordHistory = false) => {
    const meta = PARAM_META[key];
    const clamped = Math.min(meta.max, Math.max(meta.min, value));
    const state = get();
    const nextParams = { ...state.params, [key]: clamped };
    if (recordHistory) {
      const snap: HistorySnapshot = {
        params: { ...state.params },
        crop: { ...state.crop },
        activePresetId: state.activePresetId,
      };
      const nextPast = [...state.past.slice(-49), snap];
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, {
          params: nextParams,
          past: nextPast,
          future: [],
        }),
        past: nextPast,
        future: [],
        params: nextParams,
        activeParamKey: key,
      });
    } else {
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, { params: nextParams }),
        params: nextParams,
        activeParamKey: key,
      });
    }
  },

  commitHistory: (prevSnapshot) => {
    const state = get();
    const snap = prevSnapshot ?? {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = [...state.past.slice(-49), snap];
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, { past: nextPast, future: [] }),
      past: nextPast,
      future: [],
    });
  },

  resetParam: (key) => {
    const state = get();
    const snap: HistorySnapshot = {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = [...state.past.slice(-49), snap];
    const nextParams = { ...state.params, [key]: DEFAULT_PARAMS[key] };
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, {
        params: nextParams,
        past: nextPast,
        future: [],
      }),
      past: nextPast,
      future: [],
      params: nextParams,
      activeParamKey: key,
    });
  },

  applyPreset: (presetId) => {
    const preset = NUANCE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const state = get();
    const snap: HistorySnapshot = {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = [...state.past.slice(-49), snap];
    const nextParams: EditParams = {
      ...DEFAULT_PARAMS,
      skinSmooth: state.params.skinSmooth,
      catchlight: state.params.catchlight,
      skinWarmth: state.params.skinWarmth,
      ...preset.params,
    };
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, {
        params: nextParams,
        activePresetId: presetId,
        past: nextPast,
        future: [],
      }),
      past: nextPast,
      future: [],
      activePresetId: presetId,
      params: nextParams,
    });
  },

  resetAll: () => {
    const state = get();
    const snap: HistorySnapshot = {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = [...state.past.slice(-49), snap];
    const nextParams = { ...DEFAULT_PARAMS };
    const nextCrop = { ...DEFAULT_CROP };
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, {
        params: nextParams,
        crop: nextCrop,
        activePresetId: null,
        past: nextPast,
        future: [],
      }),
      past: nextPast,
      future: [],
      params: nextParams,
      crop: nextCrop,
      activePresetId: null,
    });
  },

  setCrop: (patch, recordHistory = false) => {
    const state = get();
    const nextCrop = { ...state.crop, ...patch };
    if (recordHistory) {
      const snap: HistorySnapshot = {
        params: { ...state.params },
        crop: { ...state.crop },
        activePresetId: state.activePresetId,
      };
      const nextPast = [...state.past.slice(-49), snap];
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, {
          crop: nextCrop,
          past: nextPast,
          future: [],
        }),
        past: nextPast,
        future: [],
        crop: nextCrop,
      });
    } else {
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, { crop: nextCrop }),
        crop: nextCrop,
      });
    }
  },

  resetCrop: () => {
    const state = get();
    const snap: HistorySnapshot = {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = [...state.past.slice(-49), snap];
    const nextCrop = { ...DEFAULT_CROP };
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, {
        crop: nextCrop,
        past: nextPast,
        future: [],
      }),
      past: nextPast,
      future: [],
      crop: nextCrop,
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const prev = state.past[state.past.length - 1];
    const current: HistorySnapshot = {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = state.past.slice(0, -1);
    const nextFuture = [current, ...state.future];
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, {
        past: nextPast,
        future: nextFuture,
        params: prev.params,
        crop: prev.crop,
        activePresetId: prev.activePresetId,
      }),
      past: nextPast,
      future: nextFuture,
      params: prev.params,
      crop: prev.crop,
      activePresetId: prev.activePresetId,
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const current: HistorySnapshot = {
      params: { ...state.params },
      crop: { ...state.crop },
      activePresetId: state.activePresetId,
    };
    const nextPast = [...state.past, current];
    const nextFuture = state.future.slice(1);
    set({
      tabs: syncActiveTab(state.tabs, state.activeTabId, {
        past: nextPast,
        future: nextFuture,
        params: next.params,
        crop: next.crop,
        activePresetId: next.activePresetId,
      }),
      past: nextPast,
      future: nextFuture,
      params: next.params,
      crop: next.crop,
      activePresetId: next.activePresetId,
    });
  },

  setActiveParamKey: (key) => set({ activeParamKey: key }),

  stepActiveParam: (direction) => {
    const state = get();
    const meta = PARAM_META[state.activeParamKey];
    const nextVal = Number((state.params[state.activeParamKey] + direction * meta.step).toFixed(2));
    state.setParam(state.activeParamKey, nextVal, true);
  },

  setToolMode: (toolMode) => set({ toolMode }),
  setSplitView: (splitView) => set({ splitView }),
  setSplitPosition: (pos) => set({ splitPosition: Math.min(0.98, Math.max(0.02, pos)) }),
  setComparingOriginal: (isComparingOriginal) => set({ isComparingOriginal }),
  setShowClipping: (showClipping) => set({ showClipping }),
  setShowHistogram: (showHistogram) => set({ showHistogram }),
  setShowPhotoInfo: (showPhotoInfo) => set({ showPhotoInfo }),
  setPickingFocus: (isPickingFocus) => set({ isPickingFocus }),
  setShowDofOverlay: (showDofOverlay) => set({ showDofOverlay }),
  setDofPatch: (patch, recordHistory = false) => {
    const state = get();
    const nextParams = { ...state.params };
    if (patch.dofFocusX !== undefined) nextParams.dofFocusX = Math.min(100, Math.max(0, Math.round(patch.dofFocusX * 10) / 10));
    if (patch.dofFocusY !== undefined) nextParams.dofFocusY = Math.min(100, Math.max(0, Math.round(patch.dofFocusY * 10) / 10));
    if (patch.dofRadiusX !== undefined) nextParams.dofRadiusX = Math.min(80, Math.max(5, Math.round(patch.dofRadiusX * 10) / 10));
    if (patch.dofRadiusY !== undefined) nextParams.dofRadiusY = Math.min(80, Math.max(5, Math.round(patch.dofRadiusY * 10) / 10));
    if (patch.dofAngle !== undefined) {
      let a = Math.round(patch.dofAngle);
      while (a > 180) a -= 360;
      while (a < -180) a += 360;
      nextParams.dofAngle = a;
    }
    if (patch.dofFeather !== undefined) nextParams.dofFeather = Math.min(60, Math.max(5, Math.round(patch.dofFeather * 10) / 10));

    if (recordHistory) {
      const snap: HistorySnapshot = {
        params: { ...state.params },
        crop: { ...state.crop },
        activePresetId: state.activePresetId,
      };
      const nextPast = [...state.past.slice(-49), snap];
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, {
          params: nextParams,
          past: nextPast,
          future: [],
        }),
        past: nextPast,
        future: [],
        params: nextParams,
      });
    } else {
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, { params: nextParams }),
        params: nextParams,
      });
    }
  },
  setDofFocus: (x, y, recordHistory = false) => {
    const cx = Math.min(100, Math.max(0, Math.round(x * 10) / 10));
    const cy = Math.min(100, Math.max(0, Math.round(y * 10) / 10));
    const state = get();
    const nextParams = { ...state.params, dofFocusX: cx, dofFocusY: cy };
    if (recordHistory) {
      const snap: HistorySnapshot = {
        params: { ...state.params },
        crop: { ...state.crop },
        activePresetId: state.activePresetId,
      };
      const nextPast = [...state.past.slice(-49), snap];
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, {
          params: nextParams,
          past: nextPast,
          future: [],
        }),
        past: nextPast,
        future: [],
        params: nextParams,
      });
    } else {
      set({
        tabs: syncActiveTab(state.tabs, state.activeTabId, { params: nextParams }),
        params: nextParams,
      });
    }
  },
  setHistogram: (histogram) => set({ histogram }),
  setShowPanels: (showPanels) => set({ showPanels }),
  setProExpanded: (proExpanded) => set({ proExpanded }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setZoom: (zoom) => {
    const clamped = Math.min(8, Math.max(0.25, zoom));
    set((state) => ({
      tabs: syncActiveTab(state.tabs, state.activeTabId, { zoom: clamped }),
      zoom: clamped,
    }));
  },
  setPan: (pan) =>
    set((state) => ({
      tabs: syncActiveTab(state.tabs, state.activeTabId, { pan }),
      pan,
    })),
  setZoomAndPan: (zoom, pan) => {
    const clamped = Math.min(8, Math.max(0.25, zoom));
    set((state) => ({
      tabs: syncActiveTab(state.tabs, state.activeTabId, { zoom: clamped, pan }),
      zoom: clamped,
      pan,
    }));
  },
  resetView: () =>
    set((state) => ({
      tabs: syncActiveTab(state.tabs, state.activeTabId, { zoom: 1, pan: { x: 0, y: 0 } }),
      zoom: 1,
      pan: { x: 0, y: 0 },
    })),
}));
