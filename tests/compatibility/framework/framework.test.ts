/**
 * Framework Verification Tests
 * 
 * This test file verifies that all comparison functionality in the
 * compatibility testing framework is working correctly.
 * 
 * Checkpoint Task 6: 确认所有对比功能可用
 */

import {
  // Header Parser
  parseBitmapHeader,
  parseVectorHeader,
  parseHeader,
  detectFileType,
  isBitmapHeader,
  isVectorHeader,
  formatBitmapHeader,
  formatVectorHeader,
  ParsedBitmapHeader,
  ParsedVectorHeader,
  
  // Index Validator
  validateAddressModeIndex,
  validateOffsetModeIndex,
  validateIndex,
  validateCharacterMapping,
  INDEX_METHOD,
  ADDRESS_MODE,
  OFFSET_MODE,
  formatIndexValidationResult,
  
  // Comparator
  compareHeaders,
  compareCst,
  hexDump,
  findFirstDifference,
  formatHeaderComparisonResult,
  formatCstComparisonResult,
  
  // Glyph Analyzer
  calculatePixelDiffRate,
  calculatePSNR,
  determineGlyphStatus,
  getMaxPixelValue,
  DEFAULT_GLYPH_CONFIG,
  formatGlyphComparisonResult
} from './index';

describe('Header Parser', () => {
  describe('Bitmap Header Parsing', () => {
    it('should parse a valid bitmap header', () => {
      // Create a mock bitmap header buffer
      // Header structure: length(1) + fileFlag(1) + version(3) + size(1) + fontSize(1) + 
      //                   renderMode(1) + bitfield(1) + indexAreaSize(4) + fontNameLength(1) + fontName
      const fontName = 'TestFont';
      const headerLength = 14 + fontName.length + 1; // +1 for null terminator
      
      const buffer = Buffer.alloc(headerLength);
      let offset = 0;
      
      buffer.writeUInt8(headerLength, offset++);  // length
      buffer.writeUInt8(1, offset++);             // fileFlag (BITMAP)
      buffer.writeUInt8(1, offset++);             // versionMajor
      buffer.writeUInt8(0, offset++);             // versionMinor
      buffer.writeUInt8(2, offset++);             // versionRevision
      buffer.writeUInt8(16, offset++);            // size
      buffer.writeUInt8(16, offset++);            // fontSize
      buffer.writeUInt8(4, offset++);             // renderMode (4-bit)
      buffer.writeUInt8(0x00, offset++);          // bitfield (no flags)
      buffer.writeInt32LE(262144, offset);        // indexAreaSize (65536 * 4)
      offset += 4;
      buffer.writeUInt8(fontName.length + 1, offset++); // fontNameLength
      buffer.write(fontName + '\0', offset);      // fontName with null terminator
      
      const header = parseBitmapHeader(buffer);
      
      expect(header.length).toBe(headerLength);
      expect(header.fileFlag).toBe(1);
      expect(header.versionMajor).toBe(1);
      expect(header.versionMinor).toBe(0);
      expect(header.versionRevision).toBe(2);
      expect(header.size).toBe(16);
      expect(header.fontSize).toBe(16);
      expect(header.renderMode).toBe(4);
      expect(header.bold).toBe(false);
      expect(header.italic).toBe(false);
      expect(header.indexMethod).toBe(0);
      expect(header.crop).toBe(false);
      expect(header.indexAreaSize).toBe(262144);
      expect(header.fontName).toBe(fontName);
    });

    it('should parse bitfield flags correctly', () => {
      const fontName = 'Test';
      const headerLength = 14 + fontName.length + 1;
      const buffer = Buffer.alloc(headerLength);
      
      let offset = 0;
      buffer.writeUInt8(headerLength, offset++);
      buffer.writeUInt8(1, offset++);
      buffer.writeUInt8(1, offset++);
      buffer.writeUInt8(0, offset++);
      buffer.writeUInt8(2, offset++);
      buffer.writeUInt8(16, offset++);
      buffer.writeUInt8(16, offset++);
      buffer.writeUInt8(4, offset++);
      // bitfield: bold=1, italic=1, rvd=0, indexMethod=1, crop=1 = 0x1B
      buffer.writeUInt8(0x1B, offset++);
      buffer.writeInt32LE(600, offset);
      offset += 4;
      buffer.writeUInt8(fontName.length + 1, offset++);
      buffer.write(fontName + '\0', offset);
      
      const header = parseBitmapHeader(buffer);
      
      expect(header.bold).toBe(true);
      expect(header.italic).toBe(true);
      expect(header.rvd).toBe(false);
      expect(header.indexMethod).toBe(1);
      expect(header.crop).toBe(true);
    });
  });


  describe('Vector Header Parsing', () => {
    it('should parse a valid vector header', () => {
      const fontName = 'VectorFont';
      const headerLength = 20 + fontName.length + 1;
      
      const buffer = Buffer.alloc(headerLength);
      let offset = 0;
      
      buffer.writeUInt8(headerLength, offset++);  // length
      buffer.writeUInt8(2, offset++);             // fileFlag (VECTOR)
      buffer.writeUInt8(1, offset++);             // versionMajor
      buffer.writeUInt8(0, offset++);             // versionMinor
      buffer.writeUInt8(2, offset++);             // versionRevision
      buffer.writeUInt8(0, offset++);             // versionBuildnum
      buffer.writeUInt8(24, offset++);            // fontSize
      buffer.writeUInt8(0, offset++);             // renderMode
      buffer.writeUInt8(0x00, offset++);          // bitfield
      buffer.writeInt32LE(262144, offset);        // indexAreaSize
      offset += 4;
      buffer.writeUInt8(fontName.length + 1, offset++); // fontNameLength
      buffer.writeInt16LE(800, offset);           // ascent
      offset += 2;
      buffer.writeInt16LE(-200, offset);          // descent
      offset += 2;
      buffer.writeInt16LE(100, offset);           // lineGap
      offset += 2;
      buffer.write(fontName + '\0', offset);      // fontName
      
      const header = parseVectorHeader(buffer);
      
      expect(header.length).toBe(headerLength);
      expect(header.fileFlag).toBe(2);
      expect(header.versionMajor).toBe(1);
      expect(header.fontSize).toBe(24);
      expect(header.ascent).toBe(800);
      expect(header.descent).toBe(-200);
      expect(header.lineGap).toBe(100);
      expect(header.fontName).toBe(fontName);
    });
  });

  describe('File Type Detection', () => {
    it('should detect bitmap file type', () => {
      const buffer = Buffer.alloc(10);
      buffer.writeUInt8(1, 1); // fileFlag at offset 1
      expect(detectFileType(buffer)).toBe('bitmap');
    });

    it('should detect vector file type', () => {
      const buffer = Buffer.alloc(10);
      buffer.writeUInt8(2, 1); // fileFlag at offset 1
      expect(detectFileType(buffer)).toBe('vector');
    });

    it('should return unknown for invalid file type', () => {
      const buffer = Buffer.alloc(10);
      buffer.writeUInt8(99, 1);
      expect(detectFileType(buffer)).toBe('unknown');
    });

    it('should return unknown for too small buffer', () => {
      const buffer = Buffer.alloc(1);
      expect(detectFileType(buffer)).toBe('unknown');
    });
  });

  describe('Type Guards', () => {
    it('should identify bitmap header', () => {
      const bitmapHeader: ParsedBitmapHeader = {
        length: 20, fileFlag: 1, versionMajor: 1, versionMinor: 0,
        versionRevision: 2, size: 16, fontSize: 16, renderMode: 4,
        bold: false, italic: false, rvd: false, indexMethod: 0,
        crop: false, rsvd: 0, indexAreaSize: 262144, fontNameLength: 5,
        fontName: 'Test', rawBitfield: 0
      };
      
      expect(isBitmapHeader(bitmapHeader)).toBe(true);
      expect(isVectorHeader(bitmapHeader)).toBe(false);
    });

    it('should identify vector header', () => {
      const vectorHeader: ParsedVectorHeader = {
        length: 30, fileFlag: 2, versionMajor: 1, versionMinor: 0,
        versionRevision: 2, versionBuildnum: 0, fontSize: 24, renderMode: 0,
        bold: false, italic: false, rvd: false, indexMethod: 0,
        rsvd: 0, indexAreaSize: 262144, fontNameLength: 5,
        ascent: 800, descent: -200, lineGap: 100,
        fontName: 'Test', rawBitfield: 0
      };
      
      expect(isVectorHeader(vectorHeader)).toBe(true);
      expect(isBitmapHeader(vectorHeader)).toBe(false);
    });
  });
});


