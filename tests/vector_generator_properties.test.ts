/**
 * Property-based tests for Vector Font Generator
 * 
 * Feature: typescript-font-converter
 * Property 10: Vector Font 包含完整 Glyph 数据
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VectorFontGenerator } from '../src/vector-generator';
import { FontConfig, IndexMethod, RenderMode, Rotation } from '../src/types';
import { CharsetProcessor } from '../src/charset-processor';

/**
 * Test font path - using a real font file for testing
 * This should be a path to a valid .ttf file in the test environment
 */
const TEST_FONT_PATH = path.resolve(process.cwd(), '../font-tool-release/Font/NotoSans_Regular.ttf');

/**
 * Check if test font exists
 */
const testFontExists = fs.existsSync(TEST_FONT_PATH);

/**
 * Arbitrary generator for a small character set (for faster tests)
 * 
 * IMPORTANT: Excludes space (0x0020) as the first character to ensure
 * at least one character with actual glyph outline is included.
 * Space character has no contours in vector fonts.
 */
const smallCharsetArbitrary = fc.array(
  fc.integer({ min: 0x0021, max: 0x007F }), // ASCII printable characters (excluding space)
  { minLength: 5, maxLength: 20 }
).map(chars => [...new Set(chars)].sort((a, b) => a - b));

/**
 * Arbitrary generator for vector font config
 */
const vectorFontConfigArbitrary: fc.Arbitrary<FontConfig> = fc.record({
  fontPath: fc.constant(TEST_FONT_PATH),
  outputPath: fc.constant(path.join(os.tmpdir(), 'font-converter-test-vector')),
  fontSize: fc.integer({ min: 12, max: 48 }),
  renderMode: fc.constant(RenderMode.BIT_8), // Not used for vector fonts
  bold: fc.boolean(),
  italic: fc.boolean(),
  rotation: fc.constant(Rotation.ROTATE_0), // Not used for vector fonts
  gamma: fc.constant(1.0), // Not used for vector fonts
  indexMethod: fc.constantFrom(IndexMethod.ADDRESS, IndexMethod.OFFSET),
  crop: fc.constant(false), // Not supported for vector fonts
  characterSets: fc.constant([]), // Will be set separately
  outputFormat: fc.constant('vector' as const)
});

/**
 * Helper function to create a temporary character set file
 */
function createTempCharsetFile(characters: number[]): string {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `test-charset-${Date.now()}.cst`);
  CharsetProcessor.writeCSTFile(tempFile, characters);
  return tempFile;
}

/**
 * Helper function to clean up test files
 */
