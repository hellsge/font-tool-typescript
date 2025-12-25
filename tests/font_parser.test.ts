/**
 * Unit tests for FontParser class
 * 
 * Tests TrueType font loading and error handling
 * Requirements: 6.1, 6.2, 6.6
 */

import * as path from 'path';
import * as fs from 'fs';
import { FontParser, loadFont, extractFontMetrics } from '../src/font-parser';
import { ErrorCode, FontConverterError } from '../src/errors';

// Path to test fonts (using fonts from font-tool-release)
const TEST_FONT_DIR = path.resolve(__dirname, '../../font-tool-release/Font');
const NOTO_SANS_PATH = path.join(TEST_FONT_DIR, 'NotoSans_Regular.ttf');
const NOTO_SANS_SC_PATH = path.join(TEST_FONT_DIR, 'NotoSansSC_Regular.ttf');

describe('FontParser', () => {
  describe('Valid font loading', () => {
    it('should load a valid .ttf font file', async () => {
      const parser = new FontParser();
      const result = await parser.load(NOTO_SANS_PATH);

      expect(result).toBeDefined();
      expect(result.familyName).toBeTruthy();
      expect(result.metrics).toBeDefined();
      expect(result.opentypeFont).toBeDefined();
    });

    it('should extract correct font metrics', async () => {
      const parser = new FontParser();
      const result = await parser.load(NOTO_SANS_PATH);

      expect(result.metrics.ascent).toBeGreaterThan(0);
      expect(result.metrics.descent).toBeLessThan(0); // Descent is typically negative
      expect(result.metrics.unitsPerEm).toBeGreaterThan(0);
      expect(typeof result.metrics.lineGap).toBe('number');
    });

    it('should report font as loaded after successful load', async () => {
      const parser = new FontParser();
      expect(parser.isLoaded()).toBe(false);

      await parser.load(NOTO_SANS_PATH);
      expect(parser.isLoaded()).toBe(true);
    });

    it('should return correct glyph count', async () => {
      const parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);

      const count = parser.getGlyphCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should return font family name', async () => {
      const parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);

      const familyName = parser.getFamilyName();
      expect(familyName).toBeTruthy();
      expect(typeof familyName).toBe('string');
    });

    it('should return font path after loading', async () => {
      const parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);

      const fontPath = parser.getFontPath();
      expect(fontPath).toContain('NotoSans_Regular.ttf');
    });

    it('should load font with relative path', async () => {
      const parser = new FontParser();
      // Use relative path from current working directory
      const relativePath = path.relative(process.cwd(), NOTO_SANS_PATH);
      const result = await parser.load(relativePath);

      expect(result).toBeDefined();
      expect(result.familyName).toBeTruthy();
    });
  });

  describe('Invalid file error handling', () => {
    it('should throw FONT_FILE_NOT_FOUND for non-existent file', async () => {
      const parser = new FontParser();

      await expect(parser.load('/non/existent/font.ttf')).rejects.toThrow(FontConverterError);
      
      try {
        await parser.load('/non/existent/font.ttf');
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.FONT_FILE_NOT_FOUND);
      }
    });

    it('should throw FONT_PARSE_ERROR for invalid font file', async () => {
      const parser = new FontParser();
      // Try to load a non-font file (e.g., package.json)
      const invalidPath = path.resolve(__dirname, '../package.json');

      await expect(parser.load(invalidPath)).rejects.toThrow(FontConverterError);
      
      try {
        await parser.load(invalidPath);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.FONT_PARSE_ERROR);
      }
    });

    it('should include file path in error context', async () => {
      const parser = new FontParser();
      const nonExistentPath = '/path/to/missing/font.ttf';

      try {
        await parser.load(nonExistentPath);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        const fcError = error as FontConverterError;
        expect(fcError.context?.filePath).toBe(nonExistentPath);
      }
    });
  });

  describe('Glyph operations', () => {
    let parser: FontParser;

    beforeAll(async () => {
      parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);
    });

    afterAll(() => {
      parser.unload();
    });

    it('should check if glyph exists for ASCII characters', () => {
      // ASCII 'A' should exist
      expect(parser.hasGlyph(0x0041)).toBe(true);
      // ASCII space should exist
      expect(parser.hasGlyph(0x0020)).toBe(true);
    });

    it('should return false for non-existent glyphs', () => {
      // Private use area character unlikely to exist
      expect(parser.hasGlyph(0xE000)).toBe(false);
    });

    it('should get glyph outline for existing character', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      expect(outline!.unicode).toBe(0x0041);
      expect(outline!.advanceWidth).toBeGreaterThan(0);
      expect(outline!.boundingBox).toBeDefined();
      expect(outline!.contours).toBeDefined();
      expect(outline!.contours.length).toBeGreaterThan(0);
    });

    it('should return null for non-existent glyph', () => {
      const outline = parser.getGlyphOutline(0xE000);
      expect(outline).toBeNull();
    });

    it('should extract valid bounding box', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      const bbox = outline!.boundingBox;
      expect(bbox.x2).toBeGreaterThanOrEqual(bbox.x1);
      expect(bbox.y2).toBeGreaterThanOrEqual(bbox.y1);
    });

    it('should extract contour points', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      expect(outline!.contours.length).toBeGreaterThan(0);

      // Each contour should have points
      for (const contour of outline!.contours) {
        expect(contour.length).toBeGreaterThan(0);
        // Each point should have x, y, and onCurve
        for (const point of contour) {
          expect(typeof point.x).toBe('number');
          expect(typeof point.y).toBe('number');
          expect(typeof point.onCurve).toBe('boolean');
        }
      }
    });
  });

  describe('Resource management', () => {
    it('should unload font and free resources', async () => {
      const parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);
      expect(parser.isLoaded()).toBe(true);

      parser.unload();
      expect(parser.isLoaded()).toBe(false);
      expect(parser.getFontPath()).toBe('');
      expect(parser.getOpentypeFont()).toBeNull();
    });

    it('should allow reloading after unload', async () => {
      const parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);
      parser.unload();

      // Should be able to load again
      const result = await parser.load(NOTO_SANS_SC_PATH);
      expect(result).toBeDefined();
      expect(parser.isLoaded()).toBe(true);
    });
  });

  describe('Convenience functions', () => {
    it('loadFont should return parsed font data', async () => {
      const result = await loadFont(NOTO_SANS_PATH);

      expect(result).toBeDefined();
      expect(result.familyName).toBeTruthy();
      expect(result.metrics).toBeDefined();
    });

    it('extractFontMetrics should return metrics only', async () => {
      const metrics = await extractFontMetrics(NOTO_SANS_PATH);

      expect(metrics).toBeDefined();
      expect(metrics.ascent).toBeGreaterThan(0);
      expect(metrics.descent).toBeLessThan(0);
      expect(metrics.unitsPerEm).toBeGreaterThan(0);
    });
  });

  describe('Error handling for unloaded font', () => {
    it('should throw error when extracting metrics without loading', () => {
      const parser = new FontParser();

      expect(() => parser.extractMetrics()).toThrow(FontConverterError);
    });

    it('should throw error when getting glyph outline without loading', () => {
      const parser = new FontParser();

      expect(() => parser.getGlyphOutline(0x0041)).toThrow(FontConverterError);
    });

    it('should return false for hasGlyph without loading', () => {
      const parser = new FontParser();
      expect(parser.hasGlyph(0x0041)).toBe(false);
    });

    it('should return 0 for getGlyphCount without loading', () => {
      const parser = new FontParser();
      expect(parser.getGlyphCount()).toBe(0);
    });

    it('should return empty string for getFamilyName without loading', () => {
      const parser = new FontParser();
      expect(parser.getFamilyName()).toBe('');
    });
  });

  describe('TrueType Collection (.ttc) support', () => {
    it('should detect non-TTC files correctly', () => {
      const isTTC = FontParser.isTrueTypeCollectionFile(NOTO_SANS_PATH);
      expect(isTTC).toBe(false);
    });

    it('should return 1 for font count in non-TTC files', () => {
      const count = FontParser.getFontCountInCollection(NOTO_SANS_PATH);
      expect(count).toBe(1);
    });

    it('should throw error for non-existent file in getFontCountInCollection', () => {
      expect(() => {
        FontParser.getFontCountInCollection('/non/existent/font.ttc');
      }).toThrow(FontConverterError);
    });

    it('should return false for non-existent file in isTrueTypeCollectionFile', () => {
      const isTTC = FontParser.isTrueTypeCollectionFile('/non/existent/font.ttc');
      expect(isTTC).toBe(false);
    });

    // Note: TTC-specific tests would require actual .ttc files
    // The following tests verify the error handling for invalid indices
    it('should load TTF file with fontIndex 0', async () => {
      const parser = new FontParser();
      const result = await parser.load(NOTO_SANS_PATH, 0);
      expect(result).toBeDefined();
    });
  });

  describe('Glyph outline extraction (for vector fonts)', () => {
    let parser: FontParser;

    beforeAll(async () => {
      parser = new FontParser();
      await parser.load(NOTO_SANS_PATH);
    });

    afterAll(() => {
      parser.unload();
    });

    it('should extract complete glyph outline with all required fields', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      
      // Check all required fields exist
      expect(outline!.unicode).toBeDefined();
      expect(outline!.boundingBox).toBeDefined();
      expect(outline!.advanceWidth).toBeDefined();
      expect(outline!.contours).toBeDefined();
    });

    it('should extract correct bounding box coordinates', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      const bbox = outline!.boundingBox;

      // Bounding box should have all four coordinates
      expect(typeof bbox.x1).toBe('number');
      expect(typeof bbox.y1).toBe('number');
      expect(typeof bbox.x2).toBe('number');
      expect(typeof bbox.y2).toBe('number');

      // x2 should be >= x1, y2 should be >= y1
      expect(bbox.x2).toBeGreaterThanOrEqual(bbox.x1);
      expect(bbox.y2).toBeGreaterThanOrEqual(bbox.y1);
    });

    it('should extract positive advance width', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      expect(outline!.advanceWidth).toBeGreaterThan(0);
    });

    it('should extract contours with valid points', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      expect(outline!.contours.length).toBeGreaterThan(0);

      // 'A' typically has 2 contours (outer and inner for the hole)
      for (const contour of outline!.contours) {
        expect(contour.length).toBeGreaterThan(0);

        for (const point of contour) {
          expect(typeof point.x).toBe('number');
          expect(typeof point.y).toBe('number');
          expect(typeof point.onCurve).toBe('boolean');
          
          // Coordinates should be integers (rounded)
          expect(Number.isInteger(point.x)).toBe(true);
          expect(Number.isInteger(point.y)).toBe(true);
        }
      }
    });

    it('should extract different outlines for different characters', () => {
      const outlineA = parser.getGlyphOutline(0x0041); // 'A'
      const outlineB = parser.getGlyphOutline(0x0042); // 'B'

      expect(outlineA).not.toBeNull();
      expect(outlineB).not.toBeNull();

      // Different characters should have different advance widths or contours
      const aContourCount = outlineA!.contours.length;
      const bContourCount = outlineB!.contours.length;
      const aAdvance = outlineA!.advanceWidth;
      const bAdvance = outlineB!.advanceWidth;

      // At least one property should differ
      const isDifferent = 
        aContourCount !== bContourCount || 
        aAdvance !== bAdvance ||
        JSON.stringify(outlineA!.boundingBox) !== JSON.stringify(outlineB!.boundingBox);
      
      expect(isDifferent).toBe(true);
    });

    it('should handle space character (may have no contours)', () => {
      const outline = parser.getGlyphOutline(0x0020); // space

      // Space might exist but have no contours, or might not exist
      if (outline !== null) {
        expect(outline.unicode).toBe(0x0020);
        expect(outline.advanceWidth).toBeGreaterThan(0);
        // Space typically has no contours
        expect(outline.contours.length).toBe(0);
      }
    });

    it('should extract outlines for various character types', () => {
      // Test different character types
      const testChars = [
        { unicode: 0x0030, name: 'digit 0' },
        { unicode: 0x0061, name: 'lowercase a' },
        { unicode: 0x002E, name: 'period' },
      ];

      for (const { unicode, name } of testChars) {
        const outline = parser.getGlyphOutline(unicode);
        
        if (outline !== null) {
          expect(outline.unicode).toBe(unicode);
          expect(outline.advanceWidth).toBeGreaterThanOrEqual(0);
          expect(outline.boundingBox).toBeDefined();
        }
      }
    });

    it('should have contour points within bounding box', () => {
      const outline = parser.getGlyphOutline(0x0041); // 'A'

      expect(outline).not.toBeNull();
      const bbox = outline!.boundingBox;

      for (const contour of outline!.contours) {
        for (const point of contour) {
          // Points should be within or on the bounding box
          // Allow small tolerance for rounding
          expect(point.x).toBeGreaterThanOrEqual(bbox.x1 - 1);
          expect(point.x).toBeLessThanOrEqual(bbox.x2 + 1);
          expect(point.y).toBeGreaterThanOrEqual(bbox.y1 - 1);
          expect(point.y).toBeLessThanOrEqual(bbox.y2 + 1);
        }
      }
    });

    it('should mark on-curve and off-curve points correctly', () => {
      const outline = parser.getGlyphOutline(0x004F); // 'O' - typically has curves

      expect(outline).not.toBeNull();

      let hasOnCurve = false;
      let hasOffCurve = false;

      for (const contour of outline!.contours) {
        for (const point of contour) {
          if (point.onCurve) hasOnCurve = true;
          else hasOffCurve = true;
        }
      }

      // Most glyphs should have both on-curve and off-curve points
      expect(hasOnCurve).toBe(true);
      // 'O' should have curves, so off-curve points
      expect(hasOffCurve).toBe(true);
    });
  });
});
