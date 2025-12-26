/**
 * Test Report Analyzer
 * 
 * This module provides utilities for analyzing test reports and extracting
 * actionable insights for fixing compatibility issues.
 * 
 * Requirements: 6.2, 7.6 - Test report analysis and issue prioritization
 */

import * as fs from 'fs';
import * as path from 'path';
import { ComparisonResult, ComparisonStatus } from './comparator';
import { JsonReport, ReportSummary } from './report-generator';

/**
 * Failed test case information
 */
export interface FailedTest {
  /** Test case name */
  testCase: string;
  /** Overall status */
  status: ComparisonStatus;
  /** Failure reasons */
  failures: {
    header?: string;
    index?: string;
    cst?: string;
    glyph?: string;
  };
  /** Comparison details */
  details: Array<{
    section: string;
    status: string;
    message: string;
    offset?: number;
    expected?: string;
    actual?: string;
  }>;
}

/**
 * Prioritized issue
 */
export interface PrioritizedIssue {
  /** Priority level */
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  /** Issue category */
  category: 'CST' | 'Header' | 'Index' | 'Glyph' | 'Config';
  /** Issue description */
  description: string;
  /** Affected test cases */
  affectedTests: string[];
  /** Estimated effort */
  estimatedEffort: 'Low' | 'Medium' | 'High';
  /** Root cause (if identified) */
  rootCause?: string;
  /** Recommended fix */
  recommendedFix?: string;
}

/**
 * Test Report Analyzer
 * 
 * Analyzes test reports to extract key information and prioritize issues
 */
export class TestReportAnalyzer {
  /**
   * Loads a test report from JSON file
   * 
   * @param reportPath - Path to JSON report file
   * @returns Parsed JSON report
   */
  loadReport(reportPath: string): JsonReport {
    const content = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(content) as JsonReport;
  }
  
