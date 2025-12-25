#!/usr/bin/env ts-node
/**
 * Comparison Execution Script
 * 
 * This script compares C++ reference outputs with TypeScript test outputs
 * and generates compatibility reports.
 * 
 * Usage:
 *   npx ts-node compare.ts              # Compare all test cases
 *   npx ts-node compare.ts bitmap_r4    # Compare specific test case
 *   npx ts-node compare.ts --verbose    # Verbose output
 *   npx ts-node compare.ts --json       # Output JSON report
 * 
 * Requirements: 7.1-7.5 - Test execution and reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  runAllTests,
  runTestCases,
  ComparisonResult
} from './framework/test-runner';
// import { DEFAULT_GLYPH_CONFIG, GlyphComparisonConfig } from './framework/glyph-analyzer';
import {
  generateJsonReport,
  saveJsonReport,
  formatConsoleReport,
  formatDetailedConsoleReport,
  generateReportFilename
} from './framework/report-generator';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  testCases: string[];
  verbose: boolean;
  json: boolean;
  detailed: boolean;
  help: boolean;
  threshold?: number;
} {
  const args = process.argv.slice(2);
  const testCases: string[] = [];
  let verbose = false;
  let json = false;
  let detailed = false;
  let help = false;
  let threshold: number | undefined;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--json' || arg === '-j') {
      json = true;
    } else if (arg === '--detailed' || arg === '-d') {
      detailed = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--threshold' || arg === '-t') {
      const nextArg = args[++i];
      if (nextArg) {
        threshold = parseFloat(nextArg);
      }
    } else if (!arg.startsWith('-')) {
      testCases.push(arg);
    }
  }
  
  return { testCases, verbose, json, detailed, help, threshold };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Comparison Execution Script

Usage:
  npx ts-node compare.ts [options] [test-cases...]

Options:
  -v, --verbose        Show detailed output during comparison
  -j, --json           Output JSON report to reports directory
  -d, --detailed       Show detailed report in console
  -t, --threshold <n>  Set glyph similarity threshold (default: 5%)
  -h, --help           Show this help message

Examples:
  npx ts-node compare.ts                    # Compare all test cases
  npx ts-node compare.ts bitmap_r4          # Compare specific test case
  npx ts-node compare.ts --verbose          # Verbose output
  npx ts-node compare.ts --json             # Save JSON report
  npx ts-node compare.ts --threshold 10     # Set 10% threshold

Test cases are determined by directories in cpp_reference/.
`);
}

/**
 * Get available test cases
 */
function getAvailableTestCases(baseDir: string): string[] {
  const cppRefDir = path.resolve(baseDir, 'cpp_reference');
  
  if (!fs.existsSync(cppRefDir)) {
    return [];
  }
  
  return fs.readdirSync(cppRefDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const { testCases, verbose, json, detailed, help, threshold } = parseArgs();
  
  if (help) {
    printHelp();
    process.exit(0);
  }
  
  const baseDir = __dirname;
  
  console.log('=== Compatibility Comparison ===\n');
  
  // Check directories exist
  const cppRefDir = path.resolve(baseDir, 'cpp_reference');
  const tsOutDir = path.resolve(baseDir, 'ts_output');
  
  console.log(`C++ Reference: ${cppRefDir}`);
  console.log(`TS Output: ${tsOutDir}`);
  
  if (!fs.existsSync(cppRefDir)) {
    console.error('\nError: C++ reference directory not found!');
    console.error('Run "npx ts-node run-cpp.ts" first to generate C++ references.');
    process.exit(1);
  }
  
  if (!fs.existsSync(tsOutDir)) {
    console.error('\nError: TypeScript output directory not found!');
    console.error('Run "npx ts-node run-ts.ts" first to generate TypeScript outputs.');
    process.exit(1);
  }
  
  // Configure glyph comparison
  const glyphConfig: any = {
    // ...DEFAULT_GLYPH_CONFIG,
    partialThreshold: threshold !== undefined ? threshold / 100 : 0.05
  };
  
  // Get test cases to run
  const availableTestCases = getAvailableTestCases(baseDir);
  
  if (availableTestCases.length === 0) {
    console.error('\nError: No test cases found in C++ reference directory!');
    process.exit(1);
  }
  
  const casesToRun = testCases.length > 0 
    ? testCases.filter(tc => availableTestCases.includes(tc))
    : availableTestCases;
  
  if (casesToRun.length === 0) {
    console.error(`\nError: No matching test cases found for: ${testCases.join(', ')}`);
    console.error(`Available test cases: ${availableTestCases.join(', ')}`);
    process.exit(1);
  }
  
  console.log(`\nRunning ${casesToRun.length} test case(s)...\n`);
  
  // Run comparisons
  const options = {
    baseDir: path.resolve(baseDir, 'framework'),
    cppReferenceDir: cppRefDir,
    tsOutputDir: tsOutDir,
    glyphConfig,
    verbose,
    onProgress: (current: number, total: number, testCase: string) => {
      console.log(`[${current}/${total}] Comparing: ${testCase}...`);
    }
  };
  
  let results: ComparisonResult[];
  
  if (testCases.length > 0) {
    results = runTestCases(casesToRun, options);
  } else {
    results = runAllTests(options);
  }
  
  // Generate report using new report generator
  const report = generateJsonReport(results, {
    glyphThresholds: {
      passThreshold: glyphConfig.passThreshold,
      partialThreshold: glyphConfig.partialThreshold,
      psnrPassThreshold: glyphConfig.psnrPassThreshold,
      psnrPartialThreshold: glyphConfig.psnrPartialThreshold
    }
  });
  
  // Output results
  console.log('\n' + formatConsoleReport(report, { colors: true, detailed: false, showProgress: true, maxWidth: 80 }));
  
  if (detailed) {
    console.log('\n' + formatDetailedConsoleReport(report, { colors: true, detailed: true, showProgress: true, maxWidth: 80 }));
  }
  
  // Save JSON report if requested
  if (json) {
    const reportsDir = path.resolve(baseDir, 'reports');
    const reportFilename = generateReportFilename('report', 'json');
    const reportPath = path.join(reportsDir, reportFilename);
    
    saveJsonReport(report, reportPath);
    console.log(`\nJSON report saved to: ${reportPath}`);
  }
  
  // Exit with error code if any failed
  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

