/**
 * C++ Reference Generator for Compatibility Testing
 * 
 * This module provides functions to generate reference outputs using the C++ fontDictionary.exe tool.
 * The generated outputs serve as the baseline for comparing TypeScript implementation.
 * 
 * Requirements: 2.1-2.4 - Reference output generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptions } from 'child_process';
import { loadAllConvertedConfigs, CppTestConfig as ConvertedCppTestConfig } from './config-converter';

/**
 * Test case configuration for C++ generation
 */
export interface CppTestConfig {
  /** Test case name */
  name: string;
  /** Test case description */
  description: string;
  /** C++ configuration object */
  cppConfig: {
    OutputFolder: string;
    fontSet: {
      font: string;
      fontSize: number;
      renderMode: number;
      bold: boolean;
      italic: boolean;
      indexMethod: number;
      crop: number;
      outputFormat: number;
    };
    customerVals?: Array<{
      firstVal: string;
      range: string;
    }>;
    codePages?: string[];
    cstPaths?: string[];
    symbolPaths?: string[];
  };
}

/**
 * C++ generation result
 */
export interface CppGenerationResult {
  /** Test case name */
  testCase: string;
  /** Whether generation was successful */
  success: boolean;
  /** Output directory path */
  outputDir: string;
  /** Generated files */
  generatedFiles: string[];
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error message if generation failed */
  error?: string;
  /** C++ tool stdout */
  stdout?: string;
  /** C++ tool stderr */
  stderr?: string;
}

/**
 * C++ tool information
 */
export interface CppToolInfo {
  /** Path to fontDictionary.exe */
  exePath: string;
  /** Whether the tool exists */
  exists: boolean;
  /** Tool version (if available) */
  version?: string;
  /** Working directory */
  workingDir: string;
}

/**
 * Default paths relative to the compatibility test directory
 */
export const DEFAULT_PATHS = {
  /** Path to font-tool-typescript root directory */
  RELEASE_DIR: '../..',
  /** Path to fontDictionary.exe (in font-tool-release, still needed for C++ comparison) */
  EXE_PATH: '../../../../font-tool-release/fontDictionary.exe',
  /** Path to Font directory */
  FONT_DIR: '../../Font',
  /** Path to charset directory */
  CHARSET_DIR: '../../charset',
  /** Path to CodePage directory */
  CODEPAGE_DIR: '../../CodePage',
  /** Output directory for C++ reference */
  CPP_REFERENCE_DIR: '../cpp_reference',
  /** Configs directory */
  CONFIGS_DIR: '../configs'
} as const;



/**
 * Gets information about the C++ tool
 * 
 * @param baseDir - Base directory for resolving paths (defaults to framework directory)
 * @returns C++ tool information
 */
export function getCppToolInfo(baseDir?: string): CppToolInfo {
  const frameworkDir = baseDir || __dirname;
  const exePath = path.resolve(frameworkDir, DEFAULT_PATHS.EXE_PATH);
  const workingDir = path.resolve(frameworkDir, DEFAULT_PATHS.RELEASE_DIR);
  
  return {
    exePath,
    exists: fs.existsSync(exePath),
    workingDir
  };
}

/**
 * Loads a test configuration from a JSON file
 * 
 * @param configPath - Path to the configuration file
 * @returns Parsed test configuration
 */
export function loadTestConfig(configPath: string): CppTestConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content) as CppTestConfig;
}

/**
 * Loads all test configurations from the configs directory
 * 
 * @param configsDir - Path to the configs directory
 * @returns Array of test configurations
 */
export function loadAllTestConfigs(configsDir?: string): CppTestConfig[] {
  const dir = configsDir || path.resolve(__dirname, DEFAULT_PATHS.CONFIGS_DIR);
  
  // Use the config converter to load and convert TypeScript configs
  return loadAllConvertedConfigs(dir);
}

/**
 * Creates a temporary FontConfig.json for C++ tool execution
 * 
 * @param config - Test configuration
 * @param outputDir - Output directory for generated files
 * @param workingDir - C++ tool working directory
 * @returns Path to the temporary config file
 */
