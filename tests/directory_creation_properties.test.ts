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
    // Only call ensureOutputDirectory, don't do anything else
    await this.ensureOutputDirectory();
    
    // Verify the directory was created
    if (!fs.existsSync(this.config.outputPath)) {
      throw new Error(`Directory was not created: ${this.config.outputPath}`);
    }
  }
}

describe('Feature: typescript-font-converter, Property 24: 输出目录自动创建', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-test-'));
  });

  afterEach(() => {
    // Clean up temp directory with retry logic
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Retry once after a short delay
      setTimeout(() => {
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (retryError) {
          console.warn(`Failed to clean up temp directory ${tempDir}:`, retryError);
        }
      }, 100);
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
          // Use a unique directory name to avoid conflicts
          const uniqueId = Math.random().toString(36).substring(2, 15);
          const outputPath = path.join(tempDir, `${dirName}_${uniqueId}`);
          
          // Ensure the directory doesn't exist initially
          expect(fs.existsSync(outputPath)).toBe(false);
          
          const config: FontConfig = {
            fontPath: 'dummy.ttf', // We don't actually load the font in this test
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
      { numRuns: 50 }
    );
  });

  it('should create multi-level nested directories', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 1, maxLength: 10 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 2, maxLength: 3 }
        ),
        async (dirParts) => {
          // Use a unique directory path to avoid conflicts
          const uniqueId = Math.random().toString(36).substring(2, 15);
          const outputPath = path.join(tempDir, uniqueId, ...dirParts);
          
          // Ensure the directory doesn't exist initially
          expect(fs.existsSync(outputPath)).toBe(false);
          
          const config: FontConfig = {
            fontPath: 'dummy.ttf', // We don't actually load the font in this test
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
          let currentPath = path.join(tempDir, uniqueId);
          expect(fs.existsSync(currentPath)).toBe(true);
          for (const part of dirParts) {
            currentPath = path.join(currentPath, part);
            expect(fs.existsSync(currentPath)).toBe(true);
            expect(fs.statSync(currentPath).isDirectory()).toBe(true);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('should not fail if directory already exists', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          // Use a unique directory name to avoid conflicts
          const uniqueId = Math.random().toString(36).substring(2, 15);
          const outputPath = path.join(tempDir, `${dirName}_${uniqueId}`);
          
          // Create directory first
          fs.mkdirSync(outputPath, { recursive: true });
          expect(fs.existsSync(outputPath)).toBe(true);
          
          const config: FontConfig = {
            fontPath: 'dummy.ttf', // We don't actually load the font in this test
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
      { numRuns: 50 }
    );
  });

  it('should create directory with correct permissions', () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        async (dirName) => {
          // Use a unique directory name to avoid conflicts
          const uniqueId = Math.random().toString(36).substring(2, 15);
          const outputPath = path.join(tempDir, `${dirName}_${uniqueId}`);
          
          const config: FontConfig = {
            fontPath: 'dummy.ttf', // We don't actually load the font in this test
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
      { numRuns: 25 }
    );
  });
});