/**
 * Test Runner for Compatibility Testing
 * 
 * This module provides functions to run compatibility tests by comparing
 * C++ reference outputs with TypeScript test outputs.
 * 
 * Requirements: 7.1-7.5 - Test execution and reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ComparisonResult,
  ComparisonDetail,
  ComparisonStatus,
  compareHeaders,
  compareCst,
  formatHeaderComparisonResult,
  formatCstComparisonResult
} from './comparator';
import {
  parseHeader,
  ParsedHeader
} from './header-parser';
import {
  validateIndex,
  formatIndexValidationResult
} from './index-validator';
/*
import {
  compareGlyphs,
  GlyphComparisonConfig,
  DEFAULT_GLYPH_CONFIG,
  formatGlyphComparisonResult
} from './glyph-analyzer';
*/

// Re-export types from comparator for convenience
export { ComparisonResult, ComparisonDetail, ComparisonStatus } from './comparator';

/**
 * Test case definition
 */
export interface TestCase {
  /** Test case name */
  name: string;
  /** Test case description */
  description: string;
  /** Expected output files */
  expectedFiles: string[];
}

/**
 * Test execution options
 */
export interface TestRunnerOptions {
  /** Base directory for resolving paths */
  baseDir?: string;
  /** C++ reference output directory */
  cppReferenceDir?: string;
  /** TypeScript test output directory */
  tsOutputDir?: string;
  /** Reports output directory */
  reportsDir?: string;
  /** Glyph comparison configuration */
  glyphConfig?: any; // GlyphComparisonConfig;
  /** Verbose output */
  verbose?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number, testCase: string) => void;
}

/**
 * Default paths
 */
export const RUNNER_DEFAULT_PATHS = {
  CPP_REFERENCE_DIR: '../cpp_reference',
  TS_OUTPUT_DIR: '../ts_output',
  REPORTS_DIR: '../reports',
  CONFIGS_DIR: '../configs'
} as const;



/**
 * Extracts the file pattern from a font filename
 * Pattern format: *_size{N}_bits{M}_{type}.{ext} or *_vector.{ext}
 * 
 * @param filename - Font filename
 * @returns Pattern string or null if not a font file
 */
function extractFilePattern(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, ext);
  
  // Match bitmap pattern: *_size{N}_bits{M}_bitmap
  const bitmapMatch = baseName.match(/_size(\d+)_bits(\d+)_bitmap$/);
  if (bitmapMatch) {
    return `_size${bitmapMatch[1]}_bits${bitmapMatch[2]}_bitmap${ext}`;
  }
  
  // Match vector pattern: *_vector
  const vectorMatch = baseName.match(/_vector$/);
  if (vectorMatch) {
    return `_vector${ext}`;
  }
  
  return null;
}

/**
 * Finds matching font files between C++ and TypeScript outputs
 * 
 * Matching is done by file pattern (e.g., *_size16_bits4_bitmap.bin) rather than
 * exact filename, because C++ uses font filename (NotoSans_Regular) while
 * TypeScript uses font internal name (Noto Sans).
 * 
 * @param cppDir - C++ reference directory
 * @param tsDir - TypeScript output directory
 * @returns Array of matching file pairs
 */
export function findMatchingFiles(
  cppDir: string,
  tsDir: string
): Array<{ name: string; cppPath: string; tsPath: string; type: 'font' | 'cst' }> {
  const matches: Array<{ name: string; cppPath: string; tsPath: string; type: 'font' | 'cst' }> = [];
  
  if (!fs.existsSync(cppDir) || !fs.existsSync(tsDir)) {
    return matches;
  }
  
  const cppFiles = fs.readdirSync(cppDir);
  const tsFiles = fs.readdirSync(tsDir);
  
  // Build a map of TypeScript files by pattern
  const tsFilesByPattern = new Map<string, string>();
  for (const tsFile of tsFiles) {
    const ext = path.extname(tsFile).toLowerCase();
    if (ext === '.font' || ext === '.bin' || ext === '.cst') {
      const pattern = extractFilePattern(tsFile);
      if (pattern) {
        tsFilesByPattern.set(pattern, tsFile);
      }
    }
  }
  
  // Match C++ files to TypeScript files by pattern
  for (const cppFile of cppFiles) {
    const ext = path.extname(cppFile).toLowerCase();
    
    // Check for font files
    if (ext === '.font' || ext === '.bin') {
      const pattern = extractFilePattern(cppFile);
      if (pattern) {
        const tsFile = tsFilesByPattern.get(pattern);
        if (tsFile) {
          matches.push({
            name: cppFile,
            cppPath: path.join(cppDir, cppFile),
            tsPath: path.join(tsDir, tsFile),
            type: 'font'
          });
        }
      }
    }
    
    // Check for CST files
    if (ext === '.cst') {
      const pattern = extractFilePattern(cppFile);
      if (pattern) {
        const tsFile = tsFilesByPattern.get(pattern);
        if (tsFile) {
          matches.push({
            name: cppFile,
            cppPath: path.join(cppDir, cppFile),
            tsPath: path.join(tsDir, tsFile),
            type: 'cst'
          });
        }
      }
    }
  }
  
  return matches;
}