export function createCppConfigFile(
  config: CppTestConfig,
  outputDir: string,
  workingDir: string
): string {
  // Create the C++ config object
  const cppConfig = {
    OutputFolder: path.relative(workingDir, outputDir).replace(/\\/g, '/'),
    fontSet: {
      font: config.cppConfig.fontSet.font,
      fontSize: config.cppConfig.fontSet.fontSize,
      renderMode: config.cppConfig.fontSet.renderMode,
      bold: config.cppConfig.fontSet.bold,
      italic: config.cppConfig.fontSet.italic,
      indexMethod: config.cppConfig.fontSet.indexMethod,
      crop: config.cppConfig.fontSet.crop,
      outputFormat: config.cppConfig.fontSet.outputFormat
    },
    customerVals: config.cppConfig.customerVals || [],
    codePages: config.cppConfig.codePages || [],
    cstPaths: config.cppConfig.cstPaths || [],
    symbolPaths: config.cppConfig.symbolPaths || []
  };
  
  // Write to a temporary file in the working directory
  const configPath = path.join(workingDir, `FontConfig_${config.name}.json`);
  fs.writeFileSync(configPath, JSON.stringify(cppConfig, null, 2), 'utf-8');
  
  return configPath;
}

/**
 * Cleans up temporary config file
 * 
 * @param configPath - Path to the temporary config file
 */
export function cleanupCppConfigFile(configPath: string): void {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.warn(`Warning: Failed to cleanup config file ${configPath}: ${error}`);
  }
}



/**
 * Generates C++ reference output for a single test case
 * 
 * Requirements: 2.1 - Call C++ fontDictionary.exe to generate binary files
 * Requirements: 2.2 - Generate independent output directory for each test case
 * Requirements: 2.3 - Save generated .bin and .cst files
 * 
 * @param config - Test configuration
 * @param options - Generation options
 * @returns Generation result
 */
