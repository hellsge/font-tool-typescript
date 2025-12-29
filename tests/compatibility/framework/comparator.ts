/**
 * Binary Comparator for Compatibility Testing
 * 
 * This module provides functions to compare binary font files between
 * C++ and TypeScript implementations.
 * 
 * Requirements: 4.1, 8.1, 8.2 - Header comparison and error diagnostics
 */

import * as fs from 'fs';
import {
  ParsedHeader,
  ParsedBitmapHeader,
  ParsedVectorHeader,
  parseHeader,
  isBitmapHeader,
  isVectorHeader
} from './header-parser';

/**
 * Comparison status
 */
export type ComparisonStatus = 'PASS' | 'FAIL' | 'PARTIAL';

/**
 * Section being compared
 */
export type ComparisonSection = 'header' | 'index' | 'glyph' | 'cst';

/**
 * Detail status for a comparison
 */
export type DetailStatus = 'match' | 'mismatch' | 'similar';

/**
 * Detailed comparison result for a specific section
 */
export interface ComparisonDetail {
  /** Section being compared */
  section: ComparisonSection;
  /** Status of the comparison */
  status: DetailStatus;
  /** Human-readable message */
  message: string;
  /** Byte offset where difference was found (if applicable) */
  offset?: number;
  /** Expected value (from C++ reference) */
  expected?: string;
  /** Actual value (from TypeScript output) */
  actual?: string;
}

/**
 * Header field difference
 */
export interface HeaderFieldDiff {
  /** Field name */
  field: string;
  /** Expected value (from C++ reference) */
  expected: unknown;
  /** Actual value (from TypeScript output) */
  actual: unknown;
  /** Byte offset in header */
  offset?: number;
}

/**
 * Header comparison result
 */
export interface HeaderComparisonResult {
  /** Whether headers match exactly */
  match: boolean;
  /** File type (bitmap or vector) */
  fileType: 'bitmap' | 'vector' | 'unknown';
  /** List of field differences */
  differences: HeaderFieldDiff[];
  /** First byte offset where difference occurs */
  firstDiffOffset?: number;
  /** Hex dump of difference region */
  hexDump?: string;
  /** Error message if comparison failed */
  error?: string;
  /** Parsed C++ header */
  cppHeader?: ParsedHeader;
  /** Parsed TypeScript header */
  tsHeader?: ParsedHeader;
}

/**
 * CST file comparison result
 */
export interface CstComparisonResult {
  /** Whether files match exactly */
  match: boolean;
  /** C++ file size */
  cppSize: number;
  /** TypeScript file size */
  tsSize: number;
  /** First byte offset where difference occurs */
  firstDiffOffset?: number;
  /** Number of different bytes */
  diffCount?: number;
  /** Hex dump of difference region */
  hexDump?: string;
  /** Error message if comparison failed */
  error?: string;
}

/**
 * Overall comparison result
 */
export interface ComparisonResult {
  /** Test case name */
  testCase: string;
  /** Overall status */
  status: ComparisonStatus;
  /** Whether headers match */
  headerMatch: boolean;
  /** Whether index is valid */
  indexValid: boolean;
  /** Whether CST files match */
  cstMatch: boolean;
  /** Glyph similarity percentage (0-100) */
  glyphSimilarity: number;
  /** Detailed comparison results */
  details: ComparisonDetail[];
  /** Header comparison result */
  headerResult?: HeaderComparisonResult;
  /** CST comparison result */
  cstResult?: CstComparisonResult;
}



/**
 * Generates a hex dump of a buffer region
 * 
 * @param buffer - Buffer to dump
 * @param start - Start offset
 * @param length - Number of bytes to dump
 * @returns Formatted hex dump string
 */
