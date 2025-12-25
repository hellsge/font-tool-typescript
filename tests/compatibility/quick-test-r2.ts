#!/usr/bin/env ts-node
/**
 * Quick Diagnostic Test for bmp_addr_r2
 * 
 * This script performs a focused diagnostic test on the bmp_addr_r2 configuration
 * (2-bit bitmap, address mode) to quickly identify compatibility issues between
 * C++ and TypeScript implementations.
 * 
 * Test Configuration:
 * - 2-bit bitmap (4 pixels per byte)
 * - Address mode (65536 entries)
 * - 26 lowercase letters (a-z, Unicode 0x0061-0x007A)
 * 
 * Requirements: 6.2, 7.1, 7.2, 8.1, 8.2, 8.3, 4.2, 4.3, 4.5
 * 
 * Usage:
 *   npx ts-node quick-test-r2.ts
 *   npm run test:compat:r2
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseHeader,
  isBitmapHeader,
  formatBitmapHeader
} from './framework/header-parser';
import {
  compareHeaders,
  compareCst,
  hexDump,
  findFirstDifference,
  formatHeaderComparisonResult,
  formatCstComparisonResult
} from './framework/comparator';
import {
  validateIndex,
  formatIndexValidationResult
} from './framework/index-validator';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  testName: 'bmp_addr_r2',
  description: '2-bit bitmap, address mode, 26 lowercase letters',
  configFile: 'configs/bmp_addr_r2.json',
  expectedCharacters: Array.from({ length: 26 }, (_, i) => 0x0061 + i), // a-z
  renderMode: 2,
  indexMethod: 0,
  crop: false
};

/**
 * Paths
 */
const BASE_DIR = __dirname;
const CPP_REF_DIR = path.join(BASE_DIR, 'cpp_reference', TEST_CONFIG.testName);
const TS_OUT_DIR = path.join(BASE_DIR, 'ts_output', TEST_CONFIG.testName);
const CPP_BIN_FILE = path.join(CPP_REF_DIR, 'NotoSans_Regular_16.font');
const TS_BIN_FILE = path.join(TS_OUT_DIR, 'NotoSans_Regular_16.font');
const CPP_CST_FILE = path.join(CPP_REF_DIR, 'NotoSans_Regular_16.cst');
const TS_CST_FILE = path.join(TS_OUT_DIR, 'NotoSans_Regular_16.cst');

/**
 * Console colors
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Print colored message
 */
function printColor(color: string, message: string): void {
  console.log(`${color}${message}${COLORS.reset}`);
}

/**
 * Print section header
 */
function printSection(title: string): void {
  console.log('\n' + '='.repeat(80));
  printColor(COLORS.bright + COLORS.cyan, title);
  console.log('='.repeat(80));
}

/**
 * Print subsection header
 */
function printSubsection(title: string): void {
  console.log('\n' + '-'.repeat(80));
  printColor(COLORS.bright, title);
  console.log('-'.repeat(80));
}

/**
 * Print pass/fail status
 */
function printStatus(label: string, passed: boolean, details?: string): void {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const color = passed ? COLORS.green : COLORS.red;
  const detailsStr = details ? ` - ${details}` : '';
  printColor(color, `${status} ${label}${detailsStr}`);
}

/**
 * Check if files exist
 */
function checkFilesExist(): boolean {
  printSection('File Existence Check');
  
  const files = [
    { path: CPP_BIN_FILE, label: 'C++ .font file' },
    { path: TS_BIN_FILE, label: 'TS .font file' },
    { path: CPP_CST_FILE, label: 'C++ .cst file' },
    { path: TS_CST_FILE, label: 'TS .cst file' }
  ];
  
  let allExist = true;
  
  for (const file of files) {
    const exists = fs.existsSync(file.path);
    printStatus(file.label, exists, file.path);
    if (!exists) {
      allExist = false;
    }
  }
  
  return allExist;
}

