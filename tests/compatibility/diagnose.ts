#!/usr/bin/env ts-node
/**
 * Comprehensive Diagnostic Tool for TypeScript Compatibility Fixes
 * 
 * This tool analyzes specific test cases and provides detailed diagnostic information
 * to help identify and fix compatibility issues between TypeScript and C++ implementations.
 * 
 * Usage:
 *   npx ts-node tests/compatibility/diagnose.ts <test-case>
 *   npx ts-node tests/compatibility/diagnose.ts bmp_addr_r4
 *   npx ts-node tests/compatibility/diagnose.ts --all
 * 
 * Requirements: 6.1, 6.2, 7.6 - Diagnostic tools and error analysis
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  parseHeader,
  ParsedHeader,
  ParsedBitmapHeader,
  ParsedVectorHeader
} from './framework/header-parser';
import {
  compareHeaders,
  compareCst,
  HeaderComparisonResult,
  CstComparisonResult
} from './framework/comparator';
import {
  validateIndex,
  IndexValidationResult
} from './framework/index-validator';
import {
  analyzeGlyphSimilarity,
  GlyphComparisonResult
} from './framework/glyph-analyzer';

/**
 * Diagnostic result for a test case
 */
interface DiagnosticResult {
  testCase: string;
  timestamp: string;
  filesFound: {
    cppBin: boolean;
    tsBin: boolean;
    cppCst: boolean;
    tsCst: boolean;
  };
  header: {
    analyzed: boolean;
    match: boolean;
    details?: HeaderComparisonResult;
    summary?: string;
  };
  index: {
    analyzed: boolean;
    valid: boolean;
    details?: IndexValidationResult;
    summary?: string;
  };
  cst: {
    analyzed: boolean;
    match: boolean;
    details?: CstComparisonResult;
    summary?: string;
  };
  glyph: {
    analyzed: boolean;
    similarity: number;
    details?: GlyphComparisonResult;
    summary?: string;
  };
  recommendations: string[];
}

/**
 * ANSI color codes
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Prints a colored message
 */
function print(message: string, color: string = COLORS.white): void {
  console.log(`${color}${message}${COLORS.reset}`);
}

/**
 * Prints a section header
 */
function printSection(title: string): void {
  console.log('');
  print('═'.repeat(60), COLORS.cyan);
  print(title, COLORS.cyan + COLORS.bright);
  print('═'.repeat(60), COLORS.cyan);
}

/**
 * Prints a subsection header
 */
function printSubsection(title: string): void {
  console.log('');
  print(`─── ${title} ${'─'.repeat(60 - title.length - 5)}`, COLORS.cyan);
}

/**
 * Formats bytes as hex string
 */
function formatHex(value: number, bytes: number = 1): string {
  return '0x' + value.toString(16).padStart(bytes * 2, '0').toUpperCase();
}

/**
 * Formats a hex dump of buffer
 */
function formatHexDump(buffer: Buffer, offset: number, length: number = 16): string {
  const start = Math.max(0, offset - 8);
  const end = Math.min(buffer.length, offset + length);
  const lines: string[] = [];
  
  for (let i = start; i < end; i += 16) {
    const lineOffset = formatHex(i, 4);
    const bytes: string[] = [];
    const ascii: string[] = [];
    
    for (let j = 0; j < 16 && i + j < end; j++) {
      const byte = buffer[i + j];
      const isHighlight = (i + j >= offset && i + j < offset + 4);
      const hexStr = byte.toString(16).padStart(2, '0').toUpperCase();
      
      if (isHighlight) {
        bytes.push(`${COLORS.yellow}${hexStr}${COLORS.reset}`);
      } else {
        bytes.push(hexStr);
      }
      
      ascii.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
    }
    
    lines.push(`  ${lineOffset}  ${bytes.join(' ').padEnd(48)}  ${ascii.join('')}`);
  }
  
  return lines.join('\n');
}

/**
 * Analyzes header differences
 */
