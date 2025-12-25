/**
 * Index Validator for Compatibility Testing
 * 
 * This module provides functions to validate index arrays in binary font files.
 * It verifies that the index structure conforms to the specification for both
 * Address mode and Offset mode.
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5 - Index structure validation
 */

import * as fs from 'fs';
import { ParsedHeader, isBitmapHeader, isVectorHeader } from './header-parser';

/**
 * Index validation result
 */
export interface IndexValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Index method detected (0=ADDRESS, 1=OFFSET) */
  indexMethod: number;
  /** Expected number of entries */
  expectedEntries: number;
  /** Actual number of entries found */
  actualEntries: number;
  /** Number of valid character mappings */
  validMappings: number;
  /** Number of unused entries (0xFF or 0xFFFFFFFF) */
  unusedEntries: number;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Character mappings (unicode -> index/offset) */
  mappings?: Map<number, number>;
}

/**
 * Index entry for internal processing
 */
interface IndexEntry {
  /** Position in index array */
  position: number;
  /** Value stored at this position */
  value: number;
  /** Whether this entry is used */
  isUsed: boolean;
}

/**
 * Constants for index validation
 */
const CONSTANTS = {
  /** Maximum index size for Address mode */
  MAX_INDEX_SIZE: 65536,
  /** Unused marker for 16-bit entries */
  UNUSED_16: 0xFFFF,
  /** Unused marker for 32-bit entries */
  UNUSED_32: 0xFFFFFFFF,
};

/**
 * Validates the index array in a binary font file
 * 
 * @param filePath - Path to the .font or .bin file
 * @param header - Parsed header from the file
 * @param expectedCharacters - Expected unicode values (optional)
 * @returns Index validation result
 */
export function validateIndex(
  filePath: string,
  header: ParsedHeader,
  expectedCharacters?: number[]
): IndexValidationResult {
  try {
    // Read the file
    const data = fs.readFileSync(filePath);
    
    // Calculate index start offset (after header)
    const indexStartOffset = header.length;
    
    // Validate based on index method
    if (header.indexMethod === 0) {
      return validateAddressMode(data, indexStartOffset, header, expectedCharacters);
    } else {
      return validateOffsetMode(data, indexStartOffset, header, expectedCharacters);
    }
  } catch (error) {
    return {
      valid: false,
      indexMethod: header.indexMethod,
      expectedEntries: 0,
      actualEntries: 0,
      validMappings: 0,
      unusedEntries: 0,
      errors: [`Failed to validate index: ${error instanceof Error ? error.message : String(error)}`],
      warnings: []
    };
  }
}

/**
 * Validates Address mode index array
 * 
 * Address mode structure:
 * - 65536 entries (one for each possible unicode value 0x0000-0xFFFF)
 * - Each entry is 2 bytes (uint16) for non-crop mode
 * - Each entry is 4 bytes (uint32) for crop mode (file offsets)
 * - Unused entries are filled with 0xFFFF (16-bit) or 0xFFFFFFFF (32-bit)
 * - Used entries contain character index (0, 1, 2, ...) or file offset
 * 
 * Requirements: 4.2, 4.3
 */
function validateAddressMode(
  data: Buffer,
  indexStartOffset: number,
  header: ParsedHeader,
  expectedCharacters?: number[]
): IndexValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mappings = new Map<number, number>();
  
  // Determine entry size based on crop mode
  const isCropMode = isBitmapHeader(header) && header.crop;
  const entrySize = isCropMode ? 4 : 2;
  const unusedMarker = isCropMode ? CONSTANTS.UNUSED_32 : CONSTANTS.UNUSED_16;
  const expectedEntries = CONSTANTS.MAX_INDEX_SIZE;
  const expectedIndexSize = expectedEntries * entrySize;
  
  // Validate index area size
  if (header.indexAreaSize !== expectedIndexSize) {
    errors.push(
      `Address mode index area size mismatch: expected ${expectedIndexSize} bytes, got ${header.indexAreaSize} bytes`
    );
  }
  
  // Check if we have enough data
  const indexEndOffset = indexStartOffset + expectedIndexSize;
  if (data.length < indexEndOffset) {
    errors.push(
      `File too small: expected at least ${indexEndOffset} bytes, got ${data.length} bytes`
    );
    return {
      valid: false,
      indexMethod: 0,
      expectedEntries,
      actualEntries: 0,
      validMappings: 0,
      unusedEntries: 0,
      errors,
      warnings
    };
  }
  
  // Read all entries
  let validMappings = 0;
  let unusedEntries = 0;
  let offset = indexStartOffset;
  
  for (let unicode = 0; unicode < CONSTANTS.MAX_INDEX_SIZE; unicode++) {
    const value = entrySize === 4 
      ? data.readUInt32LE(offset)
      : data.readUInt16LE(offset);
    
    offset += entrySize;
    
    if (value === unusedMarker) {
      unusedEntries++;
    } else {
      validMappings++;
      mappings.set(unicode, value);
    }
  }
  
  // Validate expected characters if provided
  if (expectedCharacters && expectedCharacters.length > 0) {
    for (const unicode of expectedCharacters) {
      if (unicode < 0 || unicode >= CONSTANTS.MAX_INDEX_SIZE) {
        warnings.push(`Unicode value ${unicode} (0x${unicode.toString(16)}) is out of range`);
        continue;
      }
      
      if (!mappings.has(unicode)) {
        errors.push(
          `Expected character U+${unicode.toString(16).padStart(4, '0')} not found in index`
        );
      }
    }
    
    // Check for unexpected mappings
    const expectedSet = new Set(expectedCharacters);
    for (const [unicode] of mappings) {
      if (!expectedSet.has(unicode)) {
        warnings.push(
          `Unexpected character U+${unicode.toString(16).padStart(4, '0')} found in index`
        );
      }
    }
  }
  
  // Validate character indices are sequential (for non-crop mode)
  if (!isCropMode) {
    const indices = Array.from(mappings.values()).sort((a, b) => a - b);
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] !== i) {
        errors.push(
          `Character indices are not sequential: expected ${i}, got ${indices[i]}`
        );
        break;
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    indexMethod: 0,
    expectedEntries,
    actualEntries: expectedEntries,
    validMappings,
    unusedEntries,
    errors,
    warnings,
    mappings
  };
}

