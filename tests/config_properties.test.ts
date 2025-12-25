/**
 * Property-based tests for configuration parsing
 * Feature: typescript-font-converter
 * 
 * These tests validate that configuration parsing maintains correctness
 * properties across all valid inputs using fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../src/config';
import {
  FontConfig,
  RootConfig,
  CharacterSetSource,
  RenderMode,
  Rotation,
  IndexMethod
} from '../src/types';
import { FontConverterError, ErrorCode } from '../src/errors';

// Temporary directory for test files
const TEST_DIR = path.join(__dirname, 'temp_config_props_test');
const TEST_FONT = path.join(TEST_DIR, 'test.ttf');
const TEST_CHARSET = path.join(TEST_DIR, 'test.cst');
const TEST_OUTPUT = path.join(TEST_DIR, 'output');

// Setup: Create temporary test files before all tests
beforeAll(() => {
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  // Create dummy font file
  fs.writeFileSync(TEST_FONT, Buffer.from([0x00, 0x01, 0x00, 0x00]));
  // Create dummy charset file
  fs.writeFileSync(TEST_CHARSET, Buffer.from([0x01, 0x00, 0x00, 0x00, 0x41, 0x00]));
  // Create output directory
  if (!fs.existsSync(TEST_OUTPUT)) {
    fs.mkdirSync(TEST_OUTPUT, { recursive: true });
  }
});

// Teardown: Clean up temporary files after all tests
afterAll(() => {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

/**
 * Arbitrary generator for CharacterSetSource
 */
const characterSetSourceArbitrary = (): fc.Arbitrary<CharacterSetSource> => {
  return fc.oneof(
    fc.record({
      type: fc.constant('file' as const),
      value: fc.constant(TEST_CHARSET) // Use real file
    }),
    fc.record({
      type: fc.constant('codepage' as const),
      value: fc.string({ minLength: 1, maxLength: 20 })
    }),
    fc.record({
      type: fc.constant('range' as const),
      // Generate valid Unicode range strings in format "0xXXXX-0xYYYY"
      value: fc.tuple(
        fc.integer({ min: 0x0020, max: 0x007F }),
        fc.integer({ min: 0x0080, max: 0x00FF })
      ).map(([start, end]) => `0x${start.toString(16)}-0x${end.toString(16)}`)
    }),
    fc.record({
      type: fc.constant('string' as const),
      value: fc.string({ minLength: 1, maxLength: 100 })
    })
  );
};

/**
 * Arbitrary generator for RenderMode
 */
const renderModeArbitrary = (): fc.Arbitrary<RenderMode> => {
  return fc.constantFrom(
    RenderMode.BIT_1,
    RenderMode.BIT_2,
    RenderMode.BIT_4,
    RenderMode.BIT_8
  );
};

/**
 * Arbitrary generator for Rotation
 */
const rotationArbitrary = (): fc.Arbitrary<Rotation> => {
  return fc.constantFrom(
    Rotation.ROTATE_0,
    Rotation.ROTATE_90,
    Rotation.ROTATE_180,
    Rotation.ROTATE_270
  );
};

/**
 * Arbitrary generator for IndexMethod
 */
const indexMethodArbitrary = (): fc.Arbitrary<IndexMethod> => {
  return fc.constantFrom(IndexMethod.ADDRESS, IndexMethod.OFFSET);
};

/**
 * Arbitrary generator for FontConfig
 * Generates valid font configurations
 */
const fontConfigArbitrary = (): fc.Arbitrary<FontConfig> => {
  return fc.record({
    fontPath: fc.constant(TEST_FONT), // Use real file
    outputPath: fc.constant(TEST_OUTPUT), // Use real directory
    fontSize: fc.integer({ min: 6, max: 128 }),
    renderMode: renderModeArbitrary(),
    bold: fc.boolean(),
    italic: fc.boolean(),
    rotation: rotationArbitrary(),
    // Generate gamma in valid range [0.1, 5.0], avoiding boundary precision issues
    // Use integer-based generation: 11-500 mapped to 0.11-5.00
    gamma: fc.integer({ min: 11, max: 500 }).map(n => n / 100),
    indexMethod: indexMethodArbitrary(),
    crop: fc.boolean(),
    characterSets: fc.array(characterSetSourceArbitrary(), { minLength: 1, maxLength: 10 }),
    outputFormat: fc.constantFrom('bitmap' as const, 'vector' as const)
  }).filter(config => {
    // Filter out invalid combinations: crop=true with indexMethod=OFFSET for bitmap
    if (config.outputFormat === 'bitmap' && config.crop && config.indexMethod === IndexMethod.OFFSET) {
      return false;
    }
    return true;
  });
};

/**
 * Arbitrary generator for RootConfig
 */
const rootConfigArbitrary = (): fc.Arbitrary<RootConfig> => {
  return fc.record({
    fonts: fc.array(fontConfigArbitrary(), { minLength: 1, maxLength: 5 })
  });
};