function analyzeHeader(
  cppBinPath: string,
  tsBinPath: string
): DiagnosticResult['header'] {
  try {
    const cppData = fs.readFileSync(cppBinPath);
    const tsData = fs.readFileSync(tsBinPath);
    
    const result = compareHeaders(cppData, tsData);
    
    let summary = '';
    if (result.match) {
      summary = `${COLORS.green}✓ Headers match perfectly${COLORS.reset}`;
    } else {
      summary = `${COLORS.red}✗ Headers differ${COLORS.reset}`;
      
      if (result.differences && result.differences.length > 0) {
        summary += `\n  Found ${result.differences.length} field difference(s)`;
        
        for (const diff of result.differences.slice(0, 5)) {
          const offsetStr = diff.offset !== undefined ? ` (offset ${formatHex(diff.offset, 2)})` : '';
          summary += `\n  - ${diff.field}${offsetStr}:`;
          summary += `\n    C++: ${JSON.stringify(diff.expected)}`;
          summary += `\n    TS:  ${JSON.stringify(diff.actual)}`;
        }
        
        if (result.differences.length > 5) {
          summary += `\n  ... and ${result.differences.length - 5} more`;
        }
      }
      
      if (result.firstDiffOffset !== undefined) {
        summary += `\n  First byte difference at offset ${formatHex(result.firstDiffOffset, 2)}`;
      }
    }
    
    return {
      analyzed: true,
      match: result.match,
      details: result,
      summary
    };
  } catch (error) {
    return {
      analyzed: false,
      match: false,
      summary: `${COLORS.red}Error analyzing header: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`
    };
  }
}

/**
 * Analyzes index structure
 */
function analyzeIndex(
  tsBinPath: string,
  header: ParsedHeader
): DiagnosticResult['index'] {
  try {
    const result = validateIndex(tsBinPath, header);
    
    let summary = '';
    if (result.valid) {
      summary = `${COLORS.green}✓ Index structure valid${COLORS.reset}`;
      summary += `\n  Valid mappings: ${result.validMappings}`;
      summary += `\n  Expected entries: ${result.expectedEntries}`;
    } else {
      summary = `${COLORS.red}✗ Index validation failed${COLORS.reset}`;
      
      if (result.errors.length > 0) {
        summary += `\n  Errors (${result.errors.length}):`;
        for (const error of result.errors.slice(0, 5)) {
          summary += `\n  - ${error}`;
        }
        if (result.errors.length > 5) {
          summary += `\n  ... and ${result.errors.length - 5} more`;
        }
      }
      
      if (result.warnings.length > 0) {
        summary += `\n  Warnings (${result.warnings.length}):`;
        for (const warning of result.warnings.slice(0, 3)) {
          summary += `\n  - ${warning}`;
        }
        if (result.warnings.length > 3) {
          summary += `\n  ... and ${result.warnings.length - 3} more`;
        }
      }
    }
    
    return {
      analyzed: true,
      valid: result.valid,
      details: result,
      summary
    };
  } catch (error) {
    return {
      analyzed: false,
      valid: false,
      summary: `${COLORS.red}Error validating index: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`
    };
  }
}

/**
 * Analyzes CST file differences
 */
function analyzeCst(
  cppCstPath: string,
  tsCstPath: string
): DiagnosticResult['cst'] {
  try {
    if (!fs.existsSync(cppCstPath) || !fs.existsSync(tsCstPath)) {
      return {
        analyzed: false,
        match: false,
        summary: `${COLORS.yellow}⚠ CST files not found${COLORS.reset}`
      };
    }
    
    const cppData = fs.readFileSync(cppCstPath);
    const tsData = fs.readFileSync(tsCstPath);
    
    const result = compareCst(cppData, tsData);
    
    let summary = '';
    if (result.match) {
      summary = `${COLORS.green}✓ CST files match perfectly${COLORS.reset}`;
      summary += `\n  Size: ${result.cppSize} bytes`;
      summary += `\n  Characters: ${result.cppCharCount}`;
    } else {
      summary = `${COLORS.red}✗ CST files differ${COLORS.reset}`;
      summary += `\n  C++ size: ${result.cppSize} bytes (${result.cppCharCount} characters)`;
      summary += `\n  TS size:  ${result.tsSize} bytes (${result.tsCharCount} characters)`;
      summary += `\n  Difference: ${result.tsSize - result.cppSize} bytes (${result.tsCharCount - result.cppCharCount} characters)`;
      
      if (result.firstDiffOffset !== undefined) {
        summary += `\n  First difference at offset ${formatHex(result.firstDiffOffset, 2)}`;
      }
      
      if (result.diffCount !== undefined) {
        summary += `\n  Total differences: ${result.diffCount} bytes`;
      }
    }
    
    return {
      analyzed: true,
      match: result.match,
      details: result,
      summary
    };
  } catch (error) {
    return {
      analyzed: false,
      match: false,
      summary: `${COLORS.red}Error comparing CST: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`
    };
  }
}

