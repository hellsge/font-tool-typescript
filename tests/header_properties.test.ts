/**
 * Property-based tests for font header serialization
 *
 * Feature: typescript-font-converter
 * Property 13: Binary Format 版本一致性
 * Property 15: File Flag 正确性
 *
 * Validates: Requirements 5.1, 5.4
 */

import * as fc from 'fast-check';
import { BitmapFontHeader, BitmapFontHeaderConfig } from '../src/bitmap-font-header';
import { VectorFontHeader, VectorFontHeaderConfig } from '../src/vector-font-header';
import { FileFlag, RenderMode, IndexMethod } from '../src/types';
import { VERSION } from '../src/constants';

/**
 * Arbitrary generator for valid font names
 */
const fontNameArbitrary = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !s.includes('\0') && s.trim().length > 0);

/**
 * Arbitrary generator for BitmapFontHeaderConfig
 */
/**
 * Arbitrary generator for V2 BitmapFontHeaderConfig (with typography metrics)
 */
const bitmapFontHeaderConfigArbitrary: fc.Arbitrary<BitmapFontHeaderConfig> = fc.record({
  fontName: fontNameArbitrary,
  size: fc.integer({ min: 1, max: 255 }),
  fontSize: fc.integer({ min: 1, max: 255 }),
  renderMode: fc.constantFrom(
    RenderMode.BIT_1,
    RenderMode.BIT_2,
    RenderMode.BIT_4,
    RenderMode.BIT_8
  ),
  bold: fc.boolean(),
  italic: fc.boolean(),
  indexMethod: fc.constantFrom(IndexMethod.ADDRESS, IndexMethod.OFFSET),
  crop: fc.boolean(),
  characterCount: fc.integer({ min: 1, max: 65536 }),
  ascender: fc.integer({ min: 1, max: 3000 }),
  descender: fc.integer({ min: -3000, max: -1 }),
  lineGap: fc.integer({ min: 0, max: 500 }),
  unitsPerEm: fc.integer({ min: 64, max: 4096 }),
});

/**
 * Arbitrary generator for VectorFontHeaderConfig
 */
const vectorFontHeaderConfigArbitrary: fc.Arbitrary<VectorFontHeaderConfig> = fc.record({
  fontName: fontNameArbitrary,
  fontSize: fc.integer({ min: 1, max: 255 }),
  renderMode: fc.integer({ min: 0, max: 255 }),
  bold: fc.boolean(),
  italic: fc.boolean(),
  indexMethod: fc.constantFrom(IndexMethod.ADDRESS, IndexMethod.OFFSET),
  ascent: fc.integer({ min: -32768, max: 32767 }),
  descent: fc.integer({ min: -32768, max: 32767 }),
  lineGap: fc.integer({ min: -32768, max: 32767 }),
  unitsPerEm: fc.integer({ min: 0, max: 65535 }),
  characterCount: fc.integer({ min: 1, max: 65536 }),
});

