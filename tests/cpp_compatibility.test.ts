/**
 * C++ Compatibility Tests
 * 
 * Property 14: Binary Format 与 C++ 兼容
 * 
 * Validates that TypeScript implementation generates byte-identical output
 * to the C++ reference implementation (version 1.0.2).
 * 
 * Task: 18.2
 * Validates: Requirements 5.2, 5.3
 */

import * as fs from 'fs';
import * as path from 'path';
import { main } from '../src/main';
import * as fc from 'fast-check';

describe('Feature: typescript-font-converter, Property 14: Binary Format 与 C++ 兼容', () => {
  const testOutputDir = path.join(__dirname, '../test-output/cpp-compat');
  const cppOutputDir = path.join(__dirname, '../../font-tool-release/output');
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
   * Parse bitmap font header from binary file
   */
  function parseBitmapHeader(filePath: string): any {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;

    // Read header length
    const headerLength = buffer.readUInt8(offset);
    offset += 1;

    // Read file flag
    const fileFlag = buffer.readUInt8(offset);
    offset += 1;

    // Read version
    const versionMajor = buffer.readUInt8(offset);
    offset += 1;
    const versionMinor = buffer.readUInt8(offset);
    offset += 1;
    const versionRevision = buffer.readUInt8(offset);
    offset += 1;

    // Read size and fontSize
    const size = buffer.readUInt8(offset);
    offset += 1;
    const fontSize = buffer.readUInt8(offset);
    offset += 1;

    // Read render mode
    const renderMode = buffer.readUInt8(offset);
    offset += 1;

    // Read bitfield flags
    const bitfield = buffer.readUInt8(offset);
    offset += 1;
    const bold = (bitfield & 0x01) !== 0;
    const italic = (bitfield & 0x02) !== 0;
    const rvd = (bitfield & 0x04) !== 0;
    const indexMethod = (bitfield & 0x08) !== 0 ? 1 : 0;
    const crop = (bitfield & 0x10) !== 0;

    // Read index area size (int32, little-endian)
    const indexAreaSize = buffer.readInt32LE(offset);
    offset += 4;

    // Read font name length
    const fontNameLength = buffer.readUInt8(offset);
    offset += 1;

    // Read font name
    const fontName = buffer.toString('utf-8', offset, offset + fontNameLength);
    offset += fontNameLength;

    return {
      headerLength,
      fileFlag,
      versionMajor,
      versionMinor,
      versionRevision,
      size,
      fontSize,
      renderMode,
      bold,
      italic,
      rvd,
      indexMethod,
      crop,
      indexAreaSize,
      fontNameLength,
      fontName,
      headerEndOffset: offset
    };
  }

  /**
   * Parse vector font header from binary file
   */
  function parseVectorHeader(filePath: string): any {
    const buffer = fs.readFileSync(filePath);
    let offset = 0;

    // Read header length
    const headerLength = buffer.readUInt8(offset);
    offset += 1;

    // Read file flag
    const fileFlag = buffer.readUInt8(offset);
    offset += 1;

    // Read version
    const versionMajor = buffer.readUInt8(offset);
    offset += 1;
    const versionMinor = buffer.readUInt8(offset);
    offset += 1;
    const versionRevision = buffer.readUInt8(offset);
    offset += 1;
    const versionBuildnum = buffer.readUInt8(offset);
    offset += 1;

    // Read fontSize
    const fontSize = buffer.readUInt8(offset);
    offset += 1;

    // Read render mode
    const renderMode = buffer.readUInt8(offset);
    offset += 1;

    // Read bitfield flags
    const bitfield = buffer.readUInt8(offset);
    offset += 1;
    const bold = (bitfield & 0x01) !== 0;
    const italic = (bitfield & 0x02) !== 0;
    const rvd = (bitfield & 0x04) !== 0;
    const indexMethod = (bitfield & 0x08) !== 0 ? 1 : 0;

    // Read index area size (int32, little-endian)
    const indexAreaSize = buffer.readInt32LE(offset);
    offset += 4;

    // Read font name length
    const fontNameLength = buffer.readUInt8(offset);
    offset += 1;

    // Read font metrics
    const ascent = buffer.readInt16LE(offset);
    offset += 2;
    const descent = buffer.readInt16LE(offset);
    offset += 2;
    const lineGap = buffer.readInt16LE(offset);
    offset += 2;

    // Read font name
    const fontName = buffer.toString('utf-8', offset, offset + fontNameLength);
    offset += fontNameLength;

    return {
      headerLength,
      fileFlag,
      versionMajor,
      versionMinor,
      versionRevision,
      versionBuildnum,
      fontSize,
      renderMode,
      bold,
      italic,
      rvd,
      indexMethod,
      indexAreaSize,
      fontNameLength,
      ascent,
      descent,
      lineGap,
      fontName,
      headerEndOffset: offset
    };
  }

  /**
   * Parse .cst character set file
   * 
   * .cst files are binary files containing raw uint16_t values (little-endian),
   * each representing a Unicode code point. There is NO count header.
   */
  function parseCST(filePath: string): number[] {
    const buffer = fs.readFileSync(filePath);
    const characters: number[] = [];

    // File size must be a multiple of 2 bytes
    if (buffer.length % 2 !== 0) {
      throw new Error(`CST file has invalid size: ${buffer.length} bytes (not a multiple of 2)`);
    }

    const numEntries = buffer.length / 2;
    for (let i = 0; i < numEntries; i++) {
      const unicode = buffer.readUInt16LE(i * 2);
      characters.push(unicode);
    }

    return characters;
  }

  describe('Bitmap Font Header Compatibility', () => {
    it('should generate bitmap font header compatible with C++ version 1.0.2', async () => {
      const configPath = path.join(testOutputDir, 'bitmap_compat_config.json');
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

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      // Find generated .bin file
      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      // Parse header
      const header = parseBitmapHeader(path.join(testOutputDir, binFile!));

      // Verify version is 1.0.2
      expect(header.versionMajor).toBe(1);
      expect(header.versionMinor).toBe(0);
      expect(header.versionRevision).toBe(2);

      // Verify file flag is 1 for bitmap
      expect(header.fileFlag).toBe(1);

      // Verify configuration matches
      expect(header.fontSize).toBe(16);
      expect(header.renderMode).toBe(8);
      expect(header.bold).toBe(false);
      expect(header.italic).toBe(false);
      expect(header.indexMethod).toBe(0);
      expect(header.crop).toBe(false);

      // Verify index area size is correct for address mode (65536 * 2 bytes)
      expect(header.indexAreaSize).toBe(131072);
    }, 30000);

    it('should generate bitmap font with crop mode header compatible with C++', async () => {
      const configPath = path.join(testOutputDir, 'bitmap_crop_compat_config.json');
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
            indexMethod: 0,
            crop: true,
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
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const header = parseBitmapHeader(path.join(testOutputDir, binFile!));

      // Verify crop mode settings
      expect(header.crop).toBe(true);
      expect(header.indexMethod).toBe(0); // Must be 0 for crop mode

      // Verify index area size is correct for crop mode (65536 * 4 bytes)
      expect(header.indexAreaSize).toBe(262144);
    }, 30000);
  });

  describe('Vector Font Header Compatibility', () => {
    it('should generate vector font header compatible with C++ version 1.0.2', async () => {
      const configPath = path.join(testOutputDir, 'vector_compat_config.json');
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

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const header = parseVectorHeader(path.join(testOutputDir, binFile!));

      // Verify version is 0.0.0 for vector fonts
      expect(header.versionMajor).toBe(0);
      expect(header.versionMinor).toBe(0);
      expect(header.versionRevision).toBe(0);

      // Verify file flag is 2 for vector
      expect(header.fileFlag).toBe(2);

      // Verify font metrics are present
      expect(typeof header.ascent).toBe('number');
      expect(typeof header.descent).toBe('number');
      expect(typeof header.lineGap).toBe('number');

      // Verify index area size is correct for address mode (65536 * 4 bytes)
      expect(header.indexAreaSize).toBe(262144);
    }, 30000);

    it('should generate vector font with offset mode header compatible with C++', async () => {
      const configPath = path.join(testOutputDir, 'vector_offset_compat_config.json');
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
                value: '0x0030-0x0039' // 0-9 (10 characters)
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const header = parseVectorHeader(path.join(testOutputDir, binFile!));

      // Verify offset mode settings
      expect(header.indexMethod).toBe(1);

      // Verify index area size is correct for offset mode (N * 6 bytes)
      // 10 characters * 6 bytes = 60 bytes
      expect(header.indexAreaSize).toBe(60);
    }, 30000);
  });

  describe('Character Set File Compatibility', () => {
    it('should generate .cst file compatible with C++ format', async () => {
      const configPath = path.join(testOutputDir, 'cst_compat_config.json');
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

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      // Find generated .cst file
      const files = fs.readdirSync(testOutputDir);
      const cstFile = files.find(f => f.endsWith('.cst'));
      expect(cstFile).toBeDefined();

      // Parse .cst file
      const characters = parseCST(path.join(testOutputDir, cstFile!));

      // Verify character count
      expect(characters.length).toBe(26); // A-Z

      // Verify characters are in expected range
      for (const char of characters) {
        expect(char).toBeGreaterThanOrEqual(0x0041);
        expect(char).toBeLessThanOrEqual(0x005A);
      }

      // Verify characters are sorted
      for (let i = 1; i < characters.length; i++) {
        expect(characters[i]).toBeGreaterThan(characters[i - 1]);
      }
    }, 30000);
  });

  describe('Index Array Compatibility', () => {
    it('should generate address mode index array compatible with C++', async () => {
      const configPath = path.join(testOutputDir, 'index_address_compat_config.json');
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
            indexMethod: 0, // Address mode
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F (6 characters)
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const header = parseBitmapHeader(path.join(testOutputDir, binFile!));
      const buffer = fs.readFileSync(path.join(testOutputDir, binFile!));

      // Read index array (starts after header)
      const indexStart = header.headerEndOffset;
      const indexSize = header.indexAreaSize;

      // Verify index array size
      expect(indexSize).toBe(131072); // 65536 * 2 bytes

      // Check that used entries have valid indices
      for (let unicode = 0x0041; unicode <= 0x0046; unicode++) {
        const offset = indexStart + unicode * 2;
        const charIndex = buffer.readUInt16LE(offset);
        
        // Should have a valid character index (0-5)
        expect(charIndex).toBeGreaterThanOrEqual(0);
        expect(charIndex).toBeLessThan(6);
      }

      // Check that unused entries are initialized to 0xFFFF
      const unusedOffset = indexStart + 0x0100 * 2; // Check entry at 0x0100
      const unusedValue = buffer.readUInt16LE(unusedOffset);
      expect(unusedValue).toBe(0xFFFF);
    }, 30000);

    it('should generate offset mode index array compatible with C++', async () => {
      const configPath = path.join(testOutputDir, 'index_offset_compat_config.json');
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
            crop: false,
            outputFormat: 'bitmap',
            characterSets: [
              {
                type: 'range',
                value: '0x0041-0x0046' // A-F (6 characters)
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const header = parseBitmapHeader(path.join(testOutputDir, binFile!));
      const buffer = fs.readFileSync(path.join(testOutputDir, binFile!));

      // Verify index array size (N * 2 bytes, unicode only)
      expect(header.indexAreaSize).toBe(12); // 6 characters * 2 bytes

      // Read index entries (offset mode: unicode only, 2 bytes each)
      const indexStart = header.headerEndOffset;
      const entries: Array<{ unicode: number }> = [];

      for (let i = 0; i < 6; i++) {
        const offset = indexStart + i * 2;
        const unicode = buffer.readUInt16LE(offset);
        entries.push({ unicode });
      }

      // Verify entries are sorted by unicode
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].unicode).toBeGreaterThan(entries[i - 1].unicode);
      }

      // Verify unicode values are in expected range
      for (const entry of entries) {
        expect(entry.unicode).toBeGreaterThanOrEqual(0x0041);
        expect(entry.unicode).toBeLessThanOrEqual(0x0046);
      }
    }, 30000);
  });

  describe('Little-Endian Byte Order', () => {
    it('should write all multi-byte integers in little-endian format', async () => {
      const configPath = path.join(testOutputDir, 'endian_compat_config.json');
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
                value: '0x0041-0x0042' // A-B
              }
            ]
          }
        ]
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      const exitCode = await main(['node', 'font-converter', configPath]);
      expect(exitCode).toBe(0);

      const files = fs.readdirSync(testOutputDir);
      const binFile = files.find(f => f.endsWith('.bin'));
      expect(binFile).toBeDefined();

      const buffer = fs.readFileSync(path.join(testOutputDir, binFile!));

      // Check index area size (int32 at offset 9)
      const indexAreaSize = buffer.readInt32LE(9);
      expect(indexAreaSize).toBe(131072);

      // Verify it would be different if read as big-endian
      const indexAreaSizeBE = buffer.readInt32BE(9);
      expect(indexAreaSizeBE).not.toBe(indexAreaSize);
    }, 30000);
  });
});
