/**
 * Report Generator for Compatibility Testing
 * 
 * This module provides comprehensive report generation functionality
 * for compatibility test results, including JSON detailed reports
 * and console summaries.
 * 
 * Requirements: 4.9, 4.10, 7.4, 7.5 - Report generation
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ComparisonResult,
  ComparisonDetail,
  ComparisonStatus,
  HeaderComparisonResult,
  CstComparisonResult
} from './comparator';
import { GlyphComparisonResult, GlyphAnalysis } from './glyph-analyzer';

/**
 * Test report summary statistics
 */
export interface ReportSummary {
  /** Total number of test cases */
  total: number;
  /** Number of passed test cases */
  passed: number;
  /** Number of partially passed test cases */
  partial: number;
  /** Number of failed test cases */
  failed: number;
  /** Pass rate percentage */
  passRate: number;
  /** Overall status */
  overallStatus: ComparisonStatus;
}

/**
 * Detailed test case result for JSON report
 */
export interface DetailedTestResult {
  /** Test case name */
  testCase: string;
  /** Overall status */
  status: ComparisonStatus;
  /** Header comparison result */
  header: {
    match: boolean;
    fileType?: string;
    differences?: Array<{
      field: string;
      expected: unknown;
      actual: unknown;
      offset?: number;
    }>;
    firstDiffOffset?: number;
    error?: string;
  };
  /** Index validation result */
  index: {
    valid: boolean;
    entryCount?: number;
    method?: string;
    error?: string;
  };
  /** CST comparison result */
  cst: {
    match: boolean;
    cppSize?: number;
    tsSize?: number;
    firstDiffOffset?: number;
    diffCount?: number;
    error?: string;
  };
  /** Glyph comparison result */
  glyph: {
    similarity: number;
    status: string;
    totalGlyphs?: number;
    identicalCount?: number;
    similarCount?: number;
    differentCount?: number;
    avgPixelDiffRate?: number;
    avgPsnr?: number;
    differentGlyphs?: Array<{
      unicode: number;
      char: string;
      pixelDiffRate: number;
      psnr: number;
      status: string;
    }>;
    error?: string;
  };
  /** All comparison details */
  details: ComparisonDetail[];
}

/**
 * Complete JSON report structure
 * Requirements: 4.9 - Detailed JSON report
 */
export interface JsonReport {
  /** Report metadata */
  metadata: {
    /** Report generation timestamp */
    timestamp: string;
    /** Report version */
    version: string;
    /** Generator name */
    generator: string;
    /** Test framework version */
    frameworkVersion: string;
  };
  /** Summary statistics */
  summary: ReportSummary;
  /** Configuration used */
  configuration: {
    /** Glyph similarity thresholds */
    glyphThresholds: {
      passThreshold: number;
      partialThreshold: number;
      psnrPassThreshold: number;
      psnrPartialThreshold: number;
    };
    /** Test cases executed */
    testCases: string[];
  };
  /** Detailed results for each test case */
  results: DetailedTestResult[];
  /** Execution timing */
  timing?: {
    startTime: string;
    endTime: string;
    durationMs: number;
  };
}


/**
 * Console output configuration
 */
export interface ConsoleOutputConfig {
  /** Show colors in output */
  colors: boolean;
  /** Show detailed information */
  detailed: boolean;
  /** Show progress during execution */
  showProgress: boolean;
  /** Maximum width for output */
  maxWidth: number;
}

/**
 * Default console output configuration
 */
