/**
 * Property-based tests for CLI overrides
 * 
 * Feature: typescript-font-converter, Property 20: CLI 参数覆盖配置文件
 * Validates: Requirements 7.2, 7.3
 */

import * as fc from 'fast-check';
import { CLIManager } from '../src/cli';
import { RenderMode, Rotation, IndexMethod, FontConfig } from '../src/types';

describe('Feature: typescript-font-converter, Property 20: CLI 参数覆盖配置文件', () => {
  /**
   * Arbitrary for RenderMode
   */
  const renderModeArbitrary = fc.constantFrom(
    RenderMode.BIT_1,
    RenderMode.BIT_2,
    RenderMode.BIT_4,
    RenderMode.BIT_8
  );

  /**
   * Arbitrary for Rotation
   */
  const rotationArbitrary = fc.constantFrom(
    Rotation.ROTATE_0,
    Rotation.ROTATE_90,
    Rotation.ROTATE_180,
    Rotation.ROTATE_270
  );

  /**
   * Arbitrary for FontConfig
   */
  const fontConfigArbitrary = fc.record({
    fontPath: fc.string({ minLength: 1 }),
    outputPath: fc.string({ minLength: 1 }),
    fontSize: fc.integer({ min: 1, max: 255 }),
    renderMode: renderModeArbitrary,
    bold: fc.boolean(),
    italic: fc.boolean(),
    rotation: rotationArbitrary,
    gamma: fc.float({ min: Math.fround(0.1), max: Math.fround(5.0) }),
    indexMethod: fc.constantFrom(IndexMethod.ADDRESS, IndexMethod.OFFSET),
    crop: fc.boolean(),
    characterSets: fc.constant([]),
    outputFormat: fc.constantFrom('bitmap' as const, 'vector' as const)
  });

  /**
   * Arbitrary for CLI overrides
   */
  const cliOverridesArbitrary = fc.record({
    size: fc.option(fc.integer({ min: 1, max: 255 }), { nil: undefined }),
    bold: fc.option(fc.boolean(), { nil: undefined }),
    italic: fc.option(fc.boolean(), { nil: undefined }),
    renderMode: fc.option(renderModeArbitrary, { nil: undefined }),
    outputPath: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
    rotation: fc.option(rotationArbitrary, { nil: undefined })
  });

  it('should override fontSize when size is provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        fc.integer({ min: 1, max: 255 }),
        (config, newSize) => {
          const result = CLIManager.applyOverrides(config, { size: newSize });
          expect(result.fontSize).toBe(newSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should override bold when bold is provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        fc.boolean(),
        (config, newBold) => {
          const result = CLIManager.applyOverrides(config, { bold: newBold });
          expect(result.bold).toBe(newBold);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should override italic when italic is provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        fc.boolean(),
        (config, newItalic) => {
          const result = CLIManager.applyOverrides(config, { italic: newItalic });
          expect(result.italic).toBe(newItalic);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should override renderMode when renderMode is provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        renderModeArbitrary,
        (config, newRenderMode) => {
          const result = CLIManager.applyOverrides(config, { renderMode: newRenderMode });
          expect(result.renderMode).toBe(newRenderMode);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should override outputPath when outputPath is provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        fc.string({ minLength: 1 }),
        (config, newOutputPath) => {
          const result = CLIManager.applyOverrides(config, { outputPath: newOutputPath });
          expect(result.outputPath).toBe(newOutputPath);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should override rotation when rotation is provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        rotationArbitrary,
        (config, newRotation) => {
          const result = CLIManager.applyOverrides(config, { rotation: newRotation });
          expect(result.rotation).toBe(newRotation);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve original values when no overrides are provided', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        (config) => {
          const result = CLIManager.applyOverrides(config, {});
          expect(result).toEqual(config);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only override specified properties', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        cliOverridesArbitrary,
        (config, overrides) => {
          const result = CLIManager.applyOverrides(config, overrides);

          // Check that overridden properties match
          if (overrides.size !== undefined) {
            expect(result.fontSize).toBe(overrides.size);
          } else {
            expect(result.fontSize).toBe(config.fontSize);
          }

          if (overrides.bold !== undefined) {
            expect(result.bold).toBe(overrides.bold);
          } else {
            expect(result.bold).toBe(config.bold);
          }

          if (overrides.italic !== undefined) {
            expect(result.italic).toBe(overrides.italic);
          } else {
            expect(result.italic).toBe(config.italic);
          }

          if (overrides.renderMode !== undefined) {
            expect(result.renderMode).toBe(overrides.renderMode);
          } else {
            expect(result.renderMode).toBe(config.renderMode);
          }

          if (overrides.outputPath !== undefined) {
            expect(result.outputPath).toBe(overrides.outputPath);
          } else {
            expect(result.outputPath).toBe(config.outputPath);
          }

          if (overrides.rotation !== undefined) {
            expect(result.rotation).toBe(overrides.rotation);
          } else {
            expect(result.rotation).toBe(config.rotation);
          }

          // Check that non-overridable properties are preserved
          expect(result.fontPath).toBe(config.fontPath);
          expect(result.gamma).toBe(config.gamma);
          expect(result.indexMethod).toBe(config.indexMethod);
          expect(result.crop).toBe(config.crop);
          expect(result.characterSets).toBe(config.characterSets);
          expect(result.outputFormat).toBe(config.outputFormat);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple simultaneous overrides correctly', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        fc.integer({ min: 1, max: 255 }),
        fc.boolean(),
        fc.boolean(),
        renderModeArbitrary,
        fc.string({ minLength: 1 }),
        rotationArbitrary,
        (config, size, bold, italic, renderMode, outputPath, rotation) => {
          const overrides = {
            size,
            bold,
            italic,
            renderMode,
            outputPath,
            rotation
          };

          const result = CLIManager.applyOverrides(config, overrides);

          expect(result.fontSize).toBe(size);
          expect(result.bold).toBe(bold);
          expect(result.italic).toBe(italic);
          expect(result.renderMode).toBe(renderMode);
          expect(result.outputPath).toBe(outputPath);
          expect(result.rotation).toBe(rotation);

          // Non-overridden properties should be preserved
          expect(result.fontPath).toBe(config.fontPath);
          expect(result.gamma).toBe(config.gamma);
          expect(result.indexMethod).toBe(config.indexMethod);
          expect(result.crop).toBe(config.crop);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent - applying same overrides twice gives same result', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        cliOverridesArbitrary,
        (config, overrides) => {
          const result1 = CLIManager.applyOverrides(config, overrides);
          const result2 = CLIManager.applyOverrides(result1, overrides);
          expect(result2).toEqual(result1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve config structure after applying overrides', () => {
    fc.assert(
      fc.property(
        fontConfigArbitrary,
        cliOverridesArbitrary,
        (config, overrides) => {
          const result = CLIManager.applyOverrides(config, overrides);

          // Check that result has all required properties
          expect(result).toHaveProperty('fontPath');
          expect(result).toHaveProperty('outputPath');
          expect(result).toHaveProperty('fontSize');
          expect(result).toHaveProperty('renderMode');
          expect(result).toHaveProperty('bold');
          expect(result).toHaveProperty('italic');
          expect(result).toHaveProperty('rotation');
          expect(result).toHaveProperty('gamma');
          expect(result).toHaveProperty('indexMethod');
          expect(result).toHaveProperty('crop');
          expect(result).toHaveProperty('characterSets');
          expect(result).toHaveProperty('outputFormat');

          // Check that types are correct
          expect(typeof result.fontPath).toBe('string');
          expect(typeof result.outputPath).toBe('string');
          expect(typeof result.fontSize).toBe('number');
          expect(typeof result.renderMode).toBe('number');
          expect(typeof result.bold).toBe('boolean');
          expect(typeof result.italic).toBe('boolean');
          expect(typeof result.rotation).toBe('number');
          expect(typeof result.gamma).toBe('number');
          expect(typeof result.indexMethod).toBe('number');
          expect(typeof result.crop).toBe('boolean');
          expect(Array.isArray(result.characterSets)).toBe(true);
          expect(['bitmap', 'vector']).toContain(result.outputFormat);
        }
      ),
      { numRuns: 100 }
    );
  });
});

