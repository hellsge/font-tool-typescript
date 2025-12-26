#!/usr/bin/env ts-node
/**
 * Tool Verification Script
 * 
 * Verifies that all compatibility testing tools are available and can be imported.
 * 
 * Usage:
 *   npx ts-node tests/compatibility/verify-tools.ts
 */

import * as path from 'path';

// ANSI colors
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function print(message: string, color: string = COLORS.reset): void {
  console.log(`${color}${message}${COLORS.reset}`);
}

async function verifyTool(name: string, importFn: () => Promise<any>): Promise<boolean> {
  try {
    await importFn();
    print(`  ✓ ${name}`, COLORS.green);
    return true;
  } catch (error) {
    print(`  ✗ ${name}: ${error instanceof Error ? error.message : String(error)}`, COLORS.red);
    return false;
  }
}

async function main() {
  print('═'.repeat(60), COLORS.cyan);
  print('Compatibility Testing Tools Verification', COLORS.cyan + COLORS.bright);
  print('═'.repeat(60), COLORS.cyan);
  console.log('');
  
  const results: boolean[] = [];
  
  // Verify framework tools
  print('Framework Tools:', COLORS.cyan);
  results.push(await verifyTool('header-parser', () => import('./framework/header-parser')));
  results.push(await verifyTool('comparator', () => import('./framework/comparator')));
  results.push(await verifyTool('index-validator', () => import('./framework/index-validator')));
  results.push(await verifyTool('glyph-analyzer', () => import('./framework/glyph-analyzer')));
  results.push(await verifyTool('test-runner', () => import('./framework/test-runner')));
  results.push(await verifyTool('report-generator', () => import('./framework/report-generator')));
  results.push(await verifyTool('report-analyzer', () => import('./framework/report-analyzer')));
  console.log('');
  
  // Verify diagnostic tools
  print('Diagnostic Tools:', COLORS.cyan);
  results.push(await verifyTool('diagnose', () => import('./diagnose')));
  console.log('');
  
  // Verify framework index exports
  print('Framework Index Exports:', COLORS.cyan);
  try {
    const framework = await import('./framework');
    const exports = Object.keys(framework);
    
    const requiredExports = [
      'parseHeader',
      'compareHeaders',
      'compareCst',
      'validateIndex',
      'analyzeGlyphSimilarity',
      'runTestCase',
      'runAllTests',
      'generateJsonReport',
      'formatConsoleReport',
      'TestReportAnalyzer',
      'createReportAnalyzer'
    ];
    
    let allExportsFound = true;
    for (const exportName of requiredExports) {
      if (exports.includes(exportName)) {
        print(`  ✓ ${exportName}`, COLORS.green);
      } else {
        print(`  ✗ ${exportName} (not found)`, COLORS.red);
        allExportsFound = false;
      }
    }
    
    results.push(allExportsFound);
  } catch (error) {
    print(`  ✗ Framework index: ${error instanceof Error ? error.message : String(error)}`, COLORS.red);
    results.push(false);
  }
  console.log('');
  
  // Summary
  print('═'.repeat(60), COLORS.cyan);
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    print(`✓ All tools verified successfully (${passed}/${total})`, COLORS.green + COLORS.bright);
    print('═'.repeat(60), COLORS.cyan);
    process.exit(0);
  } else {
    print(`✗ Some tools failed verification (${passed}/${total})`, COLORS.red + COLORS.bright);
    print('═'.repeat(60), COLORS.cyan);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}