/**
 * Helper function to create a temporary JSON config file
 */
async function createTempConfigFile(config: RootConfig): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'font-converter-test-'));
  const configPath = path.join(tempDir, 'test-config.json');
  
  // Convert FontConfig to JSON-compatible format
  const jsonConfig = {
    fonts: config.fonts.map(font => ({
      fontPath: font.fontPath,
      outputPath: font.outputPath,
      fontSize: font.fontSize,
      renderMode: font.renderMode,
      bold: font.bold,
      italic: font.italic,
      rotation: font.rotation,
      gamma: font.gamma,
      indexMethod: font.indexMethod,
      crop: font.crop ? 1 : 0,
      characterSets: font.characterSets,
      outputFormat: font.outputFormat === 'vector' ? 2 : 0
    }))
  };
  
  await fs.promises.writeFile(configPath, JSON.stringify(jsonConfig, null, 2), 'utf-8');
  return configPath;
}

/**
 * Helper function to clean up temporary files
 */
async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.promises.unlink(filePath);
    await fs.promises.rmdir(dir);
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Helper function to compare FontConfig objects
 * Handles path resolution differences
 */
function compareFontConfigs(original: FontConfig, parsed: FontConfig, configDir: string): boolean {
  // For paths, we need to compare resolved paths
  const resolvePath = (p: string) => {
    if (!p) return p;
    if (path.isAbsolute(p)) return p;
    return path.resolve(configDir, p);
  };
  
  return (
    resolvePath(original.fontPath) === parsed.fontPath &&
    resolvePath(original.outputPath) === parsed.outputPath &&
    original.fontSize === parsed.fontSize &&
    original.renderMode === parsed.renderMode &&
    original.bold === parsed.bold &&
    original.italic === parsed.italic &&
    original.rotation === parsed.rotation &&
    Math.abs(original.gamma - parsed.gamma) < 0.0001 && // Float comparison
    original.indexMethod === parsed.indexMethod &&
    original.crop === parsed.crop &&
    original.outputFormat === parsed.outputFormat &&
    original.characterSets.length === parsed.characterSets.length &&
    original.characterSets.every((cs, i) => 
      cs.type === parsed.characterSets[i].type &&
      cs.value === parsed.characterSets[i].value
    )
  );
}

describe('Feature: typescript-font-converter, Property 1: 配置解析 Round-Trip', () => {
  /**
   * Property 1: Configuration Round-Trip
   * For any valid FontConfig, serializing to JSON and parsing back
   * should produce an equivalent configuration
   * 
   * Validates: Requirements 1.1
   */
  it('should preserve configuration through JSON serialization and parsing', async () => {
    await fc.assert(
      fc.asyncProperty(
        rootConfigArbitrary(),
        async (originalConfig) => {
          let configPath: string | null = null;
          
          try {
            // Write config to temporary JSON file
            configPath = await createTempConfigFile(originalConfig);
            const configDir = path.dirname(configPath);
            
            // Parse the config back
            const parsedConfig = await ConfigManager.loadConfig(configPath);
            
            // Verify the parsed config matches the original
            expect(parsedConfig.fonts.length).toBe(originalConfig.fonts.length);
            
            for (let i = 0; i < originalConfig.fonts.length; i++) {
              const original = originalConfig.fonts[i];
              const parsed = parsedConfig.fonts[i];
              
              expect(compareFontConfigs(original, parsed, configDir)).toBe(true);
            }
          } finally {
            // Cleanup
            if (configPath) {
              await cleanupTempFile(configPath);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000); // 60 second timeout for property test
});


/**
 * Arbitrary generator for invalid FontConfig
 * Generates configurations with various invalid values
 */
const invalidFontConfigArbitrary = (): fc.Arbitrary<{config: FontConfig, invalidField: string}> => {
  return fc.oneof(
    // Empty fontPath
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, fontPath: '' })),
      invalidField: fc.constant('fontPath')
    }),
    // Empty outputPath
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, outputPath: '' })),
      invalidField: fc.constant('outputPath')
    }),
    // Empty characterSets
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, characterSets: [] })),
      invalidField: fc.constant('characterSets')
    }),
    // fontSize out of range (too small)
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, fontSize: 0 })),
      invalidField: fc.constant('fontSize')
    }),
    // fontSize out of range (too large)
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, fontSize: 300 })),
      invalidField: fc.constant('fontSize')
    }),
    // gamma out of range (too small)
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, gamma: 0.01 })),
      invalidField: fc.constant('gamma')
    }),
    // gamma out of range (too large)
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, gamma: 10.0 })),
      invalidField: fc.constant('gamma')
    }),
    // Invalid renderMode
    fc.record({
      config: fontConfigArbitrary().map(config => ({ 
        ...config, 
        renderMode: 3 as RenderMode,
        outputFormat: 'bitmap' as const
      })),
      invalidField: fc.constant('renderMode')
    }),
    // Invalid rotation
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, rotation: 5 as Rotation })),
      invalidField: fc.constant('rotation')
    }),
    // Invalid indexMethod
    fc.record({
      config: fontConfigArbitrary().map(config => ({ ...config, indexMethod: 5 as IndexMethod })),
      invalidField: fc.constant('indexMethod')
    }),
    // crop=true with indexMethod=OFFSET conflict (bitmap only)
    fc.record({
      config: fontConfigArbitrary().map(config => ({ 
        ...config, 
        crop: true, 
        indexMethod: IndexMethod.OFFSET,
        outputFormat: 'bitmap' as const
      })),
      invalidField: fc.constant('indexMethod_conflict')
    })
  );
};