  /**
   * Finds the most recent report in a directory
   * 
   * @param reportsDir - Reports directory path
   * @returns Path to most recent report, or null if none found
   */
  findLatestReport(reportsDir: string): string | null {
    if (!fs.existsSync(reportsDir)) {
      return null;
    }
    
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.startsWith('report_') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(reportsDir, f),
        mtime: fs.statSync(path.join(reportsDir, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    
    return files.length > 0 ? files[0].path : null;
  }
  
  /**
   * Extracts failed test cases from report
   * 
   * @param report - JSON report
   * @returns Array of failed tests
   */
  getFailedTests(report: JsonReport): FailedTest[] {
    return report.results
      .filter(r => r.status === 'FAIL' || r.status === 'PARTIAL')
      .map(r => ({
        testCase: r.testCase,
        status: r.status,
        failures: {
          header: !r.header.match ? r.header.error : undefined,
          index: !r.index.valid ? r.index.error : undefined,
          cst: !r.cst.match ? r.cst.error : undefined,
          glyph: r.glyph.similarity < 95 ? r.glyph.error : undefined
        },
        details: r.details
      }));
  }
  
  /**
   * Prioritizes issues based on impact and frequency
   * 
   * @param failures - Array of failed tests
   * @returns Array of prioritized issues
   */
  prioritizeIssues(failures: FailedTest[]): PrioritizedIssue[] {
    const issues: PrioritizedIssue[] = [];
    
    // P0: CST failures (affects all tests)
    const cstFailures = failures.filter(f => f.failures.cst);
    if (cstFailures.length > 0) {
      issues.push({
        priority: 'P0',
        category: 'CST',
        description: 'CST 文件大小或内容不匹配',
        affectedTests: cstFailures.map(f => f.testCase),
        estimatedEffort: 'Medium',
        rootCause: 'TypeScript 可能只写入成功渲染的字符，而 C++ 写入所有请求的字符',
        recommendedFix: '修改 writeCharacterSetFile() 以包含所有请求的字符'
      });
    }
    
    // P1: Header failures (affects multiple tests)
    const headerFailures = failures.filter(f => f.failures.header);
    if (headerFailures.length > 0) {
      // Group by failure type
      const offsetModeFailures = headerFailures.filter(f => 
        f.testCase.includes('offset')
      );
      
      if (offsetModeFailures.length > 0) {
        issues.push({
          priority: 'P1',
          category: 'Header',
          description: 'Offset mode Header 字段不匹配',
          affectedTests: offsetModeFailures.map(f => f.testCase),
          estimatedEffort: 'Medium',
          rootCause: 'indexAreaSize 计算可能不正确，或 fontName 格式不一致',
          recommendedFix: '检查 calculateIndexAreaSize() 和 getFontName() 实现'
        });
      }
      
      const otherHeaderFailures = headerFailures.filter(f => 
        !f.testCase.includes('offset')
      );
      
      if (otherHeaderFailures.length > 0) {
        issues.push({
          priority: 'P1',
          category: 'Header',
          description: 'Header 字段不匹配',
          affectedTests: otherHeaderFailures.map(f => f.testCase),
          estimatedEffort: 'Medium',
          recommendedFix: '使用 diagnose.ts 分析具体字段差异'
        });
      }
    }
    
    // P2: Index failures
    const indexFailures = failures.filter(f => f.failures.index);
    if (indexFailures.length > 0) {
      // Group by font type
      const vectorFailures = indexFailures.filter(f => f.testCase.startsWith('vec_'));
      const bitmapFailures = indexFailures.filter(f => !f.testCase.startsWith('vec_'));
      
      if (vectorFailures.length > 0) {
        issues.push({
          priority: 'P2',
          category: 'Index',
          description: 'Vector font Index 结构验证失败',
          affectedTests: vectorFailures.map(f => f.testCase),
          estimatedEffort: 'Low',
          rootCause: 'Address mode 索引数组大小或偏移量计算不正确',
          recommendedFix: '检查 createIndexArray() 在 VectorFontGenerator 中的实现'
        });
      }
      
      if (bitmapFailures.length > 0) {
        issues.push({
          priority: 'P2',
          category: 'Index',
          description: 'Bitmap font Index 结构验证失败',
          affectedTests: bitmapFailures.map(f => f.testCase),
          estimatedEffort: 'Low',
          recommendedFix: '检查 createIndexArray() 在 BitmapFontGenerator 中的实现'
        });
      }
    }
    
    // P3: Glyph failures (may be acceptable due to rendering engine differences)
    const glyphFailures = failures.filter(f => f.failures.glyph);
    if (glyphFailures.length > 0) {
      const avgSimilarity = glyphFailures.reduce((sum, f) => {
        const detail = f.details.find(d => d.section === 'glyph');
        const match = detail?.message.match(/(\d+\.?\d*)%/);
        return sum + (match ? parseFloat(match[1]) : 0);
      }, 0) / glyphFailures.length;
      
      if (avgSimilarity < 90) {
        issues.push({
          priority: 'P3',
          category: 'Glyph',
          description: `Glyph 相似度较低 (平均 ${avgSimilarity.toFixed(1)}%)`,
          affectedTests: glyphFailures.map(f => f.testCase),
          estimatedEffort: 'High',
          rootCause: '渲染引擎差异 (FreeType vs opentype.js)',
          recommendedFix: '调整渲染参数或接受为已知限制'
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Generates an issue summary report
   * 
   * @param issues - Array of prioritized issues
   * @returns Formatted summary string
   */
  generateIssueSummary(issues: PrioritizedIssue[]): string {
    const lines: string[] = [
      '=== 问题摘要 ===',
      ''
    ];
    
    for (const issue of issues) {
      lines.push(`[${issue.priority}] ${issue.category}: ${issue.description}`);
      lines.push(`  影响测试: ${issue.affectedTests.length} 个 (${issue.affectedTests.join(', ')})`);
      lines.push(`  预估工作量: ${issue.estimatedEffort}`);
      
      if (issue.rootCause) {
        lines.push(`  根本原因: ${issue.rootCause}`);
      }
      
      if (issue.recommendedFix) {
        lines.push(`  建议修复: ${issue.recommendedFix}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Compares two reports to track progress
   * 
   * @param beforeReport - Report before fixes
   * @param afterReport - Report after fixes
   * @returns Progress summary
   */
  compareReports(beforeReport: JsonReport, afterReport: JsonReport): {
    passRateChange: number;
    newPasses: string[];
    newFailures: string[];
    improvements: string[];
    regressions: string[];
  } {
    const beforePassed = new Set(
      beforeReport.results.filter(r => r.status === 'PASS').map(r => r.testCase)
    );
    const afterPassed = new Set(
      afterReport.results.filter(r => r.status === 'PASS').map(r => r.testCase)
    );
    
    const newPasses = Array.from(afterPassed).filter(tc => !beforePassed.has(tc));
    const newFailures = Array.from(beforePassed).filter(tc => !afterPassed.has(tc));
    
    const improvements: string[] = [];
    const regressions: string[] = [];
    
    for (const afterResult of afterReport.results) {
      const beforeResult = beforeReport.results.find(r => r.testCase === afterResult.testCase);
      if (!beforeResult) continue;
      
      // Check for improvements
      if (!beforeResult.header.match && afterResult.header.match) {
        improvements.push(`${afterResult.testCase}: Header 现在匹配`);
      }
      if (!beforeResult.index.valid && afterResult.index.valid) {
        improvements.push(`${afterResult.testCase}: Index 现在有效`);
      }
      if (!beforeResult.cst.match && afterResult.cst.match) {
        improvements.push(`${afterResult.testCase}: CST 现在匹配`);
      }
      if (afterResult.glyph.similarity > beforeResult.glyph.similarity + 5) {
        improvements.push(
          `${afterResult.testCase}: Glyph 相似度提升 ` +
          `(${beforeResult.glyph.similarity.toFixed(1)}% → ${afterResult.glyph.similarity.toFixed(1)}%)`
        );
      }
      
      // Check for regressions
      if (beforeResult.header.match && !afterResult.header.match) {
        regressions.push(`${afterResult.testCase}: Header 不再匹配`);
      }
      if (beforeResult.index.valid && !afterResult.index.valid) {
        regressions.push(`${afterResult.testCase}: Index 不再有效`);
      }
      if (beforeResult.cst.match && !afterResult.cst.match) {
        regressions.push(`${afterResult.testCase}: CST 不再匹配`);
      }
      if (afterResult.glyph.similarity < beforeResult.glyph.similarity - 5) {
        regressions.push(
          `${afterResult.testCase}: Glyph 相似度下降 ` +
          `(${beforeResult.glyph.similarity.toFixed(1)}% → ${afterResult.glyph.similarity.toFixed(1)}%)`
        );
      }
    }
    
    const passRateChange = afterReport.summary.passRate - beforeReport.summary.passRate;
    
    return {
      passRateChange,
      newPasses,
      newFailures,
      improvements,
      regressions
    };
  }
  
  /**
   * Generates a progress report
   * 
   * @param beforeReport - Report before fixes
   * @param afterReport - Report after fixes
   * @returns Formatted progress report
   */
  generateProgressReport(beforeReport: JsonReport, afterReport: JsonReport): string {
    const progress = this.compareReports(beforeReport, afterReport);
    
    const lines: string[] = [
      '=== 修复进度报告 ===',
      '',
      `修复前: ${beforeReport.summary.passed}/${beforeReport.summary.total} PASS (${beforeReport.summary.passRate.toFixed(1)}%)`,
      `修复后: ${afterReport.summary.passed}/${afterReport.summary.total} PASS (${afterReport.summary.passRate.toFixed(1)}%)`,
      `变化: ${progress.passRateChange >= 0 ? '+' : ''}${progress.passRateChange.toFixed(1)}%`,
      ''
    ];
    
    if (progress.newPasses.length > 0) {
      lines.push('新通过的测试:');
      for (const tc of progress.newPasses) {
        lines.push(`  ✓ ${tc}`);
      }
      lines.push('');
    }
    
    if (progress.improvements.length > 0) {
      lines.push('改进:');
      for (const improvement of progress.improvements) {
        lines.push(`  ↑ ${improvement}`);
      }
      lines.push('');
    }
    
    if (progress.regressions.length > 0) {
      lines.push('⚠️ 回归问题:');
      for (const regression of progress.regressions) {
        lines.push(`  ↓ ${regression}`);
      }
      lines.push('');
    }
    
    if (progress.newFailures.length > 0) {
      lines.push('⚠️ 新失败的测试:');
      for (const tc of progress.newFailures) {
        lines.push(`  ✗ ${tc}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Extracts specific failure patterns
   * 
   * @param failures - Array of failed tests
   * @returns Map of failure patterns to affected tests
   */
  extractFailurePatterns(failures: FailedTest[]): Map<string, string[]> {
    const patterns = new Map<string, string[]>();
    
    for (const failure of failures) {
      for (const detail of failure.details) {
        if (detail.status === 'mismatch') {
          const pattern = `${detail.section}: ${detail.message.split(':')[0]}`;
          const tests = patterns.get(pattern) || [];
          tests.push(failure.testCase);
          patterns.set(pattern, tests);
        }
      }
    }
    
    return patterns;
  }
  
  /**
   * Generates a failure pattern report
   * 
   * @param failures - Array of failed tests
   * @returns Formatted pattern report
   */
  generateFailurePatternReport(failures: FailedTest[]): string {
    const patterns = this.extractFailurePatterns(failures);
    
    const lines: string[] = [
      '=== 失败模式分析 ===',
      ''
    ];
    
    // Sort patterns by frequency
    const sortedPatterns = Array.from(patterns.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    for (const [pattern, tests] of sortedPatterns) {
      lines.push(`${pattern} (${tests.length} 个测试)`);
      lines.push(`  ${tests.join(', ')}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
}

/**
 * Creates a default test report analyzer instance
 */
export function createReportAnalyzer(): TestReportAnalyzer {
  return new TestReportAnalyzer();
}

/**
 * Quick analysis function for CLI usage
 * 
 * @param reportPath - Path to JSON report file
 * @returns Analysis summary
 */
export function analyzeReport(reportPath: string): string {
  const analyzer = new TestReportAnalyzer();
  const report = analyzer.loadReport(reportPath);
  const failures = analyzer.getFailedTests(report);
  const issues = analyzer.prioritizeIssues(failures);
  
  const lines: string[] = [
    `Report: ${reportPath}`,
    `Timestamp: ${report.metadata.timestamp}`,
    '',
    `Summary: ${report.summary.passed}/${report.summary.total} PASS (${report.summary.passRate.toFixed(1)}%)`,
    '',
    analyzer.generateIssueSummary(issues),
    analyzer.generateFailurePatternReport(failures)
  ];
  
  return lines.join('\n');
}
