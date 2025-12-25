/**
 * Property-based tests for Character Set Processor
 * Feature: typescript-font-converter
 *
 * These tests validate that character set operations maintain correctness
 * properties across all valid inputs using fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CharsetProcessor } from '../src/charset-processor';
import { CharacterSetSource } from '../src/types';
import { FontConverterError, ErrorCode } from '../src/errors';
import { BINARY_FORMAT } from '../src/constants';

/**
 * Helper function to create a temporary directory
 */
async function createTempDir(): Promise<string> {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), 'charset-test-'));
}

/**
 * Helper function to clean up temporary directory
 */
async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      await fs.promises.unlink(path.join(dirPath, file));
    }
    await fs.promises.rmdir(dirPath);
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Arbitrary generator for valid Unicode values (uint16 range)
 */
const unicodeArbitrary = (): fc.Arbitrary<number> => {
  return fc.integer({ min: 0, max: BINARY_FORMAT.MAX_UNICODE });
};

/**
 * Arbitrary generator for arrays of Unicode values
 */
const unicodeArrayArbitrary = (): fc.Arbitrary<number[]> => {
  return fc.array(unicodeArbitrary(), { minLength: 1, maxLength: 1000 });
};

describe('Feature: typescript-font-converter, Property 11: Character Set Round-Trip', () => {
  /**
   * Property 11: Character Set Round-Trip
   * For any Unicode character set, writing to a .cst file and reading back
   * should produce the same character set (order preserved).
   *
   * Validates: Requirements 4.1, 4.7
   */
  it('should preserve character set through .cst file write and read', async () => {
    await fc.assert(
      fc.asyncProperty(unicodeArrayArbitrary(), async (unicodes) => {
        let tempDir: string | null = null;

        try {
          tempDir = await createTempDir();
          const cstPath = path.join(tempDir, 'test.cst');

          // Write the character set to file
          CharsetProcessor.writeCSTFile(cstPath, unicodes);

          // Read it back
          const readUnicodes = CharsetProcessor.parseCSTFile(cstPath);

          // The read values should match the written values exactly
          // (order preserved, values clamped to valid range)
          const expectedUnicodes = unicodes.map((u) =>
            Math.min(Math.max(0, Math.floor(u)), BINARY_FORMAT.MAX_UNICODE)
          );

          expect(readUnicodes.length).toBe(expectedUnicodes.length);
          for (let i = 0; i < expectedUnicodes.length; i++) {
            expect(readUnicodes[i]).toBe(expectedUnicodes[i]);
          }

          return true;
        } finally {
          if (tempDir) {
            await cleanupTempDir(tempDir);
          }
        }
      }),
      { numRuns: 100 }
    );
  }, 60000);

  /**
   * Property: Empty array should round-trip correctly
   */
  it('should handle empty character set', async () => {
    let tempDir: string | null = null;

    try {
      tempDir = await createTempDir();
      const cstPath = path.join(tempDir, 'empty.cst');

      // Write empty array
      CharsetProcessor.writeCSTFile(cstPath, []);

      // Read it back
      const readUnicodes = CharsetProcessor.parseCSTFile(cstPath);

      expect(readUnicodes).toEqual([]);
    } finally {
      if (tempDir) {
        await cleanupTempDir(tempDir);
      }
    }
  });

  /**
   * Property: File size should be exactly 2 * number of characters
   */
  it('should create file with correct size', async () => {
    await fc.assert(
      fc.asyncProperty(unicodeArrayArbitrary(), async (unicodes) => {
        let tempDir: string | null = null;

        try {
          tempDir = await createTempDir();
          const cstPath = path.join(tempDir, 'test.cst');

          CharsetProcessor.writeCSTFile(cstPath, unicodes);

          const stats = await fs.promises.stat(cstPath);
          expect(stats.size).toBe(unicodes.length * 2);

          return true;
        } finally {
          if (tempDir) {
            await cleanupTempDir(tempDir);
          }
        }
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

describe('Feature: typescript-font-converter, Property 12: 字符源合并和去重', () => {
  /**
   * Property 12: Character Source Merge and Deduplication
   * For any multiple character sources (file, range, string),
   * the final character set should contain the union of all sources
   * without duplicates.
   *
   * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6
   */

  /**
   * Arbitrary generator for valid Unicode range strings
   */
  const unicodeRangeArbitrary = (): fc.Arbitrary<string> => {
    return fc
      .tuple(
        fc.integer({ min: 0, max: 0xfffe }),
        fc.integer({ min: 1, max: 100 })
      )
      .map(([start, length]) => {
        const end = Math.min(start + length, BINARY_FORMAT.MAX_UNICODE);
        return `0x${start.toString(16).toUpperCase().padStart(4, '0')}-0x${end.toString(16).toUpperCase().padStart(4, '0')}`;
      });
  };

  /**
   * Arbitrary generator for string character sources
   */
  const stringSourceArbitrary = (): fc.Arbitrary<string> => {
    return fc.string({ minLength: 1, maxLength: 100 });
  };

  it('should merge range sources without duplicates', () => {
    fc.assert(
      fc.property(
        fc.array(unicodeRangeArbitrary(), { minLength: 1, maxLength: 5 }),
        (ranges) => {
          const sources: CharacterSetSource[] = ranges.map((r) => ({
            type: 'range' as const,
            value: r
          }));

          const result = CharsetProcessor.mergeCharacterSources(sources);

          // Result should be sorted
          for (let i = 1; i < result.length; i++) {
            expect(result[i]).toBeGreaterThan(result[i - 1]);
          }

          // Result should have no duplicates
          const uniqueSet = new Set(result);
          expect(uniqueSet.size).toBe(result.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should merge string sources without duplicates', () => {
    fc.assert(
      fc.property(
        fc.array(stringSourceArbitrary(), { minLength: 1, maxLength: 5 }),
        (strings) => {
          const sources: CharacterSetSource[] = strings.map((s) => ({
            type: 'string' as const,
            value: s
          }));

          const result = CharsetProcessor.mergeCharacterSources(sources);

          // Result should be sorted
          for (let i = 1; i < result.length; i++) {
            expect(result[i]).toBeGreaterThan(result[i - 1]);
          }

          // Result should have no duplicates
          const uniqueSet = new Set(result);
          expect(uniqueSet.size).toBe(result.length);

          // All characters from all strings should be in result
          for (const str of strings) {
            for (const char of str) {
              const codePoint = char.codePointAt(0);
              if (
                codePoint !== undefined &&
                codePoint <= BINARY_FORMAT.MAX_UNICODE
              ) {
                expect(result).toContain(codePoint);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should merge mixed sources (range + string) without duplicates', () => {
    fc.assert(
      fc.property(
        unicodeRangeArbitrary(),
        stringSourceArbitrary(),
        (range, str) => {
          const sources: CharacterSetSource[] = [
            { type: 'range' as const, value: range },
            { type: 'string' as const, value: str }
          ];

          const result = CharsetProcessor.mergeCharacterSources(sources);

          // Result should be sorted
          for (let i = 1; i < result.length; i++) {
            expect(result[i]).toBeGreaterThan(result[i - 1]);
          }

          // Result should have no duplicates
          const uniqueSet = new Set(result);
          expect(uniqueSet.size).toBe(result.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle file sources with round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(unicodeArrayArbitrary(), { minLength: 1, maxLength: 3 }),
        async (unicodeArrays) => {
          let tempDir: string | null = null;

          try {
            tempDir = await createTempDir();

            // Create multiple .cst files
            const sources: CharacterSetSource[] = [];
            const allExpectedUnicodes = new Set<number>();

            for (let i = 0; i < unicodeArrays.length; i++) {
              const cstPath = path.join(tempDir, `test${i}.cst`);
              CharsetProcessor.writeCSTFile(cstPath, unicodeArrays[i]);

              sources.push({
                type: 'file' as const,
                value: cstPath
              });

              // Track expected unicodes
              for (const u of unicodeArrays[i]) {
                const clamped = Math.min(
                  Math.max(0, Math.floor(u)),
                  BINARY_FORMAT.MAX_UNICODE
                );
                allExpectedUnicodes.add(clamped);
              }
            }

            // Merge all sources
            const result = CharsetProcessor.mergeCharacterSources(sources);

            // Result should be sorted
            for (let i = 1; i < result.length; i++) {
              expect(result[i]).toBeGreaterThan(result[i - 1]);
            }

            // Result should have no duplicates
            const uniqueSet = new Set(result);
            expect(uniqueSet.size).toBe(result.length);

            // Result should contain all expected unicodes
            expect(result.length).toBe(allExpectedUnicodes.size);
            for (const u of allExpectedUnicodes) {
              expect(result).toContain(u);
            }

            return true;
          } finally {
            if (tempDir) {
              await cleanupTempDir(tempDir);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  }, 120000);
});

describe('Unicode Range Parsing', () => {
  /**
   * Property: Valid range strings should parse correctly
   */
  it('should parse valid range strings', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 0xfffe }),
          fc.integer({ min: 1, max: 100 })
        ),
        ([start, length]) => {
          const end = Math.min(start + length, BINARY_FORMAT.MAX_UNICODE);
          const rangeStr = `0x${start.toString(16).padStart(4, '0')}-0x${end.toString(16).padStart(4, '0')}`;

          const result = CharsetProcessor.parseUnicodeRange(rangeStr);

          // Should contain all values in range
          expect(result.length).toBe(end - start + 1);
          expect(result[0]).toBe(start);
          expect(result[result.length - 1]).toBe(end);

          // Should be in order
          for (let i = 0; i < result.length; i++) {
            expect(result[i]).toBe(start + i);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Invalid range strings should throw errors
   */
  it('should reject invalid range strings', () => {
    const invalidRanges = [
      'invalid',
      '0x0020',
      '0x007F-0x0020', // end < start
      '0xFFFF-0x10000', // out of range
      '-0x007F',
      '0x0020-'
    ];

    for (const range of invalidRanges) {
      expect(() => CharsetProcessor.parseUnicodeRange(range)).toThrow(
        FontConverterError
      );
    }
  });
});

describe('String Character Extraction', () => {
  /**
   * Property: All characters in string should be extracted
   */
  it('should extract all unique characters from string', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (str) => {
        const result = CharsetProcessor.extractStringCharacters(str);

        // Result should have no duplicates
        const uniqueSet = new Set(result);
        expect(uniqueSet.size).toBe(result.length);

        // All characters from string should be in result
        for (const char of str) {
          const codePoint = char.codePointAt(0);
          if (
            codePoint !== undefined &&
            codePoint <= BINARY_FORMAT.MAX_UNICODE
          ) {
            expect(result).toContain(codePoint);
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty string should return empty array
   */
  it('should return empty array for empty string', () => {
    const result = CharsetProcessor.extractStringCharacters('');
    expect(result).toEqual([]);
  });
});

describe('Deduplication and Sorting', () => {
  /**
   * Property: Deduplication should remove all duplicates and sort
   */
  it('should deduplicate and sort arrays', () => {
    fc.assert(
      fc.property(unicodeArrayArbitrary(), (unicodes) => {
        const result = CharsetProcessor.deduplicateAndSort(unicodes);

        // Result should be sorted
        for (let i = 1; i < result.length; i++) {
          expect(result[i]).toBeGreaterThan(result[i - 1]);
        }

        // Result should have no duplicates
        const uniqueSet = new Set(result);
        expect(uniqueSet.size).toBe(result.length);

        // All unique values from input should be in result
        const inputSet = new Set(unicodes);
        expect(result.length).toBe(inputSet.size);
        for (const u of inputSet) {
          expect(result).toContain(u);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