describe('Index Validator', () => {
  // Helper to create a mock bitmap header
  function createMockBitmapHeader(indexMethod: number, indexAreaSize: number): ParsedBitmapHeader {
    return {
      length: 23, fileFlag: 1, versionMajor: 1, versionMinor: 0,
      versionRevision: 2, size: 16, fontSize: 16, renderMode: 4,
      bold: false, italic: false, rvd: false, indexMethod,
      crop: false, rsvd: 0, indexAreaSize, fontNameLength: 9,
      fontName: 'TestFont', rawBitfield: indexMethod === 1 ? 0x08 : 0x00
    };
  }

  describe('Address Mode Validation', () => {
    it('should validate correct address mode index', () => {
      const header = createMockBitmapHeader(0, ADDRESS_MODE.TOTAL_ENTRIES * ADDRESS_MODE.BYTES_PER_ENTRY);
      
      // Create buffer with header + index area
      const indexSize = ADDRESS_MODE.TOTAL_ENTRIES * ADDRESS_MODE.BYTES_PER_ENTRY;
      const buffer = Buffer.alloc(header.length + indexSize);
      
      // Fill index with invalid markers (0xFFFFFFFF)
      for (let i = 0; i < ADDRESS_MODE.TOTAL_ENTRIES; i++) {
        buffer.writeUInt32LE(0xFFFFFFFF, header.length + i * 4);
      }
      
      // Set a few valid entries
      buffer.writeUInt32LE(1000, header.length + 0x41 * 4); // 'A'
      buffer.writeUInt32LE(1100, header.length + 0x42 * 4); // 'B'
      
      const result = validateAddressModeIndex(buffer, header);
      
      expect(result.success).toBe(true);
      expect(result.indexMethod).toBe(0);
      expect(result.indexMethodName).toBe('ADDRESS');
      expect(result.totalEntries).toBe(65536);
      expect(result.validEntries).toBe(2);
    });

    it('should detect wrong index method', () => {
      const header = createMockBitmapHeader(1, 600); // Offset mode header
      const buffer = Buffer.alloc(header.length + 600);
      
      const result = validateAddressModeIndex(buffer, header);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Expected Address mode');
    });
  });

  describe('Offset Mode Validation', () => {
    it('should validate correct offset mode index', () => {
      const entryCount = 100;
      const indexAreaSize = entryCount * OFFSET_MODE.BYTES_PER_ENTRY;
      const header = createMockBitmapHeader(1, indexAreaSize);
      
      const buffer = Buffer.alloc(header.length + indexAreaSize + 10000);
      
      // Write sorted entries
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = header.length + i * OFFSET_MODE.BYTES_PER_ENTRY;
        buffer.writeUInt16LE(0x20 + i, entryOffset);     // unicode (sorted)
        buffer.writeUInt32LE(1000 + i * 50, entryOffset + 2); // offset
      }
      
      const result = validateOffsetModeIndex(buffer, header);
      
      expect(result.success).toBe(true);
      expect(result.indexMethod).toBe(1);
      expect(result.indexMethodName).toBe('OFFSET');
      expect(result.totalEntries).toBe(entryCount);
      expect(result.validEntries).toBe(entryCount);
    });

    it('should detect duplicate unicode entries', () => {
      const entryCount = 10;
      const indexAreaSize = entryCount * OFFSET_MODE.BYTES_PER_ENTRY;
      const header = createMockBitmapHeader(1, indexAreaSize);
      
      const buffer = Buffer.alloc(header.length + indexAreaSize + 10000);
      
      // Write entries with duplicate
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = header.length + i * OFFSET_MODE.BYTES_PER_ENTRY;
        const unicode = i === 5 ? 0x20 : 0x20 + i; // Duplicate at index 5
        buffer.writeUInt16LE(unicode, entryOffset);
        buffer.writeUInt32LE(1000 + i * 50, entryOffset + 2);
      }
      
      const result = validateOffsetModeIndex(buffer, header);
      
      expect(result.issues.some(i => i.type === 'duplicate_unicode')).toBe(true);
    });
  });

  describe('Character Mapping Validation', () => {
    it('should validate character mapping in address mode', () => {
      const header = createMockBitmapHeader(0, ADDRESS_MODE.TOTAL_ENTRIES * ADDRESS_MODE.BYTES_PER_ENTRY);
      const indexSize = ADDRESS_MODE.TOTAL_ENTRIES * ADDRESS_MODE.BYTES_PER_ENTRY;
      const buffer = Buffer.alloc(header.length + indexSize);
      
      // Fill with invalid markers
      for (let i = 0; i < ADDRESS_MODE.TOTAL_ENTRIES; i++) {
        buffer.writeUInt32LE(0xFFFFFFFF, header.length + i * 4);
      }
      
      // Set valid entries for ASCII printable range
      for (let unicode = 0x20; unicode <= 0x7E; unicode++) {
        buffer.writeUInt32LE(1000 + unicode * 10, header.length + unicode * 4);
      }
      
      const expectedChars = [0x41, 0x42, 0x43]; // A, B, C
      const result = validateCharacterMapping(buffer, header, expectedChars);
      
      expect(result.success).toBe(true);
      expect(result.foundCharacters).toEqual(expectedChars);
      expect(result.missingCharacters).toHaveLength(0);
    });
  });
});


