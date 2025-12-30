/**
 * End-to-End Integration Tests
 * 
 * Tests complete font generation workflows from configuration to output files.
 * Validates that all components work together correctly.
 * 
 * Task: 18.1
 */

import * as fs from 'fs';
import * as path from 'path';
import { main } from '../src/main';
import { ConfigManager } from '../src/config';

describe('E2E Integration Tests', () => {
  const testOutputDir = path.join(__dirname, '../test-output/e2e');
  const testFontPath = path.join(__dirname, '../Font/NotoSans_Regular.ttf');

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

  describe('Bitmap Font Generation', () => {
    it('should generate complete bitmap font with basic ASCII characters', async () => {
      // Create test configuration
      const configPath = path.join(testOutputDir, 'bitmap_basic_config.json');
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
                value: '0x0020-0x007E' // Basic ASCII
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Run font converter
      const exitCode = await main(['node', 'font-converter', configPath]);

      // Verify success
      expect(exitCode).toBe(0);

      // Verify output files exist
      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      const cstFiles = files.filter(f => f.endsWith('.cst'));

      expect(binFiles.length).toBeGreaterThan(0);
      expect(cstFiles.length).toBeGreaterThan(0);

      // Verify binary file has content
      const binFile = path.join(testOutputDir, binFiles[0]);
      const binStats = fs.statSync(binFile);
      expect(binStats.size).toBeGreaterThan(100); // Should have header + data

      // Verify .cst file has content
      const cstFile = path.join(testOutputDir, cstFiles[0]);
      const cstStats = fs.statSync(cstFile);
      expect(cstStats.size).toBeGreaterThan(4); // Should have at least count + some characters
    }, 30000);

    it('should generate bitmap font with cropping enabled', async () => {
      const configPath = path.join(testOutputDir, 'bitmap_crop_config.json');
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 24,
            renderMode: 4,
            bold: false,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0, // Must be 0 for crop mode
            crop: true,
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

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      // Verify output files
      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      expect(binFiles.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate bitmap font with bold and italic styles', async () => {
      const configPath = path.join(testOutputDir, 'bitmap_styled_config.json');
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 20,
            renderMode: 8,
            bold: true,
            italic: true,
            rotation: 0,
            gamma: 1.2,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0030-0x0039' // 0-9
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      expect(binFiles.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate bitmap font with rotation', async () => {
      const configPath = path.join(testOutputDir, 'bitmap_rotated_config.json');
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 8,
            bold: false,
            italic: false,
            rotation: 1, // 90 degrees
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

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      expect(binFiles.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Vector Font Generation', () => {
    it('should generate complete vector font with basic ASCII characters', async () => {
      const configPath = path.join(testOutputDir, 'vector_basic_config.json');
      const config = {
        fonts: [
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 16,
            renderMode: 0, // Not used for vector
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
                value: '0x0020-0x007E' // Basic ASCII
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      // Verify output files
      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      const cstFiles = files.filter(f => f.endsWith('.cst'));

      expect(binFiles.length).toBeGreaterThan(0);
      expect(cstFiles.length).toBeGreaterThan(0);

      // Verify binary file has content
      const binFile = path.join(testOutputDir, binFiles[0]);
      const binStats = fs.statSync(binFile);
      expect(binStats.size).toBeGreaterThan(100);
    }, 30000);

    it('should generate vector font with offset index method', async () => {
      const configPath = path.join(testOutputDir, 'vector_offset_config.json');
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
            indexMethod: 1, // Offset mode
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

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      expect(binFiles.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Multiple Configuration Processing', () => {
    it('should process multiple font configurations independently', async () => {
      const configPath = path.join(testOutputDir, 'multi_config.json');
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
          },
          {
            fontPath: testFontPath,
            outputPath: testOutputDir,
            fontSize: 24,
            renderMode: 4,
            bold: true,
            italic: false,
            rotation: 0,
            gamma: 1.0,
            indexMethod: 0,
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0030-0x0039' // 0-9
              }
            ]
          },
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
                value: '0x0061-0x007A' // a-z
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      // Verify multiple output files were created
      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      const cstFiles = files.filter(f => f.endsWith('.cst'));

      // Should have 3 .bin files and 3 .cst files
      expect(binFiles.length).toBe(3);
      expect(cstFiles.length).toBe(3);
    }, 60000);

    it('should handle configuration with multiple character sources', async () => {
      const configPath = path.join(testOutputDir, 'multi_charset_config.json');
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
              },
              {
                type: 'range',
                value: '0x0061-0x007A' // a-z
              },
              {
                type: 'range',
                value: '0x0030-0x0039' // 0-9
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFiles = files.filter(f => f.endsWith('.bin'));
      expect(binFiles.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should return non-zero exit code for missing font file', async () => {
      const configPath = path.join(testOutputDir, 'missing_font_config.json');
      const config = {
        fonts: [
          {
            fontPath: '/nonexistent/font.ttf',
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
                value: '0x0041-0x005A'
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).not.toBe(0);
    }, 10000);

    it('should return non-zero exit code for invalid configuration', async () => {
      const configPath = path.join(testOutputDir, 'invalid_config.json');
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
            indexMethod: 1, // Offset mode
            crop: true, // Invalid: crop=true with indexMethod=1
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x005A'
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);

      expect(exitCode).not.toBe(0);
    }, 10000);
  });
});