/**
 * Analyzes glyph similarity
 */
function analyzeGlyph(
  cppBinPath: string,
  tsBinPath: string,
  cppHeader: ParsedHeader,
  tsHeader: ParsedHeader
): DiagnosticResult['glyph'] {
  try {
    // Only analyze for bitmap fonts
    if (cppHeader.fileFlag !== 1 || tsHeader.fileFlag !== 1) {
      return {
        analyzed: false,
        similarity: 0,
        summary: `${COLORS.yellow}⚠ Glyph analysis only available for bitmap fonts${COLORS.reset}`
      };
    }
    
    const cppData = fs.readFileSync(cppBinPath);
    const tsData = fs.readFileSync(tsBinPath);
    
    const result = analyzeGlyphSimilarity(cppData, tsData, cppHeader as ParsedBitmapHeader);
    
    let summary = '';
    const simPercent = result.similarity.toFixed(2);
    
    if (result.similarity >= 99) {
      summary = `${COLORS.green}✓ Glyphs highly similar: ${simPercent}%${COLORS.reset}`;
    } else if (result.similarity >= 95) {
      summary = `${COLORS.yellow}~ Glyphs partially similar: ${simPercent}%${COLORS.reset}`;
    } else {
      summary = `${COLORS.red}✗ Glyphs differ significantly: ${simPercent}%${COLORS.reset}`;
    }
    
    summary += `\n  Total glyphs: ${result.totalGlyphs}`;
    summary += `\n  Identical: ${result.identicalCount}`;
    summary += `\n  Similar: ${result.similarCount}`;
    summary += `\n  Different: ${result.differentCount}`;
    summary += `\n  Avg pixel diff: ${(result.avgPixelDiffRate * 100).toFixed(2)}%`;
    summary += `\n  Avg PSNR: ${result.avgPsnr.toFixed(2)} dB`;
    
    if (result.differentCount > 0) {
      const sortedGlyphs = result.glyphs
        .filter(g => g.status === 'different')
        .sort((a, b) => b.pixelDiffRate - a.pixelDiffRate);
      
      summary += `\n  Top different glyphs:`;
      for (const glyph of sortedGlyphs.slice(0, 3)) {
        summary += `\n  - '${glyph.char}' (U+${glyph.unicode.toString(16).padStart(4, '0')}): ${(glyph.pixelDiffRate * 100).toFixed(2)}% diff`;
      }
    }
    
    return {
      analyzed: true,
      similarity: result.similarity,
      details: result,
      summary
    };
  } catch (error) {
    return {
      analyzed: false,
      similarity: 0,
      summary: `${COLORS.red}Error analyzing glyphs: ${error instanceof Error ? error.message : String(error)}${COLORS.reset}`
    };
  }
}

/**
 * Generates recommendations based on diagnostic results
 */
