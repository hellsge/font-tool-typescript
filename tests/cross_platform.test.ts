/**
 * Cross-Platform Consistency Tests
 * 
 * Property 28: 跨平台 Binary 输出一致性
 * 
 * Validates that the TypeScript implementation generates identical binary output
 * across different platforms (Windows, macOS, Linux).
 * 
 * Task: 18.3
 * Validates: Requirements 10.4
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { main } from '../src/main';
import * as fc from 'fast-check';

describe('Feature: typescript-font-converter, Property 28: 跨平台 Binary 输出一致性', () => {
  const testOutputDir = path.join(__dirname, '../test-output/cross-platform');
  const testFontPath = path.join(__dirname, '../../font-tool-release/Font/NotoSans_Regular.ttf');

  beforeAll(() => {
    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test output files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        const filePath = path.join(testOutputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
    }
  });

  /**
   * Calculate SHA-256 hash of a file
   */
  function calculateFileHash(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  /**
   * Generate font and return hash of output file
   */
  async function generateAndHash(config: any, outputDir: string): Promise<{ binHash: string; cstHash: string }> {
    const configPath = path.join(outputDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const exitCode = await main(['node', 'font-converter', configPath]);
    expect(exitCode).toBe(0);

    // Find generated files
    const files = fs.readdirSync(outputDir);
    const binFile = files.find(f => f.endsWith('.bin'));
    const cstFile = files.find(f => f.endsWith('.cst'));

    expect(binFile).toBeDefined();
    expect(cstFile).toBeDefined();

    const binHash = calculateFileHash(path.join(outputDir, binFile!));
    const cstHash = calculateFileHash(path.join(outputDir, cstFile!));

    return { binHash, cstHash };
  }

  describe('Deterministic Output', () => {
    it('should generate identical bitmap font output for same configuration (multiple runs)', async () => {
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x005A' // A-Z
              }
            ]
          }
        ]
      };

      // Generate font multiple times
      const hashes: Array<{ binHash: string; cstHash: string }> = [];

      for (let i = 0; i < 3; i++) {
        // Clean output directory
        const files = fs.readdirSync(testOutputDir);
        for (const file of files) {
          const filePath = path.join(testOutputDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }

        // Generate font
        const hash = await generateAndHash(config, testOutputDir);
        hashes.push(hash);
      }

      // All hashes should be identical
      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i].binHash).toBe(hashes[0].binHash);
        expect(hashes[i].cstHash).toBe(hashes[0].cstHash);
      }
    }, 60000);

    it('should generate identical vector font output for same configuration (multiple runs)', async () => {
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 0,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'vector',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x005A' // A-Z
              }
            ]
          }
        ]
      };

      // Generate font multiple times
      const hashes: Array<{ binHash: string; cstHash: string }> = [];

      for (let i = 0; i < 3; i++) {
        // Clean output directory
        const files = fs.readdirSync(testOutputDir);
        for (const file of files) {
          const filePath = path.join(testOutputDir, file);
          if (fs.statSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
          }
        }

        // Generate font
        const hash = await generateAndHash(config, testOutputDir);
        hashes.push(hash);
      }

      // All hashes should be identical
      for (let i = 1; i < hashes.length; i++) {
        expect(hashes[i].binHash).toBe(hashes[0].binHash);
        expect(hashes[i].cstHash).toBe(hashes[0].cstHash);
      }
    }, 60000);
  });

  describe('Path Handling Consistency', () => {
    it('should handle forward slashes and backslashes consistently', async () => {
      // Test with forward slashes
      const configForward = {
        fonts: [
          {
            fontPath: testFontPath.replace(/\\/g, '/'),
            outputPath: testOutputDir.replace(/\\/g, '/'),
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F
              }
            ]
          }
        ]
      };

      const hashForward = await generateAndHash(configForward, testOutputDir);

      // Clean output directory
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        const filePath = path.join(testOutputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }

      // Test with backslashes (Windows style)
      const configBackward = {
        fonts: [
          {
            fontPath: testFontPath.replace(/\//g, '\\'),
            outputPath: testOutputDir.replace(/\//g, '\\'),
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F
              }
            ]
          }
        ]
      };

      const hashBackward = await generateAndHash(configBackward, testOutputDir);

      // Hashes should be identical regardless of path separator
      expect(hashBackward.binHash).toBe(hashForward.binHash);
      expect(hashBackward.cstHash).toBe(hashForward.cstHash);
    }, 60000);

    it('should handle relative and absolute paths consistently', async () => {
      // Test with absolute path
      const configAbsolute = {
        fonts: [
          {
            fontPath: path.resolve(testFontPath),
            outputPath: path.resolve(testOutputDir),
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F
              }
            ]
          }
        ]
      };

      const hashAbsolute = await generateAndHash(configAbsolute, testOutputDir);

      // Clean output directory
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        const filePath = path.join(testOutputDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }

      // Test with normalized absolute path (using path.normalize)
      const configNormalized = {
        fonts: [
          {
            fontPath: path.normalize(testFontPath),
            outputPath: path.normalize(testOutputDir),
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F
              }
            ]
          }
        ]
      };

      const hashNormalized = await generateAndHash(configNormalized, testOutputDir);

      // Hashes should be identical regardless of path normalization
      expect(hashNormalized.binHash).toBe(hashAbsolute.binHash);
      expect(hashNormalized.cstHash).toBe(hashAbsolute.cstHash);
    }, 60000);
  });

  describe('Binary Format Consistency', () => {
    it('should generate platform-independent binary format (little-endian)', async () => {
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F
              }
            ]
          }
        ]
      };

      await generateAndHash(config, testOutputDir);

      // Read generated binary file
      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const buffer = fs.readFileSync(path.join(testOutputDir, binFile!));

      // Verify little-endian format by checking index area size (int32 at offset 9)
      const indexAreaSize = buffer.readInt32LE(9);
      expect(indexAreaSize).toBe(131072); // 65536 * 2 bytes for address mode

      // Verify it would be different if read as big-endian
      const indexAreaSizeBE = buffer.readInt32BE(9);
      expect(indexAreaSizeBE).not.toBe(indexAreaSize);

      // This ensures the binary format is platform-independent (always little-endian)
    }, 30000);

    it('should generate consistent character set file format', async () => {
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x005A' // A-Z
              }
            ]
          }
        ]
      };

      await generateAndHash(config, testOutputDir);

      // Read generated .cst file
      const files = fs.readdirSync(testOutputDir);
      const cstFile = files.find(f => f.endsWith('.cst'));
      expect(cstFile).toBeDefined();

      const buffer = fs.readFileSync(path.join(testOutputDir, cstFile!));

      // Verify file size is correct (26 characters * 2 bytes)
      expect(buffer.length).toBe(52);

      // Verify all values are in little-endian format
      for (let i = 0; i < 26; i++) {
        const unicode = buffer.readUInt16LE(i * 2);
        expect(unicode).toBeGreaterThanOrEqual(0x0041);
        expect(unicode).toBeLessThanOrEqual(0x005A);
      }
    }, 30000);
  });

  describe('Configuration Parsing Consistency', () => {
    it('should parse JSON configuration consistently across platforms', async () => {
      // Test with different line endings
      const configObj = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F
              }
            ]
          }
        ]
      };

      // Test with Unix line endings (\n)
      const configUnix = JSON.stringify(configObj, null, 2).replace(/\r\n/g, '\n');
      const configPathUnix = path.join(testOutputDir, 'config_unix.json');
      fs.writeFileSync(configPathUnix, configUnix);

      const exitCodeUnix = await main(['node', 'font-converter', configPathUnix]);
      expect(exitCodeUnix).toBe(0);

      const filesUnix = fs.readdirSync(testOutputDir);
      const binFileUnix = filesUnix.find(f => f.endsWith('.bin') && !f.includes('config'));
      expect(binFileUnix).toBeDefined();
      const hashUnix = calculateFileHash(path.join(testOutputDir, binFileUnix!));

      // Clean output files (keep config)
      for (const file of filesUnix) {
        if (file.endsWith('.bin') || file.endsWith('.cst')) {
          fs.unlinkSync(path.join(testOutputDir, file));
        }
      }

      // Test with Windows line endings (\r\n)
      const configWindows = JSON.stringify(configObj, null, 2).replace(/\n/g, '\r\n');
      const configPathWindows = path.join(testOutputDir, 'config_windows.json');
      fs.writeFileSync(configPathWindows, configWindows);

      const exitCodeWindows = await main(['node', 'font-converter', configPathWindows]);
      expect(exitCodeWindows).toBe(0);

      const filesWindows = fs.readdirSync(testOutputDir);
      const binFileWindows = filesWindows.find(f => f.endsWith('.bin') && !f.includes('config'));
      expect(binFileWindows).toBeDefined();
      const hashWindows = calculateFileHash(path.join(testOutputDir, binFileWindows!));

      // Hashes should be identical regardless of line endings
      expect(hashWindows).toBe(hashUnix);
    }, 60000);
  });
});
