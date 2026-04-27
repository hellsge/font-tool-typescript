/**
 * Basic unit tests for Vector Font Generator
 *
 * These tests verify basic functionality without property-based testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VectorFontGenerator } from '../src/vector-generator';
import { VectorFontHeader } from '../src/vector-font-header';
import { FontConfig, IndexMethod, RenderMode, Rotation } from '../src/types';
import { CharsetProcessor } from '../src/charset-processor';
import { FontConverterError, ErrorCode } from '../src/errors';

/**
 * Test font path
 */
const TEST_FONT_PATH = path.resolve(process.cwd(), 'Font/NotoSans_Regular.ttf');

/**
 * Check if test font exists
 */
const testFontExists = fs.existsSync(TEST_FONT_PATH);

/**
 * Helper function to create a temporary character set file
 */
let cstFileCounter = 0;
function createTempCharsetFile(characters: number[]): string {
  const tempDir = os.tmpdir();
  const tempFile = path.join(
    tempDir,
    `test-charset-${Date.now()}-${process.pid}-${cstFileCounter++}.cst`
  );
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

describe('VectorFontGenerator basic functionality', () => {
  const testCondition = testFontExists ? it : it.skip;

  testCondition('should create VectorFontGenerator instance', () => {
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-basic'),
      fontSize: 16,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [],
      outputFormat: 'vector',
    };

    const generator = new VectorFontGenerator(config);
    expect(generator).toBeDefined();
    expect(generator.getGlyphCount()).toBe(0);

    generator.cleanup();
  });

  testCondition(
    'should generate vector font with simple characters',
    async () => {
      const characters = [0x0041, 0x0042, 0x0043]; // A, B, C
      const cstFile = createTempCharsetFile(characters);

      const config: FontConfig = {
        fontPath: TEST_FONT_PATH,
        outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-abc'),
        fontSize: 24,
        renderMode: RenderMode.BIT_8,
        bold: false,
        italic: false,
        rotation: Rotation.ROTATE_0,
        gamma: 1.0,
        indexMethod: IndexMethod.ADDRESS,
        crop: false,
        characterSets: [{ type: 'file', value: cstFile }],
        outputFormat: 'vector',
      };

      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();

        // Verify output files exist
        const files = fs.readdirSync(config.outputPath);
        const binFile = files.find((f) => f.endsWith('.bin'));
        const cstOutputFile = files.find((f) => f.endsWith('.cst'));

        expect(binFile).toBeDefined();
        expect(cstOutputFile).toBeDefined();

        // Verify .bin file has reasonable size
        if (binFile) {
          const binPath = path.join(config.outputPath, binFile);
          const stats = fs.statSync(binPath);
          expect(stats.size).toBeGreaterThan(0);

          // Verify file flag is 2 (vector)
          const buffer = fs.readFileSync(binPath);
          const fileFlag = buffer.readUInt8(1);
          expect(fileFlag).toBe(2);
        }

        // Verify glyph count
        expect(generator.getGlyphCount()).toBeGreaterThan(0);
        expect(generator.getGlyphCount()).toBeLessThanOrEqual(characters.length);
      } finally {
        generator.cleanup();
        cleanupTestFiles(config.outputPath, cstFile);
      }
    },
    30000
  );

  testCondition('should generate correct output filename', () => {
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-filename'),
      fontSize: 16,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [],
      outputFormat: 'vector',
    };

    const generator = new VectorFontGenerator(config);
    const filename = generator.generateOutputFilename();

    // Filename should end with _vector.bin
    expect(filename).toMatch(/_vector\.bin$/);

    generator.cleanup();
  });
});

