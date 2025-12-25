/**
 * Property-Based Tests for Error Messages
 * 
 * Tests Property 23: 错误消息包含上下文信息
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 * 
 * Feature: typescript-font-converter, Property 23: 错误消息包含上下文信息
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  FontConverterError,
  ErrorCode,
  createConfigFileNotFoundError,
  createFontFileNotFoundError,
  createCharsetFileNotFoundError,
  createCharsetParseError,
  createConfigValidationError,
  createIndexMethodConflictError
} from '../src/errors';

describe('Feature: typescript-font-converter, Property 23: 错误消息包含上下文信息', () => {
  /**
   * Property 23: Error messages contain context information
   * For any error condition (missing files, parse failures, invalid parameters),
   * error messages should contain sufficient context information (file paths, line numbers,
   * parameter names, etc.) to help with debugging.
   */

  it('should include file path in config file not found errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        (filePath) => {
          const error = createConfigFileNotFoundError(filePath);
          
          // Error message should contain the file path
          expect(error.message).toContain(filePath);
          expect(error.context?.filePath).toBe(filePath);
          expect(error.code).toBe(ErrorCode.CONFIG_FILE_NOT_FOUND);
          
          // toString should also include context
          const errorString = error.toString();
          expect(errorString).toContain(filePath);
          expect(errorString).toContain('File:');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include file path in font file not found errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        (filePath) => {
          const error = createFontFileNotFoundError(filePath);
          
          // Error message should contain the file path
          expect(error.message).toContain(filePath);
          expect(error.context?.filePath).toBe(filePath);
          expect(error.code).toBe(ErrorCode.FONT_FILE_NOT_FOUND);
          
          // toString should include context
          const errorString = error.toString();
          expect(errorString).toContain(filePath);
          expect(errorString).toContain('File:');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include file path in charset file not found errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        (filePath) => {
          const error = createCharsetFileNotFoundError(filePath);
          
          // Error message should contain the file path
          expect(error.message).toContain(filePath);
          expect(error.context?.filePath).toBe(filePath);
          expect(error.code).toBe(ErrorCode.CHARSET_FILE_NOT_FOUND);
          
          // toString should include context
          const errorString = error.toString();
          expect(errorString).toContain(filePath);
          expect(errorString).toContain('File:');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include file path and line number in charset parse errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (filePath, lineNumber, errorMsg) => {
          const cause = new Error(errorMsg);
          const error = createCharsetParseError(filePath, lineNumber, cause);
          
          // Error message should contain the file path
          expect(error.message).toContain(filePath);
          expect(error.context?.filePath).toBe(filePath);
          expect(error.context?.lineNumber).toBe(lineNumber);
          expect(error.context?.cause).toBe(cause);
          expect(error.code).toBe(ErrorCode.CHARSET_PARSE_ERROR);
          
          // toString should include all context
          const errorString = error.toString();
          expect(errorString).toContain(filePath);
          expect(errorString).toContain('File:');
          expect(errorString).toContain('Line:');
          expect(errorString).toContain(lineNumber.toString());
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include field name, expected, and actual values in validation errors', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('\0')),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (fieldName, expected, actual) => {
          const error = createConfigValidationError(fieldName, expected, actual);
          
          // Error message should contain the field name
          expect(error.message).toContain(fieldName);
          expect(error.context?.fieldName).toBe(fieldName);
          expect(error.context?.expected).toBe(expected);
          expect(error.context?.actual).toBe(actual);
          expect(error.code).toBe(ErrorCode.CONFIG_VALIDATION_ERROR);
          
          // toString should include all context
          const errorString = error.toString();
          expect(errorString).toContain(fieldName);
          expect(errorString).toContain('Field:');
          expect(errorString).toContain('Expected:');
          expect(errorString).toContain('Actual:');
          expect(errorString).toContain(expected);
          expect(errorString).toContain(actual);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include explanation in index method conflict errors', () => {
    const error = createIndexMethodConflictError();
    
    // Error message should explain the conflict
    expect(error.message).toContain('Address Mode');
    expect(error.message).toContain('Crop');
    expect(error.code).toBe(ErrorCode.INDEX_METHOD_CONFLICT);
    expect(error.context?.details).toBeDefined();
    expect(error.context?.details).toContain('crop=true');
    expect(error.context?.details).toContain('indexMethod=1');
    
    // toString should include details
    const errorString = error.toString();
    expect(errorString).toContain('Details:');
  });

  it('should preserve error chain through cause field', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        fc.string({ minLength: 1, maxLength: 100 }),
        (filePath, originalError) => {
          const cause = new Error(originalError);
          const error = createCharsetParseError(filePath, undefined, cause);
          
          // Error should preserve the original error
          expect(error.context?.cause).toBe(cause);
          expect(error.context?.details).toBe(originalError);
          
          // toString should include cause
          const errorString = error.toString();
          expect(errorString).toContain('Caused by:');
          expect(errorString).toContain(originalError);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should format error as JSON with all context', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        (filePath) => {
          const error = createFontFileNotFoundError(filePath);
          const json = error.toJSON();
          
          // JSON should include all error information
          expect(json).toHaveProperty('name', 'FontConverterError');
          expect(json).toHaveProperty('code', ErrorCode.FONT_FILE_NOT_FOUND);
          expect(json).toHaveProperty('message');
          expect(json).toHaveProperty('context');
          expect(json).toHaveProperty('stack');
          
          // Context should be preserved
          const jsonObj = json as any;
          expect(jsonObj.context.filePath).toBe(filePath);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all relevant context fields when available', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes('\0')),
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 0xFFFF }),
        (filePath, lineNumber, fieldName, expected, actual, unicode) => {
          // Create an error with all possible context fields
          const error = new FontConverterError(
            ErrorCode.INTERNAL_ERROR,
            'Test error with all context',
            {
              filePath,
              lineNumber,
              fieldName,
              expected,
              actual,
              unicode,
              details: 'Additional details'
            }
          );
          
          const errorString = error.toString();
          
          // All context fields should be present in string representation
          expect(errorString).toContain(filePath);
          expect(errorString).toContain(lineNumber.toString());
          expect(errorString).toContain(fieldName);
          expect(errorString).toContain(expected);
          expect(errorString).toContain(actual);
          expect(errorString).toContain('U+');
          expect(errorString).toContain(unicode.toString(16).toUpperCase());
          expect(errorString).toContain('Additional details');
        }
      ),
      { numRuns: 100 }
    );
  });
});