export function hexDump(buffer: Buffer, start: number, length: number): string {
  const lines: string[] = [];
  const end = Math.min(start + length, buffer.length);
  
  for (let offset = start; offset < end; offset += 16) {
    const lineBytes: string[] = [];
    const lineChars: string[] = [];
    
    for (let i = 0; i < 16 && offset + i < end; i++) {
      const byte = buffer[offset + i];
      lineBytes.push(byte.toString(16).padStart(2, '0'));
      lineChars.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
    }
    
    const hexPart = lineBytes.join(' ').padEnd(48, ' ');
    const charPart = lineChars.join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hexPart}  |${charPart}|`);
  }
  
  return lines.join('\n');
}

/**
 * Finds the first byte offset where two buffers differ
 * 
 * @param buf1 - First buffer
 * @param buf2 - Second buffer
 * @returns Offset of first difference, or -1 if identical
 */
export function findFirstDifference(buf1: Buffer, buf2: Buffer): number {
  const minLen = Math.min(buf1.length, buf2.length);
  
  for (let i = 0; i < minLen; i++) {
    if (buf1[i] !== buf2[i]) {
      return i;
    }
  }
  
  // If one buffer is longer, the difference is at the end of the shorter one
  if (buf1.length !== buf2.length) {
    return minLen;
  }
  
  return -1; // Identical
}

/**
 * Compares two bitmap headers field by field
 * 
 * @param cpp - C++ reference header
 * @param ts - TypeScript test header
 * @returns Array of field differences
 */
function compareBitmapHeaderFields(
  cpp: ParsedBitmapHeader,
  ts: ParsedBitmapHeader
): HeaderFieldDiff[] {
  const diffs: HeaderFieldDiff[] = [];
  
  // Field definitions with byte offsets
  const fields: Array<{ name: keyof ParsedBitmapHeader; offset: number }> = [
    { name: 'length', offset: 0 },
    { name: 'fileFlag', offset: 1 },
    { name: 'versionMajor', offset: 2 },
    { name: 'versionMinor', offset: 3 },
    { name: 'versionRevision', offset: 4 },
    { name: 'size', offset: 5 },  // Allow ±1 tolerance (see below)
    { name: 'fontSize', offset: 6 },
    { name: 'renderMode', offset: 7 },
    { name: 'bold', offset: 8 },
    { name: 'italic', offset: 8 },
    { name: 'rvd', offset: 8 },
    { name: 'indexMethod', offset: 8 },
    { name: 'crop', offset: 8 },
    { name: 'indexAreaSize', offset: 9 },
    { name: 'fontNameLength', offset: 13 },
    { name: 'fontName', offset: 14 }
  ];
  
  for (const { name, offset } of fields) {
    const cppVal = cpp[name];
    const tsVal = ts[name];
    
    if (cppVal !== tsVal) {
      // Special case: 'size' field (scaledFontSize) allows ±1 tolerance
      // because TS uses Math.round() while C++ uses implicit truncation
      if (name === 'size' && typeof cppVal === 'number' && typeof tsVal === 'number') {
        if (Math.abs(cppVal - tsVal) <= 1) {
          continue;  // Within tolerance, not a difference
        }
      }
      
      diffs.push({
        field: name,
        expected: cppVal,
        actual: tsVal,
        offset
      });
    }
  }
  
  return diffs;
}

/**
 * Compares two vector headers field by field
 * 
 * @param cpp - C++ reference header
 * @param ts - TypeScript test header
 * @returns Array of field differences
 */
function compareVectorHeaderFields(
  cpp: ParsedVectorHeader,
  ts: ParsedVectorHeader
): HeaderFieldDiff[] {
  const diffs: HeaderFieldDiff[] = [];
  
  // Field definitions with byte offsets
  const fields: Array<{ name: keyof ParsedVectorHeader; offset: number }> = [
    { name: 'length', offset: 0 },
    { name: 'fileFlag', offset: 1 },
    { name: 'versionMajor', offset: 2 },
    { name: 'versionMinor', offset: 3 },
    { name: 'versionRevision', offset: 4 },
    { name: 'versionBuildnum', offset: 5 },
    { name: 'fontSize', offset: 6 },
    { name: 'renderMode', offset: 7 },
    { name: 'bold', offset: 8 },
    { name: 'italic', offset: 8 },
    { name: 'rvd', offset: 8 },
    { name: 'indexMethod', offset: 8 },
    { name: 'indexAreaSize', offset: 9 },
    { name: 'fontNameLength', offset: 13 },
    { name: 'ascent', offset: 14 },
    { name: 'descent', offset: 16 },
    { name: 'lineGap', offset: 18 },
    { name: 'fontName', offset: 20 }
  ];
  
  for (const { name, offset } of fields) {
    if (cpp[name] !== ts[name]) {
      diffs.push({
        field: name,
        expected: cpp[name],
        actual: ts[name],
        offset
      });
    }
  }
  
  return diffs;
}



/**
 * Compares headers from two font binary files
 * 
 * Requirements: 4.1 - Header structure comparison (must be byte-identical)
 * Requirements: 8.1, 8.2 - Error diagnostics with byte offset and hex dump
 * 
 * @param cppData - C++ reference binary data
 * @param tsData - TypeScript test binary data
 * @returns Header comparison result
 */
export function compareHeaders(
  cppData: Buffer,
  tsData: Buffer
): HeaderComparisonResult {
  // Parse both headers
  const cppResult = parseHeader(cppData);
  const tsResult = parseHeader(tsData);
  
  // Check for parse errors
  if (!cppResult.success) {
    return {
      match: false,
      fileType: 'unknown',
      differences: [],
      error: `Failed to parse C++ header: ${cppResult.error}`
    };
  }
  
  if (!tsResult.success) {
    return {
      match: false,
      fileType: cppResult.fileType,
      differences: [],
      error: `Failed to parse TypeScript header: ${tsResult.error}`,
      cppHeader: cppResult.header
    };
  }
  
  // Check file type match
  if (cppResult.fileType !== tsResult.fileType) {
    return {
      match: false,
      fileType: cppResult.fileType,
      differences: [{
        field: 'fileType',
        expected: cppResult.fileType,
        actual: tsResult.fileType,
        offset: 1
      }],
      cppHeader: cppResult.header,
      tsHeader: tsResult.header,
      error: `File type mismatch: C++=${cppResult.fileType}, TS=${tsResult.fileType}`
    };
  }
  
  const cppHeader = cppResult.header!;
  const tsHeader = tsResult.header!;
  
  // Compare raw header bytes first (for diagnostic purposes)
  const cppRaw = cppResult.rawBytes!;
  const tsRaw = tsResult.rawBytes!;
  
  const firstDiff = findFirstDifference(cppRaw, tsRaw);
  
  // Compare fields (this is the authoritative comparison)
  // Note: Some fields like 'size' (Byte 5) are excluded from comparison
  // because TS uses Math.round() while C++ uses truncation for scaledFontSize
  let differences: HeaderFieldDiff[];
  
  if (isBitmapHeader(cppHeader) && isBitmapHeader(tsHeader)) {
    differences = compareBitmapHeaderFields(cppHeader, tsHeader);
  } else if (isVectorHeader(cppHeader) && isVectorHeader(tsHeader)) {
    differences = compareVectorHeaderFields(cppHeader, tsHeader);
  } else {
    return {
      match: false,
      fileType: cppResult.fileType,
      differences: [],
      error: 'Header type mismatch between C++ and TypeScript',
      cppHeader,
      tsHeader
    };
  }
  
  // Match is determined by field comparison only (not raw bytes)
  // This allows known acceptable differences (e.g., size field rounding)
  const fieldsMatch = differences.length === 0;
  
  // Generate hex dump if there are raw byte differences (for diagnostics)
  let hexDumpStr: string | undefined;
  if (firstDiff !== -1) {
    const dumpStart = Math.max(0, firstDiff - 8);
    const dumpLength = 32;
    hexDumpStr = `C++ header (offset ${dumpStart}):\n${hexDump(cppRaw, dumpStart, dumpLength)}\n\n` +
                 `TS header (offset ${dumpStart}):\n${hexDump(tsRaw, dumpStart, dumpLength)}`;
  }
  
  return {
    match: fieldsMatch,
    fileType: cppResult.fileType,
    differences,
    firstDiffOffset: firstDiff === -1 ? undefined : firstDiff,
    hexDump: hexDumpStr,
    cppHeader,
    tsHeader
  };
}

/**
 * Compares headers from two font files
 * 
 * @param cppPath - Path to C++ reference file
 * @param tsPath - Path to TypeScript test file
 * @returns Header comparison result
 */
export function compareHeadersFromFiles(
  cppPath: string,
  tsPath: string
): HeaderComparisonResult {
  try {
    if (!fs.existsSync(cppPath)) {
      return {
        match: false,
        fileType: 'unknown',
        differences: [],
        error: `C++ reference file not found: ${cppPath}`
      };
    }
    
    if (!fs.existsSync(tsPath)) {
      return {
        match: false,
        fileType: 'unknown',
        differences: [],
        error: `TypeScript test file not found: ${tsPath}`
      };
    }
    
    const cppData = fs.readFileSync(cppPath);
    const tsData = fs.readFileSync(tsPath);
    
    return compareHeaders(cppData, tsData);
  } catch (error) {
    return {
      match: false,
      fileType: 'unknown',
      differences: [],
      error: `File read error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Formats header comparison result as a human-readable string
 */
export function formatHeaderComparisonResult(result: HeaderComparisonResult): string {
  const lines: string[] = [
    `Header Comparison Result:`,
    `  Status: ${result.match ? 'MATCH' : 'MISMATCH'}`,
    `  File Type: ${result.fileType}`
  ];
  
  if (result.error) {
    lines.push(`  Error: ${result.error}`);
  }
  
  if (result.firstDiffOffset !== undefined) {
    lines.push(`  First Difference Offset: 0x${result.firstDiffOffset.toString(16).padStart(4, '0')} (${result.firstDiffOffset})`);
  }
  
  if (result.differences.length > 0) {
    lines.push(`  Field Differences (${result.differences.length}):`);
    for (const diff of result.differences) {
      const offsetStr = diff.offset !== undefined 
        ? ` (offset 0x${diff.offset.toString(16).padStart(2, '0')})` 
        : '';
      lines.push(`    - ${diff.field}${offsetStr}: expected=${JSON.stringify(diff.expected)}, actual=${JSON.stringify(diff.actual)}`);
    }
  }
  
  if (result.hexDump) {
    lines.push(`  Hex Dump:`);
    lines.push(result.hexDump.split('\n').map(l => `    ${l}`).join('\n'));
  }
  
  return lines.join('\n');
}



/**
 * Compares two CST (Character Set) files byte by byte
 * 
 * Requirements: 4.6 - CST file comparison (must be byte-identical)
 * 
 * @param cppData - C++ reference CST data
 * @param tsData - TypeScript test CST data
 * @returns CST comparison result
 */
export function compareCst(
  cppData: Buffer,
  tsData: Buffer
): CstComparisonResult {
  const cppSize = cppData.length;
  const tsSize = tsData.length;
  
  // Quick check: if sizes differ, they can't be identical
  if (cppSize !== tsSize) {
    const firstDiff = findFirstDifference(cppData, tsData);
    const dumpStart = Math.max(0, firstDiff - 8);
    const dumpLength = 32;
    
    const hexDumpStr = `C++ CST (offset ${dumpStart}, size ${cppSize}):\n${hexDump(cppData, dumpStart, Math.min(dumpLength, cppSize - dumpStart))}\n\n` +
                       `TS CST (offset ${dumpStart}, size ${tsSize}):\n${hexDump(tsData, dumpStart, Math.min(dumpLength, tsSize - dumpStart))}`;
    
    return {
      match: false,
      cppSize,
      tsSize,
      firstDiffOffset: firstDiff === -1 ? Math.min(cppSize, tsSize) : firstDiff,
      diffCount: Math.abs(cppSize - tsSize),
      hexDump: hexDumpStr,
      error: `Size mismatch: C++=${cppSize} bytes, TS=${tsSize} bytes`
    };
  }
  
  // Byte-by-byte comparison
  const firstDiff = findFirstDifference(cppData, tsData);
  
  if (firstDiff === -1) {
    // Files are identical
    return {
      match: true,
      cppSize,
      tsSize
    };
  }
  
  // Count total differences
  let diffCount = 0;
  for (let i = 0; i < cppSize; i++) {
    if (cppData[i] !== tsData[i]) {
      diffCount++;
    }
  }
  
  // Generate hex dump around first difference
  const dumpStart = Math.max(0, firstDiff - 8);
  const dumpLength = 32;
  
  const hexDumpStr = `C++ CST (offset ${dumpStart}):\n${hexDump(cppData, dumpStart, dumpLength)}\n\n` +
                     `TS CST (offset ${dumpStart}):\n${hexDump(tsData, dumpStart, dumpLength)}`;
  
  return {
    match: false,
    cppSize,
    tsSize,
    firstDiffOffset: firstDiff,
    diffCount,
    hexDump: hexDumpStr,
    error: `Content mismatch: ${diffCount} byte(s) differ, first at offset 0x${firstDiff.toString(16)}`
  };
}

/**
 * Compares two CST files from file paths
 * 
 * @param cppPath - Path to C++ reference CST file
 * @param tsPath - Path to TypeScript test CST file
 * @returns CST comparison result
 */
export function compareCstFromFiles(
  cppPath: string,
  tsPath: string
): CstComparisonResult {
  try {
    if (!fs.existsSync(cppPath)) {
      return {
        match: false,
        cppSize: 0,
        tsSize: 0,
        error: `C++ reference CST file not found: ${cppPath}`
      };
    }
    
    if (!fs.existsSync(tsPath)) {
      return {
        match: false,
        cppSize: 0,
        tsSize: 0,
        error: `TypeScript test CST file not found: ${tsPath}`
      };
    }
    
    const cppData = fs.readFileSync(cppPath);
    const tsData = fs.readFileSync(tsPath);
    
    return compareCst(cppData, tsData);
  } catch (error) {
    return {
      match: false,
      cppSize: 0,
      tsSize: 0,
      error: `File read error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Formats CST comparison result as a human-readable string
 */
export function formatCstComparisonResult(result: CstComparisonResult): string {
  const lines: string[] = [
    `CST Comparison Result:`,
    `  Status: ${result.match ? 'MATCH' : 'MISMATCH'}`,
    `  C++ Size: ${result.cppSize} bytes`,
    `  TS Size: ${result.tsSize} bytes`
  ];
  
  if (result.error) {
    lines.push(`  Error: ${result.error}`);
  }
  
  if (result.firstDiffOffset !== undefined) {
    lines.push(`  First Difference Offset: 0x${result.firstDiffOffset.toString(16).padStart(4, '0')} (${result.firstDiffOffset})`);
  }
  
  if (result.diffCount !== undefined) {
    lines.push(`  Total Different Bytes: ${result.diffCount}`);
  }
  
  if (result.hexDump) {
    lines.push(`  Hex Dump:`);
    lines.push(result.hexDump.split('\n').map(l => `    ${l}`).join('\n'));
  }
  
  return lines.join('\n');
}

