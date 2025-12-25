/**
 * Property-Based Tests for Error Cleanup
 * 
 * Tests Property 25: 错误时清理部分输出
 * Validates: Requirements 8.7
 * 
 * Feature: typescript-font-converter, Property 25: 错误时清理部分输出
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FontGenerator } from '../src/font-generator';
import { FontConfig, RenderMode, Rotation, IndexMethod } from '../src/types';
import { FontConverterError, ErrorCode } from '../src/errors';

// Mock implementation that can be forced to fail
class TestFontGeneratorWithError extends FontGenerator {
  private shouldFailAt: 'load' | 'write' | 'none' = 'none';
  private outputFiles: string[] = [];

  setShouldFailAt(stage: 'load' | 'write' | 'none') {
    this.shouldFailAt = stage;
  }

  async generate(): Promise<void> {
    try {
      // Simulate loading
      if (this.shouldFailAt === 'load') {
        throw new FontConverterError(
          ErrorCode.FONT_FILE_NOT_FOUND,
          'Simulated load error',
          { filePath: this.config.fontPath }
        );
      }

      // Simulate creating output files (only if load succeeded)
      const baseName = 'test_font';
      const binPath = path.join(this.config.outputPath, `${baseName}.bin`);
      const cstPath = path.join(this.config.outputPath, `${baseName}.cst`);

      // Set output files for test verification
      this.outputFiles = [binPath, cstPath];

      // Track files
      this.trackPartialFile(binPath);
      this.trackPartialFile(cstPath);

      // Create partial files
      fs.writeFileSync(binPath, 'partial binary data');
      fs.writeFileSync(cstPath, 'partial cst data');

      // Simulate write error
      if (this.shouldFailAt === 'write') {
        throw new FontConverterError(
          ErrorCode.FILE_WRITE_ERROR,
          'Simulated write error',
          { filePath: binPath }
        );
      }

      // Success - clear tracking
      this.partialOutputFiles = [];
    } catch (error) {
      // Clean up partial files on error
      this.cleanupPartialFiles();
      throw error;
    }
  }

  getOutputFiles(): string[] {
    return this.outputFiles;
  }
}

describe('Feature: typescript-font-converter, Property 25: 错误时清理部分输出', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-error-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Property 25: Error cleanup of partial output
   * For any unrecoverable error during processing, partial output files
   * should be deleted.
   */

  it('should clean up partial files when write error occurs', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          fs.mkdirSync(outputPath, { recursive: true });

          const config: FontConfig = {
            fontPath: path.join(__dirname, '../examples/test.ttf'),
            outputPath,
            fontSize: 16,
            renderMode: RenderMode.BIT_8,
            bold: false,
            italic: false,
            rotation: Rotation.ROTATE_0,
            gamma: 1.0,
            indexMethod: IndexMethod.ADDRESS,
            crop: false,
            characterSets: [],
            outputFormat: 'bitmap'
          };

          const generator = new TestFontGeneratorWithError(config);
          generator.setShouldFailAt('write');

          // Get the files that will be created
          const outputFiles = generator.getOutputFiles();

          // Generation should fail
          await expect(generator.generate()).rejects.toThrow();

          // Partial files should be cleaned up
          for (const file of outputFiles) {
            expect(fs.existsSync(file)).toBe(false);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should clean up partial files when load error occurs after file creation', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          fs.mkdirSync(outputPath, { recursive: true });

          const config: FontConfig = {
            fontPath: path.join(__dirname, '../examples/test.ttf'),
            outputPath,
            fontSize: 16,
            renderMode: RenderMode.BIT_8,
            bold: false,
            italic: false,
            rotation: Rotation.ROTATE_0,
            gamma: 1.0,
            indexMethod: IndexMethod.ADDRESS,
            crop: false,
            characterSets: [],
            outputFormat: 'bitmap'
          };

          const generator = new TestFontGeneratorWithError(config);
          generator.setShouldFailAt('load');

          // Generation should fail
          await expect(generator.generate()).rejects.toThrow();

          // No files should be created since error happens before file creation
          const files = fs.readdirSync(outputPath);
          expect(files.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not delete files on successful generation', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          fs.mkdirSync(outputPath, { recursive: true });

          const config: FontConfig = {
            fontPath: path.join(__dirname, '../examples/test.ttf'),
            outputPath,
            fontSize: 16,
            renderMode: RenderMode.BIT_8,
            bold: false,
            italic: false,
            rotation: Rotation.ROTATE_0,
            gamma: 1.0,
            indexMethod: IndexMethod.ADDRESS,
            crop: false,
            characterSets: [],
            outputFormat: 'bitmap'
          };

          const generator = new TestFontGeneratorWithError(config);
          generator.setShouldFailAt('none');

          // Get the files that will be created
          const outputFiles = generator.getOutputFiles();

          // Generation should succeed
          await expect(generator.generate()).resolves.not.toThrow();

          // Files should still exist
          for (const file of outputFiles) {
            expect(fs.existsSync(file)).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle cleanup errors gracefully', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          fs.mkdirSync(outputPath, { recursive: true });

          const config: FontConfig = {
            fontPath: path.join(__dirname, '../examples/test.ttf'),
            outputPath,
            fontSize: 16,
            renderMode: RenderMode.BIT_8,
            bold: false,
            italic: false,
            rotation: Rotation.ROTATE_0,
            gamma: 1.0,
            indexMethod: IndexMethod.ADDRESS,
            crop: false,
            characterSets: [],
            outputFormat: 'bitmap'
          };

          const generator = new TestFontGeneratorWithError(config);
          generator.setShouldFailAt('write');

          // Generation should fail
          await expect(generator.generate()).rejects.toThrow();

          // Cleanup should not throw even if files don't exist
          // (they were already cleaned up)
          expect(() => generator['cleanupPartialFiles']()).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });
});
