/**
 * Unit tests for INI settings parsing and merging
 * Feature: typescript-font-converter
 * 
 * Tests INI file parsing and configuration override functionality.
 * Validates: Requirements 1.4
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from '../src/config';
import {
  FontConfig,
  RenderMode,
  Rotation,
  IndexMethod
} from '../src/types';
import { ErrorCode, FontConverterError } from '../src/errors';

/**
 * Creates a valid base configuration for testing
 */
function createValidConfig(): FontConfig {
  return {
    fontPath: '/path/to/font.ttf',
    outputPath: '/path/to/output',
    fontSize: 16,
    renderMode: RenderMode.BIT_4,
    bold: false,
    italic: false,
    rotation: Rotation.ROTATE_0,
    gamma: 1.0,
    indexMethod: IndexMethod.ADDRESS,
    crop: false,
    characterSets: [{ type: 'file', value: 'charset.cst' }],
    outputFormat: 'bitmap'
  };
}

/**
 * Helper function to create a temporary INI file
 */
async function createTempINIFile(content: string): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'font-converter-ini-test-'));
  const iniPath = path.join(tempDir, 'setting.ini');
  await fs.promises.writeFile(iniPath, content, 'utf-8');
  return iniPath;
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

describe('INI Settings Parsing (Requirements 1.4)', () => {
  describe('loadINISettings', () => {
    it('should parse gamma from INI file', async () => {
      const iniContent = `[Settings]
gamma=1.5
`;
      const iniPath = await createTempINIFile(iniContent);
      
      try {
        const settings = await ConfigManager.loadINISettings(iniPath);
        expect(settings.gamma).toBe(1.5);
      } finally {
        await cleanupTempFile(iniPath);
      }
    });

    it('should parse rotation from INI file', async () => {
      const iniContent = `[Settings]
rotation=1
`;
      const iniPath = await createTempINIFile(iniContent);
      
      try {
        const settings = await ConfigManager.loadINISettings(iniPath);
        expect(settings.rotation).toBe(Rotation.ROTATE_90);
      } finally {
        await cleanupTempFile(iniPath);
      }
    });

    it('should parse both gamma and rotation from INI file', async () => {
      const iniContent = `[Settings]
gamma=2.0
rotation=3
`;
      const iniPath = await createTempINIFile(iniContent);
      
      try {
        const settings = await ConfigManager.loadINISettings(iniPath);
        expect(settings.gamma).toBe(2.0);
        expect(settings.rotation).toBe(Rotation.ROTATE_180);
      } finally {
        await cleanupTempFile(iniPath);
      }
    });

    it('should return empty settings for INI without Settings section', async () => {
      const iniContent = `[Other]
value=123
`;
      const iniPath = await createTempINIFile(iniContent);
      
      try {
        const settings = await ConfigManager.loadINISettings(iniPath);
        expect(settings.gamma).toBeUndefined();
        expect(settings.rotation).toBeUndefined();
      } finally {
        await cleanupTempFile(iniPath);
      }
    });

    it('should throw error for non-existent INI file', async () => {
      await expect(ConfigManager.loadINISettings('/non/existent/path.ini'))
        .rejects.toThrow(FontConverterError);
    });

    it('should handle INI file with only gamma', async () => {
      const iniContent = `[Settings]
gamma=0.8
`;
      const iniPath = await createTempINIFile(iniContent);
      
      try {
        const settings = await ConfigManager.loadINISettings(iniPath);
        expect(settings.gamma).toBe(0.8);
        expect(settings.rotation).toBeUndefined();
      } finally {
        await cleanupTempFile(iniPath);
      }
    });

    it('should handle INI file with only rotation', async () => {
      const iniContent = `[Settings]
rotation=2
`;
      const iniPath = await createTempINIFile(iniContent);
      
      try {
        const settings = await ConfigManager.loadINISettings(iniPath);
        expect(settings.gamma).toBeUndefined();
        expect(settings.rotation).toBe(Rotation.ROTATE_270);
      } finally {
        await cleanupTempFile(iniPath);
      }
    });
  });

  describe('mergeINISettings', () => {
    it('should override gamma from INI settings', () => {
      const config = createValidConfig();
      config.gamma = 1.0;
      
      const iniSettings = { gamma: 2.5 };
      const merged = ConfigManager.mergeINISettings(config, iniSettings);
      
      expect(merged.gamma).toBe(2.5);
      expect(merged.rotation).toBe(config.rotation); // Unchanged
    });

    it('should override rotation from INI settings', () => {
      const config = createValidConfig();
      config.rotation = Rotation.ROTATE_0;
      
      const iniSettings = { rotation: Rotation.ROTATE_90 };
      const merged = ConfigManager.mergeINISettings(config, iniSettings);
      
      expect(merged.rotation).toBe(Rotation.ROTATE_90);
      expect(merged.gamma).toBe(config.gamma); // Unchanged
    });

    it('should override both gamma and rotation from INI settings', () => {
      const config = createValidConfig();
      config.gamma = 1.0;
      config.rotation = Rotation.ROTATE_0;
      
      const iniSettings = { gamma: 1.8, rotation: Rotation.ROTATE_180 };
      const merged = ConfigManager.mergeINISettings(config, iniSettings);
      
      expect(merged.gamma).toBe(1.8);
      expect(merged.rotation).toBe(Rotation.ROTATE_180);
    });

    it('should preserve config values when INI settings are empty', () => {
      const config = createValidConfig();
      config.gamma = 1.5;
      config.rotation = Rotation.ROTATE_90;
      
      const iniSettings = {};
      const merged = ConfigManager.mergeINISettings(config, iniSettings);
      
      expect(merged.gamma).toBe(1.5);
      expect(merged.rotation).toBe(Rotation.ROTATE_90);
    });

    it('should not modify other config properties', () => {
      const config = createValidConfig();
      const iniSettings = { gamma: 2.0, rotation: Rotation.ROTATE_180 };
      const merged = ConfigManager.mergeINISettings(config, iniSettings);
      
      // Check that other properties are unchanged
      expect(merged.fontPath).toBe(config.fontPath);
      expect(merged.outputPath).toBe(config.outputPath);
      expect(merged.fontSize).toBe(config.fontSize);
      expect(merged.renderMode).toBe(config.renderMode);
      expect(merged.bold).toBe(config.bold);
      expect(merged.italic).toBe(config.italic);
      expect(merged.indexMethod).toBe(config.indexMethod);
      expect(merged.crop).toBe(config.crop);
      expect(merged.characterSets).toEqual(config.characterSets);
      expect(merged.outputFormat).toBe(config.outputFormat);
    });
  });
});
