#!/usr/bin/env ts-node
/**
 * Complete Test Flow Script
 * 
 * This script runs the complete compatibility test flow:
 * 1. Generate C++ reference outputs
 * 2. Generate TypeScript test outputs
 * 3. Compare outputs and generate report
 * 
 * Usage:
 *   npx ts-node run-all.ts              # Run complete test flow
 *   npx ts-node run-all.ts --quick      # Quick test (bitmap_r4, vector_basic only)
 *   npx ts-node run-all.ts --case X     # Run specific test case
 *   npx ts-node run-all.ts --skip-cpp   # Skip C++ generation (use existing)
 *   npx ts-node run-all.ts --skip-ts    # Skip TypeScript generation (use existing)
 * 
 * Requirements: 7.1-7.5 - Complete test execution flow
 */

import * as path from 'path';
import {
  getCppToolInfo,
  generateAllCppReferences,
  generateCppReferencesForCases,
  formatCppGenerationSummary,
  CppGenerationResult
} from './framework/cpp-generator';
import {
  getTsToolInfo,
  generateAllTsOutputs,
  generateTsOutputsForCases,
  formatTsGenerationSummary,
  TsGenerationResult
} from './framework/ts-generator';
import {
  runAllTests,
  runTestCases,
  ComparisonResult
} from './framework/test-runner';
import {
  generateJsonReport,
  saveJsonReport,
  formatConsoleReport,
  formatDetailedConsoleReport,
  generateReportFilename,
  printSeparator,
  formatDuration
} from './framework/report-generator';

/**
 * Quick test cases (for fast validation)
 */
const QUICK_TEST_CASES = ['bmp_addr_r4', 'bmp_crop_r4', 'vec_addr'];

/**
 * Parse command line arguments
 */
function parseArgs(): {
  testCases: string[];
  quick: boolean;
  skipCpp: boolean;
  skipTs: boolean;
  verbose: boolean;
  json: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const testCases: string[] = [];
  let quick = false;
  let skipCpp = false;
  let skipTs = false;
  let verbose = false;
  let json = false;
  let help = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--quick' || arg === '-q') {
      quick = true;
    } else if (arg === '--skip-cpp') {
      skipCpp = true;
    } else if (arg === '--skip-ts') {
      skipTs = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--json' || arg === '-j') {
      json = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--case' || arg === '-c') {
      const nextArg = args[++i];
      if (nextArg) {
        testCases.push(nextArg);
      }
    } else if (!arg.startsWith('-')) {
      testCases.push(arg);
    }
  }
  
  return { testCases, quick, skipCpp, skipTs, verbose, json, help };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Complete Compatibility Test Flow

Usage:
  npx ts-node run-all.ts [options] [test-cases...]

Options:
  -q, --quick        Quick test (bitmap_r4, vector_basic only)
  --skip-cpp         Skip C++ reference generation (use existing)
  --skip-ts          Skip TypeScript output generation (use existing)
  -c, --case <name>  Run specific test case (can be repeated)
  -v, --verbose      Show detailed output
  -j, --json         Save JSON report
  -h, --help         Show this help message

Examples:
  npx ts-node run-all.ts                    # Run complete test flow
  npx ts-node run-all.ts --quick            # Quick test
  npx ts-node run-all.ts --case bitmap_r4   # Run specific test case
  npx ts-node run-all.ts --skip-cpp         # Skip C++ generation
  npx ts-node run-all.ts --verbose --json   # Verbose with JSON report

Test Flow:
  1. Generate C++ reference outputs (unless --skip-cpp)
  2. Generate TypeScript test outputs (unless --skip-ts)
  3. Compare outputs and generate report
