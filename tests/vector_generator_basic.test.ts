/**
 * Basic unit tests for Vector Font Generator
 * 
 * These tests verify basic functionality without property-based testing
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VectorFontGenerator } from '../src/vector-generator';
import { FontConfig, IndexMethod, RenderMode, Rotation } from '../src/types';
import { CharsetProcessor } from '../src/charset-processor';

/**
 * Test font path
 */
const TEST_FONT_PATH = path.resolve(process.cwd(), '../font-tool-release/Font/NotoSans_Regular.ttf');

/**
 * Check if test font exists
 */
const testFontExists = fs.existsSync(TEST_FONT_PATH);

/**
 * Helper function to create a temporary character set file
 */
function createTempCharsetFile(characters: number[]): string {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `test-charset-${Date.now()}.cst`);
  CharsetProcessor.writeCSTFile(tempFile, characters);
  return tempFile;
}

/**
 * Helper function to clean up test files
 */
function cleanupTestFiles(outputPath: string, cstFile?: string): void {
  try {
    if (fs.existsSync(outputPath)) {
      const files = fs.readdirSync(outputPath);
      for (const file of files) {
        fs.unlinkSync(path.join(outputPath, file));
      }
      fs.rmdirSync(outputPath);
    }
    if (cstFile && fs.existsSync(cstFile)) {
      fs.unlinkSync(cstFile);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('VectorFontGenerator basic functionality', () => {
  const testCondition = testFontExists ? it : it.skip;
  
  testCondition('should create VectorFontGenerator instance', () => {
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-basic'),
      fontSize: 16,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [],
      outputFormat: 'vector'
    };
    
    const generator = new VectorFontGenerator(config);
    expect(generator).toBeDefined();
    expect(generator.getGlyphCount()).toBe(0);
    
    generator.cleanup();
  });
  
  testCondition('should generate vector font with simple characters', async () => {
    const characters = [0x0041, 0x0042, 0x0043]; // A, B, C
    const cstFile = createTempCharsetFile(characters);
    
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-abc'),
      fontSize: 24,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [{ type: 'file', value: cstFile }],
      outputFormat: 'vector'
    };
    
    const generator = new VectorFontGenerator(config);
    
    try {
      await generator.generate();
      
      // Verify output files exist
      const files = fs.readdirSync(config.outputPath);
      const binFile = files.find(f => f.endsWith('.bin'));
      const cstOutputFile = files.find(f => f.endsWith('.cst'));
      
      expect(binFile).toBeDefined();
      expect(cstOutputFile).toBeDefined();
      
      // Verify .bin file has reasonable size
      if (binFile) {
        const binPath = path.join(config.outputPath, binFile);
        const stats = fs.statSync(binPath);
        expect(stats.size).toBeGreaterThan(0);
        
        // Verify file flag is 2 (vector)
        const buffer = fs.readFileSync(binPath);
        const fileFlag = buffer.readUInt8(1);
        expect(fileFlag).toBe(2);
      }
      
      // Verify glyph count
      expect(generator.getGlyphCount()).toBeGreaterThan(0);
      expect(generator.getGlyphCount()).toBeLessThanOrEqual(characters.length);
      
    } finally {
      generator.cleanup();
      cleanupTestFiles(config.outputPath, cstFile);
    }
  }, 30000);
  
  testCondition('should generate correct output filename', () => {
    const config: FontConfig = {
      fontPath: TEST_FONT_PATH,
      outputPath: path.join(os.tmpdir(), 'font-converter-test-vector-filename'),
      fontSize: 16,
      renderMode: RenderMode.BIT_8,
      bold: false,
      italic: false,
      rotation: Rotation.ROTATE_0,
      gamma: 1.0,
      indexMethod: IndexMethod.ADDRESS,
      crop: false,
      characterSets: [],
      outputFormat: 'vector'
    };
    
    const generator = new VectorFontGenerator(config);
    const filename = generator.generateOutputFilename();
    
    // Filename should end with _vector.bin
    expect(filename).toMatch(/_vector\.bin$/);
    
    generator.cleanup();
  });
});
