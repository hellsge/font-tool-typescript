#!/usr/bin/env ts-node
/**
 * TypeScript Output Generation Script
 * 
 * This script generates test outputs using the TypeScript font-converter.
 * The generated outputs are compared against C++ reference outputs.
 * 
 * Usage:
 *   npx ts-node run-ts.ts              # Generate all outputs
 *   npx ts-node run-ts.ts bitmap_r4    # Generate specific test case
 *   npx ts-node run-ts.ts --verbose    # Verbose output
 * 
 * Requirements: 3.1-3.4 - TypeScript output generation
 */

import * as path from 'path';
import {
  getTsToolInfo,
  loadAllTsTestConfigs,
  generateTsOutput,
  generateAllTsOutputs,
  generateTsOutputsForCases,
  formatTsGenerationSummary,
  TsGenerationResult,
  TS_DEFAULT_PATHS
} from './framework/ts-generator';

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
TypeScript Output Generation Script

Usage:
  npx ts-node run-ts.ts [options] [test-cases...]

Options:
  -v, --verbose    Show detailed output
  -h, --help       Show this help message

Examples:
  npx ts-node run-ts.ts                    # Generate all outputs
  npx ts-node run-ts.ts bitmap_r4          # Generate specific test case
  npx ts-node run-ts.ts bitmap_r4 vector_basic  # Generate multiple test cases
  npx ts-node run-ts.ts --verbose          # Verbose output

Available test cases:
`);
  
  const baseDir = __dirname;
  const configsDir = path.resolve(baseDir, 'configs');
  const configs = loadAllTsTestConfigs(configsDir);
  
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
  
  // Check TypeScript tool availability
  const toolInfo = getTsToolInfo(path.resolve(baseDir, 'framework'));
  
  console.log('=== TypeScript Output Generator ===\n');
  console.log(`TypeScript CLI: ${toolInfo.cliPath}`);
  console.log(`CLI exists: ${toolInfo.exists ? 'Yes' : 'No'}`);
  console.log(`Node.js version: ${toolInfo.nodeVersion}`);
  console.log(`TS Root: ${toolInfo.tsRoot}\n`);
  
  if (!toolInfo.exists) {
    console.error('Error: TypeScript font-converter CLI not found!');
    console.error('Please run "npm run build" in font-tool-typescript directory first.');
    process.exit(1);
  }
  
  // Generate outputs
  let results: TsGenerationResult[];
  
  const options = {
    baseDir: path.resolve(baseDir, 'framework'),
    configsDir: path.resolve(baseDir, 'configs'),
    outputBaseDir: path.resolve(baseDir, 'ts_output'),
    verbose,
    onProgress: (current: number, total: number, testCase: string) => {
      console.log(`[${current}/${total}] Generating: ${testCase}...`);
    }
  };
  
  if (testCases.length > 0) {
    console.log(`Generating outputs for: ${testCases.join(', ')}\n`);
    results = generateTsOutputsForCases(testCases, options);
  } else {
    console.log('Generating all outputs...\n');
    results = generateAllTsOutputs(options);
  }
  
  // Print summary
  console.log('\n' + formatTsGenerationSummary(results));
  
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