/**
 * Runs comparison for a single test case
 * 
 * @param testCase - Test case name
 * @param options - Test runner options
 * @returns Comparison result
 */
export function runTestCase(
  testCase: string,
  options?: TestRunnerOptions
): ComparisonResult {
  const baseDir = options?.baseDir || __dirname;
  const cppReferenceDir = options?.cppReferenceDir || path.resolve(baseDir, RUNNER_DEFAULT_PATHS.CPP_REFERENCE_DIR);
  const tsOutputDir = options?.tsOutputDir || path.resolve(baseDir, RUNNER_DEFAULT_PATHS.TS_OUTPUT_DIR);
  const glyphConfig = options?.glyphConfig || {}; // DEFAULT_GLYPH_CONFIG;
  const verbose = options?.verbose || false;
  
  const cppDir = path.join(cppReferenceDir, testCase);
  const tsDir = path.join(tsOutputDir, testCase);
  
  const details: ComparisonDetail[] = [];
  let headerMatch = false;
  let indexValid = false;
  let cstMatch = false;
  let glyphSimilarity = 0;
  
  // Check if directories exist
  if (!fs.existsSync(cppDir)) {
    return {
      testCase,
      status: 'FAIL',
      headerMatch: false,
      indexValid: false,
      cstMatch: false,
      glyphSimilarity: 0,
      details: [{
        section: 'header',
        status: 'mismatch',
        message: `C++ reference directory not found: ${cppDir}`
      }]
    };
  }
  
  if (!fs.existsSync(tsDir)) {
    return {
      testCase,
      status: 'FAIL',
      headerMatch: false,
      indexValid: false,
      cstMatch: false,
      glyphSimilarity: 0,
      details: [{
        section: 'header',
        status: 'mismatch',
        message: `TypeScript output directory not found: ${tsDir}`
      }]
    };
  }
  
  // Find matching files
  const matchingFiles = findMatchingFiles(cppDir, tsDir);
  
  if (matchingFiles.length === 0) {
    return {
      testCase,
      status: 'FAIL',
      headerMatch: false,
      indexValid: false,
      cstMatch: false,
      glyphSimilarity: 0,
      details: [{
        section: 'header',
        status: 'mismatch',
        message: 'No matching files found between C++ and TypeScript outputs'
      }]
    };
  }
  
  // Process font files
  const fontFiles = matchingFiles.filter(f => f.type === 'font');
  const cstFiles = matchingFiles.filter(f => f.type === 'cst');
  
  if (verbose) {
    console.log(`  Found ${fontFiles.length} font file(s) and ${cstFiles.length} CST file(s)`);
  }
  
  // Compare font files
  for (const fontFile of fontFiles) {
    const cppData = fs.readFileSync(fontFile.cppPath);
    const tsData = fs.readFileSync(fontFile.tsPath);
    
    // Compare headers
    const headerResult = compareHeaders(cppData, tsData);
    
    if (headerResult.match) {
      headerMatch = true;
      details.push({
        section: 'header',
        status: 'match',
        message: `Header match for ${fontFile.name}`
      });
    } else {
      details.push({
        section: 'header',
        status: 'mismatch',
        message: `Header mismatch for ${fontFile.name}: ${headerResult.error || 'Unknown error'}`,
        offset: headerResult.firstDiffOffset,
        expected: headerResult.cppHeader ? JSON.stringify(headerResult.cppHeader) : undefined,
        actual: headerResult.tsHeader ? JSON.stringify(headerResult.tsHeader) : undefined
      });
      
      if (verbose && headerResult.hexDump) {
        console.log(`  Header hex dump:\n${headerResult.hexDump}`);
      }
    }
    
    // Validate index structure
    if (headerResult.tsHeader) {
      try {
        const indexResult = validateIndex(fontFile.tsPath, headerResult.tsHeader);
        
        if (indexResult.valid) {
          indexValid = true;
          details.push({
            section: 'index',
            status: 'match',
            message: `Index valid for ${fontFile.name}: ${indexResult.validMappings} mappings`
          });
        } else {
          details.push({
            section: 'index',
            status: 'mismatch',
            message: `Index invalid for ${fontFile.name}: ${indexResult.errors.join(', ')}`
          });
        }
      } catch (indexError) {
        details.push({
          section: 'index',
          status: 'mismatch',
          message: `Index validation error for ${fontFile.name}: ${indexError instanceof Error ? indexError.message : String(indexError)}`
        });
      }
      
      // Compare glyphs (only for bitmap fonts)
      // TODO: Fix glyph comparison - currently disabled due to missing functions
      /*
      try {
        if (headerResult.cppHeader && headerResult.tsHeader) {
          const glyphResult = compareGlyphs(
            cppData,
            tsData,
            headerResult.cppHeader,
            headerResult.tsHeader,
            glyphConfig
          );
          
          glyphSimilarity = glyphResult.similarity;
          
          if (glyphResult.status === 'PASS') {
            details.push({
              section: 'glyph',
              status: 'match',
              message: `Glyph match for ${fontFile.name}: ${glyphResult.similarity.toFixed(1)}% similarity`
            });
          } else if (glyphResult.status === 'PARTIAL') {
            details.push({
              section: 'glyph',
              status: 'similar',
              message: `Glyph partial match for ${fontFile.name}: ${glyphResult.similarity.toFixed(1)}% similarity`
            });
          } else {
            details.push({
              section: 'glyph',
              status: 'mismatch',
              message: `Glyph mismatch for ${fontFile.name}: ${glyphResult.similarity.toFixed(1)}% similarity, ${glyphResult.differentCount} different`
            });
          }
          
          if (verbose) {
            console.log(formatGlyphComparisonResult(glyphResult));
          }
        }
      } catch (glyphError) {
        details.push({
          section: 'glyph',
          status: 'mismatch',
          message: `Glyph comparison error for ${fontFile.name}: ${glyphError instanceof Error ? glyphError.message : String(glyphError)}`
        });
      }
      */
    }
  }
  
  // Compare CST files
  for (const cstFile of cstFiles) {
    const cppData = fs.readFileSync(cstFile.cppPath);
    const tsData = fs.readFileSync(cstFile.tsPath);
    
    const cstResult = compareCst(cppData, tsData);
    
    if (cstResult.match) {
      cstMatch = true;
      details.push({
        section: 'cst',
        status: 'match',
        message: `CST match for ${cstFile.name}`
      });
    } else {
      details.push({
        section: 'cst',
        status: 'mismatch',
        message: `CST mismatch for ${cstFile.name}: ${cstResult.error}`,
        offset: cstResult.firstDiffOffset
      });
    }
  }
  
  // Determine overall status
  let status: ComparisonStatus;
  if (headerMatch && indexValid && cstMatch && glyphSimilarity >= 99) {
    status = 'PASS';
  } else if (headerMatch && indexValid && glyphSimilarity >= 95) {
    status = 'PARTIAL';
  } else {
    status = 'FAIL';
  }
  
  return {
    testCase,
    status,
    headerMatch,
    indexValid,
    cstMatch,
    glyphSimilarity,
    details
  };
}



