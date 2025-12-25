/**
 * Config Converter - Converts TypeScript configs to C++ format
 * 
 * This module converts TypeScript font converter configs to C++ fontDictionary.exe format
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * TypeScript font config structure
 */
export interface TsConfig {
  fonts: Array<{
    fontPath: string;
    outputPath: string;
    fontSize: number;
    renderMode?: number;
    bold?: boolean;
    italic?: boolean;
    rotation?: number;
    gamma?: number;
    indexMethod: number;
    crop?: boolean;
    outputFormat: string;
    characterSets: Array<{
      type: string;
      value: string;
    }>;
  }>;
}

/**
 * C++ test config structure
 */
export interface CppTestConfig {
  name: string;
  description: string;
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
 * Converts a character range string to customerVals format
 * 
 * @param rangeStr - Range string like "0x0061-0x007A"
 * @returns customerVals array
 */
function convertCharacterRange(rangeStr: string): Array<{ firstVal: string; range: string }> {
  const match = rangeStr.match(/0x([0-9A-Fa-f]+)-0x([0-9A-Fa-f]+)/);
  if (match) {
    return [{
      firstVal: `0x${match[1]}`,
      range: `0x${match[2]}`
    }];
  }
  return [];
}

/**
 * Converts TypeScript config to C++ test config
 * 
 * @param tsConfig - TypeScript config
 * @param name - Test case name
 * @param description - Test case description
 * @returns C++ test config
 */
export function convertTsToCppConfig(
  tsConfig: TsConfig,
  name: string,
  description: string
): CppTestConfig {
  const font = tsConfig.fonts[0];
  
  // Extract font filename from path
  const fontFileName = path.basename(font.fontPath);
  
  // Convert output format
  const outputFormat = font.outputFormat === 'bitmap' ? 0 : 1;
  
  // Convert character sets to customerVals
  const customerVals: Array<{ firstVal: string; range: string }> = [];
  for (const charSet of font.characterSets) {
    if (charSet.type === 'range') {
      customerVals.push(...convertCharacterRange(charSet.value));
    }
  }
  
  return {
    name,
    description,
    cppConfig: {
      OutputFolder: 'output',
      fontSet: {
        font: fontFileName,
        fontSize: font.fontSize,
        renderMode: font.renderMode || 0,
        bold: font.bold || false,
        italic: font.italic || false,
        indexMethod: font.indexMethod,
        crop: font.crop ? 1 : 0,
        outputFormat
      },
      customerVals,
      codePages: [],
      cstPaths: [],
      symbolPaths: []
    }
  };
}

/**
 * Loads and converts a TypeScript config file to C++ format
 * 
 * @param configPath - Path to TypeScript config file
 * @returns C++ test config
 */
export function loadAndConvertConfig(configPath: string): CppTestConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  const tsConfig = JSON.parse(content) as TsConfig;
  
  // Extract name from filename
  const name = path.basename(configPath, '.json');
  
  // Generate description based on name
  const description = `Test case: ${name}`;
  
  return convertTsToCppConfig(tsConfig, name, description);
}

/**
 * Loads all TypeScript configs and converts them to C++ format
 * 
 * @param configsDir - Path to configs directory
 * @returns Array of C++ test configs
 */
export function loadAllConvertedConfigs(configsDir: string): CppTestConfig[] {
  const configs: CppTestConfig[] = [];
  
  if (!fs.existsSync(configsDir)) {
    return configs;
  }
  
  const files = fs.readdirSync(configsDir).filter(f => 
    f.endsWith('.json') && 
    f !== '.gitkeep' && 
    f !== 'test-cases.json'
  );
  
  for (const file of files) {
    try {
      const config = loadAndConvertConfig(path.join(configsDir, file));
      configs.push(config);
    } catch (error) {
      console.warn(`Warning: Failed to load and convert config ${file}: ${error}`);
    }
  }
  
  return configs;
}
