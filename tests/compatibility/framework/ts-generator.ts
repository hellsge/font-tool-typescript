/**
 * TypeScript Output Generator for Compatibility Testing
 * 
 * This module provides functions to generate test outputs using the TypeScript font-converter.
 * The generated outputs are compared against C++ reference outputs.
 * 
 * Requirements: 3.1-3.4 - TypeScript output generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptions } from 'child_process';

/**
 * Test case configuration for TypeScript generation
 */
export interface TsTestConfig {
  /** Test case name */
  name: string;
  /** Test case description */
  description: string;
  /** TypeScript font configuration */
  fonts: Array<{
    fontPath: string;
    outputPath: string;
    fontSize: number;
    renderMode: number;
    bold: boolean;
    italic: boolean;
    rotation: number;
    gamma: number;
    indexMethod: number;
    crop: boolean;
    outputFormat: 'bitmap' | 'vector';
    characterSets: Array<{
      type: 'file' | 'codepage' | 'range' | 'string';
      value: string;
    }>;
  }>;
}

/**
 * TypeScript generation result
 */
export interface TsGenerationResult {
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
  /** Tool stdout */
  stdout?: string;
  /** Tool stderr */
  stderr?: string;
}

/**
 * Default paths relative to the compatibility test directory
 */
export const TS_DEFAULT_PATHS = {
  /** Path to font-tool-typescript root */
  TS_ROOT: '../../..',
  /** Path to font-converter CLI */
  CLI_PATH: '../../../bin/font-converter.js',
  /** Path to font-tool-typescript root directory */
  RELEASE_DIR: '../..',
  /** Output directory for TypeScript test output */
  TS_OUTPUT_DIR: '../ts_output',
  /** Configs directory */
  CONFIGS_DIR: '../configs'
} as const;



/**
 * Gets information about the TypeScript tool
 * 
 * @param baseDir - Base directory for resolving paths (defaults to framework directory)
 * @returns TypeScript tool information
 */
export function getTsToolInfo(baseDir?: string): {
  cliPath: string;
  exists: boolean;
  tsRoot: string;
  nodeVersion: string;
} {
  const frameworkDir = baseDir || __dirname;
  const cliPath = path.resolve(frameworkDir, TS_DEFAULT_PATHS.CLI_PATH);
  const tsRoot = path.resolve(frameworkDir, TS_DEFAULT_PATHS.TS_ROOT);
  
  // Get Node.js version
  let nodeVersion = 'unknown';
  try {
    nodeVersion = process.version;
  } catch {
    // Ignore
  }
  
  return {
    cliPath,
    exists: fs.existsSync(cliPath),
    tsRoot,
    nodeVersion
  };
}

/**
 * Loads a test configuration from a JSON file
 * 
 * @param configPath - Path to the configuration file
 * @returns Parsed test configuration
 */
export function loadTsTestConfig(configPath: string): TsTestConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);
  
  // Extract name from filename
  const name = path.basename(configPath, '.json');
  
  // Generate description based on name
  const description = `Test case: ${name}`;
  
  // Return config with name and description
  return {
    name,
    description,
    fonts: config.fonts
  } as TsTestConfig;
}

/**
 * Loads all test configurations from the configs directory
 * 
 * @param configsDir - Path to the configs directory
 * @returns Array of test configurations
 */
export function loadAllTsTestConfigs(configsDir?: string): TsTestConfig[] {
  const dir = configsDir || path.resolve(__dirname, TS_DEFAULT_PATHS.CONFIGS_DIR);
  const configs: TsTestConfig[] = [];
  
  if (!fs.existsSync(dir)) {
    return configs;
  }
  
  const files = fs.readdirSync(dir).filter(f => 
    f.endsWith('.json') && 
    f !== '.gitkeep' && 
    f !== 'test-cases.json'
  );
  
  for (const file of files) {
    try {
      const config = loadTsTestConfig(path.join(dir, file));
      if (config && config.name) {
        configs.push(config);
      }
    } catch (error) {
      console.warn(`Warning: Failed to load config ${file}: ${error}`);
    }
  }
  
  return configs;
}

