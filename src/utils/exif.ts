import { ExifData } from '../types/editor';

/**
 * Lightweight client-side EXIF parser for JPEG files.
 * Extracts camera make, model, aperture, shutter speed, ISO, and capture timestamp.
 */
export async function parseExifFromFile(file: File): Promise<ExifData> {
  const result: ExifData = {};
  if (!file.type.includes('jpeg') && !file.name.toLowerCase().match(/\.jpe?g$/)) {
    return result;
  }

  try {
    const buffer = await file.slice(0, 131072).arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return result;
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        // APP1 EXIF
        const length = view.getUint16(offset, false);
        const exifHeader = getAscii(view, offset + 2, 4);
        if (exifHeader === 'Exif') {
          parseTiff(view, offset + 8, result);
        }
        offset += length;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        if (offset + 2 > view.byteLength) break;
        const size = view.getUint16(offset, false);
        offset += size;
      }
    }
  } catch {
    // Gracefully return partial or empty EXIF
  }

  return result;
}

function getAscii(view: DataView, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && start + i < view.byteLength; i++) {
    const code = view.getUint8(start + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function parseTiff(view: DataView, tiffStart: number, out: ExifData): void {
  if (tiffStart + 8 > view.byteLength) return;
  const endian = view.getUint16(tiffStart, false);
  const little = endian === 0x4949;
  if (!little && endian !== 0x4d4d) return;

  const ifd0Offset = view.getUint32(tiffStart + 4, little);
  let exifIfdOffset = 0;

  readIfd(view, tiffStart + ifd0Offset, little, (tag, type, count, valueOffset) => {
    if (tag === 0x010f) out.make = readStringTag(view, tiffStart, count, valueOffset);
    if (tag === 0x0110) out.model = readStringTag(view, tiffStart, count, valueOffset);
    if (tag === 0x8769 && type === 4) {
      exifIfdOffset = view.getUint32(valueOffset, little);
    }
  });

  if (exifIfdOffset > 0) {
    readIfd(view, tiffStart + exifIfdOffset, little, (tag, type, count, valueOffset) => {
      if (tag === 0x9003) out.dateTime = readStringTag(view, tiffStart, count, valueOffset);
      if (tag === 0xa434) out.lens = readStringTag(view, tiffStart, count, valueOffset);
      if (tag === 0x829d && type === 5) {
        const val = readRational(view, tiffStart, valueOffset, little);
        if (val > 0) out.fNumber = `f/${val.toFixed(1).replace(/\.0$/, '')}`;
      }
      if (tag === 0x829a && type === 5) {
        const val = readRational(view, tiffStart, valueOffset, little);
        if (val > 0) {
          out.exposureTime = val >= 1 ? `${val.toFixed(1)}s` : `1/${Math.round(1 / val)}s`;
        }
      }
      if (tag === 0x8827 && type === 3) {
        const iso = count === 1 ? view.getUint16(valueOffset, little) : view.getUint16(tiffStart + view.getUint32(valueOffset, little), little);
        if (iso > 0) out.iso = `ISO ${iso}`;
      }
    });
  }
}

function readIfd(
  view: DataView,
  ifdStart: number,
  little: boolean,
  onEntry: (tag: number, type: number, count: number, valueOffset: number) => void
): void {
  if (ifdStart + 2 > view.byteLength) return;
  const entries = view.getUint16(ifdStart, little);
  for (let i = 0; i < entries; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, little);
    const type = view.getUint16(entryOffset + 2, little);
    const count = view.getUint32(entryOffset + 4, little);
    onEntry(tag, type, count, entryOffset + 8);
  }
}

function readStringTag(view: DataView, tiffStart: number, count: number, valueOffset: number): string {
  if (count <= 4) {
    return getAscii(view, valueOffset, count);
  }
  const ptr = view.getUint32(valueOffset, false); // fallback handled below if needed
  const safePtr = tiffStart + ptr < view.byteLength ? tiffStart + ptr : valueOffset;
  return getAscii(view, safePtr, Math.min(count, 64));
}

function readRational(view: DataView, tiffStart: number, valueOffset: number, little: boolean): number {
  const ptr = tiffStart + view.getUint32(valueOffset, little);
  if (ptr + 8 > view.byteLength) return 0;
  const num = view.getUint32(ptr, little);
  const den = view.getUint32(ptr + 4, little);
  return den === 0 ? 0 : num / den;
}