/**
 * Runs all compatibility tests
 * 
 * @param options - Test runner options
 * @returns Array of comparison results
 */
export function runAllTests(options?: TestRunnerOptions): ComparisonResult[] {
  const baseDir = options?.baseDir || __dirname;
  const cppReferenceDir = options?.cppReferenceDir || path.resolve(baseDir, RUNNER_DEFAULT_PATHS.CPP_REFERENCE_DIR);
  const tsOutputDir = options?.tsOutputDir || path.resolve(baseDir, RUNNER_DEFAULT_PATHS.TS_OUTPUT_DIR);
  
  // Get list of test cases from C++ reference directory
  const testCases: string[] = [];
  
  if (fs.existsSync(cppReferenceDir)) {
    const entries = fs.readdirSync(cppReferenceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        testCases.push(entry.name);
      }
    }
  }
  
  if (testCases.length === 0) {
    console.warn('No test cases found in C++ reference directory');
    return [];
  }
  
  const results: ComparisonResult[] = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    if (options?.onProgress) {
      options.onProgress(i + 1, testCases.length, testCase);
    }
    
    const result = runTestCase(testCase, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Runs specific test cases
 * 
 * @param testCases - Array of test case names
 * @param options - Test runner options
 * @returns Array of comparison results
 */
export function runTestCases(
  testCases: string[],
  options?: TestRunnerOptions
): ComparisonResult[] {
  const results: ComparisonResult[] = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    if (options?.onProgress) {
      options.onProgress(i + 1, testCases.length, testCase);
    }
    
    const result = runTestCase(testCase, options);
    results.push(result);
  }
  
  return results;
}