/**
 * Creates a temporary configuration file for TypeScript tool execution
 * 
 * @param config - Test configuration
 * @param outputDir - Output directory for generated files
 * @param baseDir - Base directory for resolving paths
 * @returns Path to the temporary config file
 */
export function createTsConfigFile(
  config: TsTestConfig,
  outputDir: string,
  baseDir: string
): string {
  // Create the TypeScript config object
  // Adjust paths to be absolute
  const tsConfig = {
    fonts: config.fonts.map(font => {
      // The font path in the config is relative to the configs directory
      // baseDir is the framework directory, so configs is at baseDir/../configs
      const configsDir = path.resolve(baseDir, '../configs');
      const absoluteFontPath = path.resolve(configsDir, font.fontPath);
      
      return {
        ...font,
        // Use absolute font path
        fontPath: absoluteFontPath,
        // Set output path to the test output directory
        outputPath: outputDir
      };
    })
  };
  
  // Write to a temporary file
  const configPath = path.join(outputDir, `config_${config.name}.json`);
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(tsConfig, null, 2), 'utf-8');
  
  return configPath;
}

/**
 * Cleans up temporary config file
 * 
 * @param configPath - Path to the temporary config file
 */
export function cleanupTsConfigFile(configPath: string): void {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.warn(`Warning: Failed to cleanup config file ${configPath}: ${error}`);
  }
}

/**
 * Gets list of generated files in output directory
 * 
 * @param outputDir - Output directory path
 * @returns Array of file names
 */
export function getTsGeneratedFiles(outputDir: string): string[] {
  if (!fs.existsSync(outputDir)) {
    return [];
  }
  
  return fs.readdirSync(outputDir).filter(f => {
    const ext = path.extname(f).toLowerCase();
    // Include font files and cst files, exclude config files
    return (ext === '.font' || ext === '.cst' || ext === '.bin') && !f.startsWith('config_');
  });
}



/**
 * Generates TypeScript test output for a single test case
 * 
 * Requirements: 3.1 - Call TypeScript font-converter to generate binary files
 * Requirements: 3.2 - Use same configuration parameters as C++
 * Requirements: 3.3 - Generate independent output directory for each test case
 * Requirements: 3.4 - Record errors and continue to next test case on failure
 * 
 * @param config - Test configuration
 * @param options - Generation options
 * @returns Generation result
 */
export function generateTsOutput(
  config: TsTestConfig,
  options?: {
    baseDir?: string;
    outputBaseDir?: string;
    timeout?: number;
    verbose?: boolean;
  }
): TsGenerationResult {
  const startTime = Date.now();
  const baseDir = options?.baseDir || __dirname;
  const outputBaseDir = options?.outputBaseDir || path.resolve(baseDir, TS_DEFAULT_PATHS.TS_OUTPUT_DIR);
  const timeout = options?.timeout || 120000; // 120 seconds default (TypeScript may be slower)
  const verbose = options?.verbose || false;
  
  // Get TypeScript tool info
  const toolInfo = getTsToolInfo(baseDir);
  
  if (!toolInfo.exists) {
    return {
      testCase: config.name,
      success: false,
      outputDir: '',
      generatedFiles: [],
      executionTime: Date.now() - startTime,
      error: `TypeScript CLI not found: ${toolInfo.cliPath}. Run 'npm run build' first.`
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
    configPath = createTsConfigFile(config, outputDir, baseDir);
    
    // Build command
    const command = `node "${toolInfo.cliPath}" "${configPath}"`;
    
    if (verbose) {
      console.log(`[${config.name}] Running: ${command}`);
      console.log(`[${config.name}] Output dir: ${outputDir}`);
    }
    
    // Execute TypeScript tool
    const execOptions: ExecSyncOptions = {
      cwd: toolInfo.tsRoot,
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
      const error = execError as { stdout?: Buffer; stderr?: Buffer; message?: string; status?: number };
      stdout = error.stdout?.toString() || '';
      stderr = error.stderr?.toString() || '';
      
      // Check if files were generated despite error
      const generatedFiles = getTsGeneratedFiles(outputDir);
      if (generatedFiles.length === 0) {
        return {
          testCase: config.name,
          success: false,
          outputDir,
          generatedFiles: [],
          executionTime: Date.now() - startTime,
          error: `TypeScript tool execution failed (exit code ${error.status}): ${error.message || stderr || 'Unknown error'}`,
          stdout,
          stderr
        };
      }
    }
    
    // Get generated files
    const generatedFiles = getTsGeneratedFiles(outputDir);
    
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
      cleanupTsConfigFile(configPath);
    }
  }
}

