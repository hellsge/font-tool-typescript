#!/usr/bin/env ts-node
/**
 * C++ Reference Generation Script
 * 
 * This script generates reference outputs using the C++ fontDictionary.exe tool.
 * The generated outputs serve as the baseline for comparing TypeScript implementation.
 * 
 * Usage:
 *   npx ts-node run-cpp.ts              # Generate all references
 *   npx ts-node run-cpp.ts bitmap_r4    # Generate specific test case
 *   npx ts-node run-cpp.ts --verbose    # Verbose output
 * 
 * Requirements: 2.1-2.4 - Reference output generation
 */

import * as path from 'path';
import {
  getCppToolInfo,
  loadAllTestConfigs,
  generateCppReference,
  generateAllCppReferences,
  generateCppReferencesForCases,
  formatCppGenerationSummary,
  CppGenerationResult,
  DEFAULT_PATHS
} from './framework/cpp-generator';

/**
 * Parse command line arguments
 */
function parseArgs(): {
  testCases: string[];
  verbose: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const testCases: string[] = [];
  let verbose = false;
  let help = false;
  
  for (const arg of args) {
    if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (!arg.startsWith('-')) {
      testCases.push(arg);
    }
  }
  
  return { testCases, verbose, help };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
C++ Reference Generation Script

Usage:
  npx ts-node run-cpp.ts [options] [test-cases...]

Options:
  -v, --verbose    Show detailed output
  -h, --help       Show this help message

Examples:
  npx ts-node run-cpp.ts                    # Generate all references
  npx ts-node run-cpp.ts bitmap_r4          # Generate specific test case
  npx ts-node run-cpp.ts bitmap_r4 vector_basic  # Generate multiple test cases
  npx ts-node run-cpp.ts --verbose          # Verbose output

Available test cases:
`);
  
  const baseDir = __dirname;
  const configsDir = path.resolve(baseDir, 'configs');
  const configs = loadAllTestConfigs(configsDir);
  
  for (const config of configs) {
    console.log(`  - ${config.name}: ${config.description}`);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const { testCases, verbose, help } = parseArgs();
  
  if (help) {
    printHelp();
    process.exit(0);
  }
  
  const baseDir = __dirname;
  
  // Check C++ tool availability
  const toolInfo = getCppToolInfo(path.resolve(baseDir, 'framework'));
  
  console.log('=== C++ Reference Generator ===\n');
  console.log(`C++ Tool: ${toolInfo.exePath}`);
  console.log(`Tool exists: ${toolInfo.exists ? 'Yes' : 'No'}`);
  console.log(`Working dir: ${toolInfo.workingDir}\n`);
  
  if (!toolInfo.exists) {
    console.error('Error: C++ fontDictionary.exe not found!');
    console.error('Please ensure font-tool-release directory contains fontDictionary.exe');
    process.exit(1);
  }
  
  // Generate references
  let results: CppGenerationResult[];
  
  const options = {
    baseDir: path.resolve(baseDir, 'framework'),
    configsDir: path.resolve(baseDir, 'configs'),
    outputBaseDir: path.resolve(baseDir, 'cpp_reference'),
    verbose,
    onProgress: (current: number, total: number, testCase: string) => {
      console.log(`[${current}/${total}] Generating: ${testCase}...`);
    }
  };
  
  if (testCases.length > 0) {
    console.log(`Generating references for: ${testCases.join(', ')}\n`);
    results = generateCppReferencesForCases(testCases, options);
  } else {
    console.log('Generating all references...\n');
    results = generateAllCppReferences(options);
  }
  
  // Print summary
  console.log('\n' + formatCppGenerationSummary(results));
  
  // Exit with error code if any failed
  const failedCount = results.filter(r => !r.success).length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