export const DEFAULT_CONSOLE_CONFIG: ConsoleOutputConfig = {
  colors: true,
  detailed: false,
  showProgress: true,
  maxWidth: 80
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Status icons for console output
 */
const STATUS_ICONS = {
  PASS: '✓',
  PARTIAL: '~',
  FAIL: '✗',
  match: '✓',
  mismatch: '✗',
  similar: '~'
};

/**
 * Calculates summary statistics from comparison results
 * 
 * @param results - Array of comparison results
 * @returns Report summary
 */
export function calculateSummary(results: ComparisonResult[]): ReportSummary {
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const passRate = total > 0 ? ((passed + partial * 0.5) / total) * 100 : 0;
  
  let overallStatus: ComparisonStatus;
  if (failed === 0 && partial === 0) {
    overallStatus = 'PASS';
  } else if (failed === 0) {
    overallStatus = 'PARTIAL';
  } else {
    overallStatus = 'FAIL';
  }
  
  return {
    total,
    passed,
    partial,
    failed,
    passRate,
    overallStatus
  };
}

/**
 * Converts a ComparisonResult to DetailedTestResult for JSON report
 * 
 * @param result - Comparison result
 * @returns Detailed test result
 */
export function toDetailedResult(result: ComparisonResult): DetailedTestResult {
  // Extract header details
  const headerDetails = result.details.filter(d => d.section === 'header');
  const indexDetails = result.details.filter(d => d.section === 'index');
  const cstDetails = result.details.filter(d => d.section === 'cst');
  const glyphDetails = result.details.filter(d => d.section === 'glyph');
  
  return {
    testCase: result.testCase,
    status: result.status,
    header: {
      match: result.headerMatch,
      fileType: result.headerResult?.fileType,
      differences: result.headerResult?.differences,
      firstDiffOffset: result.headerResult?.firstDiffOffset,
      error: result.headerResult?.error || headerDetails.find(d => d.status === 'mismatch')?.message
    },
    index: {
      valid: result.indexValid,
      error: indexDetails.find(d => d.status === 'mismatch')?.message
    },
    cst: {
      match: result.cstMatch,
      cppSize: result.cstResult?.cppSize,
      tsSize: result.cstResult?.tsSize,
      firstDiffOffset: result.cstResult?.firstDiffOffset,
      diffCount: result.cstResult?.diffCount,
      error: result.cstResult?.error || cstDetails.find(d => d.status === 'mismatch')?.message
    },
    glyph: {
      similarity: result.glyphSimilarity,
      status: result.glyphSimilarity >= 99 ? 'PASS' : result.glyphSimilarity >= 95 ? 'PARTIAL' : 'FAIL',
      error: glyphDetails.find(d => d.status === 'mismatch')?.message
    },
    details: result.details
  };
}


/**
 * Generates a complete JSON report from comparison results
 * 
 * Requirements: 4.9 - Detailed JSON report with all comparison results
 * 
 * @param results - Array of comparison results
 * @param options - Optional configuration
 * @returns Complete JSON report
 */
export function generateJsonReport(
  results: ComparisonResult[],
  options?: {
    glyphThresholds?: {
      passThreshold: number;
      partialThreshold: number;
      psnrPassThreshold: number;
      psnrPartialThreshold: number;
    };
    startTime?: Date;
    endTime?: Date;
  }
): JsonReport {
  const now = new Date();
  const summary = calculateSummary(results);
  
  const report: JsonReport = {
    metadata: {
      timestamp: now.toISOString(),
      version: '1.0.0',
      generator: 'TypeScript Compatibility Test Framework',
      frameworkVersion: '1.0.2'
    },
    summary,
    configuration: {
      glyphThresholds: options?.glyphThresholds || {
        passThreshold: 0.01,
        partialThreshold: 0.05,
        psnrPassThreshold: 40,
        psnrPartialThreshold: 30
      },
      testCases: results.map(r => r.testCase)
    },
    results: results.map(toDetailedResult)
  };
  
  // Add timing information if provided
  if (options?.startTime && options?.endTime) {
    report.timing = {
      startTime: options.startTime.toISOString(),
      endTime: options.endTime.toISOString(),
      durationMs: options.endTime.getTime() - options.startTime.getTime()
    };
  }
  
  return report;
}

/**
 * Saves JSON report to file
 * 
 * @param report - JSON report to save
 * @param outputPath - Output file path
 */
export function saveJsonReport(report: JsonReport, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
}

/**
 * Generates a timestamped report filename
 * 
 * @param prefix - Filename prefix
 * @param extension - File extension
 * @returns Timestamped filename
 */
export function generateReportFilename(prefix: string = 'report', extension: string = 'json'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Loads a JSON report from file
 * 
 * @param filePath - Path to JSON report file
 * @returns Parsed JSON report
 */
export function loadJsonReport(filePath: string): JsonReport {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as JsonReport;
}


// ============================================================================
// Console Output Functions
// Requirements: 4.10, 7.4, 7.5 - Console summary and progress display
// ============================================================================

/**
 * Applies color to text if colors are enabled
 * 
 * @param text - Text to colorize
 * @param color - Color code
 * @param config - Console configuration
 * @returns Colorized text
 */
function colorize(text: string, color: string, config: ConsoleOutputConfig): string {
  if (!config.colors) {
    return text;
  }
  return `${color}${text}${COLORS.reset}`;
}

/**
 * Gets the color for a status
 * 
 * @param status - Comparison status
 * @returns ANSI color code
 */
function getStatusColor(status: ComparisonStatus | 'match' | 'mismatch' | 'similar'): string {
  switch (status) {
    case 'PASS':
    case 'match':
      return COLORS.green;
    case 'PARTIAL':
    case 'similar':
      return COLORS.yellow;
    case 'FAIL':
    case 'mismatch':
      return COLORS.red;
    default:
      return COLORS.white;
  }
}

/**
 * Formats a single test result line for console output
 * 
 * Requirements: 7.5 - Display pass/fail summary
 * 
 * @param result - Comparison result
 * @param config - Console configuration
 * @returns Formatted line
 */
export function formatTestResultLine(
  result: ComparisonResult,
  config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG
): string {
  const statusIcon = STATUS_ICONS[result.status];
  const statusColor = getStatusColor(result.status);
  const statusStr = colorize(`[${result.status}]`, statusColor, config).padEnd(config.colors ? 18 : 8);
  
  const headerIcon = result.headerMatch ? STATUS_ICONS.match : STATUS_ICONS.mismatch;
  const headerColor = result.headerMatch ? COLORS.green : COLORS.red;
  
  const indexIcon = result.indexValid ? STATUS_ICONS.match : STATUS_ICONS.mismatch;
  const indexColor = result.indexValid ? COLORS.green : COLORS.red;
  
  const cstIcon = result.cstMatch ? STATUS_ICONS.match : STATUS_ICONS.mismatch;
  const cstColor = result.cstMatch ? COLORS.green : COLORS.red;
  
  const glyphStr = result.glyphSimilarity > 0 
    ? `${result.glyphSimilarity.toFixed(1)}%` 
    : 'N/A';
  const glyphColor = result.glyphSimilarity >= 99 
    ? COLORS.green 
    : result.glyphSimilarity >= 95 
      ? COLORS.yellow 
      : COLORS.red;
  
  const testCaseName = result.testCase.padEnd(16);
  
  return `${statusStr} ${testCaseName} ` +
         `Header: ${colorize(headerIcon, headerColor, config)}  ` +
         `Index: ${colorize(indexIcon, indexColor, config)}  ` +
         `CST: ${colorize(cstIcon, cstColor, config)}  ` +
         `Glyph: ${colorize(glyphStr, glyphColor, config)}`;
}

/**
 * Formats the report header for console output
 * 
 * @param config - Console configuration
 * @returns Formatted header
 */
export function formatReportHeader(config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG): string {
  const title = '=== TypeScript vs C++ Compatibility Test ===';
  return colorize(title, COLORS.cyan + COLORS.bright, config);
}

/**
 * Formats the summary section for console output
 * 
 * Requirements: 7.5 - Display pass/fail summary
 * 
 * @param summary - Report summary
 * @param config - Console configuration
 * @returns Formatted summary
 */
export function formatSummarySection(
  summary: ReportSummary,
  config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG
): string {
  const passStr = colorize(`${summary.passed} PASS`, COLORS.green, config);
  const partialStr = colorize(`${summary.partial} PARTIAL`, COLORS.yellow, config);
  const failStr = colorize(`${summary.failed} FAIL`, COLORS.red, config);
  
  return `Summary: ${passStr}, ${partialStr}, ${failStr}`;
}

/**
 * Formats a complete console report
 * 
 * Requirements: 4.10 - Human-readable summary report
 * 
 * @param report - JSON report
 * @param config - Console configuration
 * @returns Formatted console report
 */
export function formatConsoleReport(
  report: JsonReport,
  config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG
): string {
  const lines: string[] = [
    formatReportHeader(config),
    ''
  ];
  
  // Add each test result
  for (const result of report.results) {
    // Convert DetailedTestResult back to ComparisonResult format for formatting
    const compResult: ComparisonResult = {
      testCase: result.testCase,
      status: result.status,
      headerMatch: result.header.match,
      indexValid: result.index.valid,
      cstMatch: result.cst.match,
      glyphSimilarity: result.glyph.similarity,
      details: result.details
    };
    lines.push(formatTestResultLine(compResult, config));
  }
  
  lines.push('');
  lines.push(formatSummarySection(report.summary, config));
  lines.push(`Timestamp: ${report.metadata.timestamp}`);
  
  if (report.timing) {
    const durationSec = (report.timing.durationMs / 1000).toFixed(1);
    lines.push(`Duration: ${durationSec}s`);
  }
  
  return lines.join('\n');
}


/**
 * Formats a detailed console report with all comparison details
 * 
 * @param report - JSON report
 * @param config - Console configuration
 * @returns Formatted detailed report
 */
export function formatDetailedConsoleReport(
  report: JsonReport,
  config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG
): string {
  const lines: string[] = [
    colorize('=== Detailed Compatibility Test Report ===', COLORS.cyan + COLORS.bright, config),
    `Timestamp: ${report.metadata.timestamp}`,
    `Generator: ${report.metadata.generator}`,
    '',
    colorize('--- Summary ---', COLORS.bright, config),
    `Total: ${report.summary.total}`,
    `Passed: ${colorize(String(report.summary.passed), COLORS.green, config)}`,
    `Partial: ${colorize(String(report.summary.partial), COLORS.yellow, config)}`,
    `Failed: ${colorize(String(report.summary.failed), COLORS.red, config)}`,
    `Pass Rate: ${report.summary.passRate.toFixed(1)}%`,
    '',
    colorize('--- Results ---', COLORS.bright, config)
  ];
  
  for (const result of report.results) {
    const statusColor = getStatusColor(result.status);
    lines.push('');
    lines.push(colorize(`Test Case: ${result.testCase}`, COLORS.bright, config));
    lines.push(`  Status: ${colorize(result.status, statusColor, config)}`);
    lines.push(`  Header Match: ${result.header.match ? colorize('Yes', COLORS.green, config) : colorize('No', COLORS.red, config)}`);
    lines.push(`  Index Valid: ${result.index.valid ? colorize('Yes', COLORS.green, config) : colorize('No', COLORS.red, config)}`);
    lines.push(`  CST Match: ${result.cst.match ? colorize('Yes', COLORS.green, config) : colorize('No', COLORS.red, config)}`);
    lines.push(`  Glyph Similarity: ${result.glyph.similarity.toFixed(2)}%`);
    
    // Show errors if any
    if (result.header.error) {
      lines.push(`  Header Error: ${colorize(result.header.error, COLORS.red, config)}`);
    }
    if (result.index.error) {
      lines.push(`  Index Error: ${colorize(result.index.error, COLORS.red, config)}`);
    }
    if (result.cst.error) {
      lines.push(`  CST Error: ${colorize(result.cst.error, COLORS.red, config)}`);
    }
    if (result.glyph.error) {
      lines.push(`  Glyph Error: ${colorize(result.glyph.error, COLORS.red, config)}`);
    }
    
    // Show header differences if any
    if (result.header.differences && result.header.differences.length > 0) {
      lines.push('  Header Differences:');
      for (const diff of result.header.differences.slice(0, 5)) {
        const offsetStr = diff.offset !== undefined ? ` (offset 0x${diff.offset.toString(16)})` : '';
        lines.push(`    - ${diff.field}${offsetStr}: expected=${JSON.stringify(diff.expected)}, actual=${JSON.stringify(diff.actual)}`);
      }
      if (result.header.differences.length > 5) {
        lines.push(`    ... and ${result.header.differences.length - 5} more`);
      }
    }
    
    // Show details
    if (result.details.length > 0) {
      lines.push('  Details:');
      for (const detail of result.details) {
        const icon = STATUS_ICONS[detail.status] || '?';
        const detailColor = getStatusColor(detail.status as any);
        lines.push(`    ${colorize(`[${icon}]`, detailColor, config)} ${detail.section}: ${detail.message}`);
      }
    }
  }
  
  return lines.join('\n');
}

// ============================================================================
// Progress Display Functions
// Requirements: 7.4 - Real-time progress display
// ============================================================================

/**
 * Progress callback type
 */
export type ProgressCallback = (current: number, total: number, testCase: string, status?: string) => void;

/**
 * Creates a progress callback that outputs to console
 * 
 * Requirements: 7.4 - Real-time progress display
 * 
 * @param config - Console configuration
 * @returns Progress callback function
 */
export function createConsoleProgressCallback(
  config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG
): ProgressCallback {
  return (current: number, total: number, testCase: string, status?: string) => {
    const percentage = Math.round((current / total) * 100);
    const progressBar = createProgressBar(percentage, 20);
    const statusStr = status ? ` [${status}]` : '';
    
    // Use carriage return to overwrite the line
    const line = `\r${progressBar} ${percentage}% (${current}/${total}) ${testCase}${statusStr}`;
    
    if (config.showProgress) {
      process.stdout.write(line.padEnd(config.maxWidth));
      
      // Print newline when complete
      if (current === total) {
        console.log('');
      }
    }
  };
}

/**
 * Creates a simple progress callback that prints each step
 * 
 * @param prefix - Prefix for each line
 * @returns Progress callback function
 */
export function createSimpleProgressCallback(prefix: string = ''): ProgressCallback {
  return (current: number, total: number, testCase: string, status?: string) => {
    const statusStr = status ? ` - ${status}` : '';
    console.log(`${prefix}[${current}/${total}] ${testCase}${statusStr}`);
  };
}

/**
 * Creates a text-based progress bar
 * 
 * @param percentage - Progress percentage (0-100)
 * @param width - Bar width in characters
 * @returns Progress bar string
 */
export function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}


// ============================================================================
// Report Manager Class
// ============================================================================

/**
 * Report Manager for managing test execution and report generation
 * 
 * This class provides a unified interface for:
 * - Tracking test execution progress
 * - Generating JSON and console reports
 * - Saving reports to files
 */
export class ReportManager {
  private results: ComparisonResult[] = [];
  private startTime: Date | null = null;
  private endTime: Date | null = null;
  private config: ConsoleOutputConfig;
  private glyphThresholds: {
    passThreshold: number;
    partialThreshold: number;
    psnrPassThreshold: number;
    psnrPartialThreshold: number;
  };
  
  constructor(options?: {
    consoleConfig?: Partial<ConsoleOutputConfig>;
    glyphThresholds?: {
      passThreshold: number;
      partialThreshold: number;
      psnrPassThreshold: number;
      psnrPartialThreshold: number;
    };
  }) {
    this.config = { ...DEFAULT_CONSOLE_CONFIG, ...options?.consoleConfig };
    this.glyphThresholds = options?.glyphThresholds || {
      passThreshold: 0.01,
      partialThreshold: 0.05,
      psnrPassThreshold: 40,
      psnrPartialThreshold: 30
    };
  }
  
  /**
   * Starts the test execution timer
   */
  start(): void {
    this.startTime = new Date();
    this.results = [];
  }
  
  /**
   * Stops the test execution timer
   */
  stop(): void {
    this.endTime = new Date();
  }
  
  /**
   * Adds a test result
   * 
   * @param result - Comparison result to add
   */
  addResult(result: ComparisonResult): void {
    this.results.push(result);
  }
  
  /**
   * Sets all results at once
   * 
   * @param results - Array of comparison results
   */
  setResults(results: ComparisonResult[]): void {
    this.results = results;
  }
  
  /**
   * Gets the current results
   * 
   * @returns Array of comparison results
   */
  getResults(): ComparisonResult[] {
    return this.results;
  }
  
  /**
   * Generates a JSON report
   * 
   * @returns JSON report
   */
  generateJsonReport(): JsonReport {
    return generateJsonReport(this.results, {
      glyphThresholds: this.glyphThresholds,
      startTime: this.startTime || undefined,
      endTime: this.endTime || undefined
    });
  }
  
  /**
   * Saves the JSON report to a file
   * 
   * @param outputDir - Output directory
   * @param filename - Optional filename (auto-generated if not provided)
   * @returns Path to saved file
   */
  saveJsonReport(outputDir: string, filename?: string): string {
    const report = this.generateJsonReport();
    const fname = filename || generateReportFilename('report', 'json');
    const outputPath = path.join(outputDir, fname);
    saveJsonReport(report, outputPath);
    return outputPath;
  }
  
  /**
   * Prints the console summary
   */
  printSummary(): void {
    const report = this.generateJsonReport();
    console.log(formatConsoleReport(report, this.config));
  }
  
  /**
   * Prints the detailed console report
   */
  printDetailedReport(): void {
    const report = this.generateJsonReport();
    console.log(formatDetailedConsoleReport(report, this.config));
  }
  
  /**
   * Creates a progress callback for this manager
   * 
   * @returns Progress callback
   */
  createProgressCallback(): ProgressCallback {
    return createConsoleProgressCallback(this.config);
  }
  
  /**
   * Gets the summary statistics
   * 
   * @returns Report summary
   */
  getSummary(): ReportSummary {
    return calculateSummary(this.results);
  }
  
  /**
   * Gets the execution duration in milliseconds
   * 
   * @returns Duration in ms, or null if not started/stopped
   */
  getDuration(): number | null {
    if (!this.startTime || !this.endTime) {
      return null;
    }
    return this.endTime.getTime() - this.startTime.getTime();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Prints a separator line to console
 * 
 * @param char - Character to use for separator
 * @param width - Width of separator
 */
export function printSeparator(char: string = '═', width: number = 60): void {
  console.log(char.repeat(width));
}

/**
 * Prints a section header to console
 * 
 * @param title - Section title
 * @param config - Console configuration
 */
export function printSectionHeader(
  title: string,
  config: ConsoleOutputConfig = DEFAULT_CONSOLE_CONFIG
): void {
  printSeparator();
  console.log(colorize(title, COLORS.cyan + COLORS.bright, config));
  printSeparator();
}

/**
 * Formats duration in human-readable format
 * 
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Exports all public types and functions
 */
export {
  COLORS,
  STATUS_ICONS,
  colorize,
  getStatusColor
};