describe('VectorFontGenerator validation', () => {
  const testCondition = testFontExists ? it : it.skip;

  /**
   * Helper: 创建默认 FontConfig，可覆盖部分字段
   */
  function makeConfig(overrides: Partial<FontConfig> = {}): FontConfig {
    return {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), `font-converter-test-validation-${Date.now()}`),
      fontSize: 24,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [],
      outputFormat: 'vector',
      ...overrides,
    };
  }

  // --- fontSize <= 0 校验 (Requirements: 2.3) ---

  testCondition('should reject fontSize = 0', async () => {
    const config = makeConfig({ fontSize: 0 });
    const generator = new VectorFontGenerator(config);

    await expect(generator.generate()).rejects.toThrow(FontConverterError);
    await expect(generator.generate()).rejects.toMatchObject({
      code: ErrorCode.CONFIG_VALIDATION_ERROR,
    });

    generator.cleanup();
  });

  testCondition('should reject negative fontSize', async () => {
    const config = makeConfig({ fontSize: -5 });
    const generator = new VectorFontGenerator(config);

    await expect(generator.generate()).rejects.toThrow(FontConverterError);
    await expect(generator.generate()).rejects.toMatchObject({
      code: ErrorCode.CONFIG_VALIDATION_ERROR,
    });

    generator.cleanup();
  });

  testCondition(
    'should accept valid positive fontSize',
    async () => {
      const cstFile = createTempCharsetFile([0x0041]); // 'A'
      const outputPath = path.join(os.tmpdir(), `font-converter-test-valid-fontsize-${Date.now()}`);
      const config = makeConfig({
        fontSize: 32,
        characterSets: [{ type: 'file', value: cstFile }],
        outputPath,
      });
      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();
        // 不抛错即为通过
        expect(generator.getGlyphCount()).toBeGreaterThan(0);
      } finally {
        generator.cleanup();
        cleanupTestFiles(outputPath, cstFile);
      }
    },
    30000
  );

  // --- unitsPerEm > 0 校验 (Requirements: 14.1, 14.2) ---
  // 注意：真实字体的 unitsPerEm 总是 > 0（通常 1000 或 2048），
  // 所以这里验证正常字体生成时 header 中 unitsPerEm 被正确传递。

  testCondition(
    'should pass unitsPerEm from font metrics to header',
    async () => {
      const cstFile = createTempCharsetFile([0x0041]); // 'A'
      const outputPath = path.join(os.tmpdir(), `font-converter-test-upm-${Date.now()}`);
      const config = makeConfig({
        fontSize: 24,
        characterSets: [{ type: 'file', value: cstFile }],
        outputPath,
      });
      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();

        // 读取生成的 .bin 文件，验证 header 中包含有效的 unitsPerEm
        const files = fs.readdirSync(outputPath);
        const binFile = files.find((f) => f.endsWith('.bin'));
        expect(binFile).toBeDefined();

        if (binFile) {
          const buffer = fs.readFileSync(path.join(outputPath, binFile));
          const headLength = buffer.readUInt8(0);
          // unitsPerEm 位于 header 末尾 2 字节
          const unitsPerEm = buffer.readUInt16LE(headLength - 2);
          expect(unitsPerEm).toBeGreaterThan(0);
          // Noto Sans 的 unitsPerEm 通常为 1000 或 2048
          expect(unitsPerEm).toBeGreaterThanOrEqual(100);
        }
      } finally {
        generator.cleanup();
        cleanupTestFiles(outputPath, cstFile);
      }
    },
    30000
  );

  testCondition(
    'should write V3 version in generated header',
    async () => {
      const cstFile = createTempCharsetFile([0x0041]); // 'A'
      const outputPath = path.join(os.tmpdir(), `font-converter-test-v3-${Date.now()}`);
      const config = makeConfig({
        fontSize: 24,
        characterSets: [{ type: 'file', value: cstFile }],
        outputPath,
      });
      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();

        const files = fs.readdirSync(outputPath);
        const binFile = files.find((f) => f.endsWith('.bin'));
        expect(binFile).toBeDefined();

        if (binFile) {
          const buffer = fs.readFileSync(path.join(outputPath, binFile));
          // version[0] 在 offset 2
          const versionMajor = buffer.readUInt8(2);
          expect(versionMajor).toBeGreaterThanOrEqual(3);
        }
      } finally {
        generator.cleanup();
        cleanupTestFiles(outputPath, cstFile);
      }
    },
    30000
  );
});

/**
 * Space glyph (U+0020) handling tests
 *
 * Requirements: 15.3 — The Font_Tool SHALL ensure the space glyph (U+0020)
 * is included in the vector font output with a valid advance value.
 */
