/**
 * Compatibility Test Framework
 * 
 * This module exports all components of the compatibility testing framework
 * for comparing TypeScript and C++ font converter outputs.
 */

export * from './header-parser';
export * from './index-validator';
export * from './comparator';
export * from './glyph-analyzer';
export * from './cpp-generator';
export * from './ts-generator';

// Export test-runner but exclude deprecated report functions that conflict with report-generator
export {
  TestCase,
  TestRunnerOptions,
  RUNNER_DEFAULT_PATHS,
  findMatchingFiles,
  runTestCase,
  runAllTests,
  runTestCases,
  TestReport,
  generateReport,
  saveReportJson,
  // Keep these for backward compatibility but report-generator has better versions
  formatReportSummary,
  formatDetailedReport
} from './test-runner';

// Export all from report-generator (preferred report functions)
// Note: formatTestResultLine from report-generator takes a config parameter
export * from './report-generator';