function generateRecommendations(result: DiagnosticResult): string[] {
  const recommendations: string[] = [];
  
  // CST recommendations
  if (result.cst.analyzed && !result.cst.match) {
    if (result.cst.details) {
      const charDiff = result.cst.details.tsCharCount - result.cst.details.cppCharCount;
      if (charDiff < 0) {
        recommendations.push(
          `CST: TypeScript is missing ${Math.abs(charDiff)} characters. ` +
          `Check if writeCharacterSetFile() includes all requested characters, not just successfully rendered ones.`
        );
      } else if (charDiff > 0) {
        recommendations.push(
          `CST: TypeScript has ${charDiff} extra characters. ` +
          `Check character filtering logic in CST generation.`
        );
      }
    }
  }
  
  // Header recommendations
  if (result.header.analyzed && !result.header.match) {
    if (result.header.details?.differences) {
      const hasIndexAreaSize = result.header.details.differences.some(d => d.field === 'indexAreaSize');
      if (hasIndexAreaSize) {
        recommendations.push(
          `Header: indexAreaSize mismatch. For Offset mode, should be N × 4 bytes. ` +
          `Check calculateIndexAreaSize() implementation.`
        );
      }
      
      const hasFontName = result.header.details.differences.some(d => d.field === 'fontName');
      if (hasFontName) {
        recommendations.push(
          `Header: fontName mismatch. Should use font filename (e.g., "NotoSans_Regular") ` +
          `not internal font name. Check getFontName() implementation.`
        );
      }
    }
  }
  
  // Index recommendations
  if (result.index.analyzed && !result.index.valid) {
    if (result.index.details?.errors.some(e => e.includes('size'))) {
      recommendations.push(
        `Index: Size mismatch. For Address mode, should be 65536 × entry_size. ` +
        `Check createIndexArray() implementation.`
      );
    }
    
    if (result.index.details?.errors.some(e => e.includes('offset') || e.includes('position'))) {
      recommendations.push(
        `Index: Invalid offsets/positions. Check file offset calculation in index generation.`
      );
    }
  }
  
  // Glyph recommendations
  if (result.glyph.analyzed && result.glyph.similarity < 95) {
    recommendations.push(
      `Glyph: Low similarity (${result.glyph.similarity.toFixed(1)}%). ` +
      `This may be due to rendering engine differences (FreeType vs opentype.js). ` +
      `Consider adjusting rendering parameters or accepting this as a known limitation.`
    );
  }
  
  // General recommendations
  if (!result.header.match || !result.index.valid || !result.cst.match) {
    recommendations.push(
      `Run C++ tool with same config and compare outputs manually: ` +
      `fontDictionary.exe config.json`
    );
    
    recommendations.push(
      `Check C++ source code for reference implementation: ` +
      `font-tool-source/FontGenerator.h, BitmapFontGenerator.h, VectorFontGenerator.h`
    );
  }
  
  return recommendations;
}

/**
 * Diagnoses a single test case
 */
