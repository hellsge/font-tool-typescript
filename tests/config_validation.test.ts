/**
 * Unit tests for configuration validation
 * Feature: typescript-font-converter
 * 
 * Tests validation of required fields, value ranges, and parameter conflicts.
 * Validates: Requirements 1.2, 1.3, 8.4
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../src/config';
import {
  FontConfig,
  RenderMode,
  Rotation,
  IndexMethod
} from '../src/types';
import { ErrorCode, FontConverterError } from '../src/errors';

// Temporary directory for test files
const TEST_DIR = path.join(__dirname, 'temp_validation_test');
const TEST_FONT = path.join(TEST_DIR, 'test.ttf');
const TEST_CHARSET = path.join(TEST_DIR, 'test.cst');
const TEST_OUTPUT = path.join(TEST_DIR, 'output');

/**
 * Creates a valid base configuration for testing
 */
function createValidConfig(): FontConfig {
  return {
    fontPath: TEST_FONT,
    outputPath: TEST_OUTPUT,
    fontSize: 16,
    renderMode: RenderMode.BIT_4,
    bold: false,
    italic: false,
    rotation: Rotation.ROTATE_0,
    gamma: 1.0,
    indexMethod: IndexMethod.ADDRESS,
    crop: false,
    characterSets: [{ type: 'file', value: TEST_CHARSET }],
    outputFormat: 'bitmap'
  };
}

describe('Configuration Validation', () => {
  // Setup: Create temporary test files
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

  // Teardown: Clean up temporary files
  afterAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Required Fields Validation (Requirements 1.2)', () => {
    it('should reject config with empty fontPath', () => {
      const config = createValidConfig();
      config.fontPath = '';
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('fontPath');
      }
    });

    it('should reject config with empty outputPath', () => {
      const config = createValidConfig();
      config.outputPath = '';
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('outputPath');
      }
    });

    it('should reject config with empty characterSets', () => {
      const config = createValidConfig();
      config.characterSets = [];
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('characterSets');
      }
    });
  });

  describe('Value Range Validation (Requirements 1.3)', () => {
    it('should reject fontSize below minimum', () => {
      const config = createValidConfig();
      config.fontSize = 0;
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('fontSize');
      }
    });

    it('should reject fontSize above maximum', () => {
      const config = createValidConfig();
      config.fontSize = 300;
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('fontSize');
      }
    });

    it('should reject gamma below minimum', () => {
      const config = createValidConfig();
      config.gamma = 0.01;
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('gamma');
      }
    });

    it('should reject gamma above maximum', () => {
      const config = createValidConfig();
      config.gamma = 10.0;
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('gamma');
      }
    });

    it('should reject invalid renderMode for bitmap', () => {
      const config = createValidConfig();
      config.renderMode = 3 as RenderMode; // Invalid value
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('renderMode');
      }
    });

    it('should reject invalid rotation', () => {
      const config = createValidConfig();
      config.rotation = 5 as Rotation; // Invalid value
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('rotation');
      }
    });

    it('should reject invalid indexMethod', () => {
      const config = createValidConfig();
      config.indexMethod = 5 as IndexMethod; // Invalid value
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
        expect((error as FontConverterError).context?.fieldName).toBe('indexMethod');
      }
    });
  });

  describe('Parameter Conflict Detection (Requirements 8.4)', () => {
    it('should reject crop=true with indexMethod=OFFSET for bitmap', () => {
      const config = createValidConfig();
      config.crop = true;
      config.indexMethod = IndexMethod.OFFSET;
      config.outputFormat = 'bitmap';
      
      expect(() => ConfigManager.validateConfig(config)).toThrow(FontConverterError);
      try {
        ConfigManager.validateConfig(config);
      } catch (error) {
        expect(error).toBeInstanceOf(FontConverterError);
        expect((error as FontConverterError).code).toBe(ErrorCode.INDEX_METHOD_CONFLICT);
      }
    });

    it('should allow crop=true with indexMethod=ADDRESS for bitmap', () => {
      const config = createValidConfig();
      config.crop = true;
      config.indexMethod = IndexMethod.ADDRESS;
      config.outputFormat = 'bitmap';
      
      expect(() => ConfigManager.validateConfig(config)).not.toThrow();
    });

    it('should allow crop=false with indexMethod=OFFSET for bitmap', () => {
      const config = createValidConfig();
      config.crop = false;
      config.indexMethod = IndexMethod.OFFSET;
      config.outputFormat = 'bitmap';
      
      expect(() => ConfigManager.validateConfig(config)).not.toThrow();
    });
  });

  describe('Valid Configuration', () => {
    it('should accept valid configuration', () => {
      const config = createValidConfig();
      expect(() => ConfigManager.validateConfig(config)).not.toThrow();
    });

    it('should accept valid vector configuration', () => {
      const config = createValidConfig();
      config.outputFormat = 'vector';
      expect(() => ConfigManager.validateConfig(config)).not.toThrow();
    });

    it('should accept all valid render modes', () => {
      const validModes = [RenderMode.BIT_1, RenderMode.BIT_2, RenderMode.BIT_4, RenderMode.BIT_8];
      
      for (const mode of validModes) {
        const config = createValidConfig();
        config.renderMode = mode;
        expect(() => ConfigManager.validateConfig(config)).not.toThrow();
      }
    });

    it('should accept all valid rotations', () => {
      const validRotations = [Rotation.ROTATE_0, Rotation.ROTATE_90, Rotation.ROTATE_180, Rotation.ROTATE_270];
      
      for (const rotation of validRotations) {
        const config = createValidConfig();
        config.rotation = rotation;
        expect(() => ConfigManager.validateConfig(config)).not.toThrow();
      }
    });
  });
});
