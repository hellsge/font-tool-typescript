/**
 * Glyph Analyzer for Compatibility Testing
 * 
 * This module provides functions to analyze and compare glyph data between
 * C++ and TypeScript implementations. Since different rendering libraries
 * (FreeType+OpenCV vs opentype.js+sharp) may produce slightly different
 * pixel data, this module supports approximate matching.
 * 
 * Requirements: 5.1-5.8 - Glyph similarity analysis
 */

import * as fs from 'fs';
import {
  ParsedHeader,
  isBitmapHeader
} from './header-parser';
import {
  INDEX_METHOD,
  getAddressModeValidEntries,
  getOffsetModeEntries
} from './index-validator';

/**
 * Glyph analysis status
 */
export type GlyphStatus = 'identical' | 'similar' | 'different';

/**
 * Overall glyph comparison status
 */
export type GlyphComparisonStatus = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Glyph analysis result for a single character
 */
export interface GlyphAnalysis {
  /** Unicode code point */
  unicode: number;
  /** Character representation */
  char: string;
  /** Pixel difference rate (0-1) */
  pixelDiffRate: number;
  /** Peak Signal-to-Noise Ratio in dB */
  psnr: number;
  /** Analysis status */
  status: GlyphStatus;
  /** C++ glyph size in bytes */
  cppSize: number;
  /** TypeScript glyph size in bytes */
  tsSize: number;
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Glyph comparison configuration
 */
export interface GlyphComparisonConfig {
  /** Pixel difference rate threshold for PASS (default: 0.01 = 1%) */
  passThreshold: number;
  /** Pixel difference rate threshold for PARTIAL (default: 0.05 = 5%) */
  partialThreshold: number;
  /** PSNR threshold for PASS in dB (default: 40) */
  psnrPassThreshold: number;
  /** PSNR threshold for PARTIAL in dB (default: 30) */
  psnrPartialThreshold: number;
}

/**
 * Default glyph comparison configuration
 */
export const DEFAULT_GLYPH_CONFIG: GlyphComparisonConfig = {
  passThreshold: 0.01,      // 1% pixel difference
  partialThreshold: 0.05,   // 5% pixel difference
  psnrPassThreshold: 40,    // 40 dB
  psnrPartialThreshold: 30  // 30 dB
};

/**
 * Overall glyph comparison result
 */
export interface GlyphComparisonResult {
  /** Overall status */
  status: GlyphComparisonStatus;
  /** Overall similarity percentage (0-100) */
  similarity: number;
  /** Average pixel difference rate */
  avgPixelDiffRate: number;
  /** Average PSNR */
  avgPsnr: number;
  /** Total glyphs compared */
  totalGlyphs: number;
  /** Number of identical glyphs */
  identicalCount: number;
  /** Number of similar glyphs (within threshold) */
  similarCount: number;
  /** Number of different glyphs (beyond threshold) */
  differentCount: number;
  /** Individual glyph analyses */
  glyphs: GlyphAnalysis[];
  /** Configuration used */
  config: GlyphComparisonConfig;
  /** Error message if comparison failed */
  error?: string;
}

/**
 * Bitmap glyph header structure
 * Each glyph in a bitmap font has a small header before pixel data
 */
export interface BitmapGlyphHeader {
  /** Glyph width in pixels */
  width: number;
  /** Glyph height in pixels */
  height: number;
  /** X offset for rendering */
  xOffset: number;
  /** Y offset for rendering */
  yOffset: number;
  /** Advance width */
  advance: number;
}



/**
 * Calculates pixel difference rate between two glyph data arrays
 * 
 * @param cpp - C++ glyph pixel data
 * @param ts - TypeScript glyph pixel data
 * @returns Pixel difference rate (0-1)
 */
export function calculatePixelDiffRate(cpp: Uint8Array, ts: Uint8Array): number {
  if (cpp.length === 0 && ts.length === 0) {
    return 0; // Both empty = identical
  }
  
  if (cpp.length !== ts.length) {
    // Different sizes - calculate based on larger size
    const maxLen = Math.max(cpp.length, ts.length);
    const minLen = Math.min(cpp.length, ts.length);
    let diffCount = maxLen - minLen; // Extra bytes are all different
    
    for (let i = 0; i < minLen; i++) {
      if (cpp[i] !== ts[i]) {
        diffCount++;
      }
    }
    
    return diffCount / maxLen;
  }
  
  let diffCount = 0;
  for (let i = 0; i < cpp.length; i++) {
    if (cpp[i] !== ts[i]) {
      diffCount++;
    }
  }
  
  return diffCount / cpp.length;
}

/**
 * Calculates PSNR (Peak Signal-to-Noise Ratio) between two glyph data arrays
 * 
 * PSNR = 10 * log10(MAX^2 / MSE)
 * where MAX is the maximum possible pixel value and MSE is Mean Squared Error
 * 
 * @param cpp - C++ glyph pixel data
 * @param ts - TypeScript glyph pixel data
 * @param maxValue - Maximum pixel value (default: 255 for 8-bit)
 * @returns PSNR in dB (Infinity if identical)
 */
export function calculatePSNR(
  cpp: Uint8Array,
  ts: Uint8Array,
  maxValue: number = 255
): number {
  if (cpp.length === 0 && ts.length === 0) {
    return Infinity; // Both empty = identical
  }
  
  if (cpp.length !== ts.length) {
    // Different sizes - pad shorter array with zeros for comparison
    const maxLen = Math.max(cpp.length, ts.length);
    let mse = 0;
    
    for (let i = 0; i < maxLen; i++) {
      const cppVal = i < cpp.length ? cpp[i] : 0;
      const tsVal = i < ts.length ? ts[i] : 0;
      const diff = cppVal - tsVal;
      mse += diff * diff;
    }
    
    mse /= maxLen;
    
    if (mse === 0) {
      return Infinity;
    }
    
    return 10 * Math.log10((maxValue * maxValue) / mse);
  }
  
  let mse = 0;
  for (let i = 0; i < cpp.length; i++) {
    const diff = cpp[i] - ts[i];
    mse += diff * diff;
  }
  
  mse /= cpp.length;
  
  if (mse === 0) {
    return Infinity; // Identical
  }
  
  return 10 * Math.log10((maxValue * maxValue) / mse);
}

/**
 * Determines glyph status based on pixel difference rate and PSNR
 * 
 * @param pixelDiffRate - Pixel difference rate (0-1)
 * @param psnr - PSNR in dB
 * @param config - Comparison configuration
 * @returns Glyph status
 */
export function determineGlyphStatus(
  pixelDiffRate: number,
  psnr: number,
  config: GlyphComparisonConfig = DEFAULT_GLYPH_CONFIG
): GlyphStatus {
  // Identical if no differences
  if (pixelDiffRate === 0 || psnr === Infinity) {
    return 'identical';
  }
  
  // Similar if within thresholds
  if (pixelDiffRate <= config.partialThreshold && psnr >= config.psnrPartialThreshold) {
    return 'similar';
  }
  
  return 'different';
}

/**
 * Gets the maximum pixel value based on render mode
 * 
 * @param renderMode - Render mode (1, 2, 4, or 8 bits per pixel)
 * @returns Maximum pixel value
 */
export function getMaxPixelValue(renderMode: number): number {
  switch (renderMode) {
    case 1: return 1;   // 1-bit: 0 or 1
    case 2: return 3;   // 2-bit: 0-3
    case 4: return 15;  // 4-bit: 0-15
    case 8: return 255; // 8-bit: 0-255
    default: return 255;
  }
}



/**
 * Parses bitmap glyph header from buffer
 * 
 * Bitmap glyph header structure (packed):
 * - width (1 byte)
 * - height (1 byte)
 * - xOffset (1 byte, signed)
 * - yOffset (1 byte, signed)
 * - advance (1 byte)
 * 
 * @param data - Buffer containing glyph data
 * @param offset - Offset to glyph header
 * @returns Parsed glyph header
 */
export function parseBitmapGlyphHeader(
  data: Buffer,
  offset: number
): BitmapGlyphHeader {
  return {
    width: data.readUInt8(offset),
    height: data.readUInt8(offset + 1),
    xOffset: data.readInt8(offset + 2),
    yOffset: data.readInt8(offset + 3),
    advance: data.readUInt8(offset + 4)
  };
}

/**
 * Calculates glyph data size based on header and render mode
 * 
 * @param header - Glyph header
 * @param renderMode - Render mode (1, 2, 4, or 8 bits per pixel)
 * @returns Total glyph size in bytes (header + pixel data)
 */
export function calculateGlyphSize(
  header: BitmapGlyphHeader,
  renderMode: number
): number {
  const headerSize = 5; // 5 bytes for glyph header
  const totalPixels = header.width * header.height;
  
  // Calculate pixel data size based on render mode
  let pixelDataSize: number;
  switch (renderMode) {
    case 1: // 1-bit: 8 pixels per byte
      pixelDataSize = Math.ceil(totalPixels / 8);
      break;
    case 2: // 2-bit: 4 pixels per byte
      pixelDataSize = Math.ceil(totalPixels / 4);
      break;
    case 4: // 4-bit: 2 pixels per byte
      pixelDataSize = Math.ceil(totalPixels / 2);
      break;
    case 8: // 8-bit: 1 pixel per byte
    default:
      pixelDataSize = totalPixels;
      break;
  }
  
  return headerSize + pixelDataSize;
}

/**
 * Extracts glyph pixel data from buffer
 * 
 * @param data - Buffer containing font data
 * @param offset - Offset to glyph data
 * @param renderMode - Render mode
 * @returns Object with header and pixel data
 */
export function extractGlyphData(
  data: Buffer,
  offset: number,
  renderMode: number
): { header: BitmapGlyphHeader; pixels: Uint8Array; totalSize: number } | null {
  if (offset >= data.length) {
    return null;
  }
  
  const header = parseBitmapGlyphHeader(data, offset);
  const totalSize = calculateGlyphSize(header, renderMode);
  
  if (offset + totalSize > data.length) {
    return null;
  }
  
  const pixelStart = offset + 5; // After 5-byte header
  const pixelSize = totalSize - 5;
  const pixels = new Uint8Array(data.subarray(pixelStart, pixelStart + pixelSize));
  
  return { header, pixels, totalSize };
}

/**
 * Analyzes a single glyph comparison
 * 
 * @param cppData - C++ font data buffer
 * @param tsData - TypeScript font data buffer
 * @param cppOffset - Offset to glyph in C++ data
 * @param tsOffset - Offset to glyph in TypeScript data
 * @param unicode - Unicode code point
 * @param renderMode - Render mode
 * @param config - Comparison configuration
 * @returns Glyph analysis result
 */
export function analyzeGlyph(
  cppData: Buffer,
  tsData: Buffer,
  cppOffset: number,
  tsOffset: number,
  unicode: number,
  renderMode: number,
  config: GlyphComparisonConfig = DEFAULT_GLYPH_CONFIG
): GlyphAnalysis {
  const char = unicode >= 32 && unicode < 127 
    ? String.fromCharCode(unicode) 
    : `U+${unicode.toString(16).toUpperCase().padStart(4, '0')}`;
  
  // Extract glyph data from both sources
  const cppGlyph = extractGlyphData(cppData, cppOffset, renderMode);
  const tsGlyph = extractGlyphData(tsData, tsOffset, renderMode);
  
  if (!cppGlyph) {
    return {
      unicode,
      char,
      pixelDiffRate: 1,
      psnr: 0,
      status: 'different',
      cppSize: 0,
      tsSize: tsGlyph?.totalSize || 0,
      error: `Failed to extract C++ glyph at offset ${cppOffset}`
    };
  }
  
  if (!tsGlyph) {
    return {
      unicode,
      char,
      pixelDiffRate: 1,
      psnr: 0,
      status: 'different',
      cppSize: cppGlyph.totalSize,
      tsSize: 0,
      error: `Failed to extract TypeScript glyph at offset ${tsOffset}`
    };
  }
  
  // Calculate metrics
  const maxValue = getMaxPixelValue(renderMode);
  const pixelDiffRate = calculatePixelDiffRate(cppGlyph.pixels, tsGlyph.pixels);
  const psnr = calculatePSNR(cppGlyph.pixels, tsGlyph.pixels, maxValue);
  const status = determineGlyphStatus(pixelDiffRate, psnr, config);
  
  return {
    unicode,
    char,
    pixelDiffRate,
    psnr,
    status,
    cppSize: cppGlyph.totalSize,
    tsSize: tsGlyph.totalSize
  };
}



/**
 * Compares all glyphs between C++ and TypeScript font files
 * 
 * Requirements: 5.1-5.8 - Glyph similarity analysis
 * 
 * @param cppData - C++ font data buffer
 * @param tsData - TypeScript font data buffer
 * @param cppHeader - Parsed C++ header
 * @param tsHeader - Parsed TypeScript header
 * @param config - Comparison configuration
 * @returns Glyph comparison result
 */
export function compareGlyphs(
  cppData: Buffer,
  tsData: Buffer,
  cppHeader: ParsedHeader,
  tsHeader: ParsedHeader,
  config: GlyphComparisonConfig = DEFAULT_GLYPH_CONFIG
): GlyphComparisonResult {
  // Only bitmap fonts have pixel data to compare
  if (!isBitmapHeader(cppHeader) || !isBitmapHeader(tsHeader)) {
    return {
      status: 'PASS',
      similarity: 100,
      avgPixelDiffRate: 0,
      avgPsnr: Infinity,
      totalGlyphs: 0,
      identicalCount: 0,
      similarCount: 0,
      differentCount: 0,
      glyphs: [],
      config,
      error: 'Vector fonts do not have pixel data for comparison'
    };
  }
  
  const renderMode = cppHeader.renderMode;
  
  // Get glyph entries from both files
  let cppEntries: Array<{ unicode: number; offset: number }>;
  let tsEntries: Array<{ unicode: number; offset: number }>;
  
  if (cppHeader.indexMethod === INDEX_METHOD.ADDRESS) {
    cppEntries = getAddressModeValidEntries(cppData, cppHeader).map(e => ({
      unicode: e.unicode,
      offset: e.offset
    }));
    tsEntries = getAddressModeValidEntries(tsData, tsHeader).map(e => ({
      unicode: e.unicode,
      offset: e.offset
    }));
  } else {
    cppEntries = getOffsetModeEntries(cppData, cppHeader);
    tsEntries = getOffsetModeEntries(tsData, tsHeader);
  }
  
  // Build lookup maps
  const cppMap = new Map(cppEntries.map(e => [e.unicode, e.offset]));
  const tsMap = new Map(tsEntries.map(e => [e.unicode, e.offset]));
  
  // Find common unicodes
  const commonUnicodes = [...cppMap.keys()].filter(u => tsMap.has(u));
  
  if (commonUnicodes.length === 0) {
    return {
      status: 'FAIL',
      similarity: 0,
      avgPixelDiffRate: 1,
      avgPsnr: 0,
      totalGlyphs: 0,
      identicalCount: 0,
      similarCount: 0,
      differentCount: 0,
      glyphs: [],
      config,
      error: 'No common glyphs found between C++ and TypeScript outputs'
    };
  }
  
  // Analyze each common glyph
  const glyphs: GlyphAnalysis[] = [];
  let totalPixelDiffRate = 0;
  let totalPsnr = 0;
  let psnrCount = 0;
  let identicalCount = 0;
  let similarCount = 0;
  let differentCount = 0;
  
  for (const unicode of commonUnicodes) {
    const cppOffset = cppMap.get(unicode)!;
    const tsOffset = tsMap.get(unicode)!;
    
    const analysis = analyzeGlyph(
      cppData,
      tsData,
      cppOffset,
      tsOffset,
      unicode,
      renderMode,
      config
    );
    
    glyphs.push(analysis);
    totalPixelDiffRate += analysis.pixelDiffRate;
    
    if (analysis.psnr !== Infinity) {
      totalPsnr += analysis.psnr;
      psnrCount++;
    }
    
    switch (analysis.status) {
      case 'identical':
        identicalCount++;
        break;
      case 'similar':
        similarCount++;
        break;
      case 'different':
        differentCount++;
        break;
    }
  }
  
  const totalGlyphs = glyphs.length;
  const avgPixelDiffRate = totalPixelDiffRate / totalGlyphs;
  const avgPsnr = psnrCount > 0 ? totalPsnr / psnrCount : Infinity;
  const similarity = (1 - avgPixelDiffRate) * 100;
  
  // Determine overall status
  let status: GlyphComparisonStatus;
  if (differentCount === 0 && avgPixelDiffRate <= config.passThreshold) {
    status = 'PASS';
  } else if (avgPixelDiffRate <= config.partialThreshold) {
    status = 'PARTIAL';
  } else {
    status = 'FAIL';
  }
  
  return {
    status,
    similarity,
    avgPixelDiffRate,
    avgPsnr,
    totalGlyphs,
    identicalCount,
    similarCount,
    differentCount,
    glyphs,
    config
  };
}

/**
 * Compares glyphs from two font files
 * 
 * @param cppPath - Path to C++ reference font file
 * @param tsPath - Path to TypeScript test font file
 * @param cppHeader - Parsed C++ header
 * @param tsHeader - Parsed TypeScript header
 * @param config - Comparison configuration
 * @returns Glyph comparison result
 */
export function compareGlyphsFromFiles(
  cppPath: string,
  tsPath: string,
  cppHeader: ParsedHeader,
  tsHeader: ParsedHeader,
  config: GlyphComparisonConfig = DEFAULT_GLYPH_CONFIG
): GlyphComparisonResult {
  try {
    if (!fs.existsSync(cppPath)) {
      return {
        status: 'FAIL',
        similarity: 0,
        avgPixelDiffRate: 1,
        avgPsnr: 0,
        totalGlyphs: 0,
        identicalCount: 0,
        similarCount: 0,
        differentCount: 0,
        glyphs: [],
        config,
        error: `C++ reference file not found: ${cppPath}`
      };
    }
    
    if (!fs.existsSync(tsPath)) {
      return {
        status: 'FAIL',
        similarity: 0,
        avgPixelDiffRate: 1,
        avgPsnr: 0,
        totalGlyphs: 0,
        identicalCount: 0,
        similarCount: 0,
        differentCount: 0,
        glyphs: [],
        config,
        error: `TypeScript test file not found: ${tsPath}`
      };
    }
    
    const cppData = fs.readFileSync(cppPath);
    const tsData = fs.readFileSync(tsPath);
    
    return compareGlyphs(cppData, tsData, cppHeader, tsHeader, config);
  } catch (error) {
    return {
      status: 'FAIL',
      similarity: 0,
      avgPixelDiffRate: 1,
      avgPsnr: 0,
      totalGlyphs: 0,
      identicalCount: 0,
      similarCount: 0,
      differentCount: 0,
      glyphs: [],
      config,
      error: `File read error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}



/**
 * Formats glyph analysis result as a human-readable string
 */
export function formatGlyphAnalysis(analysis: GlyphAnalysis): string {
  const psnrStr = analysis.psnr === Infinity ? '∞' : analysis.psnr.toFixed(2);
  const diffRateStr = (analysis.pixelDiffRate * 100).toFixed(2);
  
  return `${analysis.char} (U+${analysis.unicode.toString(16).toUpperCase().padStart(4, '0')}): ` +
         `${analysis.status.toUpperCase()} - diff=${diffRateStr}%, PSNR=${psnrStr}dB, ` +
         `size: C++=${analysis.cppSize}, TS=${analysis.tsSize}` +
         (analysis.error ? ` [ERROR: ${analysis.error}]` : '');
}

/**
 * Formats glyph comparison result as a human-readable string
 */
export function formatGlyphComparisonResult(result: GlyphComparisonResult): string {
  const lines: string[] = [
    `Glyph Comparison Result:`,
    `  Status: ${result.status}`,
    `  Similarity: ${result.similarity.toFixed(2)}%`,
    `  Avg Pixel Diff Rate: ${(result.avgPixelDiffRate * 100).toFixed(2)}%`,
    `  Avg PSNR: ${result.avgPsnr === Infinity ? '∞' : result.avgPsnr.toFixed(2)} dB`,
    `  Total Glyphs: ${result.totalGlyphs}`,
    `  Identical: ${result.identicalCount}`,
    `  Similar: ${result.similarCount}`,
    `  Different: ${result.differentCount}`
  ];
  
  if (result.error) {
    lines.push(`  Error: ${result.error}`);
  }
  
  // Show first few different glyphs
  const differentGlyphs = result.glyphs.filter(g => g.status === 'different');
  if (differentGlyphs.length > 0) {
    lines.push(`  Different Glyphs (showing first 10):`);
    for (const glyph of differentGlyphs.slice(0, 10)) {
      lines.push(`    - ${formatGlyphAnalysis(glyph)}`);
    }
    if (differentGlyphs.length > 10) {
      lines.push(`    ... and ${differentGlyphs.length - 10} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Creates a summary of glyph comparison for console output
 */
export function createGlyphSummary(result: GlyphComparisonResult): string {
  const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'PARTIAL' ? '~' : '✗';
  return `Glyph: ${statusIcon} ${result.similarity.toFixed(1)}% (${result.identicalCount}/${result.totalGlyphs} identical)`;
}