async function diagnoseTestCase(testCase: string): Promise<DiagnosticResult> {
  const baseDir = path.resolve(__dirname);
  const cppDir = path.join(baseDir, 'cpp_reference', testCase);
  const tsDir = path.join(baseDir, 'ts_output', testCase);
  
  printSection(`Diagnostic Report: ${testCase}`);
  print(`Timestamp: ${new Date().toISOString()}`, COLORS.white);
  
  // Check if directories exist
  const filesFound = {
    cppBin: false,
    tsBin: false,
    cppCst: false,
    tsCst: false
  };
  
  if (!fs.existsSync(cppDir)) {
    print(`\n${COLORS.red}Error: C++ reference directory not found: ${cppDir}${COLORS.reset}`, COLORS.red);
    return {
      testCase,
      timestamp: new Date().toISOString(),
      filesFound,
      header: { analyzed: false, match: false },
      index: { analyzed: false, valid: false },
      cst: { analyzed: false, match: false },
      glyph: { analyzed: false, similarity: 0 },
      recommendations: ['C++ reference directory not found. Generate reference outputs first.']
    };
  }
  
  if (!fs.existsSync(tsDir)) {
    print(`\n${COLORS.red}Error: TypeScript output directory not found: ${tsDir}${COLORS.reset}`, COLORS.red);
    return {
      testCase,
      timestamp: new Date().toISOString(),
      filesFound,
      header: { analyzed: false, match: false },
      index: { analyzed: false, valid: false },
      cst: { analyzed: false, match: false },
      glyph: { analyzed: false, similarity: 0 },
      recommendations: ['TypeScript output directory not found. Run TypeScript generator first.']
    };
  }
  
  // Find binary files
  const cppFiles = fs.readdirSync(cppDir).filter(f => f.endsWith('.bin') || f.endsWith('.font'));
  const tsFiles = fs.readdirSync(tsDir).filter(f => f.endsWith('.bin') || f.endsWith('.font'));
  
  if (cppFiles.length === 0 || tsFiles.length === 0) {
    print(`\n${COLORS.red}Error: Binary files not found${COLORS.reset}`, COLORS.red);
    return {
      testCase,
      timestamp: new Date().toISOString(),
      filesFound,
      header: { analyzed: false, match: false },
      index: { analyzed: false, valid: false },
      cst: { analyzed: false, match: false },
      glyph: { analyzed: false, similarity: 0 },
      recommendations: ['Binary files not found. Check generator outputs.']
    };
  }
  
  const cppBinPath = path.join(cppDir, cppFiles[0]);
  const tsBinPath = path.join(tsDir, tsFiles[0]);
  const cppCstPath = cppBinPath.replace(/\.(bin|font)$/, '.cst');
  const tsCstPath = tsBinPath.replace(/\.(bin|font)$/, '.cst');
  
  filesFound.cppBin = fs.existsSync(cppBinPath);
  filesFound.tsBin = fs.existsSync(tsBinPath);
  filesFound.cppCst = fs.existsSync(cppCstPath);
  filesFound.tsCst = fs.existsSync(tsCstPath);
  
  print(`\nFiles found:`, COLORS.white);
  print(`  C++ binary: ${filesFound.cppBin ? '✓' : '✗'} ${cppBinPath}`, filesFound.cppBin ? COLORS.green : COLORS.red);
  print(`  TS binary:  ${filesFound.tsBin ? '✓' : '✗'} ${tsBinPath}`, filesFound.tsBin ? COLORS.green : COLORS.red);
  print(`  C++ CST:    ${filesFound.cppCst ? '✓' : '✗'} ${cppCstPath}`, filesFound.cppCst ? COLORS.green : COLORS.red);
  print(`  TS CST:     ${filesFound.tsCst ? '✓' : '✗'} ${tsCstPath}`, filesFound.tsCst ? COLORS.green : COLORS.red);
  
  // Analyze header
  printSubsection('1. Header Analysis');
  const headerResult = analyzeHeader(cppBinPath, tsBinPath);
  console.log(headerResult.summary);
  
  // Analyze index
  printSubsection('2. Index Validation');
  let indexResult: DiagnosticResult['index'] = { analyzed: false, valid: false };
  if (headerResult.details?.tsHeader) {
    indexResult = analyzeIndex(tsBinPath, headerResult.details.tsHeader);
    console.log(indexResult.summary);
  } else {
    print('Cannot validate index: header parsing failed', COLORS.yellow);
  }
  
  // Analyze CST
  printSubsection('3. CST File Comparison');
  const cstResult = analyzeCst(cppCstPath, tsCstPath);
  console.log(cstResult.summary);
  
  // Analyze glyphs
  printSubsection('4. Glyph Similarity Analysis');
  let glyphResult: DiagnosticResult['glyph'] = { analyzed: false, similarity: 0 };
  if (headerResult.details?.cppHeader && headerResult.details?.tsHeader) {
    glyphResult = analyzeGlyph(
      cppBinPath,
      tsBinPath,
      headerResult.details.cppHeader,
      headerResult.details.tsHeader
    );
    console.log(glyphResult.summary);
  } else {
    print('Cannot analyze glyphs: header parsing failed', COLORS.yellow);
  }
  
  // Generate result
  const result: DiagnosticResult = {
    testCase,
    timestamp: new Date().toISOString(),
    filesFound,
    header: headerResult,
    index: indexResult,
    cst: cstResult,
    glyph: glyphResult,
    recommendations: []
  };
  
  result.recommendations = generateRecommendations(result);
  
  // Print recommendations
  if (result.recommendations.length > 0) {
    printSubsection('5. Recommendations');
    for (let i = 0; i < result.recommendations.length; i++) {
      print(`\n${i + 1}. ${result.recommendations[i]}`, COLORS.yellow);
    }
  }
  
  printSection('Diagnostic Complete');
  
  return result;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: npx ts-node diagnose.ts <test-case>');
    console.log('       npx ts-node diagnose.ts --all');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node diagnose.ts bmp_addr_r4');
    console.log('  npx ts-node diagnose.ts vec_addr');
    console.log('  npx ts-node diagnose.ts --all');
    process.exit(0);
  }
  
  if (args[0] === '--all') {
    // Diagnose all test cases
    const baseDir = path.resolve(__dirname);
    const cppRefDir = path.join(baseDir, 'cpp_reference');
    
    if (!fs.existsSync(cppRefDir)) {
      print('Error: C++ reference directory not found', COLORS.red);
      process.exit(1);
    }
    
    const testCases = fs.readdirSync(cppRefDir)
      .filter(name => {
        const stat = fs.statSync(path.join(cppRefDir, name));
        return stat.isDirectory() && !name.startsWith('.');
      });
    
    print(`Found ${testCases.length} test cases`, COLORS.cyan);
    
    for (const testCase of testCases) {
      await diagnoseTestCase(testCase);
      console.log('');
    }
  } else {
    // Diagnose single test case
    const testCase = args[0];
    await diagnoseTestCase(testCase);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });
}

export { diagnoseTestCase, DiagnosticResult };
