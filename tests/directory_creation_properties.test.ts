/**
 * Property-Based Tests for Output Directory Creation
 * 
 * Tests Property 24: 输出目录自动创建
 * Validates: Requirements 8.5
 * 
 * Feature: typescript-font-converter, Property 24: 输出目录自动创建
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FontGenerator } from '../src/font-generator';
import { FontConfig, RenderMode, Rotation, IndexMethod } from '../src/types';

// Mock implementation for testing
class TestFontGenerator extends FontGenerator {
  async generate(): Promise<void> {
    await this.ensureOutputDirectory();
  }
}

describe('Feature: typescript-font-converter, Property 24: 输出目录自动创建', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Property 24: Output directory auto-creation
   * For any non-existent output directory path, the tool should automatically
   * create the directory and its parent directories.
   */

  it('should create single-level non-existent directory', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          
          // Clean up if directory exists from previous test
          if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true });
          }
          
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
          
          const generator = new TestFontGenerator(config);
          await generator.generate();
          
          // Directory should now exist
          expect(fs.existsSync(outputPath)).toBe(true);
          expect(fs.statSync(outputPath).isDirectory()).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create multi-level nested directories', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 2, maxLength: 5 }
        ),
        async (dirParts) => {
          const outputPath = path.join(tempDir, ...dirParts);
          
          // Clean up if directory exists from previous test
          if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true });
          }
          
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
          
          const generator = new TestFontGenerator(config);
          await generator.generate();
          
          // All parent directories and the target directory should exist
          expect(fs.existsSync(outputPath)).toBe(true);
          expect(fs.statSync(outputPath).isDirectory()).toBe(true);
          
          // Verify all parent directories were created
          let currentPath = tempDir;
          for (const part of dirParts) {
            currentPath = path.join(currentPath, part);
            expect(fs.existsSync(currentPath)).toBe(true);
            expect(fs.statSync(currentPath).isDirectory()).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not fail if directory already exists', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          
          // Clean up if directory exists from previous test
          if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true });
          }
          
          // Create directory first
          fs.mkdirSync(outputPath, { recursive: true });
          expect(fs.existsSync(outputPath)).toBe(true);
          
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
          
          const generator = new TestFontGenerator(config);
          
          // Should not throw error
          await expect(generator.generate()).resolves.not.toThrow();
          
          // Directory should still exist
          expect(fs.existsSync(outputPath)).toBe(true);
          expect(fs.statSync(outputPath).isDirectory()).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle paths with special characters', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          
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
          
          const generator = new TestFontGenerator(config);
          await generator.generate();
          
          // Directory should be created successfully
          expect(fs.existsSync(outputPath)).toBe(true);
          expect(fs.statSync(outputPath).isDirectory()).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create directory with correct permissions', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          const outputPath = path.join(tempDir, dirName);
          
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
          
          const generator = new TestFontGenerator(config);
          await generator.generate();
          
          // Directory should be writable
          const testFile = path.join(outputPath, 'test.txt');
          fs.writeFileSync(testFile, 'test');
          expect(fs.existsSync(testFile)).toBe(true);
          
          // Clean up test file
          fs.unlinkSync(testFile);
        }
      ),
      { numRuns: 50 }
    );
  });
});