/**
 * Test report structure
 */
export interface TestReport {
  /** Report timestamp */
  timestamp: string;
  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
  };
  /** Individual test results */
  results: ComparisonResult[];
}

/**
 * Generates a test report
 * 
 * @param results - Array of comparison results
 * @returns Test report
 */
export function generateReport(results: ComparisonResult[]): TestReport {
  const passed = results.filter(r => r.status === 'PASS').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  return {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      partial,
      failed
    },
    results
  };
}

/**
 * Saves test report to JSON file
 * 
 * @param report - Test report
 * @param outputPath - Output file path
 */
export function saveReportJson(report: TestReport, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

/**
 * Formats test result as console output line
 */
export function formatTestResultLine(result: ComparisonResult): string {
  const statusIcon = result.status === 'PASS' ? '✓' : result.status === 'PARTIAL' ? '~' : '✗';
  const statusStr = `[${result.status}]`.padEnd(8);
  const headerIcon = result.headerMatch ? '✓' : '✗';
  const indexIcon = result.indexValid ? '✓' : '✗';
  const cstIcon = result.cstMatch ? '✓' : '✗';
  const glyphStr = result.glyphSimilarity > 0 ? `${result.glyphSimilarity.toFixed(1)}%` : 'N/A';
  
  return `${statusStr} ${result.testCase.padEnd(16)} Header: ${headerIcon}  Index: ${indexIcon}  CST: ${cstIcon}  Glyph: ${glyphStr}`;
}

/**
 * Formats test report as console summary
 */
export function formatReportSummary(report: TestReport): string {
  const lines: string[] = [
    '=== TypeScript vs C++ Compatibility Test ===',
    ''
  ];
  
  for (const result of report.results) {
    lines.push(formatTestResultLine(result));
  }
  
  lines.push('');
  lines.push(`Summary: ${report.summary.passed} PASS, ${report.summary.partial} PARTIAL, ${report.summary.failed} FAIL`);
  lines.push(`Timestamp: ${report.timestamp}`);
  
  return lines.join('\n');
}

/**
 * Formats detailed test report
 */
export function formatDetailedReport(report: TestReport): string {
  const lines: string[] = [
    '=== Detailed Compatibility Test Report ===',
    `Timestamp: ${report.timestamp}`,
    '',
    `Total: ${report.summary.total}`,
    `Passed: ${report.summary.passed}`,
    `Partial: ${report.summary.partial}`,
    `Failed: ${report.summary.failed}`,
    '',
    '--- Results ---'
  ];
  
  for (const result of report.results) {
    lines.push('');
    lines.push(`Test Case: ${result.testCase}`);
    lines.push(`  Status: ${result.status}`);
    lines.push(`  Header Match: ${result.headerMatch}`);
    lines.push(`  Index Valid: ${result.indexValid}`);
    lines.push(`  CST Match: ${result.cstMatch}`);
    lines.push(`  Glyph Similarity: ${result.glyphSimilarity.toFixed(2)}%`);
    
    if (result.details.length > 0) {
      lines.push('  Details:');
      for (const detail of result.details) {
        const statusIcon = detail.status === 'match' ? '✓' : detail.status === 'similar' ? '~' : '✗';
        lines.push(`    [${statusIcon}] ${detail.section}: ${detail.message}`);
      }
    }
  }
  
  return lines.join('\n');
}