describe('VectorFontGenerator space glyph handling', () => {
  const testCondition = testFontExists ? it : it.skip;

  function makeConfig(overrides: Partial<FontConfig> = {}): FontConfig {
    return {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), `font-converter-test-space-${Date.now()}`),
      fontSize: 24,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [],
      outputFormat: 'vector',
      ...overrides,
    };
  }

  testCondition(
    'should include space glyph (U+0020) in output with valid advance',
    async () => {
      // Character set includes space + visible characters
      const characters = [0x0020, 0x0041, 0x0042]; // space, A, B
      const cstFile = createTempCharsetFile(characters);
      const outputPath = path.join(os.tmpdir(), `font-converter-test-space-glyph-${Date.now()}`);
      const config = makeConfig({
        characterSets: [{ type: 'file', value: cstFile }],
        outputPath,
      });
      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();

        // Space should be counted as a successful glyph, not a failed one
        expect(generator.getGlyphCount()).toBe(3); // space + A + B
        expect(generator.getFailedCharacters()).not.toContain(0x0020);

        // Verify the binary output contains the space glyph
        const files = fs.readdirSync(outputPath);
        const binFile = files.find((f) => f.endsWith('.bin'));
        expect(binFile).toBeDefined();

        if (binFile) {
          const buffer = fs.readFileSync(path.join(outputPath, binFile));
          const header = VectorFontHeader.fromBytes(buffer);

          // In ADDRESS mode, the index entry for U+0020 should point to valid glyph data
          const headerSize = header.getSize();
          const indexOffset = headerSize + 0x0020 * 4; // ADDRESS mode: unicode * 4
          const glyphOffset = buffer.readUInt32LE(indexOffset);

          // Glyph offset should not be 0xFFFFFFFF (unused marker)
          expect(glyphOffset).not.toBe(0xffffffff);
          expect(glyphOffset).toBeGreaterThan(0);

          // Read the space glyph data at the offset
          let pos = glyphOffset;
          const sx0 = buffer.readInt16LE(pos);
          pos += 2;
          const sy0 = buffer.readInt16LE(pos);
          pos += 2;
          const sx1 = buffer.readInt16LE(pos);
          pos += 2;
          const sy1 = buffer.readInt16LE(pos);
          pos += 2;
          const advance = buffer.readUInt16LE(pos);
          pos += 2;
          const windingCount = buffer.readUInt8(pos);
          pos += 1;

          // Space glyph should have empty bounding box
          expect(sx0).toBe(0);
          expect(sy0).toBe(0);
          expect(sx1).toBe(0);
          expect(sy1).toBe(0);

          // Space glyph should have valid advance > 0
          expect(advance).toBeGreaterThan(0);

          // Space glyph should have zero windings (no contours)
          expect(windingCount).toBe(0);
        }
      } finally {
        generator.cleanup();
        cleanupTestFiles(outputPath, cstFile);
      }
    },
    30000
  );

  testCondition(
    'should include space glyph in OFFSET index mode',
    async () => {
      const characters = [0x0020, 0x0041]; // space, A
      const cstFile = createTempCharsetFile(characters);
      const outputPath = path.join(os.tmpdir(), `font-converter-test-space-offset-${Date.now()}`);
      const config = makeConfig({
        indexMethod: IndexMethod.OFFSET,
        characterSets: [{ type: 'file', value: cstFile }],
        outputPath,
      });
      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();

        // Space should be included
        expect(generator.getGlyphCount()).toBe(2);
        expect(generator.getFailedCharacters()).not.toContain(0x0020);

        // Verify binary output
        const files = fs.readdirSync(outputPath);
        const binFile = files.find((f) => f.endsWith('.bin'));
        expect(binFile).toBeDefined();

        if (binFile) {
          const buffer = fs.readFileSync(path.join(outputPath, binFile));
          const header = VectorFontHeader.fromBytes(buffer);
          const headerSize = header.getSize();

          // OFFSET mode: first index entry should be for U+0020 (sorted by unicode)
          const firstUnicode = buffer.readUInt16LE(headerSize);
          const firstOffset = buffer.readUInt32LE(headerSize + 2);

          expect(firstUnicode).toBe(0x0020);
          expect(firstOffset).toBeGreaterThan(0);

          // Read space glyph advance at the offset
          const advance = buffer.readUInt16LE(firstOffset + 8); // skip sx0/sy0/sx1/sy1 (8 bytes)
          expect(advance).toBeGreaterThan(0);
        }
      } finally {
        generator.cleanup();
        cleanupTestFiles(outputPath, cstFile);
      }
    },
    30000
  );

  testCondition(
    'should handle space-only character set',
    async () => {
      const characters = [0x0020]; // space only
      const cstFile = createTempCharsetFile(characters);
      const outputPath = path.join(os.tmpdir(), `font-converter-test-space-only-${Date.now()}`);
      const config = makeConfig({
        characterSets: [{ type: 'file', value: cstFile }],
        outputPath,
      });
      const generator = new VectorFontGenerator(config);

      try {
        await generator.generate();

        // Space should be the only glyph
        expect(generator.getGlyphCount()).toBe(1);
        expect(generator.getFailedCharacters()).toHaveLength(0);
      } finally {
        generator.cleanup();
        cleanupTestFiles(outputPath, cstFile);
      }
    },
    30000
  );
});