`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const startTime = Date.now();
  const { testCases, quick, skipCpp, skipTs, verbose, json, help } = parseArgs();
  
  if (help) {
    printHelp();
    process.exit(0);
  }
  
  const baseDir = __dirname;
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     TypeScript vs C++ Compatibility Test Framework         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Determine test cases to run
  let casesToRun: string[] = testCases;
  
  if (quick && casesToRun.length === 0) {
    casesToRun = QUICK_TEST_CASES;
    console.log(`Quick mode: Running ${casesToRun.join(', ')}\n`);
  }
  
  // Check tool availability
  const cppToolInfo = getCppToolInfo(path.resolve(baseDir, 'framework'));
  const tsToolInfo = getTsToolInfo(path.resolve(baseDir, 'framework'));
  
  console.log('Tool Status:');
  console.log(`  C++ fontDictionary.exe: ${cppToolInfo.exists ? '✓ Found' : '✗ Not found'}`);
  console.log(`  TypeScript CLI: ${tsToolInfo.exists ? '✓ Found' : '✗ Not found'}`);
  console.log(`  Node.js: ${tsToolInfo.nodeVersion}`);
  console.log('');
  
  if (!skipCpp && !cppToolInfo.exists) {
    console.error('Error: C++ fontDictionary.exe not found!');
    console.error('Use --skip-cpp to skip C++ generation if references already exist.');
    process.exit(1);
  }
  
  if (!skipTs && !tsToolInfo.exists) {
    console.error('Error: TypeScript CLI not found!');
    console.error('Run "npm run build" in font-tool-typescript directory first.');
    process.exit(1);
  }
  
  // Step 1: Generate C++ references
  let cppResults: CppGenerationResult[] = [];
  
  if (!skipCpp) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Step 1: Generating C++ Reference Outputs');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const cppOptions = {
      baseDir: path.resolve(baseDir, 'framework'),
      configsDir: path.resolve(baseDir, 'configs'),
      outputBaseDir: path.resolve(baseDir, 'cpp_reference'),
      verbose,
      onProgress: (current: number, total: number, testCase: string) => {
        console.log(`[${current}/${total}] Generating C++ reference: ${testCase}...`);
      }
    };
    
    if (casesToRun.length > 0) {
      cppResults = generateCppReferencesForCases(casesToRun, cppOptions);
    } else {
      cppResults = generateAllCppReferences(cppOptions);
    }
    
    console.log('\n' + formatCppGenerationSummary(cppResults));
    
    const cppFailed = cppResults.filter(r => !r.success).length;
    if (cppFailed > 0) {
      console.warn(`\nWarning: ${cppFailed} C++ generation(s) failed`);
    }
  } else {
    console.log('Step 1: Skipping C++ reference generation (--skip-cpp)\n');
  }
  
  // Step 2: Generate TypeScript outputs
  let tsResults: TsGenerationResult[] = [];
  
  if (!skipTs) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Step 2: Generating TypeScript Test Outputs');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const tsOptions = {
      baseDir: path.resolve(baseDir, 'framework'),
      configsDir: path.resolve(baseDir, 'configs'),
      outputBaseDir: path.resolve(baseDir, 'ts_output'),
      verbose,
      onProgress: (current: number, total: number, testCase: string) => {
        console.log(`[${current}/${total}] Generating TypeScript output: ${testCase}...`);
      }
    };
    
    if (casesToRun.length > 0) {
      tsResults = generateTsOutputsForCases(casesToRun, tsOptions);
    } else {
      tsResults = generateAllTsOutputs(tsOptions);
    }
    
    console.log('\n' + formatTsGenerationSummary(tsResults));
    
    const tsFailed = tsResults.filter(r => !r.success).length;
    if (tsFailed > 0) {
      console.warn(`\nWarning: ${tsFailed} TypeScript generation(s) failed`);
    }
  } else {
    console.log('Step 2: Skipping TypeScript output generation (--skip-ts)\n');
  }
  
  // Step 3: Compare outputs
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Step 3: Comparing Outputs');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const compareOptions = {
    baseDir: path.resolve(baseDir, 'framework'),
    cppReferenceDir: path.resolve(baseDir, 'cpp_reference'),
    tsOutputDir: path.resolve(baseDir, 'ts_output'),
    verbose,
    onProgress: (current: number, total: number, testCase: string) => {
      console.log(`[${current}/${total}] Comparing: ${testCase}...`);
    }
  };
  
  let compareResults: ComparisonResult[];
  
  if (casesToRun.length > 0) {
    compareResults = runTestCases(casesToRun, compareOptions);
  } else {
    compareResults = runAllTests(compareOptions);
  }
  
  // Generate report using new report generator
  const endTime = new Date();
  const report = generateJsonReport(compareResults, {
    startTime: new Date(startTime),
    endTime: endTime
  });
  
  // Output results
  console.log('\n' + formatConsoleReport(report, { colors: true, detailed: false, showProgress: true, maxWidth: 80 }));
  
  if (verbose) {
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
  
  // Final summary
  const totalTime = Date.now() - startTime;
  printSeparator();
  console.log('Test Complete');
  printSeparator();
  console.log(`Total time: ${formatDuration(totalTime)}`);
  console.log(`Result: ${report.summary.passed} PASS, ${report.summary.partial} PARTIAL, ${report.summary.failed} FAIL`);
  
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