describe('Feature: typescript-font-converter, Property 2: 配置验证拒绝无效输入', () => {
  /**
   * Property 2: Configuration Validation Rejects Invalid Input
   * For any configuration with invalid values (missing required fields,
   * out-of-range values, negative numbers, etc.), validation should fail
   * and return a descriptive error message.
   * 
   * Validates: Requirements 1.2, 1.3
   */
  it('should reject configurations with invalid values', () => {
    fc.assert(
      fc.property(
        invalidFontConfigArbitrary(),
        ({ config, invalidField }) => {
          try {
            ConfigManager.validateConfig(config, true); // Skip file checks
            // If we get here, validation didn't throw - this is a failure
            return false;
          } catch (error) {
            // Validation should throw FontConverterError
            if (!(error instanceof FontConverterError)) {
              return false;
            }
            
            // Error should have appropriate code
            const validCodes = [
              ErrorCode.CONFIG_VALIDATION_ERROR,
              ErrorCode.INDEX_METHOD_CONFLICT
            ];
            if (!validCodes.includes(error.code)) {
              return false;
            }
            
            // Error message should be non-empty
            if (!error.message || error.message.length === 0) {
              return false;
            }
            
            return true;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Valid configurations should pass validation
   * For any valid FontConfig, validation should succeed without throwing
   */
  it('should accept all valid configurations', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary(),
        (config) => {
          try {
            ConfigManager.validateConfig(config, true); // Skip file checks
            return true;
          } catch (error) {
            // Valid config should not throw
            return false;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Arbitrary generator for INISettings
 */
const iniSettingsArbitrary = (): fc.Arbitrary<{gamma?: number, rotation?: Rotation}> => {
  return fc.record({
    gamma: fc.option(fc.integer({ min: 10, max: 300 }).map(n => n / 100), { nil: undefined }),
    rotation: fc.option(rotationArbitrary(), { nil: undefined })
  });
};

describe('Feature: typescript-font-converter, Property 3: INI 设置覆盖 JSON 配置', () => {
  /**
   * Property 3: INI Settings Override JSON Configuration
   * For any JSON configuration and INI settings, when both are provided,
   * the final configuration's gamma and rotation values should come from
   * the INI file (when present in INI).
   * 
   * Validates: Requirements 1.4
   */
  it('should override gamma and rotation from INI settings when present', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary(),
        iniSettingsArbitrary(),
        (config, iniSettings) => {
          const merged = ConfigManager.mergeINISettings(config, iniSettings);
          
          // If INI has gamma, merged should use INI gamma
          if (iniSettings.gamma !== undefined) {
            if (merged.gamma !== iniSettings.gamma) {
              return false;
            }
          } else {
            // If INI doesn't have gamma, merged should keep original
            if (merged.gamma !== config.gamma) {
              return false;
            }
          }
          
          // If INI has rotation, merged should use INI rotation
          if (iniSettings.rotation !== undefined) {
            if (merged.rotation !== iniSettings.rotation) {
              return false;
            }
          } else {
            // If INI doesn't have rotation, merged should keep original
            if (merged.rotation !== config.rotation) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: INI merge should not modify other config properties
   * For any configuration and INI settings, merging should only affect
   * gamma and rotation, leaving all other properties unchanged.
   */
  it('should preserve all other config properties after INI merge', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary(),
        iniSettingsArbitrary(),
        (config, iniSettings) => {
          const merged = ConfigManager.mergeINISettings(config, iniSettings);
          
          // All properties except gamma and rotation should be unchanged
          return (
            merged.fontPath === config.fontPath &&
            merged.outputPath === config.outputPath &&
            merged.fontSize === config.fontSize &&
            merged.renderMode === config.renderMode &&
            merged.bold === config.bold &&
            merged.italic === config.italic &&
            merged.indexMethod === config.indexMethod &&
            merged.crop === config.crop &&
            merged.outputFormat === config.outputFormat &&
            merged.characterSets.length === config.characterSets.length &&
            merged.characterSets.every((cs, i) => 
              cs.type === config.characterSets[i].type &&
              cs.value === config.characterSets[i].value
            )
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