export function generateCppReference(
  config: CppTestConfig,
  options?: {
    baseDir?: string;
    outputBaseDir?: string;
    timeout?: number;
    verbose?: boolean;
  }
): CppGenerationResult {
  const startTime = Date.now();
  const baseDir = options?.baseDir || __dirname;
  const outputBaseDir = options?.outputBaseDir || path.resolve(baseDir, DEFAULT_PATHS.CPP_REFERENCE_DIR);
  const timeout = options?.timeout || 60000; // 60 seconds default
  const verbose = options?.verbose || false;
  
  // Get C++ tool info
  const toolInfo = getCppToolInfo(baseDir);
  
  if (!toolInfo.exists) {
    return {
      testCase: config.name,
      success: false,
      outputDir: '',
      generatedFiles: [],
      executionTime: Date.now() - startTime,
      error: `C++ tool not found: ${toolInfo.exePath}`
    };
  }
  
  // Create output directory
  const outputDir = path.resolve(outputBaseDir, config.name);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create temporary config file
  let configPath: string | null = null;
  
  try {
    configPath = createCppConfigFile(config, outputDir, toolInfo.workingDir);
    
    // Build command
    const configFileName = path.basename(configPath);
    const command = `fontDictionary.exe ${configFileName}`;
    
    if (verbose) {
      console.log(`[${config.name}] Running: ${command}`);
      console.log(`[${config.name}] Working dir: ${toolInfo.workingDir}`);
      console.log(`[${config.name}] Output dir: ${outputDir}`);
    }
    
    // Execute C++ tool
    const execOptions: ExecSyncOptions = {
      cwd: toolInfo.workingDir,
      timeout,
      encoding: 'utf-8',
      stdio: verbose ? 'inherit' : 'pipe',
      windowsHide: true
    };
    
    let stdout = '';
    let stderr = '';
    
    try {
      const result = execSync(command, {
        ...execOptions,
        stdio: 'pipe'
      });
      stdout = result?.toString() || '';
    } catch (execError: unknown) {
      const error = execError as { stdout?: Buffer; stderr?: Buffer; message?: string };
      stdout = error.stdout?.toString() || '';
      stderr = error.stderr?.toString() || '';
      
      // Check if files were generated despite error
      const generatedFiles = getGeneratedFiles(outputDir);
      if (generatedFiles.length === 0) {
        return {
          testCase: config.name,
          success: false,
          outputDir,
          generatedFiles: [],
          executionTime: Date.now() - startTime,
          error: `C++ tool execution failed: ${error.message || 'Unknown error'}`,
          stdout,
          stderr
        };
      }
    }
    
    // Get generated files
    const generatedFiles = getGeneratedFiles(outputDir);
    
    if (generatedFiles.length === 0) {
      return {
        testCase: config.name,
        success: false,
        outputDir,
        generatedFiles: [],
        executionTime: Date.now() - startTime,
        error: 'No output files generated',
        stdout,
        stderr
      };
    }
    
    return {
      testCase: config.name,
      success: true,
      outputDir,
      generatedFiles,
      executionTime: Date.now() - startTime,
      stdout,
      stderr
    };
    
  } catch (error) {
    return {
      testCase: config.name,
      success: false,
      outputDir,
      generatedFiles: [],
      executionTime: Date.now() - startTime,
      error: `Generation failed: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    // Cleanup temporary config file
    if (configPath) {
      cleanupCppConfigFile(configPath);
    }
  }
}

/**
 * Gets list of generated files in output directory
 * 
 * @param outputDir - Output directory path
 * @returns Array of file names
 */
export function getGeneratedFiles(outputDir: string): string[] {
  if (!fs.existsSync(outputDir)) {
    return [];
  }
  
  return fs.readdirSync(outputDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.font' || ext === '.cst' || ext === '.bin';
  });
}



/**
 * Generates C++ reference outputs for all test cases
 * 
 * Requirements: 2.1-2.4 - Reference output generation for all test cases
 * 
 * @param options - Generation options
 * @returns Array of generation results
 */
export function generateAllCppReferences(
  options?: {
    baseDir?: string;
    configsDir?: string;
    outputBaseDir?: string;
    timeout?: number;
    verbose?: boolean;
    onProgress?: (current: number, total: number, testCase: string) => void;
  }
): CppGenerationResult[] {
  const baseDir = options?.baseDir || __dirname;
  const configsDir = options?.configsDir || path.resolve(baseDir, DEFAULT_PATHS.CONFIGS_DIR);
  const outputBaseDir = options?.outputBaseDir || path.resolve(baseDir, DEFAULT_PATHS.CPP_REFERENCE_DIR);
  
  // Load all test configurations
  const configs = loadAllTestConfigs(configsDir);
  
  if (configs.length === 0) {
    console.warn('No test configurations found');
    return [];
  }
  
  const results: CppGenerationResult[] = [];
  
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    
    if (options?.onProgress) {
      options.onProgress(i + 1, configs.length, config.name);
    }
    
    const result = generateCppReference(config, {
      baseDir,
      outputBaseDir,
      timeout: options?.timeout,
      verbose: options?.verbose
    });
    
    results.push(result);
  }
  
  return results;
}

/**
 * Generates C++ reference for specific test cases
 * 
 * @param testCases - Array of test case names to generate
 * @param options - Generation options
 * @returns Array of generation results
 */
export function generateCppReferencesForCases(
  testCases: string[],
  options?: {
    baseDir?: string;
    configsDir?: string;
    outputBaseDir?: string;
    timeout?: number;
    verbose?: boolean;
    onProgress?: (current: number, total: number, testCase: string) => void;
  }
): CppGenerationResult[] {
  const baseDir = options?.baseDir || __dirname;
  const configsDir = options?.configsDir || path.resolve(baseDir, DEFAULT_PATHS.CONFIGS_DIR);
  const outputBaseDir = options?.outputBaseDir || path.resolve(baseDir, DEFAULT_PATHS.CPP_REFERENCE_DIR);
  
  // Load all test configurations
  const allConfigs = loadAllTestConfigs(configsDir);
  
  // Filter to requested test cases
  const configs = allConfigs.filter(c => testCases.includes(c.name));
  
  if (configs.length === 0) {
    console.warn(`No matching test configurations found for: ${testCases.join(', ')}`);
    return [];
  }
  
  const results: CppGenerationResult[] = [];
  
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    
    if (options?.onProgress) {
      options.onProgress(i + 1, configs.length, config.name);
    }
    
    const result = generateCppReference(config, {
      baseDir,
      outputBaseDir,
      timeout: options?.timeout,
      verbose: options?.verbose
    });
    
    results.push(result);
  }
  
  return results;
}

/**
 * Formats generation result as a human-readable string
 */
export function formatCppGenerationResult(result: CppGenerationResult): string {
  const statusIcon = result.success ? '✓' : '✗';
  const lines: string[] = [
    `[${statusIcon}] ${result.testCase}`,
    `    Output: ${result.outputDir}`,
    `    Files: ${result.generatedFiles.length > 0 ? result.generatedFiles.join(', ') : 'none'}`,
    `    Time: ${result.executionTime}ms`
  ];
  
  if (result.error) {
    lines.push(`    Error: ${result.error}`);
  }
  
  return lines.join('\n');
}

/**
 * Formats all generation results as a summary
 */
export function formatCppGenerationSummary(results: CppGenerationResult[]): string {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
  
  const lines: string[] = [
    '=== C++ Reference Generation Summary ===',
    `Total: ${results.length} test case(s)`,
    `Successful: ${successful}`,
    `Failed: ${failed}`,
    `Total Time: ${totalTime}ms`,
    '',
    'Details:'
  ];
  
  for (const result of results) {
    lines.push(formatCppGenerationResult(result));
  }
  
  return lines.join('\n');
}

