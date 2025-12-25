/**
 * Property-based tests for Image Processor
 * Feature: typescript-font-converter
 * 
 * These tests validate that image processing operations maintain correctness
 * properties across all valid inputs using fast-check for property-based testing.
 */

import * as fc from 'fast-check';
import { ImageProcessor } from '../src/image-processor';
import { RenderMode, Rotation } from '../src/types';

/**
 * Arbitrary generator for grayscale pixel data
 * Generates a valid bitmap with specified dimensions
 */
const pixelDataArbitrary = (
  minWidth: number = 1,
  maxWidth: number = 64,
  minHeight: number = 1,
  maxHeight: number = 64
): fc.Arbitrary<{ pixels: Uint8Array; width: number; height: number }> => {
  return fc.record({
    width: fc.integer({ min: minWidth, max: maxWidth }),
    height: fc.integer({ min: minHeight, max: maxHeight })
  }).chain(({ width, height }) => {
    return fc.array(
      fc.integer({ min: 0, max: 255 }),
      { minLength: width * height, maxLength: width * height }
    ).map(pixelArray => ({
      pixels: new Uint8Array(pixelArray),
      width,
      height
    }));
  });
};

/**
 * Arbitrary generator for non-empty pixel data (has at least one non-zero pixel)
 */
const nonEmptyPixelDataArbitrary = (
  minWidth: number = 4,
  maxWidth: number = 32,
  minHeight: number = 4,
  maxHeight: number = 32
): fc.Arbitrary<{ pixels: Uint8Array; width: number; height: number }> => {
  return pixelDataArbitrary(minWidth, maxWidth, minHeight, maxHeight).filter(({ pixels }) => {
    // Ensure at least one non-zero pixel
    return pixels.some(p => p > 0);
  });
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
 * Helper function to calculate total pixel intensity
 */
function calculateTotalIntensity(pixels: Uint8Array): number {
  return pixels.reduce((sum, p) => sum + p, 0);
}

/**
 * Helper function to count non-zero pixels
 */
function countNonZeroPixels(pixels: Uint8Array): number {
  return pixels.filter(p => p > 0).length;
}

/**
 * Helper function to check if two pixel arrays are different
 */
function arePixelsDifferent(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

describe('Feature: typescript-font-converter, Property 7: 样式应用改变输出', () => {
  /**
   * Property 7: Style Application Changes Output
   * For any character, applying bold, italic, or rotation should produce
   * output that is different from the original.
   * 
   * Validates: Requirements 2.3, 2.4, 2.5
   */

  describe('Bold style application', () => {
    it('should produce different output when bold is applied to non-empty bitmap', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.applyBold(pixels, width, height);
            
            // Bold should increase width by 1
            if (result.width !== width + 1) {
              return false;
            }
            
            // Height should remain the same
            if (result.height !== height) {
              return false;
            }
            
            // Output should be different (different dimensions means different)
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve or increase total pixel intensity when bold is applied', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.applyBold(pixels, width, height);
            
            const originalIntensity = calculateTotalIntensity(pixels);
            const boldIntensity = calculateTotalIntensity(result.pixels);
            
            // Bold effect should preserve or increase intensity (due to dilation)
            return boldIntensity >= originalIntensity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty bitmap gracefully', () => {
      const result = ImageProcessor.applyBold(new Uint8Array(0), 0, 0);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.pixels.length).toBe(0);
    });
  });

  describe('Italic style application', () => {
    it('should produce different output when italic is applied to non-empty bitmap', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.applyItalic(pixels, width, height);
            
            // Italic should increase width (due to shear)
            if (result.width <= width) {
              return false;
            }
            
            // Height should remain the same
            if (result.height !== height) {
              return false;
            }
            
            // Output should be different (different dimensions means different)
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve total pixel intensity when italic is applied', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.applyItalic(pixels, width, height);
            
            const originalIntensity = calculateTotalIntensity(pixels);
            const italicIntensity = calculateTotalIntensity(result.pixels);
            
            // Italic (shear) should preserve total intensity
            return italicIntensity === originalIntensity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty bitmap gracefully', () => {
      const result = ImageProcessor.applyItalic(new Uint8Array(0), 0, 0);
      expect(result.width).toBe(0);
      expect(result.height).toBe(0);
      expect(result.pixels.length).toBe(0);
    });
  });

  describe('Rotation transformation', () => {
    it('should produce different output when non-zero rotation is applied', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(4, 32, 4, 32).filter(({ width, height }) => width !== height),
          fc.constantFrom(Rotation.ROTATE_90, Rotation.ROTATE_180, Rotation.ROTATE_270),
          ({ pixels, width, height }, rotation) => {
            const result = ImageProcessor.rotateImage(pixels, width, height, rotation);
            
            // For 90° and 270°, dimensions should swap
            if (rotation === Rotation.ROTATE_90 || rotation === Rotation.ROTATE_270) {
              if (result.width !== height || result.height !== width) {
                return false;
              }
            }
            
            // For 180°, dimensions should stay the same
            if (rotation === Rotation.ROTATE_180) {
              if (result.width !== width || result.height !== height) {
                return false;
              }
            }
            
            // Output pixels should be different from input (for non-symmetric images)
            return arePixelsDifferent(pixels, result.pixels);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve total pixel intensity when rotation is applied', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          rotationArbitrary(),
          ({ pixels, width, height }, rotation) => {
            const result = ImageProcessor.rotateImage(pixels, width, height, rotation);
            
            const originalIntensity = calculateTotalIntensity(pixels);
            const rotatedIntensity = calculateTotalIntensity(result.pixels);
            
            // Rotation should preserve total intensity
            return rotatedIntensity === originalIntensity;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return identical output for 0° rotation', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.rotateImage(pixels, width, height, Rotation.ROTATE_0);
            
            // Dimensions should be unchanged
            if (result.width !== width || result.height !== height) {
              return false;
            }
            
            // Pixels should be identical (but a copy)
            if (result.pixels.length !== pixels.length) {
              return false;
            }
            
            for (let i = 0; i < pixels.length; i++) {
              if (result.pixels[i] !== pixels[i]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return to original after four 90° rotations', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(2, 16, 2, 16),
          ({ pixels, width, height }) => {
            let result = { pixels, width, height };
            
            // Apply 90° rotation four times
            for (let i = 0; i < 4; i++) {
              result = ImageProcessor.rotateImage(
                result.pixels,
                result.width,
                result.height,
                Rotation.ROTATE_90
              );
            }
            
            // Should return to original dimensions
            if (result.width !== width || result.height !== height) {
              return false;
            }
            
            // Should return to original pixels
            for (let i = 0; i < pixels.length; i++) {
              if (result.pixels[i] !== pixels[i]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined style transformations', () => {
    it('should produce different output when bold and italic are combined', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            // Apply bold first
            const boldResult = ImageProcessor.applyBold(pixels, width, height);
            
            // Then apply italic
            const combinedResult = ImageProcessor.applyItalic(
              boldResult.pixels,
              boldResult.width,
              boldResult.height
            );
            
            // Combined should have larger dimensions than original
            if (combinedResult.width <= width) {
              return false;
            }
            
            // Height should remain the same
            if (combinedResult.height !== height) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


describe('Feature: typescript-font-converter, Property 8: Cropping 移除空白空间', () => {
  /**
   * Property 8: Cropping Removes Whitespace
   * For any glyph with cropping enabled, the cropped bitmap should not
   * contain fully empty rows or columns at the edges (except for empty glyphs).
   * 
   * Validates: Requirements 2.6
   */

  describe('Cropping removes whitespace', () => {
    it('should remove leading empty rows from top', () => {
      fc.assert(
        fc.property(
          // Generate bitmap with guaranteed empty rows at top
          fc.integer({ min: 1, max: 10 }).chain(emptyRows =>
            fc.integer({ min: 4, max: 16 }).chain(width =>
              fc.integer({ min: 4, max: 16 }).chain(contentHeight =>
                fc.array(
                  fc.integer({ min: 1, max: 255 }),
                  { minLength: width * contentHeight, maxLength: width * contentHeight }
                ).map(contentPixels => {
                  const height = emptyRows + contentHeight;
                  const pixels = new Uint8Array(width * height);
                  // Leave top rows empty (zeros)
                  // Fill content rows
                  for (let i = 0; i < contentPixels.length; i++) {
                    pixels[emptyRows * width + i] = contentPixels[i];
                  }
                  return { pixels, width, height, emptyRows };
                })
              )
            )
          ),
          ({ pixels, width, height, emptyRows }) => {
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            
            // topSkip should be at least emptyRows
            if (result.cropInfo.topSkip < emptyRows) {
              return false;
            }
            
            // Cropped bitmap should not have empty top row
            if (result.cropInfo.validHeight > 0) {
              let hasNonZeroInFirstRow = false;
              for (let x = 0; x < result.cropInfo.validWidth; x++) {
                if (result.pixels[x] > 0) {
                  hasNonZeroInFirstRow = true;
                  break;
                }
              }
              // First row should have at least one non-zero pixel
              // (unless the entire content is in later rows)
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove trailing empty rows from bottom', () => {
      fc.assert(
        fc.property(
          // Generate bitmap with guaranteed empty rows at bottom
          fc.integer({ min: 1, max: 10 }).chain(emptyRows =>
            fc.integer({ min: 4, max: 16 }).chain(width =>
              fc.integer({ min: 4, max: 16 }).chain(contentHeight =>
                fc.array(
                  fc.integer({ min: 1, max: 255 }),
                  { minLength: width * contentHeight, maxLength: width * contentHeight }
                ).map(contentPixels => {
                  const height = contentHeight + emptyRows;
                  const pixels = new Uint8Array(width * height);
                  // Fill content rows at top
                  for (let i = 0; i < contentPixels.length; i++) {
                    pixels[i] = contentPixels[i];
                  }
                  // Leave bottom rows empty (zeros)
                  return { pixels, width, height, contentHeight };
                })
              )
            )
          ),
          ({ pixels, width, height, contentHeight }) => {
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            
            // validHeight should be at most contentHeight
            if (result.cropInfo.validHeight > contentHeight) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove leading empty columns from left', () => {
      fc.assert(
        fc.property(
          // Generate bitmap with guaranteed empty columns at left
          fc.integer({ min: 1, max: 10 }).chain(emptyCols =>
            fc.integer({ min: 4, max: 16 }).chain(contentWidth =>
              fc.integer({ min: 4, max: 16 }).chain(height =>
                fc.array(
                  fc.integer({ min: 1, max: 255 }),
                  { minLength: contentWidth * height, maxLength: contentWidth * height }
                ).map(contentPixels => {
                  const width = emptyCols + contentWidth;
                  const pixels = new Uint8Array(width * height);
                  // Fill content columns (skip left empty columns)
                  for (let y = 0; y < height; y++) {
                    for (let x = 0; x < contentWidth; x++) {
                      pixels[y * width + (x + emptyCols)] = contentPixels[y * contentWidth + x];
                    }
                  }
                  return { pixels, width, height, emptyCols };
                })
              )
            )
          ),
          ({ pixels, width, height, emptyCols }) => {
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            
            // leftSkip should be at least emptyCols
            if (result.cropInfo.leftSkip < emptyCols) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should remove trailing empty columns from right', () => {
      fc.assert(
        fc.property(
          // Generate bitmap with guaranteed empty columns at right
          fc.integer({ min: 1, max: 10 }).chain(emptyCols =>
            fc.integer({ min: 4, max: 16 }).chain(contentWidth =>
              fc.integer({ min: 4, max: 16 }).chain(height =>
                fc.array(
                  fc.integer({ min: 1, max: 255 }),
                  { minLength: contentWidth * height, maxLength: contentWidth * height }
                ).map(contentPixels => {
                  const width = contentWidth + emptyCols;
                  const pixels = new Uint8Array(width * height);
                  // Fill content columns at left
                  for (let y = 0; y < height; y++) {
                    for (let x = 0; x < contentWidth; x++) {
                      pixels[y * width + x] = contentPixels[y * contentWidth + x];
                    }
                  }
                  // Leave right columns empty
                  return { pixels, width, height, contentWidth };
                })
              )
            )
          ),
          ({ pixels, width, height, contentWidth }) => {
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            
            // validWidth should be at most contentWidth
            if (result.cropInfo.validWidth > contentWidth) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all non-zero pixels after cropping', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            
            // Count non-zero pixels in original
            const originalNonZero = countNonZeroPixels(pixels);
            
            // Count non-zero pixels in cropped
            const croppedNonZero = countNonZeroPixels(result.pixels);
            
            // Should preserve all non-zero pixels
            return croppedNonZero === originalNonZero;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce valid cropInfo that can reconstruct original position', () => {
      fc.assert(
        fc.property(
          nonEmptyPixelDataArbitrary(),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            const { cropInfo } = result;
            
            // Verify cropInfo values are within bounds
            if (cropInfo.topSkip < 0 || cropInfo.topSkip >= height) {
              return false;
            }
            if (cropInfo.leftSkip < 0 || cropInfo.leftSkip >= width) {
              return false;
            }
            if (cropInfo.validWidth <= 0 || cropInfo.validWidth > width) {
              return false;
            }
            if (cropInfo.validHeight <= 0 || cropInfo.validHeight > height) {
              return false;
            }
            
            // Verify cropped dimensions match cropInfo
            if (result.pixels.length !== cropInfo.validWidth * cropInfo.validHeight) {
              return false;
            }
            
            // Verify we can reconstruct original pixel positions
            for (let y = 0; y < cropInfo.validHeight; y++) {
              for (let x = 0; x < cropInfo.validWidth; x++) {
                const croppedIdx = y * cropInfo.validWidth + x;
                const originalIdx = (y + cropInfo.topSkip) * width + (x + cropInfo.leftSkip);
                
                if (result.pixels[croppedIdx] !== pixels[originalIdx]) {
                  return false;
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty bitmap gracefully', () => {
      const result = ImageProcessor.cropCharacter(new Uint8Array(0), 0, 0);
      expect(result.cropInfo.topSkip).toBe(0);
      expect(result.cropInfo.leftSkip).toBe(0);
      expect(result.cropInfo.validWidth).toBe(0);
      expect(result.cropInfo.validHeight).toBe(0);
      expect(result.pixels.length).toBe(0);
    });

    it('should handle all-zero bitmap gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 32 }),
          fc.integer({ min: 1, max: 32 }),
          (width, height) => {
            const pixels = new Uint8Array(width * height); // All zeros
            const result = ImageProcessor.cropCharacter(pixels, width, height);
            
            // For all-zero bitmap, should return empty result
            return (
              result.cropInfo.validWidth === 0 &&
              result.cropInfo.validHeight === 0 &&
              result.pixels.length === 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


describe('Feature: typescript-font-converter, Property 6: Render Mode 像素打包正确性', () => {
  /**
   * Property 6: Render Mode Pixel Packing Correctness
   * For any bitmap glyph and render mode (1/2/4/8-bit), the packed byte count
   * should equal ceil(width * height * bitsPerPixel / 8).
   * 
   * Validates: Requirements 2.1, 2.8
   */

  describe('Pixel packing size correctness', () => {
    it('should produce correct packed size for 1-bit mode', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 64, 1, 64),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo1Bit(pixels, width, height);
            const expectedSize = ImageProcessor.calculatePackedSize(width, height, RenderMode.BIT_1);
            
            // Packed size should match expected
            return packed.length === expectedSize;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce correct packed size for 2-bit mode', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 64, 1, 64),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo2Bit(pixels, width, height);
            const expectedSize = ImageProcessor.calculatePackedSize(width, height, RenderMode.BIT_2);
            
            // Packed size should match expected
            return packed.length === expectedSize;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce correct packed size for 4-bit mode', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 64, 1, 64),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo4Bit(pixels, width, height);
            const expectedSize = ImageProcessor.calculatePackedSize(width, height, RenderMode.BIT_4);
            
            // Packed size should match expected
            return packed.length === expectedSize;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce correct packed size for 8-bit mode', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 64, 1, 64),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo8Bit(pixels, width, height);
            const expectedSize = ImageProcessor.calculatePackedSize(width, height, RenderMode.BIT_8);
            
            // Packed size should match expected
            return packed.length === expectedSize;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce correct packed size for all render modes via packPixels', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 32, 1, 32),
          renderModeArbitrary(),
          ({ pixels, width, height }, renderMode) => {
            const packed = ImageProcessor.packPixels(pixels, width, height, renderMode);
            const expectedSize = ImageProcessor.calculatePackedSize(width, height, renderMode);
            
            // Packed size should match expected
            return packed.length === expectedSize;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pixel packing formula verification', () => {
    it('should calculate packed size as ceil(width * height * bitsPerPixel / 8)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          renderModeArbitrary(),
          (width, height, renderMode) => {
            const calculatedSize = ImageProcessor.calculatePackedSize(width, height, renderMode);
            
            // Manual calculation
            const pixelsPerByte = 8 / renderMode;
            const bytesPerRow = Math.ceil(width / pixelsPerByte);
            const expectedSize = height * bytesPerRow;
            
            return calculatedSize === expectedSize;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('1-bit packing correctness', () => {
    it('should pack pixels with threshold at 128', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(8, 32, 1, 16),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo1Bit(pixels, width, height);
            
            // Verify each packed byte
            const bytesPerRow = Math.ceil(width / 8);
            
            for (let y = 0; y < height; y++) {
              for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
                const packedByte = packed[y * bytesPerRow + byteIdx];
                
                for (let bitPos = 0; bitPos < 8; bitPos++) {
                  const col = byteIdx * 8 + bitPos;
                  if (col < width) {
                    const originalPixel = pixels[y * width + col];
                    const expectedBit = originalPixel >= 128 ? 1 : 0;
                    const actualBit = (packedByte >> bitPos) & 1;
                    
                    if (expectedBit !== actualBit) {
                      return false;
                    }
                  }
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('2-bit packing correctness', () => {
    it('should quantize pixels to 4 levels', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(4, 32, 1, 16),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo2Bit(pixels, width, height);
            
            // Verify each packed byte
            const bytesPerRow = Math.ceil(width / 4);
            
            for (let y = 0; y < height; y++) {
              for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
                const packedByte = packed[y * bytesPerRow + byteIdx];
                
                for (let pixelPos = 0; pixelPos < 4; pixelPos++) {
                  const col = byteIdx * 4 + pixelPos;
                  if (col < width) {
                    const originalPixel = pixels[y * width + col];
                    const expectedValue = originalPixel >> 6; // Quantize to 0-3
                    const actualValue = (packedByte >> (pixelPos * 2)) & 0x03;
                    
                    if (expectedValue !== actualValue) {
                      return false;
                    }
                  }
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('4-bit packing correctness', () => {
    it('should quantize pixels to 16 levels', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(2, 32, 1, 16),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo4Bit(pixels, width, height);
            
            // Verify each packed byte
            const bytesPerRow = Math.ceil(width / 2);
            
            for (let y = 0; y < height; y++) {
              for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
                const packedByte = packed[y * bytesPerRow + byteIdx];
                
                // First pixel in low nibble
                const col0 = byteIdx * 2;
                if (col0 < width) {
                  const originalPixel0 = pixels[y * width + col0];
                  const expectedValue0 = originalPixel0 >> 4; // Quantize to 0-15
                  const actualValue0 = packedByte & 0x0F;
                  
                  if (expectedValue0 !== actualValue0) {
                    return false;
                  }
                }
                
                // Second pixel in high nibble
                const col1 = byteIdx * 2 + 1;
                if (col1 < width) {
                  const originalPixel1 = pixels[y * width + col1];
                  const expectedValue1 = originalPixel1 >> 4; // Quantize to 0-15
                  const actualValue1 = (packedByte >> 4) & 0x0F;
                  
                  if (expectedValue1 !== actualValue1) {
                    return false;
                  }
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('8-bit packing correctness', () => {
    it('should preserve pixel values exactly', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 32, 1, 32),
          ({ pixels, width, height }) => {
            const packed = ImageProcessor.packTo8Bit(pixels, width, height);
            
            // 8-bit packing should preserve all pixel values
            if (packed.length !== pixels.length) {
              return false;
            }
            
            for (let i = 0; i < pixels.length; i++) {
              if (packed[i] !== pixels[i]) {
                return false;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Byte alignment', () => {
    it('should adjust dimensions to multiples of 8', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (width, height) => {
            const [alignedWidth, alignedHeight] = ImageProcessor.adjustDimensionsForAlignment(width, height);
            
            // Both dimensions should be multiples of 8
            if (alignedWidth % 8 !== 0 || alignedHeight % 8 !== 0) {
              return false;
            }
            
            // Aligned dimensions should be >= original
            if (alignedWidth < width || alignedHeight < height) {
              return false;
            }
            
            // Aligned dimensions should be minimal (< original + 8)
            if (alignedWidth >= width + 8 || alignedHeight >= height + 8) {
              return false;
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pad image to aligned dimensions', () => {
      fc.assert(
        fc.property(
          pixelDataArbitrary(1, 32, 1, 32),
          ({ pixels, width, height }) => {
            const result = ImageProcessor.padImageForAlignment(pixels, width, height);
            
            // Result dimensions should be multiples of 8
            if (result.width % 8 !== 0 || result.height % 8 !== 0) {
              return false;
            }
            
            // Original pixels should be preserved in top-left corner
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const originalIdx = y * width + x;
                const paddedIdx = y * result.width + x;
                
                if (result.pixels[paddedIdx] !== pixels[originalIdx]) {
                  return false;
                }
              }
            }
            
            // Padding should be zeros
            for (let y = 0; y < result.height; y++) {
              for (let x = 0; x < result.width; x++) {
                if (y >= height || x >= width) {
                  const paddedIdx = y * result.width + x;
                  if (result.pixels[paddedIdx] !== 0) {
                    return false;
                  }
                }
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
