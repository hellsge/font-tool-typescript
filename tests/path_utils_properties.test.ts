/**
 * Property-based tests for cross-platform path handling
 * 
 * Feature: typescript-font-converter, Property 4: 路径处理跨平台一致
 * Validates: Requirements 1.5, 10.2
 */

import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PathUtils } from '../src/path-utils';

describe('Feature: typescript-font-converter, Property 4: 路径处理跨平台一致', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'path-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(tempDir);
    }
  });

  it('should normalize paths consistently across platforms', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        (segments) => {
          // Join segments with different separators
          const unixPath = segments.join('/');
          const windowsPath = segments.join('\\');
          const mixedPath = segments.join(Math.random() > 0.5 ? '/' : '\\');

          // All should normalize to the same result
          const normalizedUnix = PathUtils.normalize(unixPath);
          const normalizedWindows = PathUtils.normalize(windowsPath);
          const normalizedMixed = PathUtils.normalize(mixedPath);

          // Convert to Unix style for comparison (platform-independent)
          const unixStyleUnix = PathUtils.toUnixStyle(normalizedUnix);
          const unixStyleWindows = PathUtils.toUnixStyle(normalizedWindows);
          const unixStyleMixed = PathUtils.toUnixStyle(normalizedMixed);

          expect(unixStyleUnix).toBe(unixStyleWindows);
          expect(unixStyleUnix).toBe(unixStyleMixed);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should join path segments consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        (segments) => {
          // Join using PathUtils
          const joined = PathUtils.join(...segments);

          // Join using native path module
          const nativeJoined = path.join(...segments);

          // Should produce the same result
          expect(joined).toBe(nativeJoined);

          // Should not contain mixed separators
          const hasForwardSlash = joined.includes('/');
          const hasBackslash = joined.includes('\\');
          
          // On Windows, should use backslash; on Unix, should use forward slash
          if (path.sep === '\\') {
            expect(hasBackslash || segments.length === 1).toBe(true);
          } else {
            expect(hasForwardSlash || segments.length === 1).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should resolve relative paths consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        (baseName, relativeName) => {
          const basePath = path.join(tempDir, baseName);
          const relativePath = relativeName;

          // Resolve using PathUtils
          const resolved = PathUtils.resolveRelative(basePath, relativePath);

          // Resolve using native path module
          const nativeResolved = path.resolve(basePath, relativePath);

          // Should produce the same result
          expect(resolved).toBe(nativeResolved);

          // Should be an absolute path
          expect(PathUtils.isAbsolute(resolved)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle absolute paths correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        (fileName) => {
          // Create an absolute path
          const absolutePath = path.join(tempDir, fileName);

          // resolveRelative should return the absolute path unchanged
          const resolved = PathUtils.resolveRelative('/some/base', absolutePath);

          expect(resolved).toBe(absolutePath);
          expect(PathUtils.isAbsolute(resolved)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify absolute vs relative paths', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ),
        (segments) => {
          // Create relative path
          const relativePath = segments.join(path.sep);
          expect(PathUtils.isAbsolute(relativePath)).toBe(false);

          // Create absolute path
          const absolutePath = path.resolve(tempDir, ...segments);
          expect(PathUtils.isAbsolute(absolutePath)).toBe(true);

          // Native path module should agree
          expect(PathUtils.isAbsolute(relativePath)).toBe(path.isAbsolute(relativePath));
          expect(PathUtils.isAbsolute(absolutePath)).toBe(path.isAbsolute(absolutePath));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should extract directory name consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 2, maxLength: 5 }
        ),
        (segments) => {
          const filePath = path.join(...segments);

          // Extract dirname using PathUtils
          const dirname = PathUtils.dirname(filePath);

          // Extract using native path module
          const nativeDirname = path.dirname(filePath);

          // Should produce the same result
          expect(dirname).toBe(nativeDirname);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should extract basename consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        fc.oneof(fc.constant('.txt'), fc.constant('.bin'), fc.constant('.cst')),
        (segments, ext) => {
          const fileName = segments[segments.length - 1] + ext;
          const filePath = segments.length > 1
            ? path.join(...segments.slice(0, -1), fileName)
            : fileName;

          // Extract basename using PathUtils
          const basename = PathUtils.basename(filePath);
          const basenameNoExt = PathUtils.basename(filePath, ext);

          // Extract using native path module
          const nativeBasename = path.basename(filePath);
          const nativeBasenameNoExt = path.basename(filePath, ext);

          // Should produce the same result
          expect(basename).toBe(nativeBasename);
          expect(basenameNoExt).toBe(nativeBasenameNoExt);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should convert between Unix and platform styles consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 5 }
        ),
        (segments) => {
          // Create a path with platform separator
          const platformPath = path.join(...segments);

          // Convert to Unix style
          const unixStyle = PathUtils.toUnixStyle(platformPath);

          // Unix style should only have forward slashes
          expect(unixStyle.includes('\\')).toBe(false);
          if (segments.length > 1) {
            expect(unixStyle.includes('/')).toBe(true);
          }

          // Convert back to platform style
          const backToPlatform = PathUtils.toPlatformStyle(unixStyle);

          // Should match the original (after normalization)
          expect(PathUtils.normalize(backToPlatform)).toBe(PathUtils.normalize(platformPath));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle file existence checks consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        (fileName) => {
          const filePath = path.join(tempDir, fileName);

          // File doesn't exist yet
          expect(PathUtils.exists(filePath)).toBe(false);
          expect(PathUtils.isFile(filePath)).toBe(false);
          expect(PathUtils.isDirectory(filePath)).toBe(false);

          // Create file
          fs.writeFileSync(filePath, 'test');

          // Now it should exist
          expect(PathUtils.exists(filePath)).toBe(true);
          expect(PathUtils.isFile(filePath)).toBe(true);
          expect(PathUtils.isDirectory(filePath)).toBe(false);

          // Clean up
          fs.unlinkSync(filePath);
        }
      ),
      { numRuns: 50 } // Fewer runs for file I/O tests
    );
  });

  it('should handle directory existence checks consistently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        (dirName) => {
          const dirPath = path.join(tempDir, dirName);

          // Directory doesn't exist yet
          expect(PathUtils.exists(dirPath)).toBe(false);
          expect(PathUtils.isDirectory(dirPath)).toBe(false);

          // Create directory
          fs.mkdirSync(dirPath);

          // Now it should exist
          expect(PathUtils.exists(dirPath)).toBe(true);
          expect(PathUtils.isDirectory(dirPath)).toBe(true);
          expect(PathUtils.isFile(dirPath)).toBe(false);

          // Clean up
          fs.rmdirSync(dirPath);
        }
      ),
      { numRuns: 50 } // Fewer runs for file I/O tests
    );
  });

  it('should create directories recursively', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ),
        (segments) => {
          const dirPath = path.join(tempDir, ...segments);

          // Directory doesn't exist yet
          expect(PathUtils.exists(dirPath)).toBe(false);

          // Create recursively
          PathUtils.mkdirRecursive(dirPath);

          // Now it should exist
          expect(PathUtils.exists(dirPath)).toBe(true);
          expect(PathUtils.isDirectory(dirPath)).toBe(true);

          // All parent directories should also exist
          let currentPath = tempDir;
          for (const segment of segments) {
            currentPath = path.join(currentPath, segment);
            expect(PathUtils.exists(currentPath)).toBe(true);
            expect(PathUtils.isDirectory(currentPath)).toBe(true);
          }

          // Clean up
          fs.rmSync(path.join(tempDir, segments[0]), { recursive: true });
        }
      ),
      { numRuns: 50 } // Fewer runs for file I/O tests
    );
  });

  it('should compute relative paths consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ),
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ),
        (fromSegments, toSegments) => {
          const fromPath = path.join(tempDir, ...fromSegments);
          const toPath = path.join(tempDir, ...toSegments);

          // Compute relative path using PathUtils
          const relativePath = PathUtils.relative(fromPath, toPath);

          // Compute using native path module
          const nativeRelativePath = path.relative(fromPath, toPath);

          // Should produce the same result
          expect(relativePath).toBe(nativeRelativePath);

          // Resolving the relative path from fromPath should give toPath
          const resolved = path.resolve(fromPath, relativePath);
          expect(PathUtils.normalize(resolved)).toBe(PathUtils.normalize(toPath));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should parse and format paths consistently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          { minLength: 1, maxLength: 3 }
        ),
        fc.oneof(fc.constant('.txt'), fc.constant('.bin'), fc.constant('.cst')),
        (segments, ext) => {
          const fileName = segments[segments.length - 1] + ext;
          const filePath = segments.length > 1
            ? path.join(...segments.slice(0, -1), fileName)
            : fileName;

          // Parse using PathUtils
          const parsed = PathUtils.parse(filePath);

          // Parse using native path module
          const nativeParsed = path.parse(filePath);

          // Should produce the same result
          expect(parsed).toEqual(nativeParsed);

          // Format back
          const formatted = PathUtils.format(parsed);
          const nativeFormatted = path.format(nativeParsed);

          // Should produce the same result
          expect(formatted).toBe(nativeFormatted);

          // Should match the original (after normalization)
          expect(PathUtils.normalize(formatted)).toBe(PathUtils.normalize(filePath));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide correct platform-specific separators', () => {
    // Separator should match native path module
    expect(PathUtils.separator).toBe(path.sep);
    expect(PathUtils.delimiter).toBe(path.delimiter);

    // Separator should be either / or \
    expect(['/', '\\']).toContain(PathUtils.separator);

    // Delimiter should be either : or ;
    expect([':', ';']).toContain(PathUtils.delimiter);
  });
});
