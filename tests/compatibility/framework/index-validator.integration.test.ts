/**
 * Integration Tests for Index Validator
 * 
 * Tests index validation against actual C++ reference outputs
 */

import * as fs from 'fs';
import * as path from 'path';
import { validateIndex, formatIndexValidationResult } from './index-validator';
import { parseHeaderFromFile } from './header-parser';

describe('Index Validator Integration Tests', () => {
  const cppRefDir = path.join(__dirname, '..', 'cpp_reference');
  
  // Helper to find .font files in a directory
  function findFontFile(dir: string): string | null {
    if (!fs.existsSync(dir)) {
      return null;
    }
    
    const files = fs.readdirSync(dir);
    const fontFile = files.find(f => f.endsWith('.font'));
    return fontFile ? path.join(dir, fontFile) : null;
  }
  
  // Helper to get expected characters (a-z)
  function getExpectedCharacters(): number[] {
    const chars: number[] = [];
    for (let i = 0x61; i <= 0x7A; i++) { // a-z
      chars.push(i);
    }
    return chars;
  }
  
  describe('Address Mode Validation', () => {
    it('should validate bmp_addr_r4 index structure', () => {
      const fontFile = findFontFile(path.join(cppRefDir, 'bmp_addr_r4'));
      
      if (!fontFile) {
        console.log('Skipping test: bmp_addr_r4 reference file not found');
        return;
      }
      
      const headerResult = parseHeaderFromFile(fontFile);
      expect(headerResult.success).toBe(true);
      expect(headerResult.header).toBeDefined();
      
      if (!headerResult.header) return;
      
      const expectedChars = getExpectedCharacters();
      const result = validateIndex(fontFile, headerResult.header, expectedChars);
      
      console.log('\n' + formatIndexValidationResult(result));
      
      expect(result.indexMethod).toBe(0); // ADDRESS mode
      expect(result.expectedEntries).toBe(65536);
      expect(result.actualEntries).toBe(65536);
      expect(result.validMappings).toBeGreaterThan(0);
      expect(result.unusedEntries).toBeLessThan(65536);
      
      // Should have mappings for a-z
      if (result.mappings) {
        for (const unicode of expectedChars) {
          expect(result.mappings.has(unicode)).toBe(true);
        }
      }
      
      if (result.errors.length > 0) {
        console.log('Validation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.log('Validation warnings:', result.warnings);
      }
    });
    
    it('should validate bmp_addr_r2 index structure', () => {
      const fontFile = findFontFile(path.join(cppRefDir, 'bmp_addr_r2'));
      
      if (!fontFile) {
        console.log('Skipping test: bmp_addr_r2 reference file not found');
        return;
      }
      
      const headerResult = parseHeaderFromFile(fontFile);
      expect(headerResult.success).toBe(true);
      expect(headerResult.header).toBeDefined();
      
      if (!headerResult.header) return;
      
      const expectedChars = getExpectedCharacters();
      const result = validateIndex(fontFile, headerResult.header, expectedChars);
      
      expect(result.indexMethod).toBe(0); // ADDRESS mode
      expect(result.expectedEntries).toBe(65536);
      expect(result.validMappings).toBeGreaterThan(0);
    });
  });
  
  describe('Offset Mode Validation', () => {
    it('should validate bmp_offset_r4 index structure', () => {
      const fontFile = findFontFile(path.join(cppRefDir, 'bmp_offset_r4'));
      
      if (!fontFile) {
        console.log('Skipping test: bmp_offset_r4 reference file not found');
        return;
      }
      
      const headerResult = parseHeaderFromFile(fontFile);
      expect(headerResult.success).toBe(true);
      expect(headerResult.header).toBeDefined();
      
      if (!headerResult.header) return;
      
      const expectedChars = getExpectedCharacters();
      const result = validateIndex(fontFile, headerResult.header, expectedChars);
      
      console.log('\n' + formatIndexValidationResult(result));
      
      expect(result.indexMethod).toBe(1); // OFFSET mode
      expect(result.expectedEntries).toBe(26); // a-z
      expect(result.actualEntries).toBe(26);
      expect(result.validMappings).toBe(26);
      expect(result.unusedEntries).toBe(0); // No unused entries in offset mode
      
      // Should have mappings for a-z
      if (result.mappings) {
        for (const unicode of expectedChars) {
          expect(result.mappings.has(unicode)).toBe(true);
        }
      }
      
      if (result.errors.length > 0) {
        console.log('Validation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.log('Validation warnings:', result.warnings);
      }
    });
    
    it('should validate bmp_offset_r2 index structure', () => {
      const fontFile = findFontFile(path.join(cppRefDir, 'bmp_offset_r2'));
      
      if (!fontFile) {
        console.log('Skipping test: bmp_offset_r2 reference file not found');
        return;
      }
      
      const headerResult = parseHeaderFromFile(fontFile);
      expect(headerResult.success).toBe(true);
      expect(headerResult.header).toBeDefined();
      
      if (!headerResult.header) return;
      
      const expectedChars = getExpectedCharacters();
      const result = validateIndex(fontFile, headerResult.header, expectedChars);
      
      expect(result.indexMethod).toBe(1); // OFFSET mode
      expect(result.expectedEntries).toBe(26); // a-z
      expect(result.validMappings).toBe(26);
      expect(result.unusedEntries).toBe(0);
    });
  });
  
  describe('Vector Font Validation', () => {
    it('should validate vec_addr index structure', () => {
      const fontFile = findFontFile(path.join(cppRefDir, 'vec_addr'));
      
      if (!fontFile) {
        console.log('Skipping test: vec_addr reference file not found');
        return;
      }
      
      const headerResult = parseHeaderFromFile(fontFile);
      expect(headerResult.success).toBe(true);
      expect(headerResult.header).toBeDefined();
      
      if (!headerResult.header) return;
      
      const expectedChars = getExpectedCharacters();
      const result = validateIndex(fontFile, headerResult.header, expectedChars);
      
      console.log('\n' + formatIndexValidationResult(result));
      
      expect(result.indexMethod).toBe(0); // ADDRESS mode
      expect(result.expectedEntries).toBe(65536);
      expect(result.validMappings).toBeGreaterThan(0);
    });
    
    it('should validate vec_offset index structure', () => {
      const fontFile = findFontFile(path.join(cppRefDir, 'vec_offset'));
      
      if (!fontFile) {
        console.log('Skipping test: vec_offset reference file not found');
        return;
      }
      
      const headerResult = parseHeaderFromFile(fontFile);
      expect(headerResult.success).toBe(true);
      expect(headerResult.header).toBeDefined();
      
      if (!headerResult.header) return;
      
      const expectedChars = getExpectedCharacters();
      const result = validateIndex(fontFile, headerResult.header, expectedChars);
      
      console.log('\n' + formatIndexValidationResult(result));
      
      expect(result.indexMethod).toBe(1); // OFFSET mode
      expect(result.expectedEntries).toBe(26); // a-z
      expect(result.validMappings).toBe(26);
      expect(result.unusedEntries).toBe(0);
    });
  });
});