describe('Comparator', () => {
  describe('Hex Dump', () => {
    it('should generate correct hex dump', () => {
      const buffer = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const dump = hexDump(buffer, 0, 5);
      
      expect(dump).toContain('48 65 6c 6c 6f');
      expect(dump).toContain('Hello');
    });

    it('should handle non-printable characters', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      const dump = hexDump(buffer, 0, 4);
      
      expect(dump).toContain('00 01 02 ff');
      expect(dump).toContain('....');
    });
  });

  describe('Find First Difference', () => {
    it('should return -1 for identical buffers', () => {
      const buf1 = Buffer.from([1, 2, 3, 4, 5]);
      const buf2 = Buffer.from([1, 2, 3, 4, 5]);
      
      expect(findFirstDifference(buf1, buf2)).toBe(-1);
    });

    it('should find first difference', () => {
      const buf1 = Buffer.from([1, 2, 3, 4, 5]);
      const buf2 = Buffer.from([1, 2, 9, 4, 5]);
      
      expect(findFirstDifference(buf1, buf2)).toBe(2);
    });

    it('should handle different length buffers', () => {
      const buf1 = Buffer.from([1, 2, 3]);
      const buf2 = Buffer.from([1, 2, 3, 4, 5]);
      
      expect(findFirstDifference(buf1, buf2)).toBe(3);
    });
  });

  describe('Header Comparison', () => {
    function createBitmapHeaderBuffer(fontName: string, renderMode: number): Buffer {
      const headerLength = 14 + fontName.length + 1;
      const buffer = Buffer.alloc(headerLength);
      let offset = 0;
      
      buffer.writeUInt8(headerLength, offset++);
      buffer.writeUInt8(1, offset++);
      buffer.writeUInt8(1, offset++);
      buffer.writeUInt8(0, offset++);
      buffer.writeUInt8(2, offset++);
      buffer.writeUInt8(16, offset++);
      buffer.writeUInt8(16, offset++);
      buffer.writeUInt8(renderMode, offset++);
      buffer.writeUInt8(0x00, offset++);
      buffer.writeInt32LE(262144, offset);
      offset += 4;
      buffer.writeUInt8(fontName.length + 1, offset++);
      buffer.write(fontName + '\0', offset);
      
      return buffer;
    }

    it('should detect matching headers', () => {
      const cpp = createBitmapHeaderBuffer('TestFont', 4);
      const ts = createBitmapHeaderBuffer('TestFont', 4);
      
      const result = compareHeaders(cpp, ts);
      
      expect(result.match).toBe(true);
      expect(result.fileType).toBe('bitmap');
      expect(result.differences).toHaveLength(0);
    });

    it('should detect header differences', () => {
      const cpp = createBitmapHeaderBuffer('TestFont', 4);
      const ts = createBitmapHeaderBuffer('TestFont', 8); // Different render mode
      
      const result = compareHeaders(cpp, ts);
      
      expect(result.match).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
      expect(result.differences.some(d => d.field === 'renderMode')).toBe(true);
    });
  });

  describe('CST Comparison', () => {
    it('should detect matching CST files', () => {
      const cpp = Buffer.from([0x41, 0x00, 0x42, 0x00, 0x43, 0x00]);
      const ts = Buffer.from([0x41, 0x00, 0x42, 0x00, 0x43, 0x00]);
      
      const result = compareCst(cpp, ts);
      
      expect(result.match).toBe(true);
      expect(result.cppSize).toBe(6);
      expect(result.tsSize).toBe(6);
    });

    it('should detect CST content differences', () => {
      const cpp = Buffer.from([0x41, 0x00, 0x42, 0x00, 0x43, 0x00]);
      const ts = Buffer.from([0x41, 0x00, 0x99, 0x00, 0x43, 0x00]);
      
      const result = compareCst(cpp, ts);
      
      expect(result.match).toBe(false);
      expect(result.firstDiffOffset).toBe(2);
      expect(result.diffCount).toBe(1);
    });

    it('should detect CST size differences', () => {
      const cpp = Buffer.from([0x41, 0x00, 0x42, 0x00]);
      const ts = Buffer.from([0x41, 0x00, 0x42, 0x00, 0x43, 0x00]);
      
      const result = compareCst(cpp, ts);
      
      expect(result.match).toBe(false);
      expect(result.error).toContain('Size mismatch');
    });
  });
});


