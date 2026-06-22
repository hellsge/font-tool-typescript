/**
 * Unit tests for bitmap font header (V3) serialization and calculateStandardDimensions.
 *
 * Header is V3 (versionMajor >= 3): font_size is a uint16 LE at offsets 5-6.
 * The "V2" describe blocks below refer to BitmapFontHeader.isV2 — the typography
 * extension mode (ascender/descender/lineGap/unitsPerEm), introduced in V2 and
 * carried forward unchanged into V3 — not to the header version number.
 *
 * Covers:
 *   - calculateStandardDimensions (no backSize clamp)
 *   - isV2 typography extension round-trip
 *   - V1 (no-typography) backward compatibility
 */

import {
  BitmapFontHeader,
  BitmapFontHeaderConfig,
  calculateStandardDimensions,
} from '../src/bitmap-font-header';
import { RenderMode, IndexMethod, GlyphHeaderV2 } from '../src/types';
import { VERSION } from '../src/constants';

// --- Task 1.1: calculateStandardDimensions ---

describe('calculateStandardDimensions', () => {
  it('returns renderSize equal to fontSize (no scaling)', () => {
    const result = calculateStandardDimensions(32, 2048, 1900, -500);
    expect(result.renderSize).toBe(32);
  });

  it('calculates backSize = ceil(fontSize * (asc - desc) / upm)', () => {
    // 32 * (1900 - (-500)) / 2048 = 32 * 2400 / 2048 = 37.5 → ceil = 38
    const result = calculateStandardDimensions(32, 2048, 1900, -500);
    expect(result.backSize).toBe(38);
  });

  it('throws when fontSize <= 0', () => {
    expect(() => calculateStandardDimensions(0, 2048, 1900, -500)).toThrow();
    expect(() => calculateStandardDimensions(-1, 2048, 1900, -500)).toThrow();
  });

  it('does not clamp backSize (V3 supports font sizes > 255)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // fontSize=200, asc=2000, desc=-1000, upm=1000 → backSize = ceil(200*3000/1000) = 600
    const result = calculateStandardDimensions(200, 1000, 2000, -1000);
    expect(result.backSize).toBe(600);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('handles exact integer backSize without rounding up', () => {
    // fontSize=16, asc=800, desc=-200, upm=1000 → 16*1000/1000 = 16 exact
    const result = calculateStandardDimensions(16, 1000, 800, -200);
    expect(result.backSize).toBe(16);
  });
});

// --- Task 1.1: GlyphHeaderV2 type check ---

describe('GlyphHeaderV2 interface', () => {
  it('can be constructed with all required fields', () => {
    const header: GlyphHeaderV2 = {
      bearingX: -2,
      bearingY: 28,
      width: 18,
      height: 30,
      advance: 20,
      reserved: 0,
    };
    expect(header.bearingX).toBe(-2);
    expect(header.reserved).toBe(0);
  });
});

// --- Task 1.3: V2 header serialization ---

function makeV2Config(overrides?: Partial<BitmapFontHeaderConfig>): BitmapFontHeaderConfig {
  return {
    fontName: 'TestFont',
    size: 32,
    fontSize: 32,
    renderMode: RenderMode.BIT_4,
    bold: false,
    italic: false,
    indexMethod: IndexMethod.OFFSET,
    crop: false, // will be overridden to true by V2
    characterCount: 100,
    ascender: 1900,
    descender: -500,
    lineGap: 0,
    unitsPerEm: 2048,
    ...overrides,
  };
}

describe('BitmapFontHeader V2 constructor', () => {
  it('detects V2 mode when ascender, descender, unitsPerEm are provided', () => {
    const header = new BitmapFontHeader(makeV2Config());
    expect(header.isV2).toBe(true);
  });

  it('sets version from package.json in V2 mode', () => {
    const header = new BitmapFontHeader(makeV2Config());
    expect(header.versionMajor).toBe(VERSION.BITMAP.MAJOR);
    expect(header.versionMinor).toBe(VERSION.BITMAP.MINOR);
    expect(header.versionRevision).toBe(VERSION.BITMAP.REVISION);
    expect(header.versionBuildnum).toBe(VERSION.BITMAP.BUILD);
  });

  it('forces crop=true in V2 mode regardless of config', () => {
    const header = new BitmapFontHeader(makeV2Config({ crop: false }));
    expect(header.crop).toBe(true);
  });

  it('stores fontSize as em-size in V2', () => {
    const header = new BitmapFontHeader(makeV2Config({ fontSize: 48 }));
    expect(header.fontSize).toBe(48);
  });

  it('throws when ascender <= 0 in V2 mode', () => {
    expect(() => new BitmapFontHeader(makeV2Config({ ascender: 0 }))).toThrow();
    expect(() => new BitmapFontHeader(makeV2Config({ ascender: -100 }))).toThrow();
  });

  it('throws when descender >= 0 in V2 mode', () => {
    expect(() => new BitmapFontHeader(makeV2Config({ descender: 0 }))).toThrow();
    expect(() => new BitmapFontHeader(makeV2Config({ descender: 100 }))).toThrow();
  });

  it('includes 8-byte extension in header length', () => {
    const v2 = new BitmapFontHeader(makeV2Config());
    // V1 equivalent length (without V2 fields)
    const v1 = new BitmapFontHeader({
      ...makeV2Config(),
      ascender: undefined,
      descender: undefined,
      lineGap: undefined,
      unitsPerEm: undefined,
    });
    expect(v2.length).toBe(v1.length + 8);
  });
});

describe('BitmapFontHeader V2 toBytes/fromBytes round-trip', () => {
  it('serializes and deserializes V2 header with correct metrics', () => {
    const config = makeV2Config({
      ascender: 1900,
      descender: -500,
      lineGap: 87,
      unitsPerEm: 2048,
    });
    const original = new BitmapFontHeader(config);
    const bytes = original.toBytes();
    const parsed = BitmapFontHeader.fromBytes(bytes);

    expect(parsed.isV2).toBe(true);
    expect(parsed.versionMajor).toBe(VERSION.MAJOR);
    expect(parsed.versionMinor).toBe(VERSION.MINOR);
    expect(parsed.versionRevision).toBe(VERSION.REVISION);
    expect(parsed.versionBuildnum).toBe(VERSION.BUILD);
    expect(parsed.crop).toBe(true);
    expect(parsed.ascender).toBe(1900);
    expect(parsed.descender).toBe(-500);
    expect(parsed.lineGap).toBe(87);
    expect(parsed.unitsPerEm).toBe(2048);
    expect(parsed.fontName).toBe('TestFont');
    expect(parsed.fontSize).toBe(32);
  });

  it('length byte matches actual buffer length', () => {
    const header = new BitmapFontHeader(makeV2Config());
    const bytes = header.toBytes();
    expect(bytes[0]).toBe(bytes.length);
    expect(bytes[0]).toBe(header.length);
  });

  it('writes version (3 bytes, offsets 2-4) and font_size (uint16, offsets 5-6)', () => {
    const header = new BitmapFontHeader(makeV2Config());
    const bytes = header.toBytes();
    expect(bytes[2]).toBe(VERSION.MAJOR);
    expect(bytes[3]).toBe(VERSION.MINOR);
    expect(bytes[4]).toBe(VERSION.REVISION);
    // V3: the freed 4th version byte merges with font_size into a uint16 LE
    expect(bytes.readUInt16LE(5)).toBe(32);
  });

  it('writes crop bit = 1 in bitfield', () => {
    const header = new BitmapFontHeader(makeV2Config());
    const bytes = header.toBytes();
    // bitfield at offset 8: length(1)+fileFlag(1)+version(3)+fontSize(2)+renderMode(1)
    const bitfield = bytes[8];
    expect(bitfield & 0x10).toBe(0x10);
  });

  it('writes extension fields as little-endian after font_name', () => {
    const config = makeV2Config({
      fontName: 'AB',
      ascender: 0x0100, // 256
      descender: -256, // 0xFF00 as int16
      lineGap: 0,
      unitsPerEm: 2048,
    });
    const header = new BitmapFontHeader(config);
    const bytes = header.toBytes();

    // Extension starts after fontName null-terminated
    // CONFIG_SIZE(12) + 2(length+fontNameLength) + fontNameLength(3='AB\0')
    const extOffset = 12 + 2 + 3;
    expect(bytes.readInt16LE(extOffset)).toBe(256); // ascender
    expect(bytes.readInt16LE(extOffset + 2)).toBe(-256); // descender
    expect(bytes.readInt16LE(extOffset + 4)).toBe(0); // lineGap
    expect(bytes.readUInt16LE(extOffset + 6)).toBe(2048); // unitsPerEm
  });
});

describe('BitmapFontHeader V1 backward compatibility', () => {
  it('creates V1 header when typography fields are absent', () => {
    const header = new BitmapFontHeader({
      fontName: 'Test',
      size: 16,
      fontSize: 16,
      renderMode: RenderMode.BIT_4,
      bold: false,
      italic: false,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterCount: 100,
    });
    expect(header.isV2).toBe(false);
    expect(header.ascender).toBeUndefined();
  });

  it('V1 round-trip still works', () => {
    const config: BitmapFontHeaderConfig = {
      fontName: 'Legacy',
      size: 24,
      fontSize: 24,
      renderMode: RenderMode.BIT_8,
      bold: true,
      italic: false,
      indexMethod: IndexMethod.ADDRESS,
      crop: true,
      characterCount: 50,
    };
    const original = new BitmapFontHeader(config);
    const bytes = original.toBytes();
    const parsed = BitmapFontHeader.fromBytes(bytes);

    expect(parsed.isV2).toBe(false);
    expect(parsed.fontName).toBe('Legacy');
    expect(parsed.bold).toBe(true);
    expect(parsed.crop).toBe(true);
    expect(parsed.fontSize).toBe(24);
  });
});