describe('Feature: typescript-font-converter, Property 13: Binary Format 版本一致性', () => {
  it('should always produce version from package.json for V2 bitmap font headers', () => {
    fc.assert(
      fc.property(bitmapFontHeaderConfigArbitrary, (config) => {
        const header = new BitmapFontHeader(config);
        const bytes = header.toBytes();

        // V2 writes version from package.json (3.0.0)
        expect(bytes[2]).toBe(VERSION.BITMAP.MAJOR);
        expect(bytes[3]).toBe(VERSION.BITMAP.MINOR);
        expect(bytes[4]).toBe(VERSION.BITMAP.REVISION);
        expect(bytes[5]).toBe(VERSION.BITMAP.BUILD);
      }),
      { numRuns: 100 }
    );
  });

  it('should always produce version 0.0.0 for vector font headers', () => {
    fc.assert(
      fc.property(vectorFontHeaderConfigArbitrary, (config) => {
        const header = new VectorFontHeader(config);
        const bytes = header.toBytes();

        // Version bytes are at offsets 2, 3, 4 (after length and fileFlag)
        const versionMajor = bytes[2];
        const versionMinor = bytes[3];
        const versionRevision = bytes[4];

        expect(versionMajor).toBe(VERSION.VECTOR.MAJOR);
        expect(versionMinor).toBe(VERSION.VECTOR.MINOR);
        expect(versionRevision).toBe(VERSION.VECTOR.REVISION);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: typescript-font-converter, Property 15: File Flag 正确性', () => {
  it('should always set file flag to 1 for bitmap fonts', () => {
    fc.assert(
      fc.property(bitmapFontHeaderConfigArbitrary, (config) => {
        const header = new BitmapFontHeader(config);
        const bytes = header.toBytes();

        // File flag is at offset 1 (after length byte)
        const fileFlag = bytes[1];

        expect(fileFlag).toBe(FileFlag.BITMAP);
        expect(header.fileFlag).toBe(FileFlag.BITMAP);
      }),
      { numRuns: 100 }
    );
  });

  it('should always set file flag to 2 for vector fonts', () => {
    fc.assert(
      fc.property(vectorFontHeaderConfigArbitrary, (config) => {
        const header = new VectorFontHeader(config);
        const bytes = header.toBytes();

        // File flag is at offset 1 (after length byte)
        const fileFlag = bytes[1];

        expect(fileFlag).toBe(FileFlag.VECTOR);
        expect(header.fileFlag).toBe(FileFlag.VECTOR);
      }),
      { numRuns: 100 }
    );
  });
});

describe('BitmapFontHeader serialization', () => {
  it('should correctly serialize and deserialize header (round-trip)', () => {
    fc.assert(
      fc.property(bitmapFontHeaderConfigArbitrary, (config) => {
        const original = new BitmapFontHeader(config);
        const bytes = original.toBytes();
        const parsed = BitmapFontHeader.fromBytes(bytes);

        // Verify key fields match
        expect(parsed.fontName).toBe(original.fontName);
        // V2: size is not serialized separately; fromBytes sets size = fontSize
        expect(parsed.size).toBe(original.fontSize);
        expect(parsed.fontSize).toBe(original.fontSize);
        expect(parsed.renderMode).toBe(original.renderMode);
        expect(parsed.bold).toBe(original.bold);
        expect(parsed.italic).toBe(original.italic);
        expect(parsed.indexMethod).toBe(original.indexMethod);
        // V2 forces crop=true
        expect(parsed.crop).toBe(true);
        // Note: indexAreaSize round-trip is lossy because fromBytes cannot recover characterCount
        // from binary data (crop mode sets characterCount=0). This is a known limitation.
      }),
      { numRuns: 100 }
    );
  });

  it('should produce correct header length', () => {
    fc.assert(
      fc.property(bitmapFontHeaderConfigArbitrary, (config) => {
        const header = new BitmapFontHeader(config);
        const bytes = header.toBytes();

        // Length byte should match actual buffer length
        const lengthByte = bytes[0];
        expect(bytes.length).toBe(header.length);
        expect(lengthByte).toBe(header.length);

        // Expected length: CONFIG_SIZE(12) + 2 (length + fontNameLength) + fontNameLength + 8 (V2 extension)
        // fontNameLength = fontName.length + 1 (null terminator)
        const fontNameLength = config.fontName.length + 1;
        const expectedLength = 12 + 2 + fontNameLength + 8;
        expect(header.length).toBe(expectedLength);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly pack bitfield', () => {
    fc.assert(
      fc.property(bitmapFontHeaderConfigArbitrary, (config) => {
        const header = new BitmapFontHeader(config);
        const bytes = header.toBytes();

        // Bitfield is at offset 8 (length(1) + fileFlag(1) + version(4) + fontSize(1) + renderMode(1))
        const bitfield = bytes[8];

        // Verify individual bits
        const boldBit = (bitfield & 0x01) !== 0;
        const italicBit = (bitfield & 0x02) !== 0;
        const indexMethodBit = (bitfield & 0x08) !== 0;
        const cropBit = (bitfield & 0x10) !== 0;

        expect(boldBit).toBe(config.bold);
        expect(italicBit).toBe(config.italic);
        expect(indexMethodBit).toBe(config.indexMethod === IndexMethod.OFFSET);
        // V2 forces crop=true
        expect(cropBit).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

describe('VectorFontHeader serialization', () => {
  it('should correctly serialize and deserialize header (round-trip)', () => {
    fc.assert(
      fc.property(vectorFontHeaderConfigArbitrary, (config) => {
        const original = new VectorFontHeader(config);
        const bytes = original.toBytes();
        const parsed = VectorFontHeader.fromBytes(bytes);

        // Verify key fields match
        expect(parsed.fontName).toBe(original.fontName);
        expect(parsed.fontSize).toBe(original.fontSize);
        expect(parsed.bold).toBe(original.bold);
        expect(parsed.italic).toBe(original.italic);
        expect(parsed.indexMethod).toBe(original.indexMethod);
        expect(parsed.ascent).toBe(original.ascent);
        expect(parsed.descent).toBe(original.descent);
        expect(parsed.lineGap).toBe(original.lineGap);
        expect(parsed.unitsPerEm).toBe(original.unitsPerEm);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce correct header length', () => {
    fc.assert(
      fc.property(vectorFontHeaderConfigArbitrary, (config) => {
        const header = new VectorFontHeader(config);
        const bytes = header.toBytes();

        // Length byte should match actual buffer length
        const lengthByte = bytes[0];
        expect(bytes.length).toBe(header.length);
        expect(lengthByte).toBe(header.length);

        // Expected length: 20 (fixed header) + fontNameLength + 2 (V3 units_per_em)
        // fontNameLength = fontName.length + 1 (null terminator)
        const fontNameLength = config.fontName.length + 1;
        const expectedLength = 20 + fontNameLength + 2;
        expect(header.length).toBe(expectedLength);
      }),
      { numRuns: 100 }
    );
  });
});