describe('Glyph Analyzer', () => {
  describe('Pixel Difference Rate', () => {
    it('should return 0 for identical data', () => {
      const cpp = new Uint8Array([100, 150, 200, 255]);
      const ts = new Uint8Array([100, 150, 200, 255]);
      
      expect(calculatePixelDiffRate(cpp, ts)).toBe(0);
    });

    it('should calculate correct difference rate', () => {
      const cpp = new Uint8Array([100, 150, 200, 255]);
      const ts = new Uint8Array([100, 150, 201, 255]); // 1 different out of 4
      
      expect(calculatePixelDiffRate(cpp, ts)).toBe(0.25);
    });

    it('should handle empty arrays', () => {
      const cpp = new Uint8Array([]);
      const ts = new Uint8Array([]);
      
      expect(calculatePixelDiffRate(cpp, ts)).toBe(0);
    });

    it('should handle different length arrays', () => {
      const cpp = new Uint8Array([100, 150]);
      const ts = new Uint8Array([100, 150, 200, 255]);
      
      const rate = calculatePixelDiffRate(cpp, ts);
      expect(rate).toBe(0.5); // 2 extra bytes out of 4
    });
  });

  describe('PSNR Calculation', () => {
    it('should return Infinity for identical data', () => {
      const cpp = new Uint8Array([100, 150, 200, 255]);
      const ts = new Uint8Array([100, 150, 200, 255]);
      
      expect(calculatePSNR(cpp, ts)).toBe(Infinity);
    });

    it('should return finite value for different data', () => {
      const cpp = new Uint8Array([100, 150, 200, 255]);
      const ts = new Uint8Array([101, 151, 201, 254]);
      
      const psnr = calculatePSNR(cpp, ts);
      expect(psnr).toBeGreaterThan(0);
      expect(psnr).toBeLessThan(Infinity);
    });

    it('should return lower PSNR for more different data', () => {
      const cpp = new Uint8Array([100, 150, 200, 255]);
      const ts1 = new Uint8Array([101, 151, 201, 254]); // Small diff
      const ts2 = new Uint8Array([50, 100, 150, 200]);  // Large diff
      
      const psnr1 = calculatePSNR(cpp, ts1);
      const psnr2 = calculatePSNR(cpp, ts2);
      
      expect(psnr1).toBeGreaterThan(psnr2);
    });
  });

  describe('Glyph Status Determination', () => {
    it('should return identical for zero difference', () => {
      expect(determineGlyphStatus(0, Infinity)).toBe('identical');
    });

    it('should return similar for small differences', () => {
      expect(determineGlyphStatus(0.02, 35)).toBe('similar');
    });

    it('should return different for large differences', () => {
      expect(determineGlyphStatus(0.1, 20)).toBe('different');
    });
  });

  describe('Max Pixel Value', () => {
    it('should return correct max values for render modes', () => {
      expect(getMaxPixelValue(1)).toBe(1);
      expect(getMaxPixelValue(2)).toBe(3);
      expect(getMaxPixelValue(4)).toBe(15);
      expect(getMaxPixelValue(8)).toBe(255);
    });
  });

  describe('Default Configuration', () => {
    it('should have reasonable default thresholds', () => {
      expect(DEFAULT_GLYPH_CONFIG.passThreshold).toBe(0.01);
      expect(DEFAULT_GLYPH_CONFIG.partialThreshold).toBe(0.05);
      expect(DEFAULT_GLYPH_CONFIG.psnrPassThreshold).toBe(40);
      expect(DEFAULT_GLYPH_CONFIG.psnrPartialThreshold).toBe(30);
    });
  });
});

