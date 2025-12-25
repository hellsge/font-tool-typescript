/**
 * Unit tests for CLI argument parsing
 * 
 * Tests CLI parameter parsing, help/version flags, and configuration overrides
 */

import { CLIManager } from '../src/cli';
import { RenderMode, Rotation } from '../src/types';
import { VERSION } from '../src/constants';

describe('CLI Manager', () => {
  let cliManager: CLIManager;

  beforeEach(() => {
    cliManager = new CLIManager();
  });

  describe('Basic argument parsing', () => {
    it('should parse config path', () => {
      const args = cliManager.parse(['node', 'font-converter', 'config.json']);
      expect(args.configPath).toBe('config.json');
      expect(args.overrides).toEqual({});
    });

    it('should parse config path with absolute path', () => {
      const configPath = '/path/to/config.json';
      const args = cliManager.parse(['node', 'font-converter', configPath]);
      expect(args.configPath).toBe(configPath);
    });
  });

  describe('Size override', () => {
    it('should parse --size option', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--size',
        '24'
      ]);
      expect(args.overrides.size).toBe(24);
    });

    it('should parse -s option', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-s',
        '16'
      ]);
      expect(args.overrides.size).toBe(16);
    });

    it('should parse decimal font size', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--size',
        '12.5'
      ]);
      expect(args.overrides.size).toBe(12.5);
    });
  });

  describe('Bold override', () => {
    it('should parse --bold flag', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--bold'
      ]);
      expect(args.overrides.bold).toBe(true);
    });

    it('should parse -b flag', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-b'
      ]);
      expect(args.overrides.bold).toBe(true);
    });

    it('should parse --no-bold flag', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--no-bold'
      ]);
      expect(args.overrides.bold).toBe(false);
    });
  });

  describe('Italic override', () => {
    it('should parse --italic flag', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--italic'
      ]);
      expect(args.overrides.italic).toBe(true);
    });

    it('should parse -i flag', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-i'
      ]);
      expect(args.overrides.italic).toBe(true);
    });

    it('should parse --no-italic flag', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--no-italic'
      ]);
      expect(args.overrides.italic).toBe(false);
    });
  });

  describe('Render mode override', () => {
    it('should parse --render-mode 1', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--render-mode',
        '1'
      ]);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_1);
    });

    it('should parse --render-mode 2', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--render-mode',
        '2'
      ]);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_2);
    });

    it('should parse --render-mode 4', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--render-mode',
        '4'
      ]);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_4);
    });

    it('should parse --render-mode 8', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--render-mode',
        '8'
      ]);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_8);
    });

    it('should parse -m option', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-m',
        '4'
      ]);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_4);
    });

    it('should throw error for invalid render mode', () => {
      expect(() => {
        cliManager.parse([
          'node',
          'font-converter',
          'config.json',
          '--render-mode',
          '3'
        ]);
      }).toThrow('Invalid render mode: 3');
    });
  });

  describe('Output path override', () => {
    it('should parse --output option', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--output',
        './custom-output'
      ]);
      expect(args.overrides.outputPath).toBe('./custom-output');
    });

    it('should parse -o option', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-o',
        '/absolute/path'
      ]);
      expect(args.overrides.outputPath).toBe('/absolute/path');
    });
  });

  describe('Rotation override', () => {
    it('should parse --rotation 0', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--rotation',
        '0'
      ]);
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_0);
    });

    it('should parse --rotation 1', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--rotation',
        '1'
      ]);
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_90);
    });

    it('should parse --rotation 2', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--rotation',
        '2'
      ]);
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_270);
    });

    it('should parse --rotation 3', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--rotation',
        '3'
      ]);
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_180);
    });

    it('should parse -r option', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-r',
        '1'
      ]);
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_90);
    });

    it('should throw error for invalid rotation', () => {
      expect(() => {
        cliManager.parse([
          'node',
          'font-converter',
          'config.json',
          '--rotation',
          '4'
        ]);
      }).toThrow('Invalid rotation: 4');
    });
  });

  describe('Multiple overrides', () => {
    it('should parse multiple options together', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '--size',
        '20',
        '--bold',
        '--italic',
        '--render-mode',
        '8',
        '--output',
        './output',
        '--rotation',
        '1'
      ]);

      expect(args.configPath).toBe('config.json');
      expect(args.overrides.size).toBe(20);
      expect(args.overrides.bold).toBe(true);
      expect(args.overrides.italic).toBe(true);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_8);
      expect(args.overrides.outputPath).toBe('./output');
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_90);
    });

    it('should parse mixed short and long options', () => {
      const args = cliManager.parse([
        'node',
        'font-converter',
        'config.json',
        '-s',
        '18',
        '-b',
        '-i',
        '-m',
        '4',
        '-o',
        './out',
        '-r',
        '0'
      ]);

      expect(args.overrides.size).toBe(18);
      expect(args.overrides.bold).toBe(true);
      expect(args.overrides.italic).toBe(true);
      expect(args.overrides.renderMode).toBe(RenderMode.BIT_4);
      expect(args.overrides.outputPath).toBe('./out');
      expect(args.overrides.rotation).toBe(Rotation.ROTATE_0);
    });
  });

  describe('Help and version', () => {
    it('should have help option configured', () => {
      // We can't easily test the actual help output without mocking console
      // but we can verify the method exists
      expect(cliManager.showHelp).toBeDefined();
      expect(typeof cliManager.showHelp).toBe('function');
    });

    it('should have version method', () => {
      expect(cliManager.showVersion).toBeDefined();
      expect(typeof cliManager.showVersion).toBe('function');
    });

    it('should display correct version', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      cliManager.showVersion();
      expect(consoleSpy).toHaveBeenCalledWith(VERSION.STRING);
      consoleSpy.mockRestore();
    });
  });

  describe('Apply overrides', () => {
    const baseConfig = {
      fontPath: '/path/to/font.ttf',
      outputPath: './output',
      fontSize: 16,
      renderMode: RenderMode.BIT_4,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: 0,
      crop: false,
      characterSets: [],
      outputFormat: 'bitmap' as const
    };

    it('should override fontSize', () => {
      const result = CLIManager.applyOverrides(baseConfig, { size: 24 });
      expect(result.fontSize).toBe(24);
      expect(result.fontPath).toBe(baseConfig.fontPath);
    });

    it('should override bold', () => {
      const result = CLIManager.applyOverrides(baseConfig, { bold: true });
      expect(result.bold).toBe(true);
    });

    it('should override italic', () => {
      const result = CLIManager.applyOverrides(baseConfig, { italic: true });
      expect(result.italic).toBe(true);
    });

    it('should override renderMode', () => {
      const result = CLIManager.applyOverrides(baseConfig, {
        renderMode: RenderMode.BIT_8
      });
      expect(result.renderMode).toBe(RenderMode.BIT_8);
    });

    it('should override outputPath', () => {
      const result = CLIManager.applyOverrides(baseConfig, {
        outputPath: './custom'
      });
      expect(result.outputPath).toBe('./custom');
    });

    it('should override rotation', () => {
      const result = CLIManager.applyOverrides(baseConfig, {
        rotation: Rotation.ROTATE_90
      });
      expect(result.rotation).toBe(Rotation.ROTATE_90);
    });

    it('should override multiple properties', () => {
      const result = CLIManager.applyOverrides(baseConfig, {
        size: 20,
        bold: true,
        italic: true,
        renderMode: RenderMode.BIT_2,
        outputPath: './new-output',
        rotation: Rotation.ROTATE_180
      });

      expect(result.fontSize).toBe(20);
      expect(result.bold).toBe(true);
      expect(result.italic).toBe(true);
      expect(result.renderMode).toBe(RenderMode.BIT_2);
      expect(result.outputPath).toBe('./new-output');
      expect(result.rotation).toBe(Rotation.ROTATE_180);
    });

    it('should not override properties when overrides are empty', () => {
      const result = CLIManager.applyOverrides(baseConfig, {});
      expect(result).toEqual(baseConfig);
    });

    it('should preserve non-overridden properties', () => {
      const result = CLIManager.applyOverrides(baseConfig, { size: 24 });
      expect(result.bold).toBe(baseConfig.bold);
      expect(result.italic).toBe(baseConfig.italic);
      expect(result.renderMode).toBe(baseConfig.renderMode);
      expect(result.outputPath).toBe(baseConfig.outputPath);
      expect(result.rotation).toBe(baseConfig.rotation);
      expect(result.gamma).toBe(baseConfig.gamma);
      expect(result.indexMethod).toBe(baseConfig.indexMethod);
      expect(result.crop).toBe(baseConfig.crop);
    });
  });
});