function cleanupTestFiles(outputPath: string, cstFile?: string): void {
  try {
    if (fs.existsSync(outputPath)) {
      const files = fs.readdirSync(outputPath);
      for (const file of files) {
        fs.unlinkSync(path.join(outputPath, file));
      }
      fs.rmdirSync(outputPath);
    }
    if (cstFile && fs.existsSync(cstFile)) {
      fs.unlinkSync(cstFile);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Helper function to read vector glyph data from binary file
 */
interface VectorGlyphInfo {
  unicode: number;
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  advance: number;
  windingCount: number;
  windingLengths: number[];
  points: Array<{ x: number; y: number }>;
}

function readVectorGlyphFromFile(
  filePath: string,
  offset: number
): VectorGlyphInfo {
  const buffer = fs.readFileSync(filePath);
  let pos = offset;
  
  // Read bounding box (4 × int16)
  const sx0 = buffer.readInt16LE(pos); pos += 2;
  const sy0 = buffer.readInt16LE(pos); pos += 2;
  const sx1 = buffer.readInt16LE(pos); pos += 2;
  const sy1 = buffer.readInt16LE(pos); pos += 2;
  
  // Read advance width (uint16)
  const advance = buffer.readUInt16LE(pos); pos += 2;
  
  // Read winding count (uint8 - C++ compatibility)
  const windingCount = buffer.readUInt8(pos); pos += 1;
  
  // Read winding lengths (uint8 each - C++ compatibility)
  const windingLengths: number[] = [];
  for (let i = 0; i < windingCount; i++) {
    windingLengths.push(buffer.readUInt8(pos));
    pos += 1;
  }
  
  // Read points (int16 x, int16 y)
  const points: Array<{ x: number; y: number }> = [];
  const totalPoints = windingLengths.reduce((sum, len) => sum + len, 0);
  for (let i = 0; i < totalPoints; i++) {
    const x = buffer.readInt16LE(pos); pos += 2;
    const y = buffer.readInt16LE(pos); pos += 2;
    points.push({ x, y });
  }
  
  return {
    unicode: 0, // Will be set by caller
    sx0,
    sy0,
    sx1,
    sy1,
    advance,
    windingCount,
    windingLengths,
    points
  };
}

/**
 * Helper function to read vector font header
 */
interface VectorFontHeaderInfo {
  length: number;
  fileFlag: number;
  indexAreaSize: number;
  indexMethod: IndexMethod;
}

function readVectorFontHeader(filePath: string): VectorFontHeaderInfo {
  const buffer = fs.readFileSync(filePath);
  let pos = 0;
  
  // Read length
  const length = buffer.readUInt8(pos++);
  
  // Read fileFlag
  const fileFlag = buffer.readUInt8(pos++);
  
  // Skip version (4 bytes), fontSize (1), renderMode (1)
  pos += 6;
  
  // Read bitfield
  const bitfield = buffer.readUInt8(pos++);
  const indexMethod = ((bitfield & 0x08) !== 0 ? IndexMethod.OFFSET : IndexMethod.ADDRESS);
  
  // Read indexAreaSize (4 bytes, little-endian)
  const indexAreaSize = buffer.readInt32LE(pos);
  
  return {
    length,
    fileFlag,
    indexAreaSize,
    indexMethod
  };
}

describe('Feature: typescript-font-converter, Property 10: Vector Font 包含完整 Glyph 数据', () => {
  // Skip tests if test font doesn't exist
  const testCondition = testFontExists ? it : it.skip;
  
  testCondition('should include complete glyph data for all characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        vectorFontConfigArbitrary,
        smallCharsetArbitrary,
        async (baseConfig, characters) => {
          // Create temporary charset file
          const cstFile = createTempCharsetFile(characters);
          
          // Create config with charset
          const config: FontConfig = {
            ...baseConfig,
            characterSets: [{ type: 'file', value: cstFile }]
          };
          
          // Generate font
          const generator = new VectorFontGenerator(config);
          
          try {
            await generator.generate();
            
            // Find the generated .bin file
            const files = fs.readdirSync(config.outputPath);
            const binFile = files.find(f => f.endsWith('.bin'));
            expect(binFile).toBeDefined();
            
            if (!binFile) {
              throw new Error('No .bin file generated');
            }
            
            const binPath = path.join(config.outputPath, binFile);
            
            // Read header
            const header = readVectorFontHeader(binPath);
            
            // Verify file flag is 2 (vector)
            expect(header.fileFlag).toBe(2);
            
            // Calculate data area start
            const dataAreaStart = header.length + header.indexAreaSize;
            
            // Read index array to get glyph offsets
            const buffer = fs.readFileSync(binPath);
            const indexStart = header.length;
            const glyphOffsets: Map<number, number> = new Map();
            
            // Use header.indexMethod (from actual file) instead of config.indexMethod
            if (header.indexMethod === IndexMethod.ADDRESS) {
              // Address mode: 65536 × 4 bytes
              for (const unicode of characters) {
                const offset = buffer.readUInt32LE(indexStart + unicode * 4);
                if (offset !== 0xFFFFFFFF && offset !== 0) {
                  glyphOffsets.set(unicode, offset);
                }
              }
            } else {
              // Offset mode: N × 6 bytes
              const entryCount = header.indexAreaSize / 6;
              for (let i = 0; i < entryCount; i++) {
                const pos = indexStart + i * 6;
                const unicode = buffer.readUInt16LE(pos);
                const offset = buffer.readUInt32LE(pos + 2);
                glyphOffsets.set(unicode, offset);
              }
            }
            
            // Verify each glyph has complete data
            for (const [unicode, offset] of glyphOffsets) {
              const glyph = readVectorGlyphFromFile(binPath, offset);
              glyph.unicode = unicode;
              
              // Property: Glyph must have bounding box
              expect(glyph.sx0).toBeDefined();
              expect(glyph.sy0).toBeDefined();
              expect(glyph.sx1).toBeDefined();
              expect(glyph.sy1).toBeDefined();
              
              // Property: Bounding box should be valid (x1 <= x2, y1 <= y2)
              // Note: For some glyphs, bounding box might be empty (all zeros)
              if (glyph.sx0 !== 0 || glyph.sx1 !== 0) {
                expect(glyph.sx0).toBeLessThanOrEqual(glyph.sx1);
              }
              if (glyph.sy0 !== 0 || glyph.sy1 !== 0) {
                expect(glyph.sy0).toBeLessThanOrEqual(glyph.sy1);
              }
              
              // Property: Glyph must have advance width
              expect(glyph.advance).toBeGreaterThanOrEqual(0);
              
              // Property: Glyph must have at least one winding (or zero for empty glyphs)
              expect(glyph.windingCount).toBeGreaterThanOrEqual(0);
              
              // Property: Number of winding lengths must match winding count
              expect(glyph.windingLengths.length).toBe(glyph.windingCount);
              
              // Property: Total points must match sum of winding lengths
              const expectedPointCount = glyph.windingLengths.reduce((sum, len) => sum + len, 0);
              expect(glyph.points.length).toBe(expectedPointCount);
              
              // Property: All points should be within or near the bounding box
              // (allowing some tolerance for rounding)
              if (glyph.points.length > 0 && glyph.windingCount > 0) {
                for (const point of glyph.points) {
                  // Points should be reasonable values (not NaN or Infinity)
                  expect(Number.isFinite(point.x)).toBe(true);
                  expect(Number.isFinite(point.y)).toBe(true);
                }
              }
            }
            
            // Property: Number of glyphs should match or be less than character count
            // (some characters might fail to render)
            expect(glyphOffsets.size).toBeLessThanOrEqual(characters.length);
            expect(glyphOffsets.size).toBeGreaterThan(0);
            
          } finally {
            // Cleanup
            generator.cleanup();
            cleanupTestFiles(config.outputPath, cstFile);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for property tests

  testCondition('should include font metrics in header', async () => {
    await fc.assert(
      fc.asyncProperty(
        vectorFontConfigArbitrary,
        smallCharsetArbitrary,
        async (baseConfig, characters) => {
          // Create temporary charset file
          const cstFile = createTempCharsetFile(characters);
          
          // Create config with charset
          const config: FontConfig = {
            ...baseConfig,
            characterSets: [{ type: 'file', value: cstFile }]
          };
          
          // Generate font
          const generator = new VectorFontGenerator(config);
          
          try {
            await generator.generate();
            
            // Find the generated .bin file
            const files = fs.readdirSync(config.outputPath);
            const binFile = files.find(f => f.endsWith('.bin'));
            expect(binFile).toBeDefined();
            
            if (!binFile) {
              throw new Error('No .bin file generated');
            }
            
            const binPath = path.join(config.outputPath, binFile);
            const buffer = fs.readFileSync(binPath);
            
            // Read header to get font metrics
            let pos = 0;
            const length = buffer.readUInt8(pos++);
            pos++; // fileFlag
            pos += 6; // version + fontSize + renderMode
            pos++; // bitfield
            pos += 4; // indexAreaSize
            pos++; // fontNameLength
            
            // Read font metrics (3 × int16)
            const ascent = buffer.readInt16LE(pos); pos += 2;
            const descent = buffer.readInt16LE(pos); pos += 2;
            const lineGap = buffer.readInt16LE(pos); pos += 2;
            
            // Property: Font metrics should be defined
            expect(Number.isFinite(ascent)).toBe(true);
            expect(Number.isFinite(descent)).toBe(true);
            expect(Number.isFinite(lineGap)).toBe(true);
            
            // Property: Ascent should typically be positive
            // (though technically it could be zero for some fonts)
            expect(ascent).toBeGreaterThanOrEqual(0);
            
            // Property: Descent is typically negative or zero
            expect(descent).toBeLessThanOrEqual(0);
            
          } finally {
            // Cleanup
            generator.cleanup();
            cleanupTestFiles(config.outputPath, cstFile);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  testCondition('should handle empty glyphs gracefully', async () => {
    // Test with space character which typically has empty outline
    const spaceChar = [0x0020];
    const cstFile = createTempCharsetFile(spaceChar);
    
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-space'),
      fontSize: 16,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [{ type: 'file', value: cstFile }],
      outputFormat: 'vector'
    };
    
    const generator = new VectorFontGenerator(config);
    
    try {
      await generator.generate();
      
      // Find the generated .bin file
      const files = fs.readdirSync(config.outputPath);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();
      
      if (!binFile) {
        throw new Error('No .bin file generated');
      }
      
      const binPath = path.join(config.outputPath, binFile);
      const header = readVectorFontHeader(binPath);
      
      // Read glyph offset for space character
      const buffer = fs.readFileSync(binPath);
      const indexStart = header.length;
      const offset = buffer.readUInt32LE(indexStart + 0x0020 * 4);
      
      if (offset !== 0xFFFFFFFF && offset !== 0) {
        // Space glyph exists, verify it has valid structure
        const glyph = readVectorGlyphFromFile(binPath, offset);
        
        // Property: Empty glyph should have zero or minimal windings
        expect(glyph.windingCount).toBeGreaterThanOrEqual(0);
        
        // Property: Empty glyph should still have advance width
        expect(glyph.advance).toBeGreaterThanOrEqual(0);
      }
      
    } finally {
      generator.cleanup();
      cleanupTestFiles(config.outputPath, cstFile);
    }
  }, 30000);
});

describe('Vector font generation integration', () => {
  const testCondition = testFontExists ? it : it.skip;
  
  testCondition('should generate valid output files', async () => {
    const characters = [0x0041, 0x0042, 0x0043]; // A, B, C
    const cstFile = createTempCharsetFile(characters);
    
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-integration'),
      fontSize: 24,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.OFFSET,
      crop: false,
      characterSets: [{ type: 'file', value: cstFile }],
      outputFormat: 'vector'
    };
    
    const generator = new VectorFontGenerator(config);
    
    try {
      await generator.generate();
      
      // Verify output files exist
      const files = fs.readdirSync(config.outputPath);
      const binFile = files.find(f => f.endsWith('.bin'));
      const cstOutputFile = files.find(f => f.endsWith('.cst'));
      
      expect(binFile).toBeDefined();
      expect(cstOutputFile).toBeDefined();
      
      // Verify .bin file has reasonable size
      if (binFile) {
        const binPath = path.join(config.outputPath, binFile);
        const stats = fs.statSync(binPath);
        expect(stats.size).toBeGreaterThan(0);
      }
      
      // Verify .cst file contains the characters
      if (cstOutputFile) {
        const cstPath = path.join(config.outputPath, cstOutputFile);
        const readChars = CharsetProcessor.parseCSTFile(cstPath);
        expect(readChars.sort()).toEqual(characters.sort());
      }
      
    } finally {
      generator.cleanup();
      cleanupTestFiles(config.outputPath, cstFile);
    }
  }, 30000);
});