describe('Format Functions', () => {
  it('should format bitmap header', () => {
    const header: ParsedBitmapHeader = {
      length: 23, fileFlag: 1, versionMajor: 1, versionMinor: 0,
      versionRevision: 2, size: 16, fontSize: 16, renderMode: 4,
      bold: true, italic: false, rvd: false, indexMethod: 0,
      crop: false, rsvd: 0, indexAreaSize: 262144, fontNameLength: 9,
      fontName: 'TestFont', rawBitfield: 0x01
    };
    
    const formatted = formatBitmapHeader(header);
    
    expect(formatted).toContain('BitmapFontHeader');
    expect(formatted).toContain('TestFont');
    expect(formatted).toContain('4-bit');
    expect(formatted).toContain('bold: true');
  });

  it('should format vector header', () => {
    const header: ParsedVectorHeader = {
      length: 31, fileFlag: 2, versionMajor: 1, versionMinor: 0,
      versionRevision: 2, versionBuildnum: 0, fontSize: 24, renderMode: 0,
      bold: false, italic: true, rvd: false, indexMethod: 0,
      rsvd: 0, indexAreaSize: 262144, fontNameLength: 11,
      ascent: 800, descent: -200, lineGap: 100,
      fontName: 'VectorFont', rawBitfield: 0x02
    };
    
    const formatted = formatVectorHeader(header);
    
    expect(formatted).toContain('VectorFontHeader');
    expect(formatted).toContain('VectorFont');
    expect(formatted).toContain('ascent: 800');
    expect(formatted).toContain('italic: true');
  });

  it('should format index validation result', () => {
    const result = {
      success: true,
      indexMethod: 0 as const,
      indexMethodName: 'ADDRESS' as const,
      totalEntries: 65536,
      validEntries: 95,
      expectedSize: 262144,
      actualSize: 262144,
      issues: []
    };
    
    const formatted = formatIndexValidationResult(result);
    
    expect(formatted).toContain('PASS');
    expect(formatted).toContain('ADDRESS');
    expect(formatted).toContain('65536');
  });
});