/**
 * Validates Offset mode index array
 * 
 * Offset mode structure:
 * - N entries (one for each character in the font)
 * - Each entry is 2 bytes (uint16) containing the unicode value
 * - Entries are stored in the order characters appear in the font
 * - No unused entries (all entries are valid unicode values)
 * 
 * Requirements: 4.4, 4.5
 */
function validateOffsetMode(
  data: Buffer,
  indexStartOffset: number,
  header: ParsedHeader,
  expectedCharacters?: number[]
): IndexValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mappings = new Map<number, number>();
  
  // In offset mode, each entry is 2 bytes (unicode value only)
  const entrySize = 2;
  const expectedEntries = Math.floor(header.indexAreaSize / entrySize);
  
  // Check if index area size is valid
  if (header.indexAreaSize % entrySize !== 0) {
    errors.push(
      `Offset mode index area size (${header.indexAreaSize}) is not a multiple of entry size (${entrySize})`
    );
  }
  
  // Check if we have enough data
  const indexEndOffset = indexStartOffset + header.indexAreaSize;
  if (data.length < indexEndOffset) {
    errors.push(
      `File too small: expected at least ${indexEndOffset} bytes, got ${data.length} bytes`
    );
    return {
      valid: false,
      indexMethod: 1,
      expectedEntries,
      actualEntries: 0,
      validMappings: 0,
      unusedEntries: 0,
      errors,
      warnings
    };
  }
  
  // Read all entries
  let offset = indexStartOffset;
  const unicodeValues: number[] = [];
  
  for (let i = 0; i < expectedEntries; i++) {
    const unicode = data.readUInt16LE(offset);
    offset += entrySize;
    
    unicodeValues.push(unicode);
    
    // Map unicode to its offset (position in the array)
    if (mappings.has(unicode)) {
      warnings.push(
        `Duplicate unicode value U+${unicode.toString(16).padStart(4, '0')} at offset ${i}`
      );
    }
    mappings.set(unicode, i);
  }
  
  // Validate expected characters if provided
  if (expectedCharacters && expectedCharacters.length > 0) {
    // Check if entry count matches
    if (expectedEntries !== expectedCharacters.length) {
      warnings.push(
        `Entry count mismatch: expected ${expectedCharacters.length} characters, got ${expectedEntries} entries`
      );
    }
    
    // Check if all expected characters are present
    for (const unicode of expectedCharacters) {
      if (!mappings.has(unicode)) {
        errors.push(
          `Expected character U+${unicode.toString(16).padStart(4, '0')} not found in index`
        );
      }
    }
    
    // Check for unexpected characters
    const expectedSet = new Set(expectedCharacters);
    for (const unicode of unicodeValues) {
      if (!expectedSet.has(unicode)) {
        warnings.push(
          `Unexpected character U+${unicode.toString(16).padStart(4, '0')} found in index`
        );
      }
    }
  }
  
  // Check for invalid unicode values (should not be 0xFFFF)
  for (let i = 0; i < unicodeValues.length; i++) {
    const unicode = unicodeValues[i];
    if (unicode === CONSTANTS.UNUSED_16) {
      errors.push(
        `Invalid unicode value 0xFFFF at offset ${i} (unused marker should not appear in offset mode)`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    indexMethod: 1,
    expectedEntries,
    actualEntries: expectedEntries,
    validMappings: mappings.size,
    unusedEntries: 0, // Offset mode has no unused entries
    errors,
    warnings,
    mappings
  };
}

/**
 * Formats an index validation result as a human-readable string
 */
export function formatIndexValidationResult(result: IndexValidationResult): string {
  const lines: string[] = [];
  
  lines.push('Index Validation Result:');
  lines.push(`  Valid: ${result.valid ? '✓' : '✗'}`);
  lines.push(`  Index Method: ${result.indexMethod === 0 ? 'ADDRESS' : 'OFFSET'}`);
  lines.push(`  Expected Entries: ${result.expectedEntries}`);
  lines.push(`  Actual Entries: ${result.actualEntries}`);
  lines.push(`  Valid Mappings: ${result.validMappings}`);
  lines.push(`  Unused Entries: ${result.unusedEntries}`);
  
  if (result.errors.length > 0) {
    lines.push('  Errors:');
    for (const error of result.errors) {
      lines.push(`    - ${error}`);
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push('  Warnings:');
    for (const warning of result.warnings) {
      lines.push(`    - ${warning}`);
    }
  }
  
  if (result.mappings && result.mappings.size > 0 && result.mappings.size <= 50) {
    lines.push('  Character Mappings:');
    const sortedMappings = Array.from(result.mappings.entries())
      .sort((a, b) => a[0] - b[0]);
    for (const [unicode, value] of sortedMappings) {
      const char = String.fromCharCode(unicode);
      const displayChar = unicode >= 0x20 && unicode <= 0x7E ? char : '?';
      lines.push(`    U+${unicode.toString(16).padStart(4, '0')} ('${displayChar}') -> ${value}`);
    }
  } else if (result.mappings && result.mappings.size > 50) {
    lines.push(`  Character Mappings: ${result.mappings.size} entries (too many to display)`);
  }
  
  return lines.join('\n');
}

/**
 * Compares index arrays between two files
 * 
 * @param cppFile - Path to C++ reference file
 * @param tsFile - Path to TypeScript output file
 * @param cppHeader - Parsed header from C++ file
 * @param tsHeader - Parsed header from TypeScript file
 * @param expectedCharacters - Expected unicode values (optional)
 * @returns Comparison result with both validation results
 */
export function compareIndices(
  cppFile: string,
  tsFile: string,
  cppHeader: ParsedHeader,
  tsHeader: ParsedHeader,
  expectedCharacters?: number[]
): {
  cppResult: IndexValidationResult;
  tsResult: IndexValidationResult;
  match: boolean;
  differences: string[];
} {
  const cppResult = validateIndex(cppFile, cppHeader, expectedCharacters);
  const tsResult = validateIndex(tsFile, tsHeader, expectedCharacters);
  
  const differences: string[] = [];
  let match = true;
  
  // Compare basic properties
  if (cppResult.indexMethod !== tsResult.indexMethod) {
    differences.push(
      `Index method mismatch: C++ ${cppResult.indexMethod}, TS ${tsResult.indexMethod}`
    );
    match = false;
  }
  
  if (cppResult.expectedEntries !== tsResult.expectedEntries) {
    differences.push(
      `Expected entries mismatch: C++ ${cppResult.expectedEntries}, TS ${tsResult.expectedEntries}`
    );
    match = false;
  }
  
  if (cppResult.validMappings !== tsResult.validMappings) {
    differences.push(
      `Valid mappings count mismatch: C++ ${cppResult.validMappings}, TS ${tsResult.validMappings}`
    );
    match = false;
  }
  
  // Compare mappings if both are valid
  if (cppResult.mappings && tsResult.mappings) {
    // Check if all C++ mappings exist in TS
    for (const [unicode, cppValue] of cppResult.mappings) {
      const tsValue = tsResult.mappings.get(unicode);
      if (tsValue === undefined) {
        differences.push(
          `Character U+${unicode.toString(16).padStart(4, '0')} exists in C++ but not in TS`
        );
        match = false;
      } else if (cppValue !== tsValue) {
        differences.push(
          `Character U+${unicode.toString(16).padStart(4, '0')} value mismatch: C++ ${cppValue}, TS ${tsValue}`
        );
        match = false;
      }
    }
    
    // Check if TS has extra mappings
    for (const [unicode] of tsResult.mappings) {
      if (!cppResult.mappings.has(unicode)) {
        differences.push(
          `Character U+${unicode.toString(16).padStart(4, '0')} exists in TS but not in C++`
        );
        match = false;
      }
    }
  }
  
  // Check validation status
  if (!cppResult.valid) {
    differences.push('C++ index validation failed');
    match = false;
  }
  
  if (!tsResult.valid) {
    differences.push('TypeScript index validation failed');
    match = false;
  }
  
  return {
    cppResult,
    tsResult,
    match,
    differences
  };
}