/**
 * Generates TypeScript test outputs for all test cases
 * 
 * Requirements: 3.1-3.4 - TypeScript output generation for all test cases
 * 
 * @param options - Generation options
 * @returns Array of generation results
 */
export function generateAllTsOutputs(
  options?: {
    baseDir?: string;
    configsDir?: string;
    outputBaseDir?: string;
    timeout?: number;
    verbose?: boolean;
    onProgress?: (current: number, total: number, testCase: string) => void;
  }
): TsGenerationResult[] {
  const baseDir = options?.baseDir || __dirname;
  const configsDir = options?.configsDir || path.resolve(baseDir, TS_DEFAULT_PATHS.CONFIGS_DIR);
  const outputBaseDir = options?.outputBaseDir || path.resolve(baseDir, TS_DEFAULT_PATHS.TS_OUTPUT_DIR);
  
  // Load all test configurations
  const configs = loadAllTsTestConfigs(configsDir);
  
  if (configs.length === 0) {
    console.warn('No test configurations found');
    return [];
  }
  
  const results: TsGenerationResult[] = [];
  
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    
    if (options?.onProgress) {
      options.onProgress(i + 1, configs.length, config.name);
    }
    
    const result = generateTsOutput(config, {
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
 * Generates TypeScript outputs for specific test cases
 * 
 * @param testCases - Array of test case names to generate
 * @param options - Generation options
 * @returns Array of generation results
 */
export function generateTsOutputsForCases(
  testCases: string[],
  options?: {
    baseDir?: string;
    configsDir?: string;
    outputBaseDir?: string;
    timeout?: number;
    verbose?: boolean;
    onProgress?: (current: number, total: number, testCase: string) => void;
  }
): TsGenerationResult[] {
  const baseDir = options?.baseDir || __dirname;
  const configsDir = options?.configsDir || path.resolve(baseDir, TS_DEFAULT_PATHS.CONFIGS_DIR);
  const outputBaseDir = options?.outputBaseDir || path.resolve(baseDir, TS_DEFAULT_PATHS.TS_OUTPUT_DIR);
  
  // Load all test configurations
  const allConfigs = loadAllTsTestConfigs(configsDir);
  
  // Filter to requested test cases
  const configs = allConfigs.filter(c => testCases.includes(c.name));
  
  if (configs.length === 0) {
    console.warn(`No matching test configurations found for: ${testCases.join(', ')}`);
    return [];
  }
  
  const results: TsGenerationResult[] = [];
  
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    
    if (options?.onProgress) {
      options.onProgress(i + 1, configs.length, config.name);
    }
    
    const result = generateTsOutput(config, {
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
export function formatTsGenerationResult(result: TsGenerationResult): string {
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
export function formatTsGenerationSummary(results: TsGenerationResult[]): string {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.executionTime, 0);
  
  const lines: string[] = [
    '=== TypeScript Output Generation Summary ===',
    `Total: ${results.length} test case(s)`,
    `Successful: ${successful}`,
    `Failed: ${failed}`,
    `Total Time: ${totalTime}ms`,
    '',
    'Details:'
  ];
  
  for (const result of results) {
    lines.push(formatTsGenerationResult(result));
  }
  
  return lines.join('\n');
}

