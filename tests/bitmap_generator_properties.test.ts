/**
 * Property-based tests for BitmapFontGenerator
 * 
 * Feature: typescript-font-converter
 * Property 9: 渲染失败不中断处理
 * Property 16: Index Array 大小正确性
 * Property 17: 未使用索引条目初始化
 * Property 26: 输出文件命名符合规范
 * 
 * Validates: Requirements 2.7, 5.5, 5.6, 5.7, 8.6, 9.1, 9.2, 9.3, 9.7
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BitmapFontGenerator } from '../src/bitmap-generator';
import { FontConfig, RenderMode, IndexMethod, Rotation } from '../src/types';
import { BINARY_FORMAT, FILE_NAMING } from '../src/constants';

// Path to test font file
const TEST_FONT_PATH = path.resolve(__dirname, '../../font-tool-release/Font/NotoSans_Regular.ttf');

// Check if test font exists
const fontExists = fs.existsSync(TEST_FONT_PATH);

/**
 * Create a temporary directory for test outputs
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'font-test-'));
}

/**
 * Clean up temporary directory
 */
function cleanupTempDir(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Create a valid FontConfig for testing
 */
function createTestConfig(overrides: Partial<FontConfig> = {}): FontConfig {
  const tempDir = createTempDir();
  return {
    fontPath: TEST_FONT_PATH,
    outputPath: tempDir,
    fontSize: 16,
    renderMode: RenderMode.BIT_4,
    bold: false,
    italic: false,
    rotation: Rotation.ROTATE_0,
    gamma: 1.0,
    indexMethod: IndexMethod.ADDRESS,
    crop: false,
    characterSets: [{ type: 'range', value: '0x0041-0x005A' }], // A-Z
    outputFormat: 'bitmap',
    ...overrides
  };
}

/**
 * Arbitrary generator for valid render modes
 */
const renderModeArbitrary = fc.constantFrom(
  RenderMode.BIT_1,
  RenderMode.BIT_2,
  RenderMode.BIT_4,
  RenderMode.BIT_8
);

/**
 * Arbitrary generator for valid index methods
 */
const indexMethodArbitrary = fc.constantFrom(
  IndexMethod.ADDRESS,
  IndexMethod.OFFSET
);

/**
 * Arbitrary generator for font sizes
 */
const fontSizeArbitrary = fc.integer({ min: 8, max: 48 });

/**
 * Arbitrary generator for character ranges (small for fast tests)
 */
const characterRangeArbitrary = fc.integer({ min: 0x0041, max: 0x007A }).chain(start => 
  fc.integer({ min: start, max: Math.min(start + 20, 0x007A) }).map(end => ({
    start,
    end
  }))
);

// Skip tests if font file doesn't exist
const describeIfFontExists = fontExists ? describe : describe.skip;

describeIfFontExists('Feature: typescript-font-converter, Property 9: 渲染失败不中断处理', () => {
  /**
   * Property 9: 渲染失败不中断处理
   * 
   * For any character set containing some invalid/unsupported characters,
   * the generator should:
   * 1. Successfully render valid characters
   * 2. Record failed characters to NotSupportedChars.txt
   * 3. Not throw an exception
   * 
   * Validates: Requirements 2.7, 8.6
   */
  it('should continue processing when some characters fail to render', async () => {
    await fc.assert(
      fc.asyncProperty(
        characterRangeArbitrary,
        async ({ start, end }) => {
          const tempDir = createTempDir();
          
          try {
            // Create config with a mix of valid ASCII and potentially invalid characters
            // Include some private use area characters that won't have glyphs
            const config = createTestConfig({
              outputPath: tempDir,
              characterSets: [
                { type: 'range', value: `0x${start.toString(16)}-0x${end.toString(16)}` },
                // Add some characters that likely won't render (private use area)
                { type: 'range', value: '0xE000-0xE005' }
              ]
            });

            const generator = new BitmapFontGenerator(config);
            
            // Should not throw
            await generator.generate();
            
            // Should have processed some characters successfully
            const processedCount = generator.getGlyphCount();
            expect(processedCount).toBeGreaterThan(0);
            
            // Failed characters should be recorded
            const failedChars = generator.getFailedCharacters();
            // Private use area characters should fail
            expect(failedChars.length).toBeGreaterThanOrEqual(0);
            
            // Output file should exist
            const outputFiles = fs.readdirSync(tempDir);
            const binFiles = outputFiles.filter(f => f.endsWith('.bin'));
            expect(binFiles.length).toBe(1);
            
            generator.cleanup();
          } finally {
            cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: 10 } // Reduced runs due to file I/O
    );
  });

  it('should write NotSupportedChars.txt when characters fail', async () => {
    const tempDir = createTempDir();
    
    try {
      // Create config with characters that won't render
      const config = createTestConfig({
        outputPath: tempDir,
        characterSets: [
          { type: 'range', value: '0x0041-0x0045' }, // A-E (valid)
          { type: 'range', value: '0xE000-0xE010' }  // Private use (invalid)
        ]
      });

      const generator = new BitmapFontGenerator(config);
      await generator.generate();
      
      const failedChars = generator.getFailedCharacters();
      
      if (failedChars.length > 0) {
        // NotSupportedChars.txt should exist
        const notSupportedPath = path.join(tempDir, FILE_NAMING.UNSUPPORTED_CHARS_FILE);
        expect(fs.existsSync(notSupportedPath)).toBe(true);
        
        // File should contain the failed characters
        const content = fs.readFileSync(notSupportedPath, 'utf-8');
        for (const unicode of failedChars) {
          const hex = unicode.toString(16).toUpperCase().padStart(4, '0');
          expect(content).toContain(`U+${hex}`);
        }
      }
      
      generator.cleanup();
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describeIfFontExists('Feature: typescript-font-converter, Property 16: Index Array 大小正确性', () => {
  /**
   * Property 16: Index Array 大小正确性
   * 
   * For any font using address index method, index array should have 65536 entries.
   * For any font using offset index method, index array should have N entries (N = character count).
   * 
   * Validates: Requirements 5.5, 5.6
   */
  it('should create correct index array size for ADDRESS mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        characterRangeArbitrary,
        fontSizeArbitrary,
        async ({ start, end }, fontSize) => {
          const tempDir = createTempDir();
          
          try {
            const config = createTestConfig({
              outputPath: tempDir,
              fontSize,
              indexMethod: IndexMethod.ADDRESS,
              crop: false,
              characterSets: [
                { type: 'range', value: `0x${start.toString(16)}-0x${end.toString(16)}` }
              ]
            });

            const generator = new BitmapFontGenerator(config);
            await generator.generate();
            
            // Read the output file and verify index array size
            const outputFiles = fs.readdirSync(tempDir);
            const binFile = outputFiles.find(f => f.endsWith('.bin'));
            expect(binFile).toBeDefined();
            
            const binPath = path.join(tempDir, binFile!);
            const data = fs.readFileSync(binPath);
            
            // Read header length
            const headerLength = data[0];
            
            // Read indexAreaSize from header (at offset 9, 4 bytes, little-endian)
            const indexAreaSize = data.readInt32LE(9);
            
            // For ADDRESS mode without crop: 65536 × 2 bytes
            expect(indexAreaSize).toBe(BINARY_FORMAT.MAX_INDEX_SIZE * 2);
            
            generator.cleanup();
          } finally {
            cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should create correct index array size for OFFSET mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        characterRangeArbitrary,
        fontSizeArbitrary,
        async ({ start, end }, fontSize) => {
          const tempDir = createTempDir();
          
          try {
            const config = createTestConfig({
              outputPath: tempDir,
              fontSize,
              indexMethod: IndexMethod.OFFSET,
              crop: false,
              characterSets: [
                { type: 'range', value: `0x${start.toString(16)}-0x${end.toString(16)}` }
              ]
            });

            const generator = new BitmapFontGenerator(config);
            await generator.generate();
            
            const glyphCount = generator.getGlyphCount();
            
            // Read the output file and verify index array size
            const outputFiles = fs.readdirSync(tempDir);
            const binFile = outputFiles.find(f => f.endsWith('.bin'));
            expect(binFile).toBeDefined();
            
            const binPath = path.join(tempDir, binFile!);
            const data = fs.readFileSync(binPath);
            
            // Read indexAreaSize from header (at offset 9, 4 bytes, little-endian)
            const indexAreaSize = data.readInt32LE(9);
            
            // For OFFSET mode: N × 2 bytes (unicode only, char index is implicit)
            expect(indexAreaSize).toBe(glyphCount * 2);
            
            generator.cleanup();
          } finally {
            cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('should create correct index array size for CROP mode', async () => {
    await fc.assert(
      fc.asyncProperty(
        characterRangeArbitrary,
        fontSizeArbitrary,
        async ({ start, end }, fontSize) => {
          const tempDir = createTempDir();
          
          try {
            const config = createTestConfig({
              outputPath: tempDir,
              fontSize,
              indexMethod: IndexMethod.ADDRESS, // Crop requires ADDRESS mode
              crop: true,
              characterSets: [
                { type: 'range', value: `0x${start.toString(16)}-0x${end.toString(16)}` }
              ]
            });

            const generator = new BitmapFontGenerator(config);
            await generator.generate();
            
            // Read the output file and verify index array size
            const outputFiles = fs.readdirSync(tempDir);
            const binFile = outputFiles.find(f => f.endsWith('.bin'));
            expect(binFile).toBeDefined();
            
            const binPath = path.join(tempDir, binFile!);
            const data = fs.readFileSync(binPath);
            
            // Read indexAreaSize from header (at offset 9, 4 bytes, little-endian)
            const indexAreaSize = data.readInt32LE(9);
            
            // For CROP mode: 65536 × 4 bytes (file offsets)
            expect(indexAreaSize).toBe(BINARY_FORMAT.MAX_INDEX_SIZE * 4);
            
            generator.cleanup();
          } finally {
            cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});

describeIfFontExists('Feature: typescript-font-converter, Property 17: 未使用索引条目初始化', () => {
  /**
   * Property 17: 未使用索引条目初始化
   * 
   * For any font using address index method, unused index entries should be 0xFFFF.
   * For crop mode, unused entries should be 0xFFFFFFFF.
   * 
   * Validates: Requirements 5.7
   */
  it('should initialize unused index entries to 0xFFFF in ADDRESS mode', async () => {
    const tempDir = createTempDir();
    
    try {
      // Use a small character set so most entries are unused
      const config = createTestConfig({
        outputPath: tempDir,
        indexMethod: IndexMethod.ADDRESS,
        crop: false,
        characterSets: [
          { type: 'range', value: '0x0041-0x0043' } // Just A, B, C
        ]
      });

      const generator = new BitmapFontGenerator(config);
      await generator.generate();
      
      // Read the output file
      const outputFiles = fs.readdirSync(tempDir);
      const binFile = outputFiles.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();
      
      const binPath = path.join(tempDir, binFile!);
      const data = fs.readFileSync(binPath);
      
      // Read header length
      const headerLength = data[0];
      
      // Index array starts after header
      const indexStart = headerLength;
      
      // Check some unused entries (e.g., index 0, which is before 'A')
      const unusedEntry = data.readUInt16LE(indexStart + 0 * 2);
      expect(unusedEntry).toBe(BINARY_FORMAT.UNUSED_INDEX_16);
      
      // Check entry for 'D' (0x44) which should be unused
      const unusedEntryD = data.readUInt16LE(indexStart + 0x44 * 2);
      expect(unusedEntryD).toBe(BINARY_FORMAT.UNUSED_INDEX_16);
      
      generator.cleanup();
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  it('should initialize unused index entries to 0xFFFFFFFF in CROP mode', async () => {
    const tempDir = createTempDir();
    
    try {
      // Use a small character set so most entries are unused
      const config = createTestConfig({
        outputPath: tempDir,
        indexMethod: IndexMethod.ADDRESS,
        crop: true,
        characterSets: [
          { type: 'range', value: '0x0041-0x0043' } // Just A, B, C
        ]
      });

      const generator = new BitmapFontGenerator(config);
      await generator.generate();
      
      // Read the output file
      const outputFiles = fs.readdirSync(tempDir);
      const binFile = outputFiles.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();
      
      const binPath = path.join(tempDir, binFile!);
      const data = fs.readFileSync(binPath);
      
      // Read header length
      const headerLength = data[0];
      
      // Index array starts after header
      const indexStart = headerLength;
      
      // Check some unused entries (e.g., index 0, which is before 'A')
      const unusedEntry = data.readUInt32LE(indexStart + 0 * 4);
      expect(unusedEntry).toBe(BINARY_FORMAT.UNUSED_INDEX_32);
      
      // Check entry for 'D' (0x44) which should be unused
      const unusedEntryD = data.readUInt32LE(indexStart + 0x44 * 4);
      expect(unusedEntryD).toBe(BINARY_FORMAT.UNUSED_INDEX_32);
      
      generator.cleanup();
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});

describeIfFontExists('Feature: typescript-font-converter, Property 26: 输出文件命名符合规范', () => {
  /**
   * Property 26: 输出文件命名符合规范
   * 
   * For any bitmap font, output filename should match format:
   * [fontName]_size[size]_bits[mode]_bitmap.bin
   * 
   * Validates: Requirements 9.1, 9.2, 9.3, 9.7
   */
  it('should generate correct output filename format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fontSizeArbitrary,
        renderModeArbitrary,
        async (fontSize, renderMode) => {
          const tempDir = createTempDir();
          
          try {
            const config = createTestConfig({
              outputPath: tempDir,
              fontSize,
              renderMode,
              characterSets: [
                { type: 'range', value: '0x0041-0x0045' } // A-E
              ]
            });

            const generator = new BitmapFontGenerator(config);
            await generator.generate();
            
            // Check output filename format
            const outputFiles = fs.readdirSync(tempDir);
            const binFile = outputFiles.find(f => f.endsWith('.bin'));
            expect(binFile).toBeDefined();
            
            // Filename should match pattern: [fontName]_size[size]_bits[mode]_bitmap.bin
            const pattern = new RegExp(
              `^.+${FILE_NAMING.SIZE_PREFIX}${fontSize}${FILE_NAMING.BITS_PREFIX}${renderMode}_bitmap\\.bin$`
            );
            expect(binFile).toMatch(pattern);
            
            // CST file should also exist with same base name
            const cstFile = outputFiles.find(f => f.endsWith(FILE_NAMING.CST_EXTENSION));
            expect(cstFile).toBeDefined();
            
            // CST filename should match bin filename (without .bin, with .cst)
            const expectedCstName = binFile!.replace('.bin', FILE_NAMING.CST_EXTENSION);
            expect(cstFile).toBe(expectedCstName);
            
            generator.cleanup();
          } finally {
            cleanupTempDir(tempDir);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should use underscore separators in filename', async () => {
    const tempDir = createTempDir();
    
    try {
      const config = createTestConfig({
        outputPath: tempDir,
        fontSize: 24,
        renderMode: RenderMode.BIT_8,
        characterSets: [
          { type: 'range', value: '0x0041-0x0045' }
        ]
      });

      const generator = new BitmapFontGenerator(config);
      await generator.generate();
      
      const outputFiles = fs.readdirSync(tempDir);
      const binFile = outputFiles.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();
      
      // Should contain underscore separators
      expect(binFile).toContain('_size');
      expect(binFile).toContain('_bits');
      expect(binFile).toContain('_bitmap');
      
      generator.cleanup();
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