/**
 * Diagnostic check: Header comparison with field-by-field analysis
 * Requirements: 8.1, 8.2
 */
function diagnoseHeader(): boolean {
  printSection('Header Diagnostic');
  
  try {
    const cppData = fs.readFileSync(CPP_BIN_FILE);
    const tsData = fs.readFileSync(TS_BIN_FILE);
    
    // Parse headers
    const cppResult = parseHeader(cppData);
    const tsResult = parseHeader(tsData);
    
    if (!cppResult.success || !tsResult.success) {
      printColor(COLORS.red, 'Failed to parse headers');
      if (!cppResult.success) console.log(`C++ error: ${cppResult.error}`);
      if (!tsResult.success) console.log(`TS error: ${tsResult.error}`);
      return false;
    }
    
    // Display parsed headers
    printSubsection('C++ Header');
    if (cppResult.header && isBitmapHeader(cppResult.header)) {
      console.log(formatBitmapHeader(cppResult.header));
    }
    
    printSubsection('TypeScript Header');
    if (tsResult.header && isBitmapHeader(tsResult.header)) {
      console.log(formatBitmapHeader(tsResult.header));
    }
    
    // Compare headers
    printSubsection('Header Comparison');
    const comparison = compareHeaders(cppData, tsData);
    console.log(formatHeaderComparisonResult(comparison));
    
    printStatus('Header Match', comparison.match);
    
    return comparison.match;
  } catch (error) {
    printColor(COLORS.red, `Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Diagnostic check: Index array validation
 * Requirements: 4.2, 4.3, 4.5
 */
function diagnoseIndex(): boolean {
  printSection('Index Array Diagnostic');
  
  try {
    const cppData = fs.readFileSync(CPP_BIN_FILE);
    const tsData = fs.readFileSync(TS_BIN_FILE);
    
    const cppResult = parseHeader(cppData);
    const tsResult = parseHeader(tsData);
    
    if (!cppResult.success || !tsResult.success || !cppResult.header || !tsResult.header) {
      printColor(COLORS.red, 'Cannot validate index: header parse failed');
      return false;
    }
    
    // Validate C++ index
    printSubsection('C++ Index Validation');
    const cppIndexResult = validateIndex(CPP_BIN_FILE, cppResult.header, TEST_CONFIG.expectedCharacters);
    console.log(formatIndexValidationResult(cppIndexResult));
    
    // Validate TS index
    printSubsection('TypeScript Index Validation');
    const tsIndexResult = validateIndex(TS_BIN_FILE, tsResult.header, TEST_CONFIG.expectedCharacters);
    console.log(formatIndexValidationResult(tsIndexResult));
    
    // Display first 10 entries from both
    printSubsection('Index Array First 10 Entries');
    
    const cppHeader = cppResult.header;
    const indexStartOffset = cppHeader.length;
    const entrySize = 2; // 2 bytes for non-crop address mode
    
    console.log('\nC++ Index (first 10 entries):');
    console.log('Unicode  | Value  | Char');
    console.log('---------|--------|-----');
    for (let i = 0; i < 10; i++) {
      const offset = indexStartOffset + i * entrySize;
      const value = cppData.readUInt16LE(offset);
      const char = i >= 0x20 && i <= 0x7E ? String.fromCharCode(i) : '?';
      const valueStr = value === 0xFFFF ? 'UNUSED' : value.toString().padStart(6);
      console.log(`U+${i.toString(16).padStart(4, '0')} | ${valueStr} | '${char}'`);
    }
    
    console.log('\nTypeScript Index (first 10 entries):');
    console.log('Unicode  | Value  | Char');
    console.log('---------|--------|-----');
    for (let i = 0; i < 10; i++) {
      const offset = indexStartOffset + i * entrySize;
      const value = tsData.readUInt16LE(offset);
      const char = i >= 0x20 && i <= 0x7E ? String.fromCharCode(i) : '?';
      const valueStr = value === 0xFFFF ? 'UNUSED' : value.toString().padStart(6);
      console.log(`U+${i.toString(16).padStart(4, '0')} | ${valueStr} | '${char}'`);
    }
    
    // Display entries for expected characters (a-z)
    printSubsection('Index Entries for Expected Characters (a-z)');
    
    console.log('\nC++ Index (a-z):');
    console.log('Char | Unicode  | Value');
    console.log('-----|----------|------');
    for (const unicode of TEST_CONFIG.expectedCharacters) {
      const offset = indexStartOffset + unicode * entrySize;
      const value = cppData.readUInt16LE(offset);
      const char = String.fromCharCode(unicode);
      const valueStr = value === 0xFFFF ? 'UNUSED' : value.toString();
      console.log(`'${char}'  | U+${unicode.toString(16).padStart(4, '0')} | ${valueStr}`);
    }
    
    console.log('\nTypeScript Index (a-z):');
    console.log('Char | Unicode  | Value');
    console.log('-----|----------|------');
    for (const unicode of TEST_CONFIG.expectedCharacters) {
      const offset = indexStartOffset + unicode * entrySize;
      const value = tsData.readUInt16LE(offset);
      const char = String.fromCharCode(unicode);
      const valueStr = value === 0xFFFF ? 'UNUSED' : value.toString();
      console.log(`'${char}'  | U+${unicode.toString(16).padStart(4, '0')} | ${valueStr}`);
    }
    
    // Check for specific issues
    printSubsection('Index Diagnostic Checks');
    
    // Check 1: Unused entries initialization
    console.log('\n1. Checking unused entries initialization (should be 0xFFFF)...');
    let unusedOk = true;
    const sampleUnusedPositions = [0, 1, 2, 3, 4, 5, 0x0100, 0x1000, 0x8000, 0xF000];
    for (const pos of sampleUnusedPositions) {
      if (TEST_CONFIG.expectedCharacters.includes(pos)) continue;
      
      const offset = indexStartOffset + pos * entrySize;
      const cppValue = cppData.readUInt16LE(offset);
      const tsValue = tsData.readUInt16LE(offset);
      
      if (cppValue !== 0xFFFF || tsValue !== 0xFFFF) {
        console.log(`  Position U+${pos.toString(16).padStart(4, '0')}: C++=${cppValue.toString(16)}, TS=${tsValue.toString(16)}`);
        unusedOk = false;
      }
    }
    printStatus('Unused entries properly initialized', unusedOk);
    
    // Check 2: Character indices are sequential
    console.log('\n2. Checking character indices are sequential (0, 1, 2, ...)...');
    let sequentialOk = true;
    for (let i = 0; i < TEST_CONFIG.expectedCharacters.length; i++) {
      const unicode = TEST_CONFIG.expectedCharacters[i];
      const offset = indexStartOffset + unicode * entrySize;
      const cppValue = cppData.readUInt16LE(offset);
      const tsValue = tsData.readUInt16LE(offset);
      
      if (cppValue !== i) {
        console.log(`  C++ char '${String.fromCharCode(unicode)}': expected index ${i}, got ${cppValue}`);
        sequentialOk = false;
      }
      if (tsValue !== i) {
        console.log(`  TS char '${String.fromCharCode(unicode)}': expected index ${i}, got ${tsValue}`);
        sequentialOk = false;
      }
    }
    printStatus('Character indices are sequential', sequentialOk);
    
    const indexValid = cppIndexResult.valid && tsIndexResult.valid && unusedOk && sequentialOk;
    printStatus('Index Validation', indexValid);
    
    return indexValid;
  } catch (error) {
    printColor(COLORS.red, `Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Diagnostic check: Binary comparison with hex dump
 * Requirements: 8.1, 8.2
 */
function diagnoseBinary(): boolean {
  printSection('Binary File Diagnostic');
  
  try {
    const cppData = fs.readFileSync(CPP_BIN_FILE);
    const tsData = fs.readFileSync(TS_BIN_FILE);
    
    console.log(`C++ file size: ${cppData.length} bytes`);
    console.log(`TS file size: ${tsData.length} bytes`);
    
    const firstDiff = findFirstDifference(cppData, tsData);
    
    if (firstDiff === -1) {
      printStatus('Binary files match', true);
      return true;
    }
    
    printStatus('Binary files match', false, `First difference at offset ${firstDiff} (0x${firstDiff.toString(16)})`);
    
    // Show hex dump around first difference
    printSubsection('Hex Dump Around First Difference');
    
    const dumpStart = Math.max(0, firstDiff - 32);
    const dumpLength = 64;
    
    console.log('\nC++ binary:');
    console.log(hexDump(cppData, dumpStart, dumpLength));
    
    console.log('\nTypeScript binary:');
    console.log(hexDump(tsData, dumpStart, dumpLength));
    
    // Count total differences
    let diffCount = 0;
    const minLen = Math.min(cppData.length, tsData.length);
    for (let i = 0; i < minLen; i++) {
      if (cppData[i] !== tsData[i]) {
        diffCount++;
      }
    }
    diffCount += Math.abs(cppData.length - tsData.length);
    
    console.log(`\nTotal different bytes: ${diffCount} (${(diffCount / Math.max(cppData.length, tsData.length) * 100).toFixed(2)}%)`);
    
    return false;
  } catch (error) {
    printColor(COLORS.red, `Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Diagnostic check: CST file comparison
 * Requirements: 4.6
 */
function diagnoseCst(): boolean {
  printSection('CST File Diagnostic');
  
  try {
    if (!fs.existsSync(CPP_CST_FILE) || !fs.existsSync(TS_CST_FILE)) {
      printColor(COLORS.yellow, 'CST files not found (may not be generated for this config)');
      return true; // Not a failure
    }
    
    const cppData = fs.readFileSync(CPP_CST_FILE);
    const tsData = fs.readFileSync(TS_CST_FILE);
    
    const result = compareCst(cppData, tsData);
    console.log(formatCstComparisonResult(result));
    
    printStatus('CST files match', result.match);
    
    return result.match;
  } catch (error) {
    printColor(COLORS.red, `Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Diagnostic check: Bit packing validation for 2-bit mode
 * Requirements: 4.2, 4.3
 */
function diagnoseBitPacking(): boolean {
  printSection('Bit Packing Diagnostic (2-bit mode)');
  
  try {
    const cppData = fs.readFileSync(CPP_BIN_FILE);
    const tsData = fs.readFileSync(TS_BIN_FILE);
    
    const cppResult = parseHeader(cppData);
    const tsResult = parseHeader(tsData);
    
    if (!cppResult.success || !tsResult.success || !cppResult.header || !tsResult.header) {
      printColor(COLORS.red, 'Cannot check bit packing: header parse failed');
      return false;
    }
    
    console.log('\n2-bit mode packing: 4 pixels per byte');
    console.log('Pixel values: 0-3 (2 bits each)');
    console.log('Byte layout: [pixel3][pixel2][pixel1][pixel0]');
    console.log('             bits 7-6  bits 5-4  bits 3-2  bits 1-0');
    
    // Calculate glyph data start offset
    const headerLen = cppResult.header.length;
    const indexSize = cppResult.header.indexAreaSize;
    const glyphDataOffset = headerLen + indexSize;
    
    console.log(`\nGlyph data starts at offset: ${glyphDataOffset} (0x${glyphDataOffset.toString(16)})`);
    
    // Show first few bytes of glyph data
    printSubsection('First 16 Bytes of Glyph Data');
    
    console.log('\nC++ glyph data:');
    console.log(hexDump(cppData, glyphDataOffset, 16));
    
    console.log('\nTypeScript glyph data:');
    console.log(hexDump(tsData, glyphDataOffset, 16));
    
    // Check if glyph data matches
    const glyphDataMatch = cppData.subarray(glyphDataOffset, glyphDataOffset + 16)
      .equals(tsData.subarray(glyphDataOffset, glyphDataOffset + 16));
    
    printStatus('First 16 bytes of glyph data match', glyphDataMatch);
    
    return glyphDataMatch;
  } catch (error) {
    printColor(COLORS.red, `Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Main diagnostic function
 */
async function runDiagnostic(): Promise<void> {
  const startTime = Date.now();
  
  printColor(COLORS.bright + COLORS.blue, `
╔════════════════════════════════════════════════════════════════════════════╗
║                   Quick Diagnostic Test: bmp_addr_r2                       ║
║                                                                            ║
║  Configuration: 2-bit bitmap, address mode, 26 lowercase letters (a-z)    ║
║  Target: < 30 seconds execution time                                       ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
  
  console.log(`Test: ${TEST_CONFIG.testName}`);
  console.log(`Description: ${TEST_CONFIG.description}`);
  console.log(`Expected characters: ${TEST_CONFIG.expectedCharacters.length} (a-z)`);
  console.log(`Render mode: ${TEST_CONFIG.renderMode}-bit`);
  console.log(`Index method: ${TEST_CONFIG.indexMethod === 0 ? 'ADDRESS' : 'OFFSET'}`);
  console.log(`Crop: ${TEST_CONFIG.crop}`);
  
  // Check if files exist
  const filesExist = checkFilesExist();
  
  if (!filesExist) {
    printColor(COLORS.red, '\nError: Required files not found!');
    printColor(COLORS.yellow, 'Please run the following commands first:');
    printColor(COLORS.yellow, '  1. npm run test:compat:gen-cpp');
    printColor(COLORS.yellow, '  2. npm run test:compat:gen-ts');
    process.exit(1);
  }
  
  // Run diagnostic checks
  const results = {
    header: diagnoseHeader(),
    index: diagnoseIndex(),
    binary: diagnoseBinary(),
    cst: diagnoseCst(),
    bitPacking: diagnoseBitPacking()
  };
  
  // Summary
  printSection('Diagnostic Summary');
  
  const checks = [
    { name: 'Header Comparison', passed: results.header },
    { name: 'Index Validation', passed: results.index },
    { name: 'Binary Comparison', passed: results.binary },
    { name: 'CST Comparison', passed: results.cst },
    { name: 'Bit Packing', passed: results.bitPacking }
  ];
  
  let passCount = 0;
  for (const check of checks) {
    printStatus(check.name, check.passed);
    if (check.passed) passCount++;
  }
  
  const allPassed = passCount === checks.length;
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(80));
  printColor(
    allPassed ? COLORS.bright + COLORS.green : COLORS.bright + COLORS.red,
    `Overall: ${passCount}/${checks.length} checks passed`
  );
  printColor(COLORS.cyan, `Execution time: ${elapsedTime}s`);
  console.log('='.repeat(80));
  
  if (!allPassed) {
    console.log('\nRecommended next steps:');
    if (!results.header) {
      console.log('  - Review header field differences');
      console.log('  - Check version numbers and bitfield encoding');
    }
    if (!results.index) {
      console.log('  - Review index array initialization');
      console.log('  - Check unused entries are set to 0xFFFF');
      console.log('  - Verify character indices are sequential');
    }
    if (!results.binary || !results.bitPacking) {
      console.log('  - Review bit packing implementation for 2-bit mode');
      console.log('  - Check glyph offset calculations');
      console.log('  - Verify byte alignment');
    }
    if (!results.cst) {
      console.log('  - Review CST file generation');
    }
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run diagnostic
runDiagnostic().catch(error => {
  printColor(COLORS.red, `Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  console.error(error);
  process.exit(1);
});
